'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function LecturerDashboard() {
  const { user, loading: authLoading } = useAuthGuard('lecturer');

  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [location, setLocation] = useState('');
  const [creating, setCreating] = useState(false);

  // Custom session timestamp and timers
  const [customDate, setCustomDate] = useState('');
  const [expiryOption, setExpiryOption] = useState('30'); // '30' or 'custom'
  const [customExpiry, setCustomExpiry] = useState('30');

  // Manual student enrollment
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualMatric, setManualMatric] = useState('');
  const [manualStatus, setManualStatus] = useState('present');
  const [submittingManual, setSubmittingManual] = useState(false);

  const [activeSession, setActiveSession] = useState(null);
  const [qrImage, setQrImage] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [rotateCountdown, setRotateCountdown] = useState(30); // seconds until next QR rotation

  const [pastSessions, setPastSessions] = useState([]);
  const [loadingPast, setLoadingPast] = useState(false);

  // Fetch past sessions on mount
  const fetchPastSessions = useCallback(async () => {
    setLoadingPast(true);
    try {
      const { data } = await api.get('/sessions/my');
      setPastSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoadingPast(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchPastSessions();
  }, [user, fetchPastSessions]);

  // Poll attendees every 5 seconds when session is active
  useEffect(() => {
    if (!activeSession) return;
    const fetchAttendees = async () => {
      try {
        const { data } = await api.get(`/sessions/${activeSession.id}/attendees`);
        setAttendees(data.records || []);
      } catch {}
    };
    fetchAttendees();
    const interval = setInterval(fetchAttendees, 5000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Countdown timer
  useEffect(() => {
    if (!activeSession) return;
    const tick = setInterval(() => {
      const remaining = Math.max(0, new Date(activeSession.expiresAt) - new Date());
      setTimeLeft(Math.floor(remaining / 1000));
      if (remaining <= 0) {
        setActiveSession(null);
        setQrImage('');
        setAttendees([]);
        toast('⏰ QR code expired. Start a new session if needed.', { duration: 5000 });
        clearInterval(tick);
        fetchPastSessions();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [activeSession, fetchPastSessions]);

  // ── Rotating QR: regenerate token every 30 s to defeat screenshot-sharing ──
  useEffect(() => {
    if (!activeSession) return;
    const sessionId = activeSession.id || activeSession._id;

    // Reset countdown display each time session changes
    setRotateCountdown(30);

    // Tick the visual countdown every second
    const countTick = setInterval(() => {
      setRotateCountdown(prev => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    // Actually rotate the QR token every 30 s
    const rotateTick = setInterval(async () => {
      try {
        const { data } = await api.post(`/sessions/${sessionId}/rotate`);
        setQrImage(data.qrCodeDataUrl);
        setRotateCountdown(30);
      } catch {
        // Session may have just expired — the countdown timer will handle cleanup
      }
    }, 30000);

    return () => {
      clearInterval(countTick);
      clearInterval(rotateTick);
    };
  }, [activeSession?.id || activeSession?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const createSession = async () => {
    if (!courseCode.trim() || !courseTitle.trim()) {
      toast.error('Course code and title are required');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        courseCode: courseCode.trim(),
        courseTitle: courseTitle.trim(),
        location: location.trim(),
      };
      if (customDate) {
        payload.customDate = new Date(customDate).toISOString();
      }
      payload.expiryMinutes = expiryOption === '30' ? 30 : parseInt(customExpiry);

      const { data } = await api.post('/sessions', payload);
      setActiveSession(data.session);
      setQrImage(data.session.qrCodeDataUrl);
      setAttendees([]);
      toast.success('Session started! QR code is live.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleManualEnroll = async () => {
    if (!manualMatric.trim()) {
      toast.error('Matric number is required');
      return;
    }
    setSubmittingManual(true);
    try {
      const sessionId = activeSession?.id || activeSession?._id;
      const { data } = await api.post('/attendance/manual', {
        sessionId,
        studentMatric: manualMatric.trim().toUpperCase(),
        status: manualStatus,
      });
      toast.success(data.message || 'Student enrolled manually');
      setManualMatric('');
      setShowManualForm(false);
      
      // Refresh attendees list
      const res = await api.get(`/sessions/${sessionId}/attendees`);
      setAttendees(res.data.records || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enroll student');
    } finally {
      setSubmittingManual(false);
    }
  };

  const toggleAttendeeStatus = async (attendee) => {
    const newStatus = attendee.status === 'present' ? 'late' : 'present';
    try {
      const sessionId = activeSession?.id || activeSession?._id;
      await api.put(`/attendance/${attendee._id}`, { status: newStatus });
      toast.success(`Updated status to ${newStatus.toUpperCase()}`);
      
      // Refresh attendees list
      const res = await api.get(`/sessions/${sessionId}/attendees`);
      setAttendees(res.data.records || []);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const downloadPDF = async () => {
    if (!activeSession) return;
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('Attendance QR Code', 105, 20, { align: 'center' });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(`Course Code: ${activeSession.courseCode}`, 20, 40);
      doc.text(`Course Title: ${activeSession.courseTitle}`, 20, 48);
      doc.text(`Location: ${activeSession.location || 'Not specified'}`, 20, 56);
      doc.text(`Session Date/Time: ${new Date(activeSession.createdAt || activeSession.date || Date.now()).toLocaleString('en-NG')}`, 20, 64);
      doc.text(`Expires At: ${new Date(activeSession.expiresAt).toLocaleString('en-NG')}`, 20, 72);

      if (qrImage) {
        doc.addImage(qrImage, 'PNG', 55, 90, 100, 100);
      }

      doc.setFontSize(11);
      doc.text('Scan instructions for students:', 20, 210);
      doc.text('1. Open your phone camera or QR Reader app.', 20, 218);
      doc.text('2. Aim the camera at this QR code.', 20, 226);
      doc.text('3. Tap the link and enter your Matric Number to mark attendance.', 20, 234);

      doc.save(`Attendance-QR-${activeSession.courseCode}.pdf`);
      toast.success('PDF downloaded!');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      toast.error('Failed to generate PDF');
    }
  };

  const closeSession = async () => {
    if (!activeSession) return;
    try {
      await api.patch(`/sessions/${activeSession.id}/close`);
      toast.success('Session closed');
      setActiveSession(null);
      setQrImage('');
      setAttendees([]);
      setTimeLeft(null);
      fetchPastSessions();
    } catch (err) {
      toast.error('Failed to close session');
    }
  };

  const formatTime = (secs) => {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const timerColor = timeLeft !== null && timeLeft < 60 ? '#EF4444' : timeLeft < 180 ? '#F59E0B' : '#10B981';

  if (authLoading) return <LoadingScreen />;

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A' }}>
      <Navbar user={user} title="Lecturer Dashboard" />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>
            Welcome, {user?.fullName?.split(' ')[0]}
          </h1>
          <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>
            {user?.department} · {activeSession ? '🟢 Session Active' : '⚪ No Active Session'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: activeSession ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 28 }}>

          {/* CREATE SESSION FORM — hidden when session is active */}
          {!activeSession && (
            <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: '0 0 20px' }}>
                🎯 Start Attendance Session
              </h2>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Course Code</label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CSC 312"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Course Title</label>
                <input
                  type="text"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Session Date & Time (optional)</label>
                <input
                  type="datetime-local"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  style={inputStyle}
                />
                <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>Leave blank to use current time</span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Expiration Timer</label>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#F1F5F9', fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="expiryOption"
                      checked={expiryOption === '30'}
                      onChange={() => setExpiryOption('30')}
                    />
                    Default (30 mins)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#F1F5F9', fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="expiryOption"
                      checked={expiryOption === 'custom'}
                      onChange={() => setExpiryOption('custom')}
                    />
                    Custom Duration
                  </label>
                </div>
                {expiryOption === 'custom' && (
                  <input
                    type="number"
                    min="1"
                    value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    placeholder="Enter minutes, e.g. 45"
                    style={inputStyle}
                  />
                )}
              </div>

              <button
                onClick={createSession}
                disabled={creating}
                style={{ ...btnStyle, background: creating ? '#1E40AF' : '#3B82F6', width: '100%' }}
              >
                {creating ? 'Generating QR...' : '⬛ Generate QR & Start Session'}
              </button>
            </div>
          )}

          {/* ACTIVE SESSION — QR Display */}
          {activeSession && (
            <div style={{ background: '#111827', border: '1px solid #10B98144', borderTop: '3px solid #10B981', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#10B981', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Active Session</div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9', margin: '4px 0 2px' }}>{activeSession.courseCode}</h2>
                  <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>{activeSession.courseTitle}</p>
                  {activeSession.location !== 'Not specified' && (
                    <p style={{ color: '#64748B', fontSize: 12, margin: '2px 0 0' }}>📍 {activeSession.location}</p>
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: timerColor }}>{formatTime(timeLeft)}</div>
                  <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>remaining</div>
                </div>
              </div>

              {/* QR Code + Rotation Badge */}
              {qrImage && (
                <div style={{ textAlign: 'center', margin: '16px 0' }}>
                  {/* Rotation shield badge */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0F172A', border: '1px solid #1E40AF', borderRadius: 20, padding: '4px 12px', marginBottom: 10, fontSize: 11, fontWeight: 700 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', animation: 'pulse 1s infinite' }} />
                    <span style={{ color: '#60A5FA' }}>🔄 Rotating in {rotateCountdown}s</span>
                    <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
                  </div>

                  {/* QR image with a thin progress-ring border that drains over 30 s */}
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <svg width="236" height="236" style={{ position: 'absolute', top: -6, left: -6, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
                      {/* Background ring */}
                      <circle cx="118" cy="118" r="110" fill="none" stroke="#1E2D45" strokeWidth="4" />
                      {/* Animated countdown arc */}
                      <circle
                        cx="118" cy="118" r="110"
                        fill="none"
                        stroke="#3B82F6"
                        strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 110}`}
                        strokeDashoffset={`${2 * Math.PI * 110 * (1 - rotateCountdown / 30)}`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                    <div style={{ display: 'inline-block', background: 'white', padding: 12, borderRadius: 12 }}>
                      <img src={qrImage} alt="Attendance QR Code" style={{ width: 200, height: 200, display: 'block' }} />
                    </div>
                  </div>

                  <p style={{ color: '#64748B', fontSize: 12, margin: '10px 0 0' }}>
                    🔒 Token rotates every 30 s — shared screenshots expire instantly
                  </p>
                </div>
              )}

              <button
                onClick={downloadPDF}
                style={{ ...btnStyle, background: '#1E3A8A', border: '1px solid #3B82F6', color: '#60A5FA', width: '100%', marginTop: 8 }}
              >
                🖨️ Download PDF / Print QR
              </button>

              <button
                onClick={closeSession}
                style={{ ...btnStyle, background: '#450A0A', border: '1px solid #EF4444', color: '#EF4444', width: '100%', marginTop: 8 }}
              >
                🔴 Close Session
              </button>
            </div>
          )}

          {/* LIVE ATTENDEES */}
          {activeSession && (
            <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0, display: 'inline-block', marginRight: 8 }}>Live Attendees</h2>
                  <span style={{ background: '#10B98122', color: '#10B981', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                    {attendees.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowManualForm(!showManualForm)}
                  style={{ background: '#1A2236', border: '1px solid #1E2D45', color: '#94A3B8', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {showManualForm ? '✕ Close Form' : '✍️ Add Manually'}
                </button>
              </div>

              {/* Manual Enroll Form */}
              {showManualForm && (
                <div style={{ background: '#1A2236', border: '1px solid #1E2D45', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: '0 0 12px' }}>Manually Enroll Student</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Matric Number</label>
                      <input
                        type="text"
                        value={manualMatric}
                        onChange={(e) => setManualMatric(e.target.value.toUpperCase())}
                        placeholder="e.g. GIP/ND2/CSC/001"
                        style={{ ...inputStyle, background: '#111827' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Status</label>
                      <select
                        value={manualStatus}
                        onChange={(e) => setManualStatus(e.target.value)}
                        style={{ ...inputStyle, background: '#111827' }}
                      >
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                      </select>
                    </div>
                    <button
                      onClick={handleManualEnroll}
                      disabled={submittingManual}
                      style={{ ...btnStyle, background: '#10B981', padding: '8px 12px', fontSize: 12, marginTop: 4, alignSelf: 'flex-start' }}
                    >
                      {submittingManual ? 'Saving...' : 'Add Student'}
                    </button>
                  </div>
                </div>
              )}

              {attendees.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#334155' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                  <p style={{ margin: 0, fontSize: 13 }}>Waiting for students to scan...</p>
                </div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1E2D45' }}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Matric No.</th>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Time</th>
                        <th style={thStyle}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendees.map((a, i) => (
                        <tr key={a._id} style={{ borderBottom: '1px solid #1E2D45' }}>
                          <td style={tdStyle}>{i + 1}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#60A5FA' }}>{a.studentMatric}</td>
                          <td style={tdStyle}>{a.studentName}</td>
                          <td style={tdStyle}>
                            <span style={{ background: a.status === 'late' ? '#451A0322' : '#064E3B22', color: a.status === 'late' ? '#F59E0B' : '#10B981', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              {a.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: '#64748B' }}>
                            {new Date(a.scannedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={tdStyle}>
                            <button
                              onClick={() => toggleAttendeeStatus(a)}
                              style={{ background: '#1A2236', border: '1px solid #1E2D45', color: '#38BDF8', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                            >
                              Toggle Status
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PAST SESSIONS */}
        <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: '0 0 16px' }}>Recent Sessions</h2>
          {loadingPast ? (
            <p style={{ color: '#64748B', fontSize: 13 }}>Loading...</p>
          ) : pastSessions.length === 0 ? (
            <p style={{ color: '#334155', fontSize: 13 }}>No sessions yet. Start your first one above.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E2D45' }}>
                    {['Course Code', 'Title', 'Location', 'Date', 'Attendees'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pastSessions.map((s) => (
                    <tr key={s._id} style={{ borderBottom: '1px solid #1E2D45' }}>
                      <td style={{ ...tdStyle, color: '#60A5FA', fontWeight: 700 }}>{s.courseCode}</td>
                      <td style={tdStyle}>{s.courseTitle}</td>
                      <td style={{ ...tdStyle, color: '#64748B' }}>{s.location}</td>
                      <td style={{ ...tdStyle, color: '#64748B' }}>{new Date(s.date).toLocaleDateString('en-NG')}</td>
                      <td style={tdStyle}>
                        <span style={{ background: '#1E3A5F', color: '#60A5FA', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                          {s.attendeeCount || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' };
const inputStyle = { width: '100%', background: '#1A2236', border: '1px solid #1E2D45', borderRadius: 8, padding: '10px 12px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const btnStyle = { border: 'none', borderRadius: 8, padding: '12px 20px', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const thStyle = { padding: '8px 12px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: 12 };
const tdStyle = { padding: '10px 12px', color: '#F1F5F9' };

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
