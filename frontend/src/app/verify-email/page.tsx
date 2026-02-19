'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import config from '@/config/api';

const API_URL = config.apiUrl;

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginDirect } = useAuth();
  
  const emailFromUrl = searchParams?.get('email') || '';
  const fromLogin = searchParams?.get('from') === 'login';
  
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(fromLogin ? 60 : 0);
  const [autoLoginLoading, setAutoLoginLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Store password temporarily for auto-login after verification
  const passwordRef = useRef<string>('');

  // Try to get stored password for auto-login (from sessionStorage)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPw = sessionStorage.getItem('_vp');
      if (storedPw) {
        passwordRef.current = storedPw;
      }
    }
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only take the last character
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setCode(newCode);
    
    // Focus the next empty input or the last one
    const nextEmptyIndex = newCode.findIndex(c => !c);
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else {
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const verificationCode = code.join('');
    
    if (verificationCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    if (!email) {
      setError('Email address is required');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      if (data.success) {
        setSuccess(true);
        
        // Clean up stored password
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('_vp');
        }
        
        // Redirect to login page after 2 seconds
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setError(data.message || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setError('Email address is required');
      return;
    }

    if (resendCooldown > 0) return;

    setError(null);
    setResending(true);

    try {
      const response = await fetch(`${API_URL}/auth/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setResendCooldown(60); // 60 second cooldown
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setError(data.message || 'Failed to resend code');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (code.every(c => c !== '') && !loading && !success) {
      handleVerify();
    }
  }, [code]);

  if (success) {
    return (
      <MainLayout>
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-bg-card border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center border-2 border-green-500/30">
                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Email Verified!</h2>
              <p className="text-text-secondary mb-6">
                {autoLoginLoading 
                  ? 'Logging you in automatically...' 
                  : 'Your account is now active. Redirecting you to login...'}
              </p>
              <div className="flex items-center justify-center gap-2 text-accent-primary">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-medium">Redirecting...</span>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-bg-card border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent-primary/20 to-accent-primary/5 flex items-center justify-center border border-accent-primary/20">
                <svg className="w-8 h-8 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Verify Your Email</h1>
              {fromLogin ? (
                <div className="space-y-1">
                  <p className="text-accent-primary font-medium text-sm">
                    We sent a new verification code to your email
                  </p>
                  <p className="text-accent-primary font-semibold text-lg">{email || 'your email'}</p>
                </div>
              ) : (
                <>
                  <p className="text-text-secondary text-sm">
                    We sent a 6-digit verification code to
                  </p>
                  <p className="text-accent-primary font-semibold text-lg mt-1">{email || 'your email'}</p>
                </>
              )}
            </div>

            {/* Info banner for login redirect */}
            {fromLogin && (
              <div className="mb-6 p-4 bg-accent-primary/10 border border-accent-primary/20 rounded-xl">
                <p className="text-accent-primary text-sm text-center font-medium">
                  Your email is not yet verified. Please enter the code below to activate your account.
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-red-400 text-sm text-center font-medium">{error}</p>
              </div>
            )}

            {/* Code Input */}
            <form onSubmit={handleVerify}>
              <div className="mb-8">
                <label className="block text-sm font-medium text-text-secondary mb-4 text-center">
                  Enter Verification Code
                </label>
                <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-white/5 border-2 border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all"
                      disabled={loading}
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
              </div>

              {/* Email Input (if not provided via URL) */}
              {!emailFromUrl && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-text-secondary mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              )}

              {/* Verify Button */}
              <button
                type="submit"
                disabled={loading || code.join('').length !== 6}
                className="w-full py-3.5 bg-gradient-to-r from-accent-primary to-accent-primary/80 text-white font-bold rounded-xl hover:from-accent-primary/90 hover:to-accent-primary/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-primary/20 mb-4"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying...
                  </span>
                ) : 'Verify Email'}
              </button>

              {/* Resend Code */}
              <div className="text-center">
                <p className="text-text-secondary text-sm mb-2">
                  Didn&apos;t receive the code?
                </p>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending || resendCooldown > 0}
                  className="text-accent-primary hover:text-accent-primary/80 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-accent-primary/5 border border-accent-primary/20 rounded-xl">
              <p className="text-text-secondary text-xs text-center leading-relaxed">
                The verification code expires in <span className="text-accent-primary font-semibold">15 minutes</span>.
                <br />
                Check your spam folder if you don&apos;t see the email.
              </p>
            </div>

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <Link href="/login" className="text-text-secondary hover:text-white text-sm transition-colors">
                &larr; Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-bg-card border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
              <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-text-secondary mt-4">Loading...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
