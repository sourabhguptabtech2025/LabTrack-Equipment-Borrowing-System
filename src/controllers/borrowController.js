const fs = require('fs');
const path = require('path');
const BorrowRecord = require('../models/BorrowRecord');
const Component = require('../models/Component');
const User = require('../models/User');
const { auditLogger, logFilePath } = require('../events/auditLogger');
const { sendItemIssueEmail, sendOverdueReminderEmail } = require('../utils/emailService');

// @desc    Submit equipment borrow request (with file upload for requisition slip / student ID)
// @route   POST /api/borrow
// @access  Private (Student or Admin)
const createBorrowRequest = async (req, res, next) => {
  try {
    const { componentId, quantity, expectedReturnDate, purpose } = req.body;
    const requestedQty = Math.max(1, parseInt(quantity, 10) || 1);

    if (!componentId || !expectedReturnDate || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Component ID, expected return date, and purpose are required.'
      });
    }

    const component = await Component.findById(componentId);
    if (!component) {
      return res.status(404).json({
        success: false,
        message: 'Component not found in laboratory inventory.'
      });
    }

    if (component.availableStock < requestedQty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory. Requested ${requestedQty} unit(s), but only ${component.availableStock} available.`
      });
    }

    // Determine requisition slip path if uploaded via Multer
    let requisitionSlipUrl = '';
    if (req.file) {
      requisitionSlipUrl = `/uploads/${req.file.filename}`;
    }

    // If an admin borrows on behalf of or directly, or student creates, auto-issue or request
    // Admin directly issuing vs student request: in educational labs, requests are auto-issued or issued on submit
    const isAutoIssue = true;
    const recordStatus = isAutoIssue ? 'Issued' : 'Requested';

    // Decrement component available stock
    component.availableStock -= requestedQty;
    await component.save();

    const borrowRecord = await BorrowRecord.create({
      user: req.user._id,
      component: component._id,
      quantity: requestedQty,
      expectedReturnDate: new Date(expectedReturnDate),
      purpose,
      requisitionSlipUrl,
      status: recordStatus,
      issueNotes: `Requisition checked out by ${req.user.name}`
    });

    const populatedRecord = await BorrowRecord.findById(borrowRecord._id)
      .populate('user', 'name email prn department phone')
      .populate('component', 'name category labRoom specifications');

    // Emit Audit Logger Event via Node's native EventEmitter
    auditLogger.emit('borrow:created', {
      user: req.user,
      component,
      quantity: requestedQty,
      status: recordStatus,
      purpose,
      slip: requisitionSlipUrl
    });

    if (recordStatus === 'Issued') {
      auditLogger.emit('borrow:issued', {
        user: req.user,
        component,
        quantity: requestedQty,
        admin: req.user.role === 'admin' ? req.user : null,
        expectedReturnDate
      });

      // Automated email sending via nodemailer on item issue
      sendItemIssueEmail({
        studentEmail: req.user.email,
        studentName: req.user.name,
        prn: req.user.prn,
        componentName: component.name,
        quantity: requestedQty,
        expectedReturnDate,
        borrowId: borrowRecord._id
      }).catch((err) => console.error('[BorrowController] Issue email background error:', err.message));
    }

    res.status(201).json({
      success: true,
      message: `Equipment "${component.name}" successfully checked out!`,
      borrowRecord: populatedRecord
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all borrow records (Admin gets all, Student gets their own)
// @route   GET /api/borrow
// @access  Private
const getBorrowRecords = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    // Role-based visibility
    if (req.user.role !== 'admin') {
      filter.user = req.user._id;
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    let records = await BorrowRecord.find(filter)
      .populate('user', 'name email prn department phone')
      .populate('component', 'name category labRoom specifications imageUrl')
      .sort({ createdAt: -1 });

    // Optional text search filter
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      records = records.filter((rec) => {
        const compMatch = rec.component?.name?.toLowerCase().includes(q);
        const userMatch = rec.user?.name?.toLowerCase().includes(q) || rec.user?.prn?.includes(q);
        const purposeMatch = rec.purpose?.toLowerCase().includes(q);
        return compMatch || userMatch || purposeMatch;
      });
    }

    res.status(200).json({
      success: true,
      count: records.length,
      borrowRecords: records
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single borrow record
// @route   GET /api/borrow/:id
// @access  Private
const getBorrowRecordById = async (req, res, next) => {
  try {
    const record = await BorrowRecord.findById(req.params.id)
      .populate('user', 'name email prn department phone')
      .populate('component', 'name category labRoom specifications');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Borrow record not found.'
      });
    }

    // Role check: Admin or the owner
    if (req.user.role !== 'admin' && record.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this borrow record.'
      });
    }

    res.status(200).json({
      success: true,
      borrowRecord: record
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update borrow record status (Return equipment, Approve/Issue, Reject)
// @route   PUT /api/borrow/:id/status
// @access  Private
const updateBorrowStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    const record = await BorrowRecord.findById(req.params.id)
      .populate('user', 'name email prn department')
      .populate('component', 'name category totalStock availableStock');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Borrow record not found.'
      });
    }

    const previousStatus = record.status;
    const isOwner = record.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    // Student can only mark their own active loan as 'Returned'
    if (!isAdmin && (!isOwner || status !== 'Returned')) {
      return res.status(403).json({
        success: false,
        message: 'Only Administrators can change status, or borrowers can submit a return.'
      });
    }

    if (remarks) {
      record.remarks = remarks;
    }

    const component = await Component.findById(record.component._id);

    // If changing to 'Returned' and was not previously returned
    if (status === 'Returned' && previousStatus !== 'Returned') {
      record.status = 'Returned';
      record.actualReturnDate = new Date();

      if (component) {
        // Restore stock
        component.availableStock = Math.min(
          component.totalStock,
          component.availableStock + record.quantity
        );
        await component.save();
      }

      await record.save();

      // Emit Return Event to native EventEmitter Audit Logger
      auditLogger.emit('borrow:returned', {
        user: record.user,
        component: record.component,
        quantity: record.quantity,
        remarks: remarks || record.remarks,
        returnedBy: req.user
      });

      return res.status(200).json({
        success: true,
        message: `Equipment "${record.component.name}" marked as RETURNED. Inventory stock restored!`,
        borrowRecord: record
      });
    }

    // If Admin issues a requested item
    if (status === 'Issued' && previousStatus === 'Requested') {
      if (component.availableStock < record.quantity) {
        return res.status(400).json({
          success: false,
          message: 'Cannot issue: insufficient stock currently available.'
        });
      }
      component.availableStock -= record.quantity;
      await component.save();

      record.status = 'Issued';
      await record.save();

      auditLogger.emit('borrow:issued', {
        user: record.user,
        component: record.component,
        quantity: record.quantity,
        admin: req.user,
        expectedReturnDate: record.expectedReturnDate
      });

      // Send automated email on issue
      sendItemIssueEmail({
        studentEmail: record.user.email,
        studentName: record.user.name,
        prn: record.user.prn,
        componentName: record.component.name,
        quantity: record.quantity,
        expectedReturnDate: record.expectedReturnDate,
        borrowId: record._id
      }).catch((e) => console.error(e.message));

      return res.status(200).json({
        success: true,
        message: `Equipment successfully issued to ${record.user.name}.`,
        borrowRecord: record
      });
    }

    // If Admin rejects a requested item
    if (status === 'Rejected') {
      record.status = 'Rejected';
      await record.save();

      auditLogger.emit('borrow:rejected', {
        user: record.user,
        component: record.component,
        reason: remarks || 'Rejected by lab supervisor',
        admin: req.user
      });

      return res.status(200).json({
        success: true,
        message: 'Borrow request rejected.',
        borrowRecord: record
      });
    }

    // General status update
    record.status = status;
    await record.save();

    res.status(200).json({
      success: true,
      message: `Record status updated to ${status}.`,
      borrowRecord: record
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin endpoint to trigger automated overdue reminder email
// @route   POST /api/borrow/:id/remind
// @access  Private/Admin
const sendOverdueReminder = async (req, res, next) => {
  try {
    const record = await BorrowRecord.findById(req.params.id)
      .populate('user', 'name email prn department phone')
      .populate('component', 'name category labRoom');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Borrow record not found.'
      });
    }

    if (record.status === 'Returned') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send overdue reminder for an item that has already been returned.'
      });
    }

    const student = record.user;
    if (!student || !student.email) {
      return res.status(400).json({
        success: false,
        message: 'Student email is unavailable for this record.'
      });
    }

    // Send overdue email using Nodemailer
    const emailResult = await sendOverdueReminderEmail({
      studentEmail: student.email,
      studentName: student.name,
      prn: student.prn,
      componentName: record.component.name,
      quantity: record.quantity,
      dueDate: record.expectedReturnDate,
      borrowId: record._id
    });

    record.lastReminderSentAt = new Date();
    await record.save();

    // Emit event to audit logger
    auditLogger.emit('borrow:reminded', {
      user: student,
      component: record.component,
      admin: req.user,
      emailSentTo: student.email
    });

    res.status(200).json({
      success: true,
      message: `Overdue reminder notification successfully dispatched to ${student.name} (${student.email}).`,
      previewUrl: emailResult.previewUrl || null,
      lastReminderSentAt: record.lastReminderSentAt
    });
  } catch (error) {
    next(error);
  }
};

// @desc    View Audit Trail log file using Node fs.readFile
// @route   GET /api/borrow/logs
// @access  Private/Admin
const getAuditLogs = (req, res) => {
  // Unit 3 Rubric requirement: "An endpoint GET /api/borrow/logs using fs.readFile to power a 'View Audit Trail' modal in the UI."
  fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(200).json({
          success: true,
          count: 0,
          rawLogs: '',
          logs: []
        });
      }
      return res.status(500).json({
        success: false,
        message: `Failed to read audit trail log file: ${err.message}`
      });
    }

    const lines = data
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line, index) => {
        const timeMatch = line.match(/^\[(.*?)\]/);
        const timestamp = timeMatch ? timeMatch[1] : '';
        return {
          id: index + 1,
          timestamp,
          entry: line
        };
      })
      .reverse(); // Most recent entries first

    res.status(200).json({
      success: true,
      count: lines.length,
      rawLogs: data,
      logs: lines
    });
  });
};

// @desc    Delete/Cancel a pending borrow request
// @route   DELETE /api/borrow/:id
// @access  Private
const deleteBorrowRecord = async (req, res, next) => {
  try {
    const record = await BorrowRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Borrow record not found.'
      });
    }

    const isOwner = record.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to cancel this borrow record.'
      });
    }

    if (record.status === 'Issued') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an active issued loan. Equipment must be returned instead.'
      });
    }

    await record.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Borrow record cancelled successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBorrowRequest,
  getBorrowRecords,
  getBorrowRecordById,
  updateBorrowStatus,
  sendOverdueReminder,
  getAuditLogs,
  deleteBorrowRecord
};
