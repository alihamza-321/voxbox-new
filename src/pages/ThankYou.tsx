import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import BackgroundTech from "@/components/BackgroundTech";
import { PaymentService } from "@/lib/payment";
import { AuthService } from "@/lib/auth";

const ThankYou = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");
  const [userName, setUserName] = useState("");
  const [planName] = useState("Pro Plan");
  const [isMuted, setIsMuted] = useState(true);

  // Process payment success when component mounts
  useEffect(() => {
    const processPaymentSuccess = async () => {
      if (sessionId) {
        try {
          console.log("ThankYou: Processing payment success for session:", sessionId);
          await PaymentService.handlePaymentSuccess(sessionId);
          console.log("ThankYou: Payment success processed successfully");
        } catch (error) {
          console.error("ThankYou: Error processing payment success:", error);
        }
      }
    };

    processPaymentSuccess();

    // Get user name
    const currentUser = AuthService.getCurrentUser();
    if (currentUser?.name) {
      setUserName(currentUser.name);
    }
  }, [sessionId]);

  // Confetti animation
  useEffect(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const colors = ["#22d3ee", "#3b82f6", "#a855f7", "#f472b6", "#ffffff", "#fbbf24"];

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const confettiInterval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(confettiInterval);
        return;
      }

      const particleCount = 3;

      for (let i = 0; i < particleCount; i++) {
        const confetti = document.createElement("div");
        confetti.className = "confetti";
        confetti.style.left = Math.random() * 100 + "%";
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = randomInRange(2, 4) + "s";
        confetti.style.animationDelay = randomInRange(0, 0.5) + "s";
        document.body.appendChild(confetti);

        setTimeout(() => {
          confetti.remove();
        }, 4000);
      }
    }, 100);

    return () => clearInterval(confettiInterval);
  }, []);

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .confetti {
          position: fixed;
          width: 10px;
          height: 20px;
          top: -10px;
          z-index: 9999;
          animation: confetti-fall linear forwards;
          pointer-events: none;
        }
      `}</style>

      <div className="w-screen h-screen relative overflow-hidden font-sans text-slate-200">
        <BackgroundTech />

        <div className="relative z-10 w-full h-full flex items-center justify-center p-4 lg:p-8 overflow-y-auto">
          <div className="w-full max-w-7xl mx-auto animate-fade-in-up min-h-[80vh] flex flex-col justify-center">
            <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-stretch justify-center">
              {/* --- LEFT COLUMN: WELCOME VIDEO --- */}
              <div className="w-full lg:w-1/2 flex flex-col justify-center">
                <div className="w-full relative aspect-video bg-black rounded-3xl border border-white/10 shadow-2xl overflow-hidden group">
                  {/* Abstract Background for Video Placeholder */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f172a] to-black opacity-80 z-0"></div>
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-center">
                      <h3 className="text-white text-xl font-bold tracking-widest uppercase mb-2 drop-shadow-lg">
                        Welcome to VoxBox
                      </h3>
                      <p className="text-slate-400 text-sm">
                        Introduction & Orientation
                      </p>
                    </div>
                  </div>

                  {/* Unmute / Play Overlay */}
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 hover:bg-black/10 transition-all duration-500 cursor-pointer"
                  >
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 pl-6 pr-8 py-4 rounded-full flex items-center gap-4 text-white font-semibold shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:scale-105 transition-transform hover:bg-white/20 hover:border-white/40 group-hover:shadow-[0_0_40px_rgba(6,182,212,0.3)]">
                      {isMuted ? (
                        <>
                          <div className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center">
                            <svg
                              className="w-5 h-5 ml-0.5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                          <span className="tracking-wide">Click to Start</span>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 bg-[#06b6d4] text-white rounded-full flex items-center justify-center animate-pulse">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                              />
                            </svg>
                          </div>
                          <span className="text-cyan-400">Playing...</span>
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* --- RIGHT COLUMN: SUCCESS CARD --- */}
              <div className="w-full lg:w-1/2 flex items-center">
                <div className="w-full bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 flex flex-col items-center text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden justify-center">
                  {/* Top Glow Accent */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-50 shadow-[0_0_20px_#4ade80]"></div>

                  {/* ANIMATED CHECKMARK (Banking Style) */}
                  <div className="mb-6 relative">
                    <style>{`
                      .circle-ring {
                        stroke-dasharray: 166;
                        stroke-dashoffset: 166;
                        stroke-width: 2;
                        stroke-miterlimit: 10;
                        stroke: #4ade80;
                        fill: none;
                        animation: drawCircle 0.8s cubic-bezier(0.65, 0, 0.45, 1) forwards;
                      }
                      .check-icon {
                        transform-origin: 50% 50%;
                        stroke-dasharray: 48;
                        stroke-dashoffset: 48;
                        stroke: #4ade80;
                        stroke-width: 3;
                        fill: none;
                        animation: drawCheck 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
                      }
                      .success-pulse {
                        animation: pulseRing 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
                      }
                      @keyframes drawCircle { 100% { stroke-dashoffset: 0; } }
                      @keyframes drawCheck { 100% { stroke-dashoffset: 0; } }
                      @keyframes pulseRing {
                        0% { transform: scale(0.8); opacity: 0.8; }
                        50% { opacity: 0; }
                        100% { transform: scale(2); opacity: 0; }
                      }
                    `}</style>

                    {/* Pulse Effect Background */}
                    <div className="absolute inset-0 bg-green-500/20 rounded-full success-pulse"></div>

                    {/* SVG Animation */}
                    <div className="w-20 h-20 bg-[#0f172a] rounded-full relative z-10 flex items-center justify-center">
                      <svg
                        className="w-full h-full drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 52 52"
                      >
                        <circle className="circle-ring" cx="26" cy="26" r="25" />
                        <path
                          className="check-icon"
                          d="M14.1 27.2l7.1 7.2 16.7-16.8"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* TEXT CONTENT */}
                  <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 mb-2 tracking-tight">
                    Payment Successful
                  </h2>
                  <p className="text-slate-400 text-base mb-6 max-w-md mx-auto leading-relaxed">
                    Your{" "}
                    <span className="text-green-400 font-semibold">{planName}</span>{" "}
                    subscription is now active.
                  </p>

                  {/* Personalized Greeting */}
                  {userName && (
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 w-full relative mb-6">
                      <div className="absolute -top-3 left-6 bg-[#0f172a] px-2 text-slate-500"></div>
                      <p className="text-slate-300 font-medium italic text-center text-sm">
                        Hey {userName}, great to have you here! I'm excited to help you use our powerful AI abilities + insights for your products.
                      </p>
                    </div>
                  )}

                  {/* PRIMARY CTA - REDIRECT TO WORKSPACE */}
                  <button
                    onClick={() => navigate("/dashboard?createWorkspace=true&payment_success=true")}
                    className="group relative w-full py-4 rounded-xl font-extrabold text-[#0f172a] text-lg bg-[#4ade80] hover:bg-[#22c55e] shadow-[0_0_20px_rgba(74,222,128,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(74,222,128,0.5)] mb-8 overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Click here to Get Started
                      <svg
                        className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        ></path>
                      </svg>
                    </span>
                    <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[25deg] group-hover:animate-[shine_1s_infinite]"></div>
                  </button>

                  {/* Steps */}
                  <div className="w-full space-y-3 mb-6">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                        1
                      </div>
                      <span className="text-slate-300 text-sm pt-0.5">Create your first AVA profile to understand your audience</span>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                        2
                      </div>
                      <span className="text-slate-300 text-sm pt-0.5">Set up your workspace and invite team members</span>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                        3
                      </div>
                      <span className="text-slate-300 text-sm pt-0.5">Start generating content with our AI amplifiers</span>
                    </div>
                  </div>

                  {/* SUPPORT LINK */}
                  <button
                    onClick={() => (window.location.href = "mailto:support@voxbox.ai")}
                    className="hover:text-white text-xs transition-colors flex items-center gap-2 text-slate-400"
                  >
                    <svg
                      className="w-3 h-3 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                      ></path>
                    </svg>
                    Need help? Contact our support team.
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes shine {
            0% { left: -100%; }
            100% { left: 200%; }
          }
          @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
            animation: fade-in-up 0.6s ease-out forwards;
          }
        `}</style>
      </div>
    </>
  );
};

export default ThankYou;
