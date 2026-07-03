const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth.middleware');

// POST /api/auth/login
// Body: { identifier: "matric or staffId", password: "..." }
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Matric number / Staff ID and password are required',
      });
    }

    const upperIdentifier = identifier.trim().toUpperCase();

    // Search by matric number OR staff ID
    const user = await User.findOne({
      $or: [
        { matricNumber: upperIdentifier },
        { staffId: upperIdentifier },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Check your matric number or staff ID.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Wrong password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact the administrator.',
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        level: user.level,
        matricNumber: user.matricNumber || null,
        staffId: user.staffId || null,
        email: user.email || null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// GET /api/auth/me — Verify token and return current user
router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
