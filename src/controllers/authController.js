const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role: role },
    process.env.JWT_SECRET || 'supersecret_labtrack_jwt_key_2026_secured',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Register a new user (Student or Admin)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, prn, password, role, department, phone } = req.body;

    if (!name || !email || !prn || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, 11-digit PRN, and password are required.'
      });
    }

    // Check if user with email or PRN already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.'
      });
    }

    const existingPRN = await User.findOne({ prn });
    if (existingPRN) {
      return res.status(400).json({
        success: false,
        message: 'A user with this 11-digit PRN already exists.'
      });
    }

    const user = await User.create({
      name,
      email,
      prn,
      password,
      role: role === 'admin' ? 'admin' : 'student',
      department: department || 'ECE',
      phone: phone || ''
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        prn: user.prn,
        role: user.role,
        department: user.department,
        phone: user.phone
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get JWT token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { identifier, email, password } = req.body;
    const loginId = (identifier || email || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/PRN and password are required.'
      });
    }

    // Allow login by email or 11-digit PRN
    const user = await User.findOne({
      $or: [
        { email: loginId.toLowerCase() },
        { prn: loginId }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.'
      });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        prn: user.prn,
        role: user.role,
        department: user.department,
        phone: user.phone
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get currently logged in user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe
};
