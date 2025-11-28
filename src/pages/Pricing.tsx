import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundTech from "@/components/BackgroundTech";
import { redirectToAuthenticatedCheckout } from "@/lib/payment";
import { useAuth } from "@/contexts/AuthContext";

// --- Types ---
interface Plan {
  id: string;
  name: string;
  monthly: number;
  annual: number;
  productCount: string;
  productLabel: string;
  desc: string;
  isScale: boolean;
  checkoutPlan: "pro" | "team";
}

interface AnimatedPriceProps {
  value: number;
  shouldStart: boolean;
}

type Cycle = "monthly" | "annual";

// --- Sub-component: AnimatedPrice ---
const AnimatedPrice: React.FC<AnimatedPriceProps> = ({
  value,
  shouldStart,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);

  useEffect(() => {
    if (!shouldStart) {
      setDisplayValue(0);
      return;
    }
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const duration = 1000;
    const startValue = 0;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValue + (value - startValue) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };
    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [value, shouldStart]);

  return <>{displayValue.toLocaleString()}</>;
};

// --- Main Component ---
const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const [loading, setLoading] = useState<string | null>(null);

  const plans: Plan[] = [
    {
      id: "solo",
      name: "Solo Plan",
      monthly: 97,
      annual: 970,
      productCount: "2",
      productLabel: "Products",
      desc: "Designed for individual business owners. One main offer, one primary audience.",
      isScale: false,
      checkoutPlan: "pro",
    },
    {
      id: "growth",
      name: "Growth Plan",
      monthly: 117,
      annual: 1170,
      productCount: "4",
      productLabel: "Products",
      desc: "Ideal for solo service providers developing a product suite with multiple core offers.",
      isScale: false,
      checkoutPlan: "pro",
    },
    {
      id: "pro",
      name: "Pro Plan",
      monthly: 137,
      annual: 1370,
      productCount: "5",
      productLabel: "Products",
      desc: "Built for established owners with multiple lead magnets feeding different programmes.",
      isScale: false,
      checkoutPlan: "team",
    },
    {
      id: "scale",
      name: "Scale Plan",
      monthly: 157,
      annual: 1570,
      productCount: "∞",
      productLabel: "Unlimited",
      desc: "Created for mature businesses with a complete ecosystem running multiple niches.",
      isScale: true,
      checkoutPlan: "team",
    },
  ];

  useEffect(() => {
    setVisibleCount(0);
    const interval = window.setInterval(() => {
      setVisibleCount((prev) => (prev >= plans.length ? prev : prev + 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cycle]);

  const handleCheckout = async (plan: Plan) => {
    if (!isAuthenticated) {
      alert("Please log in to access subscription features. You need to be authenticated to make payments.");
      navigate('/login');
      return;
    }

    try {
      setLoading(plan.id);
      await redirectToAuthenticatedCheckout(plan.checkoutPlan);
    } catch (error: any) {
      console.error("Pricing: Error starting checkout:", error);
      const errorMessage = error?.message || "Failed to start checkout. Please try again.";
      alert(errorMessage);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative min-h-screen w-full font-sans text-white pb-20 overflow-x-hidden font-['Inter']">
      <div className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none">
        <BackgroundTech />
      </div>
      <div className="relative z-10 max-w-[1350px] mx-auto py-[60px] px-5 flex flex-col items-center">
        <div className="text-center mb-[55px]">
          <h2 className="text-5xl font-extrabold text-white drop-shadow-[0_0_25px_rgba(6,182,212,0.6)] mb-3 -tracking-[1px]">
            Select System Capacity
          </h2>
        </div>
        <div className="flex relative bg-[#0f172a] border border-white/10 rounded-xl p-1.5 mb-[60px] shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
          <div
            className={`absolute top-1.5 left-1.5 w-[calc(50%-6px)] h-[calc(100%-12px)] bg-[#06b6d4] rounded-lg transition-transform duration-300 cubic-bezier(0.4,0,0.2,1) shadow-[0_0_15px_rgba(6,182,212,0.5)] z-10 ${
              cycle === "annual" ? "translate-x-full" : "translate-x-0"
            }`}
          ></div>
          <div
            className={`relative z-20 py-3 px-10 font-bold text-base cursor-pointer transition-colors duration-300 select-none ${
              cycle === "monthly" ? "text-[#0f172a]" : "text-[#64748b]"
            }`}
            onClick={() => setCycle("monthly")}
          >
            Monthly
          </div>
          <div
            className={`relative z-20 py-3 px-10 font-bold text-base cursor-pointer transition-colors duration-300 select-none ${
              cycle === "annual" ? "text-[#0f172a]" : "text-[#64748b]"
            }`}
            onClick={() => setCycle("annual")}
          >
            Annual
          </div>
        </div>
        <div className="flex flex-wrap gap-[30px] justify-center w-full">
          {plans.map((plan, index) => {
            const isVisible = index < visibleCount;
            const isScale = plan.isScale;
            const borderColor = isScale
              ? "border-[rgba(168,85,247,0.5)]"
              : "border-[rgba(6,182,212,0.3)]";
            const bgCard = isScale
              ? "bg-[rgba(20,15,35,0.95)]"
              : "bg-[rgba(15,23,42,0.95)]";
            const shadowBase = isScale
              ? "shadow-[0_30px_60px_-12px_rgba(0,0,0,0.9),0_0_20px_rgba(168,85,247,0.2)]"
              : "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgba(6,182,212,0.1)]";
            const shadowHover = isScale
              ? "hover:shadow-[0_40px_70px_-15px_rgba(0,0,0,1),0_0_40px_rgba(168,85,247,0.4)]"
              : "hover:shadow-[0_35px_60px_-15px_rgba(0,0,0,1),0_0_25px_rgba(6,182,212,0.3)]";
            const chipBg = isScale
              ? "bg-[rgba(168,85,247,0.1)]"
              : "bg-[rgba(6,182,212,0.08)]";
            const chipBorder = isScale
              ? "border-[rgba(168,85,247,0.3)]"
              : "border-[rgba(6,182,212,0.2)]";
            const chipText = isScale ? "text-[#d8b4fe]" : "text-[#06b6d4]";
            const chipShadow = isScale
              ? "drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]"
              : "drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]";
            const btnBg = isScale ? "bg-[#d8b4fe]" : "bg-[#06b6d4]";
            const btnHover = isScale
              ? "hover:bg-[#e9d5ff]"
              : "hover:bg-[#67e8f9]";
            return (
              <div
                key={plan.id}
                className={`relative flex-1 min-w-[290px] max-w-[320px] ${bgCard} backdrop-blur-xl border ${borderColor} rounded-3xl ${shadowBase} overflow-hidden flex flex-col ${shadowHover} transition-all duration-700 ease-out ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-12 pointer-events-none"
                }`}
              >
                {isScale && (
                  <div className="absolute top-0 right-0 bg-[#d8b4fe] text-[#0f172a] text-xs font-extrabold py-1.5 px-5 rounded-bl-xl uppercase tracking-widest z-[5] shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                    Best Value
                  </div>
                )}
                <div className="p-[35px_25px] flex flex-col h-full">
                  <h3 className="text-2xl font-extrabold text-white mb-5 tracking-[0.5px]">
                    {plan.name}
                  </h3>
                  <div
                    className={`${chipBg} border ${chipBorder} rounded-xl p-5 text-center mb-[30px] shadow-inner`}
                  >
                    <span
                      className={`block text-5xl font-extrabold ${chipText} leading-none ${chipShadow}`}
                    >
                      {plan.productCount}
                    </span>
                    <span className="block text-xs uppercase tracking-[2px] text-[#94a3b8] mt-2.5 font-bold">
                      {plan.productLabel}
                    </span>
                  </div>
                  <div className="flex items-baseline mb-[25px] border-b border-white/10 pb-5">
                    <span className="text-2xl text-[#94a3b8] font-semibold">
                      £
                    </span>
                    <span className="text-[2.8rem] font-extrabold text-white">
                      <AnimatedPrice
                        value={
                          cycle === "monthly" ? plan.monthly : plan.annual
                        }
                        shouldStart={isVisible}
                      />
                    </span>
                    <span className="text-[0.95rem] text-white ml-1.5 font-medium">
                      /{cycle === "monthly" ? "mo" : "yr"}
                    </span>
                  </div>
                  <p className="text-[0.95rem] text-[#cbd5e1] leading-[1.6] mb-[30px] grow">
                    {plan.desc}
                  </p>
                  <button
                    onClick={() => handleCheckout(plan)}
                    disabled={loading === plan.id || !isAuthenticated}
                    className={`w-full p-[18px] rounded-xl border-none ${btnBg} text-[#0f172a] font-extrabold text-base cursor-pointer transition-all duration-300 shadow-[0_4px_15px_rgba(6,182,212,0.3)] ${btnHover} hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                  >
                    {loading === plan.id ? (
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : !isAuthenticated ? (
                      "Login Required"
                    ) : isScale ? (
                      "Initialize Scale"
                    ) : (
                      "Select Plan"
                    )}
                  </button>
                  <div className="text-center mt-[15px] text-[0.8rem] text-white">
                    No contracts. Cancel anytime.
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
