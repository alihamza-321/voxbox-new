const BackgroundTech = () => {
  return (
    <div className="fixed inset-0 -z-10 h-full w-full overflow-hidden pointer-events-none bg-[radial-gradient(circle_at_50%_50%,#111827_0%,#020617_80%,#000000_100%)]">
      {/* 
        Inline styles for specific keyframes that Tailwind arbitrary values 
        can't handle elegantly without config modification.
      */}

      <svg
        className="h-full w-full drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Fading Gradient for background beams */}
          <linearGradient id="beam-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>

          {/* Grid Pattern */}
          <pattern
            id="grid-pattern"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 100 0 L 0 0 0 100"
              fill="none"
              className="stroke-slate-800 stroke-1 opacity-20"
            />
          </pattern>
        </defs>

        {/* --- LAYER 1: Background Texture --- */}
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />

        {/* Subtle Vertical Scanning Beam */}
        <rect
          x="600"
          y="0"
          width="100"
          height="1080"
          fill="url(#beam-grad)"
          className="opacity-30"
        />

        {/* --- LAYER 2: THE DATA NETWORK (Lines across screen) --- */}
        
        {/* Reusable Classes for cleaner JSX */}
        {/* Base Track: stroke-slate-700 / opacity-30 */}
        {/* Energy Line: stroke-dasharray="150 1500" / stroke-linecap="round" */}

        {/* 1. Top Horizon (Cyan) */}
        <path
          d="M 0 150 L 600 150 L 700 250 L 1920 250"
          className="fill-none stroke-slate-700 stroke-1 opacity-30"
        />
        <path
          d="M 0 150 L 600 150 L 700 250 L 1920 250"
          strokeDasharray="150 1500"
          className="fill-none stroke-cyan-500 stroke-[3px] stroke-round drop-shadow-[0_0_5px_rgba(6,182,212,1)]"
        />

        {/* 2. Bottom Horizon (Purple) - Reverse Flow */}
        <path
          d="M 1920 900 L 1200 900 L 1100 800 L 0 800"
          className="fill-none stroke-slate-700 stroke-1 opacity-30"
        />
        <path
          d="M 1920 900 L 1200 900 L 1100 800 L 0 800"
          strokeDasharray="150 1500"
          className="fill-none stroke-purple-500 stroke-[3px] stroke-round drop-shadow-[0_0_5px_rgba(168,85,247,1)]"
        />

        {/* 3. Left Vertical Feed (Fast Cyan) */}
        <path
          d="M 200 0 L 200 600 L 400 800 L 400 1080"
          className="fill-none stroke-slate-700 stroke-1 opacity-30"
        />
        <path
          d="M 200 0 L 200 600 L 400 800 L 400 1080"
          strokeDasharray="150 1500"
          className="fill-none stroke-cyan-500 stroke-[3px] stroke-round drop-shadow-[0_0_5px_rgba(6,182,212,1)]"
        />

        {/* 4. Right Complex Feed (Fast Purple Reverse) */}
        <path
          d="M 1700 1080 L 1700 400 L 1500 200 L 1500 0"
          className="fill-none stroke-slate-700 stroke-1 opacity-30"
        />
        <path
          d="M 1700 1080 L 1700 400 L 1500 200 L 1500 0"
          strokeDasharray="150 1500"
          className="fill-none stroke-purple-500 stroke-[3px] stroke-round drop-shadow-[0_0_5px_rgba(168,85,247,1)]"
        />

        {/* --- LAYER 3: FLOATING PARTICLES (Depth) --- */}
        {/* Using style={{ animationDelay }} is still cleaner than creating 10 different utility classes */}
        {[
          { cx: 200, cy: 200, r: 2, delay: "0s" },
          { cx: 1600, cy: 300, r: 3, delay: "1s" },
          { cx: 400, cy: 900, r: 2, delay: "2s" },
          { cx: 1500, cy: 800, r: 2, delay: "0.5s" },
          { cx: 960, cy: 200, r: 2, delay: "3s" },
          { cx: 100, cy: 540, r: 3, delay: "1.5s" },
        ].map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            className="fill-white opacity-30 origin-center"
          />
        ))}
      </svg>
    </div>
  );
};

export default BackgroundTech;

