const mongoose = require('mongoose');

const AttendanceRecordSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
    },
    // Denormalized fields for fast report queries (no joins needed)
    courseCode: {
      type: String,
      required: true,
      uppercase: true,
    },
    courseTitle: {
      type: String,
      required: true,
    },
    lecturerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lecturerName: {
      type: String,
      required: true,
    },
    // Student identification — matric number is the source of truth
    studentMatric: {
      type: String,
      required: true,
      uppercase: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      required: true,
    },
    // Timestamp is ALWAYS set server-side — never trust client
    scannedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['present', 'late'],
      default: 'present',
    },
  },
  { timestamps: true }
);

// COMPOUND UNIQUE INDEX — THE ANTI-PROXY MECHANISM
// A student can only appear once per session.
// MongoDB will throw error code 11000 on a second insert with the same (sessionId, studentMatric)
AttendanceRecordSchema.index({ sessionId: 1, studentMatric: 1 }, { unique: true });

// Index for fast per-student queries
AttendanceRecordSchema.index({ studentMatric: 1, scannedAt: -1 });

// Index for fast per-course queries
AttendanceRecordSchema.index({ courseCode: 1, scannedAt: -1 });

module.exports = mongoose.model('AttendanceRecord', AttendanceRecordSchema);
