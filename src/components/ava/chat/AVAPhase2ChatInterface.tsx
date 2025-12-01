import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Edit,
  RefreshCw,
  Check,
  Loader2,
  Download,
  Sparkles,
  FileText,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AVATypingIndicator } from "./AVATypingIndicator";
import type { Phase1Answer } from "@/lib/ava-chat-types";
import {
  startPhase2,
  generateSection,
  getSectionStatus,
  updateSectionResponse,
  confirmSectionResponse,
  confirmSection,
  createAvaSession,
  getSessionDetails,
  regeneratePhase2Question,
  cancelAvaSession,
  savePhase2Progress,
  getPhase2Progress,
  saveConversationHistory,
  getConversationHistory,
} from "@/lib/ava-api";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface QuestionResponse {
  id?: string;
  questionId: string;
  questionText: string;
  aiGeneratedAnswer?: string;
  userEditedAnswer?: string;
  status: "generating" | "ready" | "failed";
  isApproved?: boolean;
}

interface Section {
  sectionNumber: number;
  sectionTitle: string;
  sectionIntro: string;
  questions: QuestionResponse[];
  isComplete: boolean;
}

interface AVAPhase2ChatInterfaceProps {
  userName: string;
  phase1Answers: Phase1Answer[];
  backendSessionId?: string;
  onComplete: (sections: any[]) => void;
  onStartOver?: () => void;
  onProgressChange?: (progress: {
    currentQuestionIndex: number;
    totalQuestions: number;
  }) => void;
  onExportPDF?: () => Promise<void>;
  onPhase2CompleteChange?: (isComplete: boolean) => void;
  showPhase1History?: boolean;
}

export const AVAPhase2ChatInterface = ({
  userName,
  phase1Answers,
  backendSessionId,
  onComplete,
  onStartOver: _onStartOver,
  onProgressChange,
  onExportPDF: _externalExportPDF,
  onPhase2CompleteChange,
  showPhase1History = true,
}: AVAPhase2ChatInterfaceProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const hasInitialized = useRef(false);
  const pollCountRef = useRef<Map<number, number>>(new Map());
  const actualSessionIdRef = useRef<string | null>(null); // Store the recovered/created session ID
  const hasRestoredState = useRef(false);
  const sectionScrollRef = useRef<HTMLDivElement>(null);
  const phase2StartRef = useRef<HTMLDivElement>(null); // Ref for Phase 2 start position
  const firstPhase2SectionRef = useRef<HTMLDivElement>(null); // Ref for first Phase 2 section
  const hasRestoredQuestionScroll = useRef(false);
  const restoredQuestionIndexRef = useRef<number | null>(null); // Track restored question index to prevent resets

  // Get persistence key unique to workspace and session
  // IMPORTANT: Never use 'global' fallback - always require workspace ID
  const getPersistenceKey = (workspaceId: string | undefined) => {
    if (!workspaceId) {
      console.warn("⚠️ Cannot create persistence key without workspace ID");
      return null;
    }
    return `ava-phase2-${workspaceId}-${backendSessionId || "unknown"}`;
  };

  // Load persisted state or use defaults
  const loadPersistedState = (workspaceId: string | undefined) => {
    if (!workspaceId) {
      return null;
    }
    try {
      const key = getPersistenceKey(workspaceId);
      if (!key) return null;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(
          `📂 Restoring Phase 2 state (raw) for workspace ${workspaceId}:`,
          parsed
        );

        // Handle both old format (with full sections) and new minimal format
        if (parsed?.sections && Array.isArray(parsed.sections)) {
          // Old format: sanitize sections
          parsed.sections = parsed.sections.map((section: Section) => {
            console.log(
              `🧹 Sanitizing section ${section.sectionNumber} - resetting approval states and clearing stuck generating states`
            );
            return {
              ...section,
              questions: section.questions.map((q) => ({
                ...q,
                isApproved: false, // Always reset - backend will provide correct approval state
                // Change generating to ready to prevent stuck typing indicator after login
                // Backend refresh will provide actual status
                status:
                  q.status === "generating" ? ("ready" as const) : q.status,
              })),
            };
          });
        } else {
          // New minimal format: only restore position, backend will provide content
          console.log(
            "📂 Detected minimal state format - will restore position only, backend will provide content"
          );
        }

        console.log("📂 Restoring Phase 2 state (sanitized):", parsed);
        return parsed;
      }
    } catch (e) {
      console.error("Failed to load persisted Phase 2 state:", e);
    }
    return null;
  };

  // Initialize state with defaults (will be loaded from localStorage when workspace is available)
  const [sections, setSections] = useState<Section[]>([]);
  const [currentSection, setCurrentSection] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [sectionsList, setSectionsList] = useState<
    Array<{
      sectionNumber: number;
      title: string;
      intro: string;
      isApproved?: boolean;
    }>
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null
  );
  const [editedContent, setEditedContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<
    string | null
  >(null);
  const [isTransitioningSection, setIsTransitioningSection] = useState(false);
  const [phase1History, setPhase1History] = useState<
    Array<{
      questionId: string;
      sectionId: string;
      questionText: string;
      answer: string;
      sectionTitle?: string;
    }>
  >([]);

  // Section title mapping for Phase 1 questions
  const sectionTitleMap: { [key: string]: string } = {
    A: "Basic Information",
    B: "Demographics & Background",
    C: "Professional & Financial Status",
    D: "Core Problem & Pain Points",
    E: "Goals & Desired Outcomes",
    F: "Values & Emotional Drivers",
    G: "Buying Behavior & Objections",
    H: "Communication & Content Preferences",
    I: "Competitor & Market Awareness",
    J: "Final Reflection & Additional Insights",
  };
  const [phase1IntroMessages, setPhase1IntroMessages] = useState<
    Array<{
      id: string;
      role: "ava" | "user";
      content: string;
      videoUrl?: string;
      isQuestion?: boolean;
      questionNumber?: number;
      totalQuestions?: number;
      examples?: string[];
      sectionTitle?: string;
    }>
  >([]);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [showCreateNewProfileDialog, setShowCreateNewProfileDialog] =
    useState(false);
  const [showPhase1Messages, setShowPhase1Messages] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return sessionStorage.getItem("ava-phase2-hide-phase1-messages") !== "true";
  }); // Control visibility of Phase 1 messages to prevent flashback

  // Track if we've loaded initial state to prevent double-loading
  const hasLoadedInitialState = useRef(false);
  const hasLoadedPhase1Messages = useRef(false); // Track if Phase 1 messages have been loaded

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedScrollData = sessionStorage.getItem(
        "ava-phase2-transition-scroll"
      );
      if (storedScrollData) {
        const parsed = JSON.parse(storedScrollData);
        const targetScrollY =
          typeof parsed.scrollY === "number" ? parsed.scrollY : window.scrollY;
        const targetScrollX =
          typeof parsed.scrollX === "number" ? parsed.scrollX : window.scrollX;

        window.scrollTo({
          top: targetScrollY,
          left: targetScrollX,
          behavior: "auto",
        });
        console.log("📜 Restored scroll position for Phase 2 transition:", {
          targetScrollY,
          targetScrollX,
        });
        sessionStorage.removeItem("ava-phase2-transition-scroll");
      }
    } catch (err) {
      console.warn("⚠️ Failed to restore Phase 2 scroll position:", err);
    }
  }, []);

  // Load persisted state when workspace and session are available
  useEffect(() => {
    // Wait for workspace to be loaded before attempting to restore state
    if (!currentWorkspace?.id || !backendSessionId) {
      return;
    }

    // Only load initial state once
    if (hasLoadedInitialState.current) {
      return;
    }

    hasLoadedInitialState.current = true;

    // First, try to restore from backend (source of truth)
    const restoreFromBackend = async () => {
      try {
        console.log("📂 Attempting to restore Phase 2 state from backend...");
        const backendState = await getPhase2Progress(backendSessionId);

        if (
          backendState &&
          backendState.sections &&
          backendState.sections.length > 0
        ) {
          console.log("✅ Restoring Phase 2 state from backend:", backendState);
          // Sanitize persisted state (same as initial load)
          const sanitizedSections = backendState.sections.map(
            (section: Section) => ({
              ...section,
              questions: section.questions.map((q: any) => ({
                ...q,
                isApproved: q.isApproved || false, // Use backend's approval state
                status:
                  q.status === "generating" ? ("ready" as const) : q.status,
              })),
            })
          );
          setSections(sanitizedSections);
          setCurrentSection(backendState.currentSection || null);
          // Preserve the exact question index from backend - don't default to 0
          const restoredIndex =
            backendState.currentQuestionIndex !== undefined
              ? backendState.currentQuestionIndex
              : 0;
          setCurrentQuestionIndex(restoredIndex);
          restoredQuestionIndexRef.current = restoredIndex; // Track restored index
          setSectionsList(backendState.sectionsList || []);
          setIsStarted(true);
          console.log("✅ Phase 2 state restored from backend", {
            section: backendState.currentSection,
            questionIndex: restoredIndex,
          });
          return; // Successfully restored from backend
        }
      } catch (error: any) {
        console.warn(
          "⚠️ Failed to restore from backend, falling back to localStorage:",
          error
        );
      }

      // Fallback to localStorage if backend restore fails
      const persistedState = loadPersistedState(currentWorkspace.id);

      if (persistedState) {
        // Handle both old format (with sections) and new minimal format
        if (
          persistedState.sections &&
          Array.isArray(persistedState.sections) &&
          persistedState.sections.length > 0
        ) {
          // Old format: restore full sections
          console.log(
            "📂 Initial load - restoring Phase 2 state from localStorage (old format) for workspace:",
            currentWorkspace.id
          );
          const sanitizedSections = persistedState.sections.map(
            (section: Section) => ({
              ...section,
              questions: section.questions.map((q: any) => ({
                ...q,
                isApproved: false,
                status:
                  q.status === "generating" ? ("ready" as const) : q.status,
              })),
            })
          );
          setSections(sanitizedSections);
          setCurrentSection(persistedState.currentSection || null);
          // Preserve the exact question index from localStorage - don't default to 0
          const restoredIndex =
            persistedState.currentQuestionIndex !== undefined
              ? persistedState.currentQuestionIndex
              : 0;
          setCurrentQuestionIndex(restoredIndex);
          restoredQuestionIndexRef.current = restoredIndex; // Track restored index
          setSectionsList(persistedState.sectionsList || []);
          setIsStarted(persistedState.isStarted || false);
          console.log(
            "✅ Phase 2 state restored from localStorage (old format)",
            {
              section: persistedState.currentSection,
              questionIndex: restoredIndex,
            }
          );
        } else if (persistedState.currentSection !== undefined) {
          // New minimal format: only restore position, backend will provide content
          console.log(
            "📂 Initial load - restoring Phase 2 position from localStorage (minimal format) for workspace:",
            currentWorkspace.id
          );
          setCurrentSection(persistedState.currentSection || null);
          // Preserve the exact question index from localStorage - don't default to 0
          const restoredIndex =
            persistedState.currentQuestionIndex !== undefined
              ? persistedState.currentQuestionIndex
              : 0;
          setCurrentQuestionIndex(restoredIndex);
          restoredQuestionIndexRef.current = restoredIndex; // Track restored index
          setIsStarted(persistedState.isStarted || false);
          console.log(
            "✅ Phase 2 position restored from localStorage (minimal format)",
            {
              section: persistedState.currentSection,
              questionIndex: restoredIndex,
            }
          );
          // Sections will be loaded from backend
        }

        // Load Phase 1 history and intro messages for display
        if (phase1History.length === 0 && backendSessionId) {
          (async () => {
            try {
              const { getPhase1Answers } = await import("@/lib/ava-api");
              const backendAnswers = await getPhase1Answers(backendSessionId);
              console.log(
                `✅ Restored ${backendAnswers.length} Phase 1 answers from backend`
              );
              // Sort by questionId to ensure consistent ordering (Question 1, Question 2, etc.)
              const sortedAnswers = [...backendAnswers].sort((a, b) => {
                const getQuestionNum = (qId: string) => {
                  const match = qId.match(/(\d+)/);
                  return match ? parseInt(match[1], 10) : 0;
                };
                const numA = getQuestionNum(a.questionId || "");
                const numB = getQuestionNum(b.questionId || "");
                return numA - numB;
              });
              setPhase1History(
                sortedAnswers.length > 0 ? sortedAnswers : backendAnswers
              );
            } catch (error) {
              console.warn(
                "⚠️ Failed to load Phase 1 history during localStorage restore:",
                error
              );
            }
          })();
        }

        // Load ALL Phase 1 messages from backend first, then localStorage fallback
        // CRITICAL: Always load Phase 1 messages when Phase 2 component mounts/refreshes
        // This ensures history is visible after refresh, clicking Start Phase 2, or reopening tab
        if (
          !hasLoadedPhase1Messages.current &&
          currentWorkspace?.id &&
          backendSessionId
        ) {
          hasLoadedPhase1Messages.current = true;
          (async () => {
            try {
              // Try backend first (source of truth)
              const backendHistory = await getConversationHistory(
                backendSessionId
              );
              if (
                backendHistory.messages &&
                backendHistory.messages.length > 0
              ) {
                // Improved deduplication: use Map to ensure unique messages by ID and content
                const messageMap = new Map<string, any>();
                backendHistory.messages.forEach((msg: any) => {
                  const key =
                    msg.id ||
                    `${msg.role}-${msg.content?.substring(0, 50)}-${
                      msg.videoUrl || ""
                    }`;
                  if (!messageMap.has(key)) {
                    messageMap.set(key, {
                      ...msg,
                      timestamp: msg.timestamp
                        ? typeof msg.timestamp === "string"
                          ? new Date(msg.timestamp)
                          : msg.timestamp
                        : new Date(),
                    });
                  }
                });
                const uniqueMessages = Array.from(messageMap.values());
                setPhase1IntroMessages(uniqueMessages);
                console.log(
                  `✅ Loaded ${uniqueMessages.length} unique Phase 1 messages from backend (deduplicated from ${backendHistory.messages.length})`
                );
              } else {
                // Fallback to localStorage
                const phase1Key = `ava-phase1-chat-${currentWorkspace.id}-${backendSessionId}`;
                const phase1State = localStorage.getItem(phase1Key);
                if (phase1State) {
                  const parsed = JSON.parse(phase1State);
                  if (parsed.messages && Array.isArray(parsed.messages)) {
                    // Improved deduplication: use Map to ensure unique messages
                    const messageMap = new Map<string, any>();
                    parsed.messages.forEach((msg: any) => {
                      const key =
                        msg.id ||
                        `${msg.role}-${msg.content?.substring(0, 50)}-${
                          msg.videoUrl || ""
                        }`;
                      if (!messageMap.has(key)) {
                        messageMap.set(key, {
                          ...msg,
                          timestamp: msg.timestamp
                            ? typeof msg.timestamp === "string"
                              ? new Date(msg.timestamp)
                              : msg.timestamp
                            : new Date(),
                        });
                      }
                    });
                    const uniqueMessages = Array.from(messageMap.values());
                    // Load ALL messages including intro, name submission, video, questions, and answers
                    // This ensures users can see all Phase 1 content when Phase 2 starts
                    setPhase1IntroMessages(uniqueMessages);
                    console.log(
                      `✅ Loaded ${uniqueMessages.length} unique Phase 1 messages from localStorage (deduplicated from ${parsed.messages.length})`
                    );
                  }
                } else {
                  console.log(
                    "⚠️ No Phase 1 messages found in backend or localStorage"
                  );
                }
              }
            } catch (error) {
              console.warn("⚠️ Failed to load Phase 1 messages:", error);
              hasLoadedPhase1Messages.current = false; // Reset on error so we can retry
            }
          })();
        }
      } else {
        console.log(
          "📂 Initial load - no saved Phase 2 state for workspace:",
          currentWorkspace.id
        );
        // Keep defaults (already set)
      }
    };

    restoreFromBackend();
  }, [currentWorkspace?.id, backendSessionId]);

  // CRITICAL: Always load Phase 1 messages separately, even if Phase 2 state doesn't exist
  // This ensures Phase 1 history is visible after refresh, clicking Start Phase 2, or reopening tab
  useEffect(() => {
    if (
      !currentWorkspace?.id ||
      !backendSessionId ||
      hasLoadedPhase1Messages.current
    ) {
      return;
    }

    hasLoadedPhase1Messages.current = true;

    const loadPhase1Messages = async () => {
      try {
        console.log("📂 Loading Phase 1 messages for Phase 2 display...");
        // Try backend first (source of truth)
        const backendHistory = await getConversationHistory(backendSessionId);
        if (backendHistory.messages && backendHistory.messages.length > 0) {
          // Improved deduplication: use Map to ensure unique messages by ID and content
          const messageMap = new Map<string, any>();
          backendHistory.messages.forEach((msg: any) => {
            const key =
              msg.id ||
              `${msg.role}-${msg.content?.substring(0, 50)}-${
                msg.videoUrl || ""
              }`;
            if (!messageMap.has(key)) {
              messageMap.set(key, {
                ...msg,
                timestamp: msg.timestamp
                  ? typeof msg.timestamp === "string"
                    ? new Date(msg.timestamp)
                    : msg.timestamp
                  : new Date(),
              });
            }
          });
          const uniqueMessages = Array.from(messageMap.values());
          setPhase1IntroMessages(uniqueMessages);
          console.log(
            `✅ Loaded ${uniqueMessages.length} unique Phase 1 messages from backend (deduplicated from ${backendHistory.messages.length})`
          );
        } else {
          // Fallback to localStorage
          const phase1Key = `ava-phase1-chat-${currentWorkspace.id}-${backendSessionId}`;
          const phase1State = localStorage.getItem(phase1Key);
          if (phase1State) {
            const parsed = JSON.parse(phase1State);
            if (parsed.messages && Array.isArray(parsed.messages)) {
              // Improved deduplication: use Map to ensure unique messages
              const messageMap = new Map<string, any>();
              parsed.messages.forEach((msg: any) => {
                const key =
                  msg.id ||
                  `${msg.role}-${msg.content?.substring(0, 50)}-${
                    msg.videoUrl || ""
                  }`;
                if (!messageMap.has(key)) {
                  messageMap.set(key, {
                    ...msg,
                    timestamp: msg.timestamp
                      ? typeof msg.timestamp === "string"
                        ? new Date(msg.timestamp)
                        : msg.timestamp
                      : new Date(),
                  });
                }
              });
              const uniqueMessages = Array.from(messageMap.values());
              setPhase1IntroMessages(uniqueMessages);
              console.log(
                `✅ Loaded ${uniqueMessages.length} unique Phase 1 messages from localStorage (deduplicated from ${parsed.messages.length})`
              );
            }
          } else {
            console.log(
              "⚠️ No Phase 1 messages found in backend or localStorage"
            );
          }
        }
      } catch (error) {
        console.warn("⚠️ Failed to load Phase 1 messages:", error);
        hasLoadedPhase1Messages.current = false; // Reset on error so we can retry
      }
    };

    loadPhase1Messages();
  }, [currentWorkspace?.id, backendSessionId]);

  // Track previous workspace/session to detect actual changes
  const prevWorkspaceIdRef = useRef<string | undefined>(currentWorkspace?.id);
  const prevSessionIdRef = useRef<string | undefined>(backendSessionId);

  // Reload persisted state when workspace or session actually changes (after initial load)
  useEffect(() => {
    // Skip if workspace/session not ready
    if (!currentWorkspace?.id || !backendSessionId) {
      return;
    }

    // Skip initial load (handled by previous useEffect)
    if (!hasLoadedInitialState.current) {
      return;
    }

    const workspaceChanged =
      prevWorkspaceIdRef.current !== currentWorkspace?.id;
    const sessionChanged = prevSessionIdRef.current !== backendSessionId;

    // Only reload if workspace or session actually changed
    if (workspaceChanged || sessionChanged) {
      const previousWorkspaceId = prevWorkspaceIdRef.current;
      prevWorkspaceIdRef.current = currentWorkspace?.id;
      prevSessionIdRef.current = backendSessionId;

      console.log(
        "🔄 Workspace/session changed, validating and reloading Phase 2 state"
      );

      // CRITICAL: When workspace changes, immediately reset state to prevent showing wrong workspace's data
      if (workspaceChanged) {
        console.log(
          `🔄 Workspace changed from ${previousWorkspaceId} to ${currentWorkspace.id}, resetting Phase 2 state`
        );
        setSections([]);
        setCurrentSection(null);
        setCurrentQuestionIndex(0);
        setSectionsList([]);
        setIsStarted(false);
        setIsGenerating(false);
        setPhase1History([]);
        setPhase1IntroMessages([]); // Clear Phase 1 messages when workspace changes
        hasLoadedInitialState.current = false; // Allow re-initialization for new workspace
        hasRestoredState.current = false;
        hasLoadedPhase1Messages.current = false; // Allow Phase 1 messages to reload for new workspace
        hasRestoredQuestionScroll.current = false;
        restoredQuestionIndexRef.current = null; // Clear restored index for new workspace
      }

      // When session changes, reload Phase 1 messages
      if (sessionChanged) {
        console.log("🔄 Session changed, reloading Phase 1 messages");
        setPhase1IntroMessages([]); // Clear existing messages
        hasLoadedPhase1Messages.current = false; // Allow Phase 1 messages to reload
        hasRestoredQuestionScroll.current = false;
      }

      // Validate that the session belongs to the current workspace before loading state
      const validateAndLoadState = async () => {
        try {
          const { getSessionDetails } = await import("@/lib/ava-api");
          const sessionDetails = await getSessionDetails(backendSessionId);

          if (sessionDetails.workspaceId !== currentWorkspace.id) {
            console.log(
              `⚠️ Session ${backendSessionId} belongs to workspace ${sessionDetails.workspaceId}, but current workspace is ${currentWorkspace.id}. Not loading Phase 2 state.`
            );
            // State already reset above, just return
            return;
          }

          // Session belongs to this workspace - load persisted state
          const newPersistedState = loadPersistedState(currentWorkspace.id);

          if (newPersistedState) {
            // Handle both old format (with sections) and new minimal format
            if (
              newPersistedState.sections &&
              Array.isArray(newPersistedState.sections) &&
              newPersistedState.sections.length > 0
            ) {
              // Old format: restore full sections
              console.log(
                "🔄 Workspace/session changed - reloading Phase 2 state (old format):",
                newPersistedState
              );
              const sanitizedSections = newPersistedState.sections.map(
                (section: Section) => ({
                  ...section,
                  questions: section.questions.map((q: any) => ({
                    ...q,
                    isApproved: false,
                    status:
                      q.status === "generating" ? ("ready" as const) : q.status,
                  })),
                })
              );
              setSections(sanitizedSections);
              setCurrentSection(newPersistedState.currentSection || null);
              setCurrentQuestionIndex(
                newPersistedState.currentQuestionIndex || 0
              );
              setSectionsList(newPersistedState.sectionsList || []);
              setIsStarted(newPersistedState.isStarted || false);
            } else if (newPersistedState.currentSection !== undefined) {
              // New minimal format: only restore position
              console.log(
                "🔄 Workspace/session changed - reloading Phase 2 position (minimal format):",
                newPersistedState
              );
              setCurrentSection(newPersistedState.currentSection || null);
              setCurrentQuestionIndex(
                newPersistedState.currentQuestionIndex || 0
              );
              setIsStarted(newPersistedState.isStarted || false);
              // Sections will be loaded from backend
            }
          } else {
            // No saved state for this workspace/session, ensure reset
            console.log(
              "🔄 Workspace/session changed - no saved Phase 2 state, ensuring reset"
            );
            setSections([]);
            setCurrentSection(null);
            setCurrentQuestionIndex(0);
            setSectionsList([]);
            setIsStarted(false);
          }
        } catch (err: any) {
          console.error(
            "❌ Failed to validate session workspace in Phase 2:",
            err
          );
          // On error, ensure state is reset
          setSections([]);
          setCurrentSection(null);
          setCurrentQuestionIndex(0);
          setSectionsList([]);
          setIsStarted(false);
        }
      };

      validateAndLoadState();
    }
  }, [currentWorkspace?.id, backendSessionId]);

  const totalSections = 21;
  const completedCount = sections.filter((s) => s.isComplete).length;

  // Reset question scroll restoration whenever Phase 2 restarts
  useEffect(() => {
    if (!isStarted) {
      hasRestoredQuestionScroll.current = false;
    }
  }, [isStarted]);

  // Scroll functions for section navigation (removed - pagination removed)
  // const scrollSections = (direction: 'left' | 'right') => {
  //   if (sectionScrollRef.current) {
  //     const scrollAmount = 100; // pixels to scroll
  //     const scrollDirection = direction === 'left' ? -scrollAmount : scrollAmount;
  //     sectionScrollRef.current.scrollBy({ left: scrollDirection, behavior: 'smooth' });
  //   }
  // };

  // Auto-scroll to current section when it changes
  useEffect(() => {
    if (currentSection && sectionScrollRef.current) {
      const sectionElement = sectionScrollRef.current.querySelector(
        `[data-section-number="${currentSection}"]`
      );
      if (sectionElement) {
        sectionElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [currentSection]);

  // Restore scroll to the active Phase 2 question after refresh/navigation
  // CRITICAL: Only restore scroll if we have restored state (not a fresh session)
  useEffect(() => {
    if (hasRestoredQuestionScroll.current) {
      return;
    }
    if (!isStarted || !currentSection || sections.length === 0) {
      return;
    }

    const currentSectionData = sections.find(
      (s) => s.sectionNumber === currentSection
    );
    if (!currentSectionData || currentSectionData.questions.length === 0) {
      return;
    }

    // CRITICAL: Only attempt scroll restoration if we have restored state
    // For fresh sessions (restoredQuestionIndexRef is null), don't restore scroll
    // This prevents unwanted scrolling behavior when starting a new session
    const hasAnyRestoredState =
      restoredQuestionIndexRef.current !== null || hasRestoredState.current;

    if (!hasAnyRestoredState) {
      // Fresh session - just scroll to bottom naturally, don't restore to a specific question
      console.log(
        "🆕 Fresh session detected - skipping scroll restoration, will scroll naturally"
      );
      hasRestoredQuestionScroll.current = true; // Mark as done so we don't try again
      return;
    }

    // Use restored index if available, otherwise use current state
    const targetIndex =
      restoredQuestionIndexRef.current !== null
        ? restoredQuestionIndexRef.current
        : currentQuestionIndex;

    // Ensure we don't reset to 0 - use the saved index or find the last unapproved question
    let normalizedIndex = Math.min(
      Math.max(targetIndex, 0),
      currentSectionData.questions.length - 1
    );

    // If we have a restored index, always use it
    if (restoredQuestionIndexRef.current !== null) {
      normalizedIndex = Math.min(
        Math.max(restoredQuestionIndexRef.current, 0),
        currentSectionData.questions.length - 1
      );
    } else if (
      normalizedIndex === 0 &&
      currentSectionData.questions.length > 1 &&
      hasRestoredState.current
    ) {
      // Only try to find first unapproved question if we have restored state
      // This prevents unwanted behavior in fresh sessions
      const firstUnapprovedIndex = currentSectionData.questions.findIndex(
        (q) => !q.isApproved
      );
      if (firstUnapprovedIndex >= 0) {
        normalizedIndex = firstUnapprovedIndex;
        // Update the currentQuestionIndex state to match
        if (currentQuestionIndex !== firstUnapprovedIndex) {
          setCurrentQuestionIndex(firstUnapprovedIndex);
          restoredQuestionIndexRef.current = firstUnapprovedIndex;
          console.log(
            `📍 Updated currentQuestionIndex from ${currentQuestionIndex} to ${firstUnapprovedIndex} (first unapproved question)`
          );
        }
      }
    }

    if (normalizedIndex < 0) {
      return;
    }

    // Ensure state matches the target index
    if (currentQuestionIndex !== normalizedIndex) {
      setCurrentQuestionIndex(normalizedIndex);
      console.log(
        `📍 Adjusting question index from ${currentQuestionIndex} to ${normalizedIndex} for scroll restoration`
      );
    }

    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const anchorId = `section-${currentSectionData.sectionNumber}-question-${normalizedIndex}`;

    console.log(
      `📍 Attempting to restore scroll to question ${
        normalizedIndex + 1
      } in section ${currentSection}`,
      {
        anchorId,
        currentQuestionIndex,
        normalizedIndex,
        restoredIndex: restoredQuestionIndexRef.current,
        hasAnyRestoredState,
        totalQuestions: currentSectionData.questions.length,
      }
    );

    const attemptScroll = (attempt = 0) => {
      if (cancelled) {
        return;
      }
      const selector = `[data-phase2-question-anchor="${anchorId}"]`;
      const target = document.querySelector<HTMLElement>(selector);

      if (target) {
        requestAnimationFrame(() => {
          if (cancelled) {
            return;
          }
          // Scroll to the question and then scroll to bottom to ensure it's at end of screen
          target.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });

          // Additional scroll to bottom after a short delay to ensure end of screen visibility
          setTimeout(() => {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            });
            hasRestoredQuestionScroll.current = true;
            console.log(
              "✅ Restored scroll to Phase 2 question and scrolled to end",
              {
                anchorId,
                attempt,
                section: currentSection,
                questionIndex: normalizedIndex + 1,
              }
            );
          }, 300);
        });
        return;
      }

      // Retry with longer delays if DOM not ready - increase attempts for reliability
      if (attempt < 20) {
        const delay = attempt < 5 ? 300 : 500; // Faster attempts first, then slower
        const timeoutId = window.setTimeout(
          () => attemptScroll(attempt + 1),
          delay * (attempt + 1)
        );
        timeouts.push(timeoutId);
      } else {
        console.warn(
          "⚠️ Failed to restore scroll after 20 attempts - question element not found",
          { anchorId }
        );
        // Fallback: scroll to bottom anyway
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
        hasRestoredQuestionScroll.current = true;
      }
    };

    // Wait for DOM to be fully rendered before attempting scroll
    const initialDelay = setTimeout(() => {
      const rafId = window.requestAnimationFrame(() => {
        requestAnimationFrame(() => attemptScroll());
      });

      return () => {
        cancelled = true;
        window.cancelAnimationFrame(rafId);
      };
    }, 500); // Increased initial delay to ensure sections are rendered

    return () => {
      cancelled = true;
      clearTimeout(initialDelay);
      timeouts.forEach(clearTimeout);
    };
  }, [sections, currentSection, currentQuestionIndex, isStarted]);

  // Calculate progress for current section based on approved questions
  const getCurrentSectionProgress = () => {
    if (!currentSection) {
      return { currentQuestionIndex: 0, totalQuestions: 0 };
    }

    const currentSectionData = sections.find(
      (s) => s.sectionNumber === currentSection
    );
    if (
      !currentSectionData ||
      !currentSectionData.questions ||
      currentSectionData.questions.length === 0
    ) {
      return { currentQuestionIndex: 0, totalQuestions: 0 };
    }

    const totalQuestionsInSection = currentSectionData.questions.length;
    const approvedQuestionsCount = currentSectionData.questions.filter(
      (q) => q.isApproved
    ).length;

    return {
      currentQuestionIndex: approvedQuestionsCount,
      totalQuestions: totalQuestionsInSection,
    };
  };

  // Notify parent of progress changes
  useEffect(() => {
    if (onProgressChange) {
      const progress = getCurrentSectionProgress();
      onProgressChange(progress);
    }
  }, [currentSection, sections, onProgressChange]);

  // Notify parent when Phase 2 is complete
  useEffect(() => {
    if (onPhase2CompleteChange) {
      const isComplete = completedCount === totalSections;
      onPhase2CompleteChange(isComplete);
    }
  }, [completedCount, totalSections, onPhase2CompleteChange]);

  // Save progress to backend when section or question index changes
  useEffect(() => {
    // Only save if workspace, session, and state are available
    if (
      !currentWorkspace?.id ||
      !backendSessionId ||
      currentSection === null ||
      !hasInitialized.current
    ) {
      return;
    }

    // Debounce: Only save after user stops changing (500ms delay)
    const timeoutId = setTimeout(async () => {
      try {
        await savePhase2Progress(
          backendSessionId,
          currentSection,
          currentQuestionIndex
        );
        console.log(
          `💾 Phase 2 progress saved to backend: Section ${currentSection}, Question Index ${currentQuestionIndex}`
        );
      } catch (error: any) {
        console.error("Failed to save Phase 2 progress to backend:", error);
        // Don't block UI - continue silently
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    currentSection,
    currentQuestionIndex,
    backendSessionId,
    currentWorkspace?.id,
  ]);

  // Persist state to localStorage and backend whenever it changes
  useEffect(() => {
    // Only persist if workspace is available
    if (!currentWorkspace?.id) {
      return;
    }

    const key = getPersistenceKey(currentWorkspace.id);
    if (!key) {
      console.warn("⚠️ Cannot persist state without workspace ID");
      return;
    }

    // Save only minimal essential state to avoid quota exceeded errors
    // Backend is the source of truth for full content, we only need to restore position
    const minimalState = {
      currentSection,
      currentQuestionIndex,
      isStarted,
      lastUpdated: new Date().toISOString(),
      // Only save section metadata (numbers and completion status), not full content
      sectionMetadata: sections.map((s) => ({
        sectionNumber: s.sectionNumber,
        isComplete: s.isComplete,
        questionCount: s.questions.length,
      })),
    };

    try {
      const stateString = JSON.stringify(minimalState);
      const sizeInMB = new Blob([stateString]).size / (1024 * 1024);

      // Check size before saving (localStorage limit is typically 5-10MB)
      if (sizeInMB > 4) {
        console.warn(
          `⚠️ Phase 2 state is too large (${sizeInMB.toFixed(
            2
          )}MB), saving minimal state only`
        );
        // Save even more minimal state
        const ultraMinimalState = {
          currentSection,
          currentQuestionIndex,
          isStarted,
          lastUpdated: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(ultraMinimalState));
      } else {
        localStorage.setItem(key, stateString);
      }

      console.log(
        `💾 Phase 2 state saved to localStorage for workspace ${currentWorkspace.id}:`,
        {
          currentSection,
          currentQuestionIndex,
          sectionsCount: sections.length,
          completedCount,
          isStarted,
          sizeMB: sizeInMB.toFixed(2),
        }
      );
    } catch (error: any) {
      // Handle QuotaExceededError gracefully
      if (
        error.name === "QuotaExceededError" ||
        error.message?.includes("quota")
      ) {
        console.warn(
          "⚠️ localStorage quota exceeded, attempting to clear old Phase 2 data and save minimal state"
        );

        // Try to clear old Phase 2 data for this workspace
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const storageKey = localStorage.key(i);
            if (
              storageKey &&
              storageKey.startsWith(`ava-phase2-${currentWorkspace.id}-`) &&
              storageKey !== key
            ) {
              keysToRemove.push(storageKey);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
          console.log(
            `🧹 Cleared ${keysToRemove.length} old Phase 2 localStorage entries`
          );

          // Try saving minimal state again
          const minimalStateRetry = {
            currentSection,
            currentQuestionIndex,
            isStarted,
            lastUpdated: new Date().toISOString(),
          };
          localStorage.setItem(key, JSON.stringify(minimalStateRetry));
          console.log("✅ Saved minimal Phase 2 state after clearing old data");
        } catch (retryError: any) {
          console.error(
            "❌ Failed to save Phase 2 state even after clearing old data:",
            retryError
          );
          // Don't throw - backend will handle state restoration
        }
      } else {
        console.error(
          "❌ Failed to save Phase 2 state to localStorage:",
          error
        );
        // Don't throw - backend will handle state restoration
      }
    }

    // Also save Phase 1 + Phase 2 conversation to backend
    // Combine Phase 1 intro messages with Phase 2 sections for complete history
    if (backendSessionId && phase1IntroMessages.length > 0) {
      // Debounce backend save to avoid too many requests
      const timeoutId = setTimeout(async () => {
        try {
          // Phase 1 messages are already in phase1IntroMessages
          // We just need to ensure they're saved to backend
          await saveConversationHistory(backendSessionId, phase1IntroMessages);
          console.log("✅ Phase 1 conversation history saved to backend");
        } catch (error) {
          console.warn("⚠️ Failed to save conversation to backend:", error);
        }
      }, 2000); // 2 second debounce

      return () => clearTimeout(timeoutId);
    }
  }, [
    sections,
    currentSection,
    currentQuestionIndex,
    sectionsList,
    isStarted,
    currentWorkspace?.id,
    backendSessionId,
    phase1IntroMessages,
  ]);

  // Scroll to Phase 2 start position immediately when component mounts (transitioning from Phase 1)
  // This ensures Phase 1 questions are not visible - starts from same position as button click
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldHidePhase1Messages =
      sessionStorage.getItem("ava-phase2-hide-phase1-messages") === "true";
    if (!shouldHidePhase1Messages) {
      setShowPhase1Messages(true);
    }
  }, []); // Run once on mount to sync Phase 1 visibility state

  // The heavy scroll locking logic was replaced with a simpler approach above to avoid trapping the user scroll position.

  // Initialize Phase 2
  useEffect(() => {
    console.log("🔍 🔍 🔍 PHASE 2 COMPONENT MOUNTED 🔍 🔍 🔍");

    // Wait for workspace to be available before initializing
    if (!currentWorkspace?.id || !backendSessionId) {
      return;
    }

    // Check if chunks were being displayed when page was refreshed
    const chunksDisplaying = sessionStorage.getItem("phase2-chunks-displaying");
    if (chunksDisplaying === "true") {
      console.log(
        "🔄 Page was refreshed while chunks were displaying - re-triggering API from start"
      );
      // Clear the chunk display state
      sessionStorage.removeItem("phase2-chunks-displaying");
      sessionStorage.removeItem("phase2-chunks-count");
      sessionStorage.removeItem("phase2-chunks-displayed");
      // Reset initialization flag and state to trigger re-initialization
      hasInitialized.current = false;
      setIsStarted(false);
      setPhase1IntroMessages((prev) => {
        // Remove any Phase 2 intro messages that were partially displayed
        return prev.filter((msg) => !msg.id?.startsWith("phase2-intro-"));
      });
      // Set flag to force re-initialization
      sessionStorage.setItem("phase2-force-reinit", "true");
    }

    console.log("Initialization check:", {
      backendSessionId,
      hasInitialized: hasInitialized.current,
      userName,
      phase1AnswersCount: phase1Answers?.length || 0,
      workspaceId: currentWorkspace.id,
    });
    console.log("Full props received:", {
      backendSessionId,
      userName,
      phase1Answers,
    });

    // Check if force reinit is needed (refresh during chunk rendering)
    const forceReinit =
      sessionStorage.getItem("phase2-force-reinit") === "true";
    if (hasInitialized.current && !forceReinit) {
      console.log("⏸️ Phase 2: Already initialized, skipping");
      return;
    }

    // If force reinit, reset the flag and allow initialization to proceed
    if (forceReinit) {
      console.log("🔄 Force reinit detected - will re-initialize Phase 2");
      hasInitialized.current = false;
    }

    // CRITICAL: Check backend FIRST before localStorage or generating Section 1
    // This ensures we restore the correct progress from database
    const checkBackendProgress = async () => {
      try {
        console.log("🔍 Checking backend for existing Phase 2 progress...");
        const backendProgress = await getPhase2Progress(backendSessionId);

        if (
          backendProgress &&
          backendProgress.sections &&
          backendProgress.sections.length > 0
        ) {
          console.log(
            "✅ Found existing Phase 2 progress in backend:",
            backendProgress
          );
          console.log(
            `   Current Section: ${backendProgress.currentSection}, Question Index: ${backendProgress.currentQuestionIndex}`
          );

          // Restore from backend - this is the source of truth
          hasInitialized.current = true;
          actualSessionIdRef.current = backendSessionId || null;
          hasRestoredState.current = true;

          // Sanitize sections from backend
          const sanitizedSections = backendProgress.sections.map(
            (section: Section) => ({
              ...section,
              questions: section.questions.map((q: any) => ({
                ...q,
                isApproved: q.isApproved || false,
                status:
                  q.status === "generating" ? ("ready" as const) : q.status,
              })),
            })
          );

          setSections(sanitizedSections);
          const restoredSection = backendProgress.currentSection || null;
          const restoredIndex =
            backendProgress.currentQuestionIndex !== undefined
              ? backendProgress.currentQuestionIndex
              : 0;
          setCurrentSection(restoredSection);
          setCurrentQuestionIndex(restoredIndex);
          restoredQuestionIndexRef.current = restoredIndex; // Track restored index
          setSectionsList(backendProgress.sectionsList || []);
          setIsStarted(true);
          setIsGenerating(false);
          setIsTransitioningSection(false);
          console.log(
            `✅ Restored Phase 2 state: Section ${restoredSection}, Question Index ${restoredIndex}`
          );

          // Load Phase 1 history for display
          if (phase1History.length === 0 && backendSessionId) {
            (async () => {
              try {
                const { getPhase1Answers } = await import("@/lib/ava-api");
                const backendAnswers = await getPhase1Answers(backendSessionId);
                console.log(
                  `✅ Restored ${backendAnswers.length} Phase 1 answers from backend`
                );
                // Sort by questionId to ensure consistent ordering (Question 1, Question 2, etc.)
                const sortedAnswers = [...backendAnswers].sort((a, b) => {
                  const getQuestionNum = (qId: string) => {
                    const match = qId.match(/(\d+)/);
                    return match ? parseInt(match[1], 10) : 0;
                  };
                  const numA = getQuestionNum(a.questionId || "");
                  const numB = getQuestionNum(b.questionId || "");
                  return numA - numB;
                });
                setPhase1History(
                  sortedAnswers.length > 0 ? sortedAnswers : backendAnswers
                );
              } catch (error) {
                console.warn(
                  "⚠️ Failed to load Phase 1 history during restore:",
                  error
                );
              }
            })();
          }

          // Refresh current section from backend to get latest question states
          const currentSectionNum = backendProgress.currentSection;
          const savedQuestionIndex = backendProgress.currentQuestionIndex || 0;
          if (currentSectionNum && backendSessionId) {
            console.log(
              `🔄 Refreshing section ${currentSectionNum} status from backend...`
            );
            getSectionStatus(backendSessionId, currentSectionNum)
              .then((statusResponse) => {
                console.log("✅ Section status refreshed:", statusResponse);
                const sectionData = statusResponse?.data || statusResponse;

                // Update the current section with fresh data from backend
                setSections((prev) =>
                  prev.map((section) => {
                    if (section.sectionNumber === currentSectionNum) {
                      const updatedQuestions = (
                        sectionData?.questions || []
                      ).map((q: any) => ({
                        id: q.id,
                        questionId: q.questionId,
                        questionText: q.questionText,
                        aiGeneratedAnswer: q.aiGeneratedAnswer,
                        userEditedAnswer: q.userEditedAnswer,
                        status:
                          q.status ||
                          (q.aiGeneratedAnswer
                            ? ("ready" as const)
                            : ("generating" as const)),
                        isApproved: q.isApproved || false,
                      }));

                      // Ensure currentQuestionIndex is preserved and not reset
                      // Find the first unapproved question or use saved index
                      const firstUnapprovedIndex = updatedQuestions.findIndex(
                        (q: QuestionResponse) => !q.isApproved
                      );
                      const targetIndex =
                        firstUnapprovedIndex >= 0
                          ? firstUnapprovedIndex
                          : Math.min(
                              savedQuestionIndex,
                              updatedQuestions.length - 1
                            );

                      // Update question index if needed to ensure we're at the right position
                      if (
                        targetIndex !== savedQuestionIndex &&
                        targetIndex >= 0
                      ) {
                        console.log(
                          `📍 Adjusting question index from ${savedQuestionIndex} to ${targetIndex} after section refresh`
                        );
                        setCurrentQuestionIndex(targetIndex);
                      }

                      return {
                        ...section,
                        questions: updatedQuestions,
                      };
                    }
                    return section;
                  })
                );
              })
              .catch((err) => {
                console.error("⚠️ Failed to refresh section status:", err);
              });
          }

          console.log(
            "✅ Phase 2 restored from backend - skipping Section 1 generation"
          );
          return true; // Successfully restored, don't generate Section 1
        } else {
          console.log(
            "📂 No existing Phase 2 progress in backend, will check localStorage or generate Section 1"
          );
          return false; // No backend progress, proceed with initialization
        }
      } catch (error: any) {
        console.warn("⚠️ Failed to check backend progress:", error);
        return false; // On error, proceed with initialization
      }
    };

    // First, check backend for existing progress BEFORE initializing
    let cancelled = false;
    let actualSessionId = backendSessionId;
    const phase1AnswersArray = phase1Answers || []; // Use prop

    const initPhase2 = async () => {
      console.log("🔥 initPhase2 async function called!");

      // CRITICAL: Check if restoration already happened (sections already loaded)
      // The restore useEffect might have already loaded sections from backend
      if (sections.length > 0 && currentSection !== null) {
        console.log(
          "✅ Sections already loaded from restore - skipping Section 1 generation",
          {
            sectionsCount: sections.length,
            currentSection,
            currentQuestionIndex,
            restoredIndex: restoredQuestionIndexRef.current,
          }
        );
        hasInitialized.current = true;
        actualSessionIdRef.current = backendSessionId || null;

        // Ensure question index is preserved from restoration
        if (
          restoredQuestionIndexRef.current !== null &&
          currentQuestionIndex !== restoredQuestionIndexRef.current
        ) {
          console.log(
            `📍 Restoring question index to ${restoredQuestionIndexRef.current} during init check`
          );
          setCurrentQuestionIndex(restoredQuestionIndexRef.current);
        }

        return; // Don't generate Section 1 if sections are already loaded
      }

      // CRITICAL: Check backend FIRST before doing anything else
      const hasBackendProgress = await checkBackendProgress();
      if (hasBackendProgress) {
        console.log(
          "✅ Phase 2 already has progress - restoration complete, skipping Section 1 generation"
        );
        return; // Don't generate Section 1 if we restored from backend
      }

      // If no backend progress, proceed with initialization
      console.log(
        "🚀 No backend progress found - starting fresh Phase 2 initialization..."
      );
      // STEP 1: Try to get backendSessionId from various sources
      console.group("🔍 Phase 2: Recovering/Getting Backend Session ID");

      // Try 1: Use the prop if available
      if (actualSessionId) {
        console.log("✅ Using backendSessionId from props:", actualSessionId);
      } else {
        // Try 2: Check localStorage for saved session
        const savedSession = localStorage.getItem("ava-chat-session");
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (parsed.backendSessionId) {
              actualSessionId = parsed.backendSessionId;
              console.log(
                "✅ Found backendSessionId in localStorage:",
                actualSessionId
              );
            }
          } catch (e) {
            console.warn("⚠️ Could not parse saved session:", e);
          }
        }

        // Try 3: Create a new backend session if still missing
        if (!actualSessionId) {
          console.log("⚠️ No backend session found, creating new one...");
          try {
            // Get workspace ID from context or localStorage
            let workspaceId = currentWorkspace?.id;
            const workspaceStr = localStorage.getItem("currentWorkspace");

            if (!workspaceId) {
              // Fallback: check localStorage
              workspaceId = workspaceStr ? JSON.parse(workspaceStr)?.id : null;
            }

            console.log("🔍 Workspace lookup:", {
              fromContext: currentWorkspace?.id,
              fromLocalStorage: workspaceStr
                ? JSON.parse(workspaceStr)?.id
                : null,
              finalWorkspaceId: workspaceId,
            });

            if (workspaceId) {
              console.log(
                "🔨 Creating new backend session with workspace:",
                workspaceId
              );
              const newSession = await createAvaSession(
                workspaceId,
                `AVA Profile - ${userName} (Phase 2 Recovery)`
              );
              const newSessionId = newSession.id || newSession.sessionId; // Handle both formats
              if (newSessionId) {
                actualSessionId = newSessionId;
                console.log("✅ Created new backend session:", actualSessionId);
              } else {
                throw new Error(
                  "No session ID returned from new session creation"
                );
              }

              // Update localStorage with the new session ID
              if (savedSession) {
                try {
                  const parsed = JSON.parse(savedSession);
                  parsed.backendSessionId = actualSessionId;
                  localStorage.setItem(
                    "ava-chat-session",
                    JSON.stringify(parsed)
                  );
                  console.log(
                    "💾 Updated localStorage with new backendSessionId"
                  );
                } catch (e) {
                  console.error("❌ Failed to update localStorage:", e);
                }
              }
            } else {
              throw new Error(
                "No workspace ID found. Please ensure you have a workspace selected."
              );
            }
          } catch (error: any) {
            console.error("❌ Failed to create backend session:", error);
            setInitError(
              `Failed to create backend session: ${error.message}. Please restart from Phase 1.`
            );
            console.groupEnd();
            return;
          }
        }
      }

      console.log("✅ Final backendSessionId to use:", actualSessionId);
      console.groupEnd();

      if (!actualSessionId) {
        console.error(
          "❌ CRITICAL: Still no backendSessionId after all recovery attempts!"
        );
        setInitError(
          "Backend session ID is missing. Please restart from Phase 1."
        );
        return;
      }

      hasInitialized.current = true;
      actualSessionIdRef.current = actualSessionId; // Store for use throughout component

      console.group("🚀 Phase 2: Initialization Started");
      console.log("📋 Session ID:", actualSessionId);

      try {
        // Step 0: Validate Phase 1 answers are available
        console.log("🔍 Step 0: Validating Phase 1 data...", {
          localAnswersCount: phase1AnswersArray.length,
          expectedCount: 27,
        });

        // Fetch Phase 1 answers from backend to display history
        console.log("📚 Fetching Phase 1 history for display...");
        try {
          const { getPhase1Answers } = await import("@/lib/ava-api");
          const backendAnswers = await getPhase1Answers(actualSessionId);
          console.log(
            `✅ Retrieved ${backendAnswers.length} Phase 1 answers from backend`
          );

          // Store Phase 1 history for display (already sorted by backend by createdAt)
          // Sort by questionId to ensure consistent ordering (as backup)
          const sortedAnswers = [...backendAnswers].sort((a, b) => {
            // Extract numeric part from questionId if available (e.g., "q1" -> 1, "question-1" -> 1)
            const getQuestionNum = (qId: string) => {
              const match = qId.match(/(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            };
            const numA = getQuestionNum(a.questionId || "");
            const numB = getQuestionNum(b.questionId || "");
            return numA - numB;
          });
          setPhase1History(
            sortedAnswers.length > 0 ? sortedAnswers : backendAnswers
          );

          // Load ALL Phase 1 messages from backend first, then localStorage fallback
          if (
            !hasLoadedPhase1Messages.current &&
            currentWorkspace?.id &&
            phase1IntroMessages.length === 0 &&
            actualSessionId
          ) {
            hasLoadedPhase1Messages.current = true;
            try {
              // Try backend first (source of truth)
              const backendHistory = await getConversationHistory(
                actualSessionId
              );
              if (
                backendHistory.messages &&
                backendHistory.messages.length > 0
              ) {
                // Deduplicate messages before setting
                const uniqueMessages = backendHistory.messages.filter(
                  (msg: any, index: number, self: any[]) => {
                    const firstIndex = self.findIndex(
                      (m: any) =>
                        m.id === msg.id ||
                        (m.content === msg.content && m.role === msg.role)
                    );
                    return index === firstIndex;
                  }
                );
                setPhase1IntroMessages(uniqueMessages);
                console.log(
                  `✅ Loaded ${uniqueMessages.length} unique Phase 1 messages from backend during initialization (deduplicated from ${backendHistory.messages.length})`
                );
              } else {
                // Fallback to localStorage
                const phase1Key = `ava-phase1-chat-${currentWorkspace.id}-${actualSessionId}`;
                const phase1State = localStorage.getItem(phase1Key);
                if (phase1State) {
                  const parsed = JSON.parse(phase1State);
                  if (parsed.messages && Array.isArray(parsed.messages)) {
                    // Deduplicate messages before setting
                    const uniqueMessages = parsed.messages.filter(
                      (msg: any, index: number, self: any[]) => {
                        const firstIndex = self.findIndex(
                          (m: any) =>
                            m.id === msg.id ||
                            (m.content === msg.content && m.role === msg.role)
                        );
                        return index === firstIndex;
                      }
                    );
                    // Load ALL messages including intro, name submission, video, questions, and answers
                    setPhase1IntroMessages(uniqueMessages);
                    console.log(
                      `✅ Loaded ${uniqueMessages.length} unique Phase 1 messages from localStorage during initialization (deduplicated from ${parsed.messages.length})`
                    );
                  }
                }
              }
            } catch (error) {
              console.warn(
                "⚠️ Failed to load Phase 1 messages during initialization:",
                error
              );
              hasLoadedPhase1Messages.current = false; // Reset on error so we can retry
            }
          }

          if (backendAnswers.length < 27) {
            const count = backendAnswers.length;
            const errorMsg = `Incomplete Phase 1 data: ${count}/27 answers found in database. Please complete Phase 1 first.`;
            console.error("❌", errorMsg);
            setInitError(errorMsg);
            console.groupEnd();
            return;
          }
        } catch (fetchError: any) {
          console.error(
            "❌ Failed to fetch Phase 1 answers from backend:",
            fetchError
          );
          // If local answers exist, try to use them
          if (phase1AnswersArray.length >= 27) {
            console.log("⚠️ Using local Phase 1 answers as fallback");
            // Convert local answers to history format if needed
            const localHistory = phase1AnswersArray.map((ans, idx) => ({
              questionId: ans.questionId || `q-${idx}`,
              sectionId: "",
              questionText: `Question ${idx + 1}`,
              answer: ans.answer || "",
            }));
            setPhase1History(localHistory);
          } else {
            const count = phase1AnswersArray.length;
            const errorMsg = `Could not retrieve Phase 1 answers from database. ${count}/27 answers available locally. ${fetchError.message}`;
            setInitError(errorMsg);
            console.groupEnd();
            return;
          }
        }

        // Step 1: Check session status before starting Phase 2
        console.log(
          "📡 Step 1: Checking session status before starting Phase 2..."
        );

        let sessionDetails = null;
        try {
          sessionDetails = await getSessionDetails(actualSessionId);
          console.log("✅ Session details retrieved:", {
            currentPhase: sessionDetails?.currentPhase,
            sessionId: actualSessionId,
          });
        } catch (error: any) {
          console.warn("⚠️ Could not get session details:", error?.message);
        }

        // If session is already completed, skip startPhase2 call and restore sections
        const isAlreadyCompleted =
          sessionDetails?.currentPhase === "completed" ||
          sessionDetails?.currentPhase === "complete";

        if (isAlreadyCompleted) {
          console.log(
            `✅ Session is already ${sessionDetails?.currentPhase} - skipping startPhase2 call`
          );
          console.log(
            "🔄 Session is completed - attempting to restore all sections..."
          );
          const hasBackendProgress = await checkBackendProgress();
          if (hasBackendProgress) {
            console.log(
              "✅ Successfully restored completed Phase 2 from backend"
            );
            hasInitialized.current = true;
            actualSessionIdRef.current = actualSessionId;
            return; // Exit initialization - sections already restored
          } else {
            console.warn(
              "⚠️ Could not restore completed Phase 2 from backend - sections may be lost"
            );
            // Still try to continue, but this is not ideal
          }
        }

        // If session is already in phase2 but not completed, skip startPhase2 but continue
        const isAlreadyInPhase2 = sessionDetails?.currentPhase === "phase2";
        let startResponse = null;

        if (!isAlreadyCompleted && !isAlreadyInPhase2) {
          // Check if this is a forced re-initialization after refresh
          const forceReinit =
            sessionStorage.getItem("phase2-force-reinit") === "true";
          if (forceReinit) {
            console.log(
              "🔄 Force re-initialization detected - calling startPhase2 API again"
            );
            sessionStorage.removeItem("phase2-force-reinit");
          }

          console.log("📡 Step 1: POST /ava-sessions/:id/start-phase2");
          startResponse = await startPhase2(actualSessionId);
          console.log("✅ Step 1: SUCCESS", startResponse);
        } else if (isAlreadyInPhase2) {
          console.log(
            "✅ Session is already in Phase 2 - skipping startPhase2 call, proceeding with section generation"
          );
        }

        // Capture sections list for navigation (from startResponse if available)
        if (startResponse) {
          try {
            const data = startResponse?.data || startResponse;
            if (Array.isArray(data?.sections)) {
              setSectionsList(
                data.sections.map((s: any) => ({
                  sectionNumber: s.sectionNumber,
                  title: s.title,
                  intro: s.intro,
                  isApproved: !!s.isApproved,
                }))
              );
            }

            // Handle message array from response (for resuming sessions)
            if (data?.message) {
              const messageContent = data.message;
              if (Array.isArray(messageContent)) {
                // Mark that we're starting to display chunks
                sessionStorage.setItem("phase2-chunks-displaying", "true");
                sessionStorage.setItem(
                  "phase2-chunks-count",
                  String(messageContent.length)
                );
                sessionStorage.setItem("phase2-chunks-displayed", "0");

                // Wait 2-3 seconds before starting to display chunks
                await new Promise((resolve) =>
                  setTimeout(resolve, 2000 + Math.random() * 1000)
                );

                // Convert array of HTML strings to messages and display progressively
                for (let idx = 0; idx < messageContent.length; idx++) {
                  const msgHtml = messageContent[idx];
                  const introMessage = {
                    id: `phase2-intro-${idx}-${Date.now()}`,
                    role: "ava" as const,
                    content: msgHtml, // HTML string will be rendered by component
                    timestamp: new Date(),
                  };

                  // Add message progressively
                  setPhase1IntroMessages((prev) => {
                    // Check if message already exists to avoid duplicates
                    const exists = prev.some(
                      (m) =>
                        m.id === introMessage.id ||
                        (m.content === msgHtml && m.role === "ava")
                    );
                    if (!exists) {
                      sessionStorage.setItem(
                        "phase2-chunks-displayed",
                        String(idx + 1)
                      );
                      return [...prev, introMessage];
                    }
                    return prev;
                  });

                  // Small delay between chunks for smooth rendering
                  if (idx < messageContent.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                  }
                }

                // Mark chunks as fully displayed
                sessionStorage.setItem("phase2-chunks-displaying", "false");
                sessionStorage.removeItem("phase2-chunks-count");
                sessionStorage.removeItem("phase2-chunks-displayed");

                console.log(
                  `✅ Added ${messageContent.length} intro messages from startPhase2 response (displayed progressively)`
                );
              } else if (typeof messageContent === "string") {
                // Single message string (backward compatibility)
                const introMessage = {
                  id: `phase2-intro-${Date.now()}`,
                  role: "ava" as const,
                  content: messageContent,
                  timestamp: new Date(),
                };

                setPhase1IntroMessages((prev) => {
                  const exists = prev.some(
                    (m) => m.content === messageContent && m.role === "ava"
                  );
                  if (!exists) {
                    console.log(
                      "✅ Added intro message from startPhase2 response"
                    );
                    return [...prev, introMessage];
                  }
                  return prev;
                });
              }
            }
          } catch (e) {
            console.warn("⚠️ Failed to parse sections list from start-phase2");
          }
        }

        if (cancelled) {
          console.log("❌ Initialization cancelled");
          return;
        }

        setIsStarted(true);
        setInitError(null);

        // Step 1.5: Verify session state and Phase 1 answers in backend
        console.log("🔍 Step 1.5: Verifying session state and backend data...");
        try {
          const sessionDetails = await getSessionDetails(actualSessionId);
          console.log("✅ Session details:", {
            id: sessionDetails.id || sessionDetails.sessionId,
            currentPhase: sessionDetails.currentPhase,
            userName: userName, // Use prop directly
          });

          // Handle message array from session details (for resuming sessions)
          // Only process if not a forced re-initialization (will be handled by startPhase2 response)
          const forceReinit =
            sessionStorage.getItem("phase2-force-reinit") === "true";
          if (sessionDetails?.message && !forceReinit) {
            const messageContent = sessionDetails.message;
            if (Array.isArray(messageContent)) {
              // Mark that we're starting to display chunks
              sessionStorage.setItem("phase2-chunks-displaying", "true");
              sessionStorage.setItem(
                "phase2-chunks-count",
                String(messageContent.length)
              );
              sessionStorage.setItem("phase2-chunks-displayed", "0");

              // Wait 2-3 seconds before starting to display chunks
              await new Promise((resolve) =>
                setTimeout(resolve, 2000 + Math.random() * 1000)
              );

              // Convert array of HTML strings to messages and display progressively
              for (let idx = 0; idx < messageContent.length; idx++) {
                const msgHtml = messageContent[idx];
                const introMessage = {
                  id: `phase2-intro-${idx}-${Date.now()}`,
                  role: "ava" as const,
                  content: msgHtml, // HTML string will be rendered by component
                  timestamp: new Date(),
                };

                // Add message progressively
                setPhase1IntroMessages((prev) => {
                  // Check if message already exists to avoid duplicates
                  const exists = prev.some(
                    (m) =>
                      m.id === introMessage.id ||
                      (m.content === msgHtml && m.role === "ava")
                  );
                  if (!exists) {
                    sessionStorage.setItem(
                      "phase2-chunks-displayed",
                      String(idx + 1)
                    );
                    return [...prev, introMessage];
                  }
                  return prev;
                });

                // Small delay between chunks for smooth rendering
                if (idx < messageContent.length - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                }
              }

              // Mark chunks as fully displayed
              sessionStorage.setItem("phase2-chunks-displaying", "false");
              sessionStorage.removeItem("phase2-chunks-count");
              sessionStorage.removeItem("phase2-chunks-displayed");

              console.log(
                `✅ Added ${messageContent.length} intro messages from getSessionDetails response (displayed progressively)`
              );
            } else if (typeof messageContent === "string") {
              // Single message string (backward compatibility)
              const introMessage = {
                id: `phase2-intro-${Date.now()}`,
                role: "ava" as const,
                content: messageContent,
                timestamp: new Date(),
              };

              setPhase1IntroMessages((prev) => {
                const exists = prev.some(
                  (m) => m.content === messageContent && m.role === "ava"
                );
                if (!exists) {
                  console.log(
                    "✅ Added intro message from getSessionDetails response"
                  );
                  return [...prev, introMessage];
                }
                return prev;
              });
            }
          }

          // Accept various phase2 formats and also allow if session auto-started (could be in transition state)
          const validPhases = [
            "phase2",
            "phase_2",
            "Phase2",
            "PHASE2",
            "transition",
          ];
          if (!validPhases.includes(sessionDetails.currentPhase)) {
            console.warn(
              "⚠️ Session not in phase2 state:",
              sessionDetails.currentPhase
            );
            // If phase is close to phase2, proceed anyway (backend may auto-transition)
            if (
              sessionDetails.currentPhase &&
              sessionDetails.currentPhase.toLowerCase().includes("phase")
            ) {
              console.log(
                "✅ Phase appears valid, proceeding despite format mismatch"
              );
            } else {
              setInitError(
                `Session is not ready for Phase 2. Current phase: ${sessionDetails.currentPhase}. The backend may need to transition the session. Try clicking "Retry Phase 2".`
              );
              console.groupEnd();
              return;
            }
          }

          // Note: Backend should have Phase 1 answers from submitAnswer calls
          // If answers were saved properly, they'll be in the database
          console.log("✅ Session verified, proceeding with generation");
        } catch (verifyError: any) {
          console.warn(
            "⚠️ Could not verify session state, proceeding anyway:",
            verifyError
          );
        }

        // Step 2: Generate Section 1 (only if no progress exists)
        console.log("📡 Step 2: POST /ava-sessions/:id/generate-section/1");
        setIsGenerating(true);
        setCurrentSection(1);
        // CRITICAL: Only reset to 0 if we don't have a saved question index
        // If sections already exist from restore, preserve the current index
        // Also check if we have a restored index that we need to preserve
        const savedIndex =
          restoredQuestionIndexRef.current !== null
            ? restoredQuestionIndexRef.current
            : currentQuestionIndex;

        // Never reset if we have a restored index, or if we're not starting fresh
        if (restoredQuestionIndexRef.current !== null) {
          // We have a restored index - preserve it
          setCurrentQuestionIndex(restoredQuestionIndexRef.current);
          console.log(
            `📍 Preserving restored question index ${restoredQuestionIndexRef.current} for Section 1`
          );
        } else if (sections.length === 0 || currentSection !== 1) {
          // Only reset for truly brand new sections (no sections exist and starting section 1)
          setCurrentQuestionIndex(0);
          console.log(
            `📍 Starting fresh - setting question index to 0 for Section 1`
          );
        } else {
          // Preserve existing question index when regenerating existing section
          setCurrentQuestionIndex(savedIndex);
          console.log(
            `📍 Preserving existing question index ${savedIndex} for Section 1`
          );
        }

        let sectionResponse;
        try {
          sectionResponse = await generateSection(actualSessionId, 1);
          console.log("✅ Step 2: Section 1 response", sectionResponse);
        } catch (error: any) {
          console.error("❌ Step 2: Section 1 generation failed:", error);
          const answersCount = phase1AnswersArray.length;
          console.error("❌ Error details:", {
            message: error.message,
            sessionId: actualSessionId,
            phase1AnswersCount: answersCount,
          });

          // Check if we have Phase 1 answers
          if (answersCount === 0) {
            setInitError(
              `No Phase 1 answers found! Please complete Phase 1 first. Found ${answersCount} answers.`
            );
          } else if (answersCount < 27) {
            setInitError(
              `Incomplete Phase 1 data (${answersCount}/27 answers). Backend may not have all answers saved. Please restart from Phase 1.`
            );
          } else {
            setInitError(
              `Section generation failed: ${error.message}. This is likely a backend issue. Check: 1) AI service (Gemini) is configured, 2) Phase 1 answers are saved in database (should have 27), 3) Backend logs for details. The error suggests the backend cannot generate AI responses - check your AI API key and service configuration.`
            );
          }

          // Don't fail completely - show a fallback UI
          console.log(
            "⚠️ Proceeding with fallback - showing Phase 2 UI without initial section"
          );

          // Set a dummy section so user can at least see Phase 2 interface
          const fallbackSection: Section = {
            sectionNumber: 1,
            sectionTitle: "Section 1",
            sectionIntro:
              '⚠️ Generation failed. Click "Regenerate Section" below or check backend logs.',
            questions: [],
            isComplete: false,
          };

          setSections([fallbackSection]);
          setIsGenerating(false);
          setIsStarted(true);
          console.groupEnd();
          return;
        }

        if (cancelled) {
          console.log("❌ Generation cancelled");
          console.groupEnd();
          return;
        }

        console.log(
          "🔍 RAW sectionResponse:",
          JSON.stringify(sectionResponse, null, 2)
        );
        const sectionPayload = sectionResponse?.data ?? sectionResponse;
        console.log(
          "🔍 EXTRACTED sectionPayload:",
          JSON.stringify(sectionPayload, null, 2)
        );

        // Parse questions from response
        const questions: QuestionResponse[] = (
          sectionPayload?.questions || []
        ).map((q: any) => ({
          id: q.id,
          questionId: q.questionId,
          questionText: q.questionText,
          aiGeneratedAnswer: q.aiGeneratedAnswer,
          userEditedAnswer: q.userEditedAnswer,
          status:
            q.status ||
            (q.aiGeneratedAnswer
              ? ("ready" as const)
              : ("generating" as const)),
          isApproved: q.isApproved || false, // Always use backend's isApproved value
        }));

        console.log("📝 Parsed questions:", questions);
        console.log("📝 Questions count:", questions.length);

        const newSection: Section = {
          sectionNumber: sectionPayload?.sectionNumber || 1,
          sectionTitle: sectionPayload?.sectionTitle || "Section 1",
          sectionIntro: sectionPayload?.sectionIntro || "",
          questions,
          isComplete: false,
        };

        console.log(
          "📝 NEW SECTION TO ADD:",
          JSON.stringify(newSection, null, 2)
        );
        setSections([newSection]);
        console.log("✅ Step 2: Section 1 added to state via setSections");
        console.log(
          "✅ setSections([newSection]) called - React should re-render now"
        );

        // CRITICAL: Now that Phase 2 section is ready, show Phase 1 messages if they were hidden
        // This allows users to scroll up to see Phase 1 content after Phase 2 is generating
        const shouldHidePhase1Messages =
          sessionStorage.getItem("ava-phase2-hide-phase1-messages") === "true";
        if (shouldHidePhase1Messages) {
          // Clear the flag and show Phase 1 messages now that Phase 2 section is ready
          sessionStorage.removeItem("ava-phase2-hide-phase1-messages");
          // Use multiple requestAnimationFrame to ensure DOM is ready
          setTimeout(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setShowPhase1Messages(true);
                console.log(
                  "📜 Showing Phase 1 messages now that Phase 2 section is ready - user can scroll up to see them"
                );
              });
            });
          }, 200); // Small delay to ensure Phase 2 section renders first
        }

        // Step 3: Start polling if not all ready
        if (!sectionPayload?.allReady) {
          console.log(
            "⏳ Step 3: Starting status polling (GET /ava-sessions/:id/section/1/status)"
          );
          startPollingStatus(actualSessionId, 1);
        } else {
          console.log("✅ Step 3: All questions ready, no polling needed");
          setIsGenerating(false);
        }

        console.groupEnd();
        console.log("🎉 Phase 2: Initialization complete!");
      } catch (error: any) {
        if (cancelled) {
          console.groupEnd();
          return;
        }

        console.groupEnd();
        console.group("❌ Phase 2: Initialization Failed");
        console.error("Error:", error);
        console.error("Error message:", error?.message);
        console.error("Error response:", error?.response);
        console.error("Error stack:", error?.stack);
        console.groupEnd();

        setIsGenerating(false);
        setInitError(error?.message || "Failed to start Phase 2");

        toast({
          title: "Phase 2 Start Failed",
          description: error?.message || "Check console for details",
          variant: "destructive",
        });
      }
    };

    // Small delay to ensure restore useEffect completes first (restore runs immediately, this waits)
    console.log(
      "⏱️ Scheduling initPhase2 to run in 1000ms to allow restore to complete..."
    );
    const timeoutId = setTimeout(() => {
      console.log("⏰ Timeout fired, calling initPhase2...");
      initPhase2();
    }, 1000); // Increased delay to let restore useEffect complete

    return () => {
      console.log("🧹 Phase 2 initialization cleanup");
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [backendSessionId, userName, phase1Answers, currentWorkspace?.id]); // Include phase1Answers to validate on initialization

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Removed auto-scroll behavior - user can manually scroll to view content.

  const handleGenerateSection = async (
    sectionNumber: number
  ): Promise<void> => {
    const currentSessionId = actualSessionIdRef.current || backendSessionId;
    if (!currentSessionId) {
      console.error("❌ Cannot generate section: No backend session ID");
      toast({
        title: "Error",
        description: "Backend session ID is missing. Please refresh the page.",
        variant: "destructive",
      });
      return Promise.reject(new Error("No backend session ID"));
    }

    // Check if section already exists - if so, preserve currentQuestionIndex
    const existingSection = sections.find(
      (s) => s.sectionNumber === sectionNumber
    );
    const isExistingSection = !!existingSection;
    const previousSection = currentSection; // Store previous section before we change it
    const shouldPreserveIndex =
      isExistingSection && sectionNumber === previousSection;

    // If navigating to existing section, calculate preserved index based on approved questions
    let preservedIndex = 0;
    if (isExistingSection && existingSection.questions.length > 0) {
      // If we're on the same section and have a saved index, prefer that
      if (shouldPreserveIndex && currentQuestionIndex >= 0) {
        preservedIndex = currentQuestionIndex;
      } else {
        // Find the index of the first unapproved question
        const firstUnapprovedIndex = existingSection.questions.findIndex(
          (q) => !q.isApproved
        );
        if (firstUnapprovedIndex >= 0) {
          preservedIndex = firstUnapprovedIndex; // Show up to first unapproved question
        } else {
          // All approved, show all questions
          preservedIndex = existingSection.questions.length - 1;
        }
      }
    }

    console.group(`📋 Generating Section ${sectionNumber}`);
    console.log(
      `📡 POST /ava-sessions/${currentSessionId}/generate-section/${sectionNumber}`
    );
    console.log(
      `🔄 isGenerating=true, isTransitioningSection=${isTransitioningSection}, isExistingSection=${isExistingSection}, preservedIndex=${preservedIndex}`
    );

    setIsGenerating(true);
    setCurrentSection(sectionNumber);
    // Only reset to 0 if this is a brand new section, otherwise preserve position
    const newQuestionIndex = isExistingSection ? preservedIndex : 0;
    setCurrentQuestionIndex(newQuestionIndex);

    // Save progress immediately when navigating to a section
    try {
      await savePhase2Progress(
        currentSessionId,
        sectionNumber,
        newQuestionIndex
      );
      console.log(
        `💾 Progress saved when navigating to Section ${sectionNumber}`
      );
    } catch (error) {
      console.warn("Failed to save progress when navigating:", error);
      // Continue anyway - progress will be saved by the useEffect hook
    }

    try {
      const response = await generateSection(currentSessionId, sectionNumber);
      console.log(`✅ Section ${sectionNumber} response:`, response);
      setCurrentSection(sectionNumber);

      const sectionPayload = response?.data ?? response;

      const questions: QuestionResponse[] = (
        sectionPayload?.questions || []
      ).map((q: any) => ({
        id: q.id,
        questionId: q.questionId,
        questionText: q.questionText,
        aiGeneratedAnswer: q.aiGeneratedAnswer,
        userEditedAnswer: q.userEditedAnswer,
        status:
          q.status ||
          (q.aiGeneratedAnswer ? ("ready" as const) : ("generating" as const)),
        isApproved: q.isApproved || false, // Always use backend's isApproved value
      }));

      const newSection: Section = {
        sectionNumber: sectionPayload?.sectionNumber || sectionNumber,
        sectionTitle:
          sectionPayload?.sectionTitle || `Section ${sectionNumber}`,
        sectionIntro: sectionPayload?.sectionIntro || "",
        questions,
        isComplete: false,
      };

      // Check if we have at least one ready question
      const hasReadyQuestion = questions.some(
        (q) => q.status === "ready" || q.aiGeneratedAnswer
      );

      setSections((prev) => {
        const existing = prev.find((s) => s.sectionNumber === sectionNumber);
        let updatedSection: Section;

        if (existing && existing.isComplete) {
          // Only preserve state if section was previously completed (for review purposes)
          console.log(
            `🔄 Section ${sectionNumber} already completed, preserving approval state for review`
          );
          updatedSection = {
            ...newSection,
            isComplete: true, // Keep it marked as complete
            questions: newSection.questions.map((newQ) => {
              const existingQ = existing.questions.find(
                (q) =>
                  (q.id && q.id === newQ.id) || q.questionId === newQ.questionId
              );
              return {
                ...newQ,
                // Only preserve if it was previously approved
                isApproved: existingQ?.isApproved || false,
                userEditedAnswer:
                  existingQ?.userEditedAnswer || newQ.userEditedAnswer,
              };
            }),
          };
        } else if (existing) {
          // Section exists but not complete - merge with existing to preserve approval states
          console.log(
            `🔄 Section ${sectionNumber} exists but not complete, merging with existing data`
          );
          updatedSection = {
            ...newSection,
            questions: newSection.questions.map((newQ) => {
              const existingQ = existing.questions.find(
                (q) =>
                  (q.id && q.id === newQ.id) || q.questionId === newQ.questionId
              );
              // Preserve approval state and user edits from existing
              return {
                ...newQ,
                isApproved: existingQ?.isApproved || false,
                userEditedAnswer:
                  existingQ?.userEditedAnswer || newQ.userEditedAnswer,
              };
            }),
          };
        } else {
          // Brand new section
          console.log(`✨ Adding new section ${sectionNumber}`);
          updatedSection = newSection;
        }

        // If this is an existing section, ensure currentQuestionIndex is correct
        // Only recalculate if we're navigating from a different section (not preserving index)
        if (
          isExistingSection &&
          updatedSection.questions.length > 0 &&
          sectionNumber !== previousSection
        ) {
          // Navigating to a different existing section - show first unapproved question
          const firstUnapprovedIndex = updatedSection.questions.findIndex(
            (q) => !q.isApproved
          );
          if (firstUnapprovedIndex >= 0) {
            // Show up to and including the first unapproved question
            setCurrentQuestionIndex(firstUnapprovedIndex);
            console.log(
              `📍 Navigating to section ${sectionNumber} from ${previousSection}, showing first unapproved question at index ${firstUnapprovedIndex}`
            );
          } else {
            // All approved, show all questions
            setCurrentQuestionIndex(updatedSection.questions.length - 1);
            console.log(
              `📍 All questions approved in section ${sectionNumber}, showing all (index ${
                updatedSection.questions.length - 1
              })`
            );
          }
        } else if (isExistingSection && sectionNumber === previousSection) {
          // Same section - index was already preserved before API call, keep it
          console.log(
            `📍 Staying on section ${sectionNumber}, preserving currentQuestionIndex ${preservedIndex}`
          );
        }

        if (existing && existing.isComplete) {
          return prev.map((s) =>
            s.sectionNumber === sectionNumber ? updatedSection : s
          );
        } else if (existing) {
          return prev.map((s) =>
            s.sectionNumber === sectionNumber ? updatedSection : s
          );
        }
        return [...prev, updatedSection].sort(
          (a, b) => a.sectionNumber - b.sectionNumber
        );
      });

      // If we have at least one ready question, clear transition state
      // Use functional update to avoid stale closure issues
      if (hasReadyQuestion) {
        console.log(
          `✅ Section ${sectionNumber} has ready questions, clearing transition state if needed`
        );
        setIsTransitioningSection((prev) => {
          if (prev) {
            console.log(
              `✅ Clearing transition state for Section ${sectionNumber}`
            );
            return false;
          }
          return prev;
        });
      }

      if (!sectionPayload?.allReady) {
        console.log(`⏳ Starting polling for Section ${sectionNumber}...`);
        startPollingStatus(currentSessionId, sectionNumber);
      } else {
        console.log(`✅ All questions ready for Section ${sectionNumber}`);
        setIsGenerating(false);
        // Clear transition state if all ready (use functional update)
        setIsTransitioningSection((prev) => {
          if (prev) {
            console.log(`✅ All questions ready, clearing transition state`);
            return false;
          }
          return prev;
        });
      }

      console.groupEnd();
      return Promise.resolve();
    } catch (error: any) {
      console.groupEnd();
      console.group(`❌ Section ${sectionNumber} Generation Failed`);
      console.error("Error:", error);
      console.error("Details:", {
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
      });
      console.groupEnd();

      setIsGenerating(false);
      toast({
        title: `Section ${sectionNumber} Failed`,
        description: error?.message || "Check console for details",
        variant: "destructive",
      });
      return Promise.reject(error);
    }
  };

  const startPollingStatus = (sessionId: string, sectionNumber: number) => {
    // Clear existing poll for this section
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    const pollCount = pollCountRef.current.get(sectionNumber) || 0;
    pollCountRef.current.set(sectionNumber, pollCount + 1);

    console.log(
      `🔄 Polling Section ${sectionNumber} status (attempt ${pollCount + 1})...`
    );

    pollIntervalRef.current = setInterval(async () => {
      const currentSessionId =
        sessionId || actualSessionIdRef.current || backendSessionId;
      if (!currentSessionId) {
        console.error("❌ Polling stopped: No backend session ID");
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }

      try {
        console.log(
          `📡 GET /ava-sessions/${currentSessionId}/section/${sectionNumber}/status`
        );
        const statusResponse = await getSectionStatus(
          currentSessionId,
          sectionNumber
        );
        const status = statusResponse?.data ?? statusResponse;
        console.log(`✅ Section ${sectionNumber} status:`, status);

        // Update questions with latest status
        // CRITICAL: Always trust backend's isApproved value - it's the source of truth
        // Only the backend can set isApproved to true (when user clicks confirm)
        const newQuestions: QuestionResponse[] = (status?.questions || []).map(
          (q: any) => ({
            id: q.id,
            questionId: q.questionId,
            questionText: q.questionText,
            aiGeneratedAnswer: q.aiGeneratedAnswer,
            userEditedAnswer: q.userEditedAnswer,
            status:
              q.status ||
              (q.aiGeneratedAnswer
                ? ("ready" as const)
                : ("generating" as const)),
            isApproved: q.isApproved || false, // Always use backend's isApproved value
          })
        );

        // Merge new data with existing questions, preserving userEditedAnswer if user made edits
        setSections((prev) => {
          const sectionData = prev.find(
            (s) => s.sectionNumber === sectionNumber
          );
          if (!sectionData) return prev;

          // Check if section is already complete - if so, stop polling
          const allQuestionsApproved = sectionData.questions.every(
            (q) => q.isApproved
          );
          if (allQuestionsApproved && sectionData.questions.length > 0) {
            console.log(
              `✅ Section ${sectionNumber} already complete - stopping polling`
            );
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            return prev; // Don't update if section is complete
          }

          // Merge new data - ALWAYS preserve approved states from local state
          // Once a question is approved locally, it should NEVER be reset to unapproved
          // This prevents race conditions where polling overwrites recently confirmed questions
          const mergedQuestions = newQuestions.map((newQ) => {
            const existingQ = sectionData.questions.find(
              (q) =>
                (q.id && q.id === newQ.id) || q.questionId === newQ.questionId
            );

            // CRITICAL: If question was already approved locally, ALWAYS preserve that state
            // Only use backend's isApproved if:
            // 1. Question wasn't previously approved locally, OR
            // 2. Backend explicitly says it's approved (trust backend when it says true)
            const isApproved = existingQ?.isApproved
              ? true // Once approved locally, always keep it approved
              : newQ.isApproved || false; // Otherwise, trust backend

            return {
              ...newQ,
              isApproved,
              // Preserve userEditedAnswer if it exists (user edits are local until saved)
              userEditedAnswer:
                existingQ?.userEditedAnswer || newQ.userEditedAnswer,
            };
          });

          // Check if we now have at least one ready question (for transition state)
          const hasReadyQuestion = mergedQuestions.some(
            (q) => q.status === "ready" || q.aiGeneratedAnswer
          );
          const previousHasReadyQuestion = sectionData.questions.some(
            (q) => q.status === "ready" || q.aiGeneratedAnswer
          );

          // If this is the first ready question and we're transitioning, clear transition state
          if (
            hasReadyQuestion &&
            !previousHasReadyQuestion &&
            sectionNumber === currentSection
          ) {
            console.log(
              `✅ First ready question detected for Section ${sectionNumber}, clearing transition state`
            );
            setIsTransitioningSection(false);
          }

          const previousQuestionsCount = sectionData.questions.length;
          const newQuestionsCount = mergedQuestions.length;
          const hasNewQuestions = newQuestionsCount > previousQuestionsCount;

          console.log(`📊 Polling update for Section ${sectionNumber}:`, {
            previousCount: previousQuestionsCount,
            newCount: newQuestionsCount,
            hasNewQuestions,
            currentQuestionIndex,
            currentSectionNumber: currentSection,
            allReady: status?.allReady,
            hasReadyQuestion,
            previousHasReadyQuestion,
            questionStatuses: mergedQuestions.map((q) => ({
              id: q.questionId,
              status: q.status,
              isApproved: q.isApproved,
            })),
          });

          // Removed auto-reveal logic - questions should only advance when user confirms them

          return prev.map((s) =>
            s.sectionNumber === sectionNumber
              ? { ...s, questions: mergedQuestions }
              : s
          );
        });

        if (status?.allReady) {
          const totalQuestions = status?.questions?.length || 0;
          console.log(
            `✅ Section ${sectionNumber}: All ${totalQuestions} questions ready!`
          );
          console.log(
            `📋 Complete question list:`,
            status?.questions?.map((q: any, idx: number) => ({
              index: idx,
              questionId: q.questionId,
              hasAnswer: !!(q.aiGeneratedAnswer || q.userEditedAnswer),
              status: q.status,
            }))
          );
          setIsGenerating(false);
          // Clear transition state when all questions are ready
          if (sectionNumber === currentSection) {
            setIsTransitioningSection(false);
          }
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (error: any) {
        console.error(
          `❌ Failed to poll Section ${sectionNumber} status:`,
          error
        );
        console.error("Poll error details:", {
          message: error?.message,
          response: error?.response,
        });
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleConfirmQuestion = async (
    question: QuestionResponse,
    section: Section
  ) => {
    const currentSessionId = actualSessionIdRef.current || backendSessionId;
    if (!currentSessionId || !question.id) return;
    console.log(
      `✅ Confirming question ${question.questionId} (responseId=${question.id}) in section ${section.sectionNumber}`
    );

    // Once the user confirms a question, rely on live state instead of restored indices
    restoredQuestionIndexRef.current = null;
    hasRestoredState.current = false;

    const currentQuestionIdx = section.questions.findIndex(
      (q) => q.id === question.id
    );
    const isLastQuestion = currentQuestionIdx === section.questions.length - 1;

    console.log(`🔍 Question position:`, {
      currentIndex: currentQuestionIdx,
      totalQuestions: section.questions.length,
      isLastQuestion,
      questionId: question.questionId,
    });

    let apiResult = null;
    try {
      console.log(
        `📞 API Call 1: Confirming individual question via confirm-phase2-question...`
      );
      apiResult = await confirmSectionResponse(
        currentSessionId,
        section.sectionNumber,
        question.id
      );
      console.log("✅ Question confirmed successfully:", apiResult);
    } catch (err: any) {
      console.error("❌ Failed to confirm question:", err?.message);
      setIsGenerating(false);
      setIsTransitioningSection(false);
      toast({
        title: "Error",
        description:
          err?.message || "Failed to confirm question. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (isLastQuestion) {
      try {
        console.log(
          `📞 API Call 2: This is the LAST question - confirming entire section`
        );
        const sectionConfirmResult = await confirmSection(
          currentSessionId,
          section.sectionNumber
        );
        console.log("✅ Section confirmed successfully:", sectionConfirmResult);

        if (sectionConfirmResult) {
          apiResult = {
            ...apiResult,
            ...sectionConfirmResult,
            sectionConfirmed: true,
          };
        }
      } catch (err: any) {
        console.warn(
          "⚠️ Failed to confirm section (non-critical):",
          err?.message
        );
      }
    }

    const confirmedQuestionId = question.id;
    const confirmedQuestionStringId = question.questionId;
    const confirmedSectionNumber = section.sectionNumber;

    console.log("🔒 Before confirm - question state:", {
      id: confirmedQuestionId,
      questionId: confirmedQuestionStringId,
      isApproved: question.isApproved,
    });

    const willCompleteSection =
      isLastQuestion &&
      section.questions
        .filter((q) => q.id !== confirmedQuestionId)
        .every((q) => q.isApproved);

    console.log("🔍 Pre-confirmation check:", {
      isLastQuestion,
      totalQuestions: section.questions.length,
      alreadyApprovedCount: section.questions.filter((q) => q.isApproved)
        .length,
      willCompleteSection,
    });

    setSections((prev) => {
      const currentSection = prev.find(
        (s) => s.sectionNumber === confirmedSectionNumber
      );
      if (!currentSection) return prev;

      const updatedSection = {
        ...currentSection,
        questions: currentSection.questions.map((q) => {
          const isMatch =
            q.id === confirmedQuestionId ||
            q.questionId === confirmedQuestionStringId;
          if (isMatch) {
            console.log("🔒 Marking question as approved:", {
              id: q.id,
              questionId: q.questionId,
              wasApproved: q.isApproved,
            });
            return {
              ...q,
              isApproved: true,
            };
          }

          if (q.isApproved) {
            console.log(
              "🔒 Preserving approved state for question:",
              q.questionId
            );
          }
          return q;
        }),
      };

      const currentQIndex = updatedSection.questions.findIndex(
        (q) =>
          q.id === confirmedQuestionId ||
          q.questionId === confirmedQuestionStringId
      );

      console.log(`🔍 Question index check:`, {
        currentQIndex,
        totalQuestions: updatedSection.questions.length,
        confirmedQuestionId,
        allQuestionIds: updatedSection.questions.map((q) => ({
          id: q.id,
          questionId: q.questionId,
          status: q.status,
          isApproved: q.isApproved,
        })),
        isGenerating,
        hasGeneratingQuestions: updatedSection.questions.some(
          (q) => q.status === "generating"
        ),
      });

      const updatedSections = prev.map((s) =>
        s.sectionNumber === confirmedSectionNumber ? updatedSection : s
      );

      if (currentQIndex < updatedSection.questions.length - 1) {
        console.log(
          `➡️ Moving to next question (index ${currentQIndex + 1} of ${
            updatedSection.questions.length
          } loaded questions)`
        );
        setCurrentQuestionIndex(currentQIndex + 1);
        return updatedSections;
      } else {
        console.log(`🔍 At last loaded question in section`);
        return updatedSections;
      }
    });

    if (willCompleteSection) {
      console.log(
        `✅ Section ${confirmedSectionNumber} will be complete after this confirmation`
      );

      setTimeout(() => {
        console.log(
          `🔄 Triggering section transition from ${confirmedSectionNumber} to next section`
        );

        setIsTransitioningSection(true);

        setSectionsList((prevList) =>
          prevList.map((s) =>
            s.sectionNumber === confirmedSectionNumber
              ? { ...s, isApproved: true }
              : s
          )
        );

        setSections((prev) =>
          prev.map((s) =>
            s.sectionNumber === confirmedSectionNumber
              ? { ...s, isComplete: true }
              : s
          )
        );

        setCurrentQuestionIndex(0);

        const nextSectionNumber =
          apiResult?.nextSection || confirmedSectionNumber + 1;

        if (nextSectionNumber <= 21) {
          console.log(`🚀 Starting generation of Section ${nextSectionNumber}`);
          handleGenerateSection(nextSectionNumber).catch((error) => {
            console.error(
              `❌ Failed to generate Section ${nextSectionNumber}:`,
              error
            );
            setIsTransitioningSection(false);
          });
        } else {
          console.log("🎉 All 21 sections complete!");
          setIsTransitioningSection(false);
          setSections((currentSections) => {
            onComplete(currentSections);
            return currentSections;
          });
        }
      }, 100);
    }

    if (apiResult?.sectionCompleted) {
      console.log(
        `✅ Section ${section.sectionNumber} questions all approved (from API).`
      );
    }
  };

  const handleRegenerateQuestion = async (
    question: QuestionResponse,
    section: Section
  ) => {
    const currentSessionId = actualSessionIdRef.current || backendSessionId;
    if (!currentSessionId || !question.id) return;

    console.log(`\n🔄 ========== REGENERATING QUESTION ==========`);
    console.log(`Question ID: ${question.questionId}`);
    console.log(`Response ID: ${question.id}`);
    console.log(`Section: ${section.sectionNumber}`);
    console.log(`Question Text: ${question.questionText}`);
    console.log(`===========================================\n`);

    setRegeneratingQuestionId(question.id || null);

    try {
      const result = await regeneratePhase2Question(
        currentSessionId,
        question.id
      );
      console.log("✅ Question regeneration API response:", result);

      const regeneratedAnswer =
        result?.data?.aiGeneratedAnswer || result?.aiGeneratedAnswer;
      console.log(
        "✅ New regenerated answer:",
        regeneratedAnswer ? `${regeneratedAnswer.substring(0, 100)}...` : "NONE"
      );

      if (regeneratedAnswer) {
        console.log(
          "✅ Updating question with new answer for question ID:",
          question.id
        );
        console.log("✅ Regenerated answer length:", regeneratedAnswer.length);

        setSections((prev) => {
          const updatedSections = prev.map((s) => {
            if (s.sectionNumber === section.sectionNumber) {
              const updatedQuestions = s.questions.map((q) => {
                if (q.id === question.id) {
                  // Create a new question object without userEditedAnswer
                  const { userEditedAnswer, ...questionWithoutEdit } = q;
                  const updatedQuestion = {
                    ...questionWithoutEdit,
                    aiGeneratedAnswer: regeneratedAnswer,
                    isApproved: false,
                    status: "ready" as const,
                  };
                  console.log("✅ Updated question object:", {
                    id: updatedQuestion.id,
                    questionId: updatedQuestion.questionId,
                    hasAiAnswer: !!updatedQuestion.aiGeneratedAnswer,
                    status: updatedQuestion.status,
                  });
                  return updatedQuestion;
                }
                return q;
              });

              return {
                ...s,
                questions: updatedQuestions,
              };
            }
            return s;
          });

          // Log the updated state to verify
          const updatedSection = updatedSections.find(
            (s) => s.sectionNumber === section.sectionNumber
          );
          const updatedQuestion = updatedSection?.questions.find(
            (q) => q.id === question.id
          );
          console.log(
            "✅ State after update - Question has answer:",
            !!updatedQuestion?.aiGeneratedAnswer
          );
          console.log(
            "✅ State after update - Answer preview:",
            updatedQuestion?.aiGeneratedAnswer?.substring(0, 100)
          );

          return updatedSections;
        });

        toast({
          title: "Question Regenerated",
          description: "AI has generated a new answer for this question",
        });
      } else {
        throw new Error("No regenerated answer received from API");
      }
    } catch (err: any) {
      console.error("❌ Failed to regenerate question:", err);
      toast({
        title: "Regeneration Failed",
        description: err?.message || "Could not regenerate this answer",
        variant: "destructive",
      });
    } finally {
      setRegeneratingQuestionId(null);
    }
  };

  const handleEdit = (questionId: string, currentContent: string) => {
    setEditingQuestionId(questionId);
    setEditedContent(currentContent);
  };

  const handleSaveEdit = async (
    sectionNumber: number,
    responseId: string,
    questionId: string
  ) => {
    const currentSessionId = actualSessionIdRef.current || backendSessionId;
    if (!currentSessionId || !editingQuestionId || !responseId) {
      console.error("❌ Cannot save edit: Missing required data", {
        currentSessionId,
        editingQuestionId,
        responseId,
      });
      toast({
        title: "Error",
        description: "Backend session ID is missing. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    console.log(
      `💾 Saving edit for Section ${sectionNumber}, Question ${questionId}`
    );

    setIsSavingEdit(true);
    try {
      await updateSectionResponse(
        currentSessionId,
        sectionNumber,
        responseId,
        editedContent
      );
      console.log(`✅ Edit saved successfully`);

      setSections((prev) =>
        prev.map((section) =>
          section.sectionNumber === sectionNumber
            ? {
                ...section,
                questions: section.questions.map((q) =>
                  q.questionId === questionId
                    ? { ...q, userEditedAnswer: editedContent }
                    : q
                ),
              }
            : section
        )
      );

      setEditingQuestionId(null);
      setEditedContent("");

      toast({
        title: "Saved",
        description: "Your edit has been saved successfully",
      });
    } catch (error: any) {
      console.error(`❌ Failed to save edit:`, error);
      toast({
        title: "Save Failed",
        description: error?.message || "Check console for details",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingQuestionId(null);
    setEditedContent("");
  };

  console.log("🎨 Phase 2 component rendering with state:", {
    sectionsCount: sections.length,
    currentSection,
    isGenerating,
    isStarted,
    initError,
    editingQuestionId,
  });

  return (
    <>
      {/* Phase 2 Content - No header, rendered below Phase 1 */}
      <div
        ref={messagesContainerRef}
        className="px-[20%] pb-32 pt-2"
        style={{ scrollBehavior: "smooth" }}
      >
        <div className="w-full space-y-6" style={{ minHeight: "100%" }}>
          {/* Phase 1 Messages - Display ALL Phase 1 content (intro, name, video, questions, answers) */}
          {/* CRITICAL: Don't render Phase 1 messages at all when transitioning from Phase 1 */}
          {/* Only render if showPhase1Messages is true AND not transitioning from Phase 1 */}
          {/* This prevents any flash of Phase 1 questions or images */}
          {showPhase1History &&
            phase1IntroMessages.length > 0 &&
            showPhase1Messages &&
            sessionStorage.getItem("ava-phase2-hide-phase1-messages") !==
              "true" && (
              <div className="space-y-4 mb-6 pt-6">
                {phase1IntroMessages
                  .filter((msg, index, self) => {
                    // Deduplicate by both ID and content to prevent duplicates
                    const firstIndex = self.findIndex(
                      (m) =>
                        m.id === msg.id ||
                        (m.content === msg.content && m.role === msg.role)
                    );
                    // Keep all messages including questions, but we'll hide question numbers
                    // Question content is needed, just remove question number display
                    return index === firstIndex;
                  })
                  .map((msg, index) => (
                    <div key={`${msg.id}-${index}`}>
                      {msg.role === "ava" ? (
                        <div className="flex gap-3 items-start">
                          {/* AVA Avatar - Removed */}
                          <div className="w-[70%]">
                            <div
                              className=""
                              style={
                                index === 0 ? { marginTop: "58px" } : undefined
                              }
                            >
                              {/* CRITICAL: Don't show question metadata in Phase 2 */}
                              {/* Section names are already shown in Phase 2 sections, so Phase 1 question numbers are not needed */}
                              <div
                                className={`text-[15px] leading-relaxed text-slate-200 ${(() => {
                                  // Check if content contains HTML tags
                                  const htmlTagRegex = /<[^>]+>/;
                                  const isHTML =
                                    typeof msg.content === "string" &&
                                    htmlTagRegex.test(msg.content);
                                  return isHTML ? "" : "whitespace-pre-wrap";
                                })()}`}
                              >
                                {(() => {
                                  // Check if content contains HTML tags
                                  const htmlTagRegex = /<[^>]+>/;
                                  const isHTML =
                                    typeof msg.content === "string" &&
                                    htmlTagRegex.test(msg.content);
                                  if (isHTML) {
                                    return (
                                      <div
                                        className="ava-message-content"
                                        dangerouslySetInnerHTML={{
                                          __html: msg.content,
                                        }}
                                      />
                                    );
                                  }
                                  return msg.content;
                                })()}
                              </div>
                              {msg.videoUrl && (
                                <div className="mt-4">
                                  <div
                                    className="relative w-full bg-black rounded-lg overflow-hidden"
                                    style={{ paddingTop: "56.25%" }}
                                  >
                                    <iframe
                                      src={(() => {
                                        const match = msg.videoUrl.match(
                                          /vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/
                                        );
                                        if (!match) return "";
                                        const videoId = match[1];
                                        const privacyHash = match[2];
                                        let embedUrl = `https://player.vimeo.com/video/${videoId}`;
                                        const params = new URLSearchParams({
                                          title: "0",
                                          byline: "0",
                                          portrait: "0",
                                          autoplay: "0",
                                        });
                                        if (privacyHash)
                                          params.set("h", privacyHash);
                                        embedUrl += "?" + params.toString();
                                        return embedUrl;
                                      })()}
                                      className="absolute top-0 left-0 w-full h-full"
                                      frameBorder="0"
                                      allow="autoplay; fullscreen; picture-in-picture"
                                      allowFullScreen
                                      title="AVA Video"
                                    />
                                  </div>
                                </div>
                              )}
                              {/* Show examples if present - but hide them when Phase 2 has started */}
                              {msg.examples &&
                                msg.examples.length > 0 &&
                                !isStarted && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="text-xs font-medium text-vox-pink mb-2">
                                      Examples:
                                    </div>
                                    <div className="space-y-2">
                                      {msg.examples.map((example, idx) => (
                                        <div
                                          key={idx}
                                          className="text-sm text-slate-300 bg-slate-800/50 border border-slate-700/50 px-3 py-2 rounded-lg"
                                        >
                                          {example}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 items-start justify-end">
                          <div className="w-[70%] flex justify-end gap-3 items-end">
                            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl rounded-tr-sm px-4 py-3">
                              <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-slate-200">
                                {msg.content}
                              </p>
                            </div>
                            {/* User Initials Avatar - Removed */}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

          {/* Phase 1 History - Fallback display if messages from localStorage aren't available */}
          {/* CRITICAL: Don't render Phase 1 history when transitioning from Phase 1 */}
          {showPhase1History &&
            phase1History.length > 0 &&
            phase1IntroMessages.length === 0 &&
            sessionStorage.getItem("ava-phase2-hide-phase1-messages") !==
              "true" && (
              <div className="space-y-6 mb-8">
                {phase1History.map((item, idx) => {
                  const sectionTitle =
                    item.sectionTitle ||
                    (item.sectionId ? sectionTitleMap[item.sectionId] : null);
                  return (
                    <div key={item.questionId || idx} className="space-y-4">
                      {/* Question - AVA Message (Left Side) - Avatar removed */}
                      <div className="flex gap-3 items-start">
                        <div className="w-[70%]">
                          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                            {/* CRITICAL: Don't show question numbers in Phase 2 */}
                            {/* Section names are already shown in Phase 2 sections */}
                            {sectionTitle && (
                              <div className="mb-2">
                                <div className="text-xs font-medium text-vox-pink">
                                  {sectionTitle}
                                </div>
                              </div>
                            )}
                            <p className="text-[15px] leading-relaxed text-slate-200 whitespace-pre-wrap">
                              {item.questionText}
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Answer - User Message (Right Side) */}
                      <div className="flex gap-3 items-start justify-end">
                        <div className="w-[70%] flex justify-end gap-3 items-end">
                          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl rounded-tr-sm px-4 py-3">
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-slate-200">
                              {item.answer}
                            </p>
                          </div>
                          {/* User Initials Avatar - Removed */}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {/* Phase 2 Divider - Show when Phase 1 content is displayed or when Phase 2 starts */}
          {/* Always show divider, but use ref for scroll positioning */}
          <div
            ref={phase2StartRef}
            className={`flex justify-center pt-4 mb-6 ${
              (phase1IntroMessages.length > 0 || phase1History.length > 0) &&
              !isStarted
                ? ""
                : "pt-6"
            }`}
          >
            <div className="px-6 py-3 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20 rounded-xl shadow-sm">
              <p className="text-sm font-semibold text-vox-pink">
                Phase 2: Profile Generation
              </p>
            </div>
          </div>

          {!isStarted && !initError && (
            <div className="flex flex-col items-center gap-4">
              <div className="px-6 py-3 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20 rounded-xl shadow-sm">
                <p className="text-sm text-center font-medium">
                  Initializing Phase 2...
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Starting backend session...</span>
              </div>
            </div>
          )}

          {initError && !isStarted && (
            <div className="flex flex-col items-center gap-4">
              <div className="px-6 py-3 bg-destructive/10 border border-destructive/20 rounded-xl shadow-sm max-w-2xl">
                <p className="text-sm text-center font-medium text-destructive">
                  Failed to initialize Phase 2
                </p>
                <p className="text-xs text-center text-slate-400 mt-2">
                  {initError}
                </p>
                <p className="text-xs text-center text-slate-400 mt-2">
                  Check browser console for detailed error logs. The backend may
                  be experiencing issues, but you can try generating sections
                  manually.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    hasInitialized.current = false;
                    setInitError(null);
                    setIsStarted(false);
                    // Trigger useEffect to retry initialization
                    window.location.reload();
                  }}
                  className="text-xs"
                >
                  Retry Phase 2
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    console.log(
                      "🔄 Attempting to generate Section 1 manually..."
                    );
                    setInitError(null);
                    setIsStarted(true);
                    setIsGenerating(true);
                    try {
                      await handleGenerateSection(1);
                      console.log("✅ Section 1 generated manually");
                    } catch (error: any) {
                      console.error("❌ Manual generation also failed:", error);
                      setInitError(
                        `Section generation still failing: ${error.message}. Please check backend logs.`
                      );
                      setIsGenerating(false);
                    }
                  }}
                  className="text-xs bg-gradient-to-r from-cyan-400 to-blue-500"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Start Section 1 Manually"
                  )}
                </Button>
              </div>
            </div>
          )}

          {(() => {
            if (sections.length > 0) {
              console.log(
                `🎨 RENDERING ${sections.length} SECTIONS IN UI`,
                sections
              );
            }
            return null;
          })()}

          {/* Show loader when transitioning to a section that doesn't exist yet */}
          {isTransitioningSection &&
            currentSection &&
            !sections.find((s) => s.sectionNumber === currentSection) && (
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <div className="flex gap-3 items-start animate-fade-in">
                  <div className="w-[70%]">
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                      <AVATypingIndicator />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading Section {currentSection}...</span>
                </div>
              </div>
            )}

          {sections.map((section) => {
            // Show all sections (not just current) - like ChatGPT history
            const isCurrentSection = section.sectionNumber === currentSection;
            const isFirstSection = section.sectionNumber === 1;

            console.log(
              `🎨 Rendering section ${section.sectionNumber} with ${section.questions.length} questions`
            );

            // Get section metadata from sectionsList for title and intro
            const sectionMeta = sectionsList.find(
              (s) => s.sectionNumber === section.sectionNumber
            );
            const sectionTitle = sectionMeta?.title || section.sectionTitle;
            const sectionIntro = sectionMeta?.intro || section.sectionIntro;

            // Show all questions in completed sections, or up to currentQuestionIndex for current section
            // Use restored index if available to ensure correct questions are shown after refresh
            const effectiveIndex =
              restoredQuestionIndexRef.current !== null && isCurrentSection
                ? restoredQuestionIndexRef.current
                : currentQuestionIndex;

            const questionsToShow = section.isComplete
              ? section.questions
              : isCurrentSection
              ? section.questions.slice(0, effectiveIndex + 1)
              : section.questions;

            return (
              <div
                key={section.sectionNumber}
                className="space-y-4 animate-fade-in"
                ref={isFirstSection ? firstPhase2SectionRef : null}
              >
                {/* Section Header */}
                <div className="flex justify-center">
                  <div className="px-6 py-3 bg-gradient-to-r from-vox-pink/10 via-vox-purple/10 to-vox-orange/10 border border-vox-pink/20 rounded-xl shadow-sm max-w-2xl">
                    <p className="text-sm text-center font-medium">
                      <strong className="font-semibold">
                        Section {section.sectionNumber}: {sectionTitle}
                      </strong>
                      {sectionIntro && (
                        <span className="block mt-2 text-xs text-muted-foreground font-normal">
                          {sectionIntro}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Section Loading - Show "AVA is typing..." when initially loading any section (before first question appears) */}
                {(() => {
                  // Show loader if:
                  // 1. This is the current section
                  // 2. No ready questions to show yet (either no questions or all are still generating)
                  // 3. We're generating OR transitioning (always show loader during transitions)
                  const hasQuestions = section.questions.length > 0;
                  const hasReadyQuestions = questionsToShow.some(
                    (q) => q.status === "ready" || q.aiGeneratedAnswer
                  );
                  const isCurrentSection =
                    currentSection === section.sectionNumber;

                  // Show loader if:
                  // - We're transitioning to this section (isTransitioningSection is true)
                  // - We're generating and no ready questions yet
                  // - This is the current section and no ready questions
                  const shouldShowLoader =
                    isCurrentSection &&
                    !hasReadyQuestions &&
                    (isTransitioningSection || isGenerating || !hasQuestions);

                  if (shouldShowLoader) {
                    console.log(
                      `📍 Showing loader for Section ${section.sectionNumber}:`,
                      {
                        isGenerating,
                        isTransitioningSection,
                        questionsCount: section.questions.length,
                        questionsToShowCount: questionsToShow.length,
                        hasQuestions,
                        hasReadyQuestions,
                      }
                    );
                  } else if (hasReadyQuestions && isCurrentSection) {
                    // Debug log when loader should hide (first question appeared)
                    console.log(
                      `✅ Loader hidden for Section ${section.sectionNumber}: first question appeared`,
                      {
                        questionsToShowCount: questionsToShow.length,
                        firstQuestionId: questionsToShow[0]?.questionId,
                      }
                    );
                  }

                  return (
                    shouldShowLoader && (
                      <div className="flex gap-3 items-start animate-fade-in">
                        <div className="w-[70%]">
                          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                            <AVATypingIndicator />
                          </div>
                        </div>
                      </div>
                    )
                  );
                })()}

                {/* Questions - Only show current question */}
                {questionsToShow.map((question, qIndex) => {
                  const isEditing = editingQuestionId === question.questionId;
                  const displayAnswer =
                    question.userEditedAnswer ||
                    question.aiGeneratedAnswer ||
                    "";
                  const questionAnchorId = `section-${section.sectionNumber}-question-${qIndex}`;

                  // DEBUGGING: Log question state when rendering
                  if (qIndex === 0) {
                    console.log(
                      `📝 First question appeared for Section ${section.sectionNumber} - loader should hide`
                    );
                  }
                  console.log(`🔍 Rendering question ${qIndex + 1}:`, {
                    questionId: question.questionId,
                    isApproved: question.isApproved,
                    status: question.status,
                    sectionNumber: section.sectionNumber,
                    isComplete: section.isComplete,
                  });

                  // Use question data as-is - allow individual questions to be approved before section completion
                  const safeQuestion = question;

                  return (
                    <div
                      key={safeQuestion.id || safeQuestion.questionId}
                      className="space-y-4"
                      data-phase2-question-anchor={questionAnchorId}
                    >
                      {/* Question Text - AVA Message (Left Side) */}
                      <div className="flex gap-3 items-start">
                        <div className="w-[70%]">
                          <div className="">
                            <div
                              className="text-xs text-slate-200 mb-1"
                              style={{ fontWeight: 700 }}
                            >
                              Question {section.sectionNumber}.{qIndex + 1}
                            </div>
                            <p
                              className="text-[15px] leading-relaxed text-slate-200 whitespace-pre-wrap"
                              style={{ fontWeight: 600 }}
                            >
                              {safeQuestion.questionText.replace(
                                /^Question \d+\s*/i,
                                ""
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Answer - AVA Message (Left Side) - AI Generated */}
                      {safeQuestion.status === "generating" && (
                        <div className="flex gap-3 items-start">
                          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                            <AVATypingIndicator />
                          </div>
                        </div>
                      )}

                      {safeQuestion.status === "ready" && (
                        <div className="space-y-3">
                          {/* Answer - User Message (Right Side) - Same style as Phase 1 */}
                          <div className="flex gap-3 items-start justify-end">
                            <div className="w-[70%] flex flex-col items-end gap-2">
                              <div
                                className={`${
                                  isEditing
                                    ? "px-0 py-2"
                                    : "bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl rounded-tr-sm px-4 py-3"
                                } w-full transition-all duration-300 ${
                                  isEditing ? "" : "animate-ai-answer-in"
                                }`}
                              >
                                {isEditing ? (
                                  <Textarea
                                    value={editedContent}
                                    onChange={(e) =>
                                      setEditedContent(e.target.value)
                                    }
                                    className="min-h-[120px] text-[15px] leading-relaxed w-full bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring-0 focus:outline-none rounded-lg px-4 py-3 transition-all duration-200 resize-none placeholder:text-slate-500 text-slate-200"
                                    placeholder="Edit your answer here..."
                                    autoFocus
                                  />
                                ) : (
                                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-slate-200">
                                    {displayAnswer}
                                  </p>
                                )}
                              </div>

                              {/* Action Buttons - Enterprise-level design with professional styling */}
                              <div className="flex gap-3 items-center w-full justify-between mt-3 pt-3 border-t border-gray-100">
                                <div className="flex gap-2.5 items-center">
                                  {/* Per-question Confirm */}
                                  {!safeQuestion.isApproved && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleConfirmQuestion(question, section)
                                      }
                                      className="group relative appearance-none select-none
                                      border-2 border-green-200 hover:border-green-400
                                      bg-slate-800/50 hover:bg-green-500/20 border border-slate-700/50
                                      text-slate-300 hover:text-green-400
                                      text-xs font-medium h-9 px-4
                                      shadow-sm hover:shadow-md
                                      transition-colors duration-200 ease-linear
                                      focus:outline-none focus-visible:ring-0 active:outline-none
                                      active:bg-white active:text-gray-700"
                                    >
                                      <Check className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:scale-110" />
                                      <span className="relative z-10">
                                        Confirm
                                      </span>
                                    </Button>
                                  )}
                                  {safeQuestion.isApproved && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-md px-3 h-9 shadow-sm">
                                      <Check className="w-3.5 h-3.5" />
                                      Approved
                                    </span>
                                  )}
                                  {isEditing ? (
                                    <div className="flex gap-2.5 items-center">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        className="group border-2 bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-700 text-xs font-medium h-9 px-4 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                                      >
                                        <span className="relative z-10">
                                          Cancel
                                        </span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleSaveEdit(
                                            section.sectionNumber,
                                            question.id!,
                                            question.questionId
                                          )
                                        }
                                        disabled={!question.id || isSavingEdit}
                                        className="group relative bg-gradient-to-r from-vox-pink via-vox-orange to-vox-pink text-white text-xs font-medium h-9 px-5 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 hover:from-vox-pink/90 hover:via-vox-orange/90 hover:to-vox-pink/90"
                                      >
                                        {isSavingEdit ? (
                                          <>
                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                            <span>Saving...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Check className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:scale-110" />
                                            <span className="relative z-10">
                                              Save Changes
                                            </span>
                                          </>
                                        )}
                                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 rounded-md transition-opacity duration-300" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleEdit(
                                          question.questionId,
                                          displayAnswer
                                        )
                                      }
                                      className="group relative border-2 bg-white hover:bg-gradient-to-r hover:from-vox-purple/5 hover:to-indigo-50 border-vox-purple/30 hover:border-vox-purple/60 text-gray-700 hover:text-vox-purple text-xs font-medium h-9 px-4 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                                    >
                                      <Edit className="w-3.5 h-3.5 mr-1.5 transition-all duration-300 group-hover:rotate-12 group-hover:scale-110" />
                                      <span className="relative z-10">
                                        Edit Answer
                                      </span>
                                    </Button>
                                  )}
                                </div>

                                {/* AI Regenerate Question button aligned to the right */}
                                {!safeQuestion.isApproved && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                      regeneratingQuestionId === question.id
                                    }
                                    onClick={() =>
                                      handleRegenerateQuestion(
                                        question,
                                        section
                                      )
                                    }
                                    className="group relative border-2 bg-white hover:bg-gradient-to-r hover:from-vox-orange/5 hover:to-amber-50 border-vox-orange/30 hover:border-vox-orange/50 text-vox-orange hover:text-vox-orange/90 text-xs font-medium h-9 px-4 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ml-auto"
                                  >
                                    {regeneratingQuestionId === question.id ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                        <span>Regenerating...</span>
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:rotate-180 duration-500" />
                                        <span className="relative z-10">
                                          AI Regenerate
                                        </span>
                                      </>
                                    )}
                                    <span className="absolute inset-0 bg-gradient-to-r from-vox-orange/0 via-vox-orange/10 to-amber/0 opacity-0 group-hover:opacity-100 rounded-md transition-opacity duration-300" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {safeQuestion.status === "failed" && (
                        <div className="flex gap-3">
                          <div className="w-10" />
                          <div className="w-[70%]">
                            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                              <p className="text-sm text-destructive">
                                Failed to generate answer. Please regenerate.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Section Complete indicator */}
                {section.isComplete && (
                  <>
                    <div className="flex justify-center">
                      <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <p className="text-xs text-green-600 font-medium">
                          ✓ Section {section.sectionNumber} Complete
                        </p>
                      </div>
                    </div>

                    {/* Loader after section complete - show when next section is being generated */}
                    {(() => {
                      const nextSectionNumber = section.sectionNumber + 1;
                      const nextSection = sections.find(
                        (s) => s.sectionNumber === nextSectionNumber
                      );
                      // Show loader if:
                      // 1. Next section is the current section being worked on
                      // 2. We're transitioning or generating
                      // 3. Next section doesn't exist yet OR has no ready questions
                      const shouldShowLoader =
                        currentSection === nextSectionNumber &&
                        (isTransitioningSection || isGenerating) &&
                        (!nextSection ||
                          nextSection.questions.length === 0 ||
                          !nextSection.questions.some(
                            (q) => q.status === "ready" || q.aiGeneratedAnswer
                          ));

                      return (
                        shouldShowLoader && (
                          <div className="flex gap-3 items-start">
                            <div className="w-[70%]">
                              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                                <AVATypingIndicator />
                              </div>
                            </div>
                          </div>
                        )
                      );
                    })()}
                  </>
                )}
              </div>
            );
          })}

          {isGenerating && currentSection && sections.length === 0 && (
            <div className="flex gap-3 items-start animate-fade-in">
              <div className="w-[70%]">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <AVATypingIndicator />
                </div>
              </div>
            </div>
          )}

          {/* Phase 2 Completion UI - Show when all sections are complete */}
          {completedCount === totalSections && sections.length > 0 && (
            <div className="flex flex-col items-center justify-center gap-6 py-12 animate-fade-in">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-vox-pink via-vox-orange to-vox-pink/80 flex items-center justify-center mx-auto shadow-2xl animate-pulse-glow">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h2 className="font-heading font-bold text-3xl bg-gradient-to-r from-vox-pink to-vox-orange bg-clip-text text-transparent">
                  Congratulations, {userName}! 🎉
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Your complete AVA Ideal Client Profile is ready
                </p>
              </div>

              <div className="bg-white border-2 border-vox-pink/20 rounded-xl shadow-xl p-8 max-w-2xl w-full space-y-6">
                <div className="space-y-3">
                  <Button
                    onClick={async () => {
                      if (_externalExportPDF) {
                        await _externalExportPDF();
                      } else {
                        // Fallback export handler
                        const currentSessionId =
                          actualSessionIdRef.current || backendSessionId;
                        if (!currentSessionId) {
                          toast({
                            title: "Error",
                            description:
                              "Session ID is missing. Please refresh the page.",
                            variant: "destructive",
                          });
                          return;
                        }
                        try {
                          const { exportProfilePDF } = await import(
                            "@/lib/ava-api"
                          );
                          const blob = await exportProfilePDF(currentSessionId);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `AVA-Profile-${userName}-${
                            new Date().toISOString().split("T")[0]
                          }.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast({
                            title: "Profile Exported",
                            description:
                              "Your AVA profile has been downloaded as PDF",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Export Failed",
                            description:
                              error?.message ||
                              "Failed to export PDF. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                    size="lg"
                    className="w-full bg-gradient-to-r from-vox-pink to-vox-orange text-white shadow-lg hover:shadow-xl"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download Profile PDF
                  </Button>

                  {_onStartOver && (
                    <>
                      <Button
                        onClick={() => {
                          setShowCreateNewProfileDialog(true);
                        }}
                        variant="outline"
                        size="lg"
                        className="w-full"
                      >
                        <FileText className="w-5 h-5 mr-2" />
                        Create New Profile
                      </Button>

                      <AlertDialog
                        open={showCreateNewProfileDialog}
                        onOpenChange={setShowCreateNewProfileDialog}
                      >
                        <AlertDialogContent className="bg-background">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Start New Profile?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will clear all progress and start fresh. Your
                              current session will be saved in browser history.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                setShowCreateNewProfileDialog(false);
                                if (typeof _onStartOver === "function") {
                                  _onStartOver();
                                }
                              }}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Start New Profile
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>

                <div className="pt-6 border-t space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Next Steps
                  </h3>
                  <ul className="space-y-2 text-sm text-left">
                    <li className="flex items-start gap-2">
                      <span className="text-vox-pink">✓</span>
                      <span>
                        Use this profile to craft hyper-relevant marketing
                        messages
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-vox-pink">✓</span>
                      <span>
                        Share with your team to align on ideal client vision
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-vox-pink">✓</span>
                      <span>
                        Apply insights to all VoxBox Amplifiers for consistent
                        messaging
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Create New Session Dialog */}
      <AlertDialog
        open={showNewSessionDialog}
        onOpenChange={setShowNewSessionDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to create a new session? This will reset
              your current progress and start fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowNewSessionDialog(false);
                // Cancel current session if exists
                const currentSessionId =
                  actualSessionIdRef.current || backendSessionId;
                if (currentSessionId) {
                  try {
                    await cancelAvaSession(currentSessionId);
                    console.log("✅ Session cancelled via API");
                  } catch (error) {
                    console.error("❌ Failed to cancel session:", error);
                  }
                }
                // Clear saved session state
                if (currentWorkspace?.id) {
                  localStorage.removeItem(
                    `ava-session-state-${currentWorkspace.id}`
                  );
                  const key = getPersistenceKey(currentWorkspace.id);
                  if (key) {
                    localStorage.removeItem(key);
                  }
                  // Clear Phase 1 and Phase 2 state
                  Object.keys(localStorage).forEach((key) => {
                    if (
                      key.startsWith(
                        `ava-phase1-state-${currentWorkspace.id}-`
                      ) ||
                      key.startsWith(`ava-phase2-${currentWorkspace.id}-`)
                    ) {
                      localStorage.removeItem(key);
                    }
                  });
                  // Clear restored state references for fresh session
                  restoredQuestionIndexRef.current = null;
                  hasRestoredState.current = false;
                  hasRestoredQuestionScroll.current = false;
                  console.log(
                    "🧹 Cleared all restored state references for new session"
                  );
                }
                // Navigate to AVA welcome page with scroll state
                navigate("/tools/ava", {
                  replace: true,
                  state: { scrollToBottom: true, resetTimestamp: Date.now() },
                });
                // Auto scroll to bottom after navigation to show Activate Now button
                setTimeout(() => {
                  window.scrollTo({
                    top: document.documentElement.scrollHeight,
                    behavior: "smooth",
                  });
                }, 500);
              }}
              className="bg-gradient-to-r from-vox-pink to-vox-orange text-white hover:opacity-90"
            >
              Create New Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
