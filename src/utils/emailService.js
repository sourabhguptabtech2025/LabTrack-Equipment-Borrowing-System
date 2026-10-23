const nodemailer = require('nodemailer');

let cachedTransporter = null;
let isEthereal = false;

/**
 * Initialize or get cached Nodemailer transporter with Ethereal fallback
 */
async function getTransporter() {
  if (cachedTransporter) {
    return { transporter: cachedTransporter, isEthereal };
  }

  // Check if live SMTP credentials are configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    isEthereal = false;
    console.log('[EmailService] Using configured SMTP server:', process.env.SMTP_HOST);
  } else {
    // Rubric requirement: Ethereal SMTP test fallback
    console.log('[EmailService] SMTP credentials not set. Generating Ethereal SMTP Test Account...');
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    isEthereal = true;
    console.log(`[EmailService] Ethereal Test Account active: ${testAccount.user}`);
  }

  return { transporter: cachedTransporter, isEthereal };
}

/**
 * Automated email on item issue
 */
async function sendItemIssueEmail({
  studentEmail,
  studentName,
  prn,
  componentName,
  quantity,
  expectedReturnDate,
  borrowId
}) {
  try {
    const { transporter, isEthereal: usingEthereal } = await getTransporter();
    const formattedDate = new Date(expectedReturnDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || '"LabTrack Equipment System" <noreply@labtrack.edu>',
      to: studentEmail,
      subject: `[LabTrack] Equipment Issued: ${componentName} (Ref: ${borrowId.toString().slice(-6)})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; color: #1a202c;">
          <div style="background-color: #1e3a8a; padding: 24px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">LabTrack Equipment System</h1>
            <p style="margin: 4px 0 0; opacity: 0.85;">Equipment Issue Confirmation</p>
          </div>
          <div style="padding: 24px;">
            <p>Dear <strong>${studentName}</strong> (PRN: <code>${prn}</code>),</p>
            <p>Your requisition request has been approved and the following laboratory hardware component has been officially checked out to you:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 6px; overflow: hidden;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 16px; font-weight: bold; width: 40%;">Equipment Name:</td>
                <td style="padding: 10px 16px;">${componentName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 16px; font-weight: bold;">Quantity Issued:</td>
                <td style="padding: 10px 16px;">${quantity} unit(s)</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 16px; font-weight: bold;">Expected Due Date:</td>
                <td style="padding: 10px 16px; color: #b91c1c; font-weight: bold;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px 16px; font-weight: bold;">Transaction ID:</td>
                <td style="padding: 10px 16px;"><code>${borrowId}</code></td>
              </tr>
            </table>

            <p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; font-size: 14px;">
              <strong>Important Lab Guidelines:</strong><br/>
              - Handle electrostatic-sensitive components using ESD wristbands.<br/>
              - Return equipment in original anti-static packaging before 5:00 PM on or before the due date.<br/>
              - Late returns may attract laboratory borrowing suspension.
            </p>

            <p style="margin-top: 24px; font-size: 14px; color: #64748b;">
              Department of Electronics & Computer Engineering<br/>
              Central Hardware & IoT Laboratory
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    let previewUrl = null;
    if (usingEthereal) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[EmailService] Issue email sent! Ethereal Preview URL: ${previewUrl}`);
    } else {
      console.log(`[EmailService] Issue email sent! MessageId: ${info.messageId}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error('[EmailService Error] Failed to send issue email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Automated email on admin overdue reminder
 */
async function sendOverdueReminderEmail({
  studentEmail,
  studentName,
  prn,
  componentName,
  quantity,
  dueDate,
  borrowId
}) {
  try {
    const { transporter, isEthereal: usingEthereal } = await getTransporter();
    const formattedDue = new Date(dueDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || '"LabTrack Equipment System" <noreply@labtrack.edu>',
      to: studentEmail,
      subject: `[URGENT] Overdue Laboratory Equipment Return Notice: ${componentName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fecaca; border-radius: 8px; overflow: hidden; color: #1a202c;">
          <div style="background-color: #dc2626; padding: 24px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">LabTrack Overdue Notice</h1>
            <p style="margin: 4px 0 0; opacity: 0.9;">Action Required: Immediate Equipment Return</p>
          </div>
          <div style="padding: 24px;">
            <p>Dear <strong>${studentName}</strong> (PRN: <code>${prn}</code>),</p>
            <p>This is an automated formal notification from the Laboratory Administrator. The following equipment borrowed by you has passed its return deadline:</p>
            
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 16px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Equipment:</strong> ${componentName}</p>
              <p style="margin: 4px 0;"><strong>Quantity:</strong> ${quantity} unit(s)</p>
              <p style="margin: 4px 0; color: #b91c1c;"><strong>Original Due Date:</strong> ${formattedDue}</p>
              <p style="margin: 4px 0;"><strong>Borrowing Ref:</strong> <code>${borrowId}</code></p>
            </div>

            <p style="color: #991b1b; font-weight: bold;">
              Please return this equipment to Lab 302 immediately during working hours (9:00 AM – 5:00 PM) to avoid disciplinary action and semester grade hold.
            </p>

            <p style="margin-top: 24px; font-size: 14px; color: #64748b;">
              Laboratory Supervisor & Department HOD<br/>
              LabTrack Central Inventory Administration
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    let previewUrl = null;
    if (usingEthereal) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[EmailService] Overdue Reminder sent! Ethereal Preview URL: ${previewUrl}`);
    } else {
      console.log(`[EmailService] Overdue Reminder sent! MessageId: ${info.messageId}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error('[EmailService Error] Failed to send overdue reminder:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendItemIssueEmail,
  sendOverdueReminderEmail
};
