import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AVAHeader } from "./AVAHeader";
import { AVATypingIndicator } from "./AVATypingIndicator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useSidebarState } from "@/hooks/useSidebarState";
import {
  startPhase1,
  submitAnswer,
  updateSessionName,
  saveConversationHistory,
  getConversationHistory,
  cancelAvaSession,
  type Phase1Question,
  type StartPhase1Response,
  type SubmitNameResponse,
} from "@/lib/ava-api";
import { API_BASE_URL } from "@/config/api.config";
import {
  Send,
  ChevronDown,
  Edit,
  Check,
  X,
  Loader2,
  AlertCircle,
  Copy,
  CheckCheck,
} from "lucide-react";
import { useAvaNameResponseStore } from "@/stores/avaNameResponseStore";
import {
  AVA_DEFAULT_INTRO_VIDEO_URL,
  buildAvaFallbackIntroMessages,
} from "@/constants/ava";

interface AVAPhase1InterfaceProps {
  sessionId: string;
  onPhase1Complete: (userName: string) => void;
  onStartOver?: () => void;
  onError?: (error: string) => void;
  hideHeader?: boolean; // Hide header when Phase 2 is active (parent handles header)
  hideStartPhase2Button?: boolean; // Hide the Start Phase 2 button when parent already transitioned
  onProgressChange?: (progress: {
    currentQuestionIndex: number;
    totalQuestions: number;
  }) => void; // Report progress to parent for header
  onUserNameChange?: (userName: string) => void; // Report userName changes to parent for header
}

type MessageType = {
  id: string;
  role: "ava" | "user";
  content: string;
  timestamp: Date;
  videoUrl?: string;
  isQuestion?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
  examples?: string[];
  sectionTitle?: string;
  isName?: boolean; // Flag to identify name submission messages
  allowDuplicateContent?: boolean; // Allow same content multiple times (e.g. fallback appreciation)
  model?: string; // AI model used (e.g., 'claude-sonnet-4-20250514')
};

type Phase1Stage =
  | "intro"
  | "awaiting-name"
  | "processing-name"
  | "showing-intro"
  | "questions"
  | "complete";

type AwaitingQuestionState = {
  sessionId: string;
  questionNumber: number;
  ackDisplayed?: boolean;
  timestamp?: number;
};

export const AVAPhase1Interface = ({
  sessionId,
  onPhase1Complete,
  onStartOver,
  onError,
  hideHeader = false,
  hideStartPhase2Button = false,
  onProgressChange,
  onUserNameChange,
}: AVAPhase1InterfaceProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const { leftOffset } = useSidebarState();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasInitialized = useRef(false);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const examplesContainerRef = useRef<HTMLDivElement>(null);
  const lastExampleRef = useRef<HTMLButtonElement>(null);

  // Helper function to scroll to bottom, waiting for DOM updates (especially for messages with examples)
  const scrollToBottom = (delay: number = 0) => {
    // Check if the last message has examples - if so, we need extra time for them to render
    const lastMessage = messages[messages.length - 1];
    const hasExamples = lastMessage?.examples && lastMessage.examples.length > 0;
    const extraDelay = hasExamples ? 200 : 0; // Extra delay when examples are present
    
    // Use requestAnimationFrame multiple times to ensure DOM is fully updated
    // This is especially important when messages have examples that need to render
    const performScroll = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Double RAF ensures React has rendered and browser has laid out
          // If examples are present, wait one more frame to ensure they're fully rendered
          if (hasExamples) {
            requestAnimationFrame(() => {
              messagesEndRef.current?.scrollIntoView({ 
                behavior: "smooth", 
                block: "end",
                inline: "nearest"
              });
            });
          } else {
            messagesEndRef.current?.scrollIntoView({ 
              behavior: "smooth", 
              block: "end",
              inline: "nearest"
            });
          }
        });
      });
    };

    const totalDelay = delay + extraDelay;
    if (totalDelay > 0) {
      setTimeout(performScroll, totalDelay);
    } else {
      performScroll();
    }
  };
  const prevWorkspaceIdRef = useRef<string | undefined>(currentWorkspace?.id);
  const prevSessionIdRef = useRef<string | undefined>(sessionId);
  const [sidebarOffset, setSidebarOffset] = useState(leftOffset);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  // Calculate scrollbar width
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

  // State management
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [stage, setStage] = useState<Phase1Stage>("awaiting-name");
  const [userName, setUserName] = useState("");
  const [inputValue, setInputValue] = useState("");
  // Initialize typing indicator based on fresh "Activate Now" click to prevent blank screen
  const [isTyping, setIsTyping] = useState(() => {
    // Check if we're in a fresh "Activate Now" click scenario
    if (typeof window !== "undefined" && sessionId) {
      const activateInProgress = sessionStorage.getItem(
        "activate-now-in-progress"
      );
      const activateSessionId = sessionStorage.getItem(
        "activate-now-session-id"
      );
      // Show typing indicator immediately if this is a fresh click (not a refresh)
      if (activateInProgress === "true" && activateSessionId === sessionId) {
        return true;
      }
    }
    return false;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Phase1Question | null>(
    null
  );
  const [progress, setProgress] = useState({
    current: 0,
    total: 27,
    percentage: 0,
  });
  const [videoUrl, setVideoUrl] = useState(AVA_DEFAULT_INTRO_VIDEO_URL);
  const [showExamples, setShowExamples] = useState(false);

  // Report progress changes to parent for header display
  useEffect(() => {
    if (onProgressChange) {
      const totalQuestions = progress?.total || 27;
      let currentQuestionIndex = Math.max(0, (progress?.current || 0) - 1);

      // If all questions are completed (stage is complete or current >= total), show 100%
      if (stage === "complete" || (progress?.current || 0) >= totalQuestions) {
        currentQuestionIndex = totalQuestions;
      }

      onProgressChange({
        currentQuestionIndex,
        totalQuestions,
      });
    }
  }, [progress, stage, onProgressChange]);

  // Report userName changes to parent for header display
  useEffect(() => {
    if (onUserNameChange && userName) {
      onUserNameChange(userName);
    }
  }, [userName, onUserNameChange]);
  const [showHeader, setShowHeader] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const lastQuestionNumberRef = useRef<number | null>(null);
  const shouldRetriggerNameSubmit = useRef<string | null>(null);
  const hasRetriggeredNameSubmit = useRef(false);
  const handleNameSubmitRef = useRef<((name: string) => Promise<void>) | null>(
    null
  );
  const pendingQuestionRestoreRef = useRef(false);
  const hasAttemptedQuestionRecovery = useRef(false);
  const loadNextQuestionRef = useRef<() => Promise<void>>();
  const awaitingQuestionKey = "phase1-awaiting-question";
  const resetNameResponseStore = useAvaNameResponseStore(
    (state) => state.reset
  );

  const resetNameSubmissionProgress = (
    options: {
      preserveName?: boolean;
      preserveSession?: boolean;
      preserveStore?: boolean;
    } = {}
  ) => {
    if (typeof window === "undefined") return;
    const storage = window.sessionStorage;
    storage.removeItem("name-submission-in-progress");
    storage.removeItem("name-submission-messages-total");
    storage.removeItem("name-submission-messages-displayed");
    storage.removeItem("name-submission-messages");
    storage.removeItem("name-submission-retrigger");
    storage.removeItem("name-submission-video-url");
    if (!options.preserveName) {
      storage.removeItem("name-submission-stored-name");
    }
    if (!options.preserveSession) {
      storage.removeItem("name-submission-session-id");
    }
    if (!options.preserveStore) {
      useAvaNameResponseStore.getState().reset();
    }
  };

  // Helper function to restore Activate Now messages from localStorage
  // Returns the message if restored, null otherwise
  // CRITICAL: This prepends the message to the beginning of the array to ensure it appears at the top
  const restoreActivateNowMessages = (): MessageType | null => {
    if (!currentWorkspace?.id || !sessionId) return null;

    const activateNowKey = `activate-now-messages-${currentWorkspace.id}-${sessionId}`;
    try {
      const storedData = localStorage.getItem(activateNowKey);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (
          parsed.messages &&
          Array.isArray(parsed.messages) &&
          parsed.messages.length > 0
        ) {
          const combinedActivateMessage = parsed.messages.join("");
          const activateMessageId = `activate-msg-restored-${sessionId}`;

          // Use functional update to ensure we check the latest state
          let shouldRestore = false;
          setMessages((prev) => {
            // Check if Activate Now message already exists in current messages
            const hasActivateMessage = prev.some(
              (msg) =>
                msg.id?.includes("activate-msg") ||
                (msg.role === "ava" &&
                  msg.content?.includes(
                    combinedActivateMessage.substring(0, 50)
                  ))
            );

            if (hasActivateMessage) {
              console.log(
                "ℹ️ Activate Now message already exists in messages, skipping restore"
              );
              return prev;
            }

            shouldRestore = true;

            // Get stored timestamp if available
            let activateMessageTimestamp = new Date();
            if (parsed.timestamp) {
              activateMessageTimestamp = new Date(parsed.timestamp);
            } else {
              // Use a timestamp earlier than current time to ensure it appears first
              // If there are existing messages, use a timestamp earlier than the first one
              if (prev.length > 0 && prev[0]?.timestamp) {
                const firstTimestamp =
                  typeof prev[0].timestamp === "string"
                    ? new Date(prev[0].timestamp)
                    : prev[0].timestamp;
                activateMessageTimestamp = new Date(
                  firstTimestamp.getTime() - 60000
                );
              } else {
                activateMessageTimestamp = new Date(Date.now() - 60000);
              }
            }

            const activateMessage: MessageType = {
              id: activateMessageId,
              role: "ava",
              content: combinedActivateMessage,
              timestamp: activateMessageTimestamp,
            };

            console.log(
              "💾 Restoring Activate Now message from localStorage immediately - prepending to top"
            );
            // Prepend to the beginning of the array to ensure it appears at the top
            // This is critical when refreshing during Submit Name API response
            return [activateMessage, ...prev];
          });

          if (shouldRestore) {
            // Return the message that was restored (for tracking purposes)
            return {
              id: activateMessageId,
              role: "ava" as const,
              content: combinedActivateMessage,
              timestamp: new Date(),
            };
          }
        }
      }
    } catch (e) {
      console.warn("Failed to restore Activate Now messages:", e);
    }
    return null;
  };

  const resumeNameSubmissionAfterRefresh = async () => {
    // CRITICAL: Only restore Activate Now messages if Submit Name API was in progress
    // This ensures we restore them during Submit Name API refresh, not during fresh Activate Now clicks
    // Check if this is a Submit Name API resume scenario, not a fresh Activate Now click
    const nameSubmissionInProgressFlag = sessionStorage.getItem(
      "name-submission-in-progress"
    );
    const storeState = useAvaNameResponseStore.getState();
    const isSubmitNameResume =
      nameSubmissionInProgressFlag === "true" ||
      (storeState.status === "rendering" && storeState.sessionId === sessionId);

    // Only restore Activate Now messages if we're resuming Submit Name API (not fresh click)
    if (isSubmitNameResume) {
      console.log(
        "💾 Resuming Submit Name API - restoring Activate Now messages immediately"
      );
      restoreActivateNowMessages();
    }

    // Continue with Submit Name API resume logic
    if (
      storeState.status === "rendering" &&
      storeState.sessionId === sessionId &&
      storeState.userName
    ) {
      console.log(
        "🔁 Resuming name submission via Zustand store, re-calling API"
      );
      ensureUserNameMessage(storeState.userName);
      setStage("processing-name");
      setIsSubmitting(true);
      try {
        await executeNameSubmission(storeState.userName, {
          renderedCount: storeState.renderedCount,
          videoShown: storeState.videoShown,
        });
        return true;
      } catch (error) {
        console.error("❌ Failed to resume via store:", error);
        resetNameResponseStore();
        resetNameSubmissionProgress();
      } finally {
        setIsSubmitting(false);
      }
    }

    const nameSubmissionInProgress = sessionStorage.getItem(
      "name-submission-in-progress"
    );
    const storedName = sessionStorage.getItem("name-submission-stored-name");
    const storedNameSessionId = sessionStorage.getItem(
      "name-submission-session-id"
    );

    if (
      nameSubmissionInProgress === "true" &&
      storedName &&
      (!storedNameSessionId || storedNameSessionId === sessionId)
    ) {
      console.log(
        "🔁 Resuming name submission via sessionStorage (API re-call)"
      );
      ensureUserNameMessage(storedName);
      setStage("processing-name");
      setIsSubmitting(true);
      try {
        await executeNameSubmission(storedName);
        return true;
      } catch (error) {
        console.error("❌ Failed to resume via sessionStorage:", error);
        resetNameSubmissionProgress();
      } finally {
        setIsSubmitting(false);
      }
    }

    return false;
  };

  const setAwaitingQuestionState = (state: AwaitingQuestionState) => {
    if (typeof window === "undefined") return;
    hasAttemptedQuestionRecovery.current = false;
    window.sessionStorage.setItem(
      awaitingQuestionKey,
      JSON.stringify({
        ...state,
        timestamp: Date.now(),
      })
    );
  };

  const getAwaitingQuestionState = (): AwaitingQuestionState | null => {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(awaitingQuestionKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AwaitingQuestionState;
    } catch {
      window.sessionStorage.removeItem(awaitingQuestionKey);
      return null;
    }
  };

  const clearAwaitingQuestionState = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(awaitingQuestionKey);
    hasAttemptedQuestionRecovery.current = false;
  };

  // Get persistence key
  const getPersistenceKey = (workspaceId: string | undefined) => {
    if (!workspaceId) return null;
    return `ava-phase1-chat-${workspaceId}-${sessionId}`;
  };

  // Persist state to both localStorage and backend
  const persistState = async () => {
    if (!currentWorkspace?.id) return;
    const key = getPersistenceKey(currentWorkspace.id);
    if (!key) return;

    const state = {
      messages,
      stage,
      userName,
      progress,
      videoUrl,
      currentQuestion,
      lastUpdated: new Date().toISOString(),
    };

    // Save to localStorage for fast local access
    localStorage.setItem(key, JSON.stringify(state));

    // Save to backend for persistence across devices/sessions
    if (sessionId && messages.length > 0) {
      try {
        await saveConversationHistory(sessionId, messages);
        console.log("✅ Saved conversation history to backend");
      } catch (error) {
        console.warn("⚠️ Failed to save conversation to backend:", error);
        // Don't throw - localStorage is still saved
      }
    }
  };

  // Load persisted state from backend first, then localStorage fallback
  const loadPersistedState = async () => {
    if (!currentWorkspace?.id || !sessionId) {
      console.log(
        "⚠️ Cannot load persisted state: missing workspace or sessionId"
      );
      return null;
    }

    console.log(`🔍 Loading persisted state for session: ${sessionId}`);

    // Try backend first (source of truth) - with retry logic
    let backendHistory = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries && !backendHistory) {
      try {
        console.log(
          `📡 Attempting to load conversation history from backend (attempt ${
            retryCount + 1
          }/${maxRetries})...`
        );
        const result = await getConversationHistory(sessionId);

        if (result && result.messages && result.messages.length > 0) {
          backendHistory = result;
          console.log(
            `✅ Successfully loaded ${result.messages.length} messages from backend`
          );
          break;
        } else {
          console.log(
            `⚠️ Backend returned empty messages array (attempt ${
              retryCount + 1
            })`
          );
          if (retryCount < maxRetries - 1) {
            // Wait before retrying (exponential backoff)
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (retryCount + 1))
            );
          }
        }
      } catch (error: any) {
        console.warn(
          `⚠️ Failed to load from backend (attempt ${
            retryCount + 1
          }/${maxRetries}):`,
          error
        );
        if (retryCount < maxRetries - 1) {
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (retryCount + 1))
          );
        }
      }
      retryCount++;
    }

    if (
      backendHistory &&
      backendHistory.messages &&
      backendHistory.messages.length > 0
    ) {
      console.log(
        "📂 Restoring Phase 1 chat from backend:",
        backendHistory.messages.length,
        "messages"
      );

      // Extract state from messages
      let extractedUserName = "";
      let extractedVideoUrl = "";
      let extractedStage: Phase1Stage = "intro";
      let extractedCurrentQuestion: Phase1Question | null = null;
      let extractedProgress = { current: 0, total: 27, percentage: 0 };

      // Find userName - look for user message after "What's your name?"
      const nameQuestionIndex = backendHistory.messages.findIndex(
        (msg: any) =>
          msg.role === "ava" && msg.content?.includes("What's your name")
      );
      if (
        nameQuestionIndex >= 0 &&
        nameQuestionIndex + 1 < backendHistory.messages.length
      ) {
        const userResponse = backendHistory.messages[nameQuestionIndex + 1];
        if (userResponse?.role === "user") {
          extractedUserName = userResponse.content || "";
        }
      }

      // Find videoUrl from any message (check all messages, not just first one)
      // This ensures we capture video URLs from intro messages
      for (const msg of backendHistory.messages) {
        if (msg.videoUrl && msg.videoUrl.trim()) {
          extractedVideoUrl = msg.videoUrl;
          // Don't break - continue to find the latest video URL if multiple exist
        }
      }

      // Find last question to determine stage and progress
      const lastQuestion = [...backendHistory.messages]
        .reverse()
        .find((msg: any) => msg.isQuestion && msg.role === "ava");

      if (lastQuestion) {
        extractedCurrentQuestion = {
          id: lastQuestion.questionId || "",
          sectionId: lastQuestion.sectionId || "",
          sectionTitle: lastQuestion.sectionTitle || "",
          text: lastQuestion.content || "",
          videoUrl: extractedVideoUrl || undefined,
        };

        if (lastQuestion.questionNumber) {
          extractedProgress = {
            current: lastQuestion.questionNumber,
            total: lastQuestion.totalQuestions || 27,
            percentage: Math.round(
              (lastQuestion.questionNumber /
                (lastQuestion.totalQuestions || 27)) *
                100
            ),
          };
        }

        // Check if there's a user answer after the last question
        const lastQuestionIndex = backendHistory.messages.findIndex(
          (msg: any) => msg.id === lastQuestion.id
        );
        const hasAnswerAfter =
          lastQuestionIndex >= 0 &&
          lastQuestionIndex + 1 < backendHistory.messages.length &&
          backendHistory.messages[lastQuestionIndex + 1]?.role === "user";

        if (hasAnswerAfter) {
          extractedStage = "questions"; // User has answered, waiting for next question or completion
        } else {
          extractedStage = "questions"; // Question is shown, waiting for answer
        }
      } else if (extractedVideoUrl) {
        extractedStage = "showing-intro"; // Video shown but no questions yet
      } else if (extractedUserName) {
        extractedStage = "awaiting-name"; // Name submitted but intro not complete
      }

      // Check if Phase 1 is complete (look for completion message)
      const hasCompletionMessage = backendHistory.messages.some(
        (msg: any) =>
          msg.role === "ava" &&
          (msg.content?.includes("completed all 27 questions") ||
            msg.content?.includes("Phase 1 is now complete"))
      );
      if (hasCompletionMessage) {
        extractedStage = "complete";
      }

      // Normalize message timestamps (convert string dates back to Date objects if needed)
      // CRITICAL: Deduplicate messages by ID and content to prevent duplicates
      const messageMap = new Map<string, any>();
      backendHistory.messages.forEach((msg: any) => {
        const key = msg.id || `${msg.role}-${msg.content?.substring(0, 50)}`;
        // Only add if we haven't seen this message before
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

      const normalizedMessages = Array.from(messageMap.values());

      return {
        messages: normalizedMessages,
        stage: extractedStage,
        userName: extractedUserName,
        progress: extractedProgress,
        videoUrl: extractedVideoUrl,
        currentQuestion: extractedCurrentQuestion,
      };
    }

    // Fallback to localStorage only if backend has no messages
    console.log(
      "⚠️ Backend has no conversation history, trying localStorage fallback..."
    );

    // Fallback to localStorage
    const key = getPersistenceKey(currentWorkspace.id);
    if (!key) return null;

    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(
          "📂 Restoring Phase 1 chat state from localStorage:",
          parsed
        );

        // CRITICAL: If we have messages in localStorage but not in backend, save them to backend
        // This handles the case where user signed out before auto-save completed
        if (parsed.messages && parsed.messages.length > 0 && sessionId) {
          console.log("💾 Syncing localStorage messages to backend...");
          try {
            await saveConversationHistory(sessionId, parsed.messages);
            console.log(
              "✅ Successfully synced conversation history to backend"
            );
          } catch (syncError) {
            console.warn(
              "⚠️ Failed to sync conversation history to backend:",
              syncError
            );
            // Continue with localStorage restore even if sync fails
          }
        }

        return parsed;
      }
    } catch (e) {
      console.error("Failed to load persisted state:", e);
    }
    return null;
  };

  // Track if this is a fresh start (no persisted messages) vs restored session
  const isFreshStart = useRef(true);
  const hasScrolledToTop = useRef(false);
  const previousMessageCount = useRef(0);
  const isInitialLoadComplete = useRef(false);
  const isIntroSequenceComplete = useRef(false);
  const isRestoredSession = useRef(false);
  const lastMessageContentLength = useRef(0);
  const previousContentLengthRef = useRef(0);
  const startPhase2ButtonRef = useRef<HTMLButtonElement>(null);

  // Check if intro sequence is complete (stage is past intro/name collection)
  useEffect(() => {
    if (
      stage === "questions" ||
      stage === "complete" ||
      stage === "showing-intro"
    ) {
      isIntroSequenceComplete.current = true;
    }
  }, [stage]);

  // Auto-scroll and auto-show examples when a new Phase 1 question appears
  useEffect(() => {
    if (stage !== "questions") return;

    // Find the last question message
    const questionMessages = messages.filter(
      (msg) => msg.isQuestion && msg.questionNumber
    );
    if (questionMessages.length === 0) return;

    const lastQuestion = questionMessages[questionMessages.length - 1];
    const currentQuestionNumber = lastQuestion.questionNumber;

    // Check if this is a new question (different from the last one we saw)
    if (
      currentQuestionNumber &&
      currentQuestionNumber !== lastQuestionNumberRef.current
    ) {
      lastQuestionNumberRef.current = currentQuestionNumber;

      // Automatically show examples for the new question
      setShowExamples(true);

      // Don't auto-scroll - let user stay at their current scroll position to view next question
      // User can manually scroll down to see the next question
    }
  }, [messages, stage]);

  // Auto-scroll behavior: top on fresh start, NO auto-scroll during content generation
  useEffect(() => {
    if (messages.length === 0) {
      previousMessageCount.current = 0;
      lastMessageContentLength.current = 0;
      return;
    }

    const currentMessageCount = messages.length;
    const messageCountIncreased =
      currentMessageCount > previousMessageCount.current;

    // Check if last message content is growing (chunk-based generation)
    const lastMessage = messages[messages.length - 1];
    const lastMessageContent = lastMessage?.content || "";

    // On restored session, scroll to bottom immediately
    if (isRestoredSession.current && !isInitialLoadComplete.current) {
      isInitialLoadComplete.current = true;
      previousMessageCount.current = currentMessageCount;
      lastMessageContentLength.current = lastMessageContent.length;
      setTimeout(() => {
        // Don't auto-scroll - show start of AVA response, let user scroll manually
      }, 300);
      return;
    }

    // On fresh start (first messages), scroll to top once
    if (isFreshStart.current && !hasScrolledToTop.current) {
      hasScrolledToTop.current = true;
      previousMessageCount.current = currentMessageCount;
      lastMessageContentLength.current = lastMessageContent.length;
      setTimeout(() => {
        // Production-safe: Check stage before scrolling
        const currentStage = stageRef.current || stage;
        if (
          currentStage !== "processing-name" &&
          currentStage !== "showing-intro"
        ) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }, 100);
      return;
    }

    // CRITICAL: Don't auto-scroll when Phase 1 is complete - let button scroll handle it
    if (stage === "complete") {
      // Update refs but don't scroll
      previousMessageCount.current = currentMessageCount;
      lastMessageContentLength.current = lastMessageContent.length;
      return;
    }

    // CRITICAL: Completely disable auto-scroll during content generation (processing-name, showing-intro)
    // User must manually scroll to view the generated content
    // Also don't auto-scroll during "questions" stage - let user stay at their scroll position
    // Production-safe: Use guard function to prevent any scroll operations
    if (hasScrolledToTop.current && messageCountIncreased) {
      // NO auto-scroll during content generation - user must manually scroll
      // This prevents forced scrolling when API is generating responses
      // Explicitly return early to prevent any scroll operations in production
      if (shouldDisableAutoScroll()) {
        return;
      }
    }

    // Update previous message count and content length
    previousMessageCount.current = currentMessageCount;
    lastMessageContentLength.current = lastMessageContent.length;
  }, [messages, stage]);

  // Track if we're in a chunked content generation (streaming API)
  const isChunkedGeneration = useRef(false);
  const chunkedContentCheckInterval = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const messagesRef = useRef(messages);
  const stageRef = useRef(stage);

  // Production-safe guard: Check if scrolling should be disabled
  // This function uses refs to avoid stale closures in production builds
  const shouldDisableAutoScroll = (): boolean => {
    const currentStage = stageRef.current || stage;
    return (
      currentStage === "processing-name" || currentStage === "showing-intro"
    );
  };

  // Keep refs in sync for production-safe access
  useEffect(() => {
    messagesRef.current = messages;
    stageRef.current = stage;
  }, [messages, stage]);

  // CRITICAL: Completely disable continuous scroll during content generation
  // User must manually scroll to view streaming/chunked content
  // This prevents auto-scroll when API is generating responses after name submission
  // Production-safe: Uses refs to avoid stale closures
  useEffect(() => {
    // Immediately stop any existing scroll intervals
    if (chunkedContentCheckInterval.current) {
      clearInterval(chunkedContentCheckInterval.current);
      chunkedContentCheckInterval.current = null;
    }

    if (messages.length === 0) {
      return;
    }

    // Don't scroll during very first intro messages (before name submission)
    if (isFreshStart.current && !hasScrolledToTop.current) {
      return;
    }

    // CRITICAL: Don't auto-scroll when Phase 1 is complete
    // Also don't auto-scroll when Phase 2 is active (hideStartPhase2Button is true)
    if (stage === "complete" || hideStartPhase2Button) {
      isChunkedGeneration.current = false;
      return;
    }

    // CRITICAL: Completely disable auto-scroll during content generation stages
    // This includes processing-name and showing-intro when API is generating responses
    // Production-safe: Use guard function to check stage
    if (shouldDisableAutoScroll()) {
      // Aggressively stop any existing continuous scroll
      if (chunkedContentCheckInterval.current) {
        clearInterval(chunkedContentCheckInterval.current);
        chunkedContentCheckInterval.current = null;
      }
      isChunkedGeneration.current = false;
      // Still track content length for when generation completes
      const lastMessage = messagesRef.current[messagesRef.current.length - 1];
      const currentContentLength = lastMessage?.content?.length || 0;
      previousContentLengthRef.current = currentContentLength;
      return;
    }

    // For other stages, we still don't auto-scroll - user must manually scroll
    // Just track content length changes but don't trigger any scrolling
    const lastMessage = messagesRef.current[messagesRef.current.length - 1];
    const currentContentLength = lastMessage?.content?.length || 0;
    previousContentLengthRef.current = currentContentLength;
    isChunkedGeneration.current = false;

    // Cleanup on unmount or stage change
    return () => {
      if (chunkedContentCheckInterval.current) {
        clearInterval(chunkedContentCheckInterval.current);
        chunkedContentCheckInterval.current = null;
      }
      isChunkedGeneration.current = false;
    };
  }, [messages, stage]);

  // Handle scroll to show/hide header
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollContainer = scrollContainerRef.current;
          // Use container scroll position since header is inside the container
          const currentScrollY = scrollContainer?.scrollTop || 0;
          const lastScroll = lastScrollYRef.current;

          // Track scroll state for compact header mode
          const scrolled = currentScrollY > 0;
          setIsScrolled(scrolled);

          // Update progress data for AppNavbar when scrolled
          if (scrolled && stage === "questions") {
            const progressData = {
              isScrolled: true,
              currentQuestionIndex: Math.max(0, (progress?.current || 0) - 1),
              totalQuestions: progress?.total || 27,
            };
            localStorage.setItem("avaProgressData", JSON.stringify(progressData));
            window.dispatchEvent(new CustomEvent("avaProgressUpdate", { detail: progressData }));
          } else if (!scrolled) {
            // Clear progress data when at top
            localStorage.removeItem("avaProgressData");
            window.dispatchEvent(new CustomEvent("avaProgressUpdate", { detail: null }));
          }

          // Always show header when at the top (within 50px)
          if (currentScrollY < 50) {
            setShowHeader(true);
            lastScrollYRef.current = currentScrollY;
            ticking = false;
            return;
          }

          // Hide header when scrolling down, show when scrolling up
          if (currentScrollY > lastScroll && currentScrollY > 100) {
            // Scrolling down - hide header
            setShowHeader(false);
          } else if (currentScrollY < lastScroll) {
            // Scrolling up - show header
            setShowHeader(true);
          }

          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    // Initial check for scroll position
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      lastScrollYRef.current = scrollContainer.scrollTop || 0;
      handleScroll();
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  // Scroll user message to appear right below AVA Header when user submits
  useEffect(() => {
    // Only scroll when a new user message is added
    if (stage === "questions" && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "user" && lastUserMessageRef.current) {
        const scrollToUserMessage = () => {
          if (!lastUserMessageRef.current || !scrollContainerRef.current) return;

          // Calculate AVA Header position dynamically
          // AVA Header is fixed at top-20 (80px) below AppNavbar
          // Header height: h-16 (64px) when not scrolled, h-6 (24px) when scrolled
          const navbarHeight = 80; // AppNavbar height (top-20 = 80px)
          
          // Try to find the AVA Header element (it's in the parent component)
          const avaHeader = document.querySelector('[class*="fixed top-20"]') as HTMLElement;
          let avaHeaderHeight = isScrolled ? 24 : 64; // Default fallback
          
          if (avaHeader) {
            const actualHeight = avaHeader.getBoundingClientRect().height;
            if (actualHeight > 0) {
              avaHeaderHeight = actualHeight;
            }
          }

          const spacing = 16; // Small aesthetic spacing below header
          const targetOffset = navbarHeight + avaHeaderHeight + spacing;

          // Get the position of the user message relative to the scroll container
          const containerRect = scrollContainerRef.current.getBoundingClientRect();
          const messageRect = lastUserMessageRef.current.getBoundingClientRect();
          
          // Calculate scroll position
          const currentScrollTop = scrollContainerRef.current.scrollTop;
          const messageOffsetTop = messageRect.top - containerRect.top + currentScrollTop;
          const targetScrollTop = messageOffsetTop - targetOffset;

          scrollContainerRef.current.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: "smooth"
          });
        };

        // Use double requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(scrollToUserMessage, 100); // Small delay to ensure DOM is updated
          });
        });
      }
      // Don't auto-scroll when AVA responds - show start of response, let user scroll manually
    }
  }, [messages.length, stage, isScrolled]);

  // Scroll to last example when examples are expanded
  useEffect(() => {
    if (showExamples && lastExampleRef.current) {
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
  }, [showExamples]);

  // Ref to track last save time and pending save
  const lastSaveTimeRef = useRef<number>(0);
  const pendingSaveRef = useRef<number | null>(null);

  // Immediate save function (no debounce)
  const saveImmediately = async () => {
    if (!sessionId || messages.length === 0) return;

    // Cancel any pending debounced save
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }

    try {
      await saveConversationHistory(sessionId, messages);
      lastSaveTimeRef.current = Date.now();
      console.log("✅ Conversation history saved immediately");
    } catch (error) {
      console.error("❌ Failed to save immediately:", error);
    }
  };

  // Persist state when it changes - save to both localStorage and backend
  useEffect(() => {
    if (hasInitialized.current && messages.length > 0) {
      // Save to localStorage immediately
      persistState();

      // Save to backend with short debounce (250ms for better responsiveness)
      if (sessionId) {
        // Cancel previous pending save
        if (pendingSaveRef.current) {
          clearTimeout(pendingSaveRef.current);
        }

        pendingSaveRef.current = setTimeout(async () => {
          try {
            await saveConversationHistory(sessionId, messages);
            lastSaveTimeRef.current = Date.now();
            console.log("✅ Conversation history auto-saved to backend");
          } catch (error) {
            console.warn(
              "⚠️ Failed to auto-save conversation to backend:",
              error
            );
          }
        }, 250); // Very short debounce - 250ms

        return () => {
          if (pendingSaveRef.current) {
            clearTimeout(pendingSaveRef.current);
          }
        };
      }
    }
  }, [
    messages,
    stage,
    userName,
    progress,
    videoUrl,
    currentQuestion,
    sessionId,
  ]);

  // Save immediately on tab close, navigation, or visibility change
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;

    const handleBeforeUnload = () => {
      // Check if we need to save (if last save was more than 1 second ago)
      const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
      if (timeSinceLastSave > 1000) {
        console.log("📤 Saving conversation before page unload...");
        // Use synchronous XHR as last resort (works during page unload)
        const token = localStorage.getItem("accessToken");
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `${API_BASE_URL}/ava-sessions/${sessionId}/conversation-history`,
          false
        );
        xhr.setRequestHeader("Content-Type", "application/json");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        try {
          xhr.send(JSON.stringify({ messages }));
        } catch (e) {
          console.error("Failed to save before unload:", e);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab becoming hidden - save immediately
        saveImmediately();
      }
    };

    // Also save when user navigates away
    const handlePageHide = () => {
      saveImmediately();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sessionId, messages]);

  // Handle workspace/session changes - reset state when workspace changes
  useEffect(() => {
    if (!currentWorkspace?.id || !sessionId) return;

    // Only check for changes if we've already initialized (prevents reset on initial mount)
    const workspaceChanged =
      prevWorkspaceIdRef.current &&
      prevWorkspaceIdRef.current !== currentWorkspace.id;
    const sessionChanged =
      prevSessionIdRef.current && prevSessionIdRef.current !== sessionId;

    // If workspace or session changed AFTER initialization, reset state
    if ((workspaceChanged || sessionChanged) && hasInitialized.current) {
      console.log(`🔄 Phase 1: Workspace/session changed, resetting state`);
      setMessages([]);
      setStage("intro");
      setUserName("");
      setProgress({ current: 0, total: 27, percentage: 0 });
      setVideoUrl(AVA_DEFAULT_INTRO_VIDEO_URL);
      setCurrentQuestion(null);
      resetNameResponseStore();
      hasInitialized.current = false; // Allow re-initialization for new workspace/session
    }

    prevWorkspaceIdRef.current = currentWorkspace.id;
    prevSessionIdRef.current = sessionId;
  }, [currentWorkspace?.id, sessionId]);

  // Initialize: Show welcome message or restore state
  useEffect(() => {
    if (hasInitialized.current || !currentWorkspace?.id || !sessionId) return;

    const initializeChat = async () => {
      const resumed = await resumeNameSubmissionAfterRefresh();
      if (resumed) {
        hasInitialized.current = true;
        return;
      }

      const persistedState = await loadPersistedState();

      if (
        persistedState &&
        persistedState.messages &&
        persistedState.messages.length > 0
      ) {
        // Restore persisted state - ALL messages including intro, name, video, questions, answers
        console.log(
          "📂 Restoring Phase 1 chat with",
          persistedState.messages.length,
          "messages"
        );
        console.log("📂 Restored stage:", persistedState.stage);
        console.log("📂 Restored userName:", persistedState.userName);
        console.log("📂 Restored progress:", persistedState.progress);
        console.log("📂 Restored videoUrl:", persistedState.videoUrl);

        // CRITICAL: Check for Activate Now messages in localStorage first
        // These should appear at the top even when restoring from backend conversation history
        let activateMessages: string[] | null = null;
        let activateNowTimestamp: number | null = null;
        if (currentWorkspace?.id && sessionId) {
          const activateNowKey = `activate-now-messages-${currentWorkspace.id}-${sessionId}`;
          try {
            const storedData = localStorage.getItem(activateNowKey);
            if (storedData) {
              const parsed = JSON.parse(storedData);
              if (
                parsed.messages &&
                Array.isArray(parsed.messages) &&
                parsed.messages.length > 0
              ) {
                activateMessages = parsed.messages;
                activateNowTimestamp = parsed.timestamp || null;
                console.log(
                  "💾 Found Activate Now messages in localStorage:",
                  parsed.messages.length,
                  "messages - will prepend to restored messages"
                );
              }
            }
          } catch (e) {
            console.warn("Failed to parse localStorage activate messages:", e);
          }
        }

        // Deduplicate messages before setting to prevent duplicates
        const messageMap = new Map<string, MessageType>();

        // If we have Activate Now messages, create a message from them and add it first
        if (activateMessages && activateMessages.length > 0) {
          const combinedActivateMessage = activateMessages.join("");
          const activateMessageId = `activate-msg-restored-${sessionId}`;
          // Check if Activate Now message already exists in restored messages
          const hasActivateMessage = persistedState.messages.some(
            (msg: any) =>
              msg.id?.includes("activate-msg") ||
              (msg.role === "ava" &&
                msg.content?.includes(combinedActivateMessage.substring(0, 50)))
          );

          if (!hasActivateMessage) {
            // Get stored timestamp if available, or use an early timestamp to ensure it appears first
            let activateMessageTimestamp = new Date();
            if (activateNowTimestamp) {
              activateMessageTimestamp = new Date(activateNowTimestamp);
            } else {
              // If no timestamp, use a timestamp earlier than the first restored message
              const firstMessage = persistedState.messages[0];
              if (firstMessage?.timestamp) {
                const firstTimestamp =
                  typeof firstMessage.timestamp === "string"
                    ? new Date(firstMessage.timestamp)
                    : firstMessage.timestamp;
                // Set timestamp to 1 minute before first message to ensure it appears first
                activateMessageTimestamp = new Date(
                  firstTimestamp.getTime() - 60000
                );
              }
            }

            // Prepend Activate Now message to the messages array
            const activateMessage: MessageType = {
              id: activateMessageId,
              role: "ava",
              content: combinedActivateMessage,
              timestamp: activateMessageTimestamp,
            };
            messageMap.set(activateMessageId, activateMessage);
            console.log(
              "✅ Prepending Activate Now message to restored messages"
            );
          } else {
            console.log(
              "ℹ️ Activate Now message already exists in restored messages, skipping prepend"
            );
          }
        }

        // Add all persisted messages (they'll come after Activate Now if it was prepended)
        persistedState.messages.forEach((msg: any) => {
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
              model: msg.model || "claude-sonnet-4-20250514", // Preserve model field, default to Claude Sonnet if missing
            });
          }
        });
        const deduplicatedMessages = Array.from(messageMap.values());

        // Set all state at once to prevent race conditions
        setMessages(deduplicatedMessages);
        setStage(persistedState.stage || "intro");
        setUserName(persistedState.userName || "");
        setProgress(
          persistedState.progress || { current: 0, total: 27, percentage: 0 }
        );
        setVideoUrl(persistedState.videoUrl || AVA_DEFAULT_INTRO_VIDEO_URL);
        setCurrentQuestion(persistedState.currentQuestion || null);

        // Clear typing indicator since messages are already loaded
        setIsTyping(false);

        // CRITICAL: Check if we need to load the next question after restoration
        // This handles the case where user refreshed after submitting answer but before next question loaded
        if (
          persistedState.stage === "questions" &&
          deduplicatedMessages.length > 0
        ) {
          const lastMessage =
            deduplicatedMessages[deduplicatedMessages.length - 1];
          const isLastMessageUserAnswer = lastMessage.role === "user";

          if (isLastMessageUserAnswer) {
            // Find the last question in the messages
            const lastQuestionIndex = deduplicatedMessages
              .map((msg, idx) =>
                msg.isQuestion && msg.role === "ava" ? idx : -1
              )
              .filter((idx) => idx >= 0)
              .pop();

            // Check if there's a question after the last user answer
            const lastUserAnswerIndex = deduplicatedMessages.length - 1;
            const hasQuestionAfterAnswer =
              lastQuestionIndex !== undefined &&
              lastQuestionIndex > lastUserAnswerIndex;

            // If last message is a user answer and there's no question after it, we need to load the next question
            if (!hasQuestionAfterAnswer) {
              console.log(
                "🔄 Detected user answer without next question after restoration - loading next question..."
              );
              // Set awaiting question state to trigger loadNextQuestion
              if (sessionId && persistedState.progress) {
                setAwaitingQuestionState({
                  sessionId,
                  questionNumber: persistedState.progress.current || 0,
                  timestamp: Date.now(),
                });
              }
              // Trigger loadNextQuestion after a short delay to ensure state is set
              setTimeout(() => {
                loadNextQuestionRef.current?.();
              }, 500);
            }
          }
        }

        // Mark as not fresh start since we're restoring existing messages
        isFreshStart.current = false;
        isRestoredSession.current = true;
        isInitialLoadComplete.current = false; // Will be set to true in scroll effect
        previousMessageCount.current = deduplicatedMessages.length;
        // Set last message content length for chunk detection
        const lastMsg = deduplicatedMessages[deduplicatedMessages.length - 1];
        lastMessageContentLength.current = lastMsg?.content?.length || 0;
        previousContentLengthRef.current = lastMsg?.content?.length || 0;
        // Check if intro sequence was already complete in restored state
        if (
          persistedState.stage === "questions" ||
          persistedState.stage === "complete" ||
          persistedState.stage === "showing-intro"
        ) {
          isIntroSequenceComplete.current = true;
        }

        console.log(
          "✅ Phase 1 chat fully restored -",
          deduplicatedMessages.length,
          "unique messages (deduplicated from",
          persistedState.messages.length,
          ")"
        );
      } else {
        // Fresh start - show intro message
        console.log(
          "🆕 Starting fresh Phase 1 chat - no persisted state found"
        );
        // Reset flags for fresh start
        isFreshStart.current = true;
        hasScrolledToTop.current = false;
        isInitialLoadComplete.current = false;
        previousMessageCount.current = 0;
        isIntroSequenceComplete.current = false;
        isRestoredSession.current = false;
        lastMessageContentLength.current = 0;
        previousContentLengthRef.current = 0;
        // Check Zustand store for in-progress name submission rendering
        const nameResponseState = useAvaNameResponseStore.getState();
        if (
          nameResponseState.status === "rendering" &&
          nameResponseState.sessionId === sessionId &&
          nameResponseState.messages.length > 0
        ) {
          console.log(
            "🔁 Resuming name submission rendering via Zustand store"
          );
          const storedName = nameResponseState.userName || "";
          if (storedName) {
            setUserName(storedName);
            setMessages((prev) => {
              const hasUserNameMessage = prev.some(
                (msg) => msg.role === "user" && msg.content === storedName
              );
              if (hasUserNameMessage) return prev;
              return [
                ...prev,
                {
                  id: `msg-${Date.now()}`,
                  role: "user",
                  content: storedName,
                  timestamp: new Date(),
                  isName: true, // Mark as name message for reliable identification
                },
              ];
            });
          }
          setStage("processing-name");
          setIsSubmitting(true);
          try {
            await showIntroMessagesFromAPI(
              nameResponseState.messages,
              nameResponseState.videoUrl
            );
          } finally {
            setIsSubmitting(false);
          }
          hasInitialized.current = true;
          return;
        }

        // Check for Activate Now messages from session creation
        // CRITICAL: Check localStorage FIRST for persistence across page refreshes
        // This ensures messages persist even when Submit Name API refreshes the page
        let activateMessages: string[] | null = null;
        let activateMessagesStr: string | null = null;

        // First, try to get from localStorage (persistent storage)
        if (currentWorkspace?.id && sessionId) {
          const activateNowKey = `activate-now-messages-${currentWorkspace.id}-${sessionId}`;
          try {
            const storedData = localStorage.getItem(activateNowKey);
            if (storedData) {
              const parsed = JSON.parse(storedData);
              if (
                parsed.messages &&
                Array.isArray(parsed.messages) &&
                parsed.messages.length > 0
              ) {
                activateMessages = parsed.messages;
                console.log(
                  "💾 Found Activate Now messages in localStorage for session:",
                  parsed.messages.length,
                  "messages"
                );
              }
            }
          } catch (e) {
            console.warn("Failed to parse localStorage activate messages:", e);
          }
        }

        // Fallback to sessionStorage if not found in localStorage
        if (!activateMessages) {
          activateMessagesStr = sessionStorage.getItem("activate-now-messages");
          const activateInProgress = sessionStorage.getItem(
            "activate-now-in-progress"
          );
          const activateSessionId = sessionStorage.getItem(
            "activate-now-session-id"
          );

          // If refresh happened during rendering, clear state only if session ID doesn't match
          // This allows the messages to re-render if user refreshes after API call
          if (
            activateInProgress === "true" &&
            activateSessionId !== sessionId
          ) {
            console.log(
              "🔄 Page was refreshed - session ID mismatch, clearing sessionStorage state"
            );
            sessionStorage.removeItem("activate-now-in-progress");
            sessionStorage.removeItem("activate-now-messages");
            sessionStorage.removeItem("activate-now-messages-total");
            sessionStorage.removeItem("activate-now-messages-displayed");
            sessionStorage.removeItem("activate-now-session-id");
          }

          // If we have messages in sessionStorage for this session, use them
          if (activateMessagesStr && activateSessionId === sessionId) {
            try {
              const parsedMessages = JSON.parse(activateMessagesStr);
              if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
                activateMessages = parsedMessages;
                console.log(
                  "📝 Found Activate Now messages in sessionStorage for session:",
                  activateMessages.length,
                  "messages"
                );
              }
            } catch (e) {
              console.warn(
                "Failed to parse sessionStorage activate messages:",
                e
              );
            }
          }
        }

        // If we have messages (from localStorage or sessionStorage), render them as a single chunk
        // This handles refresh scenarios - messages will re-render without calling API again
        if (activateMessages && activateMessages.length > 0) {
          // CRITICAL: Check sessionStorage for activate-now-in-progress flag to determine behavior
          // - If 'true': This is the FIRST render after clicking "Activate Now" → Show typing indicator
          // - If 'false' or missing: This is a REFRESH scenario → Restore immediately without typing
          const activateInProgress = sessionStorage.getItem(
            "activate-now-in-progress"
          );
          const activateSessionId = sessionStorage.getItem(
            "activate-now-session-id"
          );
          // Only treat as fresh click if in-progress is 'true' AND session ID matches
          // Otherwise, it's a refresh scenario and we should restore immediately
          const isFreshClick =
            activateInProgress === "true" && activateSessionId === sessionId;
          const isRefresh = !isFreshClick;

          console.log(
            "🎬 Rendering Activate Now messages:",
            activateMessages.length,
            "messages"
          );
          console.log(`   - activate-now-in-progress: ${activateInProgress}`);
          console.log(`   - activate-now-session-id: ${activateSessionId}`);
          console.log(`   - current sessionId: ${sessionId}`);
          console.log(
            `   - Mode: ${
              isRefresh
                ? "REFRESH (restore immediately)"
                : "FRESH CLICK (show typing)"
            }`
          );

          // CRITICAL: For fresh clicks, show typing indicator IMMEDIATELY to prevent blank screen
          // This ensures user sees "AVA is typing" right away instead of blank screen
          if (!isRefresh) {
            setIsTyping(true);
          }

          // Render messages as single chunk
          // isRefresh=true: restore immediately (no typing), isRefresh=false: show typing and render progressively
          renderActivateNowMessages(activateMessages, isRefresh);
          // Ensure typing indicator is cleared after rendering (safety check)
          if (isRefresh) {
            setIsTyping(false);
          }
          return; // Don't show default intro
        }

        // Fallback: Check for initial message from session creation
        const storageKey = `ava-session-state-${currentWorkspace.id}`;
        const savedSession = localStorage.getItem(storageKey);
        let initialMessage = null;
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            initialMessage = parsed.initialMessage;
            if (initialMessage) {
              console.log("📝 Found initial message from session creation");
            }
          } catch (e) {
            console.warn("Failed to parse saved session:", e);
          }
        }
        showIntroMessage(initialMessage);
      }

      hasInitialized.current = true;
    };

    initializeChat();
  }, [currentWorkspace?.id, sessionId]);

  // Safety check: Clear typing indicator if messages exist and we're not actively processing
  useEffect(() => {
    if (messages.length > 0 && !isSubmitting && stage !== "processing-name") {
      // If we have messages but typing indicator is still showing, clear it
      // This handles edge cases where typing indicator might not have been cleared properly
      if (isTyping) {
        console.log(
          "🔧 Safety check: Clearing typing indicator - messages exist and not processing"
        );
        setIsTyping(false);
      }
    }
  }, [messages.length, isSubmitting, stage, isTyping]);

  // Save messages on component unmount (important for sign-out scenarios)
  useEffect(() => {
    return () => {
      if (sessionId && messages.length > 0) {
        console.log("💾 Component unmounting - saving conversation...");
        // Use synchronous XHR to ensure save completes
        const token = localStorage.getItem("accessToken");
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `${API_BASE_URL}/ava-sessions/${sessionId}/conversation-history`,
          false
        );
        xhr.setRequestHeader("Content-Type", "application/json");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        try {
          xhr.send(JSON.stringify({ messages }));
          console.log("✅ Saved on unmount");
        } catch (e) {
          console.error("Failed to save on unmount:", e);
        }
      }
    };
  }, [sessionId, messages]);

  // Helper to add message with typing animation
  const addMessage = async (message: MessageType, delay: number = 1000) => {
    setIsTyping(true);
    
    await new Promise((resolve) => setTimeout(resolve, delay));
    setIsTyping(false);
    setMessages((prev) => {
      // Check if message already exists to prevent duplicates
      const exists = prev.some(
        (m) =>
          m.id === message.id ||
          (!message.allowDuplicateContent &&
            m.role === message.role &&
            m.content === message.content &&
            (!m.videoUrl || m.videoUrl === message.videoUrl))
      );
      if (exists) {
        console.log(
          "⚠️ Duplicate message detected, skipping:",
          message.content?.substring(0, 50)
        );
        return prev;
      }
      return [...prev, message];
    });
    
    // Don't auto-scroll when AVA responds - show start of response, let user scroll manually
    // Only scroll to top when user submits (handled in handleSubmit)
  };

  const addMessageImmediate = (message: MessageType) => {
    setMessages((prev) => {
      const exists = prev.some(
        (m) =>
          m.id === message.id ||
          (!message.allowDuplicateContent &&
            m.role === message.role &&
            m.content === message.content &&
            ((!m.videoUrl && !message.videoUrl) ||
              m.videoUrl === message.videoUrl))
      );
      if (exists) {
        return prev;
      }
      return [...prev, message];
    });
    
    // Don't auto-scroll when AVA responds - show start of response, let user scroll manually
  };

  // Render Activate Now messages as a single chunk
  // isRefresh: true when restoring from refresh (render immediately), false when first click (show typing and render progressively)
  const renderActivateNowMessages = async (
    messages: string[],
    isRefresh: boolean = false
  ) => {
    console.log(
      "🎬 Rendering Activate Now messages as single chunk:",
      messages.length,
      "messages",
      isRefresh ? "(refresh restore)" : "(initial click)"
    );

    // Combine all messages into one HTML chunk
    const combinedMessage = messages.join("");
    console.log("✅ Combined", messages.length, "messages into single chunk");

    if (isRefresh) {
      // When refreshing, restore immediately without typing indicator
      console.log(
        "💾 Restoring Activate Now messages immediately (refresh scenario)"
      );

      // Clear any existing messages with activate-msg prefix to avoid duplicates (only for refresh)
      setMessages((prev) => {
        const filtered = prev.filter(
          (msg) => !msg.id?.startsWith("activate-msg-")
        );
        const activateMessageId = `activate-msg-restored-${sessionId}-${Date.now()}`;
        // Check if message already exists
        const exists = filtered.some(
          (msg) => msg.role === "ava" && msg.content === combinedMessage
        );
        if (exists) {
          console.log(
            "ℹ️ Activate Now message already exists, skipping restore"
          );
          return filtered;
        }
        // Prepend to the beginning to ensure it appears at the top
        return [
          {
            id: activateMessageId,
            role: "ava",
            content: combinedMessage,
            timestamp: new Date(),
          },
          ...filtered,
        ];
      });
    } else {
      // When first clicking "Activate Now", show typing indicator FIRST, then render messages
      console.log(
        "⏳ Fresh click: Showing typing indicator FIRST, then rendering Activate Now messages"
      );

      // CRITICAL: For fresh clicks, ensure messages array is empty first
      // Clear any existing messages with activate-msg prefix (shouldn't be any, but safety check)
      setMessages((prev) =>
        prev.filter((msg) => !msg.id?.startsWith("activate-msg-"))
      );

      // Show typing indicator immediately - this is the FIRST thing user sees
      setIsTyping(true);

      // Wait with typing indicator showing before displaying (simulates API processing time)
      // This gives users visual feedback that something is happening
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Hide typing indicator and display all messages as one chunk
      console.log("🎬 Rendering combined message chunk after typing animation");
      setIsTyping(false);

      // Use addMessageImmediate to avoid double typing indicator (since we already showed it)
      const activateMessageId = `activate-msg-${Date.now()}`;
      addMessageImmediate({
        id: activateMessageId,
        role: "ava",
        content: combinedMessage,
        timestamp: new Date(),
      });
    }

    // Mark as fully displayed and clear sessionStorage (no need to track progress for single chunk)
    sessionStorage.setItem("activate-now-in-progress", "false");
    sessionStorage.removeItem("activate-now-messages-total");
    sessionStorage.removeItem("activate-now-messages-displayed");

    console.log("✅ Activate Now messages rendered as single chunk");
  };

  // Show intro message - separate blocks
  const showIntroMessage = async (initialMessage?: string | null) => {
    if (initialMessage) {
      // Use the HTML-formatted message from the API
      console.log(
        "📝 Using initial message from API:",
        initialMessage.substring(0, 100)
      );
      await addMessage(
        {
          id: `msg-intro-${Date.now()}`,
          role: "ava",
          content: initialMessage, // This will be detected as HTML and rendered properly
          timestamp: new Date(),
        },
        1500
      );
    } else {
      // Fallback to hardcoded messages if no initial message
      await addMessage(
        {
          id: `msg-${Date.now()}`,
          role: "ava",
          content:
            "Hi! I'm A.V.A. (Audience Values Accelerator), an elite-level AI specifically engineered to help online coaches, course creators, and consultants achieve unprecedented clarity about their ideal clients.",
          timestamp: new Date(),
        },
        1500
      );

      await addMessage(
        {
          id: `msg-${Date.now()}`,
          role: "ava",
          content:
            "I go far beyond typical audience profiling, delivering deep psychological and psychographic analysis. My insights uncover hidden motivations, subconscious desires, emotional barriers, and decision-making triggers, empowering you to resonate powerfully with your ideal clients.",
          timestamp: new Date(),
        },
        1000
      );

      await addMessage(
        {
          id: `msg-${Date.now()}`,
          role: "ava",
          content: "What's your name?",
          timestamp: new Date(),
        },
        800
      );
    }

    // Ensure typing indicator is cleared after all intro messages are shown
    setIsTyping(false);
    setStage("awaiting-name");
  };

  const isReadyToMoveOnStage = stage === "showing-intro";

  // Handle form submission (name or answer)
  const handleSubmit = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSubmitting) return;

    if (stage === "awaiting-name" || stage === "intro") {
      await handleNameSubmit(trimmed);
    } else if (stage === "questions") {
      await handleAnswerSubmit(trimmed);
    }
  };

  // Handle name submission
  const ensureUserNameMessage = (name: string, forceNew: boolean = false) => {
    setMessages((prev) => {
      const hasUserNameMessage = prev.some(
        (msg) => msg.role === "user" && msg.content === name
      );
      if (hasUserNameMessage && !forceNew) return prev;
      return [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: "user",
          content: name,
          timestamp: new Date(),
          isName: true, // Mark as name message for reliable identification
        },
      ];
    });
  };

  const executeNameSubmission = async (
    name: string,
    options?: { renderedCount?: number; videoShown?: boolean }
  ) => {
    if (!sessionId) {
      throw new Error(
        "Session ID is missing. Please refresh the page and try again."
      );
    }

    console.log(
      "📤 Calling updateSessionName API for session:",
      sessionId,
      "with name:",
      name
    );
    console.log(
      "📤 API URL:",
      `${API_BASE_URL}/ava-sessions/${sessionId}/name`
    );

    const response: SubmitNameResponse = await updateSessionName(
      sessionId,
      name
    );
    console.log("✅ Name submission API response received:", response);

    if (!response) {
      throw new Error("No response received from API");
    }

    setUserName(name);
    // Immediately report userName change to parent for header update
    if (onUserNameChange) {
      onUserNameChange(name);
    }
    setVideoUrl(response.videoUrl || AVA_DEFAULT_INTRO_VIDEO_URL);

    const messageArray = Array.isArray(response.message)
      ? response.message
      : typeof response.message === "string"
      ? [response.message]
      : null;

    if (messageArray && messageArray.length > 0) {
      try {
        useAvaNameResponseStore.getState().setPayload({
          sessionId,
          userName: name,
          messages: messageArray,
          videoUrl: response.videoUrl,
          renderedCount: options?.renderedCount ?? 0,
          videoShown: options?.videoShown ?? false,
        });
      } catch (storageError: any) {
        // If storage fails due to quota, log warning but continue
        // The messages will still be displayed, just won't be persisted
        console.warn(
          "⚠️ Failed to persist name response to storage:",
          storageError
        );
        if (storageError.message?.includes("quota")) {
          console.warn(
            "⚠️ Storage quota exceeded, continuing without persistence"
          );
        }
      }
      await showIntroMessagesFromAPI(messageArray, response.videoUrl);
    } else {
      console.log("⚠️ Unexpected message format, using fallback");
      resetNameResponseStore();
      await showIntroMessages(name, response.videoUrl);
    }
  };

  const handleNameSubmit = async (name: string) => {
    console.log(
      "🔄 Name submission started - clearing any previous state to start fresh from index 0"
    );
    const isRetrigger =
      sessionStorage.getItem("name-submission-retrigger") === "true";
    resetNameSubmissionProgress({
      preserveName: isRetrigger,
      preserveSession: isRetrigger,
      preserveStore: true,
    });
    if (isRetrigger) {
      sessionStorage.removeItem("name-submission-retrigger");
    }

    sessionStorage.setItem("name-submission-in-progress", "true");
    sessionStorage.setItem("name-submission-stored-name", name);
    if (sessionId) {
      sessionStorage.setItem("name-submission-session-id", sessionId);
    }

    // Clear any existing name-submit messages or duplicate name entries to avoid duplicates
    setMessages((prev) =>
      prev.filter((msg) => !msg.id?.startsWith("name-submit-msg-"))
    );

    ensureUserNameMessage(name, true);
    setInputValue("");
    setIsSubmitting(true);
    setStage("processing-name");

    try {
      await executeNameSubmission(name);
    } catch (error: any) {
      console.error("❌ Failed to submit name:", error);
      console.error("❌ Error details:", {
        message: error.message,
        stack: error.stack,
        sessionId: sessionId,
        name: name,
      });

      resetNameSubmissionProgress();
      resetNameResponseStore();

      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to submit name. Please check console for details.",
        variant: "destructive",
      });
      onError?.(error.message);
      setStage("awaiting-name");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    handleNameSubmitRef.current = handleNameSubmit;
  });

  useEffect(() => {
    if (!sessionId) return;
    if (!shouldRetriggerNameSubmit.current) return;
    if (hasRetriggeredNameSubmit.current) return;

    const storedSessionId = sessionStorage.getItem(
      "name-submission-session-id"
    );
    if (storedSessionId && storedSessionId !== sessionId) {
      console.log(
        "⚠️ Stored name submission session mismatch. Clearing state."
      );
      shouldRetriggerNameSubmit.current = null;
      resetNameSubmissionProgress();
      return;
    }

    const nameToSubmit = shouldRetriggerNameSubmit.current;
    if (!nameToSubmit) return;

    console.log(
      "🔄 Retriggering name submission API with stored name:",
      nameToSubmit
    );
    hasRetriggeredNameSubmit.current = true;
    shouldRetriggerNameSubmit.current = null;

    setTimeout(() => {
      handleNameSubmitRef.current?.(nameToSubmit);
    }, 300);
  }, [sessionId]);

  // Show intro messages from API response progressively with refresh recovery
  const showIntroMessagesFromAPI = async (
    messages: string[],
    videoUrl?: string
  ) => {
    console.log(
      "🎬 Rendering name submission API response messages:",
      messages.length,
      "messages"
    );

    // CRITICAL: Ensure Activate Now messages are restored first so they appear at the top
    // This is especially important when resuming after a refresh during Submit Name API response
    restoreActivateNowMessages();

    const resolvedVideoUrl = videoUrl?.trim() || AVA_DEFAULT_INTRO_VIDEO_URL;
    const store = useAvaNameResponseStore.getState();
    if (store.status === "idle" || store.sessionId !== sessionId) {
      store.setPayload({
        sessionId,
        userName: userName || store.userName || "",
        messages,
        videoUrl: resolvedVideoUrl,
      });
    }

    const totalMessages = messages.length;
    const alreadyDisplayed = store.renderedCount;
    const hasCompletedPreviously =
      alreadyDisplayed >= totalMessages && totalMessages > 0;
    const startIdx = hasCompletedPreviously ? totalMessages : alreadyDisplayed;
    const isResuming = startIdx > 0;

    if (isResuming) {
      console.log(`🔁 Rehydrating ${startIdx} intro messages from store`);
      for (let idx = 0; idx < startIdx; idx++) {
        addMessageImmediate({
          id: `name-submit-cached-${idx}`,
          role: "ava",
          content: messages[idx],
          timestamp: new Date(),
          model: "claude-sonnet-4-20250514",
        });
      }
      sessionStorage.setItem(
        "name-submission-messages-displayed",
        String(startIdx)
      );
    } else {
      sessionStorage.setItem("name-submission-messages-displayed", "0");
    }

    if (!hasCompletedPreviously) {
      await new Promise((resolve) =>
        setTimeout(resolve, isResuming ? 500 : 1000)
      );

      for (let idx = startIdx; idx < totalMessages; idx++) {
        const msgHtml = messages[idx];
        await addMessage(
          {
            id: `name-submit-msg-${idx}-${Date.now()}`,
            role: "ava",
            content: msgHtml,
            timestamp: new Date(),
            model: "claude-sonnet-4-20250514",
          },
          idx === startIdx ? 500 : 800
        );

        sessionStorage.setItem(
          "name-submission-messages-displayed",
          String(idx + 1)
        );
        useAvaNameResponseStore.getState().incrementRendered();
        console.log(
          `✅ Rendered name submission message ${idx + 1}/${totalMessages}`
        );

        if (idx < totalMessages - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    const videoShown = useAvaNameResponseStore.getState().videoShown;
    if (resolvedVideoUrl && !videoShown) {
      await addMessage(
        {
          id: `msg-${Date.now()}`,
          role: "ava",
          content:
            "Before we proceed, please watch this video to understand the process:",
          timestamp: new Date(),
          videoUrl: resolvedVideoUrl,
        },
        1000
      );
      useAvaNameResponseStore.getState().markVideoShown();
    }

    useAvaNameResponseStore.getState().markComplete();
    resetNameSubmissionProgress();

    console.log("✅ Name submission messages rendered completely");
    setStage("showing-intro");
    // Don't start Phase 1 automatically - wait for user to click Confirm button
  };

  // Show intro messages after name submission (fallback)
  const showIntroMessages = async (name: string, videoUrl?: string) => {
    resetNameResponseStore();
    const fallbackMessages = buildAvaFallbackIntroMessages(name);

    for (let idx = 0; idx < fallbackMessages.length; idx++) {
      await addMessage(
        {
          id: `msg-${Date.now()}-${idx}`,
          role: "ava",
          content: fallbackMessages[idx],
          timestamp: new Date(),
        },
        idx === 0 ? 800 : 1000
      );
    }

    const resolvedVideoUrl = videoUrl?.trim() || AVA_DEFAULT_INTRO_VIDEO_URL;
    if (resolvedVideoUrl) {
      await addMessage(
        {
          id: `msg-${Date.now()}`,
          role: "ava",
          content:
            "Before we proceed, please watch this video to understand the process:",
          timestamp: new Date(),
          videoUrl: resolvedVideoUrl,
        },
        1000
      );
    }

    // Set stage to showing-intro and wait for user to click Confirm button
    setStage("showing-intro");
    resetNameSubmissionProgress();
  };

  // Helper function to format question with section header
  const formatQuestionWithSection = (question: Phase1Question): string => {
    const sectionHeader = `<strong>Section ${question.sectionId}: ${question.sectionTitle}</strong>`;
    const questionText = `<strong>${question.id}. ${question.text}</strong>`;
    return `${sectionHeader}<br><br>${questionText}`;
  };

  // Start Phase 1 questions
  const startPhase1Questions = async () => {
    setIsSubmitting(true);
    setIsTyping(true); // Show typing indicator while loading question from API
    try {
      const response: StartPhase1Response = await startPhase1(sessionId);
      setCurrentQuestion(response.question);
      setProgress(response.progress);
      setStage("questions");

      // Backend already returns 1-based question number (currentQuestionIndex + 1)
      // So we use it directly without adding 1
      const questionNum = response.progress.current || 1;
      // Format question with section header
      const formattedQuestion = formatQuestionWithSection(response.question);
      // addMessage will manage typing indicator during message animation
      await addMessage(
        {
          id: `msg-${Date.now()}`,
          role: "ava",
          content: formattedQuestion,
          timestamp: new Date(),
          isQuestion: true,
          questionNumber: questionNum,
          totalQuestions: response.progress.total,
          examples: response.examples || [],
          sectionTitle: response.question.sectionTitle,
          videoUrl: response.question.videoUrl,
          model: "claude-sonnet-4-20250514",
        },
        1000
      );
    } catch (error: any) {
      console.error("Failed to start Phase 1:", error);
      setIsTyping(false); // Hide typing indicator on error
      toast({
        title: "Error",
        description: error.message || "Failed to start Phase 1",
        variant: "destructive",
      });
      onError?.(error.message);
      setStage("intro");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to strip HTML tags and normalize text for comparison
  const stripHtmlAndNormalize = (text: string): string => {
    // Remove HTML tags
    const withoutHtml = text.replace(/<[^>]*>/g, "");
    // Decode HTML entities
    const decoded = withoutHtml
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    // Normalize whitespace and trim
    return decoded.replace(/\s+/g, " ").trim().toLowerCase();
  };

  // Helper function to check if answer matches question text
  const isAnswerSameAsQuestion = (
    answer: string,
    question: Phase1Question | null
  ): boolean => {
    if (!question) return false;

    const normalizedAnswer = stripHtmlAndNormalize(answer);
    const normalizedQuestionText = stripHtmlAndNormalize(question.text);

    // Check if answer exactly matches question text
    if (normalizedAnswer === normalizedQuestionText) {
      return true;
    }

    // Check if answer matches question with number prefix (e.g., "1. question text")
    const questionWithNumber = stripHtmlAndNormalize(
      `${question.id}. ${question.text}`
    );
    if (normalizedAnswer === questionWithNumber) {
      return true;
    }

    // Check if answer matches formatted question (with section header)
    const formattedQuestion = formatQuestionWithSection(question);
    const normalizedFormattedQuestion =
      stripHtmlAndNormalize(formattedQuestion);
    if (normalizedAnswer === normalizedFormattedQuestion) {
      return true;
    }

    return false;
  };

  // Handle answer submission
  const handleAnswerSubmit = async (answer: string) => {
    // Validate: Check if answer matches the question text
    // First check currentQuestion state
    if (isAnswerSameAsQuestion(answer, currentQuestion)) {
      setValidationError(
        "Please provide your own answer. You cannot submit the question text as your answer."
      );
      // Also show toast for additional visibility
      toast({
        title: "Invalid Answer",
        description:
          "Please provide your own answer. You cannot submit the question text as your answer.",
        variant: "destructive",
      });
      return; // Prevent submission
    }

    // Also check the last question message in conversation as fallback
    const lastQuestionMessage = messages
      .filter((msg) => msg.isQuestion && msg.role === "ava")
      .pop();

    if (lastQuestionMessage) {
      const normalizedAnswer = stripHtmlAndNormalize(answer);
      const normalizedQuestionContent = stripHtmlAndNormalize(
        lastQuestionMessage.content
      );

      // Check if answer matches the question content from messages
      if (normalizedAnswer === normalizedQuestionContent) {
        setValidationError(
          "Please provide your own answer. You cannot submit the question text as your answer."
        );
        // Also show toast for additional visibility
        toast({
          title: "Invalid Answer",
          description:
            "Please provide your own answer. You cannot submit the question text as your answer.",
          variant: "destructive",
        });
        return; // Prevent submission
      }
    }

    // Clear validation error if answer is valid
    setValidationError(null);

    // Add user answer to chat
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        role: "user",
        content: answer,
        timestamp: new Date(),
      },
    ]);
    setInputValue("");
    setValidationError(null); // Clear any validation errors on successful submission
    setIsSubmitting(true);
    setIsTyping(true); // Show typing indicator

    // Scroll will be handled by useEffect watching messages

    // CRITICAL: Set awaiting question state BEFORE submitting answer
    // This ensures we can recover if user refreshes during the typing period
    if (sessionId) {
      // Store the current question number (the one being answered)
      // The next question will be current + 1
      setAwaitingQuestionState({
        sessionId,
        questionNumber: progress.current || 0,
        timestamp: Date.now(),
      });
    }

    try {
      const response = await submitAnswer(sessionId, answer);

      console.log("📥 Answer submitted, response:", response);

      // Check if Phase 1 is complete
      if (
        response.isPhaseComplete ||
        response.phase2AutoStarted ||
        response.nextAction === "start_phase2"
      ) {
        // Phase 1 is complete - show completion message
        await addMessage(
          {
            id: `msg-${Date.now()}`,
            role: "ava",
            content: `Amazing work, ${userName}! 🎉 You've completed all 27 questions. All answers are saved to the database.`,
            timestamp: new Date(),
          },
          1000
        );

        if (response.videoUrl) {
          await addMessage(
            {
              id: `msg-${Date.now()}`,
              role: "ava",
              content:
                "Phase 1 is now complete. Watch this video to learn about Phase 2:",
              timestamp: new Date(),
              videoUrl: response.videoUrl,
            },
            1200
          );
        }

        // DON'T clear persistence - conversation history should persist!
        // Phase 2 will load these messages from backend
        console.log(
          "✅ Phase 1 complete - conversation history preserved for Phase 2"
        );

        // Set stage to complete
        setStage("complete");
        clearAwaitingQuestionState();

        // Auto-scroll to "Start Phase 2" button immediately - no delay
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Try to find the button by ref first
            if (startPhase2ButtonRef.current) {
              startPhase2ButtonRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "nearest",
              });
              console.log("📜 Scrolled to Start Phase 2 button");
            } else {
              // Fallback: wait for button to render, then scroll
              const scrollToButton = () => {
                const buttons = Array.from(document.querySelectorAll("button"));
                const startPhase2Button = buttons.find((btn) =>
                  btn.textContent?.trim().includes("Start Phase 2")
                );
                if (startPhase2Button) {
                  startPhase2Button.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                  });
                  console.log(
                    "📜 Scrolled to Start Phase 2 button (found by text)"
                  );
                  return true;
                }
                return false;
              };

              // Try immediately
              if (!scrollToButton()) {
                // Retry with short delays if button not found
                setTimeout(() => {
                  if (!scrollToButton()) {
                    setTimeout(scrollToButton, 300);
                  }
                }, 100);
              }
            }
          });
        });
      } else {
        // Show motivational message if available
        if (response.motivationalMessage) {
          // Keep typing indicator on continuously - it's already on from line 1863
          // addMessage will manage it, but we need to ensure it stays on
          // Add the message with delay, but keep typing indicator on
          setIsTyping(true); // Ensure it stays on
          await new Promise((resolve) => setTimeout(resolve, 800)); // Wait for message display delay
          setMessages((prev) => {
            const message: MessageType = {
              id: `msg-motivational-${Date.now()}`,
              role: "ava",
              content: response.motivationalMessage!,
              timestamp: new Date(),
              allowDuplicateContent: true,
              model: "claude-sonnet-4-20250514",
            };
            // Check if message already exists to prevent duplicates
            const exists = prev.some(
              (m) =>
                m.id === message.id ||
                (!message.allowDuplicateContent &&
                  m.role === message.role &&
                  m.content === message.content)
            );
            if (exists) {
              console.log(
                "⚠️ Duplicate motivational message detected, skipping"
              );
              return prev;
            }
            return [...prev, message];
          });
          // Keep typing indicator on - loadNextQuestion will manage it
        } else {
          // No motivational message, so we can turn off typing indicator now
          setIsTyping(false);
        }

        // Get next question (this will manage the typing indicator)
        await loadNextQuestion();
      }
    } catch (error: any) {
      console.error("Failed to submit answer:", error);
      clearAwaitingQuestionState();
      setIsTyping(false); // Hide typing indicator on error
      toast({
        title: "Error",
        description: error.message || "Failed to submit answer",
        variant: "destructive",
      });
      onError?.(error.message);
    } finally {
      setIsSubmitting(false);
      // Don't turn off typing indicator here if motivational message is being displayed
      // The addMessage function or loadNextQuestion will handle it
    }
  };

  // Load next question from backend
  const loadNextQuestion = async () => {
    setIsTyping(true); // Show typing indicator while loading next question from API
    try {
      const token = localStorage.getItem("accessToken");

      const questionResponse = await fetch(
        `${API_BASE_URL}/ava-sessions/${sessionId}/current-question`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      if (!questionResponse.ok) {
        throw new Error("Failed to fetch next question");
      }

      const questionData = await questionResponse.json();
      const nextQ = questionData.data || questionData;

      console.log("✅ Next question fetched:", nextQ);

      if (nextQ.question) {
        setCurrentQuestion(nextQ.question);
        setProgress(nextQ.progress || progress);

        // Format question with section header
        const formattedQuestion = formatQuestionWithSection(nextQ.question);

        // Show next question after 1 second delay
        // Backend already returns 1-based question number (currentQuestionIndex + 1)
        // So we use it directly without adding 1
        await addMessage(
          {
            id: `msg-${Date.now()}`,
            role: "ava",
            content: formattedQuestion,
            timestamp: new Date(),
            isQuestion: true,
            questionNumber: nextQ.progress?.current || 1, // Backend already returns 1-based
            totalQuestions: nextQ.progress?.total || 27,
            examples: nextQ.examples || [],
            sectionTitle: nextQ.question.sectionTitle,
            videoUrl: nextQ.question.videoUrl,
            model: "claude-sonnet-4-20250514",
          },
          1000
        ); // 1 second delay before showing next question
        clearAwaitingQuestionState();
      }
    } catch (error: any) {
      console.error("Failed to fetch next question:", error);
      setIsTyping(false); // Hide typing indicator on error
      toast({
        title: "Error",
        description: "Failed to load next question",
        variant: "destructive",
      });
    }
  };
  loadNextQuestionRef.current = loadNextQuestion;

  useEffect(() => {
    if (!sessionId || stage !== "questions") return;
    if (
      pendingQuestionRestoreRef.current ||
      hasAttemptedQuestionRecovery.current
    )
      return;

    // Check if last message is a user answer without a next question
    // This handles the case where user refreshed after submitting answer but before next question loaded
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const isLastMessageUserAnswer = lastMessage?.role === "user";

      // Find the last question in the messages
      const lastQuestionIndex = messages
        .map((msg, idx) => (msg.isQuestion && msg.role === "ava" ? idx : -1))
        .filter((idx) => idx >= 0)
        .pop();

      // Check if there's a question after the last user answer
      const lastUserAnswerIndex = isLastMessageUserAnswer
        ? messages.length - 1
        : -1;
      const hasQuestionAfterLastAnswer =
        lastQuestionIndex !== undefined &&
        lastQuestionIndex > lastUserAnswerIndex;

      // If last message is user answer and no question after it, we need to load next question
      if (isLastMessageUserAnswer && !hasQuestionAfterLastAnswer) {
        console.log(
          "🔄 Detected user answer without next question - loading next question..."
        );
        pendingQuestionRestoreRef.current = true;
        hasAttemptedQuestionRecovery.current = true;

        // Set awaiting question state based on current progress
        if (progress.current > 0) {
          setAwaitingQuestionState({
            sessionId,
            questionNumber: progress.current,
            timestamp: Date.now(),
          });
        }

        loadNextQuestionRef.current?.().finally(() => {
          pendingQuestionRestoreRef.current = false;
        });
        return;
      }
    }

    // Original logic: Check awaitingQuestionState from sessionStorage
    const awaitingState = getAwaitingQuestionState();
    if (!awaitingState || awaitingState.sessionId !== sessionId) return;

    const expectedQuestionNumber = (awaitingState.questionNumber || 0) + 1;
    const hasQuestionRendered = messages.some(
      (msg) => msg.isQuestion && msg.questionNumber === expectedQuestionNumber
    );

    if (hasQuestionRendered) {
      clearAwaitingQuestionState();
      return;
    }

    console.log(
      "🔄 Detected pending question after refresh. Resuming fetch..."
    );
    pendingQuestionRestoreRef.current = true;
    hasAttemptedQuestionRecovery.current = true;
    loadNextQuestionRef.current?.().finally(() => {
      pendingQuestionRestoreRef.current = false;
    });
  }, [sessionId, stage, messages, progress]);

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Helper function to auto-resize textarea
  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${Math.max(44, newHeight)}px`;
    
    // Smooth scroll to bottom when content is added
    if (textarea.scrollHeight > textarea.clientHeight) {
      requestAnimationFrame(() => {
        textarea.scrollTo({
          top: textarea.scrollHeight,
          behavior: "smooth"
        });
      });
    }
  };

  // Handle example selection
  const handleExampleClick = (example: string) => {
    setInputValue(example);
    // Trigger resize after value is set (use setTimeout to ensure DOM is updated)
    setTimeout(() => {
      if (inputRef.current) {
        resizeTextarea(inputRef.current);
        // Smooth scroll to bottom when example is selected
        requestAnimationFrame(() => {
          if (inputRef.current && inputRef.current.scrollHeight > inputRef.current.clientHeight) {
            inputRef.current.scrollTo({
              top: inputRef.current.scrollHeight,
              behavior: "smooth"
            });
          }
        });
      }
    }, 0);
    inputRef.current?.focus();
  };

  // Auto-resize textarea when inputValue changes (handles programmatic updates like example clicks)
  useEffect(() => {
    if (inputRef.current) {
      resizeTextarea(inputRef.current);
      // Smooth scroll to bottom when inputValue changes programmatically
      requestAnimationFrame(() => {
        if (inputRef.current && inputRef.current.scrollHeight > inputRef.current.clientHeight) {
          inputRef.current.scrollTo({
            top: inputRef.current.scrollHeight,
            behavior: "smooth"
          });
        }
      });
    }
  }, [inputValue]);

  // Handle edit answer
  const handleEditAnswer = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditedContent(currentContent);
  };

  // Handle save edited answer
  const handleSaveEdit = async (messageId: string) => {
    if (!editedContent.trim()) {
      toast({
        title: "Error",
        description: "Answer cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsSavingEdit(true);
    try {
      // Update the message in the messages array and get updated messages
      let updatedMessages: MessageType[] = [];
      setMessages((prev) => {
        updatedMessages = prev.map((msg) =>
          msg.id === messageId ? { ...msg, content: editedContent.trim() } : msg
        );
        return updatedMessages;
      });

      // Save to conversation history
      if (sessionId && updatedMessages.length > 0) {
        await saveConversationHistory(sessionId, updatedMessages);
      }

      setEditingMessageId(null);
      setEditedContent("");

      toast({
        title: "Saved",
        description: "Your answer has been updated successfully",
      });
    } catch (error: any) {
      console.error("Failed to save edit:", error);
      toast({
        title: "Save Failed",
        description: error?.message || "Failed to save your edit",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditedContent("");
  };

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyAnswer = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      toast({
        title: "Copied!",
        description: "Answer copied to clipboard",
      });
      // Reset checkmark after 2 seconds
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Check if a user message is an answer (not the name)
  const isAnswerMessage = (msg: MessageType, msgIndex: number): boolean => {
    // It's an answer if:
    // 1. It's a user message
    // 2. Stage is questions or complete (after name submission)
    // 3. There's a question message before this user message in the conversation
    if (
      msg.role !== "user" ||
      (stage !== "questions" && stage !== "complete")
    ) {
      return false;
    }

    // Check if there's a question message before this user message
    // This ensures we only show edit on answers, not on the name
    const messagesBeforeThis = messages.slice(0, msgIndex);
    const hasQuestionBefore = messagesBeforeThis.some(
      (m) => m.isQuestion && m.role === "ava"
    );

    // Also exclude the name message (first user message before questions start)
    // Use isName flag first (most reliable), then fallback to position check
    const isFirstUserMessage = !messagesBeforeThis.some(
      (m) => m.role === "user"
    );
    const isNameMessage =
      msg.isName === true || (!hasQuestionBefore && isFirstUserMessage);

    return hasQuestionBefore && !isNameMessage;
  };

  // Handle reset/new session
  const handleReset =
    onStartOver ||
    (async () => {
      // Fallback behavior if onStartOver is not provided
      // Cancel current session if exists
      if (sessionId) {
        try {
          await cancelAvaSession(sessionId);
          console.log("✅ Session cancelled via API");
        } catch (error) {
          console.error("❌ Failed to cancel session:", error);
        }
      }

      // Clear saved session state
      if (currentWorkspace?.id) {
        localStorage.removeItem(`ava-session-state-${currentWorkspace.id}`);
        const key = getPersistenceKey(currentWorkspace.id);
        if (key) {
          localStorage.removeItem(key);
        }
        // Clear Phase 1 and Phase 2 state
        Object.keys(localStorage).forEach((key) => {
          if (
            key.startsWith(`ava-phase1-state-${currentWorkspace.id}-`) ||
            key.startsWith(`ava-phase2-${currentWorkspace.id}-`)
          ) {
            localStorage.removeItem(key);
          }
        });
      }

      // Legacy cleanup (for backward compatibility)
      localStorage.removeItem("ava-session-state");
      localStorage.removeItem("ava-chat-session");

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
    });

  return (
    <div
      className={`flex flex-col ${
        hideHeader ? "" : "min-h-screen"
      } pb-4 relative`}
    >
      {/* Chat Messages Area - Scrollable only when header is shown, otherwise parent handles scrolling */}
      <div
        ref={scrollContainerRef}
        className={`${
          hideHeader ? "" : "flex-1 overflow-y-auto chatgpt-scrollbar"
        } px-[20%] py-8`}
        style={{ paddingBottom: "140px" }}
      >
        {/* Header - Sticky at top with scroll-based visibility - Hide when parent handles header */}
        {!hideHeader && (
          <div
            className={`sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm transition-transform duration-300 ${
              showHeader ? "translate-y-0" : "-translate-y-full"
            }`}
            style={{
              backfaceVisibility: "hidden",
              willChange: "transform",
            }}
          >
            <AVAHeader
              stage={stage === "complete" ? "complete" : "phase1"}
              userName={userName || "User"}
              progress={{
                currentQuestionIndex: Math.max(0, (progress?.current || 0) - 1),
                totalQuestions: progress?.total || 27,
              }}
              offsetClassName=""
              onReset={handleReset}
              isScrolled={isScrolled}
            />
          </div>
        )}

        <div className="w-full space-y-6">
          {/* Display all messages - filter duplicates by ID and content */}
          {messages
            .filter((msg, index, self) => {
              // Find first occurrence of message with same ID
              const idIndex = self.findIndex((m) => m.id === msg.id);
              // If IDs match, use first occurrence
              if (idIndex !== index && idIndex >= 0) return false;
              // Also check for duplicate content with same role (fallback if no ID)
              if (!msg.id) {
                const contentIndex = self.findIndex(
                  (m) =>
                    m.role === msg.role &&
                    m.content === msg.content &&
                    (!m.videoUrl || m.videoUrl === msg.videoUrl)
                );
                return contentIndex === index;
              }
              return true;
            })
            .map((msg, msgIndex, filteredArray) => {
              // Check if this is the last user message in the filtered array
              // Find all user messages in the filtered array
              const userMessagesInFiltered = filteredArray
                .map((m, idx) => m.role === "user" ? idx : -1)
                .filter(idx => idx >= 0);
              const lastUserMessageIndex = userMessagesInFiltered[userMessagesInFiltered.length - 1];
              const isLastUserMessage = msg.role === "user" && msgIndex === lastUserMessageIndex;
              
              return (
              <div
                key={`${msg.id}-${msgIndex}`}
                data-question-id={msg.isQuestion ? msg.id : undefined}
                ref={isLastUserMessage ? lastUserMessageRef : undefined}
              >
                {msg.role === "ava" ? (
                  /* AVA Message - Left Side - Avatar removed */
                  <div className="flex gap-3 items-start">
                    <div className="w-[70%]">
                      <div className=" px-4 py-3">
                        {(() => {
                          // Check if content is HTML
                          const isHTML =
                            typeof msg.content === "string" &&
                            /<[^>]+>/.test(msg.content);
                          return (
                            <div
                              className={`text-base leading-relaxed text-white font-normal tracking-wide ${
                                isHTML ? "" : "whitespace-pre-wrap"
                              }`}
                            >
                              {isHTML ? (
                                <div
                                  className="ava-message-content text-white"
                                  dangerouslySetInnerHTML={{
                                    __html: msg.content,
                                  }}
                                />
                              ) : (
                                msg.content
                              )}
                            </div>
                          );
                        })()}

                        {/* Show video if present */}
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
                                  if (privacyHash) params.set("h", privacyHash);
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
                            {/* Confirm Button - Below video when showing intro */}
                            {stage === "showing-intro" &&
                              msg.content?.includes(
                                "Before we proceed, please watch this video"
                              ) && (
                                <div className="flex justify-center mt-6 animate-fade-in">
                                  <Button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      await startPhase1Questions();
                                    }}
                                    size="lg"
                                    disabled={isSubmitting}
                                    className="w-full h-14 text-lg bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:brightness-110 transform hover:-translate-y-0.5 transition duration-300 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isSubmitting ? (
                                      <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                        Loading...
                                      </>
                                    ) : (
                                      "Ready to move on?"
                                    )}
                                  </Button>
                                </div>
                              )}
                            {/* Start Phase 2 Button - Centered below video when Phase 1 is complete */}
                            {stage === "complete" &&
                              !hideStartPhase2Button &&
                              msg.content?.includes(
                                "Phase 1 is now complete"
                              ) && (
                                <div className="flex justify-center mt-6 animate-fade-in">
                                  <Button
                                    ref={startPhase2ButtonRef}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();

                                      const scrollPayload = {
                                        scrollY: window.scrollY,
                                        scrollX: window.scrollX,
                                        timestamp: Date.now(),
                                      };

                                      sessionStorage.setItem(
                                        "ava-phase2-transition-scroll",
                                        JSON.stringify(scrollPayload)
                                      );
                                      sessionStorage.setItem(
                                        "ava-phase2-hide-phase1-messages",
                                        "true"
                                      );

                                      requestAnimationFrame(() => {
                                        window.scrollTo({
                                          top: scrollPayload.scrollY,
                                          left: scrollPayload.scrollX,
                                        });
                                      });

                                      onPhase1Complete(userName || "User");
                                    }}
                                    size="lg"
                                    className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-xl hover:scale-105 transition-all duration-200 px-8 py-6 text-lg font-semibold shadow-cyan-500/30"
                                  >
                                    Start Phase 2
                                  </Button>
                                </div>
                              )}
                          </div>
                        )}

                        {/* Show examples if present */}
                        {msg.examples && msg.examples.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-700/50">
                            <button
                              onClick={() => {
                                const currentMsgId = msg.id;
                                const isLastQuestion =
                                  messages.filter((m) => m.isQuestion).pop()
                                    ?.id === currentMsgId;
                                if (isLastQuestion) {
                                  setShowExamples(!showExamples);
                                }
                              }}
                              className="text-xs font-medium text-cyan-400 hover:text-blue-400 flex items-center gap-1 mb-2"
                            >
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  showExamples &&
                                  messages.filter((m) => m.isQuestion).pop()
                                    ?.id === msg.id
                                    ? "rotate-180"
                                    : ""
                                }`}
                              />
                              Show examples
                            </button>
                            {showExamples &&
                              messages.filter((m) => m.isQuestion).pop()?.id ===
                                msg.id && (
                                <div ref={examplesContainerRef} className="space-y-2">
                                  {msg.examples.map((example, idx) => {
                                    const isLast = idx === msg.examples.length - 1;
                                    return (
                                      <button
                                        key={idx}
                                        ref={isLast ? lastExampleRef : undefined}
                                        onClick={() =>
                                          handleExampleClick(example)
                                        }
                                        className="block w-full text-left px-3 py-2 text-sm bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-slate-200 transition-colors border border-slate-700/50"
                                      >
                                        {example}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* User Message - Right Side */
                  <div className="flex gap-3 items-start justify-end">
                    <div className="w-[70%] flex flex-col items-end gap-2">
                      {(() => {
                        // Check if this is a name message (not an answer)
                        // Use the isName flag first (most reliable), then fallback to position check
                        const messagesBeforeThis = messages.slice(0, msgIndex);
                        const hasQuestionBefore = messagesBeforeThis.some(
                          (m) => m.isQuestion && m.role === "ava"
                        );
                        const isFirstUserMessage = !messagesBeforeThis.some(
                          (m) => m.role === "user"
                        );
                        const isNameMessage =
                          msg.isName === true ||
                          (!hasQuestionBefore && isFirstUserMessage);

                        return (
                          <>
                            {editingMessageId === msg.id ? (
                              <div className="flex flex-col gap-3 w-full">
                                <Textarea
                                  value={editedContent}
                                  onChange={(e) =>
                                    setEditedContent(e.target.value)
                                  }
                                  className="min-h-[100px] text-[15px] leading-relaxed w-full bg-slate-800/50 border-2 border-slate-700/50 focus:border-cyan-500/50 focus-visible:border-cyan-500/50 focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:outline-none rounded-xl px-4 py-3 transition-all duration-200 resize-none placeholder:text-slate-500 text-slate-200 shadow-sm"
                                  placeholder="Edit your answer here..."
                                  autoFocus
                                />
                                {/* Action buttons inside the same container when editing */}
                                {isAnswerMessage(msg, msgIndex) && (
                                  <div className="flex gap-2.5 items-center justify-end">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleCancelEdit}
                                      className="bg-slate-700 hover:bg-slate-600 border-0 text-white text-xs font-medium h-9 px-4 rounded-lg transition-all duration-200"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveEdit(msg.id)}
                                      disabled={
                                        isSavingEdit || !editedContent.trim()
                                      }
                                      className="bg-white hover:bg-gray-50 border-0 text-gray-700 hover:text-gray-900 text-xs font-medium h-9 px-4 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {isSavingEdit ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                          Saving...
                                        </>
                                      ) : (
                                        "Save Changes"
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <div className="flex gap-3 items-end">
                                  <div
                                    className={`bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl rounded-tr-sm px-4 py-3 ${
                                      isNameMessage
                                        ? "w-fit max-w-full"
                                        : "w-full"
                                    }`}
                                  >
                                    {(() => {
                                      // Check if content is HTML (user messages typically aren't, but check anyway)
                                      const isHTML =
                                        typeof msg.content === "string" &&
                                        /<[^>]+>/.test(msg.content);
                                      return (
                                        <p
                                          className={`text-[15px] leading-relaxed text-slate-200 ${
                                            isHTML ? "" : "whitespace-pre-wrap"
                                          }`}
                                        >
                                          {isHTML ? (
                                            <span
                                              dangerouslySetInnerHTML={{
                                                __html: msg.content,
                                              }}
                                            />
                                          ) : (
                                            msg.content
                                          )}
                                        </p>
                                      );
                                    })()}
                                  </div>
                                  {/* User Initials Avatar - Removed */}
                                </div>

                                {/* Edit Button - Only show for answer messages (not name) when NOT editing */}
                                {isAnswerMessage(msg, msgIndex) && (
                                  <div className="flex gap-1 items-center w-full justify-end">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleEditAnswer(msg.id, msg.content)
                                      }
                                      className="group relative border-0 bg-transparent hover:bg-cyan-500/10 text-slate-300 hover:text-cyan-400 h-8 w-8 p-0 transition-all duration-300 hover:scale-110 active:scale-95"
                                    >
                                      <Edit className="w-4 h-4 transition-all duration-300 group-hover:rotate-12" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleCopyAnswer(msg.content, msg.id)
                                      }
                                      className="group relative border-0 bg-transparent hover:bg-cyan-500/10 text-slate-300 hover:text-cyan-400 h-8 w-8 p-0 transition-all duration-300 hover:scale-110 active:scale-95"
                                      title="Copy answer"
                                    >
                                      {copiedMessageId === msg.id ? (
                                        <CheckCheck className="w-4 h-4 text-green-500 transition-all duration-300" />
                                      ) : (
                                        <Copy className="w-4 h-4 transition-all duration-300 group-hover:scale-110" />
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
            })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 items-start animate-fade-in">
              <div className="flex-1 max-w-[85%]">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <AVATypingIndicator />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} style={{ paddingBottom: "120px" }} />
        </div>
      </div>

      {/* Input Area - Fixed at Bottom of Page */}
      {/* Adjusts position and width based on sidebar state (collapsed/expanded) and accounts for scrollbar */}
      <div
        className="fixed bottom-0 min-h-[80px] flex items-end border-t border-slate-800/50 bg-slate-900/20 backdrop-blur-sm z-20 py-3"
        style={{
          left: `${sidebarOffset}px`,
          right: `${scrollbarWidth}px`,
        }}
      >
        <div className="w-full px-[20%] flex items-end gap-3">
          <div className="flex-1 relative flex flex-col gap-2 min-w-0">
            <div className="flex items-end gap-3">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  // Clear validation error when user starts typing
                  if (validationError) {
                    setValidationError(null);
                  }
                  // Auto-resize textarea like ChatGPT
                  resizeTextarea(e.target);
                  
                  // Smooth scroll to bottom when content changes
                  requestAnimationFrame(() => {
                    if (e.target.scrollHeight > e.target.clientHeight) {
                      e.target.scrollTo({
                        top: e.target.scrollHeight,
                        behavior: "smooth"
                      });
                    }
                  });
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  stage === "awaiting-name"
                    ? "Enter your name..."
                    : stage === "questions"
                    ? "Type your answer..."
                    : stage === "showing-intro"
                    ? "Review AVA's intro and click Ready to Move On..."
                    : stage === "complete"
                    ? "Phase 1 complete. Click 'Start Phase 2' to continue..."
                    : ""
                }
                disabled={
                  isSubmitting ||
                  isTyping ||
                  stage === "processing-name" ||
                  stage === "complete" ||
                  isReadyToMoveOnStage
                }
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-form-type="other"
                className={`flex-1 bg-slate-950/50 border ${
                  validationError
                    ? "border-purple-500/70 focus:border-purple-400 focus-visible:border-purple-400 focus:ring-2 focus-visible:ring-2 focus:ring-purple-500/40 focus-visible:ring-purple-500/40 shadow-lg shadow-purple-500/30"
                    : "border-slate-800 focus:border-cyan-500/70 focus-visible:border-cyan-500/70 focus:ring-2 focus-visible:ring-2 focus:ring-cyan-500/30 focus-visible:ring-cyan-500/30 shadow-lg shadow-cyan-500/20"
                } rounded-[24px] pl-4 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus-visible:outline-none focus-visible:ring-offset-0 transition-all duration-300 placeholder:text-slate-600 resize-none min-h-[44px] max-h-[200px] overflow-y-auto scrollbar-hide ${
                  isReadyToMoveOnStage ? "cursor-not-allowed opacity-70" : ""
                }`}
                title={
                  isReadyToMoveOnStage
                    ? "Finish AVA's intro above and click Ready to Move On first."
                    : undefined
                }
                rows={1}
                style={{
                  minHeight: "44px",
                  maxHeight: "200px",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                }}
              />
              <style>{`
                textarea::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <Button
                onClick={handleSubmit}
                disabled={
                  !inputValue.trim() ||
                  isSubmitting ||
                  isTyping ||
                  stage === "processing-name" ||
                  stage === "complete" ||
                  isReadyToMoveOnStage
                }
                size="icon"
                className={`h-9 w-9 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white hover:from-cyan-400 hover:via-blue-400 hover:to-purple-400 hover:shadow-lg hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 flex-shrink-0 self-end mb-0.5 ${
                  isReadyToMoveOnStage ? "cursor-not-allowed" : ""
                }`}
                title={
                  isReadyToMoveOnStage
                    ? "Finish AVA's intro above and click Ready to Move On first."
                    : "Send message"
                }
              >
                {isSubmitting || isTyping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            {/* Validation Error Message */}
            {validationError && (
              <div className="flex items-start gap-2 px-1 animate-fade-in">
                <div className="flex-1 bg-purple-950/40 border-2 border-purple-500/60 rounded-lg px-3 py-2.5 shadow-lg shadow-purple-500/30">
                  <p className="text-sm font-medium text-purple-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span>{validationError}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
