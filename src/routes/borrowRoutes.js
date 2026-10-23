const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createBorrowRequest,
  getBorrowRecords,
  getBorrowRecordById,
  updateBorrowStatus,
  sendOverdueReminder,
  getAuditLogs,
  deleteBorrowRecord
} = require('../controllers/borrowController');

// Unit 3 Rubric requirement: GET /api/borrow/logs using fs.readFile to power "View Audit Trail" modal
router.get('/logs', protect, adminOnly, getAuditLogs);

// Borrow records CRUD & Actions
router.route('/')
  .get(protect, getBorrowRecords)
  .post(protect, upload.single('requisitionSlip'), createBorrowRequest);

// Unit 3 Rubric requirement: POST /api/borrow/:id/remind for admins to send overdue reminders
router.post('/:id/remind', protect, adminOnly, sendOverdueReminder);

router.route('/:id')
  .get(protect, getBorrowRecordById)
  .delete(protect, deleteBorrowRecord);

router.put('/:id/status', protect, updateBorrowStatus);

module.exports = router;
