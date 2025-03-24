const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const Letter = require('../models/Letter');

// Middleware to ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Configure Google Drive API
const auth = new google.auth.OAuth2();
const drive = google.drive({ version: 'v3', auth });

// Find or create the "Letters" folder in Google Drive
const findOrCreateLettersFolder = async () => {
  try {
    // Search for the "Letters" folder in the user's My Drive
    const response = await drive.files.list({
      q: "name='Letters' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    let folderId;
    const folders = response.data.files;

    if (folders.length > 0) {
      // Folder exists, use its ID
      folderId = folders[0].id;
      console.log('Found Letters folder:', folderId);
    } else {
      // Folder doesn't exist, create it
      const folderMetadata = {
        name: 'Letters',
        mimeType: 'application/vnd.google-apps.folder',
      };
      const folder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id',
      });
      folderId = folder.data.id;
      console.log('Created Letters folder:', folderId);
    }

    return folderId;
  } catch (error) {
    console.error('Error finding or creating Letters folder:', error);
    throw error;
  }
};

// Fetch all letters for the logged-in user
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const letters = await Letter.find({ userId: req.user.id });
    res.json(letters);
  } catch (error) {
    console.error('Error fetching letters:', error);
    res.status(500).json({ error: 'Failed to fetch letters' });
  }
});

// Fetch a single letter by ID
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const letter = await Letter.findOne({ _id: req.params.id, userId: req.user.id });
    if (!letter) {
      return res.status(404).json({ error: 'Letter not found' });
    }
    res.json(letter);
  } catch (error) {
    console.error('Error fetching letter:', error);
    res.status(500).json({ error: 'Failed to fetch letter' });
  }
});

// Save a letter (create or update)
router.post('/save', ensureAuthenticated, async (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  try {
    // Set up Google Drive API credentials with the user's access token
    auth.setCredentials({ access_token: req.user.accessToken });

    let letter;
    let googleDriveId;

    if (req.body.id) {
      // Update existing letter
      letter = await Letter.findOne({ _id: req.body.id, userId: req.user.id });
      if (!letter) {
        return res.status(404).json({ error: 'Letter not found' });
      }

      // Update the file in Google Drive
      await drive.files.update({
        fileId: letter.googleDriveId,
        resource: {
          name: title,
        },
        media: {
          mimeType: 'text/html',
          body: content,
        },
      });

      // Update the letter in MongoDB
      letter = await Letter.findOneAndUpdate(
        { _id: req.body.id, userId: req.user.id },
        { title, content, updatedAt: new Date() },
        { new: true }
      );
      googleDriveId = letter.googleDriveId;
    } else {
      // Create new letter
      // Find or create the "Letters" folder
      const folderId = await findOrCreateLettersFolder();

      // Create a Google Doc in the "Letters" folder
      const fileMetadata = {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
        parents: [folderId], // Store the file in the "Letters" folder
      };
      const fileContent = {
        mimeType: 'text/html',
        body: content,
      };

      const driveResponse = await drive.files.create({
        resource: fileMetadata,
        media: fileContent,
        fields: 'id',
      });

      googleDriveId = driveResponse.data.id;

      // Save the letter in MongoDB
      letter = new Letter({
        userId: req.user.id,
        title,
        content,
        googleDriveId,
      });
      await letter.save();
    }

    res.json({ letter, driveId: googleDriveId });
  } catch (error) {
    console.error('Error saving letter:', error);
    res.status(500).json({ error: 'Failed to save letter' });
  }
});

// Delete a letter
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const letter = await Letter.findOne({ _id: req.params.id, userId: req.user.id });
    if (!letter) {
      return res.status(404).json({ error: 'Letter not found' });
    }

    // Delete the file from Google Drive
    if (letter.googleDriveId) {
      auth.setCredentials({ access_token: req.user.accessToken });
      await drive.files.delete({ fileId: letter.googleDriveId });
    }

    // Delete the letter from MongoDB
    await Letter.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Letter deleted successfully' });
  } catch (error) {
    console.error('Error deleting letter:', error);
    res.status(500).json({ error: 'Failed to delete letter' });
  }
});

module.exports = router;