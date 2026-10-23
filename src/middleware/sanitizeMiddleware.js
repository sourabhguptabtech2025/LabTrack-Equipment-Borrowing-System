/**
 * Unit 3 Middleware: Client/Server RegExp validation to sanitize input fields and strip any <script> tags.
 */

// Regular expressions for sanitization and strict validation
const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const INLINE_EVENT_REGEX = /on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi;
const JS_PROTOCOL_REGEX = /javascript\s*:\s*[^\s"']+/gi;
const HTML_TAGS_REGEX = /<[^>]*>/g;

const PRN_REGEX = /^[0-9]{11}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Strips script tags, malicious event handlers, and cleans dangerous characters
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  // 1. Strip all <script>...</script> tags completely
  let cleaned = str.replace(SCRIPT_REGEX, '');

  // 2. Strip inline event handlers like onload=, onerror=, etc.
  cleaned = cleaned.replace(INLINE_EVENT_REGEX, '');

  // 3. Strip javascript: URLs
  cleaned = cleaned.replace(JS_PROTOCOL_REGEX, '');

  return cleaned.trim();
}

/**
 * Recursively sanitize objects, arrays, and primitives
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized = {};
  for (const key of Object.keys(obj)) {
    sanitized[key] = sanitizeObject(obj[key]);
  }
  return sanitized;
}

/**
 * Express Middleware to sanitize request payload and enforce regex validations
 */
const sanitizeMiddleware = (req, res, next) => {
  // Sanitize req.body, req.query, and req.params
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  // Server-side RegExp Validation: PRN check
  if (req.body && req.body.prn !== undefined) {
    const prnStr = String(req.body.prn).trim();
    if (!PRN_REGEX.test(prnStr)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRN format. PRN must be exactly 11 digits matching pattern ^[0-9]{11}$'
      });
    }
  }

  // Server-side RegExp Validation: Email check
  if (req.body && req.body.email !== undefined) {
    const emailStr = String(req.body.email).trim();
    if (!EMAIL_REGEX.test(emailStr)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format.'
      });
    }
  }

  next();
};

module.exports = {
  sanitizeMiddleware,
  sanitizeString,
  PRN_REGEX,
  EMAIL_REGEX
};
