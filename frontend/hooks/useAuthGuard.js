'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, isAuthenticated } from '@/lib/auth';

export const useAuthGuard = (requiredRole) => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    const u = getUser();
    if (requiredRole && u?.role !== requiredRole) {
      // Wrong role — redirect to their correct dashboard
      const routes = {
        admin: '/admin/dashboard',
        lecturer: '/lecturer/dashboard',
        student: '/student/dashboard',
      };
      router.push(routes[u?.role] || '/login');
      return;
    }
    setUser(u);
    setLoading(false);
  }, [router, requiredRole]);

  return { user, loading };
};
