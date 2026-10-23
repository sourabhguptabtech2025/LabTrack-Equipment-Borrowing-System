const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class AuditLoggerEmitter extends EventEmitter {}
const auditLogger = new AuditLoggerEmitter();

const logDirectory = path.join(__dirname, '../../logs');
const logFilePath = path.join(logDirectory, 'audit_trail.log');

// Ensure logs directory exists
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Core non-blocking logger function
const writeToAuditTrail = (logEntry) => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${logEntry}\n`;

  // Native non-blocking asynchronous fs.appendFile
  fs.appendFile(logFilePath, line, 'utf8', (err) => {
    if (err) {
      console.error('[AuditLogger Error] Failed to append to audit trail:', err.message);
    }
  });
};

// Event Listeners for Borrow and Return transactions
auditLogger.on('borrow:created', (data) => {
  const { user, component, quantity, status, purpose, slip } = data;
  const userInfo = user ? `${user.name} (PRN: ${user.prn || 'N/A'}, Dept: ${user.department || 'N/A'})` : 'Unknown User';
  const compInfo = component ? component.name : 'Unknown Component';
  const slipInfo = slip ? ` | Slip: ${slip}` : '';
  const entry = `[BORROW_REQUESTED] User: ${userInfo} | Component: ${compInfo} | Qty: ${quantity} | Status: ${status} | Purpose: "${purpose || 'N/A'}"${slipInfo}`;
  writeToAuditTrail(entry);
});

auditLogger.on('borrow:issued', (data) => {
  const { user, component, quantity, admin, expectedReturnDate } = data;
  const userInfo = user ? `${user.name} (PRN: ${user.prn || 'N/A'})` : 'Unknown User';
  const compInfo = component ? component.name : 'Unknown Component';
  const adminInfo = admin ? `Approved by: ${admin.name}` : 'Auto-Issued';
  const due = expectedReturnDate ? new Date(expectedReturnDate).toLocaleDateString() : 'N/A';
  const entry = `[ITEM_ISSUED] User: ${userInfo} | Component: ${compInfo} | Qty: ${quantity} | Due: ${due} | ${adminInfo}`;
  writeToAuditTrail(entry);
});

auditLogger.on('borrow:returned', (data) => {
  const { user, component, quantity, remarks, returnedBy } = data;
  const userInfo = user ? `${user.name} (PRN: ${user.prn || 'N/A'})` : 'Unknown User';
  const compInfo = component ? component.name : 'Unknown Component';
  const actionBy = returnedBy ? `Confirmed by: ${returnedBy.name}` : 'Student Return Submission';
  const remarksText = remarks ? ` | Remarks: "${remarks}"` : '';
  const entry = `[ITEM_RETURNED] User: ${userInfo} | Component: ${compInfo} | Qty: ${quantity} | Stock Restored | ${actionBy}${remarksText}`;
  writeToAuditTrail(entry);
});

auditLogger.on('borrow:rejected', (data) => {
  const { user, component, reason, admin } = data;
  const userInfo = user ? `${user.name} (PRN: ${user.prn || 'N/A'})` : 'Unknown User';
  const compInfo = component ? component.name : 'Unknown Component';
  const adminName = admin ? admin.name : 'Admin';
  const entry = `[BORROW_REJECTED] User: ${userInfo} | Component: ${compInfo} | Reason: "${reason || 'Insufficient documentation'}" | Action by: ${adminName}`;
  writeToAuditTrail(entry);
});

auditLogger.on('borrow:reminded', (data) => {
  const { user, component, admin, emailSentTo } = data;
  const userInfo = user ? `${user.name} (PRN: ${user.prn || 'N/A'})` : 'Unknown User';
  const compInfo = component ? component.name : 'Unknown Component';
  const adminName = admin ? admin.name : 'Admin';
  const entry = `[OVERDUE_REMINDER_SENT] Admin: ${adminName} triggered overdue notification -> Sent to: ${emailSentTo || userInfo} | Component: ${compInfo}`;
  writeToAuditTrail(entry);
});

auditLogger.on('component:created', (data) => {
  const { component, admin } = data;
  const compInfo = component ? `${component.name} (Category: ${component.category}, Stock: ${component.totalStock})` : 'New Item';
  const adminName = admin ? admin.name : 'Admin';
  const entry = `[COMPONENT_ADDED] ${compInfo} added to laboratory inventory by ${adminName}`;
  writeToAuditTrail(entry);
});

auditLogger.on('component:updated', (data) => {
  const { component, admin, details } = data;
  const adminName = admin ? admin.name : 'Admin';
  const entry = `[COMPONENT_UPDATED] Component: ${component?.name} updated by ${adminName} | Details: ${details || 'Inventory adjust'}`;
  writeToAuditTrail(entry);
});

auditLogger.on('component:deleted', (data) => {
  const { componentName, admin } = data;
  const adminName = admin ? admin.name : 'Admin';
  const entry = `[COMPONENT_DELETED] Component "${componentName}" removed from inventory by ${adminName}`;
  writeToAuditTrail(entry);
});

auditLogger.on('general:log', (message) => {
  writeToAuditTrail(`[GENERAL_EVENT] ${message}`);
});

module.exports = {
  auditLogger,
  logFilePath
};
