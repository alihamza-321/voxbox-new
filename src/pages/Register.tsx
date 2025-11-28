import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BackgroundTech from "@/components/BackgroundTech";
import { useAuth } from "@/contexts/AuthContext";

// --- Icons (Inline SVGs) ---
const EyeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.9 3.23" />
    <path d="M1.05 1.05 22.95 22.95" />
    <path d="M16.97 16.97A10.43 10.43 0 0 1 12 19c-7 0-10-7-10-7a13.16 13.16 0 0 1 3.91-4.91" />
  </svg>
);
const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-emerald-400"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();

  // --- Form State ---
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // --- Validation State ---
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  // --- UI State ---
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // --- Password Criteria ---
  const criteria = {
    length: formData.password.length >= 8,
    upper: /[A-Z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password),
  };

  // --- Real-time Validation ---
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (touched.fullName && !formData.fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }

    if (touched.email) {
      if (!formData.email) newErrors.email = "Email address is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        newErrors.email = "Please enter a valid email address.";
    }

    if (touched.confirmPassword) {
      if (!formData.confirmPassword)
        newErrors.confirmPassword = "Confirmation is required.";
      else if (formData.password !== formData.confirmPassword)
        newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
  }, [formData, touched]);

  // --- Handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    const isPasswordValid = Object.values(criteria).every(Boolean);
    const hasNoErrors = Object.keys(errors).length === 0;
    const isFilled =
      formData.fullName &&
      formData.email &&
      formData.password &&
      formData.confirmPassword;

    if (isPasswordValid && hasNoErrors && isFilled) {
      try {
        await register({
          name: formData.fullName.trim(),
          email: formData.email,
          password: formData.password,
        });
        
        // Mark as new user for payment flow
        localStorage.setItem('isNewUser', 'true');
        
        // Redirect to login page after successful registration
        navigate('/login');
      } catch (error: any) {
        setError(error.message || 'Registration failed. Please try again.');
      }
    }
  };

  // --- SHARED INPUT STYLES ---
  const inputClasses = (hasError: boolean) => `
    w-full bg-slate-800/50 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none 
    transition-all duration-300
    hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:border-cyan-400/50
    focus:shadow-[0_0_20px_rgba(6,182,212,0.4)] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20
    ${
      hasError
        ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
        : "border-slate-600"
    }
  `;

  return (
    <div className="w-screen h-screen relative overflow-hidden font-sans text-slate-200">
      {/* 1. Infinite Moving Circuit Background */}
      <BackgroundTech />

      {/* 2. Content Container */}
      <div className="relative z-10 flex items-center justify-center h-full p-4 overflow-y-auto">
        {/* Glassmorphism Card */}
        <div className="w-full max-w-[500px] bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 md:p-10 shadow-2xl shadow-black/60 transition-all duration-300">
          {/* --- Header Section --- */}
          <div className="text-center mb-8">
            {/* Explicit Label */}
            <div className="inline-block mb-3 px-5 py-3 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              Sign Up
            </div>

            {/* Logo */}
            <h2 className="text-4xl font-black tracking-tighter mb-2 text-white drop-shadow-lg">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 uppercase">
                VoxBox
              </span>
            </h2>

            <h1 className="text-xl md:text-2xl font-bold text-slate-100 mb-2">
              Start Creating New
            </h1>
          </div>

          {/* --- Form Section --- */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* 1. Full Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-slate-300 ml-1"
              >
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={handleChange}
                onBlur={() => handleBlur("fullName")}
                className={inputClasses(!!errors.fullName)}
              />
              {errors.fullName && (
                <p className="text-red-400 text-xs ml-1">{errors.fullName}</p>
              )}
            </div>

            {/* 2. Email Address */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 ml-1"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={() => handleBlur("email")}
                className={inputClasses(!!errors.email)}
              />
              {errors.email && (
                <p className="text-red-400 text-xs ml-1">{errors.email}</p>
              )}
            </div>

            {/* 3. Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300 ml-1"
              >
                Password
              </label>
              <div className="relative group">
                <input
                  id="password"
                  name="password"
                  type={showPass ? "text" : "password"}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => handleBlur("password")}
                  className={inputClasses(false) + " pr-12"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  title={showPass ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  {showPass ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>

              {/* Real-time Ticks */}
              {formData.password.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 pl-1">
                  <ValidationItem met={criteria.length} label="8+ Characters" />
                  <ValidationItem
                    met={criteria.upper}
                    label="Uppercase Letter"
                  />
                  <ValidationItem met={criteria.number} label="Number" />
                  <ValidationItem
                    met={criteria.special}
                    label="Special Character"
                  />
                </div>
              )}
            </div>

            {/* 4. Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-300 ml-1"
              >
                Confirm Password
              </label>
              <div className="relative group">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={() => handleBlur("confirmPassword")}
                  className={inputClasses(!!errors.confirmPassword) + " pr-12"}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  title={showConfirm ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>

              {errors.confirmPassword ? (
                <p className="text-red-400 text-xs ml-1">
                  {errors.confirmPassword}
                </p>
              ) : (
                <p className="text-slate-500 text-xs ml-1"></p>
              )}
            </div>

            {/* Terms */}
            <div className="pt-2">
              <p className="text-xs text-slate-400 leading-relaxed ml-1">
                By creating an account, you agree to our{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(6,182,212,0.39)] transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center pt-6 border-t border-slate-700/50">
            <p className="text-slate-400 text-sm">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-white font-semibold hover:text-cyan-400 transition-colors ml-1 border-b border-transparent hover:border-cyan-400 pb-0.5"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper for Ticks
const ValidationItem = ({ met, label }: { met: boolean; label: string }) => (
  <div
    className={`flex items-center gap-2 text-xs transition-colors duration-300 ${
      met ? "text-emerald-400 font-medium" : "text-slate-500"
    }`}
  >
    <div
      className={`flex items-center justify-center w-4 h-4 rounded-full border ${
        met
          ? "border-emerald-500/50 bg-emerald-500/10"
          : "border-slate-600 bg-slate-800"
      }`}
    >
      {met ? (
        <CheckIcon />
      ) : (
        <span className="w-1 h-1 rounded-full bg-slate-600" />
      )}
    </div>
    <span>{label}</span>
  </div>
);

export default Register;
