const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: [true, 'Course code is required'],
      trim: true,
      uppercase: true,
    },
    courseTitle: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
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
    qrToken: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      default: 'Not specified',
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// TTL index — MongoDB auto-deletes expired session documents
// This makes the QR code physically invalid once the session expires
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', SessionSchema);
