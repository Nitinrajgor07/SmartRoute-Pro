import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Settings as SettingsIcon
} from 'lucide-react';
import { useTheme } from '../app/ThemeContext';
import { useAuth } from '../app/AuthContext';
import { healthService } from '../services/api';
import type { BackendHealthResponse } from '../types';

interface NavbarProps {
  onOpenMobile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobile }) => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { user, role, logout } = useAuth();

  const [backendHealth, setBackendHealth] = useState<BackendHealthResponse | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [showHealthModal, setShowHealthModal] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    navigate('/login');
  };

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkApiHealth = async () => {
    setIsChecking(true);
    try {
      const data = await healthService.checkHealth();
      setBackendHealth(data);
      setIsOnline(true);
    } catch {
      setIsOnline(false);
      setBackendHealth(null);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 20000);
    return () => clearInterval(interval);
  }, []);

  const getRoleBadgeClasses = () => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'DISPATCHER':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between glass-chrome border-b px-4 sm:px-6 transition-colors">
        {/* Left: Mobile Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobile}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Right: Live Health, Theme Switcher, Profile Menu */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">

          {/* Backend API Live Health Pill */}
          <button
            onClick={() => setShowHealthModal(true)}
            title="Click to view Flask API Health status"
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-all cursor-pointer bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span className="relative flex h-2 w-2">
              {isOnline === true && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOnline === true
                    ? 'bg-emerald-500'
                    : isOnline === false
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
            </span>
            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
              {isChecking
                ? 'Pinging API...'
                : isOnline === true
                ? 'Backend: Online'
                : 'Backend: Standby'}
            </span>
          </button>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
          </button>

          {/* User Profile & Role Dropdown */}
          <div className="relative pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800" ref={userMenuRef}>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                aria-haspopup="true"
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                  {(user?.name || 'SR')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </div>
                <div className="hidden xl:flex flex-col">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[120px]">
                    {user?.name || 'SmartRoute User'}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider border inline-block mt-0.5 ${getRoleBadgeClasses()}`}>
                    {role || 'VIEWER'}
                  </span>
                </div>
                <ChevronDown className={`h-3 w-3 text-slate-400 hidden xl:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Direct Logout Button */}
              <button
                onClick={handleLogout}
                title="Sign Out of SmartRoute Pro"
                aria-label="Logout"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Profile Popover Menu */}
            {showUserMenu && (
              <div className="glass-float absolute right-0 mt-2 w-56 rounded-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="p-2.5 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {user?.name || 'SmartRoute User'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {user?.email || 'user@smartroute.pro'}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getRoleBadgeClasses()}`}>
                      {role || 'VIEWER'}
                    </span>
                    <span className="text-[10px] text-slate-400">Authenticated Session</span>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/settings');
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <SettingsIcon className="h-3.5 w-3.5 text-slate-500" />
                    <span>System Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/settings');
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Role Permissions ({role})</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Backend API Health Detail Modal */}
      {showHealthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="glass-float w-full max-w-md rounded-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-brand-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Flask Backend Status
                </h3>
              </div>
              <button
                onClick={() => setShowHealthModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕ Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Endpoint Status:</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {isOnline ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {isOnline ? 'Healthy & Connected' : 'Offline / Standby'}
                </span>
              </div>

              {backendHealth ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Service:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{backendHealth.service}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Platform Version:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">v{backendHealth.version}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Environment:</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">{backendHealth.environment}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Database Engine:</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">{backendHealth.database.engine}{backendHealth.database.status ? ` - ${backendHealth.database.status}` : ''}</span>
                  </div>
                  <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <p className="italic">{backendHealth.database.note}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-xs text-slate-500 dark:text-slate-400 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p>Backend server running on <code className="text-brand-600 dark:text-brand-400">http://127.0.0.1:5000</code>.</p>
                  <p className="mt-1">When started via <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[11px]">python run.py</code>, this indicator turns green automatically.</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={checkApiHealth}
                disabled={isChecking}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-medium hover:from-brand-500 hover:to-indigo-500 shadow-sm transition-all disabled:opacity-50"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
