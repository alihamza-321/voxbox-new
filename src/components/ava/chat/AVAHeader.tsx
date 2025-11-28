import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import avaAvatar from "@/assets/ava-avatar.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface AVAHeaderProps {
  stage: string;
  progress: {
    currentQuestionIndex: number;
    totalQuestions: number;
  };
  userName?: string;
  onReset?: () => void;
  offsetClassName?: string;
  className?: string;
}

export const AVAHeader = ({
  stage,
  progress,
  userName,
  onReset,
  offsetClassName = "top-0",
  className,
}: AVAHeaderProps) => {
  const getStatusText = () => {
    switch (stage) {
      case "welcome":
      case "name-collection":
        return "Let's get started";
      case "phase1-intro":
      case "phase1":
        return `Question ${progress.currentQuestionIndex + 1} of ${progress.totalQuestions}`;
      case "transition":
        return "Phase 1 Complete";
      case "phase2":
        return `Generating Profile • ${progress.currentQuestionIndex} of ${progress.totalQuestions} completed`;
      case "complete":
        return "Profile Complete";
      default:
        return "AVA";
    }
  };

  const getProgressValue = () => {
    if (stage === "transition" || stage === "complete") {
      // Phase 1 is complete - show 100%
      return 100;
    }
    if (stage === "phase1" || stage === "phase2") {
      // Prevent division by zero and NaN
      if (!progress.totalQuestions || progress.totalQuestions === 0) {
        return 0;
      }
      // If currentQuestionIndex equals totalQuestions, all questions are completed - show 100%
      if (progress.currentQuestionIndex >= progress.totalQuestions) {
        return 100;
      }
      const percentage = (progress.currentQuestionIndex / progress.totalQuestions) * 100;
      // Cap at 100% - only reached when all questions are completed
      return Math.min(100, Math.max(0, isNaN(percentage) ? 0 : percentage));
    }
    return 0;
  };

  const headerClassName = cn(
    "bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/50",
    offsetClassName,
    className
  );

  return (
    <div className={headerClassName}>
      <div className="w-[80%] mx-auto py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img 
              src={avaAvatar} 
              alt="AVA Avatar" 
              className="w-10 h-10 rounded-xl flex-shrink-0 object-cover shadow-lg"
            />
            
            <div className="flex-1 min-w-0">
              <h1 className="font-heading font-bold text-lg bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                AVA
              </h1>
              <p className="text-xs text-slate-400 font-medium truncate">
                {getStatusText()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {userName && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-full">
                <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                <span className="text-xs font-medium text-slate-200">{userName}</span>
              </div>
            )}
            
            {/* Reset button - Show in all active phases (works in both dev and prod) */}
            {(() => {
              // Explicitly check if onReset is provided and stage is valid
              const isValidStage = stage === "phase1" || stage === "phase2" || stage === "transition" || stage === "complete";
              const hasResetHandler = typeof onReset === "function";
              
              // Only render if both conditions are met (production-safe check)
              if (!hasResetHandler || !isValidStage) {
                return null;
              }
              
              return (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                      title="Start New Session"
                      aria-label="Start New Session"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-slate-900 border-slate-700">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-100">Start New Session?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        This will clear all progress and start fresh. Your current session will be saved in browser history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => {
                          // Production-safe: Ensure onReset is still a function before calling
                          if (typeof onReset === "function") {
                            onReset();
                          }
                        }} 
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Start New Session
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              );
            })()}
          </div>
        </div>

        {(stage === "phase1" || stage === "phase2" || stage === "transition" || stage === "complete") && (
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Progress
              </span>
              <span className="text-xs font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                {Math.round(getProgressValue())}%
              </span>
            </div>
            <div className="w-full bg-slate-800/50 rounded-full h-1.5 overflow-hidden mt-1">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-500 ease-out"
                style={{ width: `${getProgressValue()}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

