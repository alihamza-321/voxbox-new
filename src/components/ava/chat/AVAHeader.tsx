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
  isScrolled?: boolean;
}

export const AVAHeader = ({
  stage,
  progress,
  userName,
  onReset,
  offsetClassName = "top-0",
  className,
  isScrolled = false,
}: AVAHeaderProps) => {
  const getStatusText = () => {
    switch (stage) {
      case "welcome":
      case "name-collection":
        return "Let's get started";
      case "phase1-intro":
      case "phase1":
        return `Question ${progress.currentQuestionIndex + 1} of ${
          progress.totalQuestions
        }`;
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
      const percentage =
        (progress.currentQuestionIndex / progress.totalQuestions) * 100;
      // Cap at 100% - only reached when all questions are completed
      return Math.min(100, Math.max(0, isNaN(percentage) ? 0 : percentage));
    }
    return 0;
  };

  const headerClassName = cn(
    "relative bg-white backdrop-blur-xl border-b-2 border-gray-200 overflow-hidden transition-all duration-300",
    isScrolled ? "h-6" : "h-16",
    offsetClassName,
    className
  );

  return (
    <div className={headerClassName}>
      {!isScrolled && (
        <div className="relative w-[80%] mx-auto h-full flex items-center z-10 transition-all duration-300">
          {/* Full Header - Show when not scrolled */}
          <div className="w-full flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <img
                  src={avaAvatar}
                  alt="AVA Avatar"
                  className="w-7 h-7 rounded-lg flex-shrink-0 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h1 className="text-sm font-semibold text-gray-900">
                    AVA
                  </h1>
                  <p className="text-[10px] text-gray-600 truncate">
                    {getStatusText()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {userName && (
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 border border-gray-300 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                    <span className="text-[10px] text-gray-700">
                      {userName}
                    </span>
                  </div>
                )}

                {/* Reset button */}
                {(() => {
                  const isValidStage =
                    stage === "phase1" ||
                    stage === "phase2" ||
                    stage === "transition" ||
                    stage === "complete";
                  const hasResetHandler = typeof onReset === "function";

                  if (!hasResetHandler || !isValidStage) {
                    return null;
                  }

                  return (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                          title="Start New Session"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">
                            Start New Session?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            This will clear all progress and start fresh. Your
                            current session will be saved in browser history.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
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

            {(stage === "phase1" ||
              stage === "phase2" ||
              stage === "transition" ||
              stage === "complete") && (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gray-600 to-gray-800 transition-all duration-500 ease-out"
                    style={{ width: `${getProgressValue()}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-gray-600 min-w-[2.5rem] text-right">
                  {Math.round(getProgressValue())}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
