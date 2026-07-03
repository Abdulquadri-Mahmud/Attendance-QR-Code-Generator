const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

dotenv.config();
connectDB();

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
    const isProjectVercel = /^https:\/\/attendance-qr-code-generator-fronte(-[a-z0-9-]+)?\.vercel\.app$/.test(origin);
    if (isLocalhost || isProjectVercel || origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'QR Attendance API is running', timestamp: new Date() });
});

// Routes
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/sessions', require('./src/routes/session.routes'));
app.use('/api/attendance', require('./src/routes/attendance.routes'));
app.use('/api/admin', require('./src/routes/admin.routes'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 QR Attendance Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health\n`);
});
