import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  AtSign,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  Check,
  CheckCircle,
} from "lucide-react";
import AuthBackgroundTech from "@/components/AuthBackgroundTech";
import authBgImage from "@/assets/auth-bg.png";

// ==========================================
// REUSABLE AUTH CARD COMPONENT
// ==========================================
interface AuthCardProps {
  children: React.ReactNode;
  minHeight?: string;
}

const AuthCard: React.FC<AuthCardProps> = ({
  children,
  minHeight = "750px",
}) => {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 font-sans perspective-container z-10">
      <div
        className={`
          relative w-full max-w-6xl bg-white rounded-3xl 
          shadow-2xl
          flex overflow-hidden border border-white/5
          transition-all duration-700 ease-in-out transform-style-3d
        `}
        style={{ minHeight: minHeight }}
      >
        {/* --- LEFT SIDE: BRANDING (Static) --- */}
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

        {/* --- RIGHT SIDE: CONTENT (Animated) --- */}
        <div className="w-full md:w-1/2 bg-white p-8 md:p-12 flex flex-col justify-center h-full overflow-y-auto animate-slow-entry">
          {children}
        </div>

        <style>{`
          .perspective-container { perspective: 1500px; }
          .transform-style-3d { transform-style: preserve-3d; }
          
          @keyframes slowSlideUp {
            0% { opacity: 0; transform: translateY(80px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          
          .animate-slow-entry {
            animation: slowSlideUp 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }

          /* Popup Animation */
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
// VALIDATION ITEM COMPONENT
// ==========================================
const ValidationItem = ({ met, label }: { met: boolean; label: string }) => (
  <div
    className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
      met ? "text-green-600 font-medium" : "text-gray-400"
    }`}
  >
    {met ? (
      <Check size={12} strokeWidth={3} />
    ) : (
      <div className="w-3 h-3 rounded-full bg-gray-200" />
    )}
    <span>{label}</span>
  </div>
);

// ==========================================
// MAIN REGISTER COMPONENT
// ==========================================
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
  const [error, setError] = useState("");

  // --- UI State ---
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // --- Password Criteria ---
  const criteria = {
    length: formData.password.length >= 8,
    upper: /[A-Z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password),
  };

  // --- Validation Functions ---
  const validateFullName = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) {
      return "Full name is required.";
    }
    if (trimmed.length < 2) {
      return "Full name must be at least 2 characters.";
    }
    if (trimmed.length > 50) {
      return "Full name must be less than 50 characters.";
    }
    // Check for valid name format (letters, spaces, hyphens, apostrophes)
    if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) {
      return "Full name can only contain letters, spaces, hyphens, and apostrophes.";
    }
    // Check for consecutive spaces
    if (/\s{2,}/.test(trimmed)) {
      return "Full name cannot contain consecutive spaces.";
    }
    return "";
  };

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

  const validatePassword = (password: string): string => {
    if (!password) {
      return "Password is required.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    return "";
  };

  const validateConfirmPassword = (confirmPassword: string, password: string): string => {
    if (!confirmPassword) {
      return "Please confirm your password.";
    }
    if (confirmPassword !== password) {
      return "Passwords do not match.";
    }
    return "";
  };

  // --- Real-time Validation ---
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (touched.fullName) {
      const error = validateFullName(formData.fullName);
      if (error) newErrors.fullName = error;
    }

    if (touched.email) {
      const error = validateEmail(formData.email);
      if (error) newErrors.email = error;
    }

    if (touched.password) {
      const error = validatePassword(formData.password);
      if (error) newErrors.password = error;
    }

    if (touched.confirmPassword) {
      const error = validateConfirmPassword(formData.confirmPassword, formData.password);
      if (error) newErrors.confirmPassword = error;
    }

    setErrors(newErrors);
  }, [formData, touched]);

  // --- Handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Real-time validation for touched fields
    if (touched[name]) {
      const newErrors = { ...errors };
      if (name === "fullName") {
        newErrors.fullName = validateFullName(value);
      } else if (name === "email") {
        newErrors.email = validateEmail(value);
      } else if (name === "password") {
        newErrors.password = validatePassword(value);
        // Also validate confirm password if it's been touched
        if (touched.confirmPassword) {
          newErrors.confirmPassword = validateConfirmPassword(formData.confirmPassword, value);
        }
      } else if (name === "confirmPassword") {
        newErrors.confirmPassword = validateConfirmPassword(value, formData.password);
      }
      setErrors(newErrors);
    } else {
      // Clear error when user starts typing
      if (errors[name]) {
        setErrors({ ...errors, [name]: "" });
      }
    }
  };

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
    
    // Validate on blur
    const newErrors = { ...errors };
    if (field === "fullName") {
      newErrors.fullName = validateFullName(formData.fullName);
    } else if (field === "email") {
      newErrors.email = validateEmail(formData.email);
    } else if (field === "password") {
      newErrors.password = validatePassword(formData.password);
      // Also validate confirm password if it's been touched
      if (touched.confirmPassword) {
        newErrors.confirmPassword = validateConfirmPassword(formData.confirmPassword, formData.password);
      }
    } else if (field === "confirmPassword") {
      newErrors.confirmPassword = validateConfirmPassword(formData.confirmPassword, formData.password);
    }
    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Mark all as touched
    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    // Validate all fields
    const newErrors: Record<string, string> = {};
    const fullNameError = validateFullName(formData.fullName);
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validateConfirmPassword(formData.confirmPassword, formData.password);
    
    if (fullNameError) newErrors.fullName = fullNameError;
    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;
    if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError;

    setErrors(newErrors);

    // Check terms checkbox
    const termsCheckbox = document.getElementById("terms") as HTMLInputElement;
    if (!termsCheckbox?.checked) {
      setError("You must agree to the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    // Check password criteria
    const isPasswordValid = Object.values(criteria).every(Boolean);
    if (!isPasswordValid) {
      setError("Password does not meet all requirements. Please check the criteria below.");
      return;
    }

    // Check if there are any validation errors
    if (Object.keys(newErrors).length > 0) {
      return; // Stop if there are validation errors
    }

    // All validations passed
    if (isPasswordValid && Object.keys(newErrors).length === 0) {
      try {
        await register({
          name: formData.fullName.trim(),
          email: formData.email,
          password: formData.password,
        });

        // Mark as new user for payment flow
        localStorage.setItem("isNewUser", "true");

        // Show success popup
        setShowSuccessPopup(true);
      } catch (error: any) {
        setError(error.message || "Registration failed. Please try again.");
      }
    }
  };

  const handleGetStarted = () => {
    setShowSuccessPopup(false);
    navigate("/login");
  };

  const inputContainerClass = "relative group";
  const iconClass =
    "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors";
  const inputClass = (hasError: boolean) => `
    w-full pl-10 pr-10 py-3 rounded-xl border bg-gray-50 text-gray-900 placeholder-gray-400 
    focus:outline-none focus:ring-2 focus:bg-white transition-all duration-200
    ${
      hasError
        ? "border-red-500 focus:ring-red-200"
        : "border-gray-200 focus:ring-black"
    }
  `;

  return (
    <div className="relative min-h-screen w-full">
      <AuthBackgroundTech />
      <AuthCard minHeight="750px">
        <div className="mb-6 text-center md:text-left">
          <h3 className="text-2xl flex justify-center font-bold text-gray-900 mb-2">
            Sign Up
          </h3>
          <p className="text-sm flex justify-center text-black">
            Get started and create your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">
              Full Name
            </label>
            <div className={inputContainerClass}>
              <div className={iconClass}>
                <User size={18} />
              </div>
              <input
                type="text"
                name="fullName"
                autoComplete="off"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={handleChange}
                onBlur={() => handleBlur("fullName")}
                className={inputClass(!!errors.fullName)}
              />
            </div>
            {errors.fullName && (
              <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">
              Email Address
            </label>
            <div className={inputContainerClass}>
              <div className={iconClass}>
                <AtSign size={18} />
              </div>
              <input
                type="email"
                name="email"
                autoComplete="off"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={() => handleBlur("email")}
                className={inputClass(!!errors.email)}
              />
            </div>
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">
              Password
            </label>
            <div className={inputContainerClass}>
              <div className={iconClass}>
                <Lock size={18} />
              </div>
              <input
                type={showPass ? "text" : "password"}
                name="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                onBlur={() => handleBlur("password")}
                className={inputClass(false)}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
              >
                {showPass ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
            {formData.password.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <ValidationItem met={criteria.length} label="8+ Characters" />
                <ValidationItem met={criteria.upper} label="Uppercase" />
                <ValidationItem met={criteria.number} label="Number" />
                <ValidationItem met={criteria.special} label="Symbol" />
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">
              Confirm Password
            </label>
            <div className={inputContainerClass}>
              <div className={iconClass}>
                <Lock size={18} />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={() => handleBlur("confirmPassword")}
                className={inputClass(!!errors.confirmPassword)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
              >
                {showConfirm ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Terms */}
          <div className="flex items-start gap-2 pt-2">
            <input
              type="checkbox"
              id="terms"
              className="mt-1 rounded border-gray-300 text-black focus:ring-black"
            />
            <label htmlFor="terms" className="text-xs text-black">
              I agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-black hover:underline"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-black hover:underline"
              >
                Privacy Policy
              </a>
              .
            </label>
          </div>

          {/* Create Account Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 group shadow-lg shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating Account..." : "Create Account"}
            {!isLoading && (
              <ArrowRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
            )}
          </button>
        </form>

        {/* Footer / Switch to Sign In */}
        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <p className="text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-black hover:underline">
              Sign In
            </Link>
          </p>
        </div>

        {/* SUCCESS POPUP */}
        {showSuccessPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center justify-center animate-popup max-w-sm w-full mx-4 text-center border border-gray-100">
              {/* Success Icon */}
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-5 text-green-600">
                <CheckCircle size={32} strokeWidth={3} />
              </div>

              {/* Success Message */}
              <h2 className="text-2xl font-bold mb-2 text-gray-900">
                Success!
              </h2>
              <p className="text-gray-500 mb-8">
                Account has been created successfully.
              </p>

              {/* Get Started Button */}
              <button
                onClick={handleGetStarted}
                className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-all transform active:scale-[0.98] shadow-lg shadow-black/20 flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </AuthCard>
    </div>
  );
};

export default Register;
