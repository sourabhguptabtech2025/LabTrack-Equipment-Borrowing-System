const express = require('express');
const router = express.Router();
const {
  getComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  getAnalytics
} = require('../controllers/componentController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public route to get analytics data
router.get('/analytics', getAnalytics);

// CRUD routes for components
router.route('/')
  .get(getComponents)
  .post(protect, adminOnly, createComponent);

router.route('/:id')
  .get(getComponentById)
  .put(protect, adminOnly, updateComponent)
  .delete(protect, adminOnly, deleteComponent);

module.exports = router;
