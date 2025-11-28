import { useEffect, useState, useCallback, useRef, useMemo } from "react";

import { useToast } from "@/hooks/use-toast";
import { submitStep6FeatureBenefit, type FeatureBenefitItem } from "@/lib/product-refiner-api";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { useProductRefinerStore } from "@/stores/productRefinerStore";
import type { StepPersistedState } from "@/stores/productRefinerStore";

export interface ProductRefinerStep6InputHandlers {
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

interface ProductRefinerStep6Props {
  workspaceId: string;
  session: ProductRefinerSession;
  isActive: boolean;
  isCompleted: boolean;
  onSessionChange: (session: ProductRefinerSession) => void;
  onError?: (message: string | null) => void;
  isUnlocked?: boolean;
  onInputHandlersReady?: (handlers: ProductRefinerStep6InputHandlers | null) => void;
  persistedState?: StepPersistedState | null;
  onPersistedStateChange?: (state: StepPersistedState | null) => void;
}

export const ProductRefinerStep6 = ({
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
}: ProductRefinerStep6Props) => {
  const FEATURE_MIN_LENGTH = 3;
  const BENEFIT_MIN_LENGTH = 10;
  const { toast } = useToast();
  
  // Use Zustand store for persistence (ChatGPT-style)
  const store = useProductRefinerStore(workspaceId);
  
  // Check if session already has server data for this step
  const sessionHasStep6Data = !!(session.step6FeatureBenefitTable && Array.isArray(session.step6FeatureBenefitTable) && session.step6FeatureBenefitTable.length > 0);
  
  // Allow Zustand restore when either the session already has step data
  // or we have a persisted UI snapshot (page refresh mid-step)
  const canUsePersistedFormData = (sessionHasStep6Data || !!persistedState) && store?.getState().formData.step6;
  const persistedFormData = canUsePersistedFormData ? store?.getState().formData.step6 ?? null : null;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentInputValue, setCurrentInputValue] = useState(persistedState?.currentInputValue || "");
  const [currentEntryIndex, setCurrentEntryIndex] = useState<number>(persistedState?.currentEntryIndex ?? 0);
  const [currentFieldKey, setCurrentFieldKey] = useState<keyof FeatureBenefitItem | null>(persistedState?.currentFieldKey as keyof FeatureBenefitItem | null || null);
  
  // Initialize from session OR the persisted Zustand snapshot (for refresh persistence)
  // BUT: If session is fresh (no step6 data) and we have no persisted UI state, treat it as a reset
  const [featureBenefitTable, setFeatureBenefitTable] = useState<FeatureBenefitItem[]>(() => {
    // Priority: session data > stored form data > empty defaults
    if (session.step6FeatureBenefitTable && Array.isArray(session.step6FeatureBenefitTable) && session.step6FeatureBenefitTable.length > 0) {
      return session.step6FeatureBenefitTable;
    }
    if (persistedFormData && Array.isArray(persistedFormData) && persistedFormData.length > 0) {
      return persistedFormData;
    }
    return [{ feature: "", benefit: "", emotionalBenefit: "" }];
  });
  
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(
    persistedState?.answeredQuestions ? new Set(persistedState.answeredQuestions) : new Set()
  );
  const sessionRef = useRef<ProductRefinerSession>(session);
  const isManuallyNavigatingRef = useRef(false); // Prevent useEffect from interfering with manual navigation

  // Memoize fieldLabels and fieldOrder to prevent recreating on every render
  const fieldLabels: Record<keyof FeatureBenefitItem, string> = useMemo(() => ({
    feature: "What is the feature?",
    benefit: "What is the practical benefit?",
    emotionalBenefit: "What is the emotional benefit? (Optional — you can skip this)",
  }), []);

  const fieldOrder: (keyof FeatureBenefitItem)[] = useMemo(() => ["feature", "benefit", "emotionalBenefit"], []);

  // Helper function to detect skip commands
  const isSkipCommand = useCallback((value: string): boolean => {
    const skipCommands = ["skip", "no", "n", "leave it", "leave", "none", "not needed", "pass"];
    return skipCommands.includes(value.trim().toLowerCase());
  }, []);

  // Helper function to get question key for answered questions tracking
  const getQuestionKey = (entryIndex: number, field: keyof FeatureBenefitItem) => `${entryIndex}-${field}`;

  useEffect(() => {
    sessionRef.current = session;
    // Priority: session data > (Zustand store when we have session data or a persisted UI snapshot) > empty
    const sessionTable = session.step6FeatureBenefitTable && Array.isArray(session.step6FeatureBenefitTable) && session.step6FeatureBenefitTable.length > 0
      ? session.step6FeatureBenefitTable
      : null;
    // Allow restoring from Zustand when we know we have prior progress (session data or persisted UI state)
    const zustandTable = (sessionHasStep6Data || !!persistedState) && persistedFormData && Array.isArray(persistedFormData) && persistedFormData.length > 0
      ? persistedFormData
      : null;
    
    const tableToUse = sessionTable || zustandTable;
    
    if (tableToUse) {
      setFeatureBenefitTable(tableToUse);
      
      // Save to Zustand store for persistence
      if (store && sessionTable) {
        store.getState().setStep6FormData(sessionTable);
      }
      
      // Initialize answered questions from data
      const answered = new Set<string>();
      tableToUse.forEach((entry, idx) => {
        fieldOrder.forEach((field) => {
          if (entry[field]?.trim()) {
            answered.add(`${idx}-${field}`);
          }
        });
      });
      // Merge with persistedState answeredQuestions if available (for refresh scenarios)
      if (persistedState?.answeredQuestions) {
        persistedState.answeredQuestions.forEach(q => answered.add(q));
      }
      setAnsweredQuestions(answered);
    }
  }, [session.step6FeatureBenefitTable, session, persistedFormData, store, fieldOrder, sessionHasStep6Data, persistedState]);
  
  // Restore from Zustand store on mount (for ChatGPT-style persistence after refresh)
  // Allow restore when session already has data OR when we have persisted UI state (page refresh mid-step)
  useEffect(() => {
    if ((sessionHasStep6Data || !!persistedState) && persistedFormData && Array.isArray(persistedFormData) && persistedFormData.length > 0) {
      const hasZustandData = persistedFormData.some(e => 
        e.feature?.trim() || e.benefit?.trim() || e.emotionalBenefit?.trim()
      );
      const hasFormData = featureBenefitTable.some(e => 
        e.feature?.trim() || e.benefit?.trim() || e.emotionalBenefit?.trim()
      );
      
      // Only restore if we have Zustand data but no formData (page refresh scenario)
      if (hasZustandData && !hasFormData) {
        // Restore from Zustand store
        setFeatureBenefitTable(persistedFormData);
        
        // Mark all answered questions
        const answered = new Set<string>();
        persistedFormData.forEach((entry, idx) => {
          fieldOrder.forEach((field) => {
            if (entry[field]?.trim()) {
              answered.add(`${idx}-${field}`);
            }
          });
        });
        setAnsweredQuestions(answered);
      }
    }
  }, [sessionHasStep6Data, featureBenefitTable, persistedFormData, fieldOrder, persistedState]);

  // Initialize current question when step becomes active
  useEffect(() => {
    // Skip if we're manually navigating (handled by handleFieldSubmit/handleNextStep)
    if (isManuallyNavigatingRef.current) {
      isManuallyNavigatingRef.current = false;
      return;
    }

    if (isActive && !isCompleted) {
      // Find first unanswered field in first incomplete entry
      let nextEntryIndex = 0;
      let nextField: keyof FeatureBenefitItem | null = null;
      
      for (let i = 0; i < featureBenefitTable.length; i++) {
        const entry = featureBenefitTable[i];
        for (const field of fieldOrder) {
          if (field === "emotionalBenefit") {
            // Optional field - check if required fields are filled
            if (!entry.feature?.trim() || !entry.benefit?.trim()) {
              // Need to fill required fields first
              if (!entry.feature?.trim()) {
                nextEntryIndex = i;
                nextField = "feature";
                break;
              } else if (!entry.benefit?.trim()) {
                nextEntryIndex = i;
                nextField = "benefit";
                break;
              }
            } else if (!entry.emotionalBenefit?.trim() && !answeredQuestions.has(getQuestionKey(i, "emotionalBenefit"))) {
              // Required fields filled, but emotional benefit not answered yet
              nextEntryIndex = i;
              nextField = "emotionalBenefit";
              break;
            }
          } else {
            // Required field
            if (!entry[field]?.trim()) {
              nextEntryIndex = i;
              nextField = field;
              break;
            }
          }
        }
        if (nextField) break;
      }
      
      if (nextField && (nextEntryIndex !== currentEntryIndex || nextField !== currentFieldKey)) {
        setCurrentEntryIndex(nextEntryIndex);
        setCurrentFieldKey(nextField);
        setCurrentInputValue(featureBenefitTable[nextEntryIndex]?.[nextField] || "");
      } else if (!nextField && featureBenefitTable.length > 0) {
        // All entries complete - ready to submit
        const completeEntries = featureBenefitTable.filter(e => 
          e.feature?.trim() && 
          e.benefit?.trim()
        );
        
        if (completeEntries.length > 0) {
          // Ready to submit
          setCurrentEntryIndex(-1);
          setCurrentFieldKey(null);
          setCurrentInputValue("");
        }
      }
    }
  }, [isActive, isCompleted, featureBenefitTable, currentEntryIndex, currentFieldKey, answeredQuestions, fieldOrder]);

  const handleFieldSubmit = useCallback(async (entryIndex: number, field: keyof FeatureBenefitItem, value: string) => {
    // Prevent double submission
    if (isSubmitting) {
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
    const isOptional = field === "emotionalBenefit";
    
    // Validate required fields (no validation for optional fields)
    if (!isOptional) {
      const minLength = field === "feature" ? FEATURE_MIN_LENGTH : BENEFIT_MIN_LENGTH;
      
      if (!trimmedValue) {
        setValidationError(`${fieldLabels[field]} is required`);
        return;
      }
      if (trimmedValue.length < minLength) {
        setValidationError(`${fieldLabels[field]} must be at least ${minLength} characters`);
        return;
      }
    }

    // For optional fields, allow blank or skip command - treat as skipped
    const isSkipped = isOptional && (isSkipCommand(trimmedValue) || !trimmedValue);
    
    setValidationError(null);
    setIsSubmitting(true);
    
    // Update entry with the submitted value (empty string if skipped)
    const updated = [...featureBenefitTable];
    if (!updated[entryIndex]) {
      updated[entryIndex] = { feature: "", benefit: "", emotionalBenefit: "" };
    }
    updated[entryIndex] = { ...updated[entryIndex], [field]: isSkipped ? "" : trimmedValue };
    
    // Check if we have at least one complete entry
    const completeEntries = updated.filter(e => 
      e.feature?.trim() && 
      e.benefit?.trim()
    );

    // Check if this will trigger final submit
    const currentFieldIndex = fieldOrder.indexOf(field);
    const isLastField = field === "emotionalBenefit" || currentFieldIndex === fieldOrder.length - 1;
    const willSubmit = completeEntries.length > 0 && isLastField;

    // Mark that we're manually navigating BEFORE updating state to prevent useEffect from interfering
    isManuallyNavigatingRef.current = true;
    
    // Update featureBenefitTable state
    setFeatureBenefitTable(updated);
      
    // Save to Zustand store immediately for persistence
    if (store) {
      store.getState().setStep6FormData(updated);
    }
      
    // Mark question as answered (even if skipped)
    setAnsweredQuestions(prev => new Set([...prev, getQuestionKey(entryIndex, field)]));

    // Move to next field, next entry, or submit
    await handleNextStep(updated, entryIndex, field, completeEntries.length > 0);
    
    // Keep isSubmitting true until navigation completes (shows "Saving..." indicator)
    // handleNextStep will manage isSubmitting state for final submit
    // For non-final submissions, we'll reset it after a small delay to show the saving state
    if (!willSubmit) {
      // Small delay to show "Saving..." before moving to next question
      setTimeout(() => {
        isManuallyNavigatingRef.current = false; // Reset navigation flag
        setIsSubmitting(false);
      }, 200);
    }
  }, [featureBenefitTable, session, toast, fieldLabels, fieldOrder, isSkipCommand, isSubmitting, store]);

  const handleNextStep = async (
    updated: FeatureBenefitItem[], 
    entryIndex: number, 
    field?: keyof FeatureBenefitItem,
    hasCompleteEntry?: boolean
  ) => {
    if (field) {
      const currentFieldIndex = fieldOrder.indexOf(field);
      
      if (field === "emotionalBenefit" || currentFieldIndex === fieldOrder.length - 1) {
        // Move to next entry (or add new one if we want more)
        if (hasCompleteEntry) {
          // At least one complete entry - ready to submit
          setCurrentEntryIndex(-1);
          setCurrentFieldKey(null);
          setCurrentInputValue("");
          
          // Small delay to show completion, then auto-submit
          setTimeout(async () => {
            await handleFinalSubmit(updated.filter(e => 
              e.feature?.trim() && 
              e.benefit?.trim()
            ));
          }, 500);
        } else {
          // Need more entries - add new one
          const newEntryIndex = updated.length;
          const newEntry: FeatureBenefitItem = { feature: "", benefit: "", emotionalBenefit: "" };
          const newTable = [...updated, newEntry];
          isManuallyNavigatingRef.current = true; // Prevent useEffect from interfering
          setFeatureBenefitTable(newTable);
          
          // Save to Zustand store immediately for persistence
          if (store) {
            store.getState().setStep6FormData(newTable);
          }
          
          setCurrentEntryIndex(newEntryIndex);
          setCurrentFieldKey("feature");
          setCurrentInputValue("");
        }
      } else {
        // Move to next field in same entry
        const nextField = fieldOrder[currentFieldIndex + 1];
        isManuallyNavigatingRef.current = true; // Prevent useEffect from interfering
        setCurrentEntryIndex(entryIndex); // Ensure entry index is set
        setCurrentFieldKey(nextField);
        setCurrentInputValue(updated[entryIndex]?.[nextField] || "");
      }
    } else {
      // Called from skip handler - check if ready to submit or need more
      const completeEntries = updated.filter(e => 
        e.feature?.trim() && 
        e.benefit?.trim()
      );
      
      if (completeEntries.length > 0) {
        setCurrentEntryIndex(-1);
        setCurrentFieldKey(null);
        setCurrentInputValue("");
        await handleFinalSubmit(completeEntries);
      } else {
        // Need more entries - add new one
        const newEntryIndex = updated.length;
        const newEntry: FeatureBenefitItem = { feature: "", benefit: "", emotionalBenefit: "" };
        isManuallyNavigatingRef.current = true; // Prevent useEffect from interfering
        setFeatureBenefitTable([...updated, newEntry]);
        setCurrentEntryIndex(newEntryIndex);
        setCurrentFieldKey("feature");
        setCurrentInputValue("");
      }
    }
  };

  const handleFinalSubmit = async (validEntries: FeatureBenefitItem[]) => {
    const currentSession = sessionRef.current || session;
    if (!currentSession?.id) return;

    setValidationError(null);
    setIsSubmitting(true);
    onError?.(null);

    try {
      await submitStep6FeatureBenefit(currentSession.id, {
        featureBenefitTable: validEntries,
      });
      
      const updatedSession: ProductRefinerSession = {
        ...currentSession,
        step6FeatureBenefitTable: validEntries,
        step6Completed: true,
        currentStep: 7,
      };
      onSessionChange(updatedSession);
      setCurrentEntryIndex(-1);
      setCurrentFieldKey(null);
      setCurrentInputValue("");
    } catch (error: any) {
      const message = error?.message || "Failed to submit feature-benefit table";
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
    
    const shouldProvideHandlers = isActive && !isCompleted && currentFieldKey !== null && currentEntryIndex >= 0;
    
    // Create state string for comparison (includes shouldProvideHandlers)
    const handlersStateString = JSON.stringify({
      shouldProvideHandlers,
      isActive,
      isCompleted,
      currentFieldKey,
      currentEntryIndex,
      currentInputValue,
      isSubmitting,
      validationError,
      featureBenefitTableLength: featureBenefitTable.length,
    });
    
    // Only update if state actually changed
    if (prevHandlersStateRef.current === handlersStateString) {
      return;
    }
    
    const prevShouldProvide = prevShouldProvideHandlersRef.current;
    prevHandlersStateRef.current = handlersStateString;
    
    if (shouldProvideHandlers) {
      const currentLabel = fieldLabels[currentFieldKey];
      const isOptional = currentFieldKey === "emotionalBenefit";
      const minLength = currentFieldKey === "feature" ? FEATURE_MIN_LENGTH : BENEFIT_MIN_LENGTH;
      const entryNumber = currentEntryIndex + 1;
      const totalEntries = Math.max(1, featureBenefitTable.length);
      
      const wrappedSubmit = () => {
        if (currentFieldKey && currentEntryIndex >= 0) {
          handleFieldSubmitRef.current(currentEntryIndex, currentFieldKey, currentInputValue);
        }
      };
      
      const handleInputChange = (value: string) => {
        setCurrentInputValue(value);
        // Clear validation error when user starts typing
        if (validationError && (!isOptional || !isSkipCommand(value))) {
          if (value.trim().length >= minLength || (isOptional && !value.trim())) {
            setValidationError(null);
          }
        }
      };
      
      const trimmed = currentInputValue.trim();
      const showHint = !isOptional && trimmed.length > 0 && trimmed.length < minLength;
      
      onInputHandlersReadyRef.current({
        inputValue: currentInputValue,
        onInputChange: handleInputChange,
        onInputSubmit: wrappedSubmit,
        isSubmitting,
        placeholder: `Answer ${currentLabel.toLowerCase()} (Entry ${entryNumber} of ${totalEntries})...`,
        currentQuestionKey: `${currentEntryIndex}-${currentFieldKey}`,
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
  }, [isActive, isCompleted, currentFieldKey, currentEntryIndex, currentInputValue, isSubmitting, validationError, fieldLabels, featureBenefitTable.length, isSkipCommand]);

  // Persist UI state whenever it changes (for refresh persistence)
  const prevPersistedStateRef = useRef<{
    currentQuestionKey: string | null;
    currentInputValue: string;
    answeredQuestions: string[];
    currentEntryIndex: number;
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
    
    if (isCompleted || !isActive) {
      const prevState = prevPersistedStateRef.current;
      if (prevState && (prevState.isCompleted !== isCompleted || prevState.isActive !== isActive)) {
        prevPersistedStateRef.current = null;
        callback(null);
      }
      return;
    }

    const currentQuestionKey = currentFieldKey ? `${currentEntryIndex}-${currentFieldKey}` : null;
    const answeredQuestionsArray = Array.from(answeredQuestions).sort();
    const state: StepPersistedState = {
      currentQuestionKey,
      currentInputValue,
      answeredQuestions: answeredQuestionsArray,
      currentEntryIndex,
      currentFieldKey: currentFieldKey as string | null,
    };

    const prevState = prevPersistedStateRef.current;
    const stateChanged = !prevState || 
        prevState.currentQuestionKey !== state.currentQuestionKey ||
        prevState.currentInputValue !== state.currentInputValue ||
        prevState.answeredQuestions.length !== state.answeredQuestions.length ||
        prevState.answeredQuestions.some((q, i) => q !== state.answeredQuestions[i]) ||
        prevState.currentEntryIndex !== state.currentEntryIndex ||
        prevState.currentFieldKey !== state.currentFieldKey ||
        prevState.isCompleted !== isCompleted ||
        prevState.isActive !== isActive;
    
    if (stateChanged) {
      prevPersistedStateRef.current = {
        currentQuestionKey: state.currentQuestionKey,
        currentInputValue: state.currentInputValue,
        answeredQuestions: [...state.answeredQuestions],
        currentEntryIndex: state.currentEntryIndex ?? 0,
        currentFieldKey: state.currentFieldKey ?? null,
        isCompleted,
        isActive,
      };
      callback(state);
    }
  }, [currentEntryIndex, currentFieldKey, currentInputValue, answeredQuestions, isCompleted, isActive]);

  // Restore from persistedState on mount/refresh
  useEffect(() => {
    if (persistedState && isActive && !isCompleted) {
      // First, ensure answeredQuestions includes all questions with answers from featureBenefitTable
      const answeredFromTable = new Set<string>();
      featureBenefitTable.forEach((entry, idx) => {
        fieldOrder.forEach((field) => {
          if (entry[field]?.trim()) {
            answeredFromTable.add(`${idx}-${field}`);
          }
        });
      });
      // Merge with persistedState answeredQuestions
      if (persistedState.answeredQuestions) {
        persistedState.answeredQuestions.forEach(q => answeredFromTable.add(q));
      }
      setAnsweredQuestions(answeredFromTable);
      
      if (persistedState.currentQuestionKey) {
        const parts = persistedState.currentQuestionKey.split('-');
        if (parts.length === 2) {
          const entryIdx = parseInt(parts[0]);
          const field = parts[1] as keyof FeatureBenefitItem;
          if (!isNaN(entryIdx) && fieldOrder.includes(field)) {
            // Only restore if this question isn't already answered
            if (!answeredFromTable.has(persistedState.currentQuestionKey)) {
              setCurrentEntryIndex(entryIdx);
              setCurrentFieldKey(field);
              setCurrentInputValue(persistedState.currentInputValue || "");
            }
          }
        }
      } else if (persistedState.currentEntryIndex !== undefined || persistedState.currentFieldKey !== undefined) {
        // Fallback: restore from direct properties if question key parsing fails
        if (persistedState.currentEntryIndex !== undefined) {
          const questionKey = persistedState.currentFieldKey 
            ? `${persistedState.currentEntryIndex}-${persistedState.currentFieldKey}`
            : null;
          // Only restore if question isn't already answered
          if (!questionKey || !answeredFromTable.has(questionKey)) {
            setCurrentEntryIndex(persistedState.currentEntryIndex);
            if (persistedState.currentFieldKey !== undefined && persistedState.currentFieldKey !== null) {
              const field = persistedState.currentFieldKey as keyof FeatureBenefitItem;
              if (fieldOrder.includes(field)) {
                setCurrentFieldKey(field);
                setCurrentInputValue(persistedState.currentInputValue || "");
              }
            }
          }
        }
      }
    }
  }, [persistedState, isActive, isCompleted, featureBenefitTable, fieldOrder]);

  if (!isUnlocked && !isActive && !isCompleted) {
    return null;
  }

  // Calculate total questions across all entries
  const TOTAL_FIELDS_PER_ENTRY = fieldOrder.length;
  const totalQuestions = Math.max(1, featureBenefitTable.length) * TOTAL_FIELDS_PER_ENTRY;

  return (
    <>
      {(isActive || isCompleted) && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            {isCompleted ? (
              <p>Excellent! Your feature-to-benefit translations are saved. Now let's build your complete value stack.</p>
            ) : (
            <ChunkedText
                text={`Now let's translate your features into meaningful benefits. We'll collect at least one feature-benefit entry.`}
              staggerMs={30}
            />
            )}
          </div>
        </div>
      )}

      {/* Show all entries with their questions and answers (ChatGPT style) */}
      {featureBenefitTable.map((entry, entryIndex) => {
        const entryNumber = entryIndex + 1;
        const isActiveEntry = entryIndex === currentEntryIndex;
        
        return (
          <div key={entryIndex} className="space-y-4">
            {/* Entry header */}
            {(() => {
              // Check Zustand store for entry data as well
              const zustandEntry = persistedFormData?.[entryIndex];
              const hasStateData = entry.feature?.trim() || entry.benefit?.trim() || entry.emotionalBenefit?.trim();
              const hasZustandData = zustandEntry && (
                zustandEntry.feature?.trim() || zustandEntry.benefit?.trim() || zustandEntry.emotionalBenefit?.trim()
              );
              return (isActive || isCompleted) && (isActiveEntry || hasStateData || hasZustandData);
            })() && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
                  <p className="text-sm font-bold text-gray-700">
                    Entry {entryNumber}
                  </p>
                </div>
              </div>
            )}

            {/* Show questions and answers for this entry */}
            {fieldOrder.map((field) => {
              const questionKey = getQuestionKey(entryIndex, field);
              const isOptional = field === "emotionalBenefit";
              // Check multiple sources for answer (Zustand store > state > session > empty)
              const zustandEntry = persistedFormData?.[entryIndex];
              const zustandValue = zustandEntry?.[field];
              const stateValue = entry[field];
              const sessionEntry = session.step6FeatureBenefitTable?.[entryIndex];
              const sessionValue = sessionEntry?.[field];
              
              // Priority: Zustand store > state > session > empty
              const answer = zustandValue || stateValue || sessionValue || "";
              const hasAnswer = !!(answer && answer.trim());
              
              // A question is answered if it has a value anywhere OR is in answeredQuestions Set
              // This ensures answers show after refresh even if answeredQuestions isn't fully populated
              let isAnswered = hasAnswer || answeredQuestions.has(questionKey);
              
              // For optional fields when completed, also check if required fields are filled
              if (!isAnswered && isCompleted && isOptional) {
                isAnswered = !!(entry.feature?.trim() && entry.benefit?.trim()); // Optional: answered if required fields filled (might be skipped)
              }
              
              const isActiveQuestion = isActiveEntry && field === currentFieldKey;

              // Calculate question number across all entries
              const questionNumber = entryIndex * TOTAL_FIELDS_PER_ENTRY + fieldOrder.indexOf(field) + 1;
              
              // Calculate current question number (for showing all previous questions)
              const currentFieldIndex = currentFieldKey ? fieldOrder.indexOf(currentFieldKey) : -1;
              const currentQuestionNumber = currentEntryIndex >= 0 && currentFieldIndex >= 0
                ? currentEntryIndex * TOTAL_FIELDS_PER_ENTRY + currentFieldIndex + 1
                : 0;

              // Show logic (ChatGPT-style - show all questions that have been asked):
              // 1. If completed: show ALL questions
              // 2. If active: show ALL questions up to and including the current active question
              //    This ensures full conversation history is visible, even after refresh
              // Show if:
              // - Step is completed (show all)
              // - Question is answered (has answer) - always show answered questions
              // - Question number is less than or equal to current question number (show all previous questions)
              // - Question is the current active question
              const shouldShow = isCompleted || isAnswered || isActiveQuestion || 
                (isActive && currentQuestionNumber > 0 && questionNumber <= currentQuestionNumber);
              
              if (!shouldShow) {
                return null;
              }
              const questionLabel = fieldLabels[field];

              return (
                <div key={field} className="space-y-2">
                  {/* Question */}
                  {(isActive || isCompleted || isActiveQuestion) && (
                    <div className="margo-chat-bubble margo-chat-bubble--bot">
                      <div className="margo-message-content">
                        <div className="space-y-2">
                          <p className="text-sm font-bold text-gray-700">
                            Question {questionNumber} of {totalQuestions}
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
                          {isOptional && !isCompleted && (
                            <p className="text-xs text-gray-500 mt-1 italic">
                              You can skip this by typing 'skip' or leaving it blank.
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

                  {/* User's Answer */}
                  {isAnswered && (
                    <>
                      {answer && answer.trim() ? (
                        <div className="margo-chat-bubble margo-chat-bubble--user">
                          <div className="margo-message-content">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{answer}</p>
                          </div>
                        </div>
                      ) : isOptional ? (
                        <div className="margo-chat-bubble margo-chat-bubble--user">
                          <div className="margo-message-content">
                            <p className="text-sm text-gray-500 italic">Skipped</p>
                          </div>
                        </div>
                      ) : null}
                      {/* Loading indicator when submitting this specific question */}
                      {isSubmitting && !isCompleted && questionKey === `${entryIndex}-${field}` && (
                        <div className="margo-chat-bubble margo-chat-bubble--bot">
                          <div className="margo-message-content">
                            <div className="flex items-center gap-2 text-gray-600">
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                              <p className="text-sm">Saving...</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
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
            <p className="text-sm text-gray-600">✓ Step 6 completed - Feature-benefit table saved</p>
          </div>
        </div>
      )}

      {!isCompleted && isActive && <div className="h-8" aria-hidden />}
    </>
  );
};
