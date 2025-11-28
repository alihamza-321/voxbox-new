import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RotateCcw, Send, ArrowLeft, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  VeraStep1,
  type VeraStep1InputHandlers,
  type VeraStep1PersistedState,
} from "@/components/vera/VeraStep1";
import { VeraStep2, type VeraStep2InputHandlers } from "@/components/vera/VeraStep2";
import { VeraStep3 } from "@/components/vera/VeraStep3";
import { VeraStep4, type VeraStep4InputHandlers } from "@/components/vera/VeraStep4";
import { VeraStep5 } from "@/components/vera/VeraStep5";
import { VeraStep6, type VeraStep6InputHandlers } from "@/components/vera/VeraStep6";
import { VeraStep7, type VeraStep7InputHandlers } from "@/components/vera/VeraStep7";
import { VeraStep8 } from "@/components/vera/VeraStep8";
import { VeraStep9 } from "@/components/vera/VeraStep9";
import { VeraStep10 } from "@/components/vera/VeraStep10";
import type { VeraProfile } from "@/lib/vera-api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import avaAvatar from "@/assets/ava-avatar.png";

const VERA_STORAGE_PREFIX = "vera-state";
const VERA_SCROLL_STORAGE_PREFIX = "vera-scroll";

const getStorageKey = (workspaceId: string) => `${VERA_STORAGE_PREFIX}-${workspaceId}`;
const getScrollStorageKey = (workspaceId: string) =>
  `${VERA_SCROLL_STORAGE_PREFIX}-${workspaceId}`;

interface VeraUiState {
  step1?: VeraStep1PersistedState | null;
}

interface PersistedVeraState {
  profile: VeraProfile | null;
  lastUpdated: string;
  uiState?: VeraUiState;
}

interface PersistedScrollPosition {
  scrollTop: number;
  lastUpdated: string;
}

const Vera = () => {
  const navigate = useNavigate();
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const { toast } = useToast();
  const [profile, setProfile] = useState<VeraProfile | null>(null);
  const [uiState, setUiState] = useState<VeraUiState>({});
  const [needsWorkspace, setNeedsWorkspace] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isRestoringState, setIsRestoringState] = useState(true);
  const [step1InputHandlers, setStep1InputHandlers] = useState<VeraStep1InputHandlers | null>(null);
  const [step2InputHandlers, setStep2InputHandlers] = useState<VeraStep2InputHandlers | null>(null);
  const [step4InputHandlers, setStep4InputHandlers] = useState<VeraStep4InputHandlers | null>(null);
  const [step6InputHandlers, setStep6InputHandlers] = useState<VeraStep6InputHandlers | null>(null);
  const [step7InputHandlers, setStep7InputHandlers] = useState<VeraStep7InputHandlers | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [isHeaderElevated, setIsHeaderElevated] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const restoredWorkspaceRef = useRef<string | null>(null);
  const pendingScrollPositionRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const lastScrollYRef = useRef(0);
  const [headerHeight, setHeaderHeight] = useState(0);

  const workspaceId = currentWorkspace?.id ?? null;
  const currentWorkspaceName = currentWorkspace?.name ?? "Select a workspace";

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
      setProfile(null);
      setProfileError(null);
      restoredWorkspaceRef.current = null;
      setIsRestoringState(false);
      return;
    }

    setNeedsWorkspace(false);
    setProfileError(null);

    if (restoredWorkspaceRef.current === workspaceId) {
      setIsRestoringState(false);
      return;
    }

    setIsRestoringState(true);

    const storageKey = getStorageKey(workspaceId);

    try {
      const raw = localStorage.getItem(storageKey);

      if (raw) {
        const parsed = JSON.parse(raw) as PersistedVeraState;
        setProfile(parsed?.profile ?? null);
        setUiState(parsed?.uiState ?? {});
      } else {
        setProfile(null);
        setUiState({});
      }
    } catch (error) {
      console.error("Failed to restore Vera state from storage:", error);
      setProfile(null);
      setUiState({});
    } finally {
      restoredWorkspaceRef.current = workspaceId;
      // Always set restoring to false, even if profile is null
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

    if (!profile) {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.error("Failed to clear persisted Vera state:", error);
      }
      return;
    }

    const payload: PersistedVeraState = {
      profile,
      lastUpdated: new Date().toISOString(),
      uiState,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist Vera state:", error);
    }
  }, [profile, workspaceId, isRestoringState, uiState]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (typeof window === "undefined") return;

      const container = chatContainerRef.current;
      const usesContainerScroll =
        container && container.scrollHeight > container.clientHeight + 1;

      if (usesContainerScroll && container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior,
        });
      } else {
        window.scrollTo({
          top:
            document.scrollingElement?.scrollHeight ??
            document.documentElement.scrollHeight,
          behavior,
        });
      }

      chatEndRef.current?.scrollIntoView({ behavior, block: "end" });
    },
    []
  );

  const restoreScrollPosition = useCallback((scrollTop: number) => {
    if (typeof window === "undefined") return;

    const container = chatContainerRef.current;
    const usesContainerScroll =
      container && container.scrollHeight > container.clientHeight + 1;

    if (usesContainerScroll && container) {
      container.scrollTo({
        top: scrollTop,
        behavior: "auto",
      });
    } else {
      window.scrollTo({
        top: scrollTop,
        behavior: "auto",
      });
    }
  }, []);

  // Restore scroll position once state is ready; otherwise fall back to scrolling to bottom
  useEffect(() => {
    if (workspaceLoading || needsWorkspace || isRestoringState) {
      return;
    }

    const pendingScrollTop = pendingScrollPositionRef.current;

    requestAnimationFrame(() => {
      if (typeof pendingScrollTop === "number") {
        restoreScrollPosition(pendingScrollTop);
        pendingScrollPositionRef.current = null;
      } else {
        scrollToBottom();
      }
    });
  }, [
    workspaceLoading,
    needsWorkspace,
    isRestoringState,
    profile?.id,
    profile?.currentStep,
    restoreScrollPosition,
    scrollToBottom,
  ]);

  // Auto-scroll on content resize (like Product Refiner)
  useEffect(() => {
    if (!chatContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      scrollToBottom("auto");
    });
    observer.observe(chatContainerRef.current);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.getBoundingClientRect().height);
      }
    };

    updateHeaderHeight();

    const observer = new ResizeObserver(() => updateHeaderHeight());
    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    window.addEventListener("resize", updateHeaderHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, [profile]); // Re-calculate when profile changes (progress bar appears/disappears)

  // Load previously saved scroll position when workspace changes
  useEffect(() => {
    if (!workspaceId || typeof window === "undefined") {
      pendingScrollPositionRef.current = null;
      return;
    }

    const scrollStorageKey = getScrollStorageKey(workspaceId);

    try {
      const raw = localStorage.getItem(scrollStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedScrollPosition;
        if (typeof parsed?.scrollTop === "number") {
          pendingScrollPositionRef.current = parsed.scrollTop;
        }
      } else {
        pendingScrollPositionRef.current = null;
      }
    } catch (error) {
      console.error("Failed to restore Vera scroll position:", error);
      pendingScrollPositionRef.current = null;
    }
  }, [workspaceId]);

  // Persist scroll position as users move through the flow
  useEffect(() => {
    if (!workspaceId || typeof window === "undefined") {
      return;
    }

    const scrollStorageKey = getScrollStorageKey(workspaceId);
    const getCurrentScrollPosition = () => {
      const container = chatContainerRef.current;
      const usesContainerScroll =
        container && container.scrollHeight > container.clientHeight + 1;

      if (usesContainerScroll && container) {
        return container.scrollTop;
      }

      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const saveScrollPosition = (position: number) => {
      const payload: PersistedScrollPosition = {
        scrollTop: Math.max(position, 0),
        lastUpdated: new Date().toISOString(),
      };

      try {
        localStorage.setItem(scrollStorageKey, JSON.stringify(payload));
      } catch (error) {
        console.error("Failed to persist Vera scroll position:", error);
      }
    };

    let frame: number | null = null;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        saveScrollPosition(getCurrentScrollPosition());
        frame = null;
      });
    };

    const container = chatContainerRef.current;
    container?.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [workspaceId]);

  // Scroll handling for header visibility and progress bar (like Product Refiner)
  useEffect(() => {
    const container = chatContainerRef.current;
    let ticking = false;

    const getScrollPosition = () => {
      const usesContainerScroll =
        container && container.scrollHeight > container.clientHeight + 1;

      if (usesContainerScroll && container) {
        return container.scrollTop;
      }

      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const handleScroll = () => {
      if (ticking) {
        return;
      }

      window.requestAnimationFrame(() => {
        const currentScrollY = getScrollPosition();
        const lastScroll = lastScrollYRef.current;

        // Show header when scrolled to top (like Product Refiner)
        if (currentScrollY < 60) {
          setShowHeader(true);
        } else if (currentScrollY > lastScroll && currentScrollY > 120) {
          setShowHeader(false);
        }

        setIsHeaderElevated(currentScrollY > 0);
        lastScrollYRef.current = currentScrollY;
        ticking = false;
      });

      ticking = true;
    };

    handleScroll();
    container?.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleProfileChange = useCallback((updatedProfile: VeraProfile) => {
    setProfile(updatedProfile);
    setProfileError(null);
  }, []);

  const handleError = useCallback((error: string | null) => {
    setProfileError(error);
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [toast]);

  const clearPersistedState = useCallback(() => {
    if (!workspaceId || typeof window === "undefined") {
      return;
    }

    try {
      const storageKey = getStorageKey(workspaceId);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Failed to clear persisted Vera state:", error);
    }
    setUiState({});
  }, [workspaceId]);

  const handleStartNew = useCallback(() => {
    clearPersistedState();
    setProfile(null);
    setProfileError(null);
    setUiState({});
    // Reset the restored workspace ref so state restoration can run again
    restoredWorkspaceRef.current = null;
  }, [clearPersistedState]);

  const handleReset = useCallback(() => {
    if (isRestoringState) {
      return;
    }
    setStep1InputHandlers(null);
    setStep2InputHandlers(null);
    setStep4InputHandlers(null);
    setStep6InputHandlers(null);
    setStep7InputHandlers(null);
    // Clear profile and localStorage
    handleStartNew();
    // Force Step 1 to re-initialize by resetting the restored workspace ref
    // This ensures Step 1 will create a new profile instead of reusing existing one
    restoredWorkspaceRef.current = null;
  }, [isRestoringState, handleStartNew]);

  const handleStep1UiStateChange = useCallback(
    (state: VeraStep1PersistedState | null) => {
      setUiState((prev) => {
        if (!state) {
          const next = { ...prev };
          delete next.step1;
          return next;
        }
        return { ...prev, step1: state };
      });
    },
    []
  );

  const currentStep = profile?.currentStep ?? 1;
  const isComplete = profile?.isComplete ?? false;
  const clampedCurrentStep = Math.min(Math.max(currentStep, 1), 10);
  const progressPercent = profile ? Math.round((clampedCurrentStep / 10) * 100) : 0;

  const isStepCompleted = (stepNumber: number) => {
    if (isComplete) return true;
    return stepNumber < currentStep;
  };

  const isStepActive = (stepNumber: number) => {
    if (isComplete) return false;
    return stepNumber === currentStep;
  };

  // Determine which input handlers to use based on current step
  const activeInputHandlers = 
    currentStep === 1 ? step1InputHandlers :
    currentStep === 2 ? step2InputHandlers :
    currentStep === 4 ? step4InputHandlers :
    currentStep === 6 ? step6InputHandlers :
    currentStep === 7 ? step7InputHandlers :
    null;

  // Auto-resize textarea functionality (same as Product Refiner)
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const resizeTextarea = () => {
      textarea.style.height = 'auto';
      const minHeight = 56;
      const maxHeight = 200;
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    };

    resizeTextarea();
    const handleInput = () => resizeTextarea();
    textarea.addEventListener('input', handleInput);

    return () => {
      textarea.removeEventListener('input', handleInput);
    };
  }, [activeInputHandlers?.inputValue, activeInputHandlers]);

  const handleInputSubmit = useCallback(() => {
    if (activeInputHandlers && !activeInputHandlers.isSubmitting) {
      activeInputHandlers.onInputSubmit();
    }
  }, [activeInputHandlers]);

  if (isRestoringState || workspaceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-vox-pink" />
      </div>
    );
  }

  if (needsWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Workspace Required</h2>
          <p className="text-gray-600 mb-6">
            Please select a workspace to start creating your Voice Identity Profile.
          </p>
        </div>
      </div>
    );
  }

  if (!workspaceId) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <header
        ref={headerRef}
        className={`sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-md transition-transform duration-300 ${
          isHeaderElevated ? "shadow-sm" : ""
        }`}
        style={{
          backfaceVisibility: "hidden",
          willChange: "transform",
          transform: `translate3d(0, ${
            showHeader ? "0px" : `-${headerHeight + 12}px`
          }, 0)`,
        }}
      >
        <div className="mx-4 md:mx-8 lg:mx-16 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="border-[#ff1f6c]/20 bg-white text-foreground hover:bg-[#ffe8f1] hover:text-[#ff1f6c] hover:border-[#ff1f6c]/40 transition-all duration-300 ease-in-out hover:shadow-md hover:shadow-[#ff1f6c]/10 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                <img
                  src={avaAvatar}
                  alt="Vera Avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-gray-900 truncate">Vera Creator</h1>
                <p className="text-xs text-gray-500">Step {clampedCurrentStep} / 10</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/tools/vera/previous-profiles")}
                className="hidden sm:inline-flex items-center gap-2 px-3 h-8 text-sm font-medium border rounded-md bg-white text-foreground hover:bg-[#ffe8f1] hover:text-[#ff1f6c] hover:border-[#ff1f6c]/40 transition-all"
              >
                Previous Profiles
              </Button>
              <span className="text-xs text-gray-500 hidden lg:inline-block">
                {currentWorkspaceName}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleReset}
                disabled={workspaceLoading || needsWorkspace || isRestoringState}
                title="Reset Vera progress"
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="sr-only">Reset Vera progress</span>
              </Button>
            </div>
          </div>
        </div>
        {profile && (
          <div className="mx-4 md:mx-8 lg:mx-16 px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Progress</span>
              <span className="text-xs font-bold bg-gradient-to-r from-vox-pink to-vox-orange bg-clip-text text-transparent">
                {progressPercent}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-vox-pink via-vox-purple to-vox-orange transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div
        ref={chatContainerRef}
        className="w-full"
      >
        <div className="w-full px-6 sm:px-8 lg:px-12 xl:px-16 py-8">
          {profileError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {profileError}
            </div>
          )}

          {/* Step Components - Render sequentially based on current step */}
          {/* Always render Step 1 so it can initialize the profile */}
          <VeraStep1
            workspaceId={workspaceId}
            profile={profile}
            onProfileChange={handleProfileChange}
            onLoadingChange={() => {
              // Handle loading state if needed
            }}
            onErrorChange={handleError}
            isCompleted={isStepCompleted(1)}
            onInputHandlersReady={setStep1InputHandlers}
            persistedState={uiState.step1 ?? null}
            onPersistedStateChange={handleStep1UiStateChange}
          />

          {/* Render steps sequentially - only show when previous steps are completed */}
          {profile && currentStep >= 2 && (
            <VeraStep2
              workspaceId={workspaceId}
              profile={profile}
              isActive={isStepActive(2)}
              isCompleted={isStepCompleted(2)}
              onProfileChange={handleProfileChange}
              onError={handleError}
              onInputHandlersReady={setStep2InputHandlers}
            />
          )}

          {profile && currentStep >= 3 && (
            <VeraStep3
              workspaceId={workspaceId}
              profile={profile}
              isActive={isStepActive(3)}
              isCompleted={isStepCompleted(3)}
              onProfileChange={handleProfileChange}
              onError={handleError}
            />
          )}

          {profile && currentStep >= 4 && (
            <VeraStep4
              workspaceId={workspaceId}
              profile={profile}
              isActive={isStepActive(4)}
              isCompleted={isStepCompleted(4)}
              onProfileChange={handleProfileChange}
              onError={handleError}
              onInputHandlersReady={setStep4InputHandlers}
            />
          )}

          {profile && currentStep >= 5 && (
            <VeraStep5
              workspaceId={workspaceId}
              profile={profile}
              isActive={isStepActive(5)}
              isCompleted={isStepCompleted(5)}
              onProfileChange={handleProfileChange}
              onError={handleError}
            />
          )}

          {profile && currentStep >= 6 && (
            <VeraStep6
              workspaceId={workspaceId}
              profile={profile}
              isActive={isStepActive(6)}
              isCompleted={isStepCompleted(6)}
              onProfileChange={handleProfileChange}
              onError={handleError}
              onInputHandlersReady={setStep6InputHandlers}
            />
          )}

          {profile && currentStep >= 7 && (
            <VeraStep7
              workspaceId={workspaceId}
              profile={profile}
              isActive={isStepActive(7)}
              isCompleted={isStepCompleted(7)}
              onProfileChange={handleProfileChange}
              onError={handleError}
              onInputHandlersReady={setStep7InputHandlers}
            />
          )}

          {profile && currentStep >= 8 && (
            <VeraStep8
              workspaceId={workspaceId}
              profile={profile}
              isActive={isStepActive(8)}
              isCompleted={isStepCompleted(8)}
              onProfileChange={handleProfileChange}
              onError={handleError}
            />
          )}

          {profile && currentStep >= 9 && (
            <VeraStep9
              workspaceId={workspaceId}
              profile={profile}
              isActive={isStepActive(9)}
              isCompleted={isStepCompleted(9)}
              onProfileChange={handleProfileChange}
              onError={handleError}
            />
          )}

          {profile && currentStep >= 10 && (
            <VeraStep10
              workspaceId={workspaceId}
              profile={profile}
              isActive={isStepActive(10)}
              isCompleted={isStepCompleted(10)}
              onProfileChange={handleProfileChange}
              onError={handleError}
            />
          )}

          <div ref={chatEndRef} />
          {/* Add padding at bottom to prevent content from being hidden behind fixed input */}
          {activeInputHandlers && !isComplete && (
            <div className="h-24" aria-hidden />
          )}
        </div>
      </div>

      {/* Input Area - Fixed at bottom like Product Refiner */}
      {activeInputHandlers && !isComplete && (
        <div className="fixed bottom-0 right-0 z-50 w-full md:w-[82%] bg-white px-6 sm:px-8 lg:px-12 xl:px-16">
          <div className="px-4 py-4">
            <div className="mx-auto flex flex-col">
              <div className="flex gap-3 items-end">
                <div className="flex-1 relative w-[40%] rounded-xl">
                  <Textarea
                    id="vera-unified-input"
                    ref={inputRef}
                    value={activeInputHandlers.inputValue || ""}
                    onChange={(e) => {
                      activeInputHandlers.onInputChange(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (activeInputHandlers.inputValue.trim() && !activeInputHandlers.isSubmitting) {
                          activeInputHandlers.onInputSubmit();
                        }
                      }
                    }}
                    placeholder={activeInputHandlers.placeholder || ""}
                    disabled={activeInputHandlers.isSubmitting || false}
                    className={`min-h-[56px] max-h-[200px] resize-none bg-white border-2 rounded-xl text-sm pr-4 shadow-sm transition-all disabled:bg-gray-50 disabled:opacity-50 ${
                      activeInputHandlers.validationError
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:border-gray-400 focus:ring-gray-400"
                    }`}
                    rows={1}
                  />
                  {(activeInputHandlers.validationError ||
                    activeInputHandlers.validationHint) && (
                    <p className="text-xs mt-1 ml-1 text-red-600">
                      {activeInputHandlers.validationError ||
                        activeInputHandlers.validationHint}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleInputSubmit}
                  disabled={!activeInputHandlers.inputValue.trim() || activeInputHandlers.isSubmitting}
                  size="icon"
                  className="h-14 w-14 bg-gray-900 hover:bg-gray-800 text-white shrink-0 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {activeInputHandlers.isSubmitting ? (
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

      {/* Completion Message */}
      {isComplete && profile?.finalProfile && (
        <div className="border-t bg-green-50 p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">Your Voice Identity Profile is now complete.</p>
              <p className="text-sm text-green-700">Your voice identity has been saved and is ready to use across all VoxBox tools.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vera;

