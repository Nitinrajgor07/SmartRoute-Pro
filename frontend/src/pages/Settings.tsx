import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Laptop,
  CheckCircle2,
  Info,
  User,
  Shield,
  KeyRound,
  Users,
  AlertTriangle,
  RotateCw,
  Mail,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  Sliders,
  UserCheck,
  UserX,
  Trash2,
  Clock
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useTheme } from '../app/ThemeContext';
import { useAuth } from '../app/AuthContext';
import { authService } from '../services/api';
import type { ThemeMode, ManagedUser, UserRole } from '../types';

const APP_VERSION = 'v1.2.0';

export const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { user, role, can, updateProfile, changePassword, refreshUser } = useAuth();
  const canManageUsers = can('users:manage');

  // Active Settings Tab: 'profile' | 'preferences' | 'users'
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'users'>(
    searchParams.get('tab') === 'users' ? 'users' : 'profile'
  );

  // Profile Form State
  const [profileName, setProfileName] = useState<string>(user?.name || '');
  const [profileEmail, setProfileEmail] = useState<string>(user?.email || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin User Management State
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [userActionMessage, setUserActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    action: 'status' | 'role' | 'approve' | 'reject' | 'delete';
    userId: number;
    userName: string;
    targetValue: any;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
    }
  }, [user]);

  const loadUsers = async () => {
    if (!canManageUsers) return;
    setIsLoadingUsers(true);
    setUserActionMessage(null);
    try {
      const data = await authService.getUsers();
      setManagedUsers(data.users || []);
    } catch (err: any) {
      setUserActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to load users list.'
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      if (canManageUsers) {
        loadUsers();
      } else {
        setActiveTab('profile');
      }
    }
  }, [activeTab, canManageUsers]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    if (!profileName.trim() || !profileEmail.trim()) {
      setProfileMessage({ type: 'error', text: 'Name and email are required.' });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile(profileName.trim(), profileEmail.trim());
      setProfileMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setProfileMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update profile.'
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: 'Current password is required.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to change password. Verify your current password.'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const executeRoleChange = async (userId: number, newRole: UserRole) => {
    setUserActionMessage(null);
    try {
      await authService.updateUserRole(userId, newRole);
      setUserActionMessage({ type: 'success', text: `Role updated to ${newRole}.` });
      await loadUsers();
      if (userId === user?.id) {
        await refreshUser();
      }
    } catch (err: any) {
      setUserActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update role.'
      });
    } finally {
      setPendingConfirm(null);
    }
  };

  const executeToggleStatus = async (userId: number, currentStatus: boolean) => {
    if (userId === user?.id) {
      setUserActionMessage({ type: 'error', text: 'Cannot deactivate your own active session account.' });
      setPendingConfirm(null);
      return;
    }

    setUserActionMessage(null);
    try {
      await authService.toggleUserStatus(userId, !currentStatus);
      setUserActionMessage({
        type: 'success',
        text: `User account ${!currentStatus ? 'activated' : 'deactivated'} successfully.`
      });
      await loadUsers();
    } catch (err: any) {
      setUserActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update user status.'
      });
    } finally {
      setPendingConfirm(null);
    }
  };

  const runUserAction = async (
    action: () => Promise<{ message: string }>,
    fallbackError: string
  ) => {
    setUserActionMessage(null);
    try {
      const res = await action();
      setUserActionMessage({ type: 'success', text: res.message });
      await loadUsers();
    } catch (err: any) {
      setUserActionMessage({
        type: 'error',
        text: err.response?.data?.message || fallbackError
      });
    } finally {
      setPendingConfirm(null);
    }
  };

  const executeApprove = (userId: number) =>
    runUserAction(() => authService.approveUser(userId), 'Failed to approve user.');

  const executeReject = (userId: number) =>
    runUserAction(() => authService.rejectUser(userId), 'Failed to reject user.');

  const executeDelete = (userId: number) => {
    if (userId === user?.id) {
      setUserActionMessage({ type: 'error', text: 'You cannot delete your own account.' });
      setPendingConfirm(null);
      return;
    }
    return runUserAction(() => authService.deleteUser(userId), 'Failed to delete user.');
  };

  const pendingUsers = managedUsers.filter((u) => u.approval_status === 'pending');
  const canDeleteUser = (u: ManagedUser) =>
    u.id !== user?.id && u.role.toUpperCase() !== 'ADMIN';

  const environmentDisplay = import.meta.env.MODE === 'production' ? 'Production' : 'Development';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Settings"
        subtitle="Manage account profile, security credentials, appearance, and system configuration"
        icon={SettingsIcon}
        badge={role || 'VIEWER'}
        badgeColor={
          role === 'ADMIN'
            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
            : role === 'DISPATCHER'
            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
            : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
        }
      />

      {/* Settings Navigation Tabs */}
      <div className="glass-card flex items-center gap-1.5 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <User className="h-3.5 w-3.5" />
          <span>Profile & Security</span>
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'preferences'
              ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Appearance</span>
        </button>

        {canManageUsers && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>User Management</span>
          </button>
        )}
      </div>

      {/* TAB 1: USER PROFILE & SECURITY */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* User Account Details (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 min-h-[48px] flex flex-col justify-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  My Profile
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update your contact details and account display name
                </p>
              </div>

              {profileMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    profileMessage.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {profileMessage.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdatingProfile ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Profile</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Change Password Card */}
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 min-h-[48px] flex flex-col justify-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-500" />
                  Account Security
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update your authentication password credentials securely
                </p>
              </div>

              {passwordMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    passwordMessage.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {passwordMessage.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter existing password"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-10 py-2 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      New Password (min 8 chars)
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-10 py-2 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-10 py-2 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Account Overview & RBAC Role Card (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 min-h-[48px] flex flex-col justify-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Account Permissions & Role
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your authenticated session identity and role privileges
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Account ID:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#{user?.id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Assigned Role:</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                          : role === 'DISPATCHER'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {role || 'VIEWER'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Status:</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Logged in as {user?.email}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Member Since:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active session'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APPEARANCE & SYSTEM PREFERENCES */}
      {activeTab === 'preferences' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Appearance Settings Card (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 min-h-[48px] flex flex-col justify-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  Appearance Settings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select interface theme across all application tabs
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'light' as ThemeMode, name: 'Light Mode', icon: Sun },
                  { id: 'dark' as ThemeMode, name: 'Dark Mode', icon: Moon },
                  { id: 'system' as ThemeMode, name: 'System Sync', icon: Laptop },
                ].map((t) => {
                  const Icon = t.icon;
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-2 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                      <span>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (5 Cols): About SmartRoute Pro */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 min-h-[48px] flex flex-col justify-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  About SmartRoute Pro
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Platform version and runtime environment
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-2 pt-1 text-[11px]">
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Application Version:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{APP_VERSION}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500 dark:text-slate-400">Environment:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{environmentDisplay}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN USER MANAGEMENT (RBAC) */}
      {activeTab === 'users' && canManageUsers && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 min-h-[48px]">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                User Management & Access Control
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage registered user accounts, role assignments, and active statuses
              </p>
            </div>

            <button
              onClick={loadUsers}
              disabled={isLoadingUsers}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 self-start sm:self-auto cursor-pointer"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              <span>Refresh Users</span>
            </button>
          </div>

          {userActionMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                userActionMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
              }`}
            >
              {userActionMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>{userActionMessage.text}</span>
            </div>
          )}

          {/* Pending registration requests */}
          <div
            className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2"
            data-testid="pending-approvals"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
              <Clock className="h-4 w-4" />
              Waiting for approval ({pendingUsers.length})
            </div>
            {pendingUsers.length === 0 ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                No new registration requests. New Viewer and Dispatcher sign-ups will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-amber-100 dark:divide-amber-900/40">
                {pendingUsers.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">{u.name}</span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono ml-2">{u.email}</span>
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                        wants {(u.requested_role || 'VIEWER').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPendingConfirm({ action: 'approve', userId: u.id, userName: u.name, targetValue: u.requested_role || 'VIEWER' })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
                        data-testid={`approve-user-${u.id}`}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => setPendingConfirm({ action: 'reject', userId: u.id, userName: u.name, targetValue: null })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        data-testid={`reject-user-${u.id}`}
                      >
                        <UserX className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* User Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">User</th>
                  <th className="py-2.5 px-3 font-semibold">Email</th>
                  <th className="py-2.5 px-3 font-semibold">Role</th>
                  <th className="py-2.5 px-3 font-semibold">Approval</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Registered</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {managedUsers.map((u) => {
                  const isSelf = u.id === user?.id;
                  const approval = u.approval_status || 'approved';
                  const isApproved = approval === 'approved';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850 transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                            {u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {u.name} {isSelf && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">(You)</span>}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">ID #{u.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                        {u.email}
                      </td>

                      <td className="py-3 px-3">
                        <select
                          value={u.role.toUpperCase()}
                          disabled={isSelf || !isApproved}
                          title={!isApproved ? 'Approve the account before changing its role' : undefined}
                          onChange={(e) => setPendingConfirm({
                            action: 'role',
                            userId: u.id,
                            userName: u.name,
                            targetValue: e.target.value as UserRole
                          })}
                          className={`rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none ${
                            isSelf || !isApproved ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="DISPATCHER">DISPATCHER</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            approval === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : approval === 'pending'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {approval === 'approved' ? 'Approved' : approval === 'pending' ? 'Pending' : 'Rejected'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'System Bootstrap'}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        {approval === 'pending' && (
                          <>
                            <button
                              onClick={() => setPendingConfirm({ action: 'approve', userId: u.id, userName: u.name, targetValue: u.requested_role || 'VIEWER' })}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-600 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setPendingConfirm({ action: 'reject', userId: u.id, userName: u.name, targetValue: null })}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {approval === 'rejected' && (
                          <button
                            onClick={() => setPendingConfirm({ action: 'approve', userId: u.id, userName: u.name, targetValue: u.requested_role || 'VIEWER' })}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-600 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                        {isApproved && (
                        <button
                          onClick={() => setPendingConfirm({
                            action: 'status',
                            userId: u.id,
                            userName: u.name,
                            targetValue: u.is_active
                          })}
                          disabled={isSelf}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                            isSelf
                              ? 'opacity-40 cursor-not-allowed text-slate-400'
                              : u.is_active
                              ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 cursor-pointer'
                              : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 cursor-pointer'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        )}
                        {canDeleteUser(u) && (
                          <button
                            onClick={() => setPendingConfirm({ action: 'delete', userId: u.id, userName: u.name, targetValue: u.email })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer"
                            data-testid={`delete-user-${u.id}`}
                            title="Delete this account permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Admin Actions */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-float rounded-2xl p-5 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Confirm User Modification
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {pendingConfirm.action === 'role' ? (
                <>
                  Are you sure you want to change the role of <strong>{pendingConfirm.userName}</strong> to <strong>{pendingConfirm.targetValue}</strong>?
                </>
              ) : pendingConfirm.action === 'approve' ? (
                <>
                  Approve <strong>{pendingConfirm.userName}</strong> as <strong>{String(pendingConfirm.targetValue).toUpperCase()}</strong>? They will be able to sign in straight away.
                </>
              ) : pendingConfirm.action === 'reject' ? (
                <>
                  Reject the registration request from <strong>{pendingConfirm.userName}</strong>? They will not be able to sign in. You can still approve them later.
                </>
              ) : pendingConfirm.action === 'delete' ? (
                <>
                  Permanently delete the account <strong>{pendingConfirm.userName}</strong> ({pendingConfirm.targetValue})? They are signed out at once and this cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to {pendingConfirm.targetValue ? 'deactivate' : 'activate'} the account for <strong>{pendingConfirm.userName}</strong>?
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setPendingConfirm(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pendingConfirm.action === 'role') {
                    executeRoleChange(pendingConfirm.userId, pendingConfirm.targetValue);
                  } else if (pendingConfirm.action === 'approve') {
                    executeApprove(pendingConfirm.userId);
                  } else if (pendingConfirm.action === 'reject') {
                    executeReject(pendingConfirm.userId);
                  } else if (pendingConfirm.action === 'delete') {
                    executeDelete(pendingConfirm.userId);
                  } else {
                    executeToggleStatus(pendingConfirm.userId, pendingConfirm.targetValue);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl text-white text-xs font-semibold shadow-sm transition cursor-pointer ${
                  pendingConfirm.action === 'delete' || pendingConfirm.action === 'reject'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : pendingConfirm.action === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                data-testid="confirm-user-action"
              >
                {pendingConfirm.action === 'delete' ? 'Delete' : pendingConfirm.action === 'approve' ? 'Approve' : pendingConfirm.action === 'reject' ? 'Reject' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
