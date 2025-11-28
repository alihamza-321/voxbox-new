import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { submitStep2Intake } from "@/lib/product-refiner-api";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { useProductRefinerStore } from "@/stores/productRefinerStore";

export interface ProductRefinerStep2InputHandlers {
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

export interface ProductRefinerStep2PersistedState {
  currentQuestionKey: string | null;
  currentInputValue: string;
  answeredQuestions: string[];
}

interface ProductRefinerStep2Props {
  workspaceId: string;
  session: ProductRefinerSession;
  isActive: boolean;
  isCompleted: boolean;
  onSessionChange: (session: ProductRefinerSession) => void;
  onError?: (message: string | null) => void;
  isUnlocked?: boolean;
  examples?: any;
  onInputHandlersReady?: (handlers: ProductRefinerStep2InputHandlers | null) => void;
  persistedState?: ProductRefinerStep2PersistedState | null;
  onPersistedStateChange?: (state: ProductRefinerStep2PersistedState | null) => void;
}

export const ProductRefinerStep2 = ({
  workspaceId,
  session,
  isActive,
  isCompleted,
  onSessionChange,
  onError,
  isUnlocked = false,
  examples,
  onInputHandlersReady,
  persistedState,
  onPersistedStateChange,
}: ProductRefinerStep2Props) => {
  const QUESTION_MIN_LENGTHS: Record<string, number> = {
    product: 5,
    targetAudience: 10,
    problem: 15,
    features: 10,
    delivery: 8,
    pricing: 5,
  };
  const { toast } = useToast();
  
  // Use Zustand store for persistence (ChatGPT-style)
  const store = useProductRefinerStore(workspaceId);
  
  // Check if session is fresh (no step2 data) - if so, ignore Zustand completely
  const sessionHasStep2Data = !!(session.step2Product || session.step2TargetAudience || 
    session.step2Problem || session.step2Features || session.step2Delivery || session.step2Pricing);
  
  // Only read from Zustand if session has step2 data OR persistedState exists (page refresh scenario)
  // If session is fresh and persistedState is null, it's a reset - ignore Zustand
  const persistedFormData = (sessionHasStep2Data || persistedState) && store?.getState().formData.step2
    ? store.getState().formData.step2
    : null;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentInputValue, setCurrentInputValue] = useState(persistedState?.currentInputValue || "");
  const [currentQuestionKey, setCurrentQuestionKey] = useState<string | null>(persistedState?.currentQuestionKey || null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(
    persistedState?.answeredQuestions ? new Set(persistedState.answeredQuestions) : new Set()
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const sessionRef = useRef<ProductRefinerSession>(session);
  const activeQuestionRef = useRef<HTMLDivElement | null>(null);
  const hasRestoredStateRef = useRef(false);

  // Initialize formData from session OR Zustand store (for persistence after refresh)
  // BUT: If session is fresh (no step2 data) AND persistedState is null, it's a reset - ignore Zustand
  const [formData, setFormData] = useState(() => {
    // Priority: session data > (Zustand store ONLY if session has data OR persistedState exists) > empty
    if (sessionHasStep2Data) {
      return {
        product: session.step2Product || "",
        targetAudience: session.step2TargetAudience || "",
        problem: session.step2Problem || "",
        features: session.step2Features || "",
        delivery: session.step2Delivery || "",
        pricing: session.step2Pricing || "",
      };
    }
    // Only use Zustand store if:
    // 1. persistedState exists (page refresh scenario), OR
    // 2. Session has step2 data (normal flow)
    // If session is fresh AND persistedState is null, it's a reset - ignore Zustand
    if (persistedState && persistedFormData) {
      return persistedFormData;
    }
    // Fresh start - empty formData
    return {
      product: "",
      targetAudience: "",
      problem: "",
      features: "",
      delivery: "",
      pricing: "",
    };
  });

  const [showExamples, setShowExamples] = useState<Record<string, boolean>>({});

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const questions = useMemo(() => [
    {
      key: "product",
      label: "What is your product?",
      example: examples?.product?.example || "Example: A comprehensive online course teaching small business owners how to build and scale their email marketing strategy, including templates, automation workflows, and growth tactics.",
    },
    {
      key: "targetAudience",
      label: "Who is the product for?",
      example: examples?.targetAudience?.example || "Example: Small business owners and entrepreneurs who are new to email marketing and want to build a sustainable customer acquisition system without hiring expensive agencies.",
    },
    {
      key: "problem",
      label: "What specific problem does the product solve?",
      example: examples?.problem?.example || "Example: Small business owners struggle to build effective email marketing campaigns because they lack the knowledge, templates, and strategic framework needed to create campaigns that actually convert.",
    },
    {
      key: "features",
      label: "What does the product include (features or components)?",
      example: examples?.features?.example || "Example: 12 video modules, 50+ email templates, automation workflow blueprints, case studies, a private community, monthly Q&A sessions, and lifetime access to updates.",
    },
    {
      key: "delivery",
      label: "How is the product delivered?",
      example: examples?.delivery?.example || "Example: Delivered through an online learning platform with video content, downloadable resources, and a private community. Access is immediate upon purchase, with new content added monthly.",
    },
    {
      key: "pricing",
      label: "What is the current pricing structure?",
      example: examples?.pricing?.example || "Example: One-time payment of $497, or three monthly payments of $199. Includes all modules, templates, and lifetime access to the community and updates.",
    },
  ], [examples]);

  const TOTAL_QUESTIONS = questions.length;

  // Restore from Zustand store on mount (for ChatGPT-style persistence after refresh)
  // BUT: Only restore if persistedState exists (page refresh) and session doesn't have step2 data
  // If persistedState is null OR session is fresh, it means we're starting fresh after reset - don't restore from Zustand
  useEffect(() => {
    // If session is fresh (no step2 data) AND persistedState is null, it's a reset - clear everything
    if (!sessionHasStep2Data && !persistedState) {
      // Fresh start after reset - ensure formData is empty
      const hasFormData = Object.values(formData).some(v => v && v.trim());
      if (hasFormData) {
        // Reset formData to empty if it has data but session is fresh and persistedState is null (after reset)
        setFormData({
          product: "",
          targetAudience: "",
          problem: "",
          features: "",
          delivery: "",
          pricing: "",
        });
        setAnsweredQuestions(new Set());
        setCurrentQuestionKey(null);
        setCurrentInputValue("");
      }
      return;
    }
    
    // Only restore from Zustand if:
    // 1. persistedState exists (page refresh scenario), AND
    // 2. Session doesn't have step2 data (fresh session), AND
    // 3. Zustand has data, AND
    // 4. FormData is empty (page refresh scenario, not a reset)
    if (persistedState && !sessionHasStep2Data && persistedFormData) {
      const hasZustandData = Object.values(persistedFormData).some(v => v && v.trim());
      const hasFormData = Object.values(formData).some(v => v && v.trim());
      
      // Only restore if we have Zustand data but no formData (page refresh scenario)
      if (hasZustandData && !hasFormData) {
        // Restore from Zustand store
        setFormData(persistedFormData);
        
        // Mark all answered questions
        const answered = new Set<string>();
        questions.forEach((q) => {
          const value = persistedFormData[q.key as keyof typeof persistedFormData];
          if (value && value.trim()) {
            answered.add(q.key);
          }
        });
        setAnsweredQuestions(answered);
      }
    }
  }, [persistedState, sessionHasStep2Data, formData, persistedFormData, questions]); // Run when these change

  // Get the first unanswered question
  const getNextQuestion = useCallback((dataToCheck?: typeof formData) => {
    const data = dataToCheck || formData;

    for (const question of questions) {
      const value = data[question.key as keyof typeof data];
      if (!value || !value.trim()) {
        return question;
      }
    }
    return null;
  }, [formData, questions]);

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
    const state: ProductRefinerStep2PersistedState = {
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

  // Sync answeredQuestions with formData whenever formData changes (backup sync)
  // Primary initialization happens in the session useEffect above
  const prevFormDataStringRef = useRef<string>("");
  const prevAnsweredQuestionsStringRef = useRef<string>("");
  
  useEffect(() => {
    // If session is fresh (no step2 data) and persistedState is null, it's a reset - clear answered questions
    if (!sessionHasStep2Data && !persistedState) {
      const answeredQuestionsString = JSON.stringify(Array.from(answeredQuestions).sort());
      if (answeredQuestionsString !== "[]") {
        setAnsweredQuestions(new Set());
        prevAnsweredQuestionsStringRef.current = "[]";
      }
      hasRestoredStateRef.current = true;
      prevFormDataStringRef.current = "";
      return;
    }
    
    // Only sync if formData actually changed (compare stringified versions)
    const currentFormDataString = JSON.stringify(formData);
    if (prevFormDataStringRef.current === currentFormDataString) {
      return;
    }
    
    prevFormDataStringRef.current = currentFormDataString;
    
    const answered = new Set<string>();
    questions.forEach((q) => {
      const value = formData[q.key as keyof typeof formData];
      if (value && value.trim()) {
        answered.add(q.key);
      }
    });
    
    // Only update if different to avoid unnecessary re-renders
    const newAnsweredArray = Array.from(answered).sort();
    const newAnsweredString = JSON.stringify(newAnsweredArray);
    if (prevAnsweredQuestionsStringRef.current !== newAnsweredString) {
      prevAnsweredQuestionsStringRef.current = newAnsweredString;
      setAnsweredQuestions(answered);
    }
    
    hasRestoredStateRef.current = true;
  }, [formData, questions, sessionHasStep2Data, persistedState]); // Removed answeredQuestions from deps to prevent loop

  // Initialize current question when step becomes active
  useEffect(() => {
    if (isActive && !isCompleted) {
      // If persistedState is null, we're starting fresh after reset - start from question 1
      if (!persistedState) {
        const firstQuestion = questions[0];
        if (firstQuestion && firstQuestion.key !== currentQuestionKey) {
          setCurrentQuestionKey(firstQuestion.key);
          setCurrentInputValue("");
        }
        return;
      }
      
      // If we have persisted state with a current question, use it
      if (persistedState.currentQuestionKey) {
        // Verify the persisted question is still valid (not answered in session)
        const persistedValue = formData[persistedState.currentQuestionKey as keyof typeof formData];
        if (!persistedValue || !persistedValue.trim()) {
          // Persisted question is still unanswered, use it
          return;
        }
      }
      
      // Otherwise, find the next unanswered question
      const nextQuestion = getNextQuestion();
      if (nextQuestion && nextQuestion.key !== currentQuestionKey) {
        const questionIndex = questions.findIndex(q => q.key === nextQuestion.key);
        if (questionIndex >= 0) {
          setCurrentQuestionKey(nextQuestion.key);
          setCurrentInputValue(formData[nextQuestion.key as keyof typeof formData] || "");
        }
      }
    }
  }, [isActive, isCompleted, getNextQuestion, questions, formData, persistedState, currentQuestionKey]);

  // Automatically reveal example for the active question (similar to Margo)
  useEffect(() => {
    if (!currentQuestionKey) return;
    setShowExamples((prev) => {
      if (prev[currentQuestionKey]) return prev;
      return {
        ...prev,
        [currentQuestionKey]: true,
      };
    });
  }, [currentQuestionKey]);

  const handleExampleClick = (questionKey: string, example: string) => {
    // Remove "Example:" prefix if present
    const cleanExample = example.replace(/^Example:\s*/i, "").trim();
    
    // Set as current question and populate global input
    setCurrentQuestionKey(questionKey);
    setCurrentInputValue(cleanExample);

    requestAnimationFrame(() => {
      document
        .getElementById("product-refiner-unified-input")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };
  useEffect(() => {
    if (!currentQuestionKey) {
      activeQuestionRef.current = null;
      return;
    }

    if (!isActive) return;

    const scrollTarget = activeQuestionRef.current;
    if (!scrollTarget) return;

    scrollTarget.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  }, [currentQuestionKey, isActive]);


  // Sync session data to formData when session changes (but only if different)
  const prevSessionDataStringRef = useRef<string>("");
  const prevFormDataStringRef2 = useRef<string>("");
  
  useEffect(() => {
    // Create session data string for comparison
    const sessionDataString = JSON.stringify({
      step2Product: session.step2Product,
      step2TargetAudience: session.step2TargetAudience,
      step2Problem: session.step2Problem,
      step2Features: session.step2Features,
      step2Delivery: session.step2Delivery,
      step2Pricing: session.step2Pricing,
    });
    
    // Check if session data actually changed
    if (prevSessionDataStringRef.current === sessionDataString) {
      return;
    }
    
    prevSessionDataStringRef.current = sessionDataString;
    
    // Priority: session data > Zustand store > empty
    const sessionFormData = {
      product: session.step2Product || "",
      targetAudience: session.step2TargetAudience || "",
      problem: session.step2Problem || "",
      features: session.step2Features || "",
      delivery: session.step2Delivery || "",
      pricing: session.step2Pricing || "",
    };
    
    // Use session data if available, otherwise fallback to Zustand store (only if session has data)
    const newFormData = sessionHasStep2Data
      ? sessionFormData
      : (persistedFormData && persistedState ? persistedFormData : sessionFormData);
    
    // Only update if formData actually changed (compare with previous value stored in ref)
    const newFormDataString = JSON.stringify(newFormData);
    if (prevFormDataStringRef2.current !== newFormDataString) {
      prevFormDataStringRef2.current = newFormDataString;
      setFormData(newFormData);
      
      // Save to Zustand store for persistence
      if (store && sessionHasStep2Data) {
        store.getState().setStep2FormData(newFormData);
      }
    }
  }, [session.step2Product, session.step2TargetAudience, session.step2Problem, session.step2Features, session.step2Delivery, session.step2Pricing, sessionHasStep2Data, persistedFormData, persistedState, store]); // Removed formData from deps to prevent loop

  const handleSingleFieldSubmit = useCallback(async (questionKey: string, value: string) => {
    // Prevent double submission
    if (isSubmitting) {
      return;
    }

    if (!sessionRef.current?.id) {
      toast({
        title: "Session missing",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    const trimmedValue = value.trim();
    const minLength = QUESTION_MIN_LENGTHS[questionKey] ?? 3;
    // Validate required field
    if (!trimmedValue) {
      const currentQuestion = questions.find(q => q.key === questionKey);
      setValidationError(`${currentQuestion?.label || "This field"} is required`);
      toast({
        title: "Answer required",
        description: "Please provide an answer before submitting.",
        variant: "destructive",
      });
      return;
    }
    if (trimmedValue.length < minLength) {
      const currentQuestion = questions.find(q => q.key === questionKey);
      const label = currentQuestion?.label || "This field";
      const message = `${label} must be at least ${minLength} characters`;
      setValidationError(message);
      toast({
        title: "Answer too short",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setValidationError(null);

    setIsSubmitting(true);
    onError?.(null);

    try {
      // Update form data with the submitted value
      const updatedFormData = {
        ...formData,
        [questionKey]: value.trim(),
      };
      setFormData(updatedFormData);
      
      // Save to Zustand store immediately for persistence
      if (store) {
        store.getState().setStep2FormData(updatedFormData);
      }

      // Check if all fields are now filled
      const allFilled = updatedFormData.product.trim() && 
                       updatedFormData.targetAudience.trim() && 
                       updatedFormData.problem.trim() && 
                       updatedFormData.features.trim() && 
                       updatedFormData.delivery.trim() && 
                       updatedFormData.pricing.trim();

      if (allFilled) {
        // Submit all data to backend
        await submitStep2Intake(sessionRef.current.id, updatedFormData);
        
        const updatedSession: ProductRefinerSession = {
          ...sessionRef.current,
          step2Completed: true,
          step2Product: updatedFormData.product,
          step2TargetAudience: updatedFormData.targetAudience,
          step2Problem: updatedFormData.problem,
          step2Features: updatedFormData.features,
          step2Delivery: updatedFormData.delivery,
          step2Pricing: updatedFormData.pricing,
          currentStep: 3,
        };
        onSessionChange(updatedSession);
        setCurrentQuestionKey(null);
        setCurrentInputValue("");
      } else {
        // Move to next question using updated form data
        const nextQuestion = getNextQuestion(updatedFormData);
        if (nextQuestion) {
          const questionIndex = questions.findIndex(q => q.key === nextQuestion.key);
          if (questionIndex >= 0) {
            setCurrentQuestionKey(nextQuestion.key);
            setCurrentInputValue("");
            // Mark current question as answered
            setAnsweredQuestions(prev => new Set([...prev, questionKey]));
          } else {
            setCurrentQuestionKey(null);
            setCurrentInputValue("");
          }
        } else {
          setCurrentQuestionKey(null);
          setCurrentInputValue("");
        }
      }
    } catch (error: any) {
      const message = error?.message || "Failed to submit answer";
      onError?.(message);
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, getNextQuestion, onError, onSessionChange, questions, toast, isSubmitting]);

  // Expose input handlers to parent component
  const onInputHandlersReadyRef = useRef(onInputHandlersReady);
  const prevHandlersStateRef = useRef<string>("");
  const prevShouldProvideHandlersRef = useRef<boolean>(false);
  const handleSingleFieldSubmitRef = useRef(handleSingleFieldSubmit);
  
  useEffect(() => {
    onInputHandlersReadyRef.current = onInputHandlersReady;
    handleSingleFieldSubmitRef.current = handleSingleFieldSubmit;
  }, [onInputHandlersReady, handleSingleFieldSubmit]);
  
  useEffect(() => {
    if (!onInputHandlersReadyRef.current) return;
    
    // Only provide handlers when Step 2 is active and not completed
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
        if (currentQuestionKey && currentInputValue.trim()) {
          handleSingleFieldSubmitRef.current(currentQuestionKey, currentInputValue);
        } else if (currentQuestionKey) {
          const minLength = QUESTION_MIN_LENGTHS[currentQuestionKey] ?? 3;
          const label = currentQuestion?.label || "This field";
          const trimmed = currentInputValue.trim();
          if (!trimmed) {
            setValidationError(`${label} is required`);
          } else if (trimmed.length < minLength) {
            setValidationError(`${label} must be at least ${minLength} characters`);
          }
        }
      };
      const handleInputChange = (value: string) => {
        setCurrentInputValue(value);
        // Clear validation error when user starts typing
        if (
          validationError &&
          value.trim().length >= (QUESTION_MIN_LENGTHS[currentQuestionKey ?? ""] ?? 3)
        ) {
          setValidationError(null);
        }
      };
      
      const minLength = currentQuestionKey
        ? QUESTION_MIN_LENGTHS[currentQuestionKey] ?? 10
        : 10;
      const hintLabel = currentQuestion?.label || "Answer";
      const trimmed = currentInputValue.trim();
      const showHint = trimmed.length > 0 && trimmed.length < minLength;
      onInputHandlersReadyRef.current({
        inputValue: currentInputValue,
        onInputChange: handleInputChange,
        onInputSubmit: wrappedSubmit,
        isSubmitting,
        placeholder: currentQuestion ? `Answer question ${(questions.findIndex(q => q.key === currentQuestionKey) || 0) + 1} of ${TOTAL_QUESTIONS}...` : "Enter your answer",
        currentQuestionKey,
        currentQuestionLabel: currentQuestion?.label || null,
        validationError: validationError,
        validationHint: showHint ? `${hintLabel} • minimum ${minLength} characters` : null,
      });
      prevShouldProvideHandlersRef.current = true;
    } else {
      // Only call null if we previously provided handlers (avoid unnecessary updates)
      if (prevShouldProvide) {
        onInputHandlersReadyRef.current(null);
      }
      prevShouldProvideHandlersRef.current = false;
    }
  }, [isActive, isCompleted, currentQuestionKey, currentInputValue, isSubmitting, questions, validationError]);


  if (!isUnlocked && !isActive && !isCompleted) {
    return null;
  }

  return (
    <>
      {(isActive || isCompleted) && (
        <>
          <div className="margo-chat-bubble margo-chat-bubble--bot">
            <div className="margo-message-content">
              {isCompleted ? (
                <p>Great! Now let's collect information about your product. We'll ask you a series of questions, and I'll provide examples for each one to guide you.</p>
              ) : (
                <ChunkedText
                  text={`Great! Now let's collect information about your product. We'll ask you a series of questions, and I'll provide examples for each one to guide you.`}
                  staggerMs={30}
                />
              )}
            </div>
          </div>

          {/* ChatGPT-style: Show ALL questions with answers + current active question */}
          {questions.map((question, index) => {
            // Check multiple sources for answer (Zustand store > formData > session > empty)
            const zustandValue = persistedFormData?.[question.key as keyof typeof persistedFormData];
            const formDataValue = formData[question.key as keyof typeof formData];
            const sessionValue = question.key === "product" ? session.step2Product :
                                 question.key === "targetAudience" ? session.step2TargetAudience :
                                 question.key === "problem" ? session.step2Problem :
                                 question.key === "features" ? session.step2Features :
                                 question.key === "delivery" ? session.step2Delivery :
                                 question.key === "pricing" ? session.step2Pricing : null;
            
            // Priority: Zustand store > formData > session > empty
            const answerValue = zustandValue || formDataValue || sessionValue || "";
            const hasAnswer = !!(answerValue && answerValue.trim());
            
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
            
            // Use the best available answer value
            const answer = answerValue || "";

            const questionNumber = index + 1;

            return (
              <div
                key={question.key}
                className="space-y-1"
                ref={isActiveQuestion && !isCompleted ? (el) => {
                  activeQuestionRef.current = el;
                } : undefined}
              >
                {/* Question */}
                <div className="margo-chat-bubble margo-chat-bubble--bot">
                  <div className="margo-message-content">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-gray-700">
                        Question {questionNumber} of {TOTAL_QUESTIONS}
                      </p>
                      {isCompleted ? (
                        <p className="text-base text-gray-900">{question.label}</p>
                      ) : (
                        <ChunkedText
                          text={question.label}
                          chunkClassName="text-base text-gray-900"
                          staggerMs={30}
                        />
                      )}
                      {isAnswered && (
                        <span className="inline-block rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 mt-1 transition-opacity duration-300 opacity-100">
                          ✓ Saved
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Example Inspiration - Only show when active (not completed) */}
                {isActiveQuestion && !isCompleted && (
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content p-0">
                      <div className="rounded-2xl border border-gray-200 bg-white">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                          <div className="flex items-center gap-2 text-gray-900 font-medium">
                            <Lightbulb className="w-4 h-4 text-vox-pink" />
                            <span>Example Inspiration</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleExampleClick(question.key, question.example || "")}
                              className="text-sm font-semibold text-vox-pink hover:text-vox-pink/80 transition-colors"
                            >
                              Use this example
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowExamples(prev => ({
                                  ...prev,
                                  [question.key]: !prev[question.key]
                                }));
                              }}
                              className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                              aria-label={showExamples[question.key] ? "Hide example" : "Show example"}
                            >
                              {showExamples[question.key] ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {showExamples[question.key] && question.example && (
                          <div className="px-4 py-4 space-y-3">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {question.example}
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

                {/* User's Answer */}
                {isAnswered && answer && (
                  <div className="margo-chat-bubble margo-chat-bubble--user">
                    <div className="margo-message-content">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{answer}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!isCompleted && <div className="h-4" aria-hidden />}
        </>
      )}

      {isCompleted && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <p className="text-sm text-gray-600">✓ Step 2 completed - Product intake information saved</p>
          </div>
        </div>
      )}
    </>
  );
};

