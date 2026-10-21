// FROZEN: do not edit. Approved design.
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import {
  Navigation,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Truck,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const setDemoCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  return (
    <div
      className="light app-backdrop min-h-screen w-full flex flex-col lg:flex-row transition-colors text-slate-900"
      style={{ colorScheme: 'light' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* LEFT COLUMN: BRANDING & ILLUSTRATION (DESKTOP)                      */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[54%] p-10 xl:p-14 flex-col justify-between relative overflow-hidden select-none"
      >
        {/* Top: Logo */}
        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-white/80">
              <Navigation className="h-5 w-5 rotate-45 transform text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight leading-tight" style={{ color: '#0f1a33' }}>
                SmartRoute <span style={{ color: '#2f5bea' }}>Pro</span>
              </h2>
            </div>
          </div>
        </div>

        {/* Middle: Headline, Supporting Sentence & Clean Route Visualizer */}
        <div className="relative z-10 my-auto py-8 space-y-8">
          <div className="space-y-3 max-w-lg">
            <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight" style={{ color: '#0f1a33' }}>
              Deliver smarter. Move faster.
            </h1>
            <p className="text-sm xl:text-base leading-relaxed" style={{ color: '#475569' }}>
              Plan routes, manage deliveries and track performance in one place.
            </p>
          </div>

          {/* Clean Route Network Visualizer with Readable Labels */}
          <div
            className="relative w-full max-w-lg p-6 rounded-2xl overflow-hidden"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f5',
              boxShadow: '0 10px 30px rgba(47, 91, 234, 0.08)'
            }}
          >
            <svg viewBox="0 0 460 220" className="w-full h-auto" fill="none">
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="45%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>

              {/* Background Network Grid Lines */}
              <path d="M 60 140 L 160 60" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.5" />
              <path d="M 60 140 L 170 170" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.5" />
              <path d="M 160 60 L 290 60" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.5" />
              <path d="M 170 170 L 290 160" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.5" />
              <path d="M 290 60 L 400 110" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.5" />
              <path d="M 290 160 L 400 110" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.5" />

              {/* Primary Optimal Route Polyline */}
              <path
                d="M 60 140 Q 150 70 240 110 T 400 110"
                stroke="url(#routeGradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                filter="url(#glow)"
              />

              {/* Waypoint Nodes with Clear, Readable Labels */}
              {/* Origin Node */}
              <g transform="translate(60, 140)">
                <circle r="14" fill="#10b981" fillOpacity="0.2" className="animate-ping" style={{ animationDuration: '3s' }} />
                <circle r="9" fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />
                <circle r="3.5" fill="#10b981" />
                <text y="26" textAnchor="middle" fill="#1e293b" fontSize="12" fontWeight="600">Origin Depot</text>
              </g>

              {/* Inactive Hub Dots */}
              <g transform="translate(160, 60)">
                <circle r="7" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
                <circle r="2.5" fill="#64748b" />
              </g>

              <g transform="translate(170, 170)">
                <circle r="7" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
                <circle r="2.5" fill="#64748b" />
              </g>

              {/* Mid-Way Waypoint */}
              <g transform="translate(240, 110)">
                <circle r="11" fill="#4f46e5" fillOpacity="0.18" />
                <circle r="8" fill="#ffffff" stroke="#4f46e5" strokeWidth="2" />
                <circle r="3" fill="#4f46e5" />
                <text y="26" textAnchor="middle" fill="#1e293b" fontSize="12" fontWeight="600">Hub Waypoint</text>
              </g>

              {/* Inactive Hub Dots */}
              <g transform="translate(290, 60)">
                <circle r="7" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
                <circle r="2.5" fill="#64748b" />
              </g>

              <g transform="translate(290, 160)">
                <circle r="7" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
                <circle r="2.5" fill="#64748b" />
              </g>

              {/* Destination Target Node */}
              <g transform="translate(400, 110)">
                <circle r="14" fill="#4f46e5" fillOpacity="0.18" className="animate-pulse" />
                <circle r="9" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />
                <circle r="3.5" fill="#4f46e5" />
                <text y="26" textAnchor="middle" fill="#1e293b" fontSize="12" fontWeight="600">Destination</text>
              </g>
            </svg>
          </div>
        </div>

        {/* Bottom Spacing Anchor */}
        <div className="relative z-10 pt-4" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT COLUMN: AUTHENTICATION FORM                                  */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="w-full lg:w-[48%] xl:w-[46%] min-h-screen flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 transition-colors"
      >
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Header (Shown only on small screens) */}
          <div
            className="lg:hidden w-full p-4 text-center space-y-2 mb-2"
          >
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20 border border-white/60">
              <Navigation className="h-5 w-5 rotate-45 transform text-white" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight" style={{ color: '#0f1a33' }}>
                SmartRoute <span style={{ color: '#2f5bea' }}>Pro</span>
              </div>
            </div>
          </div>

          {/* Authentication Card */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
            {/* Header Title */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Sign in
              </h1>
            </div>

            {/* Demo Accounts Selector (Dev / Local Evaluation Only) */}
            {import.meta.env.DEV && (
              <div className="p-3.5 rounded-2xl glass-tile space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                    <span>Demo accounts (development only)</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {/* Admin Selector */}
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('admin@smartroute.pro', 'Admin@123456')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      email === 'admin@smartroute.pro'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span>Admin</span>
                  </button>

                  {/* Dispatcher Selector */}
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('dispatcher@smartroute.pro', 'Dispatch@123456')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      email === 'dispatcher@smartroute.pro'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <Truck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span>Dispatcher</span>
                  </button>

                  {/* Viewer Selector */}
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('viewer@smartroute.pro', 'Viewer@123456')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      email === 'viewer@smartroute.pro'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span>Viewer</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sign In Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    id="login-email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@smartroute.pro"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    id="login-password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Inline Error Message for Wrong Password / Credentials */}
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold py-2.5 shadow-md shadow-brand-500/20 transition-all duration-150 disabled:opacity-50 cursor-pointer text-xs sm:text-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Registration Footer */}
            <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
              <span>Don't have an account? </span>
              <Link
                to="/register"
                className="font-semibold text-brand-600 hover:underline"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
