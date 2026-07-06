'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AdminStudents() {
  const { user, loading: authLoading } = useAuthGuard('admin');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('student');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState({ fullName: '', role: 'student', department: '', level: 'ND1', matricNumber: '', staffId: '', email: '' });
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', role: 'student', department: '', level: 'ND1', matricNumber: '', staffId: '', email: '' });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/users?role=${roleFilter}`);
      setUsers(data.users || []);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    if (user) fetchUsers();
  }, [user, fetchUsers]);

  const handleCreate = async () => {
    if (!form.fullName || !form.role || !form.department) {
      toast.error('Full name, role, and department are required');
      return;
    }
    if (form.role === 'student' && !form.matricNumber) {
      toast.error('Matric number is required for students');
      return;
    }
    if ((form.role === 'lecturer' || form.role === 'admin') && !form.staffId) {
      toast.error('Staff ID is required for lecturers and admins');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/users', form);
      toast.success('User created successfully!');
      setShowForm(false);
      setForm({ fullName: '', role: 'student', department: '', level: 'ND1', matricNumber: '', staffId: '', email: '' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editForm.fullName || !editForm.role || !editForm.department) {
      toast.error('Full name, role, and department are required');
      return;
    }
    if (editForm.role === 'student' && !editForm.matricNumber) {
      toast.error('Matric number is required for students');
      return;
    }
    if ((editForm.role === 'lecturer' || editForm.role === 'admin') && !editForm.staffId) {
      toast.error('Staff ID is required for lecturers and admins');
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/admin/users/${editingUser._id}`, editForm);
      toast.success('User updated successfully!');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUser = async (id, currentStatus) => {
    try {
      await api.patch(`/admin/users/${id}/toggle`);
      toast.success(`User ${currentStatus ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch {
      toast.error('Failed to toggle user status');
    }
  };

  if (authLoading) return <LoadingScreen />;

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A' }}>
      <Navbar user={user} title="Manage Users" />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>User Management</h1>
            <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>Add, view, and manage all system users</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{ background: '#3B82F6', border: 'none', borderRadius: 8, padding: '10px 18px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {showForm ? '✕ Cancel' : '+ Add User'}
          </button>
        </div>

        {/* Create User Form */}
        {showForm && (
          <div style={{ background: '#111827', border: '1px solid #3B82F644', borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: '0 0 16px' }}>Create New User</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Abubakar Musa Ibrahim" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Role *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inputStyle}>
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Department *</label>
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Computer Science" style={inputStyle} />
              </div>
              {form.role === 'student' && (
                <>
                  <div>
                    <label style={labelStyle}>Level</label>
                    <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} style={inputStyle}>
                      {['ND1', 'ND2', 'HND1', 'HND2'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Matric Number *</label>
                    <input value={form.matricNumber} onChange={(e) => setForm({ ...form, matricNumber: e.target.value.toUpperCase() })} placeholder="e.g. GIP/ND2/CSC/006" style={inputStyle} />
                  </div>
                </>
              )}
              {(form.role === 'lecturer' || form.role === 'admin') && (
                <div>
                  <label style={labelStyle}>Staff ID *</label>
                  <input value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value.toUpperCase() })} placeholder="e.g. LEC003" style={inputStyle} />
                </div>
              )}
              <div>
                <label style={labelStyle}>Email (optional)</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. student@email.com" type="email" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: 16, padding: 12, background: '#0F172A', borderRadius: 8 }}>
              <p style={{ color: '#64748B', fontSize: 12, margin: 0 }}>
                ℹ️ Default password = Matric No. or Staff ID. User should change it on first login.
              </p>
            </div>
            <button onClick={handleCreate} disabled={submitting} style={{ marginTop: 16, background: '#3B82F6', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        )}

        {/* Edit User Form */}
        {editingUser && (
          <div style={{ background: '#111827', border: '1px solid #F59E0B44', borderTop: '3px solid #F59E0B', borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>✏️ Edit User: {editingUser.fullName}</h2>
              <button onClick={() => setEditingUser(null)} style={{ background: 'transparent', border: '1px solid #334155', borderRadius: 6, padding: '4px 12px', color: '#64748B', fontSize: 12, cursor: 'pointer' }}>✕ Cancel</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} placeholder="e.g. Abubakar Musa Ibrahim" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Role *</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} style={inputStyle}>
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Department *</label>
                <input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} placeholder="e.g. Computer Science" style={inputStyle} />
              </div>
              {editForm.role === 'student' && (
                <>
                  <div>
                    <label style={labelStyle}>Level</label>
                    <select value={editForm.level} onChange={(e) => setEditForm({ ...editForm, level: e.target.value })} style={inputStyle}>
                      {['ND1', 'ND2', 'HND1', 'HND2'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Matric Number *</label>
                    <input value={editForm.matricNumber} onChange={(e) => setEditForm({ ...editForm, matricNumber: e.target.value.toUpperCase() })} placeholder="e.g. GIP/ND2/CSC/006" style={inputStyle} />
                  </div>
                </>
              )}
              {(editForm.role === 'lecturer' || editForm.role === 'admin') && (
                <div>
                  <label style={labelStyle}>Staff ID *</label>
                  <input value={editForm.staffId} onChange={(e) => setEditForm({ ...editForm, staffId: e.target.value.toUpperCase() })} placeholder="e.g. LEC003" style={inputStyle} />
                </div>
              )}
              <div>
                <label style={labelStyle}>Email (optional)</label>
                <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="e.g. staff@gateway.edu.ng" type="email" style={inputStyle} />
              </div>
            </div>
            <button
              onClick={handleUpdate}
              disabled={submitting}
              style={{ marginTop: 16, background: '#F59E0B', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Saving...' : '💾 Save Changes'}
            </button>
          </div>
        )}

        {/* Role Filter Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {['student', 'lecturer', 'admin'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              style={{ padding: '7px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: roleFilter === r ? '#3B82F6' : '#111827', color: roleFilter === r ? 'white' : '#64748B', borderRadius: 6 }}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}s
            </button>
          ))}
        </div>

        {/* Users Table */}
        <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading users...</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>No {roleFilter}s found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0F172A', borderBottom: '1px solid #1E2D45' }}>
                    {['Name', 'ID / Matric', 'Department', 'Level', 'Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} style={{ borderBottom: '1px solid #0F172A' }}>
                      <td style={{ padding: '10px 14px', color: '#F1F5F9', fontWeight: 600 }}>{u.fullName}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#60A5FA', fontSize: 12 }}>
                        {u.matricNumber || u.staffId}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>{u.department}</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>{u.level}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: u.isActive ? '#064E3B22' : '#450A0A22', color: u.isActive ? '#10B981' : '#EF4444', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setEditForm({
                                fullName: u.fullName || '',
                                role: u.role || 'student',
                                department: u.department || '',
                                level: u.level || 'ND1',
                                matricNumber: u.matricNumber || '',
                                staffId: u.staffId || '',
                                email: u.email || '',
                              });
                              setShowForm(false);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            style={{ background: '#1E293B', border: '1px solid #334155', color: '#F1F5F9', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => toggleUser(u._id, u.isActive)}
                            style={{ background: u.isActive ? '#450A0A' : '#064E3B', border: `1px solid ${u.isActive ? '#EF4444' : '#10B981'}`, color: u.isActive ? '#EF4444' : '#10B981', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
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

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #F59E0B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
