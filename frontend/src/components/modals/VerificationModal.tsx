'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import Modal from '@/components/modals/Modal';
import config from '@/config/api';

const API_URL = config.apiUrl;

const VerificationModal: React.FC = () => {
  const { loginDirect } = useAuth();
  const { isVerificationOpen, closeVerification, verificationEmail, verificationPassword } = useModal();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input when modal opens
  useEffect(() => {
    if (isVerificationOpen) {
      setCode(['', '', '', '', '', '']);
      setError(null);
      setResendMessage(null);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isVerificationOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    const fullCode = newCode.join('');
    if (fullCode.length === 6) {
      handleVerify(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < pasted.length; i++) {
        newCode[i] = pasted[i];
      }
      setCode(newCode);
      if (pasted.length === 6) {
        handleVerify(pasted);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    }
  };

  const handleVerify = async (verifyCode?: string) => {
    const codeStr = verifyCode || code.join('');
    if (codeStr.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Verify the email code
      const verifyResponse = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, code: codeStr }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.message || 'Invalid verification code');
      }

      // Step 2: Auto-login after successful verification
      if (verificationPassword) {
        await loginDirect(verificationEmail, verificationPassword);
      }

      closeVerification();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setCode(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    try {
      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend code');
      }

      setResendMessage('A new code has been sent to your email');
      setResendCooldown(60);
      setCode(['', '', '', '', '', '']);
      setError(null);
      setTimeout(() => {
        setResendMessage(null);
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    }
  };

  const handleClose = () => {
    setCode(['', '', '', '', '', '']);
    setError(null);
    setResendMessage(null);
    closeVerification();
  };

  return (
    <Modal isOpen={isVerificationOpen} onClose={handleClose}>
      <div className="p-8">
        {/* Header - matches LoginModal exactly */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent-primary flex items-center justify-center shadow-glow mx-auto mb-3">
            {/* Mail check icon */}
            <svg className="w-6 h-6 text-text-inverse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Verify Your Email</h2>
          <p className="text-text-secondary mt-1">
            We sent a 6-digit code to
          </p>
          <p className="text-accent-primary font-medium mt-1">{verificationEmail}</p>
        </div>

        {/* Form area */}
        <div className="space-y-5">
          {/* Error Message - matches LoginModal */}
          {error && (
            <div className="p-3 bg-danger-muted border border-danger-primary/30 rounded-lg text-danger-primary text-sm animate-shake">
              {error}
            </div>
          )}

          {/* Success Message */}
          {resendMessage && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
              {resendMessage}
            </div>
          )}

          {/* 6-Digit Code Input */}
          <div>
            <label className="block text-sm font-medium mb-3 text-center">Enter verification code</label>
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="input w-12 h-14 text-center text-xl font-bold"
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>

          {/* Verify Button - matches LoginModal btn-primary */}
          <button
            onClick={() => handleVerify()}
            disabled={isLoading || code.join('').length !== 6}
            className="btn-primary w-full py-3 text-lg font-semibold disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </span>
            ) : (
              'Verify Email'
            )}
          </button>

          {/* Resend Code */}
          <p className="text-center text-text-secondary text-sm">
            {"Didn't receive the code? "}
            {resendCooldown > 0 ? (
              <span className="text-text-tertiary">
                Resend in {resendCooldown}s
              </span>
            ) : (
              <button
                onClick={handleResend}
                className="text-accent-primary hover:underline font-medium"
              >
                Resend Code
              </button>
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default VerificationModal;
