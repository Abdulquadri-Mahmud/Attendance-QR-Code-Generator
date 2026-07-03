export const getUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('qr_att_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('qr_att_token');
};

export const saveAuth = (token, user) => {
  localStorage.setItem('qr_att_token', token);
  localStorage.setItem('qr_att_user', JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem('qr_att_token');
  localStorage.removeItem('qr_att_user');
};

export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('qr_att_token');
};
