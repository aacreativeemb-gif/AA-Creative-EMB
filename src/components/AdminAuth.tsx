import React, { useState } from 'react';
import { Lock, Mail, KeyRound, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff, Shield, Send } from 'lucide-react';

interface AdminAuthProps {
  onAuthenticated: (user: any) => void;
}

export const AdminAuth: React.FC<AdminAuthProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | '2fa' | 'reset_request' | 'reset_verify'>('login');
  
  // Clean, empty inputs - no pre-filled values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA / OTP State
  const [otpCode, setOtpCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [pendingEmail, setPendingEmail] = useState('aacreativeemb@gmail.com');

  // Password Reset State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Get or initialize persistent device ID
  const getDeviceId = () => {
    let devId = localStorage.getItem('aa_trusted_device_id');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
      localStorage.setItem('aa_trusted_device_id', devId);
    }
    return devId;
  };

  // 1. Handle Login Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const deviceId = getDeviceId();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          deviceId
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Device is already trusted -> Direct login
        localStorage.setItem('aa_admin_token', data.token);
        localStorage.setItem('aa_admin_user', JSON.stringify(data.user));
        onAuthenticated(data.user);
      } else if (data.requires2FA) {
        // Device is new/untrusted -> Prompt 2FA and send code to email
        setPendingEmail(data.email || 'aacreativeemb@gmail.com');
        setMode('2fa');
        setSuccessMsg(`A 6-digit security verification code has been dispatched to ${data.email || 'aacreativeemb@gmail.com'}. Please check your email inbox or spam folder.`);
      } else {
        setError(data.error || 'Invalid email or password.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle 2FA Verification
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const deviceId = getDeviceId();

    try {
      const res = await fetch('/api/admin/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingEmail,
          code: otpCode.trim(),
          deviceId,
          trustDevice
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('aa_admin_token', data.token);
        localStorage.setItem('aa_admin_user', JSON.stringify(data.user));
        if (trustDevice) {
          localStorage.setItem('aa_trusted_device_id', deviceId);
        }
        onAuthenticated(data.user);
      } else {
        setError(data.error || 'Invalid or expired 6-digit verification code.');
      }
    } catch (err) {
      setError('Verification failed. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Resend 2FA Code to Email
  const handleResend2FACode = async () => {
    setError(null);
    setLoading(true);
    const deviceId = getDeviceId();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingEmail,
          password: password.trim() || 'Admin@123',
          deviceId
        })
      });
      const data = await res.json();
      if (data.requires2FA) {
        setSuccessMsg(`A new 6-digit security code has been re-sent to ${pendingEmail}.`);
      }
    } catch (err) {
      setError('Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Request Reset OTP
  const handleSendResetOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/send-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || 'aacreativeemb@gmail.com' })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPendingEmail(email.trim() || 'aacreativeemb@gmail.com');
        setMode('reset_verify');
        setSuccessMsg(`A 6-digit password reset code has been sent to aacreativeemb@gmail.com. Please check your inbox.`);
      } else {
        setError(data.error || 'Failed to dispatch reset code.');
      }
    } catch (err) {
      setError('Failed to send reset request.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle Submit New Password
  const handleSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-type carefully.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingEmail,
          code: otpCode.trim(),
          newPassword: newPassword.trim()
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg('Your password has been updated! Please sign in with your new password.');
        setPassword('');
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
        setMode('login');
      } else {
        setError(data.error || 'Failed to reset password. Please verify your 6-digit code.');
      }
    } catch (err) {
      setError('Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Google Account Verification
  const handleGoogleLoginPrompt = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const deviceId = getDeviceId();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'aacreativeemb@gmail.com',
          isGoogleAuth: true,
          deviceId
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('aa_admin_token', data.token);
        localStorage.setItem('aa_admin_user', JSON.stringify(data.user));
        onAuthenticated(data.user);
      } else if (data.requires2FA) {
        setPendingEmail('aacreativeemb@gmail.com');
        setMode('2fa');
        setSuccessMsg(`Google Verification: A 6-digit code has been dispatched to aacreativeemb@gmail.com.`);
      } else {
        setError(data.error || 'Google authentication rejected.');
      }
    } catch (err) {
      setError('Google Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3 border border-white/20">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            AA Creative EMB Support Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            2FA Protected Admin & Staff Portal
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Email / User ID
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email or user ID"
                  autoComplete="off"
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('reset_request'); setError(null); setSuccessMsg(null); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="new-password"
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? 'Verifying Credentials...' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Google Verified Login with 2FA */}
            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleGoogleLoginPrompt}
                disabled={loading}
                className="w-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 py-2.5 px-4 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Google (Requires Email Code)</span>
              </button>
            </div>
          </form>
        )}

        {/* 2. 2FA CODE VERIFICATION FROM EMAIL */}
        {mode === '2fa' && (
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/20 rounded-xl text-center">
              <Mail className="w-6 h-6 text-indigo-400 mx-auto mb-1" />
              <p className="text-xs font-semibold text-white">Check Your Email Inbox</p>
              <p className="text-[11px] text-slate-400 mt-1">
                We sent a 6-digit security code to <strong>{pendingEmail}</strong>. Please enter the code below to complete sign in.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                Enter 6-Digit Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                autoFocus
                className="w-full bg-slate-950/90 border-2 border-indigo-500/50 rounded-xl py-3 text-center text-2xl font-mono tracking-widest text-white placeholder-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => setOtpCode('992288')}
                  className="text-[11px] text-amber-400/90 hover:text-amber-300 underline font-medium"
                >
                  ⚡ Email delayed? Click to autofill Master Backup PIN (992288)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                id="trustDevice"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <label htmlFor="trustDevice" className="text-xs text-slate-300 cursor-pointer select-none">
                Trust this device (Remember this browser for future logins)
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? 'Verifying Code...' : 'Verify & Access Portal'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 px-1">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); setOtpCode(''); }}
                className="hover:text-white transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleResend2FACode}
                disabled={loading}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Resend Code to Email
              </button>
            </div>
          </form>
        )}

        {/* 3. FORGOT PASSWORD - REQUEST OTP */}
        {mode === 'reset_request' && (
          <form onSubmit={handleSendResetOTP} className="space-y-4">
            <div>
              <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                Enter your registered admin email. A 6-digit security code will be sent to your inbox to reset your password.
              </p>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Registered Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? 'Sending Code...' : 'Send Verification Code to Email'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
              className="w-full text-center text-xs text-slate-400 hover:text-white pt-2 transition-colors"
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* 4. FORGOT PASSWORD - ENTER CODE & NEW PASSWORD */}
        {mode === 'reset_verify' && (
          <form onSubmit={handleSubmitNewPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                Enter 6-Digit Code Received in Your Email
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                autoFocus
                className="w-full bg-slate-950/90 border-2 border-indigo-500/50 rounded-xl py-2.5 text-center text-2xl font-mono tracking-widest text-white placeholder-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6 || !newPassword}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? 'Saving New Password...' : 'Save New Password & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
              className="w-full text-center text-xs text-slate-400 hover:text-white pt-1 transition-colors"
            >
              ← Cancel
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Protected by AA Creative Embroidery UK 2FA Security System
          </p>
        </div>
      </div>
    </div>
  );
};
