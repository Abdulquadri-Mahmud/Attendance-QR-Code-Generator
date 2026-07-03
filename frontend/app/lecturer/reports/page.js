'use client';
import { useState, useEffect } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function LecturerReports() {
  const { user, loading: authLoading } = useAuthGuard('lecturer');
  const [courseCode, setcourseCode] = useState('');
  const [studentMatric, setStudentMatric] = useState('');
  
  // Date filtering states
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Manual enrollment states
  const [sessions, setSessions] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [newStudentMatric, setNewStudentMatric] = useState('');
  const [newStatus, setNewStatus] = useState('present');
  const [newScannedAt, setNewScannedAt] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);

  // Fetch lecturer's sessions for manual add dropdown
  useEffect(() => {
    if (user) {
      api.get('/sessions/my')
        .then(({ data }) => {
          setSessions(data.sessions || []);
          if (data.sessions?.length > 0) {
            setSelectedSessionId(data.sessions[0]._id);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (courseCode.trim()) params.append('courseCode', courseCode.trim());
      if (studentMatric.trim()) params.append('studentMatric', studentMatric.trim());
      if (year) params.append('year', year);
      if (month) params.append('month', month);
      if (day) params.append('day', day);

      const { data } = await api.get(`/attendance/report?${params.toString()}`);
      setRecords(data.records || []);
      setStats(data.stats);
      setSearched(true);
      if (data.records.length === 0) toast('No records found for this filter.', { icon: 'ℹ️' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (courseCode.trim()) params.append('courseCode', courseCode.trim());
      if (studentMatric.trim()) params.append('studentMatric', studentMatric.trim());
      if (year) params.append('year', year);
      if (month) params.append('month', month);
      if (day) params.append('day', day);

      const response = await api.get(`/attendance/report/export?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance-${courseCode || 'all'}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV downloaded!');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleManualAdd = async () => {
    if (!selectedSessionId || !newStudentMatric.trim()) {
      toast.error('Session and Matric Number are required');
      return;
    }
    setSubmittingManual(true);
    try {
      const payload = {
        sessionId: selectedSessionId,
        studentMatric: newStudentMatric.trim().toUpperCase(),
        status: newStatus,
      };
      if (newScannedAt) {
        payload.scannedAt = new Date(newScannedAt).toISOString();
      }
      await api.post('/attendance/manual', payload);
      toast.success('Record added manually');
      setNewStudentMatric('');
      setNewScannedAt('');
      setShowAddForm(false);
      fetchReport(); // refresh current table if visible
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add record');
    } finally {
      setSubmittingManual(false);
    }
  };

  const toggleAttendeeStatus = async (record) => {
    const updatedStatus = record.status === 'present' ? 'late' : 'present';
    try {
      await api.put(`/attendance/${record._id}`, { status: updatedStatus });
      toast.success(`Updated status to ${updatedStatus.toUpperCase()}`);
      
      // Update record state locally to prevent full refetch
      setRecords(prev => prev.map(r => r._id === record._id ? { ...r, status: updatedStatus } : r));
      if (stats) {
        setStats(prev => ({
          ...prev,
          present: updatedStatus === 'present' ? prev.present + 1 : prev.present - 1,
          late: updatedStatus === 'late' ? prev.late + 1 : prev.late - 1,
        }));
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Build chart data
  const chartData = Object.values(
    records.reduce((acc, r) => {
      if (!acc[r.courseCode]) acc[r.courseCode] = { course: r.courseCode, present: 0, late: 0 };
      acc[r.courseCode][r.status]++;
      return acc;
    }, {})
  );

  if (authLoading) return <LoadingScreen />;

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A' }}>
      <Navbar user={user} title="Reports" />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px' }}>Attendance Reports</h1>
            <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>Filtered to your courses only</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ ...btnStyle, background: '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {showAddForm ? '✕ Close Form' : '✍️ Add Record Manually'}
          </button>
        </div>

        {/* Manual Add Form Panel */}
        {showAddForm && (
          <div style={{ background: '#111827', border: '1px solid #10B98144', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: '0 0 16px' }}>Manually Add Student Attendance</h3>
            {sessions.length === 0 ? (
              <p style={{ color: '#64748B', fontSize: 13 }}>You need to generate at least one QR session before adding attendance manually.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Session / Course</label>
                  <select value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)} style={inputStyle}>
                    {sessions.map(s => (
                      <option key={s._id} value={s._id}>{s.courseCode} ({new Date(s.date).toLocaleDateString()})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Student Matric</label>
                  <input value={newStudentMatric} onChange={(e) => setNewStudentMatric(e.target.value.toUpperCase())} placeholder="e.g. GIP/ND2/CSC/001" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={inputStyle}>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Time Override (optional)</label>
                  <input type="datetime-local" value={newScannedAt} onChange={(e) => setNewScannedAt(e.target.value)} style={inputStyle} />
                </div>
              </div>
            )}
            {sessions.length > 0 && (
              <button onClick={handleManualAdd} disabled={submittingManual} style={{ ...btnStyle, background: '#10B981' }}>
                {submittingManual ? 'Saving...' : 'Create Attendance Record'}
              </button>
            )}
          </div>
        )}

        {/* Filters */}
        <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Course Code</label>
              <input value={courseCode} onChange={(e) => setcourseCode(e.target.value.toUpperCase())} placeholder="e.g. CSC312" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Student Matric</label>
              <input value={studentMatric} onChange={(e) => setStudentMatric(e.target.value.toUpperCase())} placeholder="e.g. GIP/ND2/CSC/001" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Day</label>
              <select value={day} onChange={(e) => setDay(e.target.value)} style={inputStyle}>
                <option value="">All Days</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Month</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} style={inputStyle}>
                <option value="">All Months</option>
                {[
                  { value: '1', name: 'January' },
                  { value: '2', name: 'February' },
                  { value: '3', name: 'March' },
                  { value: '4', name: 'April' },
                  { value: '5', name: 'May' },
                  { value: '6', name: 'June' },
                  { value: '7', name: 'July' },
                  { value: '8', name: 'August' },
                  { value: '9', name: 'September' },
                  { value: '10', name: 'October' },
                  { value: '11', name: 'November' },
                  { value: '12', name: 'December' },
                ].map(m => (
                  <option key={m.value} value={m.value}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} style={inputStyle}>
                <option value="">All Years</option>
                {['2024', '2025', '2026', '2027'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={fetchReport} disabled={loading} style={{ ...btnStyle, background: '#3B82F6' }}>
              {loading ? 'Loading...' : '🔍 Generate Report'}
            </button>
            {records.length > 0 && (
              <button onClick={exportCSV} style={{ ...btnStyle, background: '#064E3B', border: '1px solid #10B981', color: '#10B981' }}>
                ⬇️ Export CSV
              </button>
            )}
            {searched && (
              <button
                onClick={() => {
                  setRecords([]);
                  setStats(null);
                  setSearched(false);
                  setcourseCode('');
                  setStudentMatric('');
                  setDay('');
                  setMonth('');
                  setYear('');
                }}
                style={{ ...btnStyle, background: 'transparent', border: '1px solid #334155', color: '#64748B' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Records', value: stats.total, color: '#3B82F6' },
              { label: 'Present', value: stats.present, color: '#10B981' },
              { label: 'Late', value: stats.late, color: '#F59E0B' },
            ].map(s => (
              <div key={s.label} style={{ background: '#111827', border: `1px solid ${s.color}33`, borderTop: `3px solid ${s.color}`, borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: '0 0 16px' }}>Attendance by Course</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
                <XAxis dataKey="course" tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#1A2236', border: '1px solid #1E2D45', borderRadius: 8 }} labelStyle={{ color: '#F1F5F9' }} />
                <Legend />
                <Bar dataKey="present" fill="#10B981" name="Present" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" fill="#F59E0B" name="Late" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        {searched && records.length > 0 && (
          <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 20, overflowX: 'auto' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: '0 0 16px' }}>Records ({records.length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E2D45' }}>
                  {['Matric No.', 'Student Name', 'Course', 'Status', 'Date & Time', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id} style={{ borderBottom: '1px solid #0F172A' }}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#60A5FA' }}>{r.studentMatric}</td>
                    <td style={tdStyle}>{r.studentName}</td>
                    <td style={{ ...tdStyle, color: '#64748B' }}>{r.courseCode}</td>
                    <td style={tdStyle}>
                      <span style={{ background: r.status === 'late' ? '#451A0322' : '#064E3B22', color: r.status === 'late' ? '#F59E0B' : '#10B981', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#64748B' }}>{new Date(r.scannedAt).toLocaleString('en-NG')}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => toggleAttendeeStatus(r)}
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
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' };
const inputStyle = { width: '100%', background: '#1A2236', border: '1px solid #1E2D45', borderRadius: 8, padding: '10px 12px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const btnStyle = { border: 'none', borderRadius: 8, padding: '10px 18px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
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
