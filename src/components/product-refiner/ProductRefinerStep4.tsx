import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { submitStep4Promise } from "@/lib/product-refiner-api";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { useProductRefinerStore } from "@/stores/productRefinerStore";

export interface ProductRefinerStep4InputHandlers {
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputSubmit: () => void;
  isSubmitting: boolean;
  placeholder: string;
  currentQuestionKey: string | null;
  currentQuestionLabel: string | null;
  validationError?: string | null;
  validationHint?: string | null;
}

export interface ProductRefinerStep4PersistedState {
  currentQuestionKey: string | null;
  currentInputValue: string;
  answeredQuestions: string[];
}

interface ProductRefinerStep4Props {
  workspaceId: string;
  session: ProductRefinerSession;
  isActive: boolean;
  isCompleted: boolean;
  onSessionChange: (session: ProductRefinerSession) => void;
  onError?: (message: string | null) => void;
  isUnlocked?: boolean;
  example?: string;
  onInputHandlersReady?: (handlers: ProductRefinerStep4InputHandlers | null) => void;
  persistedState?: ProductRefinerStep4PersistedState | null;
  onPersistedStateChange?: (state: ProductRefinerStep4PersistedState | null) => void;
}

export const ProductRefinerStep4 = ({
  workspaceId,
  session,
  isActive,
  isCompleted,
  onSessionChange,
  onError,
  isUnlocked = false,
  example,
  onInputHandlersReady,
  persistedState,
  onPersistedStateChange,
}: ProductRefinerStep4Props) => {
  const CORE_PROMISE_MIN_LENGTH = 20;
  const { toast } = useToast();
  
  // Use Zustand store for persistence (ChatGPT-style)
  const store = useProductRefinerStore(workspaceId);
  
  // Check if session already has server data for this step
  const sessionHasStep4Data = !!(session.step4CorePromise || session.step4FinalPromise);
  
  // Allow Zustand restore when either the session already has step data
  // or we have a persisted UI snapshot (page refresh mid-step)
  const canUsePersistedFormData = (sessionHasStep4Data || !!persistedState) && store?.getState().formData.step4;
  const persistedFormData = canUsePersistedFormData ? store?.getState().formData.step4 ?? null : null;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize from session OR the persisted Zustand snapshot (for refresh persistence)
  // BUT: If session is fresh (no step4 data) and there's no persisted UI state, treat it as a reset
  const [corePromise, setCorePromise] = useState(() => {
    // Priority: session data > persisted store data > empty
    if (session.step4CorePromise) {
      return session.step4CorePromise;
    }
    if (persistedFormData?.corePromise) {
      return persistedFormData.corePromise;
    }
    return "";
  });
  const [finalPromise, setFinalPromise] = useState(() => {
    // Priority: session data > persisted store data > empty
    if (session.step4FinalPromise) {
      return session.step4FinalPromise;
    }
    if (persistedFormData?.finalPromise) {
      return persistedFormData.finalPromise;
    }
    return "";
  });
  
  const [suggestion, setSuggestion] = useState<any>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentInputValue, setCurrentInputValue] = useState(persistedState?.currentInputValue || "");
  const [currentQuestionKey, setCurrentQuestionKey] = useState<string | null>(persistedState?.currentQuestionKey || null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(() => {
    return new Set(persistedState?.answeredQuestions || []);
  });
  const [showExamples, setShowExamples] = useState<Record<string, boolean>>({});
  const [skippedQuestions, setSkippedQuestions] = useState<Set<string>>(new Set()); // Track which optional questions were skipped
  const sessionRef = useRef<ProductRefinerSession>(session);

  // Helper function to detect skip commands (useCallback to keep stable reference)
  const isSkipCommand = useCallback((value: string): boolean => {
    const skipCommands = ["skip", "no", "n", "leave it", "leave", "none", "not needed", "pass"];
    return skipCommands.includes(value.trim().toLowerCase());
  }, []);

  // Move questions outside component or use useMemo to stabilize reference
  const questions = useMemo(() => [
    {
      key: "corePromise",
      label: "What is your core product promise?",
      placeholder: "Describe your core product promise (minimum 20 characters)...",
      isOptional: false,
    },
    {
      key: "finalPromise",
      label: "What is your final refined promise? (Optional — you can skip this)",
      placeholder: "Enter your refined promise, or type 'skip' to use core promise...",
      isOptional: true,
      skipHint: "You can skip by typing 'skip' or leave it blank.",
    },
  ], []);

  // Track previous session values to prevent unnecessary updates
  const prevSessionDataStringRef = useRef<string>("");
  const prevAnsweredQuestionsStringRef = useRef<string>("");
  
  useEffect(() => {
    sessionRef.current = session;
    
    // Create session data string for comparison
    const sessionDataString = JSON.stringify({
      step4CorePromise: session.step4CorePromise,
      step4FinalPromise: session.step4FinalPromise,
    });
    
    // Check if session data actually changed
    if (prevSessionDataStringRef.current === sessionDataString) {
      return;
    }
    
    // Update ref
    prevSessionDataStringRef.current = sessionDataString;
    
    // Priority: session data > (Zustand store ONLY if session has data) > empty
    // If session has step4 data, use it (prevents restoring from Zustand after reset)
    const core = session.step4CorePromise ||
                 persistedFormData?.corePromise ||
                 "";
    const final = session.step4FinalPromise ||
                  persistedFormData?.finalPromise ||
                  "";
    
    // Always update from session (session is source of truth)
    setCorePromise(core);
    setFinalPromise(final);
    
    // Track skipped questions based on session data
    // If finalPromise is empty or same as corePromise, it was skipped
    if (session.step4FinalPromise === "" || (session.step4FinalPromise === session.step4CorePromise && session.step4CorePromise)) {
      setSkippedQuestions(prev => {
        if (prev.has("finalPromise")) return prev;
        return new Set([...prev, "finalPromise"]);
      });
    } else if (session.step4FinalPromise && session.step4FinalPromise !== session.step4CorePromise) {
      setSkippedQuestions(prev => {
        if (!prev.has("finalPromise")) return prev;
        const next = new Set(prev);
        next.delete("finalPromise");
        return next;
      });
    }
    
    // Save to Zustand store for persistence
    if (store && (core.trim() || final.trim())) {
      store.getState().setStep4FormData({
        corePromise: core,
        finalPromise: final,
      });
    }
    
    // Immediately mark all questions with answers as answered (for ChatGPT-style persistence)
    const answered = new Set<string>();
    if (core.trim()) answered.add("corePromise");
    if (final.trim()) answered.add("finalPromise");
    
    // Only update if different
    const newAnsweredString = JSON.stringify(Array.from(answered).sort());
    if (prevAnsweredQuestionsStringRef.current !== newAnsweredString) {
      prevAnsweredQuestionsStringRef.current = newAnsweredString;
      setAnsweredQuestions(answered);
    }
  }, [session.step4CorePromise, session.step4FinalPromise, sessionHasStep4Data, persistedFormData, store]); // Removed corePromise, finalPromise, answeredQuestions from deps
  
  // Restore from Zustand store on mount (for ChatGPT-style persistence after refresh)
  // BUT: Only restore if persistedState exists (page refresh) and session doesn't have step4 data
  // If persistedState is null OR session is fresh, it means we're starting fresh after reset - don't restore from Zustand
  useEffect(() => {
    // If session is fresh (no step4 data) AND persistedState is null, it's a reset - clear everything
    if (!sessionHasStep4Data && !persistedState) {
      // Fresh start after reset - ensure formData is empty
      const hasFormData = corePromise.trim() || finalPromise.trim();
      if (hasFormData) {
        // Reset formData to empty if it has data but session is fresh and persistedState is null (after reset)
        setCorePromise("");
        setFinalPromise("");
        setAnsweredQuestions(new Set());
        setCurrentQuestionKey(null);
        setCurrentInputValue("");
        setSkippedQuestions(new Set());
      }
      return;
    }
    
    // Only restore from Zustand if:
    // 1. persistedState exists (page refresh scenario), AND
    // 2. Session doesn't have step4 data (fresh session), AND
    // 3. Zustand has data, AND
    // 4. FormData is empty (page refresh scenario, not a reset)
    if (persistedState && !sessionHasStep4Data && persistedFormData) {
      const hasZustandData = persistedFormData.corePromise?.trim() || persistedFormData.finalPromise?.trim();
      const hasFormData = corePromise.trim() || finalPromise.trim();
      
      // Only restore if we have Zustand data but no formData (page refresh scenario)
      if (hasZustandData && !hasFormData) {
        // Restore from Zustand store
        setCorePromise(persistedFormData.corePromise || "");
        setFinalPromise(persistedFormData.finalPromise || "");
        
        // Mark all answered questions
        const answered = new Set<string>();
        if (persistedFormData.corePromise?.trim()) answered.add("corePromise");
        if (persistedFormData.finalPromise?.trim()) answered.add("finalPromise");
        setAnsweredQuestions(answered);
      }
    }
  }, [persistedState, sessionHasStep4Data, corePromise, finalPromise, persistedFormData]); // Run when these change

  // Initialize current question when step becomes active (similar to Step 2)
  useEffect(() => {
    if (isActive && !isCompleted) {
      // If persistedState is null, we're starting fresh after reset - find first unanswered question
      if (!persistedState) {
        // Find first unanswered question
        let nextQuestion = null;
        if (!corePromise.trim()) {
          nextQuestion = questions[0];
        } else if (!finalPromise.trim()) {
          nextQuestion = questions[1];
        }
        
        if (nextQuestion && nextQuestion.key !== currentQuestionKey) {
          setCurrentQuestionKey(nextQuestion.key);
          setCurrentInputValue(nextQuestion.key === "corePromise" ? corePromise : finalPromise);
        } else if (!nextQuestion) {
          setCurrentQuestionKey(null);
          setCurrentInputValue("");
        }
        return;
      }
      
      // If we have persisted state with a current question, use it
      if (persistedState.currentQuestionKey) {
        // Verify the persisted question is still valid (not answered in session)
        const persistedValue = persistedState.currentQuestionKey === "corePromise" 
          ? corePromise 
          : finalPromise;
        if (!persistedValue || !persistedValue.trim()) {
          // Persisted question is still unanswered, use it
          if (currentQuestionKey !== persistedState.currentQuestionKey) {
            setCurrentQuestionKey(persistedState.currentQuestionKey);
            setCurrentInputValue(persistedState.currentInputValue || "");
          }
          return;
        }
      }
      
      // Otherwise, find the next unanswered question
      let nextQuestion = null;
      if (!corePromise.trim()) {
        nextQuestion = questions[0];
      } else if (!finalPromise.trim()) {
        nextQuestion = questions[1];
      }
      
      if (nextQuestion && nextQuestion.key !== currentQuestionKey) {
        setCurrentQuestionKey(nextQuestion.key);
        setCurrentInputValue(nextQuestion.key === "corePromise" ? corePromise : finalPromise);
      } else if (!nextQuestion) {
        setCurrentQuestionKey(null);
        setCurrentInputValue("");
      }
    }
  }, [isActive, isCompleted, persistedState, corePromise, finalPromise, currentQuestionKey, questions]);

  // Use refs to avoid recreating handleQuestionSubmit on every render
  const corePromiseRef = useRef(corePromise);
  const finalPromiseRef = useRef(finalPromise);
  const isSubmittingRef = useRef(isSubmitting);
  
  useEffect(() => {
    corePromiseRef.current = corePromise;
    finalPromiseRef.current = finalPromise;
    isSubmittingRef.current = isSubmitting;
  }, [corePromise, finalPromise, isSubmitting]);
  
  const handleQuestionSubmit = useCallback(async (questionKey: string, value: string) => {
    // Prevent double submission
    if (isSubmittingRef.current) {
      return;
    }

    const currentSession = sessionRef.current || session;
    if (!currentSession?.id) {
      toast({
        title: "Session missing",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    const trimmedValue = value.trim();
    const currentCorePromise = corePromiseRef.current;
    const currentFinalPromise = finalPromiseRef.current;
    
    if (questionKey === "corePromise") {
      if (!trimmedValue) {
        setValidationError("Core Product Promise is required");
        return;
      }
      if (trimmedValue.length < CORE_PROMISE_MIN_LENGTH) {
        setValidationError(`Core Product Promise must be at least ${CORE_PROMISE_MIN_LENGTH} characters`);
        return;
      }
      setCorePromise(trimmedValue);
      corePromiseRef.current = trimmedValue;
      setAnsweredQuestions(prev => new Set([...prev, "corePromise"]));
      
      // Save to Zustand store immediately for persistence
      if (store) {
        store.getState().setStep4FormData({
          corePromise: trimmedValue,
          finalPromise: currentFinalPromise,
        });
      }
      
      // Move to next question or submit if final promise is also answered
      if (currentFinalPromise.trim()) {
        await handleFinalSubmit(trimmedValue, currentFinalPromise);
      } else {
        setCurrentQuestionKey("finalPromise");
        setCurrentInputValue("");
      }
    } else if (questionKey === "finalPromise") {
      setIsSubmitting(true);
      setValidationError(null);
      
      // Final promise is optional - check for skip commands
      if (isSkipCommand(trimmedValue) || !trimmedValue) {
        // User skipped - mark as skipped and use core promise
        setFinalPromise("");
        finalPromiseRef.current = "";
        setAnsweredQuestions(prev => new Set([...prev, "finalPromise"]));
        setSkippedQuestions(prev => new Set([...prev, "finalPromise"])); // Mark as skipped
        
        // Save to Zustand store immediately for persistence
        if (store) {
          store.getState().setStep4FormData({
            corePromise: currentCorePromise,
            finalPromise: "",
          });
        }
        
        // Show skip acknowledgment - keep isSubmitting true during API call
        await handleFinalSubmit(currentCorePromise.trim(), currentCorePromise.trim());
      } else {
        // User provided a value - remove from skipped set if it was there
        setIsSubmitting(true); // Show loader for custom answer
        setFinalPromise(trimmedValue);
        finalPromiseRef.current = trimmedValue;
        setAnsweredQuestions(prev => new Set([...prev, "finalPromise"]));
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete("finalPromise"); // Remove from skipped if user provided answer
          return next;
        });
        
        // Save to Zustand store immediately for persistence
        if (store) {
          store.getState().setStep4FormData({
            corePromise: currentCorePromise,
            finalPromise: trimmedValue,
          });
        }
        
        // Keep isSubmitting true during API call - API hits immediately
        await handleFinalSubmit(currentCorePromise.trim(), trimmedValue);
      }
    }
  }, [session, toast, isSkipCommand, store]); // Removed corePromise, finalPromise, isSubmitting from deps

  const handleFinalSubmit = async (coreVal: string, finalVal: string) => {
    const currentSession = sessionRef.current || session;
    if (!currentSession?.id) return;

    setValidationError(null);
    setIsSubmitting(true);
    onError?.(null);

    try {
      const response = await submitStep4Promise(currentSession.id, {
        corePromise: coreVal,
        finalPromise: finalVal !== coreVal ? finalVal : undefined,
      });
      
      if (response.suggestion) {
        setSuggestion(response.suggestion);
      }

      const updatedSession: ProductRefinerSession = {
        ...currentSession,
        step4CorePromise: coreVal,
        step4FinalPromise: finalVal !== coreVal ? finalVal : coreVal,
        step4Completed: true,
        currentStep: 5,
      };
      onSessionChange(updatedSession);
      setCurrentQuestionKey(null);
      setCurrentInputValue("");
    } catch (error: any) {
      const message = error?.message || "Failed to submit promise";
      onError?.(message);
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Persist UI state whenever it changes (but only if it actually changed)
  const prevPersistedStateRef = useRef<{
    currentQuestionKey: string | null;
    currentInputValue: string;
    answeredQuestions: string[];
    isCompleted: boolean;
    isActive: boolean;
  } | null>(null);
  const onPersistedStateChangeRef = useRef(onPersistedStateChange);
  
  // Keep ref updated
  useEffect(() => {
    onPersistedStateChangeRef.current = onPersistedStateChange;
  }, [onPersistedStateChange]);
  
  useEffect(() => {
    const callback = onPersistedStateChangeRef.current;
    if (!callback) return;
    
    // Don't persist if we're completed or not active
    if (isCompleted || !isActive) {
      const prevState = prevPersistedStateRef.current;
      if (prevState && (prevState.isCompleted !== isCompleted || prevState.isActive !== isActive)) {
        prevPersistedStateRef.current = null;
        callback(null);
      }
      return;
    }

    const answeredQuestionsArray = Array.from(answeredQuestions).sort();
    const state: ProductRefinerStep4PersistedState = {
      currentQuestionKey,
      currentInputValue,
      answeredQuestions: answeredQuestionsArray,
    };

    // Only call callback if state actually changed
    const prevState = prevPersistedStateRef.current;
    const stateChanged = !prevState || 
        prevState.currentQuestionKey !== state.currentQuestionKey ||
        prevState.currentInputValue !== state.currentInputValue ||
        prevState.answeredQuestions.length !== state.answeredQuestions.length ||
        prevState.answeredQuestions.some((q, i) => q !== state.answeredQuestions[i]) ||
        prevState.isCompleted !== isCompleted ||
        prevState.isActive !== isActive;
    
    if (stateChanged) {
      prevPersistedStateRef.current = {
        currentQuestionKey: state.currentQuestionKey,
        currentInputValue: state.currentInputValue,
        answeredQuestions: [...state.answeredQuestions],
        isCompleted,
        isActive,
      };
      callback(state);
    }
  }, [currentQuestionKey, currentInputValue, answeredQuestions, isCompleted, isActive]);

  // Expose input handlers to parent component
  const onInputHandlersReadyRef = useRef(onInputHandlersReady);
  const prevHandlersStateRef = useRef<string>("");
  const prevShouldProvideHandlersRef = useRef<boolean>(false);
  const handleQuestionSubmitRef = useRef(handleQuestionSubmit);
  
  useEffect(() => {
    onInputHandlersReadyRef.current = onInputHandlersReady;
    handleQuestionSubmitRef.current = handleQuestionSubmit;
  }, [onInputHandlersReady, handleQuestionSubmit]);
  
  useEffect(() => {
    if (!onInputHandlersReadyRef.current) return;
    
    const shouldProvideHandlers = isActive && !isCompleted && currentQuestionKey !== null;
    
    // Create state string for comparison (includes shouldProvideHandlers)
    const handlersStateString = JSON.stringify({
      shouldProvideHandlers,
      isActive,
      isCompleted,
      currentQuestionKey,
      currentInputValue,
      isSubmitting,
      validationError,
    });
    
    // Only update if state actually changed
    if (prevHandlersStateRef.current === handlersStateString) {
      return;
    }
    
    const prevShouldProvide = prevShouldProvideHandlersRef.current;
    prevHandlersStateRef.current = handlersStateString;
    
    if (shouldProvideHandlers) {
      const currentQuestion = questions.find(q => q.key === currentQuestionKey);
      const wrappedSubmit = () => {
        if (currentQuestionKey) {
          const trimmed = currentInputValue.trim();
          const isOptional = currentQuestion?.isOptional || false;
          
          // For optional fields, allow skip commands or empty
          if (isOptional && (isSkipCommand(trimmed) || !trimmed)) {
            // Skip command detected or empty - allow submission
            handleQuestionSubmitRef.current(currentQuestionKey, trimmed);
          } else if (trimmed) {
            // Has value (even if it's "skip" text for required fields), submit it
            handleQuestionSubmitRef.current(currentQuestionKey, trimmed);
          } else if (!isOptional) {
            // Required field is empty
            setValidationError("This field is required");
          }
        }
      };
      const handleInputChange = (value: string) => {
        setCurrentInputValue(value);
        // Clear validation error when user starts typing
        if (validationError && currentQuestionKey === "corePromise" && value.trim().length >= CORE_PROMISE_MIN_LENGTH) {
          setValidationError(null);
        }
      };
      
      const trimmed = currentInputValue.trim();
      const showHint = currentQuestionKey === "corePromise" && trimmed.length > 0 && trimmed.length < CORE_PROMISE_MIN_LENGTH;
      
      onInputHandlersReadyRef.current({
        inputValue: currentInputValue,
        onInputChange: handleInputChange,
        onInputSubmit: wrappedSubmit,
        isSubmitting,
        placeholder: currentQuestion?.placeholder || "",
        currentQuestionKey,
        currentQuestionLabel: currentQuestion?.label || null,
        validationError: validationError,
        validationHint: showHint 
          ? `Core Product Promise • minimum ${CORE_PROMISE_MIN_LENGTH} characters` 
          : currentQuestion?.isOptional && currentQuestion?.skipHint 
            ? currentQuestion.skipHint 
            : null,
      });
      prevShouldProvideHandlersRef.current = true;
    } else {
      // Only call null if we previously provided handlers (avoid unnecessary updates)
      if (prevShouldProvide) {
        onInputHandlersReadyRef.current(null);
      }
      prevShouldProvideHandlersRef.current = false;
    }
  }, [isActive, isCompleted, currentQuestionKey, currentInputValue, isSubmitting, validationError, questions]); // questions is now memoized, so it's stable

  // Automatically reveal example for the active question
  useEffect(() => {
    if (!currentQuestionKey) return;
    if (currentQuestionKey === "corePromise" && example) {
      setShowExamples((prev) => {
        if (prev.corePromise) return prev;
        return { ...prev, corePromise: true };
      });
    }
  }, [currentQuestionKey, example]);

  if (!isUnlocked && !isActive && !isCompleted) {
    return null;
  }

  return (
    <>
      {(isActive || isCompleted) && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <ChunkedText
              text={`Now let's refine your core product promise. A strong promise is clear, compelling, results-focused, and aligned with your target audience's needs.`}
              staggerMs={30}
            />
          </div>
        </div>
      )}

      {questions.map((question) => {
        // Check multiple sources for answer (Zustand store > state > session > empty)
        const zustandValue = question.key === "corePromise" 
          ? persistedFormData?.corePromise 
          : persistedFormData?.finalPromise;
        const stateValue = question.key === "corePromise" ? corePromise : finalPromise;
        const sessionValue = question.key === "corePromise" 
          ? session.step4CorePromise 
          : session.step4FinalPromise;
        
        // Priority: Zustand store > state > session > empty
        const answer = zustandValue || stateValue || sessionValue || "";
        const hasAnswer = !!(answer && answer.trim());
        
        // A question is answered if it has a value anywhere OR is in answeredQuestions Set
        const isAnswered = hasAnswer || answeredQuestions.has(question.key);
        const isActiveQuestion = question.key === currentQuestionKey;

        // Show logic:
        // 1. If completed: show ALL questions
        // 2. If active: show ALL answered questions + current active question
        // This ensures full conversation history is visible, even after refresh
        const shouldShow = isCompleted || isAnswered || isActiveQuestion;
        
        if (!shouldShow) {
          return null;
        }

        return (
          <div key={question.key} className="space-y-1">
            {/* Question - Always show when completed or active */}
            {(isActive || isCompleted) && (
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content">
                  <div className="space-y-1">
                    {isCompleted ? (
                      <p className="text-base text-gray-900">{question.label}</p>
                    ) : (
                      <ChunkedText
                        text={question.label}
                        chunkClassName="text-base text-gray-900"
                        staggerMs={30}
                      />
                    )}
                    {question.isOptional && !isCompleted && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        {question.skipHint || "You can skip this by typing 'skip' or leaving it blank."}
                      </p>
                    )}
                    {isAnswered && (
                      <span className="inline-block rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 mt-2 transition-opacity duration-300 opacity-100">
                        ✓ Saved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Example for core promise */}
            {isActiveQuestion && question.key === "corePromise" && example && (
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content p-0">
                  <div className="rounded-2xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 text-gray-900 font-medium">
                        <Lightbulb className="w-4 h-4 text-vox-pink" />
                        <span>Example Inspiration</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowExamples(prev => ({
                            ...prev,
                            corePromise: !prev.corePromise
                          }));
                        }}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showExamples.corePromise ? "Hide example" : "Show example"}
                      >
                        {showExamples.corePromise ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {showExamples.corePromise && example && (
                      <div className="px-4 py-4 space-y-3">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {example}
                        </p>
                        <div className="text-xs text-gray-500">
                          Feel free to personalize this example before submitting.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* User's Answer - Show answer or skip indication */}
            {/* For optional questions that were skipped, show "Skipped" instead of answer */}
            {isAnswered && question.isOptional && skippedQuestions.has(question.key) && (
              <div className="margo-chat-bubble margo-chat-bubble--user">
                <div className="margo-message-content">
                  <p className="text-sm text-gray-500 italic">Skipped</p>
                </div>
              </div>
            )}
            {/* For questions with actual answers (not skipped), show the answer */}
            {isAnswered && answer && answer.trim() && !skippedQuestions.has(question.key) && (
              <div className="margo-chat-bubble margo-chat-bubble--user">
                <div className="margo-message-content">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{answer}</p>
                </div>
              </div>
            )}
            {/* Loading indicator when submitting */}
            {isActiveQuestion && isSubmitting && !isCompleted && (
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content">
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                    <p className="text-sm">Saving...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Global loader bubble when we are submitting but the active question has already been cleared */}
      {isSubmitting && !isCompleted && currentQuestionKey === null && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="flex items-center gap-2 text-gray-600">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
              <p className="text-sm">Saving...</p>
            </div>
          </div>
        </div>
      )}

      {suggestion && (isActive || isCompleted) && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content bg-blue-50 border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">AI Suggestion</h4>
            {suggestion.improvedPromise && (
              <p className="text-sm text-blue-800 mb-2">{suggestion.improvedPromise}</p>
            )}
            {suggestion.reasoning && (
              <p className="text-sm text-blue-700 mb-2">{suggestion.reasoning}</p>
            )}
            {suggestion.keyImprovements && Array.isArray(suggestion.keyImprovements) && (
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
                {suggestion.keyImprovements.map((imp: string, idx: number) => (
                  <li key={idx}>{imp}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <p className="text-sm font-medium text-gray-700">✓ Step 4 completed - Product Promise Refined</p>
            <p className="text-sm text-gray-600 mt-2">Great! Your product promise is now clear and compelling. Let's define the specific outcomes your product delivers.</p>
          </div>
        </div>
      )}

      {(isActive && !isCompleted) && <div className="h-4" aria-hidden />}
    </>
  );
};

