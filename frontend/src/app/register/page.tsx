"use client";
import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, isLoading } = useAuth();
  
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Get referral code from URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setFormData(prev => ({ ...prev, referralCode: ref }));
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await register(formData.username, formData.email, formData.password, formData.referralCode);
      // Show success card instead of redirecting
      setRegistrationSuccess(true);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    }
  };

  // Success Card - shown after registration
  if (registrationSuccess) {
    return (
      <div className="card p-8 text-center">
        {/* Sandglass Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-warning-muted flex items-center justify-center">
          <svg className="w-10 h-10 text-warning-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        {/* Title */}
        <h2 className="text-2xl font-bold mb-3 text-text-primary">Registration Successful</h2>
        
        {/* Message */}
        <p className="text-text-secondary mb-6 leading-relaxed">
          Your account has been created successfully.<br />
          <span className="text-warning-primary font-medium">An administrator must approve your request</span><br />
          before you can log in.
        </p>
        
        {/* Info Box */}
        <div className="bg-card-hover border border-card-border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 text-left">
            <svg className="w-6 h-6 text-accent-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-text-secondary">
              You will receive an email notification once your account has been approved.
            </p>
          </div>
        </div>
        
        {/* Back to Login Button */}
        <Link 
          href="/login"
          className="btn-primary w-full py-3 text-lg font-semibold inline-block text-center"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <form onSubmit={handleSubmit} className="space-y-5" data-testid="register-form">
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-danger-muted border border-danger-primary/30 rounded-lg text-danger-primary text-sm">
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
              value={formData.username}
              onChange={handleChange}
              className="input w-full pl-10"
              placeholder="Choose a username"
              required
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
              value={formData.email}
              onChange={handleChange}
              className="input w-full pl-10"
              placeholder="Enter your email"
              required
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input w-full pl-10 pr-10"
              placeholder="Create a password"
              required
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
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
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
                  data-testid="register-confirm-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="input w-full pl-10"
              placeholder="Confirm your password"
              required
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        {/* Referral Code (optional) */}
        <div>
          <label className="block text-sm font-medium mb-2">Referral Code (optional)</label>
          <div className="relative">
            <input
              type="text"
              name="referralCode"
                  data-testid="register-referral"
              value={formData.referralCode}
              onChange={handleChange}
              className="input w-full pl-10"
              placeholder="Enter referral code"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        {/* Terms */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="terms"
            required
            className="mt-1 w-4 h-4 rounded border-card-border bg-card text-accent-primary focus:ring-accent-primary"
          />
          <label htmlFor="terms" className="text-sm text-text-secondary">
            I agree to the{" "}
            <Link href="/terms" className="text-accent-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-accent-primary hover:underline">
              Privacy Policy
            </Link>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
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
            "Create Account"
          )}
        </button>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-main flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent-primary flex items-center justify-center shadow-glow-cyan">
              <span className="text-2xl font-bold text-text-inverse">S</span>
            </div>
            <span className="text-2xl font-bold">StakePro</span>
          </Link>
          <p className="text-text-secondary mt-2">Create your account</p>
        </div>

        {/* Register Form with Suspense */}
        <Suspense fallback={
          <div className="card p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        }>
          <RegisterForm />
        </Suspense>

        {/* Login Link */}
        <p className="text-center mt-6 text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
