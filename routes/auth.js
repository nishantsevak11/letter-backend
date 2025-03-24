const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google OAuth login route
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'] 
}));

// Callback route after Google auth
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  console.log('Callback reached with user:', req.user);
  res.redirect(`${process.env.FRONTEND_URL}`);
});

// Get current user
router.get('/user', (req, res) => res.json(req.user || null));

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => res.redirect(process.env.FRONTEND_URL));
});

module.exports = router;