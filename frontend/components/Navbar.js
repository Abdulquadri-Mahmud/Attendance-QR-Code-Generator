'use client';
import { useRouter } from 'next/navigation';
import { clearAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function Navbar({ user, title }) {
  const router = useRouter();

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

  return (
    <nav style={{ background: '#111827', borderBottom: '1px solid #1E2D45', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 8px #3B82F6' }} />
        <span style={{ fontWeight: 800, fontSize: 15, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
          QR Attendance
        </span>
        {title && (
          <>
            <span style={{ color: '#334155', fontSize: 14 }}>·</span>
            <span style={{ color: '#64748B', fontSize: 14 }}>{title}</span>
          </>
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
