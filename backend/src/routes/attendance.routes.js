const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
const { protect } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const { Parser } = require('json2csv');

// POST /api/attendance/scan — THE CORE ENDPOINT
// Public (no JWT required — student may not be logged in when scanning)
// Body: { qrToken: "uuid", matricNumber: "GIP/ND2/CSC/001" }
router.post('/scan', async (req, res) => {
  try {
    const { qrToken, matricNumber } = req.body;

    if (!qrToken || !matricNumber) {
      return res.status(400).json({
        success: false,
        message: 'qrToken and matricNumber are both required',
      });
    }

    // 1. Find the session by token AND ensure it's still active
    const session = await Session.findOne({ qrToken, isActive: true });
    if (!session) {
      return res.status(410).json({
        success: false,
        message: 'QR code is expired or no longer valid. Ask your lecturer to generate a new one.',
      });
    }

    // 2. Belt-and-braces expiry check (TTL cleanup has a ~60s lag)
    if (new Date() > session.expiresAt) {
      return res.status(410).json({
        success: false,
        message: 'QR code has expired. Ask your lecturer to generate a new one.',
      });
    }

    // 3. Find the student by matric number
    const student = await User.findOne({
      matricNumber: matricNumber.trim().toUpperCase(),
      role: 'student',
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student with matric number "${matricNumber.toUpperCase()}" not found. Check the number and try again.`,
      });
    }

    if (!student.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your student account has been deactivated. Contact the admin.',
      });
    }

    // 4. Determine status: present (within 5 min) or late (after 5 min)
    const minutesSinceStart = (new Date() - new Date(session.createdAt)) / 1000 / 60;
    const status = minutesSinceStart > 5 ? 'late' : 'present';

    // 5. Write attendance record
    // The compound unique index on (sessionId, studentMatric) catches duplicates
    await AttendanceRecord.create({
      sessionId: session._id,
      courseCode: session.courseCode,
      courseTitle: session.courseTitle,
      lecturerId: session.lecturerId,
      lecturerName: session.lecturerName,
      studentMatric: student.matricNumber,
      studentName: student.fullName,
      department: student.department,
      level: student.level,
      status,
      // scannedAt defaults to Date.now on the server — NOT from client
    });

    res.status(201).json({
      success: true,
      message: status === 'late'
        ? '⚠️ Attendance recorded — marked as LATE'
        : '✅ Attendance recorded successfully!',
      data: {
        studentName: student.fullName,
        studentMatric: student.matricNumber,
        courseCode: session.courseCode,
        courseTitle: session.courseTitle,
        location: session.location,
        status,
        scannedAt: new Date(),
      },
    });
  } catch (err) {
    // Duplicate key error — student already scanned this session
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already marked attendance for this session.',
      });
    }
    console.error('Scan error:', err);
    res.status(500).json({ success: false, message: 'Server error during scan: ' + err.message });
  }
});

// GET /api/attendance/my — Student views own attendance history (requires login)
router.get('/my', protect, allowRoles('student'), async (req, res) => {
  try {
    const records = await AttendanceRecord.find({
      studentMatric: req.user.matricNumber,
    }).sort({ scannedAt: -1 }).limit(200);

    // Calculate per-course attendance summary
    const courseSummary = {};
    records.forEach((r) => {
      if (!courseSummary[r.courseCode]) {
        courseSummary[r.courseCode] = { courseCode: r.courseCode, courseTitle: r.courseTitle, present: 0, late: 0, total: 0 };
      }
      courseSummary[r.courseCode][r.status]++;
      courseSummary[r.courseCode].total++;
    });

    res.json({
      success: true,
      count: records.length,
      records,
      courseSummary: Object.values(courseSummary),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/report — Filtered report (admin/lecturer)
// Query params: courseCode, studentMatric, lecturerId, startDate, endDate
router.get('/report', protect, allowRoles('admin', 'lecturer'), async (req, res) => {
  try {
    const filter = {};

    if (req.query.courseCode) filter.courseCode = req.query.courseCode.toUpperCase();
    if (req.query.studentMatric) filter.studentMatric = req.query.studentMatric.toUpperCase();
    if (req.query.lecturerId) filter.lecturerId = req.query.lecturerId;

    // If lecturer, only show their own courses
    if (req.user.role === 'lecturer') {
      filter.lecturerId = req.user._id;
    }

    // Date filtering (range or exact year/month/day)
    if (req.query.year) {
      const year = parseInt(req.query.year);
      let start, end;
      if (req.query.month) {
        const month = parseInt(req.query.month) - 1;
        if (req.query.day) {
          const day = parseInt(req.query.day);
          start = new Date(year, month, day, 0, 0, 0, 0);
          end = new Date(year, month, day, 23, 59, 59, 999);
        } else {
          start = new Date(year, month, 1, 0, 0, 0, 0);
          end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        }
      } else {
        start = new Date(year, 0, 1, 0, 0, 0, 0);
        end = new Date(year + 1, 0, 0, 23, 59, 59, 999);
      }
      filter.scannedAt = { $gte: start, $lte: end };
    } else if (req.query.startDate || req.query.endDate) {
      filter.scannedAt = {};
      if (req.query.startDate) filter.scannedAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.scannedAt.$lte = end;
      }
    }

    const records = await AttendanceRecord.find(filter)
      .sort({ scannedAt: -1 })
      .limit(1000);

    // Aggregate stats
    const stats = {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      late: records.filter((r) => r.status === 'late').length,
    };

    res.json({ success: true, stats, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/report/export — CSV export
router.get('/report/export', protect, allowRoles('admin', 'lecturer'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.courseCode) filter.courseCode = req.query.courseCode.toUpperCase();
    if (req.query.studentMatric) filter.studentMatric = req.query.studentMatric.toUpperCase();
    if (req.user.role === 'lecturer') filter.lecturerId = req.user._id;

    // Date filtering (range or exact year/month/day)
    if (req.query.year) {
      const year = parseInt(req.query.year);
      let start, end;
      if (req.query.month) {
        const month = parseInt(req.query.month) - 1;
        if (req.query.day) {
          const day = parseInt(req.query.day);
          start = new Date(year, month, day, 0, 0, 0, 0);
          end = new Date(year, month, day, 23, 59, 59, 999);
        } else {
          start = new Date(year, month, 1, 0, 0, 0, 0);
          end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        }
      } else {
        start = new Date(year, 0, 1, 0, 0, 0, 0);
        end = new Date(year + 1, 0, 0, 23, 59, 59, 999);
      }
      filter.scannedAt = { $gte: start, $lte: end };
    } else if (req.query.startDate || req.query.endDate) {
      filter.scannedAt = {};
      if (req.query.startDate) filter.scannedAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.scannedAt.$lte = end;
      }
    }

    const records = await AttendanceRecord.find(filter).sort({ scannedAt: 1 });

    const fields = [
      { label: 'Matric Number', value: 'studentMatric' },
      { label: 'Student Name', value: 'studentName' },
      { label: 'Department', value: 'department' },
      { label: 'Level', value: 'level' },
      { label: 'Course Code', value: 'courseCode' },
      { label: 'Course Title', value: 'courseTitle' },
      { label: 'Lecturer', value: 'lecturerName' },
      { label: 'Status', value: 'status' },
      { label: 'Date & Time', value: 'scannedAt' },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(
      records.map((r) => ({
        studentMatric: r.studentMatric,
        studentName: r.studentName,
        department: r.department,
        level: r.level,
        courseCode: r.courseCode,
        courseTitle: r.courseTitle,
        lecturerName: r.lecturerName,
        status: r.status,
        scannedAt: new Date(r.scannedAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      }))
    );

    const filename = `attendance-${req.query.courseCode || 'all'}-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/stats — Dashboard stats for admin
router.get('/stats', protect, allowRoles('admin'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalStudents, totalLecturers, todaySessions, todayRecords, totalRecords] = await Promise.all([
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'lecturer', isActive: true }),
      Session.countDocuments({ createdAt: { $gte: today } }),
      AttendanceRecord.countDocuments({ scannedAt: { $gte: today } }),
      AttendanceRecord.countDocuments(),
    ]);

    res.json({
      success: true,
      stats: { totalStudents, totalLecturers, todaySessions, todayRecords, totalRecords },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/manual — Manually add a student's attendance record
// Restricted to admin and lecturer
router.post('/manual', protect, allowRoles('admin', 'lecturer'), async (req, res) => {
  try {
    const { sessionId, studentMatric, status, scannedAt } = req.body;

    if (!sessionId || !studentMatric) {
      return res.status(400).json({
        success: false,
        message: 'sessionId and studentMatric are required',
      });
    }

    // 1. Find the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // 2. Check authorization: lecturers can only add to their own sessions
    if (req.user.role === 'lecturer' && session.lecturerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add attendance for another lecturer\'s session',
      });
    }

    // 3. Find student by matric number
    const student = await User.findOne({
      matricNumber: studentMatric.trim().toUpperCase(),
      role: 'student',
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student with matric number "${studentMatric.toUpperCase()}" not found.`,
      });
    }

    // 4. Create the attendance record
    const record = await AttendanceRecord.create({
      sessionId: session._id,
      courseCode: session.courseCode,
      courseTitle: session.courseTitle,
      lecturerId: session.lecturerId,
      lecturerName: session.lecturerName,
      studentMatric: student.matricNumber,
      studentName: student.fullName,
      department: student.department,
      level: student.level,
      status: status || 'present',
      scannedAt: scannedAt ? new Date(scannedAt) : new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Attendance record created manually.',
      record,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Attendance already recorded for this student in this session.',
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/attendance/:id — Update an attendance record
// Restricted to admin and lecturer
router.put('/:id', protect, allowRoles('admin', 'lecturer'), async (req, res) => {
  try {
    const { status, scannedAt } = req.body;
    const record = await AttendanceRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    // Check authorization: lecturers can only edit their own sessions' records
    if (req.user.role === 'lecturer' && record.lecturerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this attendance record',
      });
    }

    if (status) record.status = status;
    if (scannedAt) record.scannedAt = new Date(scannedAt);
    await record.save();

    res.json({
      success: true,
      message: 'Attendance record updated successfully',
      record,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/attendance/:id — Delete an attendance record
// Restricted to ADMIN ONLY
router.delete('/:id', protect, allowRoles('admin'), async (req, res) => {
  try {
    const record = await AttendanceRecord.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.json({
      success: true,
      message: 'Attendance record deleted successfully',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
