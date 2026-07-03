'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuthGuard('admin');
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get('/attendance/stats')
      .then(({ data }) => setStats(data.stats))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [user]);

  if (authLoading) return <LoadingScreen />;

  const statCards = stats ? [
    { label: 'Total Students', value: stats.totalStudents, color: '#10B981', icon: '🎓' },
    { label: 'Total Lecturers', value: stats.totalLecturers, color: '#8B5CF6', icon: '👨‍🏫' },
    { label: "Today's Sessions", value: stats.todaySessions, color: '#3B82F6', icon: '📅' },
    { label: "Today's Scans", value: stats.todayRecords, color: '#F59E0B', icon: '⬛' },
    { label: 'Total Records', value: stats.totalRecords, color: '#64748B', icon: '📊' },
  ] : [];

  const quickLinks = [
    { label: 'Manage Students', desc: 'Add, bulk import, or deactivate students', icon: '🎓', path: '/admin/students', color: '#10B981' },
    { label: 'View Reports', desc: 'Full attendance reports with CSV export', icon: '📊', path: '/admin/reports', color: '#3B82F6' },
    { label: 'Manage Users', desc: 'All admins, lecturers, and students', icon: '👥', path: '/admin/students', color: '#8B5CF6' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A' }}>
      <Navbar user={user} title="Admin Dashboard" />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>Admin Dashboard</h1>
          <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>Gateway ICT Polytechnic, Saapade — QR Attendance System</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          {loadingStats ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 10, padding: 20, height: 90 }} />
            ))
          ) : statCards.map((s) => (
            <div key={s.label} style={{ background: '#111827', border: `1px solid ${s.color}33`, borderTop: `3px solid ${s.color}`, borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value?.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {quickLinks.map((link) => (
            <div
              key={link.label}
              onClick={() => router.push(link.path)}
              style={{ background: '#111827', border: `1px solid ${link.color}33`, borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = link.color}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = `${link.color}33`}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{link.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>{link.label}</h3>
              <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>{link.desc}</p>
              <div style={{ marginTop: 14, fontSize: 12, color: link.color, fontWeight: 600 }}>Open →</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #F59E0B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
