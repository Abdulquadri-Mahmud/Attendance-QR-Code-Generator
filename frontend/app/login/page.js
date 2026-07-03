'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { saveAuth, isAuthenticated, getUser } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      const user = getUser();
      const routes = { admin: '/admin/dashboard', lecturer: '/lecturer/dashboard', student: '/student/dashboard' };
      router.push(routes[user?.role] || '/login');
    }
  }, [router]);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      toast.error('Enter your ID and password');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        identifier: identifier.trim(),
        password: password.trim(),
      });
      saveAuth(data.token, data.user);
      toast.success(`Welcome, ${data.user.fullName.split(' ')[0]}!`);
      const routes = { admin: '/admin/dashboard', lecturer: '/lecturer/dashboard', student: '/student/dashboard' };
      router.push(routes[data.user.role]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: '#1A2236', border: '1px solid #1E2D45', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
            ⬛
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em' }}>
            QR Attendance System
          </h1>
          <p style={{ color: '#64748B', fontSize: 13, margin: '6px 0 0' }}>
            Gateway ICT Polytechnic, Saapade
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 20px' }}>Sign In</h2>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Matric No. / Staff ID
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. GIP/ND2/CSC/001 or ADMIN001"
              style={{ width: '100%', background: '#1A2236', border: '1px solid #1E2D45', borderRadius: 8, padding: '10px 12px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your password"
                style={{ width: '100%', background: '#1A2236', border: '1px solid #1E2D45', borderRadius: 8, padding: '10px 40px 10px 12px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 16 }}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width: '100%', background: loading ? '#1E40AF' : '#3B82F6', border: 'none', borderRadius: 8, padding: '12px', color: 'white', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {loading ? (
              <>
                <div style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Signing in...
              </>
            ) : 'Sign In'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: #3B82F6 !important; }
      `}</style>
    </div>
  );
}
