import { useEffect, useState, useCallback, useRef } from "react";

import { useToast } from "@/hooks/use-toast";
import { submitStep7ValueStack, type ValueStackData } from "@/lib/product-refiner-api";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { useProductRefinerStore } from "@/stores/productRefinerStore";
import type { StepPersistedState } from "@/stores/productRefinerStore";


export interface ProductRefinerStep7InputHandlers {
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

interface ProductRefinerStep7Props {
  workspaceId: string;
  session: ProductRefinerSession;
  isActive: boolean;
  isCompleted: boolean;
  onSessionChange: (session: ProductRefinerSession) => void;
  onError?: (message: string | null) => void;
  isUnlocked?: boolean;

  onInputHandlersReady?: (handlers: ProductRefinerStep7InputHandlers | null) => void;
  persistedState?: StepPersistedState | null;
  onPersistedStateChange?: (state: StepPersistedState | null) => void;
}

type QuestionKey = 
  | `component-${number}`
  | `bonus-${number}`
  | `support-${number}`
  | "logistics"
  | "ask-more-bonuses"
  | "ask-more-support";

export const ProductRefinerStep7 = ({
  workspaceId,
  session,
  isActive,
  isCompleted,
  onSessionChange,
  onError,
  isUnlocked = false,

  onInputHandlersReady,
  persistedState,
  onPersistedStateChange,
}: ProductRefinerStep7Props) => {
  const COMPONENT_MIN_LENGTH = 5;
  const { toast } = useToast();
  
  // Use Zustand store for persistence (ChatGPT-style)
  const store = useProductRefinerStore(workspaceId);
  
  // Check if session already has server data for this step
  const sessionHasStep7Data = !!session.step7ValueStack;
  
  // Allow Zustand restore when either the session already has step data
  // or we have a persisted UI snapshot (page refresh mid-step)
  const canUsePersistedFormData = (sessionHasStep7Data || !!persistedState) && store?.getState().formData.step7;
  const persistedFormData = canUsePersistedFormData ? store?.getState().formData.step7 ?? null : null;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [currentInputValue, setCurrentInputValue] = useState(persistedState?.currentInputValue || "");
  const [currentQuestionKey, setCurrentQuestionKey] = useState<QuestionKey | null>(persistedState?.currentQuestionKey as QuestionKey | null || null);
  
  // Initialize from session OR the persisted Zustand snapshot (for refresh persistence)
  // BUT: If session is fresh (no step7 data) and we have no persisted UI state, treat it as a reset
  const [valueStack, setValueStack] = useState<ValueStackData>(() => {
    // Priority: session data > stored form data > empty defaults
    if (session.step7ValueStack) {
      return session.step7ValueStack as ValueStackData;
    }
    if (persistedFormData) {
      return persistedFormData as ValueStackData;
    }
    return {
      components: [""],
      bonuses: [],
      supportElements: [],
      logistics: "",
    };
  });

  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(
    persistedState?.answeredQuestions ? new Set(persistedState.answeredQuestions) : new Set()
  );
  // Track question order for ChatGPT-style history (all questions in chronological order)
  const [questionOrder, setQuestionOrder] = useState<string[]>(() => {
    // Restore from persisted state if available
    if (persistedState?.questionOrder) {
      return persistedState.questionOrder;
    }
    return [];
  });
  // Track user answers for all questions (including blank/skipped)
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>(() => {
    // Restore from persisted state if available
    if (persistedState?.questionAnswers) {
      return persistedState.questionAnswers;
    }
    return {};
  });
  // Track which optional questions were skipped (for proper display)
  const [skippedQuestions, setSkippedQuestions] = useState<Set<string>>(() => {
    const skipped = new Set<string>();
    // Check persisted state for skipped questions
    if (persistedState?.questionAnswers) {
      Object.entries(persistedState.questionAnswers).forEach(([key, value]) => {
        // If answer is empty or "no", it was skipped
        if (!value || value.trim() === "" || value.toLowerCase() === "no") {
          if (key.startsWith("bonus-") || key.startsWith("support-") || key === "logistics" || 
              key === "ask-more-bonuses" || key === "ask-more-support") {
            skipped.add(key);
          }
        }
      });
    }
    return skipped;
  });
  const sessionRef = useRef<ProductRefinerSession>(session);
  const isManuallyNavigatingRef = useRef(false); // Prevent useEffect from interfering with manual navigation

  // Helper function to detect skip commands
  const isSkipCommand = useCallback((value: string): boolean => {
    const skipCommands = ["skip", "no", "n", "leave it", "leave", "none", "not needed", "pass", "done"];
    return skipCommands.includes(value.trim().toLowerCase());
  }, []);

  const isAffirmativeResponse = useCallback((value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    const affirmativeCommands = ["yes", "y", "yeah", "yep", "yup", "sure", "ok", "okay", "add", "add more", "please", "let's do it", "continue"];
    return affirmativeCommands.includes(normalized);
  }, []);

  useEffect(() => {
    // Skip if we're manually navigating (prevents blinking during navigation)
    if (isManuallyNavigatingRef.current) {
      return;
    }
    
    sessionRef.current = session;
    // Priority: session data > (Zustand store when we have session data or a persisted UI snapshot) > empty
    const sessionData = session.step7ValueStack ? session.step7ValueStack as ValueStackData : null;
    // Allow restoring from Zustand when we know we have prior progress (session data or persisted UI state)
    const zustandData = (sessionHasStep7Data || !!persistedState) && persistedFormData ? persistedFormData as ValueStackData : null;
    
    const dataToUse = sessionData || zustandData;
    
    if (dataToUse) {
      // Only update if different to prevent unnecessary re-renders
      const currentDataString = JSON.stringify(valueStack);
      const newDataString = JSON.stringify(dataToUse);
      
      if (currentDataString !== newDataString) {
        setValueStack(dataToUse);
        
        // Save to Zustand store for persistence
        if (store && sessionData) {
          store.getState().setStep7FormData(sessionData);
        }
        
        // Initialize answered questions
        const answered = new Set<string>();
        dataToUse.components?.forEach((comp, idx) => {
          if (comp.trim()) answered.add(`component-${idx}`);
        });
        dataToUse.bonuses?.forEach((bonus, idx) => {
          if (bonus.trim()) answered.add(`bonus-${idx}`);
        });
        dataToUse.supportElements?.forEach((support, idx) => {
          if (support.trim()) answered.add(`support-${idx}`);
        });
        if (dataToUse.logistics?.trim() || answered.has("logistics-skipped")) {
          answered.add("logistics");
        }
        // Merge with persistedState answeredQuestions if available (for refresh scenarios)
        if (persistedState?.answeredQuestions) {
          persistedState.answeredQuestions.forEach(q => answered.add(q));
        }
        setAnsweredQuestions(answered);
      }
    }
  }, [session.step7ValueStack, session, persistedFormData, store, sessionHasStep7Data, persistedState, valueStack]);
  
  // Restore from Zustand store on mount (for ChatGPT-style persistence after refresh)
  // Allow restore when session already has data OR when we have persisted UI state (page refresh mid-step)
  useEffect(() => {
    if ((sessionHasStep7Data || !!persistedState) && persistedFormData) {
      const hasZustandData = (persistedFormData as ValueStackData).components?.some(c => c.trim()) ||
        (persistedFormData as ValueStackData).bonuses?.some(b => b.trim()) ||
        (persistedFormData as ValueStackData).supportElements?.some(s => s.trim()) ||
        (persistedFormData as ValueStackData).logistics?.trim();
      const hasFormData = valueStack.components?.some(c => c.trim()) ||
        valueStack.bonuses?.some(b => b.trim()) ||
        valueStack.supportElements?.some(s => s.trim()) ||
        valueStack.logistics?.trim();
      
      // Only restore if we have Zustand data but no formData (page refresh scenario)
      if (hasZustandData && !hasFormData) {
        // Restore from Zustand store
        setValueStack(persistedFormData as ValueStackData);
        
        // Mark all answered questions
        const answered = new Set<string>();
        const data = persistedFormData as ValueStackData;
        data.components?.forEach((comp, idx) => {
          if (comp.trim()) answered.add(`component-${idx}`);
        });
        data.bonuses?.forEach((bonus, idx) => {
          if (bonus.trim()) answered.add(`bonus-${idx}`);
        });
        data.supportElements?.forEach((support, idx) => {
          if (support.trim()) answered.add(`support-${idx}`);
        });
        if (data.logistics?.trim()) {
          answered.add("logistics");
        }
        setAnsweredQuestions(answered);
      }
    }
  }, [sessionHasStep7Data, valueStack, persistedFormData, persistedState]); // Only run on mount

  // Initialize current question when step becomes active
  useEffect(() => {
    // Skip if we're manually navigating (prevents blinking during navigation)
    if (isManuallyNavigatingRef.current) {
      return;
    }
    
    if (isActive && !isCompleted) {
      // Find first unanswered question
      const components = valueStack.components || [""];
      const validComponents = components.filter(c => c.trim().length >= COMPONENT_MIN_LENGTH);
      
      if (validComponents.length === 0) {
        // Need at least one component
        const firstEmptyIndex = components.findIndex(c => !c.trim());
        if (firstEmptyIndex >= 0) {
          setCurrentQuestionKey(`component-${firstEmptyIndex}`);
          setCurrentInputValue(components[firstEmptyIndex] || "");
        } else {
          // Add new component
          setCurrentQuestionKey(`component-${components.length}`);
          setCurrentInputValue("");
        }
      } else {
        // Components done, check next question
        determineNextQuestion();
      }
    }
  }, [isActive, isCompleted, valueStack]);

  const determineNextQuestion = () => {
    const components = valueStack.components || [];
    const validComponents = components.filter(c => c.trim().length >= COMPONENT_MIN_LENGTH);
    
    if (validComponents.length === 0) {
      // Need components first
      return;
    }


    // Check if we've asked about bonuses
    if (!answeredQuestions.has("ask-more-bonuses")) {
      setCurrentQuestionKey("ask-more-bonuses");
      setCurrentInputValue("");
      return;
    }

    // Check bonuses
    const bonuses = valueStack.bonuses || [];
    const bonusAnswered = bonuses.some(b => b.trim());
    if (bonusAnswered && !answeredQuestions.has(`bonus-${bonuses.length - 1}`)) {
      // Check if there are more bonuses to add
      const lastBonus = bonuses[bonuses.length - 1];
      if (lastBonus.trim()) {
        setCurrentQuestionKey("ask-more-bonuses");
        setCurrentInputValue("");
        return;
      }
    }

    // Check if we've asked about support elements
    if (!answeredQuestions.has("ask-more-support")) {
      setCurrentQuestionKey("ask-more-support");
      setCurrentInputValue("");
      return;
    }

    // Check support elements
    const supportElements = valueStack.supportElements || [];
    const supportAnswered = supportElements.some(s => s.trim());
    if (supportAnswered && !answeredQuestions.has(`support-${supportElements.length - 1}`)) {
      // Check if there are more support elements to add
      const lastSupport = supportElements[supportElements.length - 1];
      if (lastSupport.trim()) {
        setCurrentQuestionKey("ask-more-support");
        setCurrentInputValue("");
        return;
      }
    }

    // Check logistics
    if (!answeredQuestions.has("logistics")) {
      setCurrentQuestionKey("logistics");
      setCurrentInputValue(valueStack.logistics || "");
      return;
    }

    // All done - ready to submit
    setCurrentQuestionKey(null);
    setCurrentInputValue("");
    handleFinalSubmit();
  };

  const handleQuestionSubmit = useCallback(async (questionKey: QuestionKey, value: string) => {
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

    // Handle component questions
    if (questionKey.startsWith("component-")) {
      const index = parseInt(questionKey.split("-")[1]);
      if (!trimmedValue) {
        setValidationError("Component is required");
        return;
      }
      if (trimmedValue.length < COMPONENT_MIN_LENGTH) {
        setValidationError(`Component must be at least ${COMPONENT_MIN_LENGTH} characters`);
        return;
      }

      setValidationError(null);
      setIsSubmitting(true);
      
      try {
        const updated = [...(valueStack.components || [])];
        updated[index] = trimmedValue;
        const newValueStack = { ...valueStack, components: updated };
        setValueStack(newValueStack);
        
        // Save to Zustand store immediately for persistence
        if (store) {
          store.getState().setStep7FormData(newValueStack);
        }
        
        setAnsweredQuestions(prev => new Set([...prev, questionKey]));
        
        // Track question in chronological order and store answer
        setQuestionOrder(prev => {
          if (prev.includes(questionKey)) return prev;
          return [...prev, questionKey];
        });
        setQuestionAnswers(prev => ({ ...prev, [questionKey]: trimmedValue }));
        
        // Move to next question
        setTimeout(() => {
          determineNextQuestion();
          setIsSubmitting(false);
        }, 100);
      } catch (error: any) {
        setIsSubmitting(false);
        setValidationError(error?.message || "Failed to save component");
      }
      return;
    }

    // Handle "ask-more-bonuses" question
    if (questionKey === "ask-more-bonuses") {
      // Allow blank submission for optional questions
      if (!trimmedValue) {
        // Treat blank as skip for optional questions
        setValidationError(null);
        setIsSubmitting(true);
        setAnsweredQuestions(prev => new Set([...prev, "ask-more-bonuses"]));
        
        // Track question in chronological order and store answer
        const answerText = "no";
        setQuestionOrder(prev => prev.includes("ask-more-bonuses") ? prev : [...prev, "ask-more-bonuses"]);
        setQuestionAnswers(prev => ({ ...prev, "ask-more-bonuses": answerText }));
        
        // Track skipped state
        setSkippedQuestions(prev => new Set([...prev, "ask-more-bonuses"]));
        
        // Skip bonuses - move to support elements
        setTimeout(() => {
          if (!answeredQuestions.has("ask-more-support")) {
            setCurrentQuestionKey("ask-more-support");
            setCurrentInputValue("");
          } else {
            determineNextQuestion();
          }
          setIsSubmitting(false);
        }, 100);
        return;
      }
      
      const wantsToSkip = isSkipCommand(trimmedValue);
      const wantsToAdd = isAffirmativeResponse(trimmedValue);
      
      if (!wantsToSkip && !wantsToAdd) {
        setValidationError("Please respond with yes to add bonuses or no/skip to continue.");
        return;
      }
      
      setValidationError(null);
      setIsSubmitting(true);
      setAnsweredQuestions(prev => new Set([...prev, "ask-more-bonuses"]));
      
      // Track question in chronological order and store answer
      const answerText = wantsToSkip ? "no" : "yes";
      setQuestionOrder(prev => prev.includes("ask-more-bonuses") ? prev : [...prev, "ask-more-bonuses"]);
      setQuestionAnswers(prev => ({ ...prev, "ask-more-bonuses": answerText }));
      
      // Track skipped state
      if (wantsToSkip) {
        setSkippedQuestions(prev => new Set([...prev, "ask-more-bonuses"]));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete("ask-more-bonuses");
          return next;
        });
      }
      
      if (wantsToSkip) {
        // Skip bonuses - move to support elements
        setTimeout(() => {
          if (!answeredQuestions.has("ask-more-support")) {
            setCurrentQuestionKey("ask-more-support");
            setCurrentInputValue("");
          } else {
            determineNextQuestion();
          }
          setIsSubmitting(false);
        }, 100);
        return;
      }

      // User wants to add bonus - add new bonus entry
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      const bonuses = valueStack.bonuses || [];
      const newIndex = bonuses.length;
      const newValueStack = { ...valueStack, bonuses: [...bonuses, ""] };
      
      // Batch state updates to prevent blinking
      setValueStack(newValueStack);
      setCurrentQuestionKey(`bonus-${newIndex}`);
      setCurrentInputValue("");
      
      // Save to Zustand store immediately for persistence
      if (store) {
        store.getState().setStep7FormData(newValueStack);
      }
      
      // Reset navigation flag and submitting state after a small delay
      setTimeout(() => {
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
      }, 200);
      return;
    }

    // Handle bonus questions (optional)
    if (questionKey.startsWith("bonus-")) {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      setIsSubmitting(true);
      setValidationError(null);
      const index = parseInt(questionKey.split("-")[1]);
      const bonuses = valueStack.bonuses || [];
      const updated = [...bonuses];
      // Allow blank or skip command for optional bonus
      const isSkipped = isSkipCommand(trimmedValue) || !trimmedValue;
      updated[index] = isSkipped ? "" : trimmedValue;
      const newValueStack = { ...valueStack, bonuses: updated };
      
      // Batch state updates to prevent blinking
      setValueStack(newValueStack);
      setAnsweredQuestions(prev => new Set([...prev, questionKey]));
      
      // Track question in chronological order and store answer (including blank/skipped)
      const answerText = isSkipped ? "" : trimmedValue;
      setQuestionOrder(prev => prev.includes(questionKey) ? prev : [...prev, questionKey]);
      setQuestionAnswers(prev => ({ ...prev, [questionKey]: answerText }));
      
      // Track skipped state
      if (isSkipped) {
        setSkippedQuestions(prev => new Set([...prev, questionKey]));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete(questionKey);
          return next;
        });
      }
      
      // Save to Zustand store immediately for persistence
      if (store) {
        store.getState().setStep7FormData(newValueStack);
      }
      
      // Ask if they want more bonuses - show "Saving..." for a moment
      setTimeout(() => {
        setCurrentQuestionKey("ask-more-bonuses");
        setCurrentInputValue("");
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
      }, 200);
      return;
    }

    // Handle "ask-more-support" question
    if (questionKey === "ask-more-support") {
      // Allow blank submission for optional questions
      if (!trimmedValue) {
        // Treat blank as skip for optional questions
        setValidationError(null);
        setIsSubmitting(true);
        setAnsweredQuestions(prev => new Set([...prev, "ask-more-support"]));
        
        // Track question in chronological order and store answer
        const answerText = "no";
        setQuestionOrder(prev => prev.includes("ask-more-support") ? prev : [...prev, "ask-more-support"]);
        setQuestionAnswers(prev => ({ ...prev, "ask-more-support": answerText }));
        
        // Track skipped state
        setSkippedQuestions(prev => new Set([...prev, "ask-more-support"]));
        
        // Skip support elements - move to logistics
        setTimeout(() => {
          setCurrentQuestionKey("logistics");
          setCurrentInputValue(valueStack.logistics || "");
          setIsSubmitting(false);
        }, 100);
        return;
      }
      
      const wantsToSkip = isSkipCommand(trimmedValue);
      const wantsToAdd = isAffirmativeResponse(trimmedValue);
      
      if (!wantsToSkip && !wantsToAdd) {
        setValidationError("Please respond with yes to add support elements or no/skip to continue.");
        return;
      }
      
      setValidationError(null);
      setIsSubmitting(true);
      setAnsweredQuestions(prev => new Set([...prev, "ask-more-support"]));
      
      // Track question in chronological order and store answer
      const answerText = wantsToSkip ? "no" : "yes";
      setQuestionOrder(prev => prev.includes("ask-more-support") ? prev : [...prev, "ask-more-support"]);
      setQuestionAnswers(prev => ({ ...prev, "ask-more-support": answerText }));
      
      // Track skipped state
      if (wantsToSkip) {
        setSkippedQuestions(prev => new Set([...prev, "ask-more-support"]));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete("ask-more-support");
          return next;
        });
      }
      
      if (wantsToSkip) {
        // Skip support elements - move to logistics
        setTimeout(() => {
          setCurrentQuestionKey("logistics");
          setCurrentInputValue(valueStack.logistics || "");
          setIsSubmitting(false);
        }, 100);
        return;
      }

      // User wants to add support element - add new entry
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      const supportElements = valueStack.supportElements || [];
      const newIndex = supportElements.length;
      const newValueStack = { ...valueStack, supportElements: [...supportElements, ""] };
      
      // Batch state updates to prevent blinking
      setValueStack(newValueStack);
      setCurrentQuestionKey(`support-${newIndex}`);
      setCurrentInputValue("");
      
      // Save to Zustand store immediately for persistence
      if (store) {
        store.getState().setStep7FormData(newValueStack);
      }
      
      // Reset navigation flag and submitting state after a small delay
      setTimeout(() => {
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
      }, 200);
      return;
    }

    // Handle support element questions (optional)
    if (questionKey.startsWith("support-")) {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      setIsSubmitting(true);
      setValidationError(null);
      const index = parseInt(questionKey.split("-")[1]);
      const supportElements = valueStack.supportElements || [];
      const updated = [...supportElements];
      // Allow blank or skip command for optional support
      const isSkipped = isSkipCommand(trimmedValue) || !trimmedValue;
      updated[index] = isSkipped ? "" : trimmedValue;
      const newValueStack = { ...valueStack, supportElements: updated };
      
      // Batch state updates to prevent blinking
      setValueStack(newValueStack);
      setAnsweredQuestions(prev => new Set([...prev, questionKey]));
      
      // Track question in chronological order and store answer (including blank/skipped)
      const answerText = isSkipped ? "" : trimmedValue;
      setQuestionOrder(prev => prev.includes(questionKey) ? prev : [...prev, questionKey]);
      setQuestionAnswers(prev => ({ ...prev, [questionKey]: answerText }));
      
      // Track skipped state
      if (isSkipped) {
        setSkippedQuestions(prev => new Set([...prev, questionKey]));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete(questionKey);
          return next;
        });
      }
      
      // Save to Zustand store immediately for persistence
      if (store) {
        store.getState().setStep7FormData(newValueStack);
      }
      
      // Ask if they want more support elements - show "Saving..." for a moment
      setTimeout(() => {
        setCurrentQuestionKey("ask-more-support");
        setCurrentInputValue("");
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
      }, 200);
      return;
    }

    // Handle logistics question (optional, last question)
    if (questionKey === "logistics") {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      setValidationError(null);
      setIsSubmitting(true);
      
      // Allow blank or skip command for optional logistics
      const isSkipped = isSkipCommand(trimmedValue) || !trimmedValue;
      const finalValue = isSkipped ? "" : trimmedValue;
      const newValueStack = { ...valueStack, logistics: finalValue };
      
      // Batch state updates to prevent blinking
      setValueStack(newValueStack);
      setAnsweredQuestions(prev => new Set([...prev, "logistics"]));
      
      // Track question in chronological order and store answer (including blank/skipped)
      const answerText = finalValue;
      setQuestionOrder(prev => prev.includes("logistics") ? prev : [...prev, "logistics"]);
      setQuestionAnswers(prev => ({ ...prev, "logistics": answerText }));
      
      // Track skipped state
      if (isSkipped) {
        setSkippedQuestions(prev => new Set([...prev, "logistics"]));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete("logistics");
          return next;
        });
      }
      
      // Save to Zustand store immediately for persistence
      if (store) {
        store.getState().setStep7FormData(newValueStack);
      }
      
      // Ready to submit - keep navigation flag until submit completes
      // Use a longer delay to prevent blinking
      setTimeout(() => {
        isManuallyNavigatingRef.current = false; // Reset before submit to prevent blinking
        handleFinalSubmit();
      }, 300);
    }
  }, [valueStack, session, toast, isSkipCommand, answeredQuestions]);

  const handleFinalSubmit = async () => {
    const currentSession = sessionRef.current || session;
    if (!currentSession?.id) return;

    const validComponents = (valueStack.components || []).filter(c => 
      c.trim().length >= COMPONENT_MIN_LENGTH
    );

    if (validComponents.length === 0) {

      setValidationError("At least one component is required");
      // Go back to asking for components
      const components = valueStack.components || [""];
      setCurrentQuestionKey(`component-${components.length}`);
      setCurrentInputValue("");
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);
    onError?.(null);

    try {

      await submitStep7ValueStack(currentSession.id, {
        valueStack: {
          ...valueStack,
          components: validComponents,
        },
      });
      
      const updatedSession: ProductRefinerSession = {

        ...currentSession,
        step7ValueStack: {
          ...valueStack,
          components: validComponents,
        },
        step7Completed: true,
        currentStep: 8,
      };
      onSessionChange(updatedSession);

      setCurrentQuestionKey(null);
      setCurrentInputValue("");
    } catch (error: any) {
      const message = error?.message || "Failed to submit value stack";
      onError?.(message);
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      isManuallyNavigatingRef.current = false; // Reset navigation flag
      setIsSubmitting(false);
    }
  };


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
      const getQuestionLabel = (key: QuestionKey): string => {
        if (key.startsWith("component-")) {
          const index = parseInt(key.split("-")[1]);
          return `What is core component ${index + 1}?`;
        }
        if (key === "ask-more-bonuses") {
          return "Do you want to add any bonuses? (Optional — you can skip this)";
        }
        if (key.startsWith("bonus-")) {
          const index = parseInt(key.split("-")[1]);
          return `What is bonus ${index + 1}? (Optional — you can skip this)`;
        }
        if (key === "ask-more-support") {
          return "Do you want to add any support elements? (Optional — you can skip this)";
        }
        if (key.startsWith("support-")) {
          const index = parseInt(key.split("-")[1]);
          return `What is support element ${index + 1}? (Optional — you can skip this)`;
        }
        if (key === "logistics") {
          return "What are the logistics and delivery details? (Optional — you can skip this)";
        }
        return "";
      };

      const isOptional = currentQuestionKey === "logistics" || 
                        currentQuestionKey === "ask-more-bonuses" ||
                        currentQuestionKey === "ask-more-support" ||
                        currentQuestionKey?.startsWith("bonus-") ||
                        currentQuestionKey?.startsWith("support-");
      const isOptionQuestion = currentQuestionKey === "ask-more-bonuses" || currentQuestionKey === "ask-more-support";
      
      const wrappedSubmit = () => {
        if (currentQuestionKey) {
          handleQuestionSubmitRef.current(currentQuestionKey, currentInputValue);
        }
      };
      
      const handleInputChange = (value: string) => {
        setCurrentInputValue(value);
        if (!validationError) {
          return;
        }
        if (isOptionQuestion) {
          if (isAffirmativeResponse(value) || isSkipCommand(value)) {
            setValidationError(null);
          }
          return;
        }
        if (!isOptional || !isSkipCommand(value)) {
          setValidationError(null);
        }
      };
      
      const questionLabel = getQuestionLabel(currentQuestionKey);
      
      // Use generic placeholder like Step 6, not the full question
      const placeholder = "Enter your answer...";
      
      onInputHandlersReadyRef.current({
        inputValue: currentInputValue,
        onInputChange: handleInputChange,
        onInputSubmit: wrappedSubmit,
        isSubmitting,
        placeholder: placeholder,
        currentQuestionKey: currentQuestionKey,
        currentQuestionLabel: questionLabel,
        validationError: validationError,
        validationHint: isOptionQuestion ? "Type yes to add more or no to continue." : null,
      });
      prevShouldProvideHandlersRef.current = true;
    } else {
      // Only call null if we previously provided handlers (avoid unnecessary updates)
      if (prevShouldProvide) {
        onInputHandlersReadyRef.current(null);
      }
      prevShouldProvideHandlersRef.current = false;
    }
  }, [isActive, isCompleted, currentQuestionKey, currentInputValue, isSubmitting, validationError, isSkipCommand, isAffirmativeResponse]); // Removed handleQuestionSubmit, onInputHandlersReady, and valueStack from deps

  // Persist UI state whenever it changes (for refresh persistence)
  const prevPersistedStateRef = useRef<{
    currentQuestionKey: string | null;
    currentInputValue: string;
    answeredQuestions: string[];
    questionOrder: string[];
    questionAnswers: Record<string, string>;
    isCompleted: boolean;
    isActive: boolean;
  } | null>(null);
  const onPersistedStateChangeRef = useRef(onPersistedStateChange);
  
  useEffect(() => {
    onPersistedStateChangeRef.current = onPersistedStateChange;
  }, [onPersistedStateChange]);
  
  useEffect(() => {
    const callback = onPersistedStateChangeRef.current;
    if (!callback) return;
    
    const answeredQuestionsArray = Array.from(answeredQuestions).sort();
    const hasState =
      answeredQuestionsArray.length > 0 ||
      (currentQuestionKey !== null && currentQuestionKey !== undefined) ||
      (currentInputValue && currentInputValue.trim().length > 0) ||
      questionOrder.length > 0 ||
      Object.keys(questionAnswers ?? {}).length > 0;
    
    if (!hasState) {
      if (prevPersistedStateRef.current) {
        prevPersistedStateRef.current = null;
        callback(null);
      }
      return;
    }

    const state: StepPersistedState = {
      currentQuestionKey: currentQuestionKey,
      currentInputValue,
      answeredQuestions: answeredQuestionsArray,
      questionOrder: questionOrder,
      questionAnswers: questionAnswers,
    };

    const prevState = prevPersistedStateRef.current;
    const stateChanged = !prevState || 
        prevState.currentQuestionKey !== state.currentQuestionKey ||
        prevState.currentInputValue !== state.currentInputValue ||
        prevState.answeredQuestions.length !== state.answeredQuestions.length ||
        prevState.answeredQuestions.some((q, i) => q !== state.answeredQuestions[i]) ||
        JSON.stringify(prevState.questionOrder) !== JSON.stringify(state.questionOrder) ||
        JSON.stringify(prevState.questionAnswers) !== JSON.stringify(state.questionAnswers) ||
        prevState.isCompleted !== isCompleted ||
        prevState.isActive !== isActive;
    
    if (stateChanged) {
      prevPersistedStateRef.current = {
        currentQuestionKey: state.currentQuestionKey,
        currentInputValue: state.currentInputValue,
        answeredQuestions: [...state.answeredQuestions],
        questionOrder: state.questionOrder ? [...state.questionOrder] : [],
        questionAnswers: state.questionAnswers ? { ...state.questionAnswers } : {},
        isCompleted,
        isActive,
      };
      callback(state);
    }
  }, [currentQuestionKey, currentInputValue, answeredQuestions, questionOrder, questionAnswers, isCompleted, isActive]);

  // Restore from persistedState on mount/refresh
  useEffect(() => {
    // Skip if we're manually navigating (prevents blinking during navigation)
    if (isManuallyNavigatingRef.current) {
      return;
    }
    
    if (persistedState) {
      // Restore question order and answers first
      if (persistedState.questionOrder && persistedState.questionOrder.length > 0) {
        setQuestionOrder(persistedState.questionOrder);
      }
      if (persistedState.questionAnswers && Object.keys(persistedState.questionAnswers).length > 0) {
        setQuestionAnswers(persistedState.questionAnswers);
        
        // Restore skipped questions from questionAnswers
        const skipped = new Set<string>();
        Object.entries(persistedState.questionAnswers).forEach(([key, value]) => {
          if (!value || value.trim() === "" || value.toLowerCase() === "no") {
            if (key.startsWith("bonus-") || key.startsWith("support-") || key === "logistics" || 
                key === "ask-more-bonuses" || key === "ask-more-support") {
              skipped.add(key);
            }
          }
        });
        setSkippedQuestions(skipped);
      }
      
      // First, ensure answeredQuestions includes all questions with answers from valueStack
      const answeredFromData = new Set<string>();
      const components = valueStack.components || [];
      const bonuses = valueStack.bonuses || [];
      const supportElements = valueStack.supportElements || [];
      components.forEach((comp, idx) => {
        if (comp.trim()) answeredFromData.add(`component-${idx}`);
      });
      bonuses.forEach((bonus, idx) => {
        if (bonus.trim()) answeredFromData.add(`bonus-${idx}`);
      });
      supportElements.forEach((support, idx) => {
        if (support.trim()) answeredFromData.add(`support-${idx}`);
      });
      if (valueStack.logistics?.trim()) {
        answeredFromData.add("logistics");
      }
      // Also check questionAnswers for ask-more questions
      if (persistedState.questionAnswers) {
        if (persistedState.questionAnswers["ask-more-bonuses"]) {
          answeredFromData.add("ask-more-bonuses");
        }
        if (persistedState.questionAnswers["ask-more-support"]) {
          answeredFromData.add("ask-more-support");
        }
      }
      // Merge with persistedState answeredQuestions
      if (persistedState.answeredQuestions) {
        persistedState.answeredQuestions.forEach(q => answeredFromData.add(q));
      }
      setAnsweredQuestions(answeredFromData);
      
      // Only restore current question if it's not already answered
      if (persistedState.currentQuestionKey && !answeredFromData.has(persistedState.currentQuestionKey)) {
        setCurrentQuestionKey(persistedState.currentQuestionKey as QuestionKey);
        setCurrentInputValue(persistedState.currentInputValue || "");
      }
    }
  }, [persistedState, isActive, isCompleted, valueStack]);

  if (!isUnlocked && !isActive && !isCompleted) {
    return null;
  }


  const components = valueStack.components || [];
  const bonuses = valueStack.bonuses || [];
  const supportElements = valueStack.supportElements || [];

  // Helper function to get question label
  const getQuestionLabel = (qKey: string): string => {
    if (qKey.startsWith("component-")) {
      const idx = parseInt(qKey.split("-")[1]);
      return `What is core component ${idx + 1}?`;
    }
    if (qKey.startsWith("bonus-")) {
      const idx = parseInt(qKey.split("-")[1]);
      return `What is bonus ${idx + 1}? (Optional — you can skip this)`;
    }
    if (qKey.startsWith("support-")) {
      const idx = parseInt(qKey.split("-")[1]);
      return `What is support element ${idx + 1}? (Optional — you can skip this)`;
    }
    if (qKey === "ask-more-bonuses") {
      return "Do you want to add any bonuses? (Optional — you can skip this)";
    }
    if (qKey === "ask-more-support") {
      return "Do you want to add any support elements? (Optional — you can skip this)";
    }
    if (qKey === "logistics") {
      return "What are the logistics and delivery details? (Optional — you can skip this)";
    }
    return "";
  };

  // Helper function to get answer value
  const getAnswerValue = (qKey: string): string => {
    if (qKey.startsWith("component-")) {
      const idx = parseInt(qKey.split("-")[1]);
      return components[idx] || "";
    }
    if (qKey.startsWith("bonus-")) {
      const idx = parseInt(qKey.split("-")[1]);
      return bonuses[idx] || "";
    }
    if (qKey.startsWith("support-")) {
      const idx = parseInt(qKey.split("-")[1]);
      return supportElements[idx] || "";
    }
    if (qKey === "logistics") {
      return valueStack.logistics || "";
    }
    // For ask-more questions, use stored answer
    return questionAnswers[qKey] || "";
  };

  // Render all questions in chronological order (ChatGPT style)
  const renderQuestionHistory = () => {
    const allQuestions: string[] = [];
    const seenQuestions = new Set<string>();
    
    // If completed, include all answered questions to show full history
    if (isCompleted) {
      answeredQuestions.forEach(qKey => {
        if (!seenQuestions.has(qKey)) {
          allQuestions.push(qKey);
          seenQuestions.add(qKey);
        }
      });
    }
    
    // First, add all questions from questionOrder (maintains chronological order)
    // This is the primary source of truth for question order
    questionOrder.forEach(qKey => {
      if (!seenQuestions.has(qKey)) {
        allQuestions.push(qKey);
        seenQuestions.add(qKey);
      }
    });
    
    // Then add components in order (they come before bonuses)
    // Only add if not already in questionOrder
    components.forEach((_, idx) => {
      const qKey = `component-${idx}`;
      if (!seenQuestions.has(qKey) && (answeredQuestions.has(qKey) || (isActive && currentQuestionKey === qKey))) {
        allQuestions.push(qKey);
        seenQuestions.add(qKey);
      }
    });
    
    // Add ask-more-bonuses if answered or active (only if not already added)
    if ((answeredQuestions.has("ask-more-bonuses") || (isActive && currentQuestionKey === "ask-more-bonuses")) && !seenQuestions.has("ask-more-bonuses")) {
      allQuestions.push("ask-more-bonuses");
      seenQuestions.add("ask-more-bonuses");
    }
    
    // Add all bonuses in order (only if not already added)
    bonuses.forEach((_, idx) => {
      const qKey = `bonus-${idx}`;
      if (!seenQuestions.has(qKey) && (answeredQuestions.has(qKey) || (isActive && currentQuestionKey === qKey))) {
        allQuestions.push(qKey);
        seenQuestions.add(qKey);
      }
    });
    
    // Add ask-more-support if answered or active (only if not already added)
    if ((answeredQuestions.has("ask-more-support") || (isActive && currentQuestionKey === "ask-more-support")) && !seenQuestions.has("ask-more-support")) {
      allQuestions.push("ask-more-support");
      seenQuestions.add("ask-more-support");
    }
    
    // Add all support elements in order (only if not already added)
    supportElements.forEach((_, idx) => {
      const qKey = `support-${idx}`;
      if (!seenQuestions.has(qKey) && (answeredQuestions.has(qKey) || (isActive && currentQuestionKey === qKey))) {
        allQuestions.push(qKey);
        seenQuestions.add(qKey);
      }
    });
    
    // Add logistics if answered or active (only if not already added)
    if ((answeredQuestions.has("logistics") || (isActive && currentQuestionKey === "logistics")) && !seenQuestions.has("logistics")) {
      allQuestions.push("logistics");
      seenQuestions.add("logistics");
    }
    
    // Finally, add current question if not already included (for active questions not yet answered)
    if (currentQuestionKey && !seenQuestions.has(currentQuestionKey)) {
      allQuestions.push(currentQuestionKey);
    }

    return allQuestions.map((qKey, idx) => {
      const isAnswered = answeredQuestions.has(qKey);
      const isActiveQuestion = isActive && qKey === currentQuestionKey;
      const answer = getAnswerValue(qKey);
      const storedAnswer = questionAnswers[qKey];
      const hasAnswer = !!(answer && answer.trim()) || !!(storedAnswer && storedAnswer.trim());
      // Check if question was explicitly skipped (either in skippedQuestions set or answer is "no" for ask-more questions)
      const isSkipped = skippedQuestions.has(qKey) || 
                       (isAnswered && !hasAnswer) || 
                       (qKey === "ask-more-bonuses" && storedAnswer === "no") ||
                       (qKey === "ask-more-support" && storedAnswer === "no");
      const isOptional = qKey.startsWith("bonus-") || qKey.startsWith("support-") || qKey === "logistics" || qKey === "ask-more-bonuses" || qKey === "ask-more-support";
      
      // Show if answered, completed, currently active, or in question order
      // Also show if we have stored answer (for refresh scenarios) or if completed
      const shouldShow = isCompleted || isAnswered || isActiveQuestion || questionOrder.includes(qKey) || (storedAnswer !== undefined);
      if (!shouldShow && !isCompleted) return null;

      const questionLabel = getQuestionLabel(qKey);
      const displayAnswer = storedAnswer || answer;
      
      // Show section headers - only show once per section
      const isFirstBonusQuestion = qKey === "ask-more-bonuses" || (qKey.startsWith("bonus-") && parseInt(qKey.split("-")[1]) === 0);
      const isFirstSupportQuestion = qKey === "ask-more-support" || (qKey.startsWith("support-") && parseInt(qKey.split("-")[1]) === 0);
      const showBonusesHeader = isFirstBonusQuestion && idx === allQuestions.findIndex(q => q === "ask-more-bonuses" || q.startsWith("bonus-"));
      const showSupportHeader = isFirstSupportQuestion && idx === allQuestions.findIndex(q => q === "ask-more-support" || q.startsWith("support-"));
      const showBonusHeader = qKey.startsWith("bonus-") && parseInt(qKey.split("-")[1]) === 0 && bonuses.length > 0 && !showBonusesHeader;
      const showSupportElementHeader = qKey.startsWith("support-") && parseInt(qKey.split("-")[1]) === 0 && supportElements.length > 0 && !showSupportHeader;

      return (
        <div key={`${qKey}-${idx}`} className="space-y-4">
          {/* Section headers */}
          {showBonusesHeader && (
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <p className="text-sm font-bold text-gray-700">Bonuses</p>
              </div>
            </div>
          )}
          {showSupportHeader && (
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <p className="text-sm font-bold text-gray-700">Support Elements</p>
              </div>
            </div>
          )}
          {showBonusHeader && bonuses.length > 0 && (
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <p className="text-sm font-bold text-gray-700">Bonuses</p>
              </div>
            </div>
          )}
          {showSupportElementHeader && supportElements.length > 0 && (
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <p className="text-sm font-bold text-gray-700">Support Elements</p>
              </div>
            </div>
          )}

          {/* Question */}
          <div className="margo-chat-bubble margo-chat-bubble--bot">
            <div className="margo-message-content">
              <div className="space-y-2">
                {isCompleted ? (
                  <p className="text-base text-gray-900">{questionLabel}</p>
                ) : (
                  <>
                    <ChunkedText
                      text={questionLabel}
                      chunkClassName="text-base text-gray-900"
                      staggerMs={30}
                    />
                    {isOptional && !isCompleted && (
                      <p className="text-xs text-gray-500 mt-1 italic">You can skip this by typing 'skip' or leaving it blank.</p>
                    )}
                  </>
                )}
                {isAnswered && (
                  <span className="inline-block rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 mt-2">
                    ✓ Saved
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* User's Answer */}
          {isAnswered && (
            <>
              {isSkipped || (isOptional && !displayAnswer.trim()) ? (
                <div className="margo-chat-bubble margo-chat-bubble--user">
                  <div className="margo-message-content">
                    <p className="text-sm text-gray-500 italic">
                      {qKey === "ask-more-bonuses" || qKey === "ask-more-support" 
                        ? (storedAnswer === "no" ? "No" : "Skipped")
                        : "Skipped"}
                    </p>
                  </div>
                </div>
              ) : displayAnswer.trim() ? (
                <div className="margo-chat-bubble margo-chat-bubble--user">
                  <div className="margo-message-content">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{displayAnswer}</p>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      );
    });
  };

  return (
    <>

      {(isActive || isCompleted) && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">

            {isCompleted ? (
              <p>Perfect! Your value stack is complete. Now let's add proof and credibility elements to support your offer.</p>
            ) : (
            <ChunkedText

                text={`Now let's build your complete value stack. We'll start with core components, then optionally add bonuses, support elements, and logistics.`}
              staggerMs={30}
            />

            )}
          </div>
        </div>
      )}

      {/* Show all questions in chronological order (ChatGPT style) */}
      {renderQuestionHistory()}

      {isCompleted && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <p className="text-sm text-gray-600">✓ Step 7 completed - Value stack saved</p>
          </div>
        </div>
      )}

      {!isCompleted && isActive && <div className="h-24" aria-hidden />}
    </>
  );
};

