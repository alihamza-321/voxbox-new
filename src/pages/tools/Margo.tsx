import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import avaAvatar from "@/assets/ava-avatar.png";
import { MargoStep1, type MargoStep1InputHandlers } from "@/components/margo/MargoStep1";
import { MargoStep2 } from "@/components/margo/MargoStep2";
import { MargoStep3, type MargoStep3InputHandlers } from "@/components/margo/MargoStep3";
import { MargoStep4 } from "@/components/margo/MargoStep4";
import { MargoStep5 } from "@/components/margo/MargoStep5";
import { MargoStep6 } from "@/components/margo/MargoStep6";
import { MargoStep7, type MargoStep7UIState } from "@/components/margo/MargoStep7";
import { ResetProgressConfirmDialog } from "@/components/margo/ResetProgressConfirmDialog";
import type { MargoBrief } from "@/lib/margo-api";
import type { MargoStep7Section } from "@/lib/margo-api";
import { fetchMargoFinalProductBrief } from "@/lib/margo-api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";

const convertMarkdownToPlainText = (input?: string | null) => {
  if (!input) {
    return "";
  }

  return (
    input
      .replace(/```[\s\S]*?```/g, (codeBlock) => codeBlock.replace(/```/g, ""))
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      .replace(/~~(.*?)~~/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*>+\s?/gm, "")
      .replace(/!\[[^\]]*\]\((.*?)\)/g, "$1")
      .replace(/\[([^\]]+)\]\((.*?)\)/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
};

const MARGO_STORAGE_PREFIX = "margo-state";
const STEP_STORAGE_PREFIXES = ["margo-step3-", "margo-step4-", "margo-step5-", "margo-step6-"];

const getStorageKey = (workspaceId: string) => `${MARGO_STORAGE_PREFIX}-${workspaceId}`;

const createDefaultStep7State = (): MargoStep7UIState => ({
  sections: [],
  generateAttempts: 0,
  statusMessage: null,
  completionMessage: null,
  finalBriefText: null,
  finalSections: [],
  statusHistory: [],
  statusHistoryContent: [],
});

interface PersistedMargoState {
  session: MargoBrief | null;
  finalBriefSections: MargoStep7Section[];
  step7State: MargoStep7UIState;
  lastUpdated: string;
}

const Margo = () => {
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const { toast } = useToast();
  const [session, setSession] = useState<MargoBrief | null>(null);
  const [needsWorkspace, setNeedsWorkspace] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [finalBriefSections, setFinalBriefSections] = useState<MargoStep7Section[]>([]);
  const [isDownloadingBrief, setIsDownloadingBrief] = useState(false);
  const [isRestoringState, setIsRestoringState] = useState(true);
  const [step7State, setStep7State] = useState<MargoStep7UIState>(createDefaultStep7State());
  const [step1InputHandlers, setStep1InputHandlers] = useState<MargoStep1InputHandlers | null>(null);
  const [step3InputHandlers, setStep3InputHandlers] = useState<MargoStep3InputHandlers | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const restoredWorkspaceRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const workspaceId = currentWorkspace?.id ?? null;

  useEffect(() => {
    if (workspaceLoading) {
      return;
    }

    if (typeof window === "undefined") {
      setIsRestoringState(false);
      return;
    }

    if (!workspaceId) {
      setNeedsWorkspace(true);
      setSession(null);
      setFinalBriefSections([]);
      setStep7State(createDefaultStep7State());
      setSessionError(null);
      restoredWorkspaceRef.current = null;
      setIsRestoringState(false);
      return;
    }

    setNeedsWorkspace(false);
    setSessionError(null);

    if (restoredWorkspaceRef.current === workspaceId) {
      setIsRestoringState(false);
      return;
    }

    setIsRestoringState(true);

    const storageKey = getStorageKey(workspaceId);

    try {
      const raw = localStorage.getItem(storageKey);

      if (raw) {
        const parsed = JSON.parse(raw) as PersistedMargoState;

        setSession(parsed?.session ?? null);
        setFinalBriefSections(Array.isArray(parsed?.finalBriefSections) ? parsed.finalBriefSections : []);
        setStep7State(
          parsed?.step7State
            ? { ...createDefaultStep7State(), ...parsed.step7State }
            : createDefaultStep7State()
        );
      } else {
        setSession(null);
        setFinalBriefSections([]);
        setStep7State(createDefaultStep7State());
      }
    } catch (error) {
      console.error("Failed to restore MARGO state from storage:", error);
      setSession(null);
      setFinalBriefSections([]);
      setStep7State(createDefaultStep7State());
    } finally {
      restoredWorkspaceRef.current = workspaceId;
      setIsRestoringState(false);
    }
  }, [workspaceId, workspaceLoading]);

  useEffect(() => {
    if (isRestoringState) {
      return;
    }

    if (!workspaceId || typeof window === "undefined") {
      return;
    }

    const storageKey = getStorageKey(workspaceId);

    if (!session) {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.error("Failed to clear persisted MARGO state:", error);
      }
      return;
    }

    const payload: PersistedMargoState = {
      session,
      finalBriefSections,
      step7State,
      lastUpdated: new Date().toISOString(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist MARGO state:", error);
    }
  }, [session, finalBriefSections, step7State, workspaceId, isRestoringState]);

  const clearStepStorage = useCallback((briefId?: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const keysToRemove: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) {
          continue;
        }

        // Check if key matches any step storage prefix
        const matchesPrefix = STEP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
        if (!matchesPrefix) {
          continue;
        }

        // If briefId is provided, only remove keys for this specific session
        // Step keys format: margo-step3-{briefId}, margo-step4-{briefId}, etc.
        if (briefId) {
          const expectedSuffix = `-${briefId}`;
          if (key.endsWith(expectedSuffix)) {
            keysToRemove.push(key);
          }
        } else {
          // If no briefId, remove all matching keys (fallback for cleanup)
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        window.localStorage.removeItem(key);
      });
    } catch (error) {
      console.error("Failed to clear persisted step state:", error);
    }
  }, []);

  const clearPersistedState = useCallback(() => {
    if (!workspaceId || typeof window === "undefined") {
      return;
    }

    try {
      localStorage.removeItem(getStorageKey(workspaceId));
    } catch (error) {
      console.error("Failed to clear persisted MARGO state:", error);
    }
  }, [workspaceId]);

  const handleStartNew = useCallback(() => {
    // Store briefId before clearing session
    const briefIdToClear = session?.id;
    clearPersistedState();
    // Only clear step storage for the current session
    clearStepStorage(briefIdToClear);
    setFinalBriefSections([]);
    setStep7State(createDefaultStep7State());
    setSession(null);
    setSessionError(null);
  }, [clearPersistedState, clearStepStorage, session?.id]);

  // Step completion flags - determine if steps are done
  const isStep1Completed = session?.step1Completed ?? false;
  const isStep2Completed = session?.step2Completed ?? false;
  const isStep3Completed = useMemo(() => {
    if (!session) return false;
    if (session.currentStep && session.currentStep > 3) return true;
    if (session.nextAction && session.nextAction.startsWith("step4")) return true;
    return false;
  }, [session]);
  const isStep4Completed = useMemo(() => {
    if (!session) return false;
    if (session.currentStep && session.currentStep > 4) return true;
    if (session.nextAction && session.nextAction.startsWith("step5")) return true;
    return false;
  }, [session]);
  const isStep5Completed = useMemo(() => {
    if (!session) return false;
    if (session.currentStep && session.currentStep > 5) return true;
    if (session.nextAction && session.nextAction.startsWith("step6")) return true;
    return false;
  }, [session]);
  const isStep6Completed = useMemo(() => {
    if (!session) return false;
    if (session.currentStep && session.currentStep > 6) return true;
    if (session.nextAction && session.nextAction.startsWith("step7")) return true;
    return false;
  }, [session]);
  const isStep7Completed = useMemo(() => {
    if (!session) return false;
    if (session.nextAction === "step7_complete") return true;
    if (session.currentStep && session.currentStep > 7) return true;
    return false;
  }, [session]);

  // Step active flags - determine which step is currently active

  const isStep2Active = useMemo(() => {
    if (!session || isStep2Completed) return false;
    if (session.nextAction === "select_ava_profile") return true;
    if (session.currentStep >= 2) return true;
    if (session.step2AvaProfileId) return true;
    return false;
  }, [session, isStep2Completed]);

  const isStep3Active = useMemo(() => {
    if (!session || isStep3Completed) return false;
    if (session.currentStep >= 3) return true;
    if (session.nextAction === "start_product_interview") return true;
    return false;
  }, [session, isStep3Completed]);

  const isStep4Active = useMemo(() => {
    if (!session) return false;
    if (isStep4Completed) return false;
    if (session.nextAction === "step4_ready" || session.nextAction === "prepare_step4" || session.nextAction === "watch_video_step4") return true;
    if (session.currentStep === 4) return true;
    return false;
  }, [session, isStep4Completed]);

  const isStep5Active = useMemo(() => {
    if (!session) return false;
    if (isStep5Completed) return false;
    if (session.nextAction && session.nextAction.startsWith("step5")) return true;
    if (session.currentStep && session.currentStep >= 5 && !session.nextAction?.startsWith("step6")) return true;
    return false;
  }, [session, isStep5Completed]);

  const isStep6Active = useMemo(() => {
    if (!session) return false;
    if (isStep6Completed) return false;
    if (session.nextAction && session.nextAction.startsWith("step6")) return true;
    if (session.currentStep && session.currentStep >= 6 && !session.nextAction?.startsWith("step7")) return true;
    return false;
  }, [session, isStep6Completed]);

  const isStep7Active = useMemo(() => {
    if (!session) return false;
    if (isStep7Completed) return false;
    if (session.nextAction && session.nextAction.startsWith("step7") && session.nextAction !== "step7_complete") return true;
    if (session.currentStep && session.currentStep >= 7 && session.nextAction !== "step7_complete") return true;
    return false;
  }, [session, isStep7Completed]);

  const totalStages = 7;
  const totalSteps = totalStages;
  const REQUIRED_STEP7_SECTIONS = 9;

  const currentStepNumber = useMemo(() => {
    if (isStep7Active) return 7;
    if (isStep7Completed) return 7;
    if (isStep6Active) return 6;
    if (isStep5Active) return 5;
    if (isStep4Active) return 4;
    if (isStep3Active) return 3;
    if (isStep2Active) return 2;

    let completedStep = 1;
    if (session?.step1Completed) completedStep = Math.max(completedStep, 2);
    if (isStep2Completed) completedStep = Math.max(completedStep, 3);
    if (isStep3Completed) completedStep = Math.max(completedStep, 4);
    if (isStep4Completed) completedStep = Math.max(completedStep, 5);
    if (isStep5Completed) completedStep = Math.max(completedStep, 6);
    if (isStep6Completed) completedStep = Math.max(completedStep, 7);
    if (isStep7Completed) completedStep = Math.max(completedStep, 7);

    const sessionStep = Math.min(session?.currentStep ?? 1, totalStages);

    return Math.max(completedStep, sessionStep);
  }, [
    isStep2Active,
    isStep3Active,
    isStep4Active,
    isStep5Active,
    isStep6Active,
    isStep2Completed,
    isStep3Completed,
    isStep4Completed,
    isStep5Completed,
    isStep6Completed,
    session?.step1Completed,
    session?.currentStep,
    isStep7Active,
    isStep7Completed,
  ]);

  const clampedCurrentStep = useMemo(
    () => Math.min(Math.max(currentStepNumber, 1), totalSteps),
    [currentStepNumber, totalSteps]
  );

  const currentWorkspaceName = currentWorkspace?.name ?? "Select a workspace";
  // Check if all sections are completed - consider both finalBriefSections and step7State
  // since sections might exist in step7State before being passed to finalBriefSections
  const hasCompletedBrief = useMemo(() => {
    if (finalBriefSections.length >= REQUIRED_STEP7_SECTIONS) return true;
    if (step7State.sections.length >= REQUIRED_STEP7_SECTIONS) return true;
    if (step7State.finalSections.length >= REQUIRED_STEP7_SECTIONS) return true;
    return false;
  }, [finalBriefSections.length, step7State.sections.length, step7State.finalSections.length]);

  // Check if the download PDF view is showing (matches the conditions in MargoStep7.tsx line 597)
  // The download PDF button appears when: statusHistoryContent.length === MAX_SECTIONS || completionMessage
  const isDownloadViewVisible = useMemo(() => {
    // Check parent completion view condition
    if (isStep7Completed && hasCompletedBrief) return true;
    // Check MargoStep7 internal completion condition (when download PDF button shows)
    if (step7State.statusHistoryContent.length >= REQUIRED_STEP7_SECTIONS) return true;
    if (step7State.completionMessage) return true;
    return false;
  }, [isStep7Completed, hasCompletedBrief, step7State.statusHistoryContent.length, step7State.completionMessage]);

  const getProgressValue = useMemo(() => {
    if (!session) return 0;
    
    let completedCount = 0;
    if (isStep1Completed) completedCount++;
    if (isStep2Completed) completedCount++;
    if (isStep3Completed) completedCount++;
    if (isStep4Completed) completedCount++;
    if (isStep5Completed) completedCount++;
    if (isStep6Completed) completedCount++;
    // Step 7 is considered completed when the download PDF view is visible
    // This matches exactly when the download PDF button appears to the user
    if (isDownloadViewVisible) completedCount++;
    
    const percentage = (completedCount / totalSteps) * 100;
    return Math.min(100, Math.max(0, percentage));
  }, [
    session,
    isStep1Completed,
    isStep2Completed,
    isStep3Completed,
    isStep4Completed,
    isStep5Completed,
    isStep6Completed,
    isDownloadViewVisible,
    totalSteps,
  ]);
  
  // Clear Step 1 input handlers when we've moved past the name input phase
  useEffect(() => {
    if (step1InputHandlers && session) {
      const isNameInputPhase = session.nextAction === "submit_name" && !session.userName;
      const hasSubmittedName = !!(session.userName && (session.nextAction === "confirm_ready" || session.nextAction === "select_ava_profile" || session.step1Completed));
      
      if (!isNameInputPhase || hasSubmittedName || isStep1Completed) {
        setStep1InputHandlers(null);
      }
    }
  }, [session?.nextAction, session?.userName, session?.step1Completed, isStep1Completed, step1InputHandlers]);
  
  useEffect(() => {
    if (!chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [
    workspaceLoading,
    needsWorkspace,
    session?.id,
    session?.currentStep,
    session?.nextAction,
    finalBriefSections.length,
  ]);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    observer.observe(chatContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Auto-resize textarea based on content (ChatGPT-style)
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const resizeTextarea = () => {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      
      // Calculate new height based on scrollHeight, clamped between min and max
      const minHeight = 56; // min-h-[56px]
      const maxHeight = 200; // max-h-[200px]
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      
      textarea.style.height = `${newHeight}px`;
    };

    // Resize on mount and when value changes
    resizeTextarea();

    // Also resize when the value changes (handled by the resizeTextarea function)
    const handleInput = () => resizeTextarea();
    textarea.addEventListener('input', handleInput);

    return () => {
      textarea.removeEventListener('input', handleInput);
    };
  }, [(step1InputHandlers || step3InputHandlers)?.inputValue, step1InputHandlers, step3InputHandlers]);
  const handleDownloadFinalBrief = async () => {
    if (!session?.id) {
      toast({
        title: "Download unavailable",
        description: "No MARGO session found.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsDownloadingBrief(true);
      const blob = await fetchMargoFinalProductBrief(session.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName =
        session.sessionName?.trim().replace(/[^\w\d-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "margo-brief";
      link.href = url;
      link.download = `${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Download started",
        description: "Your Product Positioning Brief PDF is downloading.",
      });
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error?.message || "Unable to download the Product Positioning Brief.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingBrief(false);
    }
  };

  const handleResetProgress = useCallback(() => {
    if (isRestoringState) {
      return;
    }
    setShowResetConfirm(true);
  }, [isRestoringState]);

  const confirmResetProgress = useCallback(() => {
    setStep3InputHandlers(null);
    handleStartNew();
    setShowResetConfirm(false);
  }, [handleStartNew]);



  return (
    <div className="min-h-[calc(100vh-80px)] bg-white">
      <div className="mx-auto flex h-full w-full flex-col">
        {/* ChatGPT-style header */}
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 mx-16">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden bg-gray-100">
                <img 
                  src={avaAvatar} 
                  alt="MARGO Avatar" 
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-gray-900">MARGO</h1>
                <p className="text-xs text-gray-500">Step {clampedCurrentStep} / {totalSteps}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{currentWorkspaceName}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleResetProgress}
                disabled={workspaceLoading || needsWorkspace || isRestoringState}
                title="Reset MARGO progress"
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="sr-only">Reset MARGO progress</span>
              </Button>
            </div>
          </div>
          {session && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">
                  Progress
                </span>
                <span className="text-xs font-bold bg-gradient-to-r from-vox-pink to-vox-orange bg-clip-text text-transparent">
                  {Math.round(getProgressValue)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-vox-pink via-vox-purple to-vox-orange transition-all duration-500 ease-out"
                  style={{ width: `${getProgressValue}%` }}
                />
              </div>
            </div>
          )}
        </header>

        {/* ChatGPT-style chat container */}
        <main 
          className={`flex flex-1 flex-col overflow-hidden bg-white mx-16`} 
          style={{
            // ...(hasInput ? { maxHeight: 'calc(100vh - 80px - 100px)' } : {}),
            '--ava-avatar-url': `url(${avaAvatar})`,
          } as React.CSSProperties}
        >
          <div 
            ref={chatContainerRef} 
            className={`flex-1 overflow-y-auto px-4 `}
          >
            <div className="mx-auto flex w-full flex-col">
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content">
               I'll guide you through each phase. Ready to craft a standout evaluation experience?
                </div>
              </div>

              {workspaceLoading && (
                <div className="margo-chat-bubble margo-chat-bubble--bot">
                  <div className="margo-message-content">
                    <div className="flex items-start gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Loading workspace…</p>
                        <p className="text-sm text-gray-600 mt-1">Preparing your MARGO environment.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!workspaceLoading && needsWorkspace && (
                <div className="margo-chat-bubble margo-chat-bubble--bot">
                  <div className="margo-message-content">
                    <p className="font-medium text-gray-900">Select a workspace to continue</p>
                    <p className="text-sm text-gray-600 mt-1">
                      MARGO works inside a specific workspace. Choose one from the workspace switcher to activate this journey.
                    </p>
                  </div>
                </div>
              )}

              {!workspaceLoading && sessionError && (
                <div className="margo-chat-bubble margo-chat-bubble--bot">
                  <div className="margo-message-content bg-red-50 border-red-200">
                    <p className="font-medium text-red-700">We ran into an issue</p>
                    <p className="text-sm text-red-600 mt-1">{sessionError}</p>
                    <Button
                      onClick={() => window.location.reload()}
                      className="mt-3 margo-soft-button margo-soft-button--sm"
                    >
                      Try again
                    </Button>
                  </div>
                </div>
              )}

              {!workspaceLoading && !needsWorkspace && (
                <>
                  {isRestoringState && (
                    <div className="margo-chat-bubble margo-chat-bubble--bot">
                      <div className="margo-message-content">
                        <div className="flex items-start gap-3">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-900">Restoring your progress…</p>
                            <p className="text-sm text-gray-600 mt-1">Fetching your saved MARGO session for this workspace.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isRestoringState && (
                    <>
                      {/* Step 1 - Always show if workspace exists */}
                      {workspaceId && (
                        <div className="mb-4 pb-20">
                          <MargoStep1
                            key={`margo-step1-${workspaceId}`}
                            workspaceId={workspaceId}
                            session={session}
                            onSessionChange={setSession}
                            onErrorChange={setSessionError}
                            isCompleted={isStep1Completed}
                            onInputHandlersReady={setStep1InputHandlers}
                          />
                        </div>
                      )}

                      {/* Step 2 - Show if step 1 is completed (always show once unlocked) */}
                      {workspaceId && session && isStep1Completed && (
                        <div className="mb-5">
                          <MargoStep2
                            key={`margo-step2-${session.id}`}
                            workspaceId={workspaceId}
                            session={session}
                            isActive={isStep2Active}
                            isCompleted={isStep2Completed}
                            isUnlocked={isStep1Completed}
                            onSessionChange={(nextSession) =>
                              setSession((prev) => ({
                                ...(prev ?? nextSession),
                                ...nextSession,
                              }))
                            }
                          />
                        </div>
                      )}

                      {/* Step 3 - Show if step 2 is completed (always show once unlocked) */}
                      {session && isStep2Completed && (
                        <div className="mb-5">
                          <MargoStep3
                            key={`margo-step3-${session.id}`}
                            session={session}
                            isActive={isStep3Active}
                            isCompleted={isStep3Completed}
                            onSessionChange={(nextSession) =>
                              setSession((prev) => ({
                                ...(prev ?? nextSession),
                                ...nextSession,
                              }))
                            }
                            onComplete={(nextSession) =>
                              setSession((prev) => ({
                                ...(prev ?? nextSession),
                                ...nextSession,
                                currentStep: Math.max(nextSession.currentStep ?? 4, 4),
                                nextAction: nextSession.nextAction || "prepare_step4",
                              }))
                            }
                            onInputHandlersReady={setStep3InputHandlers}
                          />
                        </div>
                      )}

                      {/* Step 4 - Show if step 3 is completed (always show once unlocked) */}
                      {session && isStep3Completed && (
                        <div className="mb-5">
                          <MargoStep4
                            key={`margo-step4-${session.id}`}
                            session={session}
                            isActive={isStep4Active}
                            isCompleted={isStep4Completed}
                            onSessionChange={(nextSession) =>
                              setSession((prev) => ({
                                ...(prev ?? nextSession),
                                ...nextSession,
                              }))
                            }
                            onContinue={() =>
                              setSession((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      currentStep: Math.max(prev.currentStep ?? 4, 4) + 1,
                                      nextAction: "step5_ready",
                                    }
                                  : prev
                              )
                            }
                          />
                        </div>
                      )}

                      {/* Step 5 - Show if step 4 is completed (always show once unlocked) */}
                      {session && isStep4Completed && (
                        <div className="mb-5">
                          <MargoStep5
                            key={`margo-step5-${session.id}`}
                            session={session}
                            isActive={isStep5Active}
                            isCompleted={isStep5Completed}
                            onSessionChange={(nextSession) =>
                              setSession((prev) => ({
                                ...(prev ?? nextSession),
                                ...nextSession,
                              }))
                            }
                            onContinue={() =>
                              setSession((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      currentStep: Math.max(prev.currentStep ?? 0, 6),
                                      nextAction: "step6_ready",
                                    }
                                  : prev
                              )
                            }
                          />
                        </div>
                      )}

                      {/* Step 6 - Show if step 5 is completed (always show once unlocked) */}
                      {session && isStep5Completed && (
                        <div className="mb-5">
                          <MargoStep6
                            key={`margo-step6-${session.id}`}
                            session={session}
                            isActive={isStep6Active}
                            onSessionChange={(nextSession) =>
                              setSession((prev) => ({
                                ...(prev ?? nextSession),
                                ...nextSession,
                              }))
                            }
                            onContinue={() =>
                              setSession((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      currentStep: Math.max(prev.currentStep ?? 6, 6) + 1,
                                      nextAction: "step7_ready",
                                    }
                                  : prev
                              )
                            }
                          />
                        </div>
                      )}

                      {/* Step 7 - Show if step 6 is completed (always show once unlocked) */}
                      {session && isStep6Completed && (
                        <MargoStep7
                          key={`margo-step7-${session.id}`}
                          session={session}
                          isActive={isStep7Active || !hasCompletedBrief}
                          isCompleted={isStep7Completed}
                          state={step7State}
                          onStateChange={(updater) => setStep7State((prev) => updater(prev))}
                          onSessionChange={(nextSession) =>
                            setSession((prev) => ({
                              ...(prev ?? nextSession),
                              ...nextSession,
                            }))
                          }
                          onStartNew={handleResetProgress}
                          onComplete={(sections) => {
                            setFinalBriefSections(sections);
                            setSession((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    currentStep: Math.max(prev.currentStep ?? 7, 7),
                                    nextAction: "step7_complete",
                                  }
                                : prev
                            );
                          }}
                        />
                      )}

                      {isStep7Completed && hasCompletedBrief && (
                        <div className="margo-chat-bubble margo-chat-bubble--bot">
                          <div className="margo-message-content">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-gray-600" />
                                <h3 className="text-lg font-semibold text-gray-900">
                                  Congratulations! Your Product Positioning Brief is ready.
                                </h3>
                              </div>
                              <p className="text-sm text-gray-600">
                                Share it with the team, export it, or start a brand new MARGO journey whenever you're ready.
                              </p>
                              {finalBriefSections.length > 0 && (
                                <div className="space-y-3 mt-4">
                                  {finalBriefSections.map((section, index) => (
                                    <div key={section.id || `final-${index}`} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                      <p className="text-xs font-medium text-gray-500 mb-1">{`Section ${index + 1}`}</p>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2">{section.title || `Section ${index + 1}`}</h4>
                                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-normal">
                                        {convertMarkdownToPlainText(section.content) || "Draft content saved."}
                                      </pre>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-col gap-3 pt-4 border-t border-gray-200 sm:flex-row sm:items-center sm:justify-between">
                                <span className="text-xs text-gray-500">
                                  Every section is stored in your workspace and ready for Amplifier collaboration.
                                </span>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <Button
                                    type="button"
                                    onClick={handleDownloadFinalBrief}
                                    disabled={isDownloadingBrief}
                                    variant="outline"
                                    className="margo-soft-button margo-soft-button--outline"
                                  >
                                    {isDownloadingBrief ? (
                                      <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Preparing PDF…
                                      </>
                                    ) : (
                                      "Download PDF"
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={handleResetProgress}
                                    className="margo-soft-button"
                                  >
                                    Start a new MARGO
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div ref={chatEndRef} className="h-4" />
            </div>
          </div>
        </main>

        {/* Unified chat input at bottom - reusable across steps */}
        {(step1InputHandlers || step3InputHandlers) && (
          <div className="fixed bottom-0 right-0 z-50 w-[82%] bg-white px-16">
            <div className="px-4 py-4">
              <div className="mx-auto flex flex-col">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative w-[40%] bg-red-50 rounded-xl">
                    <Textarea
                      ref={inputRef}
                      value={(step1InputHandlers || step3InputHandlers)?.inputValue || ""}
                      onChange={(e) => {
                        const handlers = step1InputHandlers || step3InputHandlers;
                        handlers?.onInputChange(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          const handlers = step1InputHandlers || step3InputHandlers;
                          if (handlers?.inputValue.trim() && !handlers.isSubmitting) {
                            handlers.onInputSubmit();
                          }
                        }
                      }}
                      placeholder={(step1InputHandlers || step3InputHandlers)?.placeholder || ""}
                      disabled={(step1InputHandlers || step3InputHandlers)?.isSubmitting || false}
                      className="min-h-[56px] max-h-[200px] resize-none bg-white border-2 border-gray-300 focus:border-gray-400 focus:ring-gray-400 rounded-xl text-sm px-4 shadow-sm transition-all disabled:bg-gray-50 disabled:opacity-50"
                      rows={1}
                      style={{ 
                        paddingTop: '18px',
                        paddingBottom: '18px',
                        lineHeight: '1.25'
                      }}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      const handlers = step1InputHandlers || step3InputHandlers;
                      handlers?.onInputSubmit();
                    }}
                    disabled={!((step1InputHandlers || step3InputHandlers)?.inputValue.trim()) || ((step1InputHandlers || step3InputHandlers)?.isSubmitting || false)}
                    size="icon"
                    className="h-14 w-14 bg-gray-900 hover:bg-gray-800 text-white shrink-0 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {(step1InputHandlers || step3InputHandlers)?.isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                <div className="text-xs text-gray-500 mt-2 text-center">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] border border-gray-300">Enter</kbd> to send • <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] border border-gray-300">Shift+Enter</kbd> new line
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reset Progress Confirmation Modal */}
      <ResetProgressConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        workspaceName={currentWorkspaceName}
        onConfirm={confirmResetProgress}
      />
    </div>
  );
};

export default Margo;
