'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, isAuthenticated } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    const user = getUser();
    const routes = {
      admin: '/admin/dashboard',
      lecturer: '/lecturer/dashboard',
      student: '/student/dashboard',
    };
    router.push(routes[user?.role] || '/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0E1A' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}
