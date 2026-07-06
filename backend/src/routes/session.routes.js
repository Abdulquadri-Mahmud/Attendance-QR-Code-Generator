const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const AttendanceRecord = require('../models/AttendanceRecord');
const { generateQR } = require('../utils/qrGenerator');
const { protect } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// POST /api/sessions — Create a new attendance session and return QR code
router.post('/', protect, allowRoles('lecturer', 'admin'), async (req, res) => {
  try {
    const { courseCode, courseTitle, location, customDate, expiryMinutes } = req.body;

    if (!courseCode || !courseTitle) {
      return res.status(400).json({
        success: false,
        message: 'courseCode and courseTitle are required',
      });
    }

    const qrToken = uuidv4();
    const sessionDate = customDate ? new Date(customDate) : new Date();
    const duration = expiryMinutes ? parseInt(expiryMinutes) : (parseInt(process.env.QR_EXPIRY_MINUTES) || 30);
    const expiresAt = new Date(sessionDate.getTime() + duration * 60 * 1000);

    const session = await Session.create({
      courseCode: courseCode.trim().toUpperCase(),
      courseTitle: courseTitle.trim(),
      lecturerId: req.user._id,
      lecturerName: req.user.fullName,
      qrToken,
      expiresAt,
      location: location?.trim() || 'Not specified',
      date: sessionDate,
    });

    const frontendUrl = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const { dataUrl: qrCodeDataUrl, scanUrl } = await generateQR(qrToken, frontendUrl);

    res.status(201).json({
      success: true,
      message: `Session created. QR code expires in ${expiryMinutes} minutes.`,
      session: {
        id: session._id,
        courseCode: session.courseCode,
        courseTitle: session.courseTitle,
        location: session.location,
        lecturerName: session.lecturerName,
        expiresAt: session.expiresAt,
        expiryMinutes,
        qrCodeDataUrl,  // base64 PNG — use directly as <img src={qrCodeDataUrl} />
        scanUrl,         // the URL encoded in the QR
      },
    });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sessions/my — Get lecturer's own sessions (most recent 50)
router.get('/my', protect, allowRoles('lecturer', 'admin'), async (req, res) => {
  try {
    const sessions = await Session.find({ lecturerId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    // For each session, also get attendee count
    const sessionsWithCount = await Promise.all(
      sessions.map(async (s) => {
        const count = await AttendanceRecord.countDocuments({ sessionId: s._id });
        return { ...s.toJSON(), attendeeCount: count };
      })
    );

    res.json({ success: true, sessions: sessionsWithCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sessions/all — Admin: get all sessions
router.get('/all', protect, allowRoles('admin'), async (req, res) => {
  try {
    const sessions = await Session.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('lecturerId', 'fullName staffId');

    res.json({ success: true, count: sessions.length, sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sessions/:id/attendees — Live attendee list for a session
router.get('/:id/attendees', protect, allowRoles('lecturer', 'admin'), async (req, res) => {
  try {
    const records = await AttendanceRecord.find({ sessionId: req.params.id })
      .sort({ scannedAt: 1 });

    res.json({
      success: true,
      count: records.length,
      records,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sessions/:id/qr — Re-fetch QR for an active session (if not expired)
router.get('/:id/qr', protect, allowRoles('lecturer', 'admin'), async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found or has expired' });
    }
    if (new Date() > session.expiresAt) {
      return res.status(410).json({ success: false, message: 'Session has expired' });
    }

    const frontendUrl = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const { dataUrl: qrCodeDataUrl, scanUrl } = await generateQR(session.qrToken, frontendUrl);

    res.json({ success: true, qrCodeDataUrl, scanUrl, expiresAt: session.expiresAt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sessions/:id/rotate — Generate a fresh QR token (invalidates the previous one)
// Called every 30 s from the lecturer dashboard to prevent screenshot/link sharing
router.post('/:id/rotate', protect, allowRoles('lecturer', 'admin'), async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { _id: req.params.id, isActive: true }
      : { _id: req.params.id, isActive: true, lecturerId: req.user._id };

    const session = await Session.findOne(query);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Active session not found or unauthorized' });
    }

    if (new Date() > session.expiresAt) {
      return res.status(410).json({ success: false, message: 'Session has already expired' });
    }

    // Overwrite the token — old token is now dead in the DB
    session.qrToken = uuidv4();
    await session.save();

    const frontendUrl = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const { dataUrl: qrCodeDataUrl, scanUrl } = await generateQR(session.qrToken, frontendUrl);

    res.json({ success: true, qrCodeDataUrl, scanUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/sessions/:id/close — Manually close a session early
router.patch('/:id/close', protect, allowRoles('lecturer', 'admin'), async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, lecturerId: req.user._id };

    const session = await Session.findOneAndUpdate(
      query,
      { isActive: false },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found or unauthorized' });
    }

    res.json({ success: true, message: 'Session closed successfully', session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
