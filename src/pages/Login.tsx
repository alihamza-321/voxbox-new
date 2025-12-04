import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthService } from "@/lib/auth";
import { WorkspaceService } from "@/lib/workspace";
import { AtSign, Eye, EyeOff, Lock, ArrowRight, CheckCircle } from "lucide-react";
import AuthBackgroundTech from "@/components/AuthBackgroundTech";
import authBgImage from "@/assets/auth-bg.png";

// ==========================================
// REUSABLE AUTH CARD COMPONENT
// ==========================================
interface AuthCardProps {
  children: React.ReactNode;
  height?: string;
}

const AuthCard = ({ children, height = "min-h-[600px]" }: AuthCardProps) => {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 font-sans perspective-container z-10">
      <div
        className={`
          relative w-full max-w-6xl bg-white rounded-3xl 
          shadow-2xl
          flex overflow-hidden border border-white/5
          ${height}
          transform-style-3d backface-hidden
        `}
      >
        {/* Left Side (Black - Static) */}
        <div className="hidden md:flex w-1/2 bg-black text-white relative flex-col justify-center p-12">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle, #333 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          ></div>

          <div className="relative z-10">
            <div className="flex justify-center items-center gap-3 mb-4">
              <div className="overflow-hidden border border-gray-800 shadow-2xl rounded-3xl">
                <img
                  src={authBgImage}
                  alt="VoxBox"
                  className="w-full h-[200px] object-cover"
                />
              </div>
              <span className="text-4xl font-bold tracking-wider">VOXBOX</span>
            </div>
          </div>
        </div>

        {/* Right Side (White/Form) */}
        <div className="w-full md:w-1/2 bg-white p-8 md:p-12 flex items-center justify-center animate-slow-entry">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <style>{`
          .perspective-container { perspective: 1500px; }
          .transform-style-3d { transform-style: preserve-3d; }
          .backface-hidden { backface-visibility: hidden; }
          
          @keyframes slowSlideUp {
            0% { opacity: 0; transform: translateY(80px); }
            100% { opacity: 1; transform: translateY(0); }
          }

          .animate-slow-entry {
            animation: slowSlideUp 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }

          @keyframes popupScale {
            0% { transform: scale(0.9); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-popup {
            animation: popupScale 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
      </div>
    </div>
  );
};

// ==========================================
// SUCCESS POPUP COMPONENT
// ==========================================
const SuccessPopup = ({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center justify-center animate-popup max-w-sm w-full mx-4 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-gray-900">{title}</h2>
        <p className="text-gray-500 mb-2">{message}</p>
        <button
          onClick={onClose}
          className="mt-4 w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-all"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

// ==========================================
// MAIN LOGIN COMPONENT
// ==========================================
type ViewState = "login" | "forgot-step-1" | "forgot-step-2";

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

  // --- Validation Functions ---
  const validateEmail = (email: string): string => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return "Email address is required.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return "Please enter a valid email address.";
    }
    // Check for common typos
    if (trimmedEmail.includes("..")) {
      return "Email address cannot contain consecutive dots.";
    }
    if (trimmedEmail.startsWith(".") || trimmedEmail.endsWith(".")) {
      return "Email address cannot start or end with a dot.";
    }
    // Check for valid domain
    const domain = trimmedEmail.split("@")[1];
    if (domain && (!domain.includes(".") || domain.startsWith(".") || domain.endsWith("."))) {
      return "Please enter a valid email domain.";
    }
    return "";
  };

  const validatePassword = (password: string, isSubmit: boolean = false): string => {
    if (!password || password.trim() === "") {
      return isSubmit ? "Password is required." : "";
    }
    if (password.length < 6) {
      return "Password must be at least 6 characters long.";
    }
    // Check for whitespace-only passwords
    if (password.trim().length === 0) {
      return "Password cannot be only spaces.";
    }
    return "";
  };

  // --- Handlers: Login ---
  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Real-time validation
    if (touched[name]) {
      const newErrors = { ...errors };
      if (name === "email") {
        const emailError = validateEmail(value);
        newErrors.email = emailError;
      } else if (name === "password") {
        const passwordError = validatePassword(value);
        newErrors.password = passwordError;
      }
      setErrors(newErrors);
    } else {
      // Clear error when user starts typing
      if (errors[name]) {
        setErrors({ ...errors, [name]: "" });
      }
    }
  };

  const handleLoginBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
    
    // Validate on blur (not submit, so don't require password if empty)
    const newErrors = { ...errors };
    if (field === "email") {
      newErrors.email = validateEmail(formData.email);
    } else if (field === "password") {
      // On blur, only validate if password is provided
      if (formData.password && formData.password.trim() !== "") {
        newErrors.password = validatePassword(formData.password, false);
      } else {
        // Clear password error on blur if empty (will show on submit)
        newErrors.password = "";
      }
    }
    setErrors(newErrors);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ email: true, password: true });
    
    // Validate all fields
    const newErrors: Record<string, string> = {};
    
    // Validate email
    const emailError = validateEmail(formData.email);
    if (emailError) {
      newErrors.email = emailError;
    }
    
    // Validate password - required on submit
    if (!formData.password || formData.password.trim() === "") {
      newErrors.password = "Password is required.";
    } else {
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        newErrors.password = passwordError;
      }
    }

    setErrors(newErrors);

    // Only proceed if there are no validation errors
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
    <div className="relative min-h-screen w-full">
      <AuthBackgroundTech />
      <AuthCard height="min-h-[750px]">
        <div className="mb-8 text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {view === "login" && "Sign In"}
          {view === "forgot-step-1" && "Reset Password"}
          {view === "forgot-step-2" && "New Password"}
        </h3>
        {view !== "login" && (
          <button
            onClick={() => {
              if (view === "forgot-step-2") setView("forgot-step-1");
              else setView("login");
            }}
            className="text-sm text-gray-500 hover:text-black transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      {/* LOGIN FORM */}
      {view === "login" && (
        <form onSubmit={handleLoginSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">
              Email Address
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
                <AtSign size={18} />
              </div>
              <input
                type="email"
                name="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleLoginChange}
                onBlur={() => handleLoginBlur("email")}
                autoComplete="email"
                className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all duration-200 ${
                  errors.email ? "border-red-500 focus:ring-red-200" : "border-gray-200"
                }`}
              />
            </div>
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700 block">
                Password
              </label>
              <button
                type="button"
                onClick={() => setView("forgot-step-1")}
                className="text-sm font-bold text-black hover:underline"
              >
                Forget Password
              </button>
            </div>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
                <Lock size={18} />
              </div>
              <input
                type={showPass ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleLoginChange}
                onBlur={() => handleLoginBlur("password")}
                autoComplete="current-password"
                className={`w-full pl-10 pr-12 py-3 rounded-xl border bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all duration-200 ${
                  errors.password ? "border-red-500 focus:ring-red-200" : "border-gray-200"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors cursor-pointer"
              >
                {showPass ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
              />
              <span className="text-sm text-gray-700">Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 group shadow-lg shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing In..." : "Sign In"}
            {!isLoading && (
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            )}
          </button>
        </form>
      )}

      {/* FORGOT PASSWORD STEP 1 */}
      {view === "forgot-step-1" && (
        <form onSubmit={handleForgotStep1Submit} className="space-y-6">
          <p className="text-gray-600 text-sm text-center mb-4">
            Enter your email address to verify your account.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">
              Email Address
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
                <AtSign size={18} />
              </div>
              <input
                type="email"
                name="email"
                placeholder="name@company.com"
                value={resetData.email}
                onChange={handleResetChange}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all duration-200 ${
                  resetErrors.email ? "border-red-500" : "border-gray-200"
                }`}
              />
            </div>
            {resetErrors.email && (
              <p className="text-red-500 text-xs mt-1">{resetErrors.email}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 group shadow-lg shadow-black/20"
          >
            Verify Email
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      )}

      {/* FORGOT PASSWORD STEP 2 */}
      {view === "forgot-step-2" && (
        <form onSubmit={handleForgotStep2Submit} className="space-y-6">
          <p className="text-gray-600 text-sm text-center mb-4">
            Create a new secure password for <strong>{resetData.email}</strong>.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">
              New Password
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
                <Lock size={18} />
              </div>
              <input
                type={showNewPass ? "text" : "password"}
                name="newPassword"
                placeholder="New password"
                value={resetData.newPassword}
                onChange={handleResetChange}
                className={`w-full pl-10 pr-12 py-3 rounded-xl border bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all duration-200 ${
                  resetErrors.newPassword ? "border-red-500" : "border-gray-200"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
              >
                {showNewPass ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            {resetErrors.newPassword && (
              <p className="text-red-500 text-xs mt-1">{resetErrors.newPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">
              Confirm Password
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
                <Lock size={18} />
              </div>
              <input
                type={showConfirmPass ? "text" : "password"}
                name="confirmPassword"
                placeholder="Re-enter password"
                value={resetData.confirmPassword}
                onChange={handleResetChange}
                className={`w-full pl-10 pr-12 py-3 rounded-xl border bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all duration-200 ${
                  resetErrors.confirmPassword ? "border-red-500" : "border-gray-200"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
              >
                {showConfirmPass ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            {resetErrors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{resetErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 group shadow-lg shadow-black/20"
          >
            Reset Password
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      )}

      {/* Footer */}
      {view === "login" && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-bold text-black hover:underline"
            >
              Sign Up
            </Link>
          </p>
        </div>
      )}

        {/* Success Modal */}
        {showSuccessModal && (
          <SuccessPopup
            title={modalContent.title}
            message={modalContent.message}
            onClose={handleModalClose}
          />
        )}
      </AuthCard>
    </div>
  );
};

export default Login;
