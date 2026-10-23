const mongoose = require('mongoose');

const borrowRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Component',
      required: [true, 'Component reference is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1
    },
    borrowDate: {
      type: Date,
      default: Date.now
    },
    expectedReturnDate: {
      type: Date,
      required: [true, 'Expected return date is required']
    },
    actualReturnDate: {
      type: Date
    },
    purpose: {
      type: String,
      required: [true, 'Borrowing purpose or project title is required'],
      trim: true,
      maxlength: [300, 'Purpose cannot exceed 300 characters']
    },
    requisitionSlipUrl: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Requested', 'Issued', 'Returned', 'Rejected', 'Overdue'],
      default: 'Issued'
    },
    issueNotes: {
      type: String,
      default: ''
    },
    remarks: {
      type: String,
      default: ''
    },
    lastReminderSentAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Helpful index for queries and aggregation
borrowRecordSchema.index({ user: 1, status: 1 });
borrowRecordSchema.index({ component: 1, status: 1 });
borrowRecordSchema.index({ expectedReturnDate: 1 });

module.exports = mongoose.model('BorrowRecord', borrowRecordSchema);
