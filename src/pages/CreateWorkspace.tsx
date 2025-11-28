import { useEffect, useState } from "react";
import BackgroundTech from "@/components/BackgroundTech";
import { useNavigate } from "react-router-dom";
import { WorkspaceService } from "@/lib/workspace";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";

// --- ICONS ---
const PlayIcon = () => (
  <svg
    className="w-12 h-12 text-white opacity-90 group-hover:scale-110 transition-transform duration-300"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    className="w-5 h-5 text-slate-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19 9l-7 7-7-7"
    ></path>
  </svg>
);

// --- 1. CUSTOM CONFETTI ENGINE ---
const PartyConfetti = () => {
  const particles = Array.from({ length: 60 }).map((_, i) => {
    const colors = ["#22d3ee", "#3b82f6", "#a855f7", "#f472b6", "#ffffff"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const animDuration = Math.random() * 3 + 2;
    const animDelay = Math.random() * 0.5;

    return (
      <div
        key={i}
        className="absolute top-[-20px] w-2 h-4 rounded-sm"
        style={{
          left: `${left}%`,
          backgroundColor: randomColor,
          animation: `fall ${animDuration}s linear ${animDelay}s infinite`,
          opacity: Math.random(),
          transform: `rotate(${Math.random() * 360}deg)`,
        }}
      />
    );
  });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(0deg) translateX(0px); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) translateX(20px); opacity: 0; }
        }
      `}</style>
      {particles}
    </div>
  );
};

// --- 2. VIDEO PLAYER PLACEHOLDER COMPONENT ---
const VideoPlaceholder = ({
  label,
  isPlaying,
  onPlay,
}: {
  label: string;
  isPlaying: boolean;
  onPlay: () => void;
}) => {
  return (
    <div className="w-full aspect-video bg-black rounded-xl border border-slate-700/50 relative overflow-hidden group shadow-lg mb-6">
      {isPlaying ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <p className="text-cyan-400 animate-pulse">Video Player Loaded...</p>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 opacity-100 group-hover:scale-105 transition-transform duration-700"></div>
          <button
            onClick={onPlay}
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-black/20 hover:bg-black/10 transition-colors"
          >
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-[0_0_30px_rgba(6,182,212,0.3)] group-hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] transition-all">
              <PlayIcon />
            </div>
            <p className="mt-3 text-slate-300 text-sm font-medium tracking-wide">
              {label}
            </p>
          </button>
        </>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---
const CreateWorkspace = () => {
  const navigate = useNavigate();
  const { addWorkspace, setCurrentWorkspace } = useWorkspace();

  // --- STATE ---
  const [step, setStep] = useState<"create" | "success">("create");
  const [workspaceName, setWorkspaceName] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [playIntroVideo, setPlayIntroVideo] = useState(false);
  const [playSuccessVideo, setPlaySuccessVideo] = useState(false);
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- EFFECTS ---
  // Trigger 1-second delay on page load for animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // --- HANDLERS ---
  const handleCreate = async () => {
    if (!workspaceName.trim()) {
      setError("Please enter a workspace name.");
      return;
    }
    setError("");

    setIsLoading(true);
    try {
      const workspaceData = {
        name: workspaceName.trim(),
        country: country || undefined,
      };

      const workspace = await WorkspaceService.createWorkspace(workspaceData);

      toast.success("Workspace created!", {
        description: `"${workspaceName.trim()}" has been created successfully.`,
      });

      // Add to workspace context and set as current
      addWorkspace(workspace);
      setCurrentWorkspace(workspace);

      // Switch to Success Step
      setStep("success");
    } catch (error) {
      console.error("Error creating workspace:", error);

      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred.";

      if (errorMessage.includes("already created a workspace with this payment")) {
        toast.error("Payment Required for Additional Workspace", {
          description:
            "You have already created a workspace with this payment. To create another workspace, please make a new payment.",
          action: {
            label: "Make Payment",
            onClick: () => navigate("/pricing"),
          },
        });
      } else if (errorMessage.includes("No active subscription found")) {
        toast.error("Subscription Required", {
          description:
            "You need an active subscription to create workspaces. Please upgrade your plan first.",
          action: {
            label: "Upgrade Plan",
            onClick: () => navigate("/pricing"),
          },
        });
      } else {
        toast.error("Failed to create workspace", {
          description: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleWatchVideo = () => {
    // Navigate to dashboard or show getting started section
    navigate("/dashboard");
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 font-sans text-slate-200">
      {/* 1. Backdrop */}
      <div>
        <BackgroundTech />
      </div>

      {/* 2. Modal Container with Transition Logic */}
      <div
        className={`
          relative z-10 w-full max-w-lg bg-[#0f172a] border border-cyan-500/20 rounded-3xl 
          shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-hidden 
          transition-all duration-1000 ease-out transform
          ${
            isMounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }
        `}
      >
        {/* ---------------- STEP 1: CREATE FORM ---------------- */}
        {step === "create" && (
          <div className="p-8 md:p-10 animate-fade-in">
            {/* Title Area */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-cyan-500 uppercase tracking-widest mb-1">
                WorkSpace
              </h2>
            </div>

            {/* Video Area */}
            <VideoPlaceholder
              label="Watch Intro"
              isPlaying={playIntroVideo}
              onPlay={() => setPlayIntroVideo(true)}
            />

            {/* Explanation Text */}
            <div className="bg-slate-800/50 rounded-xl p-4 mb-8 border border-slate-700/50">
              <p className="text-slate-400 text-sm leading-relaxed text-center text-white">
                A workspace is the place where all of your Ideal Client
                Profiles, Product Briefs and the outputs you generate inside
                VoxBox are stored. It acts as your business folder so everything
                stays organised in one place.
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-2 ml-1">
                  Workspace Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Your Business Name"
                  className={`w-full bg-slate-900 border ${
                    error ? "border-red-500" : "border-slate-700"
                  } rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none transition-all`}
                />
                {error && (
                  <p className="text-red-400 text-xs mt-1 ml-1">{error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-2 ml-1">
                  Country
                </label>
                <div className="relative">
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none appearance-none cursor-pointer"
                  >
                    <option>United Kingdom</option>
                    <option>United States</option>
                    <option>Canada</option>
                    <option>Australia</option>
                    <option>Germany</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDownIcon />
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={isLoading || !workspaceName.trim()}
                className="w-full py-4 mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg rounded-xl shadow-[0_4px_20px_rgba(6,182,212,0.3)] hover:shadow-[0_6px_25px_rgba(6,182,212,0.5)] transform hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
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
                    Creating...
                  </>
                ) : (
                  "Create Workspace"
                )}
              </button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 2: SUCCESS POPUP ---------------- */}
        {step === "success" && (
          <div className="relative p-8 md:p-10 text-center overflow-hidden animate-pop-in">
            {/* Define custom animation for "Pop In" effect */}
            <style>{`
              @keyframes popIn {
                0% { opacity: 0; transform: scale(0.9); }
                100% { opacity: 1; transform: scale(1); }
              }
              .animate-pop-in {
                animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
              }
            `}</style>

            {/* CHARMING PARTY CONFETTI */}
            <PartyConfetti />

            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-40 bg-cyan-500/10 blur-[80px] pointer-events-none"></div>

            <div className="relative z-10">
              {/* Success Icon */}
              <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)] animate-bounce-subtle">
                <svg
                  className="w-8 h-8 text-green-400"
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

              {/* Title & Message */}
              <h2 className="text-3xl font-extrabold text-white mb-4 drop-shadow-lg">
                Workspace created
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-8 px-2">
                Congratulations, your workspace has been created. Please watch
                this short tour of VoxBox so you can see where everything is and
                understand how to get started.
              </p>

              {/* Video */}
              <VideoPlaceholder
                label="Watch Tour"
                isPlaying={playSuccessVideo}
                onPlay={() => setPlaySuccessVideo(true)}
              />

              <div className="space-y-3">
                {/* Watch Video Button */}
                <button
                  onClick={handleWatchVideo}
                  className="w-full py-4 bg-[#0f172a] border border-cyan-500/50 text-cyan-400 font-bold text-lg rounded-xl hover:bg-cyan-500 hover:text-white hover:border-transparent shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 flex items-center justify-center gap-2 group"
                >
                  <svg
                    className="w-5 h-5 group-hover:scale-110 transition-transform"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch video
                </button>

                {/* Dashboard Button */}
                <button
                  type="button"
                  onClick={handleGoToDashboard}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(6,182,212,0.39)] transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateWorkspace;
