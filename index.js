const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();
require('./config/passport');

const authRoutes = require('./routes/auth');
const letterRoutes = require('./routes/letters');

const app = express();

// Configure CORS - Allow your frontend to access the backend
app.use(cors({
  origin: 'https://letter-frontend-xi.vercel.app/', // Adjust as needed
  credentials: true, // Allow cookies and authentication headers
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'], // Ensure all required methods are allowed
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow necessary headers
}));

// Middleware
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/auth', authRoutes);
app.use('/letters', letterRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
