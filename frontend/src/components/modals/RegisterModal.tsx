'use client';

import React, { useState } from 'react';
import Modal from './Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { useBranding } from '@/contexts/BrandingContext';

const RegisterModal: React.FC = () => {
  const { register } = useAuth();
  const { isRegisterOpen, closeRegister, switchToLogin, openVerification } = useModal();
  const { branding } = useBranding();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isAgeVerified) {
      setError('You must confirm you are 18 years or older');
      return;
    }

    setIsLoading(true);
    try {
      await register(username, email, password, referralCode);
      // Close register modal and open verification modal
      closeRegister();
      openVerification(email, password);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setReferralCode('');
    setIsAgeVerified(false);
    setError('');
    closeRegister();
  };

  return (
    <Modal isOpen={isRegisterOpen} onClose={handleClose}>
      <div className="p-8">
        {/* Header - matches LoginModal */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent-primary flex items-center justify-center shadow-glow mx-auto mb-3">
            <span className="text-2xl font-bold text-text-inverse">B</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Create Account</h2>
          <p className="text-text-secondary mt-1">Join {branding.brandName} today</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" data-testid="register-form">
          {/* Error Message - matches LoginModal */}
          {error && (
            <div className="p-3 bg-danger-muted border border-danger-primary/30 rounded-lg text-danger-primary text-sm animate-shake">
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <div className="relative">
              <input
                type="text"
                name="username"
                data-testid="register-username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                className="input w-full pl-10"
                placeholder="Choose a username"
                required
                autoComplete="username"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <div className="relative">
              <input
                type="email"
                name="email"
                data-testid="register-email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                className="input w-full pl-10"
                placeholder="Enter your email"
                required
                autoComplete="email"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                data-testid="register-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                className="input w-full pl-10 pr-10"
                placeholder="Create a password"
                required
                autoComplete="new-password"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium mb-2">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                data-testid="register-confirm-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                className="input w-full pl-10 pr-10"
                placeholder="Confirm your password"
                required
                autoComplete="new-password"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Referral Code */}
          <div>
            <label className="block text-sm font-medium mb-2">Referral Code (Optional)</label>
            <div className="relative">
              <input
                type="text"
                name="referralCode"
                data-testid="register-referral"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="input w-full pl-10"
                placeholder="Enter referral code"
                autoComplete="off"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v13m0-13V6a4 4 0 00-4-4 4 4 0 004 4zm0 0V6a4 4 0 014-4 4 4 0 01-4 4zm-8 4h16M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
            </div>
          </div>

          {/* Age Verification Checkbox */}
          <div className="flex items-center justify-between">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAgeVerified}
                onChange={(e) => setIsAgeVerified(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-card-border bg-card text-accent-primary focus:ring-primary"
                required
              />
              <span className="text-sm text-text-secondary leading-tight">
                I confirm I am 18+ and agree to the{' '}
                <a href="/terms" className="text-accent-primary hover:underline">Terms</a> and{' '}
                <a href="/privacy" className="text-accent-primary hover:underline">Privacy Policy</a>.
              </span>
            </label>
          </div>

          {/* Submit Button - matches LoginModal */}
          <button
            type="submit"
            data-testid="register-submit"
            disabled={isLoading}
            className="btn-primary w-full py-3 text-lg font-semibold disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Login Link - matches LoginModal style */}
        <p className="text-center mt-6 text-text-secondary">
          Already have an account?{' '}
          <button
            onClick={switchToLogin}
            className="text-accent-primary hover:underline font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </Modal>
  );
};

export default RegisterModal;
