import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Lightbulb, ArrowRight } from "lucide-react";

interface AVAExampleChipsProps {
  examples: string[];
  onSelect: (example: string) => void;
}

export const AVAExampleChips = ({ examples, onSelect }: AVAExampleChipsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const examplesContainerRef = useRef<HTMLDivElement>(null);
  const lastExampleRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  // Scroll to last example when expanded
  useEffect(() => {
    if (isExpanded && lastExampleRef.current) {
      // Use multiple requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Scroll to the last example to ensure it's fully visible
          lastExampleRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
            inline: "nearest"
          });
        });
      });
    }
  }, [isExpanded]);

  return (
    <div className="mt-4 space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="text-xs text-cyan-400 hover:text-blue-400 hover:bg-cyan-500/10 font-medium transition-colors h-7"
      >
        <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
        {isExpanded ? "Hide" : "Show"} examples
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-1.5" />}
      </Button>

      {isExpanded && (
        <div ref={examplesContainerRef} className="space-y-2 animate-fade-in">
          {examples.map((example, idx) => {
            const isLast = idx === examples.length - 1;
            return (
              <button
                key={idx}
                ref={isLast ? lastExampleRef : undefined}
                onClick={() => onSelect(example)}
                className="group block w-full text-left px-4 py-3 rounded-lg bg-slate-800/50 hover:bg-cyan-500/10 border border-slate-700/50 hover:border-cyan-500/30 text-xs transition-all shadow-sm text-slate-300"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-cyan-400">{idx + 1}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="leading-relaxed">{example}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors mt-0.5 flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

