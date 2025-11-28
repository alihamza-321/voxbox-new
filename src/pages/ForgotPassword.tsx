import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BackgroundTech from "@/components/BackgroundTech";
import { AuthService } from "@/lib/auth";

interface FieldErrors {
  email?: string;
}

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);

  const validateEmail = (email: string): string | undefined => {
    if (!email) {
      return "Email is required";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    return undefined;
  };

  const validateField = (value: string) => {
    const error = validateEmail(value);
    setFieldErrors({ email: error });
    return error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTouched(true);

    // Validate email
    const emailError = validateEmail(email);
    setFieldErrors({ email: emailError });

    if (emailError) {
      return;
    }

    setIsLoading(true);

    try {
      await AuthService.forgotPassword(email);
      setSuccess(true);
    } catch (error: any) {
      console.error("Forgot password error:", error);
      setError(error.message || "Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    // Validate field on change if it has been touched
    if (touched) {
      validateField(value);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    validateField(e.target.value);
  };

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

  if (success) {
    return (
      <div className="w-screen h-screen relative overflow-hidden font-sans text-slate-200">
        <BackgroundTech />
        <div className="relative z-10 w-full h-full flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 md:p-10 shadow-2xl shadow-black/60 text-center">
            <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <svg
                className="w-10 h-10 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
            <p className="text-slate-300 mb-6 text-sm leading-relaxed">
              We've sent a password reset link to <strong className="text-cyan-400">{email}</strong>.
              Please check your inbox and follow the instructions to reset your password.
            </p>
            <p className="text-sm text-slate-400 mb-6">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setSuccess(false)}
                className="w-full py-3 bg-slate-800/50 border border-slate-700 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Try Another Email
              </button>
              <Link
                to="/login"
                className="block w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgba(6,182,212,0.39)] transition-all text-center"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative overflow-hidden font-sans text-slate-200">
      <BackgroundTech />
      <div className="relative z-10 w-full h-full flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 md:p-10 shadow-2xl shadow-black/60">
          <div className="text-center mb-8">
            <div className="inline-block px-5 py-3 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.2)] mb-4">
              Reset Password
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Forgot Password?</h2>
            <p className="text-slate-400 text-sm">
              No worries! Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300 ml-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={handleInputChange}
                onBlur={handleBlur}
                className={inputClasses(!!fieldErrors.email && touched)}
              />
              {fieldErrors.email && touched && (
                <p className="text-red-400 text-xs ml-1">{fieldErrors.email}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(6,182,212,0.39)] transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
