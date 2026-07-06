'use client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { clearAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function Navbar({ user, title }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out');
    router.push('/login');
  };

  const roleColors = {
    admin: '#F59E0B',
    lecturer: '#8B5CF6',
    student: '#10B981',
  };

  const isActive = (path) => pathname === path;

  const navLinkStyle = (path) => ({
    color: isActive(path) ? '#3B82F6' : '#64748B',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
    transition: 'color 0.15s',
  });

  return (
    <nav style={{ background: '#111827', borderBottom: '1px solid #1E2D45', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 8px #3B82F6' }} />
        <span style={{ fontWeight: 800, fontSize: 15, color: '#F1F5F9', letterSpacing: '-0.02em', marginRight: 4 }}>
          QR Attendance
        </span>
        
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, borderLeft: '1px solid #1E2D45', paddingLeft: 18 }}>
            {user.role === 'lecturer' && (
              <>
                <Link href="/lecturer/dashboard" style={navLinkStyle('/lecturer/dashboard')}>Dashboard</Link>
                <Link href="/lecturer/reports" style={navLinkStyle('/lecturer/reports')}>Reports</Link>
              </>
            )}
            {user.role === 'admin' && (
              <>
                <Link href="/admin/dashboard" style={navLinkStyle('/admin/dashboard')}>Dashboard</Link>
                <Link href="/admin/students" style={navLinkStyle('/admin/students')}>Manage Users</Link>
                <Link href="/admin/reports" style={navLinkStyle('/admin/reports')}>Reports</Link>
              </>
            )}
            {user.role === 'student' && (
              <>
                <Link href="/student/dashboard" style={navLinkStyle('/student/dashboard')}>History</Link>
                <Link href="/scan" style={navLinkStyle('/scan')}>Scan QR</Link>
              </>
            )}
          </div>
        )}
      </div>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{user.fullName}</div>
            <div style={{ fontSize: 11, color: roleColors[user.role] || '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {user.role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ background: '#1A2236', border: '1px solid #1E2D45', color: '#64748B', padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
