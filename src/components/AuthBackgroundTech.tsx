import React from "react";

const AuthBackgroundTech = React.memo(() => {
  return (
    <div
      className="fixed inset-0 w-full h-full bg-white -z-50 overflow-hidden isolate pointer-events-none"
      aria-hidden="true"
    >
      <style>{`
        /* 
           THE LOGIC:
           The SVG is 200% wide (2880px on a 1440px base).
           It contains two identical wave cycles (0-1440 and 1440-2880).
           We move it from 0% to -50% (exactly one cycle width).
           When it hits -50%, it snaps back to 0% instantly.
           Because the start and middle points are identical, the snap is invisible.
        */
        @keyframes wave-drift {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }

        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          15% { opacity: 0.6; }
          85% { opacity: 0.6; }
          100% { transform: translateY(-90px) scale(0.6); opacity: 0; }
        }

        .animate-wave {
          /* Linear is required for continuous flow without pausing */
          animation: wave-drift 12s linear infinite;
          will-change: transform;
        }
        
        /* Layer 2 moves slightly slower for parallax depth */
        .animate-wave-slow {
          animation: wave-drift 16s linear infinite;
          will-change: transform;
        }

        .particle {
          animation: float-up 7s ease-in infinite;
          will-change: transform, opacity;
        }
      `}</style>

      {/* TOP: Subtle Texture Pattern */}
      <div className="absolute top-0 left-0 w-full h-[40%] z-0">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
            opacity: 0.45,
          }}
        />
      </div>

      {/* BOTTOM: THE BLACK WAVES */}
      <div className="absolute bottom-0 left-0 w-full h-[65%] z-10 overflow-hidden pointer-events-none">
        
        {/* Layer 2: Foreground Wave (Solid Black) */}
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-full animate-wave text-black"
          viewBox="0 0 2880 900"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="
            M0,250
            C240,150 480,150 720,250
            C960,350 1200,350 1440,250
            
            C1680,150 1920,150 2160,250
            C2400,350 2640,350 2880,250
            
            L2880,900 L0,900 Z
          " />
        </svg>
      </div>

      {/* PARTICLES */}
      <div className="absolute" style={{ bottom: "46%", left: "18%" }}>
        <div className="particle w-3 h-3 rounded-full bg-black/70 border border-black/10" style={{ animationDelay: "0.2s" }} />
      </div>

      <div className="absolute" style={{ bottom: "52%", right: "28%" }}>
        <div className="particle w-7 h-7 rounded-full bg-white/90 border border-black/10" style={{ animationDelay: "1.5s" }} />
      </div>

      <div className="absolute" style={{ bottom: "44%", left: "52%" }}>
        <div className="particle w-4 h-4 rounded-full bg-black/20 border border-black/8" style={{ animationDelay: "3s" }} />
      </div>

      {/* GLOW BLUR */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "20%",
          left: "18%",
          width: 560,
          height: 560,
          borderRadius: "50%",
          backgroundColor: "rgba(0,0,0,0.07)",
          filter: "blur(120px)",
          zIndex: 15,
        }}
      />

      {/* TEXTURE GRAIN */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.22,
          mixBlendMode: "overlay",
          backgroundImage:
            `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.75'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
});

export default AuthBackgroundTech;

