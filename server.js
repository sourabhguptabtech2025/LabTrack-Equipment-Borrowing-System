require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./src/config/db');
const { sanitizeMiddleware } = require('./src/middleware/sanitizeMiddleware');
const { notFound, errorHandler } = require('./src/middleware/errorMiddleware');

// Route Handlers
const authRoutes = require('./src/routes/authRoutes');
const componentRoutes = require('./src/routes/componentRoutes');
const borrowRoutes = require('./src/routes/borrowRoutes');

// Connect to MongoDB
connectDB();

const app = express();

// Standard Security & Body Parsers
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Unit 3 Rubric requirement: Client/Server RegExp validation to sanitize input fields and strip any <script> tags
app.use(sanitizeMiddleware);

// Static Folders
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/borrow', borrowRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'LabTrack: Lab Equipment & Component Borrowing System',
    timestamp: new Date().toISOString()
  });
});

// Single-Page Frontend Fallback: Serves /public/index.html for all non-API GET requests
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`   LabTrack Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`   Local URL:    http://localhost:${PORT}`);
  console.log(`   API Endpoint: http://localhost:${PORT}/api`);
  console.log(`======================================================\n`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[UnhandledRejection] ${err.message}`);
  // Keep server alive or exit based on severity
});

module.exports = app;
