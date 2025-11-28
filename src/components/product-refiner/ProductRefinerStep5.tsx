import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { submitStep5Outcomes, type OutcomeItem } from "@/lib/product-refiner-api";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { useProductRefinerStore } from "@/stores/productRefinerStore";
import type { StepPersistedState } from "@/stores/productRefinerStore";

export interface ProductRefinerStep5InputHandlers {
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

interface ProductRefinerStep5Props {
  workspaceId: string;
  session: ProductRefinerSession;
  isActive: boolean;
  isCompleted: boolean;
  onSessionChange: (session: ProductRefinerSession) => void;
  onError?: (message: string | null) => void;
  isUnlocked?: boolean;
  example?: any;
  onInputHandlersReady?: (handlers: ProductRefinerStep5InputHandlers | null) => void;
  persistedState?: StepPersistedState | null;
  onPersistedStateChange?: (state: StepPersistedState | null) => void;
}

export const ProductRefinerStep5 = ({
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
}: ProductRefinerStep5Props) => {
  const OUTCOME_FIELD_MIN_LENGTHS: Record<keyof OutcomeItem, number> = {
    outcome: 5,
    change: 15,
    whyItMatters: 15,
    howProductProduces: 15,
  };
  const { toast } = useToast();
  
  // Use Zustand store for persistence (ChatGPT-style)
  const store = useProductRefinerStore(workspaceId);
  
  // Check if session already has server data for this step
  const sessionHasStep5Data = !!(session.step5Outcomes && Array.isArray(session.step5Outcomes) && session.step5Outcomes.length > 0);
  
  // Allow Zustand restore when either the session already has step data
  // or we have a persisted UI snapshot (page refresh mid-step)
  const canUsePersistedFormData = (sessionHasStep5Data || !!persistedState) && store?.getState().formData.step5;
  const persistedFormData = canUsePersistedFormData ? store?.getState().formData.step5 ?? null : null;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentInputValue, setCurrentInputValue] = useState(persistedState?.currentInputValue || "");
  const [currentOutcomeIndex, setCurrentOutcomeIndex] = useState<number>(persistedState?.currentOutcomeIndex ?? 0);
  const [currentFieldKey, setCurrentFieldKey] = useState<keyof OutcomeItem | null>(persistedState?.currentFieldKey as keyof OutcomeItem | null || null);
  
  // Initialize from session OR the persisted Zustand snapshot (for refresh persistence)
  // BUT: If session is fresh (no step5 data) and we have no persisted UI state, treat it as a reset
  const [outcomes, setOutcomes] = useState<OutcomeItem[]>(() => {
    // Priority: session data > stored form data > empty defaults
    if (session.step5Outcomes && Array.isArray(session.step5Outcomes) && session.step5Outcomes.length > 0) {
      return session.step5Outcomes;
    }
    if (persistedFormData && Array.isArray(persistedFormData) && persistedFormData.length > 0) {
      return persistedFormData;
    }
    return [
      { outcome: "", change: "", whyItMatters: "", howProductProduces: "" },
      { outcome: "", change: "", whyItMatters: "", howProductProduces: "" },
      { outcome: "", change: "", whyItMatters: "", howProductProduces: "" },
    ];
  });
  
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [showExamples, setShowExamples] = useState<Record<string, boolean>>({});
  const sessionRef = useRef<ProductRefinerSession>(session);
  const isManuallyNavigatingRef = useRef(false); // Prevent useEffect from interfering with manual navigation
  const pendingNavigationRef = useRef<{ outcomeIndex: number; field: keyof OutcomeItem } | null>(null);
  const submittingQuestionKeyRef = useRef<string | null>(null); // Track which question is being submitted
  const hasRestoredStateRef = useRef(false); // Track if state has been restored to prevent blinking
  const prevOutcomesStringRef = useRef<string>(""); // Track previous outcomes to prevent unnecessary updates
  const prevAnsweredQuestionsStringRef = useRef<string>(""); // Track previous answeredQuestions to prevent loops
  const prevSessionDataStringRef = useRef<string>(""); // Track session data changes
  const prevOutcomesStringRef2 = useRef<string>(""); // Track outcomes for session sync

  // Memoize fieldLabels and fieldOrder to prevent recreating on every render
  const fieldLabels: Record<keyof OutcomeItem, string> = useMemo(() => ({
    outcome: "What is the outcome?",
    change: "What change does this create?",
    whyItMatters: "Why does this matter to the client?",
    howProductProduces: "How does the product produce this outcome?",
  }), []);

  const fieldOrder: (keyof OutcomeItem)[] = useMemo(() => ["outcome", "change", "whyItMatters", "howProductProduces"], []);

  // Restore from Zustand store on mount (for ChatGPT-style persistence after refresh)
  // BUT: Only restore if persistedState exists (page refresh) and session doesn't have step5 data
  // If persistedState is null OR session is fresh, it means we're starting fresh after reset - don't restore from Zustand
  useEffect(() => {
    sessionRef.current = session;
    
    // If session is fresh (no step5 data) AND persistedState is null, it's a reset - clear everything
    if (!sessionHasStep5Data && !persistedState) {
      // Fresh start after reset - ensure outcomes are empty
      const hasOutcomesData = outcomes.some(o => 
        o.outcome?.trim() || o.change?.trim() || o.whyItMatters?.trim() || o.howProductProduces?.trim()
      );
      if (hasOutcomesData) {
        // Reset outcomes to empty if it has data but session is fresh and persistedState is null (after reset)
        setOutcomes([
          { outcome: "", change: "", whyItMatters: "", howProductProduces: "" },
          { outcome: "", change: "", whyItMatters: "", howProductProduces: "" },
          { outcome: "", change: "", whyItMatters: "", howProductProduces: "" },
        ]);
        setAnsweredQuestions(new Set());
        setCurrentOutcomeIndex(0);
        setCurrentFieldKey(null);
        setCurrentInputValue("");
      }
      return;
    }
    
    // Only restore from Zustand if:
    // 1. persistedState exists (page refresh scenario), AND
    // 2. Session doesn't have step5 data (fresh session), AND
    // 3. Zustand has data, AND
    // 4. Outcomes are empty (page refresh scenario, not a reset)
    if (persistedState && !sessionHasStep5Data && persistedFormData) {
      const hasZustandData = persistedFormData.some(o => 
        o.outcome?.trim() || o.change?.trim() || o.whyItMatters?.trim() || o.howProductProduces?.trim()
      );
      const hasOutcomesData = outcomes.some(o => 
        o.outcome?.trim() || o.change?.trim() || o.whyItMatters?.trim() || o.howProductProduces?.trim()
      );
      
      // Only restore if we have Zustand data but no outcomes data (page refresh scenario)
      if (hasZustandData && !hasOutcomesData) {
        // Restore from Zustand store
        setOutcomes(persistedFormData);
        
        // Mark all answered questions
        const answered = new Set<string>();
        persistedFormData.forEach((outcome, idx) => {
          fieldOrder.forEach((field) => {
            if (outcome[field]?.trim()) {
              answered.add(`${idx}-${field}`);
            }
          });
        });
        setAnsweredQuestions(answered);
        
        // Mark that state has been restored
        hasRestoredStateRef.current = true;
      }
    }
  }, [persistedState, sessionHasStep5Data, outcomes, persistedFormData, fieldOrder]); // Run when these change

  // Sync answeredQuestions with outcomes data whenever outcomes change (backup sync)
  // Primary initialization happens in the Zustand restore useEffect above
  // Skip this sync if we're manually navigating to prevent blinking
  useEffect(() => {
    // Don't sync if we're manually navigating (prevents blinking during navigation)
    if (isManuallyNavigatingRef.current) {
      return;
    }
    
    // Only sync if outcomes actually changed (compare stringified versions)
    const currentOutcomesString = JSON.stringify(outcomes);
    if (prevOutcomesStringRef.current === currentOutcomesString) {
      return;
    }
    
    prevOutcomesStringRef.current = currentOutcomesString;
    
    const answered = new Set<string>();
    outcomes.forEach((outcome, idx) => {
      fieldOrder.forEach((field) => {
        if (outcome[field]?.trim()) {
          answered.add(`${idx}-${field}`);
        }
      });
    });
    
    // Only update if different to avoid unnecessary re-renders
    const newAnsweredArray = Array.from(answered).sort();
    const newAnsweredString = JSON.stringify(newAnsweredArray);
    if (prevAnsweredQuestionsStringRef.current !== newAnsweredString) {
      prevAnsweredQuestionsStringRef.current = newAnsweredString;
      setAnsweredQuestions(answered);
    }
    
    hasRestoredStateRef.current = true;
  }, [outcomes, fieldOrder]); // Removed answeredQuestions from deps to prevent loop
  
  // Sync session data to outcomes when session changes (but only if different) - like Step 2
  // Skip this sync if we're manually navigating to prevent blinking
  useEffect(() => {
    // Don't sync if we're manually navigating (prevents blinking during navigation)
    if (isManuallyNavigatingRef.current) {
      return;
    }
    
    // Create session data string for comparison
    const sessionDataString = JSON.stringify(session.step5Outcomes);
    
    // Check if session data actually changed
    if (prevSessionDataStringRef.current === sessionDataString) {
      return;
    }
    
    prevSessionDataStringRef.current = sessionDataString;
    
    // Priority: session data > Zustand store > empty
    const sessionOutcomes = session.step5Outcomes && Array.isArray(session.step5Outcomes) && session.step5Outcomes.length > 0
      ? session.step5Outcomes
      : null;
    
    // Use session data if available, otherwise fallback to Zustand store (only if session has data)
    const newOutcomes = sessionHasStep5Data
      ? sessionOutcomes
      : (persistedFormData && persistedState ? persistedFormData : sessionOutcomes);
    
    // Only update if outcomes actually changed (compare with previous value stored in ref)
    const newOutcomesString = JSON.stringify(newOutcomes || []);
    const currentOutcomesString = JSON.stringify(outcomes);
    
    // Only update if different from current state to prevent unnecessary re-renders
    if (newOutcomesString !== currentOutcomesString && newOutcomesString !== prevOutcomesStringRef2.current) {
      prevOutcomesStringRef2.current = newOutcomesString;
      if (newOutcomes) {
        setOutcomes(newOutcomes);
      } else if (currentOutcomesString === JSON.stringify([
        { outcome: "", change: "", whyItMatters: "", howProductProduces: "" },
        { outcome: "", change: "", whyItMatters: "", howProductProduces: "" },
        { outcome: "", change: "", whyItMatters: "", howProductProduces: "" },
      ])) {
        // Only reset if current state is already empty
        // Don't reset if we have partial data
        return;
      }
      
      // Save to Zustand store for persistence
      if (store && sessionHasStep5Data && sessionOutcomes) {
        store.getState().setStep5FormData(sessionOutcomes);
      }
    }
  }, [session.step5Outcomes, sessionHasStep5Data, persistedFormData, persistedState, store, outcomes]); // Added outcomes to deps but with guard

  // Reset navigation flag and submitting state after state updates
  useEffect(() => {
    if (isManuallyNavigatingRef.current && pendingNavigationRef.current) {
      // State has been updated, now we can safely reset the flag
      const pending = pendingNavigationRef.current;
      if (currentOutcomeIndex === pending.outcomeIndex && currentFieldKey === pending.field) {
        // Navigation was successful, reset flags
        console.log('[ProductRefinerStep5] Navigation confirmed, resetting flags');
        isManuallyNavigatingRef.current = false;
        pendingNavigationRef.current = null;
        // Ensure submitting is false after navigation is confirmed
        if (isSubmitting) {
          setIsSubmitting(false);
        }
      }
    }
    // Fallback: reset flag after a short delay if it's still set (safety mechanism)
    if (isManuallyNavigatingRef.current) {
      const timeoutId = setTimeout(() => {
        if (isManuallyNavigatingRef.current) {
          console.log('[ProductRefinerStep5] Fallback: resetting navigation flag after timeout');
          isManuallyNavigatingRef.current = false;
          pendingNavigationRef.current = null;
          if (isSubmitting) {
            setIsSubmitting(false);
          }
        }
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [currentOutcomeIndex, currentFieldKey, isSubmitting]);


  // Helper function to get question key for answered questions tracking
  const getQuestionKey = (outcomeIndex: number, field: keyof OutcomeItem) => `${outcomeIndex}-${field}`;

  const handleFinalSubmit = useCallback(async (validOutcomes: OutcomeItem[]) => {
    const currentSession = sessionRef.current || session;
    if (!currentSession?.id) return;

    setValidationError(null);
    setIsSubmitting(true);
    submittingQuestionKeyRef.current = null; // Clear any previous submission tracking
    onError?.(null);

    try {
      await submitStep5Outcomes(currentSession.id, {
        outcomes: validOutcomes,
      });
      
      const updatedSession: ProductRefinerSession = {
        ...currentSession,
        step5Outcomes: validOutcomes,
        step5Completed: true,
        currentStep: 6,
      };
      onSessionChange(updatedSession);
      setCurrentOutcomeIndex(-1);
      setCurrentFieldKey(null);
      setCurrentInputValue("");
    } catch (error: any) {
      const message = error?.message || "Failed to submit outcomes";
      onError?.(message);
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      submittingQuestionKeyRef.current = null;
    }
  }, [session, onSessionChange, onError, toast]);

  const handleFieldSubmit = useCallback(async (outcomeIndex: number, field: keyof OutcomeItem, value: string) => {
    console.log('[ProductRefinerStep5] handleFieldSubmit called', {
      outcomeIndex,
      field,
      valueLength: value.trim().length,
      isSubmitting,
    });
    
    // Prevent double submission
    if (isSubmitting) {
      console.log('[ProductRefinerStep5] Already submitting, returning');
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
    const minLength = OUTCOME_FIELD_MIN_LENGTHS[field];
    
    // Validate required field
    if (!trimmedValue) {
      setValidationError(`${fieldLabels[field]} is required`);
      return;
    }
    if (trimmedValue.length < minLength) {
      setValidationError(`${fieldLabels[field]} must be at least ${minLength} characters`);
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);
    // Track which question is being submitted
    submittingQuestionKeyRef.current = getQuestionKey(outcomeIndex, field);

    try {
      // Update outcome with the submitted value
      const updated = [...outcomes];
      if (!updated[outcomeIndex]) {
        // Ensure outcome exists
        updated[outcomeIndex] = { outcome: "", change: "", whyItMatters: "", howProductProduces: "" };
      }
      updated[outcomeIndex] = { ...updated[outcomeIndex], [field]: trimmedValue };
      
      // Check if current outcome is complete
      const updatedOutcome = updated[outcomeIndex];
      const isOutcomeComplete = 
        updatedOutcome.outcome?.trim() &&
        updatedOutcome.change?.trim() &&
        updatedOutcome.whyItMatters?.trim() &&
        updatedOutcome.howProductProduces?.trim();

      // Check if all required outcomes are complete (at least 3)
      const completeOutcomes = updated.filter(o => 
        o.outcome?.trim() && 
        o.change?.trim() && 
        o.whyItMatters?.trim() && 
        o.howProductProduces?.trim()
      );

      // Mark that we're manually navigating BEFORE updating state to prevent useEffect from interfering
      isManuallyNavigatingRef.current = true;
      
      // Update outcomes state
      setOutcomes(updated);
      
      // Save to Zustand store immediately for persistence
      if (store) {
        store.getState().setStep5FormData(updated);
      }
      
      // Mark question as answered
      setAnsweredQuestions(prev => new Set([...prev, getQuestionKey(outcomeIndex, field)]));

      if (completeOutcomes.length >= 3 && isOutcomeComplete) {
        // All done - submit
        await handleFinalSubmit(updated.filter(o => 
          o.outcome?.trim() && 
          o.change?.trim() && 
          o.whyItMatters?.trim() && 
          o.howProductProduces?.trim()
        ));
      } else {
        // Move to next field or next outcome
        const currentFieldIndex = fieldOrder.indexOf(field);
        console.log('[ProductRefinerStep5] Moving to next question', {
          currentFieldIndex,
          fieldOrderLength: fieldOrder.length,
          completeOutcomes: completeOutcomes.length,
        });
        
        if (currentFieldIndex < fieldOrder.length - 1) {
          // Move to next field in same outcome
          const nextField = fieldOrder[currentFieldIndex + 1];
          // Use updated outcome to get the value for the next field
          const nextFieldValue = updatedOutcome[nextField] || "";
          console.log('[ProductRefinerStep5] Moving to next field in same outcome', {
            nextField,
            nextFieldValue,
            outcomeIndex,
          });
          // Store pending navigation for verification
          pendingNavigationRef.current = { outcomeIndex, field: nextField };
          setCurrentOutcomeIndex(outcomeIndex); // Ensure outcome index is set
          setCurrentFieldKey(nextField);
          setCurrentInputValue(nextFieldValue);
        } else {
          // Move to next outcome (or add new one if we have less than 3 complete)
          if (completeOutcomes.length < 3) {
            // Need more outcomes - find next incomplete outcome or add new one
            // First, check if there's an existing incomplete outcome we can use
            let nextOutcomeIndex = -1;
            for (let i = 0; i < updated.length; i++) {
              const outcome = updated[i];
              const isComplete = outcome.outcome?.trim() && 
                                outcome.change?.trim() && 
                                outcome.whyItMatters?.trim() && 
                                outcome.howProductProduces?.trim();
              if (!isComplete) {
                nextOutcomeIndex = i;
                break;
              }
            }
            
            if (nextOutcomeIndex === -1 && updated.length < 3) {
              // No incomplete outcome found and we have less than 3 outcomes - add new one
              const newOutcomeIndex = updated.length;
              const newOutcomes = [...updated, { outcome: "", change: "", whyItMatters: "", howProductProduces: "" }];
              console.log('[ProductRefinerStep5] Adding new outcome', {
                newOutcomeIndex,
                totalOutcomes: newOutcomes.length,
              });
              // Store pending navigation for verification
              pendingNavigationRef.current = { outcomeIndex: newOutcomeIndex, field: "outcome" };
              setOutcomes(newOutcomes);
              setCurrentOutcomeIndex(newOutcomeIndex);
              setCurrentFieldKey("outcome");
              setCurrentInputValue("");
              // Reset submitting state after navigation
              setTimeout(() => {
                setIsSubmitting(false);
                submittingQuestionKeyRef.current = null;
              }, 150);
              return; // Exit early since we're adding new outcome
            } else if (nextOutcomeIndex >= 0) {
              // Found an incomplete outcome - use it
              console.log('[ProductRefinerStep5] Moving to existing incomplete outcome', {
                nextOutcomeIndex,
              });
              // Store pending navigation for verification
              pendingNavigationRef.current = { outcomeIndex: nextOutcomeIndex, field: "outcome" };
              setCurrentOutcomeIndex(nextOutcomeIndex);
              setCurrentFieldKey("outcome");
              setCurrentInputValue(updated[nextOutcomeIndex]?.outcome || "");
              // Reset submitting state after navigation
              setTimeout(() => {
                setIsSubmitting(false);
                submittingQuestionKeyRef.current = null;
              }, 150);
              return; // Exit early since we're moving to next outcome
            } else {
              // We have 3 or more outcomes and all are complete - ready to submit
              console.log('[ProductRefinerStep5] All outcomes complete, submitting');
              setCurrentOutcomeIndex(-1);
              setCurrentFieldKey(null);
              setCurrentInputValue("");
              await handleFinalSubmit(completeOutcomes);
              return; // Exit early since we're submitting
            }
          } else {
            // Ready to submit
            console.log('[ProductRefinerStep5] All outcomes complete, submitting');
            setCurrentOutcomeIndex(-1);
            setCurrentFieldKey(null);
            setCurrentInputValue("");
            await handleFinalSubmit(completeOutcomes);
          }
        }
        // Reset submitting state after navigation completes
        // Use a small timeout to ensure state updates have propagated and prevent blinking
        setTimeout(() => {
          setIsSubmitting(false);
          submittingQuestionKeyRef.current = null;
        }, 150);
      }
    } catch (error: any) {
      setIsSubmitting(false);
      submittingQuestionKeyRef.current = null;
      const message = error?.message || "Failed to save answer";
      setValidationError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  }, [outcomes, session, toast, fieldLabels, fieldOrder, handleFinalSubmit, isSubmitting, store]);

  // Expose input handlers to parent component
  const onInputHandlersReadyRef = useRef(onInputHandlersReady);
  const prevHandlersStateRef = useRef<string>("");
  const prevShouldProvideHandlersRef = useRef<boolean>(false);
  const handleFieldSubmitRef = useRef(handleFieldSubmit);
  
  useEffect(() => {
    onInputHandlersReadyRef.current = onInputHandlersReady;
    handleFieldSubmitRef.current = handleFieldSubmit;
  }, [onInputHandlersReady, handleFieldSubmit]);
  
  useEffect(() => {
    if (!onInputHandlersReadyRef.current) return;
    
    const shouldProvideHandlers = isActive && !isCompleted && currentFieldKey !== null && currentOutcomeIndex >= 0;
    
    // Create state string for comparison (exclude currentInputValue to prevent recreation on every keystroke)
    const currentQuestionKey = `${currentOutcomeIndex}-${currentFieldKey}`;
    const handlersStateString = JSON.stringify({
      shouldProvideHandlers,
      isActive,
      isCompleted,
      currentFieldKey,
      currentOutcomeIndex,
      currentQuestionKey,
      isSubmitting,
      validationError,
      outcomesLength: outcomes.length,
    });
    
    // Check if question key changed (more reliable than full state string)
    const prevState = prevHandlersStateRef.current ? JSON.parse(prevHandlersStateRef.current) : null;
    const prevQuestionKey = prevState?.currentQuestionKey;
    const questionKeyChanged = currentQuestionKey !== prevQuestionKey;
    
    // Only skip if state hasn't changed AND question key hasn't changed
    if (prevHandlersStateRef.current === handlersStateString && !questionKeyChanged) {
      // Still update input value even if handlers don't need recreation
      if (prevState?.currentInputValue !== currentInputValue && currentFieldKey !== null) {
        // Update just the input value without recreating handlers
        const currentLabel = fieldLabels[currentFieldKey];
        const minLength = OUTCOME_FIELD_MIN_LENGTHS[currentFieldKey];
        const outcomeNumber = currentOutcomeIndex + 1;
        const totalOutcomes = Math.max(3, outcomes.length);
        const trimmed = currentInputValue.trim();
        const showHint = trimmed.length > 0 && trimmed.length < minLength;
        
        onInputHandlersReadyRef.current({
          inputValue: currentInputValue,
          onInputChange: (value: string) => {
            setCurrentInputValue(value);
            if (validationError && value.trim().length >= minLength) {
              setValidationError(null);
            }
          },
          onInputSubmit: () => {
            if (currentFieldKey && currentOutcomeIndex >= 0) {
              handleFieldSubmitRef.current(currentOutcomeIndex, currentFieldKey, currentInputValue);
            }
          },
          isSubmitting,
          placeholder: `Answer ${currentLabel.toLowerCase()} (Outcome ${outcomeNumber} of ${totalOutcomes})...`,
          currentQuestionKey: `${currentOutcomeIndex}-${currentFieldKey}`,
          currentQuestionLabel: currentLabel,
          validationError: validationError,
          validationHint: showHint ? `${currentLabel} • minimum ${minLength} characters` : null,
        });
      }
      return;
    }
    
    const prevShouldProvide = prevShouldProvideHandlersRef.current;
    prevHandlersStateRef.current = handlersStateString;
    
    if (shouldProvideHandlers) {
      const currentLabel = fieldLabels[currentFieldKey];
      const minLength = OUTCOME_FIELD_MIN_LENGTHS[currentFieldKey];
      const outcomeNumber = currentOutcomeIndex + 1;
      const totalOutcomes = Math.max(3, outcomes.length);
      
      const wrappedSubmit = () => {
        if (currentFieldKey && currentOutcomeIndex >= 0) {
          handleFieldSubmitRef.current(currentOutcomeIndex, currentFieldKey, currentInputValue);
        }
      };
      
      const handleInputChange = (value: string) => {
        setCurrentInputValue(value);
        // Clear validation error when user starts typing
        if (validationError && value.trim().length >= minLength) {
          setValidationError(null);
        }
      };
      
      const trimmed = currentInputValue.trim();
      const showHint = trimmed.length > 0 && trimmed.length < minLength;
      
      onInputHandlersReadyRef.current({
        inputValue: currentInputValue,
        onInputChange: handleInputChange,
        onInputSubmit: wrappedSubmit,
        isSubmitting,
        placeholder: `Answer ${currentLabel.toLowerCase()} (Outcome ${outcomeNumber} of ${totalOutcomes})...`,
        currentQuestionKey: `${currentOutcomeIndex}-${currentFieldKey}`,
        currentQuestionLabel: currentLabel,
        validationError: validationError,
        validationHint: showHint ? `${currentLabel} • minimum ${minLength} characters` : null,
      });
      prevShouldProvideHandlersRef.current = true;
    } else {
      // Only call null if we previously provided handlers (avoid unnecessary updates)
      if (prevShouldProvide) {
        onInputHandlersReadyRef.current(null);
      }
      prevShouldProvideHandlersRef.current = false;
    }
  }, [isActive, isCompleted, currentFieldKey, currentOutcomeIndex, currentInputValue, isSubmitting, validationError, fieldLabels, outcomes.length]);

  // Persist UI state whenever it changes (for refresh persistence)
  const prevPersistedStateRef = useRef<{
    currentQuestionKey: string | null;
    currentInputValue: string;
    answeredQuestions: string[];
    currentOutcomeIndex: number;
    currentFieldKey: string | null;
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
    
    // Don't persist if we're completed or not active
    if (isCompleted || !isActive) {
      const prevState = prevPersistedStateRef.current;
      if (prevState && (prevState.isCompleted !== isCompleted || prevState.isActive !== isActive)) {
        prevPersistedStateRef.current = null;
        callback(null);
      }
      return;
    }

    const currentQuestionKey = currentFieldKey ? `${currentOutcomeIndex}-${currentFieldKey}` : null;
    const answeredQuestionsArray = Array.from(answeredQuestions).sort();
    const state: StepPersistedState = {
      currentQuestionKey,
      currentInputValue,
      answeredQuestions: answeredQuestionsArray,
      currentOutcomeIndex,
      currentFieldKey: currentFieldKey as string | null,
    };

    // Only call callback if state actually changed
    const prevState = prevPersistedStateRef.current;
    const stateChanged = !prevState || 
        prevState.currentQuestionKey !== state.currentQuestionKey ||
        prevState.currentInputValue !== state.currentInputValue ||
        prevState.answeredQuestions.length !== state.answeredQuestions.length ||
        prevState.answeredQuestions.some((q, i) => q !== state.answeredQuestions[i]) ||
        prevState.currentOutcomeIndex !== state.currentOutcomeIndex ||
        prevState.currentFieldKey !== state.currentFieldKey ||
        prevState.isCompleted !== isCompleted ||
        prevState.isActive !== isActive;
    
    if (stateChanged) {
      prevPersistedStateRef.current = {
        currentQuestionKey: state.currentQuestionKey,
        currentInputValue: state.currentInputValue,
        answeredQuestions: [...state.answeredQuestions],
        currentOutcomeIndex: state.currentOutcomeIndex ?? 0,
        currentFieldKey: state.currentFieldKey ?? null,
        isCompleted,
        isActive,
      };
      callback(state);
    }
  }, [currentOutcomeIndex, currentFieldKey, currentInputValue, answeredQuestions, isCompleted, isActive]);

  // Initialize current question when step becomes active (similar to Step 2)
  useEffect(() => {
    // Skip if we're manually navigating or if user is actively on a question (prevents blinking during typing)
    if (isManuallyNavigatingRef.current) {
      return;
    }
    
    // Skip if user is currently on a valid question (prevents resetting during typing)
    if (currentOutcomeIndex >= 0 && currentFieldKey !== null) {
      const currentValue = outcomes[currentOutcomeIndex]?.[currentFieldKey];
      // Only skip if the question is still unanswered (user is typing)
      if (!currentValue || !currentValue.trim()) {
        return; // User is actively typing, don't interfere
      }
    }
    
    if (isActive && !isCompleted) {
      // If persistedState is null, we're starting fresh after reset - find first unanswered question
      if (!persistedState) {
        // Find first unanswered question
        for (let i = 0; i < outcomes.length; i++) {
          for (const field of fieldOrder) {
            if (!outcomes[i][field]?.trim()) {
              const questionKey = `${i}-${field}`;
              if (questionKey !== `${currentOutcomeIndex}-${currentFieldKey}`) {
                setCurrentOutcomeIndex(i);
                setCurrentFieldKey(field);
                setCurrentInputValue("");
              }
              return;
            }
          }
        }
        return;
      }
      
      // If we have persisted state with a current question, use it
      if (persistedState.currentQuestionKey) {
        const parts = persistedState.currentQuestionKey.split('-');
        if (parts.length === 2) {
          const outcomeIdx = parseInt(parts[0]);
          const field = parts[1] as keyof OutcomeItem;
          if (!isNaN(outcomeIdx) && fieldOrder.includes(field)) {
            // Verify the persisted question is still valid (not answered in outcomes)
            const persistedValue = outcomes[outcomeIdx]?.[field];
            if (!persistedValue || !persistedValue.trim()) {
              // Persisted question is still unanswered, use it
              if (currentOutcomeIndex !== outcomeIdx || currentFieldKey !== field) {
                setCurrentOutcomeIndex(outcomeIdx);
                setCurrentFieldKey(field);
                setCurrentInputValue(persistedState.currentInputValue || "");
              }
              return;
            }
          }
        }
      } else if (persistedState.currentOutcomeIndex !== undefined || persistedState.currentFieldKey !== undefined) {
        // Fallback: restore from direct properties if question key parsing fails
        if (persistedState.currentOutcomeIndex !== undefined) {
          const questionKey = persistedState.currentFieldKey 
            ? `${persistedState.currentOutcomeIndex}-${persistedState.currentFieldKey}`
            : null;
          // Verify the persisted question is still valid
          if (questionKey) {
            const parts = questionKey.split('-');
            if (parts.length === 2) {
              const outcomeIdx = parseInt(parts[0]);
              const field = parts[1] as keyof OutcomeItem;
              if (!isNaN(outcomeIdx) && fieldOrder.includes(field)) {
                const persistedValue = outcomes[outcomeIdx]?.[field];
                if (!persistedValue || !persistedValue.trim()) {
                  // Persisted question is still unanswered, use it
                  if (currentOutcomeIndex !== outcomeIdx || currentFieldKey !== field) {
                    setCurrentOutcomeIndex(outcomeIdx);
                    setCurrentFieldKey(field);
                    setCurrentInputValue(persistedState.currentInputValue || "");
                  }
                  return;
                }
              }
            }
          }
        }
      }
      
      // Otherwise, find the next unanswered question
      for (let i = 0; i < outcomes.length; i++) {
        for (const field of fieldOrder) {
          if (!outcomes[i][field]?.trim()) {
            const questionKey = `${i}-${field}`;
            if (questionKey !== `${currentOutcomeIndex}-${currentFieldKey}`) {
              setCurrentOutcomeIndex(i);
              setCurrentFieldKey(field);
              setCurrentInputValue(outcomes[i][field] || "");
            }
            return;
          }
        }
      }
    }
  }, [isActive, isCompleted, persistedState, outcomes, fieldOrder, currentOutcomeIndex, currentFieldKey]);

  // Automatically reveal example for the active question
  useEffect(() => {
    if (!currentFieldKey || !example) return;
    const questionKey = getQuestionKey(currentOutcomeIndex, currentFieldKey);
    setShowExamples((prev) => {
      if (prev[questionKey]) return prev;
      return { ...prev, [questionKey]: true };
    });
  }, [currentFieldKey, currentOutcomeIndex, example]);

  if (!isUnlocked && !isActive && !isCompleted) {
    return null;
  }

  // Calculate total questions across all outcomes
  const MIN_OUTCOMES = 3;
  const TOTAL_FIELDS_PER_OUTCOME = fieldOrder.length;

  return (
    <>
      {(isActive || isCompleted) && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            {isCompleted ? (
              <p>Great! Your outcomes have been saved. Now let's translate your features into meaningful benefits.</p>
            ) : (
            <ChunkedText
                text={`Now let's identify the outcomes your product delivers. We'll collect at least 3 outcomes, each with 4 details.`}
              staggerMs={30}
            />
            )}
          </div>
        </div>
      )}

      {/* Show all outcomes with their questions and answers (ChatGPT style) */}
      {outcomes.map((outcome, outcomeIndex) => {
        const outcomeNumber = outcomeIndex + 1;
        const isActiveOutcome = outcomeIndex === currentOutcomeIndex;
        
        // Check Zustand store for outcome data as well
        const zustandOutcome = persistedFormData?.[outcomeIndex];
        const hasStateData = outcome.outcome?.trim() || outcome.change?.trim() || outcome.whyItMatters?.trim() || outcome.howProductProduces?.trim();
        const hasZustandData = zustandOutcome && (
          zustandOutcome.outcome?.trim() || zustandOutcome.change?.trim() || 
          zustandOutcome.whyItMatters?.trim() || zustandOutcome.howProductProduces?.trim()
        );
        
        return (
          <div key={outcomeIndex} className="space-y-4">
            {/* Outcome header */}
            {((isActive || isCompleted) && (isActiveOutcome || hasStateData || hasZustandData)) && (
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content">
                  <p className="text-sm font-bold text-gray-700">
                    Outcome {outcomeNumber}
                  </p>
                </div>
              </div>
            )}

            {/* Show questions and answers for this outcome */}
            {fieldOrder.map((field) => {
              const questionKey = getQuestionKey(outcomeIndex, field);
              
              // Check multiple sources for answer (Zustand store > state > session > empty)
              const zustandOutcome = persistedFormData?.[outcomeIndex];
              const zustandValue = zustandOutcome?.[field];
              const stateValue = outcome[field];
              const sessionOutcome = session.step5Outcomes?.[outcomeIndex];
              const sessionValue = sessionOutcome?.[field];
              
              // Priority: Zustand store > state > session > empty
              const answer = zustandValue || stateValue || sessionValue || "";
              const hasAnswer = !!(answer && answer.trim());
              
              // A question is answered if it has a value anywhere OR is in answeredQuestions Set
              // This ensures answers show after refresh even if answeredQuestions isn't fully populated
              const isAnswered = hasAnswer || answeredQuestions.has(questionKey);
              const isActiveQuestion = isActiveOutcome && field === currentFieldKey;
              const questionLabel = fieldLabels[field];

              // Calculate question number based on position in the flow
              // This gives sequential numbering: Outcome 1 Q1-4, Outcome 2 Q5-8, Outcome 3 Q9-12
              const questionNumber = outcomeIndex * TOTAL_FIELDS_PER_OUTCOME + fieldOrder.indexOf(field) + 1;
              
              // Total is always based on minimum 3 outcomes (12 questions)
              const totalQuestionsForDisplay = MIN_OUTCOMES * TOTAL_FIELDS_PER_OUTCOME;

              // Show logic (ChatGPT-style - show questions one by one):
              // 1. If completed: show ALL questions
              // 2. If active: show only questions that have been answered OR the current active question
              //    This ensures we show questions one by one as they're answered, not all at once
              // Show if:
              // - Step is completed (show all)
              // - Question is answered (has answer) - always show answered questions
              // - Question is the current active question (show the one we're currently on)
              const shouldShow = isCompleted || isAnswered || isActiveQuestion;
              
              if (!shouldShow) {
                return null;
              }


              return (
                <div key={field} className="space-y-1">
                  {/* Question */}
                  {(isActive || isCompleted) && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-700">
                            Question {questionNumber} of {totalQuestionsForDisplay}
                          </p>
                          {isCompleted ? (
                            <p className="text-base text-gray-900">{questionLabel}</p>
                          ) : (
                            <ChunkedText
                              text={questionLabel}
                              chunkClassName="text-base text-gray-900"
                              staggerMs={30}
                            />
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

                  {/* Example Inspiration - only show when active (not completed) */}
                  {isActiveQuestion && !isCompleted && example && field === "outcome" && (
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
                                const key = getQuestionKey(outcomeIndex, field);
                                setShowExamples(prev => ({
                                  ...prev,
                                  [key]: !prev[key]
                                }));
                              }}
                              className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                              aria-label={showExamples[getQuestionKey(outcomeIndex, field)] ? "Hide example" : "Show example"}
                            >
                              {showExamples[getQuestionKey(outcomeIndex, field)] ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {showExamples[getQuestionKey(outcomeIndex, field)] && example && (
                            <div className="px-4 py-4 space-y-3">
                    <div className="space-y-2 text-sm text-gray-700">
                      <p><strong>Outcome:</strong> {example.outcome}</p>
                      <p><strong>Change:</strong> {example.change}</p>
                      <p><strong>Why it matters:</strong> {example.whyItMatters}</p>
                      <p><strong>How product produces:</strong> {example.howProductProduces}</p>
                    </div>
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
                  {/* Loading indicator when submitting this specific question */}
                  {isAnswered && isSubmitting && !isCompleted && questionKey === submittingQuestionKeyRef.current && (
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
          </div>
        );
      })}

      {isCompleted && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <p className="text-sm text-gray-600">✓ Step 5 completed - Outcomes saved</p>
          </div>
        </div>
      )}

      {!isCompleted && isActive && <div className="h-4" aria-hidden />}
    </>
  );
};

