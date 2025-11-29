import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import BackgroundTech from "@/components/BackgroundTech";
import { useAuth } from "@/contexts/AuthContext";
import { AuthService } from "@/lib/auth";
import { WorkspaceService } from "@/lib/workspace";

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

const BackArrowIcon = () => (
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
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
);

// --- Custom Internal Confetti Component ---
const PartyConfetti = () => {
  const particles = Array.from({ length: 150 }).map((_, i) => {
    const colors = [
      "#22d3ee",
      "#3b82f6",
      "#a855f7",
      "#f472b6",
      "#ffffff",
      "#fbbf24",
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const angle = Math.random() * 360 * (Math.PI / 180);
    const velocity = Math.random() * 150 + 50;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity - Math.random() * 50;
    const size = Math.random() * 6 + 4;
    const animDuration = Math.random() * 0.8 + 0.6;

    return (
      <div
        key={i}
        className="absolute rounded-sm opacity-0"
        style={{
          top: "40%",
          left: "50%",
          width: `${size}px`,
          height: `${size * 0.6}px`,
          backgroundColor: randomColor,
          // @ts-ignore
          "--tx": `${tx}px`,
          "--ty": `${ty}px`,
          "--rot": `${Math.random() * 720}deg`,
          animation: `blast ${animDuration}s cubic-bezier(0.2, 0.9, 0.3, 1) forwards`,
        }}
      />
    );
  });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <style>{`
        @keyframes blast {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
          60% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty) + 100px)) rotate(var(--rot)) scale(1); }
        }
      `}</style>
      {particles}
    </div>
  );
};

// --- Sub-Component: Success Modal ---
const SuccessModal = ({
  onClose,
  title,
  message,
}: {
  onClose: () => void;
  title: string;
  message: string;
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <style>{`
        @keyframes zoomIn {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-zoom-in {
          animation: zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      ></div>
      <div className="relative z-20 w-full max-w-md bg-[#0f172a] border border-cyan-500/50 rounded-3xl p-8 text-center shadow-[0_0_60px_rgba(6,182,212,0.5)] overflow-hidden animate-zoom-in">
        <PartyConfetti />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-40 bg-cyan-500/10 blur-[80px] pointer-events-none z-0"></div>
        <div className="relative z-10">
          <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/40">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>
          <h2 className="text-3xl font-black text-white mb-3 tracking-tight drop-shadow-2xl">
            {title}
          </h2>
          <p className="text-slate-300 mb-8 text-sm leading-relaxed px-4 font-medium">
            {message}
          </p>
          <button
            onClick={onClose}
            className="w-full py-4 rounded-xl font-bold text-[#0f172a] text-lg bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-white hover:to-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Types ---
type ViewState = "login" | "forgot-step-1" | "forgot-step-2";

// --- Main Component ---
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();

  // View State to toggle between forms
  const [view, setView] = useState<ViewState>("login");

  // --- Login State ---
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPass, setShowPass] = useState(false);

  // --- Forgot Password State ---
  const [resetData, setResetData] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // --- Modals ---
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", message: "" });

  // --- Helper: Input Class ---
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

  // --- Handlers: Login ---
  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear error on type
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email format.";
    if (!formData.password) newErrors.password = "Password is required.";

    setErrors(newErrors);
    setTouched({ email: true, password: true });

    if (Object.keys(newErrors).length === 0) {
      try {
        await login(formData);
        
        // Get the current user after login
        const currentUser = AuthService.getCurrentUser();
        if (!currentUser) {
          setErrors({ email: "Login successful but user data not found. Please try again." });
          return;
        }
        
        // Check subscription and workspace status to determine redirect
        try {
          const { PaymentService } = await import('@/lib/payment');
          const subscription = await PaymentService.getUserSubscription(currentUser.id);
          
          if (subscription && subscription.hasSubscription) {
            // User has subscription - check if they have workspaces
            try {
              const workspaces = await WorkspaceService.getWorkspaces();
              
              if (workspaces && workspaces.length > 0) {
                // User has subscription AND workspace → redirect to dashboard
                const redirectPath = sessionStorage.getItem('redirectAfterLogin');
                if (redirectPath) {
                  sessionStorage.removeItem('redirectAfterLogin');
                  sessionStorage.removeItem('forceDashboardRedirect');
                  navigate(redirectPath, { replace: true });
                } else {
                  navigate('/dashboard', { replace: true });
                }
              } else {
                // User has subscription but no workspace → redirect to pricing
                sessionStorage.removeItem('redirectAfterLogin');
                sessionStorage.removeItem('forceDashboardRedirect');
                navigate('/pricing', { replace: true });
              }
            } catch (workspaceError) {
              console.error('Error checking workspaces:', workspaceError);
              sessionStorage.removeItem('redirectAfterLogin');
              sessionStorage.removeItem('forceDashboardRedirect');
              navigate('/pricing', { replace: true });
            }
          } else {
            // User has no subscription → always redirect to pricing
            sessionStorage.removeItem('redirectAfterLogin');
            sessionStorage.removeItem('forceDashboardRedirect');
            navigate('/pricing', { replace: true });
          }
        } catch (subscriptionError) {
          console.error('Error checking subscription:', subscriptionError);
          // Fallback: Check workspaces as proxy for subscription
          try {
            const workspaces = await WorkspaceService.getWorkspaces();
            if (workspaces && workspaces.length > 0) {
              const redirectPath = sessionStorage.getItem('redirectAfterLogin');
              if (redirectPath) {
                sessionStorage.removeItem('redirectAfterLogin');
                sessionStorage.removeItem('forceDashboardRedirect');
                navigate(redirectPath, { replace: true });
              } else {
                navigate('/dashboard', { replace: true });
              }
            } else {
              sessionStorage.removeItem('redirectAfterLogin');
              sessionStorage.removeItem('forceDashboardRedirect');
              navigate('/pricing', { replace: true });
            }
          } catch (workspaceError) {
            console.error('Error checking workspaces (fallback):', workspaceError);
            sessionStorage.removeItem('redirectAfterLogin');
            sessionStorage.removeItem('forceDashboardRedirect');
            navigate('/pricing', { replace: true });
          }
        }
      } catch (error: any) {
        console.error('Login error:', error);
        setErrors({ email: error.message || 'Login failed. Please try again.' });
      }
    }
  };

  // --- Handlers: Forgot Password ---
  const handleResetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResetData({ ...resetData, [e.target.name]: e.target.value });
    if (resetErrors[e.target.name])
      setResetErrors({ ...resetErrors, [e.target.name]: "" });
  };

  const handleForgotStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!resetData.email) newErrors.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetData.email))
      newErrors.email = "Invalid email format.";

    if (Object.keys(newErrors).length > 0) {
      setResetErrors(newErrors);
    } else {
      try {
        const { AuthService } = await import('@/lib/auth');
        await AuthService.forgotPassword(resetData.email);
        setResetErrors({});
        setView("forgot-step-2");
      } catch (error: any) {
        setResetErrors({ email: error.message || "Failed to send reset email. Please try again." });
      }
    }
  };

  const handleForgotStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!resetData.newPassword)
      newErrors.newPassword = "New Password is required.";
    else if (resetData.newPassword.length < 6)
      newErrors.newPassword = "Password must be at least 6 characters.";

    if (!resetData.confirmPassword)
      newErrors.confirmPassword = "Confirm Password is required.";
    else if (resetData.newPassword !== resetData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match.";

    if (Object.keys(newErrors).length > 0) {
      setResetErrors(newErrors);
    } else {
      // Note: This would typically require a token from the email link
      // For now, we'll show a message that they need to use the email link
      setModalContent({
        title: "Password Reset!",
        message:
          "Please check your email for the password reset link. Use that link to complete the password reset.",
      });
      setShowSuccessModal(true);
    }
  };

  const handleModalClose = () => {
    setShowSuccessModal(false);
    if (view === "forgot-step-2") {
      setView("login");
      setFormData({ email: "", password: "" });
      setResetData({ email: "", newPassword: "", confirmPassword: "" });
    }
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden font-sans text-slate-200">
      <BackgroundTech />

      <div className="relative z-10 w-full h-full flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* --- LEFT COLUMN: BRANDING --- */}
          <div
            className={`flex flex-col justify-center items-center lg:items-start text-center lg:text-left space-y-6 transition-all duration-500 ${
              showSuccessModal ? "opacity-0 blur-sm" : "opacity-100"
            }`}
          >
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.4)] transform rotate-3 hover:rotate-6 transition-transform duration-500 flex-shrink-0">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
              </div>
              <h1 className="text-transparent text-6xl font-bold bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 uppercase">
                VoxBox
              </h1>
            </div>
          </div>

          {/* --- RIGHT COLUMN: DYNAMIC FORM CARD --- */}
          <div className="flex justify-center lg:justify-end">
            <div
              className={`w-full max-w-[480px] bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 md:p-10 shadow-2xl shadow-black/60 transition-all duration-500 transform ${
                showSuccessModal
                  ? "scale-90 opacity-0 pointer-events-none"
                  : "scale-100 opacity-100"
              }`}
            >
              {/* --- HEADER --- */}
              <div className="mb-8 text-center relative">
                {view !== "login" && (
                  <button
                    onClick={() => {
                      // If on step 2, go back to step 1, else go to login
                      if (view === "forgot-step-2") setView("forgot-step-1");
                      else setView("login");
                    }}
                    className="absolute left-0 top-1 text-slate-400 hover:text-white transition-colors"
                    title="Go Back"
                  >
                    <BackArrowIcon />
                  </button>
                )}
                <div className="inline-block px-5 py-3 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                  {view === "login" && "Sign In"}
                  {view === "forgot-step-1" && "Reset Password"}
                  {view === "forgot-step-2" && "New Password"}
                </div>
              </div>

              {/* --- VIEW 1: LOGIN FORM --- */}
              {view === "login" && (
                <form onSubmit={handleLoginSubmit} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-300 ml-1">
                      Email Address
                    </label>
                    <input
                      name="email"
                      type="email"
                      placeholder="name@company.com"
                      value={formData.email}
                      onChange={handleLoginChange}
                      className={inputClasses(!!errors.email)}
                    />
                    {errors.email && (
                      <p className="text-red-400 text-xs ml-1">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-300 ml-1">
                      Password
                    </label>
                    <div className="relative group">
                      <input
                        name="password"
                        type={showPass ? "text" : "password"}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleLoginChange}
                        className={inputClasses(!!errors.password) + " pr-12"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                      >
                        {showPass ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-red-400 text-xs ml-1">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="peer appearance-none w-4 h-4 rounded border border-slate-600 bg-slate-800/50 checked:bg-cyan-500 checked:border-cyan-500 focus:ring-1 focus:ring-cyan-400 transition-all cursor-pointer"
                        />
                        <svg
                          className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 top-0.5 left-0.5 transition-opacity"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <span className="text-sm text-white group-hover:text-slate-300 transition-colors select-none">
                        Remember me
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setView("forgot-step-1")}
                      className="text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(6,182,212,0.39)] transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </button>

                  <div className="mt-8 text-center pt-6 border-t border-slate-700/50">
                    <p className="text-slate-400 text-sm">
                      Don't have an account?{" "}
                      <Link
                        to="/register"
                        className="text-white font-semibold hover:text-cyan-400 transition-colors ml-1 border-b border-transparent hover:border-cyan-400 pb-0.5"
                      >
                        Sign up
                      </Link>
                    </p>
                  </div>
                </form>
              )}

              {/* --- VIEW 2: FORGOT PASSWORD STEP 1 (Email) --- */}
              {view === "forgot-step-1" && (
                <form onSubmit={handleForgotStep1Submit} className="space-y-6">
                  <p className="text-slate-400 text-sm text-center mb-4">
                    Enter your email address to verify your account.
                  </p>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-300 ml-1">
                      Email Address
                    </label>
                    <input
                      name="email"
                      type="email"
                      placeholder="name@company.com"
                      value={resetData.email}
                      onChange={handleResetChange}
                      className={inputClasses(!!resetErrors.email)}
                    />
                    {resetErrors.email && (
                      <p className="text-red-400 text-xs ml-1">
                        {resetErrors.email}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(6,182,212,0.39)] transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    Verify Email
                  </button>

                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className="w-full mt-2 text-slate-400 hover:text-white text-sm py-2 transition-colors"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}

              {/* --- VIEW 3: FORGOT PASSWORD STEP 2 (New Password) --- */}
              {view === "forgot-step-2" && (
                <form onSubmit={handleForgotStep2Submit} className="space-y-6">
                  <p className="text-slate-400 text-sm text-center mb-4">
                    Create a new secure password for{" "}
                    <strong>{resetData.email}</strong>.
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-300 ml-1">
                      New Password
                    </label>
                    <div className="relative group">
                      <input
                        name="newPassword"
                        type={showNewPass ? "text" : "password"}
                        placeholder="New password"
                        value={resetData.newPassword}
                        onChange={handleResetChange}
                        className={
                          inputClasses(!!resetErrors.newPassword) + " pr-12"
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                      >
                        {showNewPass ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                    </div>
                    {resetErrors.newPassword && (
                      <p className="text-red-400 text-xs ml-1">
                        {resetErrors.newPassword}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-300 ml-1">
                      Confirm Password
                    </label>
                    <div className="relative group">
                      <input
                        name="confirmPassword"
                        type={showConfirmPass ? "text" : "password"}
                        placeholder="Re-enter password"
                        value={resetData.confirmPassword}
                        onChange={handleResetChange}
                        className={
                          inputClasses(!!resetErrors.confirmPassword) + " pr-12"
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                      >
                        {showConfirmPass ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                    </div>
                    {resetErrors.confirmPassword && (
                      <p className="text-red-400 text-xs ml-1">
                        {resetErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(6,182,212,0.39)] transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    Reset Password
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSuccessModal && (
        <SuccessModal
          onClose={handleModalClose}
          title={modalContent.title}
          message={modalContent.message}
        />
      )}
    </div>
  );
};

export default Login;
