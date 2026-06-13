'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';
import { FaUserPlus, FaSave, FaTrash, FaShieldAlt, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { validatePassword, getStrengthText, getStrengthColor } from '@adminpanel/lib/auth/password';

type Role = 'admin' | 'editor';
type Status = 'active' | 'disabled';

interface CMSUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
  totpEnabled?: boolean;
  mfaRequired?: boolean;
}

interface RoleCard {
  name: string;
  key: Role;
  color: string;
  permissions: string[];
}

const emptyNewUser = { name: '', email: '', role: 'editor' as Role, password: '', status: 'active' as Status };

export default function UsersManagement() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<CMSUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mfaActionId, setMfaActionId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ ...emptyNewUser });
  const [passwordEdits, setPasswordEdits] = useState<Record<string, string>>({});
  const [passwordValidations, setPasswordValidations] = useState<Record<string, ReturnType<typeof validatePassword> | undefined>>({});

  const roleCards: RoleCard[] = useMemo(
    () => [
      {
        name: 'Administrator',
        key: 'admin',
        color: 'cyber-red',
        permissions: ['Full access', 'User management', 'Site settings', 'Analytics'],
      },
      {
        name: 'Editor',
        key: 'editor',
        color: 'cyber-green',
        permissions: ['Content management', 'Media upload', 'Form submissions'],
      },
    ],
    []
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data || []);
    } catch (error) {
      console.error('Fetch users failed', error);
      addToast('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleNewUserChange = (field: string, value: string) => {
    setNewUser((prev) => ({ ...prev, [field]: value }));
    // Validate password as user types
    if (field === 'password') {
      setPasswordValidations((prev) => ({
        ...prev,
        'new': validatePassword(value),
      }));
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      addToast('error', 'Name, email, and password are required');
      return;
    }

    // Validate password
    const validation = validatePassword(newUser.password);
    if (!validation.valid) {
      addToast('error', validation.errors.join('; '));
      return;
    }

    try {
      const res = await fetch('/api/cms/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast('error', err.error || 'Failed to create user');
        return;
      }

      const created = await res.json();
      setUsers((prev) => [...prev, created]);
      setNewUser({ ...emptyNewUser });
      setPasswordValidations((prev) => ({ ...prev, 'new': undefined }));
      addToast('success', 'User created');
    } catch (error) {
      console.error('Create user failed', error);
      addToast('error', 'Failed to create user');
    }
  };

  const updateUserField = (id: string, field: keyof CMSUser, value: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)));
  };

  const saveUser = async (user: CMSUser) => {
    setSavingId(user.id);
    try {
      const payload: Record<string, any> = { ...user };
      const newPassword = passwordEdits[user.id];
      
      if (newPassword) {
        // Validate password before sending
        const validation = validatePassword(newPassword);
        if (!validation.valid) {
          addToast('error', validation.errors.join('; '));
          setSavingId(null);
          return;
        }
        payload.password = newPassword;
      }

      const res = await fetch('/api/cms/users', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast('error', err.error || 'Failed to save user');
        return;
      }

      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      setPasswordEdits((prev) => ({ ...prev, [user.id]: '' }));
      setPasswordValidations((prev) => ({ ...prev, [user.id]: undefined }));
      addToast('success', 'User updated');
    } catch (error) {
      console.error('Update user failed', error);
      addToast('error', 'Failed to save user');
    } finally {
      setSavingId(null);
    }
  };

  const deleteUser = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/cms/users?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast('error', err.error || 'Failed to delete user');
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== id));
      addToast('success', 'User deleted');
    } catch (error) {
      console.error('Delete user failed', error);
      addToast('error', 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const updateMfa = async (id: string, action: 'disable' | 'reset') => {
    setMfaActionId(id + action);
    try {
      const res = await fetch('/api/cms/users', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, mfaAction: action }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast('error', data?.error || 'Failed to update MFA');
        return;
      }

      setUsers((prev) => prev.map((u) => (u.id === id ? data : u)));
      addToast('success', action === 'disable' ? 'MFA disabled for user' : 'MFA reset; user must re-enroll');
    } catch (error) {
      console.error('MFA update failed', error);
      addToast('error', 'Failed to update MFA');
    } finally {
      setMfaActionId(null);
    }
  };

  return (
    <AdminShell title="Users Management">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Users & Roles</h1>
        <p className="text-text-secondary">Manage user accounts, roles, and access</p>
      </div>

      <div className="card-cyber p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Add New User</h2>
            <p className="text-text-secondary text-sm">Passwords must meet NIST SP 800-63B guidelines: minimum 8 characters, avoid common passwords</p>
          </div>
          <FaUserPlus className="text-cyber-green text-xl" />
        </div>
        <form className="space-y-4" onSubmit={createUser}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              className="input-cyber"
              placeholder="Name"
              value={newUser.name}
              onChange={(e) => handleNewUserChange('name', e.target.value)}
            />
            <input
              className="input-cyber"
              placeholder="Email"
              type="email"
              value={newUser.email}
              onChange={(e) => handleNewUserChange('email', e.target.value)}
            />
            <select
              className="input-cyber"
              value={newUser.role}
              onChange={(e) => handleNewUserChange('role', e.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
            </select>
            <select
              className="input-cyber"
              value={newUser.status}
              onChange={(e) => handleNewUserChange('status', e.target.value)}
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            <input
              className="input-cyber"
              placeholder="Password"
              type="password"
              value={newUser.password}
              onChange={(e) => handleNewUserChange('password', e.target.value)}
            />
          </div>

          {/* Password Strength Indicator */}
          {newUser.password && passwordValidations['new'] && (
            <div className="bg-dark-lighter rounded-lg p-4 border border-dark-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-secondary text-sm">Password Strength</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 bg-dark-border rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        passwordValidations['new']!.score === 1
                          ? 'w-1/5 bg-cyber-red'
                          : passwordValidations['new']!.score === 2
                          ? 'w-2/5 bg-orange-500'
                          : passwordValidations['new']!.score === 3
                          ? 'w-3/5 bg-yellow-500'
                          : passwordValidations['new']!.score === 4
                          ? 'w-4/5 bg-lime-500'
                          : 'w-full bg-cyber-green'
                      }`}
                    />
                  </div>
                  <span className={`text-sm font-semibold ${getStrengthColor(passwordValidations['new']!.strength)}`}>
                    {getStrengthText(passwordValidations['new']!.strength)}
                  </span>
                </div>
              </div>

              {/* Errors */}
              {passwordValidations['new']!.errors.length > 0 && (
                <div className="mb-2 space-y-1">
                  {passwordValidations['new']!.errors.map((err, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-cyber-red text-sm">
                      <FaExclamationTriangle className="mt-0.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {passwordValidations['new']!.warnings.length > 0 && (
                <div className="space-y-1">
                  {passwordValidations['new']!.warnings.map((warn, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-yellow-500 text-sm">
                      <FaExclamationTriangle className="mt-0.5 shrink-0" />
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              )}

              {passwordValidations['new']!.valid && (
                <div className="flex items-start space-x-2 text-cyber-green text-sm">
                  <FaCheckCircle className="mt-0.5 shrink-0" />
                  <span>Password meets security requirements</span>
                </div>
              )}
            </div>
          )}

          <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
            <FaUserPlus />
            <span>Create User</span>
          </button>
        </form>
      </div>

      <div className="card-cyber overflow-hidden mb-8">
        <div className="p-6 border-b border-dark-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">All Users</h2>
          {loading && <span className="text-text-secondary text-sm">Loading...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-lighter">
              <tr>
                <th className="text-left p-4 text-text-primary font-semibold">Name</th>
                <th className="text-left p-4 text-text-primary font-semibold">Email</th>
                <th className="text-left p-4 text-text-primary font-semibold">Role</th>
                <th className="text-left p-4 text-text-primary font-semibold">Status</th>
                <th className="text-left p-4 text-text-primary font-semibold">2FA</th>
                <th className="text-left p-4 text-text-primary font-semibold">Reset Password</th>
                <th className="text-left p-4 text-text-primary font-semibold">Last Login</th>
                <th className="text-right p-4 text-text-primary font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !loading && (
                <tr>
                  <td className="p-4 text-text-secondary" colSpan={7}>
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id} className="border-t border-dark-border hover:bg-dark-lighter transition-colors">
                  <td className="p-4 text-text-primary font-semibold">{user.name}</td>
                  <td className="p-4 text-text-secondary font-mono text-sm">{user.email}</td>
                  <td className="p-4">
                    <select
                      className="input-cyber"
                      value={user.role}
                      onChange={(e) => updateUserField(user.id, 'role', e.target.value)}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <select
                      className="input-cyber"
                      value={user.status}
                      onChange={(e) => updateUserField(user.id, 'status', e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-text-primary flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${user.totpEnabled ? 'bg-cyber-green' : user.mfaRequired ? 'bg-yellow-500' : 'bg-dark-border'}`} />
                        <span>
                          {user.totpEnabled
                            ? 'Enabled'
                            : user.mfaRequired
                              ? 'Re-setup required'
                              : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="btn-secondary px-3! py-2!"
                          onClick={() => updateMfa(user.id, 'reset')}
                          disabled={mfaActionId === user.id + 'reset'}
                        >
                          {mfaActionId === user.id + 'reset'
                            ? 'Updating...'
                            : user.totpEnabled
                              ? 'Change 2FA'
                              : 'Setup 2FA'}
                        </button>
                        <button
                          className="btn-danger px-3! py-2!"
                          onClick={() => updateMfa(user.id, 'disable')}
                          disabled={mfaActionId === user.id + 'disable' || !user.totpEnabled}
                        >
                          {mfaActionId === user.id + 'disable' ? 'Disabling...' : 'Disable 2FA'}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-2">
                      <input
                        className="input-cyber w-full"
                        type="password"
                        placeholder="New password (leave empty to keep current)"
                        value={passwordEdits[user.id] || ''}
                        onChange={(e) => {
                          setPasswordEdits((prev) => ({ ...prev, [user.id]: e.target.value }));
                          if (e.target.value) {
                            setPasswordValidations((prev) => ({
                              ...prev,
                              [user.id]: validatePassword(e.target.value),
                            }));
                          } else {
                            setPasswordValidations((prev) => ({ ...prev, [user.id]: undefined }));
                          }
                        }}
                      />
                      {passwordEdits[user.id] && passwordValidations[user.id] && (
                        <div className="text-xs space-y-1">
                          {passwordValidations[user.id]!.errors.length > 0 && (
                            <div className="text-cyber-red">
                              {passwordValidations[user.id]!.errors[0]}
                            </div>
                          )}
                          {passwordValidations[user.id]!.valid && (
                            <div className={getStrengthColor(passwordValidations[user.id]!.strength)}>
                              ✓ {getStrengthText(passwordValidations[user.id]!.strength)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-text-secondary text-sm">{user.lastLogin ? user.lastLogin : '—'}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        className="btn-secondary px-3! py-2! flex items-center space-x-2"
                        onClick={() => saveUser(user)}
                        disabled={savingId === user.id}
                      >
                        <FaSave />
                        <span>{savingId === user.id ? 'Saving...' : 'Save'}</span>
                      </button>
                      <button
                        className="btn-danger px-3! py-2! flex items-center space-x-2"
                        onClick={() => deleteUser(user.id)}
                        disabled={deletingId === user.id}
                      >
                        <FaTrash />
                        <span>{deletingId === user.id ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="heading-md text-gradient mb-6">Roles & Permissions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roleCards.map((role) => (
            <div key={role.key} className="card-cyber p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-xl font-bold text-${role.color}`}>{role.name}</h3>
                <FaShieldAlt className={`text-2xl text-${role.color}`} />
              </div>
              <ul className="space-y-2">
                {role.permissions.map((perm, idx) => (
                  <li key={idx} className="flex items-center space-x-2 text-text-secondary text-sm">
                    <div className={`w-2 h-2 bg-${role.color} rounded-full`} />
                    <span>{perm}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
