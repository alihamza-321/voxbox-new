import { X, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import BackgroundTech from "@/components/BackgroundTech";

const Cancel = () => {
  const navigate = useNavigate();

  return (
    <div className="w-screen h-screen relative overflow-hidden font-sans text-slate-200">
      <BackgroundTech />

      <div className="relative z-10 w-full h-full flex items-center justify-center p-4 lg:p-8 overflow-y-auto">
        <div className="w-full max-w-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 md:p-10 shadow-2xl shadow-black/60 space-y-8">
          {/* Header with Icon */}
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.3)] relative">
              {/* Pulse Effect */}
              <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping"></div>
              <X className="w-12 h-12 text-red-400 stroke-[3] relative z-10" />
            </div>

            <h1 className="text-3xl font-bold text-red-400 mb-4">
              Payment Cancelled
            </h1>

            <p className="text-base text-slate-300 leading-relaxed">
              Your payment was not completed. No charges have been made to your account.
            </p>
          </div>

          {/* Info Message */}
          <div className="bg-red-500/10 border-l-4 border-red-500/50 rounded-lg p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-5 h-5 rounded-full bg-red-500/50 border border-red-500 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-3 h-3 text-red-400 stroke-[2.5]" />
              </div>
              <h3 className="font-bold text-lg text-red-400">
                Payment Not Processed
              </h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your subscription was not activated. You can try again or contact our support team if you're experiencing any issues.
            </p>
          </div>

          {/* Common Reasons */}
          <div className="space-y-4">
            <h3 className="font-bold text-xl text-white">Common Reasons for Cancellation:</h3>
            <div className="space-y-3">
              {[
                "Payment method was declined or expired",
                "Insufficient funds in your account",
                "Payment was cancelled by your bank",
                "Technical issues during payment processing",
              ].map((reason, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30 hover:border-slate-600 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-red-400 mt-2 flex-shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                  <span className="text-slate-300 text-sm">{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 pt-4">
            <button
              onClick={() => navigate("/pricing")}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg py-4 rounded-xl shadow-[0_4px_14px_0_rgba(6,182,212,0.39)] transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Try Again
            </button>

            <button
              onClick={() => navigate("/")}
              className="w-full bg-slate-800/50 border border-slate-700 text-white hover:bg-slate-800 hover:border-slate-600 font-semibold px-8 py-4 rounded-xl transition-all duration-200"
            >
              Back to Home
            </button>
          </div>

          {/* Support Link */}
          <div className="text-center pt-6 border-t border-slate-700/50">
            <p className="text-slate-400 text-sm mb-3">
              Need help? Contact support
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center text-sm">
              <a
                href="mailto:support@voxbox.ai"
                className="text-cyan-400 hover:text-cyan-300 hover:underline font-semibold transition-colors"
              >
                support@voxbox.ai
              </a>
              <span className="hidden sm:block text-slate-600">•</span>
              <Link
                to="/contact"
                className="text-cyan-400 hover:text-cyan-300 hover:underline font-semibold transition-colors"
              >
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cancel;
