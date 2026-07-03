'use client';
import { useState, useEffect } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';

export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuthGuard('student');
  const [records, setRecords] = useState([]);
  const [courseSummary, setCourseSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get('/attendance/my')
      .then(({ data }) => {
        setRecords(data.records || []);
        setCourseSummary(data.courseSummary || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) return <LoadingScreen />;

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A' }}>
      <Navbar user={user} title="My Attendance" />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px' }}>

        {/* Student Info */}
        <div style={{ background: '#111827', border: '1px solid #1E2D45', borderTop: '3px solid #10B981', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 48, height: 48, background: '#064E3B', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>{user?.fullName}</h1>
              <p style={{ color: '#64748B', fontSize: 13, margin: '2px 0 0', fontFamily: 'monospace' }}>{user?.matricNumber}</p>
              <p style={{ color: '#64748B', fontSize: 12, margin: '2px 0 0' }}>{user?.department} · {user?.level}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards per Course */}
        {courseSummary.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Course Summary</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {courseSummary.map((c) => {
                const pct = Math.round((c.present + c.late) / c.total * 100);
                const color = pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
                return (
                  <div key={c.courseCode} style={{ background: '#111827', border: `1px solid ${color}33`, borderTop: `3px solid ${color}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#F1F5F9' }}>{c.courseCode}</div>
                    <div style={{ fontSize: 11, color: '#64748B', margin: '2px 0 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.courseTitle}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color }}>{pct}%</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{c.total} session{c.total !== 1 ? 's' : ''} · {c.late} late</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attendance History Table */}
        <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: '0 0 16px' }}>
            Attendance History ({records.length})
          </h2>

          {records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ color: '#64748B', fontSize: 14 }}>No attendance records yet.</p>
              <p style={{ color: '#334155', fontSize: 13 }}>Scan a QR code in class to record your first attendance.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E2D45' }}>
                    {['Course Code', 'Course Title', 'Lecturer', 'Status', 'Date & Time'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r._id} style={{ borderBottom: '1px solid #0F172A' }}>
                      <td style={{ padding: '10px 12px', color: '#60A5FA', fontWeight: 700 }}>{r.courseCode}</td>
                      <td style={{ padding: '10px 12px', color: '#F1F5F9' }}>{r.courseTitle}</td>
                      <td style={{ padding: '10px 12px', color: '#64748B' }}>{r.lecturerName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: r.status === 'late' ? '#451A0322' : '#064E3B22', color: r.status === 'late' ? '#F59E0B' : '#10B981', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748B' }}>
                        {new Date(r.scannedAt).toLocaleString('en-NG')}
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

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #10B981', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
