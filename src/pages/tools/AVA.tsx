import { useState, useEffect, useRef, useMemo, startTransition } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AVAPhase1Interface } from "@/components/ava/chat/AVAPhase1Interface";
import { AVAPhase2ChatInterface } from "@/components/ava/chat/AVAPhase2ChatInterface";
import { AVAWelcome } from "@/components/ava/AVAWelcome";
import { AVAHeader } from "@/components/ava/chat/AVAHeader";
import { useToast } from "@/hooks/use-toast";
import { useSidebarState } from "@/hooks/useSidebarState";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import {
  createAvaSession,
  getSessionDetails,
  cancelAvaSession,
  exportProfilePDF,
} from "@/lib/ava-api";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const AVA = () => {
  const { toast } = useToast();
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const { leftOffset } = useSidebarState();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [showAvaHeader, setShowAvaHeader] = useState(() => {
    const saved = localStorage.getItem("avaHeaderVisible");
    return saved ? JSON.parse(saved) : false;
  });

  // Listen for AVA header toggle from AppNavbar
  useEffect(() => {
    const handleHeaderToggle = (e: CustomEvent) => {
      setShowAvaHeader(e.detail);
    };

    window.addEventListener("avaHeaderToggle" as any, handleHeaderToggle);
    return () => {
      window.removeEventListener("avaHeaderToggle" as any, handleHeaderToggle);
    };
  }, []);

  // Calculate scrollbar width to prevent overlap with AVAHeader
  useEffect(() => {
    const calculateScrollbarWidth = () => {
      // Create a temporary element to measure scrollbar width
      const outer = document.createElement("div");
      outer.style.visibility = "hidden";
      outer.style.overflow = "scroll";
      outer.style.msOverflowStyle = "scrollbar";
      document.body.appendChild(outer);

      const inner = document.createElement("div");
      outer.appendChild(inner);

      const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
      outer.parentNode?.removeChild(outer);

      setScrollbarWidth(scrollbarWidth);
    };

    calculateScrollbarWidth();
    window.addEventListener("resize", calculateScrollbarWidth);
    return () => window.removeEventListener("resize", calculateScrollbarWidth);
  }, []);
  const [sidebarOffset, setSidebarOffset] = useState(leftOffset);

  // Monitor sidebar width changes more reliably - directly read from sidebar element
  useEffect(() => {
    const updateSidebarOffset = () => {
      // Get sidebar element directly
      const sidebar = document.querySelector('aside[class*="fixed"]');
      if (sidebar) {
        const computedStyle = getComputedStyle(sidebar);
        const width = sidebar.offsetWidth || parseInt(computedStyle.width) || 0;
        const transform = computedStyle.transform;
        // Check if sidebar is visible (not translated off-screen on mobile)
        const isTranslatedOffScreen =
          transform &&
          transform !== "none" &&
          transform.includes("translateX(-");
        const isMobile = window.innerWidth < 768;

        if (isMobile && isTranslatedOffScreen) {
          // Sidebar is hidden on mobile
          setSidebarOffset(0);
        } else if (width > 0) {
          // Use actual sidebar width (64px collapsed, 288px expanded)
          setSidebarOffset(width);
        } else {
          // Fallback to useSidebarState value
          setSidebarOffset(leftOffset);
        }
      } else {
        // Fallback to useSidebarState value
        setSidebarOffset(leftOffset);
      }
    };

    // Initial update with small delay to ensure DOM is ready
    const timeoutId = setTimeout(updateSidebarOffset, 50);
    updateSidebarOffset(); // Also try immediately

    // Update on resize
    window.addEventListener("resize", updateSidebarOffset);

    // Observe sidebar for class changes (collapsed/expanded)
    const sidebar = document.querySelector("aside");
    if (sidebar) {
      const observer = new MutationObserver(updateSidebarOffset);
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ["class"],
      });

      // Poll for changes (handles localStorage changes and transitions)
      const interval = setInterval(updateSidebarOffset, 150);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener("resize", updateSidebarOffset);
        observer.disconnect();
        clearInterval(interval);
      };
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updateSidebarOffset);
    };
  }, [leftOffset]);
  const hasAttemptedRestore = useRef<string | null>(null); // Track which workspace ID we've restored for
  const isRestoringRef = useRef(false); // Prevent multiple simultaneous restores
  const initialSessionIdRef = useRef<string | null>(null); // Track the session ID we initialized with

  // Helper function to get workspace-scoped localStorage key
  const getSessionStorageKey = (workspaceId: string | undefined) => {
    return workspaceId
      ? `ava-session-state-${workspaceId}`
      : "ava-session-state";
  };

  // CRITICAL: Check localStorage synchronously before first render to prevent welcome screen flash
  // This ensures we don't show "Activate Now" screen if there's a saved session
  const getInitialState = () => {
    // Only check if we're in browser environment
    if (typeof window === "undefined") {
      return {
        showWelcome: true,
        currentStage: "welcome" as const,
        sessionId: null as string | null,
        userName: "",
      };
    }

    try {
      // CRITICAL: Read workspace ID directly from localStorage (workspace-storage)
      // This is stored by the workspace store and is available synchronously
      let workspaceId: string | null = null;
      try {
        const workspaceStorage = localStorage.getItem("workspace-storage");
        if (workspaceStorage) {
          const parsed = JSON.parse(workspaceStorage);
          // Zustand persist stores data in { state: { ... } } structure
          const persistedWorkspace = parsed?.state?.currentWorkspace;
          if (persistedWorkspace?.id) {
            workspaceId = persistedWorkspace.id;
          } else if (parsed?.currentWorkspace?.id) {
            // Fallback: check if it's stored directly (older format)
            workspaceId = parsed.currentWorkspace.id;
          }
        }
      } catch (e) {
        // Error reading workspace storage, continue without workspace ID
      }

      // If we have a workspace ID, check for workspace-scoped session first
      if (workspaceId) {
        const workspaceScopedKey = `ava-session-state-${workspaceId}`;
        try {
          const savedSession = localStorage.getItem(workspaceScopedKey);
          if (savedSession) {
            const parsed = JSON.parse(savedSession);
            if (
              parsed.sessionId &&
              parsed.currentStage &&
              parsed.currentStage !== "welcome"
            ) {
              // Found a saved session for this workspace - don't show welcome initially
              return {
                showWelcome: false,
                currentStage: parsed.currentStage,
                sessionId: parsed.sessionId,
                userName: parsed.userName || "",
              };
            }
          }
        } catch (e) {
          // Invalid JSON, continue checking other keys
        }
      }

      // Fallback: Check for any saved session in localStorage (workspace-scoped)
      // Sort keys to check workspace-scoped keys first (more specific)
      const keys = Object.keys(localStorage);
      const sortedKeys = keys.sort((a, b) => {
        // Workspace-scoped keys (ava-session-state-{workspaceId}) come first
        const aIsWorkspaceScoped =
          a.startsWith("ava-session-state-") && a !== "ava-session-state";
        const bIsWorkspaceScoped =
          b.startsWith("ava-session-state-") && b !== "ava-session-state";
        if (aIsWorkspaceScoped && !bIsWorkspaceScoped) return -1;
        if (!aIsWorkspaceScoped && bIsWorkspaceScoped) return 1;
        return 0;
      });

      for (const key of sortedKeys) {
        if (key.startsWith("ava-session-state")) {
          try {
            const savedSession = localStorage.getItem(key);
            if (savedSession) {
              const parsed = JSON.parse(savedSession);
              if (
                parsed.sessionId &&
                parsed.currentStage &&
                parsed.currentStage !== "welcome"
              ) {
                // Found a saved session - don't show welcome initially
                // We'll validate workspace match in useEffect
                return {
                  showWelcome: false,
                  currentStage: parsed.currentStage,
                  sessionId: parsed.sessionId,
                  userName: parsed.userName || "",
                };
              }
            }
          } catch (e) {
            // Invalid JSON, continue checking other keys
            continue;
          }
        }
      }
    } catch (e) {
      // Error reading localStorage, fall back to welcome
    }

    // Default to welcome if no saved session found
    return {
      showWelcome: true,
      currentStage: "welcome" as const,
      sessionId: null as string | null,
      userName: "",
    };
  };

  const initialState = getInitialState();
  initialSessionIdRef.current = initialState.sessionId; // Store initial session ID for validation

  // Initialize with state from localStorage (if available) to prevent welcome screen flash
  const [showWelcome, setShowWelcome] = useState(initialState.showWelcome);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [currentStage, setCurrentStage] = useState<
    "welcome" | "phase1" | "phase2" | "complete"
  >(initialState.currentStage);
  const [sessionId, setSessionId] = useState<string | null>(
    initialState.sessionId
  );
  const [userName, setUserName] = useState(initialState.userName);
  const [phase1Answers, setPhase1Answers] = useState<any[]>([]);
  const [phase1Progress, setPhase1Progress] = useState<{
    currentQuestionIndex: number;
    totalQuestions: number;
  }>({ currentQuestionIndex: 0, totalQuestions: 27 });
  const [phase2Progress, setPhase2Progress] = useState<{
    currentQuestionIndex: number;
    totalQuestions: number;
  }>({ currentQuestionIndex: 0, totalQuestions: 0 });
  const [isPhase2Complete, setIsPhase2Complete] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);


  // Attach scroll listener directly to chatContainerRef and check all scrollable elements
  useEffect(() => {
    if (!sessionId) return;
    
    let cleanup: (() => void)[] = [];
    
    const attachListener = () => {
      const container = chatContainerRef.current;
      if (!container) {
        return;
      }
      
      // Check container and all its parents for scrollable elements
      let current: HTMLElement | null = container;
      const parents: HTMLElement[] = [];
      while (current && current !== document.body) {
        parents.push(current);
        current = current.parentElement;
      }
      
      // Track last scroll position to detect direction
      let lastScrollTop = 0;
      
      // Set initial state from container
      const initialScrollTop = container.scrollTop;
      const initialShouldHide = initialScrollTop > 100;
      lastScrollTop = initialScrollTop;
      setIsHeaderScrolled(initialShouldHide);
      
      // Helper function to determine if header should be hidden
      const getShouldHide = (scrollTop: number, lastScroll: number) => {
        // Show header when at top
        if (scrollTop < 50) {
          return false;
        }
        // Hide when scrolling down past 100px
        if (scrollTop > lastScroll && scrollTop > 100) {
          return true;
        }
        // Show when scrolling up
        if (scrollTop < lastScroll) {
          return false;
        }
        // Default: hide if past threshold
        return scrollTop > 100;
      };
      
      // Attach listener to container
      const handleContainerScroll = () => {
        const scrollTop = container.scrollTop;
        const shouldHide = getShouldHide(scrollTop, lastScrollTop);
        lastScrollTop = scrollTop;
        setIsHeaderScrolled(shouldHide);
      };
      container.addEventListener("scroll", handleContainerScroll, { passive: true });
      cleanup.push(() => container.removeEventListener("scroll", handleContainerScroll));
      
      // Also attach to window/document
      let lastWindowScroll = window.scrollY || document.documentElement.scrollTop || 0;
      const handleWindowScroll = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        const shouldHide = getShouldHide(scrollTop, lastWindowScroll);
        lastWindowScroll = scrollTop;
        setIsHeaderScrolled(shouldHide);
      };
      window.addEventListener("scroll", handleWindowScroll, { passive: true });
      cleanup.push(() => window.removeEventListener("scroll", handleWindowScroll));
      
      // Attach to all scrollable parents
      const lastParentScrolls = new Map<HTMLElement, number>();
      parents.forEach((parent, i) => {
        if (parent.scrollHeight > parent.clientHeight) {
          lastParentScrolls.set(parent, parent.scrollTop);
          const handleParentScroll = () => {
            const scrollTop = parent.scrollTop;
            const lastScroll = lastParentScrolls.get(parent) || 0;
            const shouldHide = getShouldHide(scrollTop, lastScroll);
            lastParentScrolls.set(parent, scrollTop);
            setIsHeaderScrolled(shouldHide);
          };
          parent.addEventListener("scroll", handleParentScroll, { passive: true });
          cleanup.push(() => parent.removeEventListener("scroll", handleParentScroll));
        }
      });
    };
    
    // Try immediately and retry with delays
    attachListener();
    const timeout1 = setTimeout(attachListener, 100);
    const timeout2 = setTimeout(attachListener, 500);
    const timeout3 = setTimeout(attachListener, 1000);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      cleanup.forEach(fn => fn());
    };
  }, [sessionId]);

  // Handle scroll to bottom when coming from Previous Profiles
  useEffect(() => {
    if (location.state?.scrollToBottom && showWelcome) {
      // Wait for page to render, then scroll to bottom
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      }, 300);
    }
  }, [location.state, showWelcome]);



  // CRITICAL: Restore session state immediately when workspace becomes available
  // This MUST run synchronously when workspace loads to prevent showing welcome screen
  useEffect(() => {
    // Prevent multiple simultaneous restores
    if (isRestoringRef.current) {
      return;
    }

    // Wait for workspace to finish loading
    if (workspaceLoading) {
      return;
    }

    // No workspace available
    if (!currentWorkspace?.id) {
      // Only reset if we've already restored something (workspace was removed)
      if (hasAttemptedRestore.current !== null && sessionId) {
        console.log("⚠️ Workspace removed, clearing session");
        setShowWelcome(true);
        setCurrentStage("welcome");
        setSessionId(null);
        setUserName("");
        hasAttemptedRestore.current = null;
      }
      return;
    }

    const workspaceId = currentWorkspace.id;

    // CRITICAL: Validate initial state session belongs to current workspace
    // If we initialized with a session from localStorage, validate it matches this workspace
    if (
      sessionId &&
      initialSessionIdRef.current === sessionId &&
      !hasAttemptedRestore.current
    ) {
      // This is the session we initialized with - validate it belongs to this workspace
      getSessionDetails(sessionId)
        .then((session) => {
          if (session.workspaceId !== workspaceId) {
            console.log(
              `⚠️ Initial session ${sessionId} belongs to workspace ${session.workspaceId}, but current workspace is ${workspaceId}. Resetting.`
            );
            setSessionId(null);
            setUserName("");
            setCurrentStage("welcome");
            setShowWelcome(true);
            setPhase1Answers([]);
            hasAttemptedRestore.current = null;
          } else {
            // Session matches workspace - ensure we're not showing welcome
            setShowWelcome(false);
            // Mark as restored to prevent duplicate restoration
            hasAttemptedRestore.current = workspaceId;
            isRestoringRef.current = false;
          }
        })
        .catch((err) => {
          console.error("Failed to validate initial session workspace:", err);
          // On error, clear session to be safe
          setSessionId(null);
          setUserName("");
          setCurrentStage("welcome");
          setShowWelcome(true);
          setPhase1Answers([]);
          hasAttemptedRestore.current = null;
        });
    }

    // CRITICAL: If workspace changed, clear old session immediately
    // This ensures we don't use a session from a different workspace
    if (
      hasAttemptedRestore.current !== null &&
      hasAttemptedRestore.current !== workspaceId
    ) {
      console.log(
        `🔄 Workspace changed from ${hasAttemptedRestore.current} to ${workspaceId}, clearing old session`
      );
      setSessionId(null);
      setUserName("");
      setCurrentStage("welcome");
      setShowWelcome(true);
      setPhase1Answers([]);
    }

    // Check if we've already restored for this workspace
    if (hasAttemptedRestore.current === workspaceId && sessionId) {
      // Validate that the current session still belongs to this workspace
      getSessionDetails(sessionId)
        .then((session) => {
          if (session.workspaceId !== workspaceId) {
            console.log(
              `⚠️ Session ${sessionId} belongs to workspace ${session.workspaceId}, but current workspace is ${workspaceId}. Clearing session.`
            );
            setSessionId(null);
            setUserName("");
            setCurrentStage("welcome");
            setShowWelcome(true);
            setPhase1Answers([]);
            hasAttemptedRestore.current = null;
          }
        })
        .catch((err) => {
          console.error("Failed to validate session workspace:", err);
          // On error, clear session to be safe
          setSessionId(null);
          setUserName("");
          setCurrentStage("welcome");
          setShowWelcome(true);
          setPhase1Answers([]);
          hasAttemptedRestore.current = null;
        });
      return; // Already restored and have session
    }

    // Prevent race conditions
    isRestoringRef.current = true;
    hasAttemptedRestore.current = workspaceId;

    console.log(`🔄🔄🔄 RESTORING session for workspace: ${workspaceId}`);

    const restoreSession = async () => {
      try {
        const storageKey = getSessionStorageKey(workspaceId);
        const savedSession = localStorage.getItem(storageKey);

        if (savedSession) {
          const parsed = JSON.parse(savedSession);

          if (
            parsed.sessionId &&
            parsed.currentStage &&
            parsed.currentStage !== "welcome"
          ) {
            console.log(
              `✅✅✅ FOUND saved session for workspace ${workspaceId}:`,
              parsed
            );
            console.log(
              `✅ Restoring: stage=${parsed.currentStage}, sessionId=${parsed.sessionId}`
            );

            // CRITICAL: Validate that the session belongs to this workspace
            try {
              const sessionDetails = await getSessionDetails(parsed.sessionId);

              if (sessionDetails.workspaceId !== workspaceId) {
                console.log(
                  `⚠️ Session ${parsed.sessionId} belongs to workspace ${sessionDetails.workspaceId}, but current workspace is ${workspaceId}. Not restoring.`
                );
                // Clear the invalid session from localStorage
                localStorage.removeItem(storageKey);
                setShowWelcome(true);
                setCurrentStage("welcome");
                setSessionId(null);
                setUserName("");
                setPhase1Answers([]);
                return;
              }

              // Session belongs to this workspace - restore it
              setSessionId(parsed.sessionId);
              setUserName(parsed.userName || sessionDetails.userName || "");
              setCurrentStage(parsed.currentStage);
              setShowWelcome(false); // MUST set this to false

              console.log(
                `✅✅✅ STATE RESTORED: stage=${parsed.currentStage}, sessionId=${parsed.sessionId}`
              );
            } catch (err: any) {
              console.error("❌ Failed to validate session workspace:", err);
              // If session doesn't exist or access denied, clear it
              localStorage.removeItem(storageKey);
              setShowWelcome(true);
              setCurrentStage("welcome");
              setSessionId(null);
              setUserName("");
              setPhase1Answers([]);
            }
          } else {
            console.log(
              `⚠️ Invalid saved session for workspace ${workspaceId}`
            );
          }
        } else {
          console.log(`📂 No saved session for workspace ${workspaceId}`);
        }
      } catch (e) {
        console.error("❌ Error restoring session:", e);
      } finally {
        isRestoringRef.current = false;
      }
    };

    restoreSession();
  }, [currentWorkspace?.id, workspaceLoading, sessionId]);

  // Save session state when it changes (workspace-scoped)
  // CRITICAL: Only save when we have a valid session and stage, don't clear on welcome unless explicitly reset
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    // Only save if we have a session and are not on welcome screen
    if (sessionId && currentStage !== "welcome") {
      const storageKey = getSessionStorageKey(currentWorkspace.id);
      const sessionState = {
        sessionId,
        userName,
        currentStage,
      };
      localStorage.setItem(storageKey, JSON.stringify(sessionState));
      console.log(
        `💾💾💾 Session state SAVED for workspace ${currentWorkspace.id}:`,
        sessionState
      );
    }
    // DON'T clear on welcome - only clear when user explicitly starts new (handled in handleStartNew)
    // This prevents clearing the saved state when the component briefly shows welcome during initialization
  }, [sessionId, userName, currentStage, currentWorkspace?.id]);

  // Validate session access on entering Phase 1; recreate if forbidden
  useEffect(() => {
    const validateOrRecreateSession = async () => {
      if (currentStage !== "phase1" || !sessionId) return;
      try {
        await getSessionDetails(sessionId);
      } catch (err: any) {
        const msg = err?.message || "";
        const forbidden =
          msg.toLowerCase().includes("access denied") ||
          msg.toLowerCase().includes("forbidden");
        if (forbidden) {
          if (!currentWorkspace?.id) return;
          try {
            const newSession = await createAvaSession(
              currentWorkspace.id,
              "AVA Ideal Client Profile"
            );
            const newId = newSession.id || newSession.sessionId;
            if (newId) {
              setSessionId(newId);
              // save immediately to localStorage (workspace-scoped)
              const storageKey = getSessionStorageKey(currentWorkspace.id);
              const sessionState = {
                sessionId: newId,
                userName: "",
                currentStage: "phase1",
              };
              localStorage.setItem(storageKey, JSON.stringify(sessionState));
              toast({
                title: "New Session Created",
                description:
                  "Your previous session was not accessible. A new one has been created.",
              });
            }
          } catch (createErr: any) {
            toast({
              title: "Session Error",
              description: createErr?.message || "Failed to create new session",
              variant: "destructive",
            });
          }
        }
      }
    };
    validateOrRecreateSession();
  }, [currentStage, sessionId, currentWorkspace?.id, toast]);

  const handlePhase2Complete = (_sections: any[]) => {
    // DON'T change stage to "complete" - keep Phase 2 visible so all content remains
    // Phase 2 component will handle showing completion UI internally
    setIsPhase2Complete(true);

    toast({
      title: "Profile Complete! 🎉",
      description: "Your AVA Ideal Client Profile is ready",
    });

    if (currentWorkspace?.id && sessionId) {
      const storageKey = getSessionStorageKey(currentWorkspace.id);
      const sessionState = {
        sessionId,
        userName,
        currentStage: "phase2" as const, // Keep as phase2 so content stays visible
      };
      localStorage.setItem(storageKey, JSON.stringify(sessionState));
      console.log(
        `💾💾💾 Phase 2 Complete - keeping stage as phase2 to preserve content visibility`
      );
    }
  };

  const handleStartNew = async () => {
    // Cancel the current session via API if it exists
    if (sessionId) {
      try {
        await cancelAvaSession(sessionId);
        console.log("✅ Session cancelled via API");
      } catch (error) {
        console.error("❌ Failed to cancel session:", error);
        // Continue with reset even if cancel fails
      }
    }

    // Reset all state
    setSessionId(null);
    setUserName("");
    setPhase1Answers([]);
    setCurrentStage("welcome");
    setShowWelcome(true);

    // Clear workspace-scoped localStorage
    if (currentWorkspace?.id) {
      const storageKey = getSessionStorageKey(currentWorkspace.id);
      localStorage.removeItem(storageKey);
      // Clear Phase 1 state for this workspace and session (if sessionId exists)
      if (sessionId) {
        localStorage.removeItem(
          `ava-phase1-state-${currentWorkspace.id}-${sessionId}`
        );
        localStorage.removeItem(
          `ava-phase2-${currentWorkspace.id}-${sessionId}`
        );
      }
      // Clear all Phase 1 and Phase 2 state for this workspace (pattern match - more aggressive cleanup)
      // This handles cases where sessionId might have changed
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith(`ava-phase1-state-${currentWorkspace.id}-`) ||
          key.startsWith(`ava-phase2-${currentWorkspace.id}-`) ||
          key.startsWith(`activate-now-messages-${currentWorkspace.id}-`)
        ) {
          localStorage.removeItem(key);
        }
      });
    }
    // Legacy cleanup (for backward compatibility)
    localStorage.removeItem("ava-session-state");
    localStorage.removeItem("ava-chat-session");

    // Navigate to welcome screen with scroll flag
    navigate("/tools/ava", {
      replace: true,
      state: { scrollToActivateButton: true, resetTimestamp: Date.now() },
    });

    toast({
      title: "New Session Started",
      description: "Click 'Activate AVA Now' to begin.",
    });
  };

  // Handle session creation when "Activate AVA Now" is clicked
  const handleStartSession = async () => {
    console.log("🚀 Starting AVA Session:");
    console.log("- Current Workspace:", currentWorkspace);
    console.log("- Workspace ID:", currentWorkspace?.id);

    // Check if workspace is selected
    if (!currentWorkspace) {
      toast({
        title: "No Workspace Selected",
        description: "Please select a workspace before starting AVA",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingSession(true);
    try {
      // ALWAYS clear any previous Activate Now state when button is clicked
      // This ensures we always start fresh with a new API call
      console.log(
        "🔄 Activate Now clicked - clearing any previous state to start fresh"
      );
      sessionStorage.removeItem("activate-now-in-progress");
      sessionStorage.removeItem("activate-now-messages");
      sessionStorage.removeItem("activate-now-messages-total");
      sessionStorage.removeItem("activate-now-messages-displayed");
      sessionStorage.removeItem("activate-now-session-id");

      // Clear localStorage Activate Now messages for this workspace (if starting new session)
      if (currentWorkspace?.id) {
        // Clear all activate-now-messages for this workspace
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(`activate-now-messages-${currentWorkspace.id}-`)) {
            localStorage.removeItem(key);
          }
        });
      }

      // Mark that Activate Now is in progress
      sessionStorage.setItem("activate-now-in-progress", "true");

      // Create backend session with workspace ID
      console.log("📡 Calling createAvaSession API...");
      const backendSession = await createAvaSession(
        currentWorkspace.id,
        "AVA Ideal Client Profile"
      );

      console.log("📝 Backend session response:", backendSession);
      console.log(
        "📝 Backend session message type:",
        typeof backendSession.message,
        Array.isArray(backendSession.message)
          ? "array"
          : typeof backendSession.message
      );

      // Get session ID (handle both id and sessionId formats)
      const newSessionId = backendSession.id || backendSession.sessionId;

      if (!newSessionId) {
        throw new Error("No session ID returned from backend");
      }

      // Store the response messages for rendering as a single chunk
      // The API response has data.message as an array of HTML strings
      const responseMessages = backendSession.message || [];
      console.log("📝 Response messages:", responseMessages);

      if (Array.isArray(responseMessages) && responseMessages.length > 0) {
        console.log(
          "✅ Storing",
          responseMessages.length,
          "Activate Now messages to render as single chunk"
        );
        // Store in sessionStorage for current session
        sessionStorage.setItem(
          "activate-now-messages",
          JSON.stringify(responseMessages)
        );
        sessionStorage.setItem("activate-now-session-id", newSessionId);
        sessionStorage.setItem("activate-now-in-progress", "true"); // Mark as in progress until rendered

        // CRITICAL: Also store in localStorage for persistence across page refreshes
        // Use workspace-scoped key to persist even when Submit Name API refreshes
        if (currentWorkspace?.id) {
          const activateNowKey = `activate-now-messages-${currentWorkspace.id}-${newSessionId}`;
          localStorage.setItem(
            activateNowKey,
            JSON.stringify({
              messages: responseMessages,
              sessionId: newSessionId,
              timestamp: Date.now(),
            })
          );
          console.log(
            "💾 Activate Now messages stored in localStorage for persistence:",
            activateNowKey
          );
        }

        console.log(
          "✅ Activate Now messages stored in both sessionStorage and localStorage, ready for single chunk rendering"
        );
      } else {
        console.warn(
          "⚠️ No messages array in API response. Message value:",
          responseMessages
        );
        console.warn(
          "⚠️ Backend session object keys:",
          Object.keys(backendSession)
        );
      }

      console.log("✅ Setting sessionId:", newSessionId);

      // Update state atomically
      setSessionId(newSessionId);
      setCurrentStage("phase1");
      setShowWelcome(false);

      // Immediately save state to localStorage
      if (currentWorkspace?.id) {
        const storageKey = getSessionStorageKey(currentWorkspace.id);
        const sessionState = {
          sessionId: newSessionId,
          userName: "",
          currentStage: "phase1",
        };
        localStorage.setItem(storageKey, JSON.stringify(sessionState));
        console.log(
          `💾💾💾 New session saved: Phase 1 for workspace ${currentWorkspace.id}`
        );
      }

      toast({
        title: "Session Created",
        description:
          "AVA is ready to help you create your ideal client profile",
      });

      // Scroll to top when Phase 1 starts
      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }, 100);
    } catch (error: any) {
      console.error("Failed to create AVA session:", error);
      // Clear activation state on error
      sessionStorage.removeItem("activate-now-in-progress");
      sessionStorage.removeItem("activate-now-messages");
      sessionStorage.removeItem("activate-now-messages-total");
      sessionStorage.removeItem("activate-now-messages-displayed");
      sessionStorage.removeItem("activate-now-session-id");

      // Clear localStorage Activate Now messages for this workspace on error
      if (currentWorkspace?.id) {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(`activate-now-messages-${currentWorkspace.id}-`)) {
            localStorage.removeItem(key);
          }
        });
      }
      toast({
        title: "Error",
        description:
          error.message || "Failed to create session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Track if Phase 1 is completed (similar to Margo's step completion tracking)
  const isPhase1Completed = useMemo(() => {
    return (
      currentStage === "phase2" ||
      currentStage === "complete" ||
      (userName && currentStage !== "welcome")
    );
  }, [currentStage, userName]);

  const handlePhase1Complete = (completedUserName: string) => {
    console.log("✅ Phase 1 Complete, transitioning to Phase 2");
    console.log("User Name from Phase 1:", completedUserName);

    const scrollPayload = {
      scrollY: window.scrollY,
      scrollX: window.scrollX,
      timestamp: Date.now(),
    };

    sessionStorage.setItem(
      "ava-phase2-transition-scroll",
      JSON.stringify(scrollPayload)
    );
    sessionStorage.setItem("ava-phase2-hide-phase1-messages", "true");

    startTransition(() => {
      setUserName(completedUserName);
      setCurrentStage("phase2");
      setShowWelcome(false); // Ensure welcome is hidden

      // Immediately save state to localStorage
      if (currentWorkspace?.id && sessionId) {
        const storageKey = getSessionStorageKey(currentWorkspace.id);
        const sessionState = {
          sessionId,
          userName: completedUserName,
          currentStage: "phase2",
        };
        localStorage.setItem(storageKey, JSON.stringify(sessionState));
        console.log(
          `💾💾💾 Phase transition saved: Phase 1 → Phase 2 for workspace ${currentWorkspace.id}`
        );
      }
    });

    toast({
      title: "Phase 1 Complete! 🎉",
      description: "Moving to Phase 2: Profile Generation",
    });
  };

  // CRITICAL: Don't show welcome if we have a valid session
  // This prevents showing welcome screen during restore or if state is valid
  const shouldShowWelcome =
    showWelcome && (!sessionId || currentStage === "welcome");

  // Show welcome screen only if we don't have a valid session
  if (shouldShowWelcome) {
    return (
      <AVAWelcome onStart={handleStartSession} isLoading={isCreatingSession} />
    );
  }

  // Handle Phase 2 export
  const handlePhase2Export = async () => {
    if (!sessionId) {
      toast({
        title: "Error",
        description: "Session ID is missing. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const blob = await exportProfilePDF(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AVA-Profile-${userName || "Client"}-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Profile Exported",
        description: "Your AVA profile has been downloaded as PDF",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description:
          error?.message || "Failed to export PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Render both Phase 1 and Phase 2 simultaneously (like Margo does with steps)
  // This prevents flash/glitch when transitioning to Phase 2
  // Phase 1 remains rendered when Phase 2 is active, just like Margo keeps Step 1 and Step 2 rendered when on Step 3
  if (sessionId) {
    // Determine which stage to show in header
    // If Phase 2 is complete, show "complete" in header but keep content visible
    const headerStage = isPhase2Complete
      ? "complete"
      : currentStage === "phase2"
      ? "phase2"
      : "phase1";
    const headerProgress =
      currentStage === "phase2" || isPhase2Complete
        ? phase2Progress
        : phase1Progress; // Use actual Phase 1 progress

    return (
      <div className="flex flex-col min-h-[calc(100vh-80px)] overflow-hidden relative">
        {/* Background with Colors */}
        <div className="fixed inset-0 z-0 pointer-events-none bg-[#020617] opacity-80"></div>
        {/* Single Header for both Phase 1 and Phase 2 - Fixed directly below AppNavbar */}
        {/* Positioned at top-20 (80px) to be directly below AppNavbar, and sidebarOffset to account for sidebar */}
        {/* Right position accounts for scrollbar width so scrollbar is visible and not hidden */}
        <div
          className={`fixed top-20 z-50 bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/50 transition-all duration-500 ease-in-out ${
            showAvaHeader
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-full pointer-events-none"
          }`}
          style={{
            left: `${sidebarOffset}px`,
            right: `${scrollbarWidth}px`,
          }}
        >
          <AVAHeader
            stage={headerStage}
            progress={headerProgress}
            userName={userName || "User"}
            offsetClassName=""
            onReset={handleStartNew}
            isScrolled={isHeaderScrolled}
          />
          {currentStage === "phase2" && isPhase2Complete && (
            <div className="bg-slate-900/60 backdrop-blur-xl px-4 sm:px-6 py-2 border-t border-slate-800/50">
              <div className="max-w-3xl mx-auto flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePhase2Export}
                  disabled={isExporting}
                  className="h-7 text-xs gap-1 bg-slate-800/50 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:border-cyan-500/50"
                >
                  {isExporting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  Export PDF
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Content Container - Phase 1 and Phase 2 in same scrollable container */}
        {/* Padding accounts for AppNavbar (80px) + AVAHeader (64px if not scrolled, 24px if scrolled) */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto relative z-10 chatgpt-scrollbar"
          style={{
            paddingTop: showAvaHeader
              ? isHeaderScrolled
                ? "6.5rem" // 80px (AppNavbar) + 24px (scrolled header) = 104px
                : "9rem" // 80px (AppNavbar) + 64px (full header) = 144px
              : "5rem", // 80px if header hidden
          }}
        >
          {/* Phase 1 - Always show if we have a session (completed or active) */}
          {/* When Phase 2 is active, Phase 1 stays rendered to prevent flash/glitch */}
          {/* CRITICAL: Use stable key based on sessionId to prevent re-mounting in production */}
          {(currentStage === "phase1" || isPhase1Completed) && (
            <AVAPhase1Interface
              key={`phase1-${sessionId}`} // Stable key prevents re-mounting when stage changes
              sessionId={sessionId}
              onPhase1Complete={handlePhase1Complete}
              onStartOver={handleStartNew}
              hideHeader={true} // Always hide Phase 1 header - parent (AVA.tsx) handles header for all phases
              hideStartPhase2Button={currentStage === "phase2"}
              onProgressChange={setPhase1Progress} // Report progress to parent for header
              onUserNameChange={setUserName} // Report userName changes to parent for header
              onError={(error) => {
                toast({
                  title: "Error",
                  description: error,
                  variant: "destructive",
                });
              }}
            />
          )}

          {/* Phase 2 - Show below Phase 1 when active or complete (keep visible to preserve content) */}
          {(currentStage === "phase2" || currentStage === "complete") && (
            <AVAPhase2ChatInterface
              userName={userName || "User"}
              phase1Answers={phase1Answers || []}
              backendSessionId={sessionId}
              onComplete={handlePhase2Complete}
              onStartOver={handleStartNew}
              onProgressChange={setPhase2Progress}
              onExportPDF={handlePhase2Export}
              onPhase2CompleteChange={setIsPhase2Complete}
              showPhase1History={false}
            />
          )}
        </div>
      </div>
    );
  }

  // Completion is now handled within Phase 2 component to preserve all content
  // No separate completion screen needed - Phase 2 shows completion UI when all sections are done

  // Default fallback - show welcome
  return (
    <AVAWelcome onStart={handleStartSession} isLoading={isCreatingSession} />
  );
};

export default AVA;
