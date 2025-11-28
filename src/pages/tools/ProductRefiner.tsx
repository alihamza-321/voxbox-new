import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RotateCcw, Send, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import avaAvatar from "@/assets/ava-avatar.png";
import { clearProductRefinerStore } from "@/stores/productRefinerStore";
import { ProductRefinerStep1, type ProductRefinerStep1InputHandlers } from "@/components/product-refiner/ProductRefinerStep1";
import { ProductRefinerStep2, type ProductRefinerStep2InputHandlers, type ProductRefinerStep2PersistedState } from "@/components/product-refiner/ProductRefinerStep2";
import { ProductRefinerStep3 } from "@/components/product-refiner/ProductRefinerStep3";
import { ProductRefinerStep4, type ProductRefinerStep4InputHandlers, type ProductRefinerStep4PersistedState } from "@/components/product-refiner/ProductRefinerStep4";
import { ProductRefinerStep5, type ProductRefinerStep5InputHandlers } from "@/components/product-refiner/ProductRefinerStep5";
import { ProductRefinerStep6, type ProductRefinerStep6InputHandlers } from "@/components/product-refiner/ProductRefinerStep6";
import { ProductRefinerStep7, type ProductRefinerStep7InputHandlers } from "@/components/product-refiner/ProductRefinerStep7";
import { ProductRefinerStep8, type ProductRefinerStep8InputHandlers } from "@/components/product-refiner/ProductRefinerStep8";
import { ProductRefinerStep9, type ProductRefinerStep9InputHandlers } from "@/components/product-refiner/ProductRefinerStep9";
import { ProductRefinerStep10 } from "@/components/product-refiner/ProductRefinerStep10";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import { deleteProductRefinerSession } from "@/lib/product-refiner-api";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const PRODUCT_REFINER_STORAGE_PREFIX = "product-refiner-state";
const PRODUCT_REFINER_SCROLL_STORAGE_PREFIX = "product-refiner-scroll";

const getStorageKey = (workspaceId: string) => `${PRODUCT_REFINER_STORAGE_PREFIX}-${workspaceId}`;
const getScrollStorageKey = (workspaceId: string) => `${PRODUCT_REFINER_SCROLL_STORAGE_PREFIX}-${workspaceId}`;

import type { StepPersistedState } from '@/stores/productRefinerStore';

interface ProductRefinerUiState {
  step2?: ProductRefinerStep2PersistedState | null;
  step3?: { hasGenerated: boolean } | null;
  step4?: StepPersistedState | null;
  step5?: StepPersistedState | null;
  step6?: StepPersistedState | null;
  step7?: StepPersistedState | null;
  step8?: StepPersistedState | null;
  step9?: StepPersistedState | null;
}

interface PersistedProductRefinerState {
  session: ProductRefinerSession | null;
  lastUpdated: string;
  uiState?: ProductRefinerUiState;
}

interface PersistedScrollPosition {
  scrollTop: number;
  lastUpdated: string;
}

const ProductRefiner = () => {
  const navigate = useNavigate();
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [session, setSession] = useState<ProductRefinerSession | null>(null);
  const [uiState, setUiState] = useState<ProductRefinerUiState>({});
  const [needsWorkspace, setNeedsWorkspace] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isRestoringState, setIsRestoringState] = useState(true);
  const [step1InputHandlers, setStep1InputHandlers] = useState<ProductRefinerStep1InputHandlers | null>(null);
  const [step2InputHandlers, setStep2InputHandlers] = useState<ProductRefinerStep2InputHandlers | null>(null);
  const [step4InputHandlers, setStep4InputHandlers] = useState<ProductRefinerStep4InputHandlers | null>(null);
  const [step5InputHandlers, setStep5InputHandlers] = useState<ProductRefinerStep5InputHandlers | null>(null);
  const [step6InputHandlers, setStep6InputHandlers] = useState<ProductRefinerStep6InputHandlers | null>(null);
  const [step7InputHandlers, setStep7InputHandlers] = useState<ProductRefinerStep7InputHandlers | null>(null);
  const [step8InputHandlers, setStep8InputHandlers] = useState<ProductRefinerStep8InputHandlers | null>(null);
  const [step9InputHandlers, setStep9InputHandlers] = useState<ProductRefinerStep9InputHandlers | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [isHeaderElevated, setIsHeaderElevated] = useState(false);

  // Determine which input handlers to use (prioritize by step order)
  const activeInputHandlers = step9InputHandlers || step8InputHandlers || step7InputHandlers || step6InputHandlers || step5InputHandlers || step4InputHandlers || step2InputHandlers || step1InputHandlers;

  // Debug: Log when input handlers change
  useEffect(() => {
    console.log('[ProductRefiner] step1InputHandlers changed:', {
      hasHandlers: !!step1InputHandlers,
      inputValue: step1InputHandlers?.inputValue,
      placeholder: step1InputHandlers?.placeholder,
      isSubmitting: step1InputHandlers?.isSubmitting,
    });
  }, [step1InputHandlers]);

  useEffect(() => {
    console.log('[ProductRefiner] step2InputHandlers changed:', {
      hasHandlers: !!step2InputHandlers,
      inputValue: step2InputHandlers?.inputValue,
      placeholder: step2InputHandlers?.placeholder,
      isSubmitting: step2InputHandlers?.isSubmitting,
      currentQuestionKey: step2InputHandlers?.currentQuestionKey,
    });
  }, [step2InputHandlers]);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const restoredWorkspaceRef = useRef<string | null>(null);
  const pendingScrollPositionRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const [headerHeight, setHeaderHeight] = useState(0);

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
        const parsed = JSON.parse(raw) as PersistedProductRefinerState;
        setSession(parsed?.session ?? null);
        setUiState(parsed?.uiState ?? {});
      } else {
        setSession(null);
        setUiState({});
      }
    } catch (error) {
      console.error("Failed to restore Product Refiner state from storage:", error);
      setSession(null);
      setUiState({});
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
        console.error("Failed to clear persisted Product Refiner state:", error);
      }
      return;
    }

    const payload: PersistedProductRefinerState = {
      session,
      lastUpdated: new Date().toISOString(),
      uiState,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist Product Refiner state:", error);
    }
  }, [session, workspaceId, isRestoringState, uiState]);

  const clearPersistedState = useCallback(() => {
    if (!workspaceId || typeof window === "undefined") {
      return;
    }

    try {
      localStorage.removeItem(getStorageKey(workspaceId));
    } catch (error) {
      console.error("Failed to clear persisted Product Refiner state:", error);
    }
  }, [workspaceId]);

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


  // Step completion flags
  const isStep1Completed = session?.step1Completed ?? false;
  const isStep2Completed = session?.step2Completed ?? false;
  const isStep3Completed = session?.step3Completed ?? false;
  const isStep4Completed = session?.step4Completed ?? false;
  const isStep5Completed = session?.step5Completed ?? false;
  const isStep6Completed = session?.step6Completed ?? false;
  const isStep7Completed = session?.step7Completed ?? false;
  const isStep8Completed = session?.step8Completed ?? false;
  const isStep9Completed = session?.step9Completed ?? false;
  const isStep10Completed = session?.step10Completed ?? false;

  // Step active flags
  const isStep2Active = useMemo(() => {
    if (!session || isStep2Completed) return false;
    return isStep1Completed && session.currentStep >= 2;
  }, [session, isStep1Completed, isStep2Completed]);

  const isStep3Active = useMemo(() => {
    if (!session || isStep3Completed) return false;
    // As soon as Step 2 is completed we treat Step 3 as active (even if the backend
    // has not yet advanced currentStep). This ensures that refreshes while the
    // “Analyzing your product...” message is shown will still re-trigger the API call.
    return isStep2Completed && !isStep3Completed;
  }, [session, isStep2Completed, isStep3Completed]);

  const isStep4Active = useMemo(() => {
    if (!session || isStep4Completed) return false;
    return isStep3Completed && session.currentStep >= 4;
  }, [session, isStep3Completed, isStep4Completed]);

  const isStep5Active = useMemo(() => {
    if (!session || isStep5Completed) return false;
    return isStep4Completed && session.currentStep >= 5;
  }, [session, isStep4Completed, isStep5Completed]);

  const isStep6Active = useMemo(() => {
    if (!session || isStep6Completed) return false;
    return isStep5Completed && session.currentStep >= 6;
  }, [session, isStep5Completed, isStep6Completed]);

  const isStep7Active = useMemo(() => {
    if (!session || isStep7Completed) return false;
    return isStep6Completed && session.currentStep >= 7;
  }, [session, isStep6Completed, isStep7Completed]);

  const isStep8Active = useMemo(() => {
    if (!session || isStep8Completed) return false;
    return isStep7Completed && session.currentStep >= 8;
  }, [session, isStep7Completed, isStep8Completed]);

  const isStep9Active = useMemo(() => {
    if (!session || isStep9Completed) return false;
    return isStep8Completed && session.currentStep >= 9;
  }, [session, isStep8Completed, isStep9Completed]);

  const isStep10Active = useMemo(() => {
    if (!session || isStep10Completed) return false;
    return isStep9Completed && session.currentStep >= 10;
  }, [session, isStep9Completed, isStep10Completed]);

  const totalSteps = 10;

  const currentStepNumber = useMemo(() => {
    if (isStep10Active) return 10;
    if (isStep10Completed) return 10;
    if (isStep9Active) return 9;
    if (isStep8Active) return 8;
    if (isStep7Active) return 7;
    if (isStep6Active) return 6;
    if (isStep5Active) return 5;
    if (isStep4Active) return 4;
    if (isStep3Active) return 3;
    if (isStep2Active) return 2;

    let completedStep = 1;
    if (isStep1Completed) completedStep = Math.max(completedStep, 2);
    if (isStep2Completed) completedStep = Math.max(completedStep, 3);
    if (isStep3Completed) completedStep = Math.max(completedStep, 4);
    if (isStep4Completed) completedStep = Math.max(completedStep, 5);
    if (isStep5Completed) completedStep = Math.max(completedStep, 6);
    if (isStep6Completed) completedStep = Math.max(completedStep, 7);
    if (isStep7Completed) completedStep = Math.max(completedStep, 8);
    if (isStep8Completed) completedStep = Math.max(completedStep, 9);
    if (isStep9Completed) completedStep = Math.max(completedStep, 10);
    if (isStep10Completed) completedStep = Math.max(completedStep, 10);

    const sessionStep = Math.min(session?.currentStep ?? 1, totalSteps);
    return Math.max(completedStep, sessionStep);
  }, [
    isStep2Active,
    isStep3Active,
    isStep4Active,
    isStep5Active,
    isStep6Active,
    isStep7Active,
    isStep8Active,
    isStep9Active,
    isStep10Active,
    isStep1Completed,
    isStep2Completed,
    isStep3Completed,
    isStep4Completed,
    isStep5Completed,
    isStep6Completed,
    isStep7Completed,
    isStep8Completed,
    isStep9Completed,
    isStep10Completed,
    session?.currentStep,
  ]);

  const clampedCurrentStep = useMemo(
    () => Math.min(Math.max(currentStepNumber, 1), totalSteps),
    [currentStepNumber, totalSteps]
  );

  const currentWorkspaceName = currentWorkspace?.name ?? "Select a workspace";

  const getProgressValue = useMemo(() => {
    if (!session) return 0;
    
    let completedCount = 0;
    if (isStep1Completed) completedCount++;
    if (isStep2Completed) completedCount++;
    if (isStep3Completed) completedCount++;
    if (isStep4Completed) completedCount++;
    if (isStep5Completed) completedCount++;
    if (isStep6Completed) completedCount++;
    if (isStep7Completed) completedCount++;
    if (isStep8Completed) completedCount++;
    if (isStep9Completed) completedCount++;
    if (isStep10Completed) completedCount++;
    
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
    isStep7Completed,
    isStep8Completed,
    isStep9Completed,
    isStep10Completed,
    totalSteps,
  ]);

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
      console.error("Failed to restore Product Refiner scroll position:", error);
      pendingScrollPositionRef.current = null;
    }
  }, [workspaceId]);

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
    session?.id,
    session?.currentStep,
    restoreScrollPosition,
    scrollToBottom,
  ]);

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
        console.error("Failed to persist Product Refiner scroll position:", error);
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

  // Auto-scroll on content resize (but not when user is typing in a form field)
  useEffect(() => {
    if (!chatContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      // Don't auto-scroll if user is currently focused on an input or textarea
      const activeElement = document.activeElement;
      const isTypingInForm = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.closest('input') ||
        activeElement.closest('textarea')
      );
      
      // Don't auto-scroll if user has manually scrolled up (check if near bottom)
      const container = chatContainerRef.current;
      if (container) {
        const usesContainerScroll = container.scrollHeight > container.clientHeight + 1;
        if (usesContainerScroll) {
          const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
          // Only auto-scroll if user is not typing AND is near bottom
          if (!isTypingInForm && isNearBottom) {
            scrollToBottom("auto");
          }
        } else {
          // Window scroll
          const isNearBottom = (document.documentElement.scrollHeight - window.scrollY - window.innerHeight) < 100;
          if (!isTypingInForm && isNearBottom) {
            scrollToBottom("auto");
          }
        }
      }
    });
    observer.observe(chatContainerRef.current);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  useEffect(() => {
    let rafId: number | null = null;
    let lastHeight = 0;
    
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const newHeight = headerRef.current.getBoundingClientRect().height;
        // Only update if height actually changed (prevent infinite loops)
        if (Math.abs(newHeight - lastHeight) > 0.5) {
          lastHeight = newHeight;
          setHeaderHeight(newHeight);
        }
      }
    };

    const throttledUpdate = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updateHeaderHeight);
    };

    updateHeaderHeight();

    const observer = new ResizeObserver(throttledUpdate);
    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    window.addEventListener("resize", throttledUpdate);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      window.removeEventListener("resize", throttledUpdate);
    };
  }, []);

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

  // Auto-height textarea with max-height container
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement> | React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };

  const handleStep2UiStateChange = useCallback(
    (state: ProductRefinerStep2PersistedState | null) => {
      setUiState((prev) => {
        if (!state) {
          const next = { ...prev };
          delete next.step2;
          return next;
        }
        return { ...prev, step2: state };
      });
    },
    []
  );

  const handleStep3UiStateChange = useCallback(
    (state: { hasGenerated: boolean } | null) => {
      setUiState((prev) => {
        if (!state) {
          const next = { ...prev };
          delete next.step3;
          return next;
        }
        return { ...prev, step3: state };
      });
    },
    []
  );

  const handleStep4UiStateChange = useCallback(
    (state: ProductRefinerStep4PersistedState | null) => {
      setUiState((prev) => {
        if (!state) {
          const next = { ...prev };
          delete next.step4;
          return next;
        }
        return { ...prev, step4: state };
      });
    },
    []
  );

  const handleStep5UiStateChange = useCallback(
    (state: StepPersistedState | null) => {
      setUiState((prev) => {
        if (!state) {
          const next = { ...prev };
          delete next.step5;
          return next;
        }
        return { ...prev, step5: state };
      });
    },
    []
  );

  const handleStep6UiStateChange = useCallback(
    (state: StepPersistedState | null) => {
      setUiState((prev) => {
        if (!state) {
          const next = { ...prev };
          delete next.step6;
          return next;
        }
        return { ...prev, step6: state };
      });
    },
    []
  );

  const handleStep7UiStateChange = useCallback(
    (state: StepPersistedState | null) => {
      setUiState((prev) => {
        if (!state) {
          const next = { ...prev };
          delete next.step7;
          return next;
        }
        return { ...prev, step7: state };
      });
    },
    []
  );

  const handleStep8UiStateChange = useCallback(
    (state: StepPersistedState | null) => {
      setUiState((prev) => {
        if (!state) {
          const next = { ...prev };
          delete next.step8;
          return next;
        }
        return { ...prev, step8: state };
      });
    },
    []
  );

  const handleStep9UiStateChange = useCallback(
    (state: StepPersistedState | null) => {
      setUiState((prev) => {
        if (!state) {
          const next = { ...prev };
          delete next.step9;
          return next;
        }
        return { ...prev, step9: state };
      });
    },
    []
  );

  const handleResetProgress = useCallback(async () => {
    if (isRestoringState) {
      return;
    }
    
    // Delete session via API if it exists (like AVA Profile does)
    const currentSessionId = session?.id;
    if (currentSessionId) {
      try {
        await deleteProductRefinerSession(currentSessionId);
        console.log('✅ Product Refiner session deleted via API');
      } catch (error) {
        console.error('❌ Failed to delete session:', error);
        // Continue with reset even if delete fails
      }
    }
    
    // Clear all input handlers
    setStep1InputHandlers(null);
    setStep2InputHandlers(null);
    setStep4InputHandlers(null);
    setStep5InputHandlers(null);
    setStep6InputHandlers(null);
    setStep7InputHandlers(null);
    setStep8InputHandlers(null);
    setStep9InputHandlers(null);
    setUiState({});
    
    // Clear Zustand store instance and localStorage for this workspace
    if (workspaceId) {
      try {
        // Clear the store instance (in-memory cache)
        clearProductRefinerStore(workspaceId);
        
        // Clear localStorage
        if (typeof window !== "undefined") {
          const zustandStorageKey = `product-refiner-store-${workspaceId}`;
          localStorage.removeItem(zustandStorageKey);
        }
      } catch (error) {
        console.error("Failed to clear Zustand store:", error);
      }
    }
    
    // Clear localStorage for this workspace (main state)
    clearPersistedState();
    
    // Clear scroll storage for this workspace
    if (workspaceId && typeof window !== "undefined") {
      try {
        const scrollStorageKey = getScrollStorageKey(workspaceId);
        localStorage.removeItem(scrollStorageKey);
      } catch (error) {
        console.error("Failed to clear scroll storage:", error);
      }
    }
    
    // Reset session completely - this ensures a fresh start
    setSession(null);
    setSessionError(null);
    
    // Reset restored workspace ref to allow fresh restoration
    restoredWorkspaceRef.current = null;
  }, [isRestoringState, workspaceId, clearPersistedState, session?.id]);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-white">
      <div className="mx-auto flex h-full w-full flex-col">
        <header
          ref={headerRef}
          className={`sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur transition-transform duration-300 ${
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
          <div className="mx-16 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => navigate("/tools/products")}
                  className="border-[#ff1f6c]/20 bg-white text-foreground hover:bg-[#ffe8f1] hover:text-[#ff1f6c] hover:border-[#ff1f6c]/40 transition-all duration-300 ease-in-out hover:shadow-md hover:shadow-[#ff1f6c]/10 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden bg-gray-100">
                  <img 
                    src={avaAvatar} 
                    alt="Product Refiner Avatar" 
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-gray-900">Product Refiner</h1>
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
                  title="Reset Product Refiner progress"
                  className="h-8 w-8 text-gray-500 hover:text-gray-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="sr-only">Reset Product Refiner progress</span>
                </Button>
              </div>
            </div>
          </div>
          {session && (
            <div className="mx-16 px-4 pb-3">
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

        <main 
          className={`flex flex-1 flex-col overflow-hidden bg-white mx-16`} 
          style={{
            '--ava-avatar-url': `url(${avaAvatar})`,
          } as React.CSSProperties}
        >
          <div 
            ref={chatContainerRef} 
            className={`flex-1 overflow-y-auto px-4`}
            style={{ paddingBottom: activeInputHandlers ? '120px' : '0' }}
          >
            <div className="mx-auto flex w-full flex-col">
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content">
                  I'll guide you through refining your product into a complete, strong, and confidently positioned offer.
                </div>
              </div>

              {workspaceLoading && (
                <div className="margo-chat-bubble margo-chat-bubble--bot">
                  <div className="margo-message-content">
                    <div className="flex items-start gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Loading workspace…</p>
                        <p className="text-sm text-gray-600 mt-1">Preparing your Product Refiner environment.</p>
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
                      Product Refiner works inside a specific workspace. Choose one from the workspace switcher to activate this journey.
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
                            <p className="text-sm text-gray-600 mt-1">Fetching your saved Product Refiner session for this workspace.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isRestoringState && (
                    <>
                      {workspaceId && (
                        <div className="mb-4 pb-20">
                          <ProductRefinerStep1
                            key={`product-refiner-step1-${workspaceId}`}
                            workspaceId={workspaceId}
                            session={session}
                            onSessionChange={setSession}
                            onErrorChange={setSessionError}
                            isCompleted={isStep1Completed}
                            onInputHandlersReady={setStep1InputHandlers}
                          />
                        </div>
                      )}

                      {workspaceId && session && isStep1Completed && (
                        <div className="mb-2">
                          <ProductRefinerStep2
                            key={`product-refiner-step2-${session.id}`}
                            workspaceId={workspaceId}
                            session={session}
                            isActive={isStep2Active}
                            isCompleted={isStep2Completed}
                            isUnlocked={isStep1Completed}
                            onSessionChange={setSession}
                            onError={setSessionError}
                            onInputHandlersReady={setStep2InputHandlers}
                            persistedState={uiState.step2 ?? null}
                            onPersistedStateChange={handleStep2UiStateChange}
                          />
                        </div>
                      )}

                      {workspaceId && session && isStep2Completed && (
                        <div className="mb-2">
                          <ProductRefinerStep3
                            key={`product-refiner-step3-${session.id}`}
                            workspaceId={workspaceId}
                            session={session}
                            isActive={isStep3Active}
                            isCompleted={isStep3Completed}
                            isUnlocked={isStep2Completed}
                            onSessionChange={setSession}
                            onError={setSessionError}
                            persistedState={uiState.step3 ?? null}
                            onPersistedStateChange={handleStep3UiStateChange}
                          />
                        </div>
                      )}

                      {workspaceId && session && isStep3Completed && (
                        <div className="mb-2">
                          <ProductRefinerStep4
                            key={`product-refiner-step4-${session.id}`}
                            workspaceId={workspaceId}
                            session={session}
                            isActive={isStep4Active}
                            isCompleted={isStep4Completed}
                            isUnlocked={isStep3Completed}
                            onSessionChange={setSession}
                            onError={setSessionError}
                            onInputHandlersReady={setStep4InputHandlers}
                            persistedState={uiState.step4 ?? null}
                            onPersistedStateChange={handleStep4UiStateChange}
                          />
                        </div>
                      )}

                      {workspaceId && session && isStep4Completed && (
                        <div className="mb-2">
                          <ProductRefinerStep5
                            key={`product-refiner-step5-${session.id}`}
                            workspaceId={workspaceId}
                            session={session}
                            isActive={isStep5Active}
                            isCompleted={isStep5Completed}
                            isUnlocked={isStep4Completed}
                            onSessionChange={setSession}
                            onError={setSessionError}
                            onInputHandlersReady={setStep5InputHandlers}
                            persistedState={uiState.step5 ?? null}
                            onPersistedStateChange={handleStep5UiStateChange}
                          />
                        </div>
                      )}

                      {workspaceId && session && isStep5Completed && (
                        <div className="mb-5">
                          <ProductRefinerStep6
                            key={`product-refiner-step6-${session.id}`}
                            workspaceId={workspaceId}
                            session={session}
                            isActive={isStep6Active}
                            isCompleted={isStep6Completed}
                            isUnlocked={isStep5Completed}
                            onSessionChange={setSession}
                            onError={setSessionError}
                            onInputHandlersReady={setStep6InputHandlers}
                            persistedState={uiState.step6 ?? null}
                            onPersistedStateChange={handleStep6UiStateChange}
                          />
                        </div>
                      )}

                      {workspaceId && session && isStep6Completed && (
                        <div className="mb-5">
                          <ProductRefinerStep7
                            key={`product-refiner-step7-${session.id}`}
                            workspaceId={workspaceId}
                            session={session}
                            isActive={isStep7Active}
                            isCompleted={isStep7Completed}
                            isUnlocked={isStep6Completed}
                            onSessionChange={setSession}
                            onError={setSessionError}
                            onInputHandlersReady={setStep7InputHandlers}
                            persistedState={uiState.step7 ?? null}
                            onPersistedStateChange={handleStep7UiStateChange}
                          />
                        </div>
                      )}

                      {workspaceId && session && isStep7Completed && (
                        <div className="mb-5">
                          <ProductRefinerStep8
                            key={`product-refiner-step8-${session.id}`}
                            workspaceId={workspaceId}
                            session={session}
                            isActive={isStep8Active}
                            isCompleted={isStep8Completed}
                            isUnlocked={isStep7Completed}
                            onSessionChange={setSession}
                            onError={setSessionError}
                            onInputHandlersReady={setStep8InputHandlers}
                            persistedState={uiState.step8 ?? null}
                            onPersistedStateChange={handleStep8UiStateChange}
                          />
                        </div>
                      )}

                      {workspaceId && session && isStep8Completed && (
                        <div className="mb-5">
                          <ProductRefinerStep9
                            key={`product-refiner-step9-${session.id}`}
                            workspaceId={workspaceId}
                            session={session}
                            isActive={isStep9Active}
                            isCompleted={isStep9Completed}
                            isUnlocked={isStep8Completed}
                            onSessionChange={setSession}
                            onError={setSessionError}
                            onInputHandlersReady={setStep9InputHandlers}
                            persistedState={uiState.step9 ?? null}
                            onPersistedStateChange={handleStep9UiStateChange}
                          />
                        </div>
                      )}

                      {workspaceId && session && isStep9Completed && (
                        <div className="mb-5">
                          <ProductRefinerStep10
                            key={`product-refiner-step10-${session.id}`}
                            workspaceId={workspaceId}
                            session={session}
                            isActive={isStep10Active}
                            isCompleted={isStep10Completed}
                            isUnlocked={isStep9Completed}
                            onSessionChange={setSession}
                            onError={setSessionError}
                          />
                        </div>
                      )}

                    </>
                  )}
                </>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>
        </main>

        {/* Unified chat input at bottom - reusable across steps */}
        {activeInputHandlers && (
          <div className="fixed bottom-0 right-0 z-50 w-[82%] bg-white px-16 border-t border-gray-200">
            <div className="px-4 py-4">
              <div className="mx-auto flex flex-col" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
                <div className="flex gap-3 w-full" style={{ alignItems: 'flex-start' }}>
                  <div className="flex-1 relative">
                    {/* Input wrapper with max-height and overflow */}
                    <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      <Textarea
                        id="product-refiner-unified-input"
                        ref={inputRef}
                        value={activeInputHandlers.inputValue || ""}
                        onChange={(e) => {
                          activeInputHandlers.onInputChange(e.target.value);
                        }}
                        onInput={handleTextareaInput}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            console.log('[ProductRefiner] Enter key pressed, calling onInputSubmit');
                            // Allow submission if there's text, blank (for optional questions), or if current question exists
                            // For optional questions, blank submission is allowed (handled by individual steps)
                            if ((activeInputHandlers.inputValue || (activeInputHandlers as any).currentQuestionKey) && !activeInputHandlers.isSubmitting) {
                              activeInputHandlers.onInputSubmit();
                            }
                          }
                        }}
                        placeholder={activeInputHandlers.placeholder || ""}
                        disabled={activeInputHandlers.isSubmitting || false}
                        className="flex w-full px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed resize-none bg-white border-2 rounded-xl text-sm pr-14 shadow-sm transition-all disabled:bg-gray-50 disabled:opacity-50"
                        style={{
                          height: 'auto',
                          minHeight: '56px',
                          maxHeight: '200px',
                          overflowY: 'hidden',
                          ...((activeInputHandlers as any).validationError 
                            ? { borderColor: '#ef4444' } 
                            : { borderColor: '#d1d5db' })
                        }}
                        rows={1}
                      />
                    </div>
                    {/* Validation (fixed-height to prevent jumping) */}
                    <div className="text-xs mt-1 ml-1 text-red-600 min-h-[18px]">
                      {((activeInputHandlers as any).validationError ||
                        (activeInputHandlers as any).validationHint) && (
                        <span>
                          {(activeInputHandlers as any).validationError ||
                            (activeInputHandlers as any).validationHint}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      console.log('[ProductRefiner] Button clicked!', {
                        hasHandler: !!activeInputHandlers.onInputSubmit,
                        inputValue: activeInputHandlers.inputValue,
                        isSubmitting: activeInputHandlers.isSubmitting,
                        currentQuestionKey: (activeInputHandlers as any).currentQuestionKey,
                      });
                      // Allow submission even with blank input for optional questions
                      if (!activeInputHandlers.isSubmitting && (activeInputHandlers.inputValue || (activeInputHandlers as any).currentQuestionKey)) {
                        activeInputHandlers.onInputSubmit();
                      }
                    }}
                    disabled={activeInputHandlers.isSubmitting}
                    size="icon"
                    className="h-14 w-14 bg-gray-900 hover:bg-gray-800 text-white shrink-0 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {activeInputHandlers.isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                <div className="text-xs text-gray-500 mt-2 text-center w-full">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] border border-gray-300">Enter</kbd> to send • <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] border border-gray-300">Shift+Enter</kbd> new line
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductRefiner;

