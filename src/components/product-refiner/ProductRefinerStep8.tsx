import { useEffect, useState, useCallback, useRef } from "react";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { submitStep8ProofElements, type ProofElement } from "@/lib/product-refiner-api";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { useProductRefinerStore, type StepPersistedState } from "@/stores/productRefinerStore";


export interface ProductRefinerStep8InputHandlers {
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

interface ProductRefinerStep8Props {
  workspaceId: string;
  session: ProductRefinerSession;
  isActive: boolean;
  isCompleted: boolean;
  onSessionChange: (session: ProductRefinerSession) => void;
  onError?: (message: string | null) => void;
  isUnlocked?: boolean;

  onInputHandlersReady?: (handlers: ProductRefinerStep8InputHandlers | null) => void;
  persistedState?: StepPersistedState | null;
  onPersistedStateChange?: (state: StepPersistedState | null) => void;
}

type QuestionKey = 
  | `proof-${number}-type`
  | `proof-${number}-description`
  | `proof-${number}-url`
  | "notes"
  | "ask-more-proof"
  | "review-proof";

const PROOF_TYPES = ["testimonial", "screenshot", "case_study", "visual", "track_record"] as const;
const PROOF_TYPE_LABELS: Record<string, string> = {
  testimonial: "Testimonial",
  screenshot: "Screenshot",
  case_study: "Case Study",
  visual: "Visual",
  track_record: "Track Record",
};

export const ProductRefinerStep8 = ({
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
}: ProductRefinerStep8Props) => {
  const DESCRIPTION_MIN_LENGTH = 10;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const store = useProductRefinerStore(workspaceId);
  
  const sessionHasStep8Data = !!(session.step8ProofElements && (session.step8ProofElements as any).proofElements && (session.step8ProofElements as any).proofElements.length > 0);
  const canUsePersistedFormData = (sessionHasStep8Data || !!persistedState) && store?.getState().formData.step8;
  const persistedFormData = canUsePersistedFormData ? store?.getState().formData.step8 ?? null : null;

  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentInputValue, setCurrentInputValue] = useState(persistedState?.currentInputValue || "");
  const [currentQuestionKey, setCurrentQuestionKey] = useState<QuestionKey | null>(persistedState?.currentQuestionKey as QuestionKey | null || null);
  const [proofElements, setProofElements] = useState<ProofElement[]>(() => {
    if (sessionHasStep8Data && session.step8ProofElements) {
      return (session.step8ProofElements as any).proofElements || [{ type: "", description: "", url: "" }];
    }
    if (persistedFormData?.proofElements && persistedFormData.proofElements.length > 0) {
      return persistedFormData.proofElements as ProofElement[];
    }
    return [{ type: "", description: "", url: "" }];
  });
  const [notes, setNotes] = useState(() => {
    if (sessionHasStep8Data && session.step8ProofElements) {
      return (session.step8ProofElements as any).notes || "";
    }
    if (persistedFormData?.notes) {
      return persistedFormData.notes as string;
    }
    return "";
  });

  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(
    persistedState?.answeredQuestions ? new Set(persistedState.answeredQuestions) : new Set()
  );
  const [missingProofSuggestions, setMissingProofSuggestions] = useState<string[]>([]);
  const [showWhyProofMatters, setShowWhyProofMatters] = useState(true);
  const [hasShownInitialExplanation, setHasShownInitialExplanation] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState<Record<string, boolean>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>(() => {
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
          if (key.endsWith("-url") || key === "notes" || key === "ask-more-proof") {
            skipped.add(key);
          }
        }
      });
    }
    return skipped;
  });
  const sessionRef = useRef<ProductRefinerSession>(session);
  const proofElementsRef = useRef(proofElements);
  const answeredQuestionsRef = useRef(answeredQuestions);
  const skippedQuestionsRef = useRef(skippedQuestions);
  const questionAnswersRef = useRef(questionAnswers);
  const pendingAskMoreRef = useRef<"yes" | null>(null);
  const isManuallyNavigatingRef = useRef(false); // Prevent useEffect from interfering with manual navigation
  const submittingQuestionKeyRef = useRef<string | null>(null); // Track which question is being submitted
  const hasResumedFinalSubmitRef = useRef(false); // Track if we've resumed final submit after refresh
  
  // Track if we're in the middle of final submission (for persistence on refresh)
  const [isFinalizing, setIsFinalizing] = useState<boolean>(() => {
    // If persisted state says we're finalizing but session is not completed,
    // we're likely in the middle of final submission (page refresh during API call)
    if (persistedState?.isFinalizing && !session.step8Completed) {
      return true; // Show loading state on refresh
    }
    return false;
  });
  
  // Debounce Zustand store updates to prevent excessive re-renders
  const zustandUpdateTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (!store) return;
    
    // Clear any pending updates
    if (zustandUpdateTimeoutRef.current) {
      clearTimeout(zustandUpdateTimeoutRef.current);
    }
    
    // Debounce the update to prevent excessive re-renders
    zustandUpdateTimeoutRef.current = setTimeout(() => {
      store.getState().setStep8FormData({
        proofElements,
        notes,
      });
    }, 100);
    
    return () => {
      if (zustandUpdateTimeoutRef.current) {
        clearTimeout(zustandUpdateTimeoutRef.current);
      }
    };
  }, [store, proofElements, notes]);

  useEffect(() => {
    proofElementsRef.current = proofElements;
  }, [proofElements]);

  useEffect(() => {
    answeredQuestionsRef.current = answeredQuestions;
  }, [answeredQuestions]);

  useEffect(() => {
    skippedQuestionsRef.current = skippedQuestions;
  }, [skippedQuestions]);

  useEffect(() => {
    questionAnswersRef.current = questionAnswers;
  }, [questionAnswers]);

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

  const sessionSyncRef = useRef<string>("");
  const hasInitializedRef = useRef(false);
  
  useEffect(() => {
    // Skip if we're manually navigating (prevents blinking during navigation)
    if (isManuallyNavigatingRef.current) {
      return;
    }
    
    sessionRef.current = session;
    
    // Create a unique key for this session state to prevent infinite loops
    // Use stringified form data to detect actual changes
    const persistedFormDataString = persistedFormData ? JSON.stringify(persistedFormData) : "";
    const persistedStateKey = persistedState ? JSON.stringify({
      currentQuestionKey: persistedState.currentQuestionKey,
      answeredQuestionsLength: persistedState.answeredQuestions?.length,
    }) : "";
    
    const sessionKey = `${session?.id || ''}-${sessionHasStep8Data}-${persistedFormDataString}-${persistedStateKey}`;
    
    // Only run if session state actually changed
    if (sessionSyncRef.current === sessionKey && hasInitializedRef.current) {
      return;
    }
    
    sessionSyncRef.current = sessionKey;
    hasInitializedRef.current = true;
    
    const buildAnsweredFromData = (data: { proofElements?: ProofElement[]; notes?: string }) => {
      const answered = new Set<string>();
      data.proofElements?.forEach((element: ProofElement, idx: number) => {
        if (element.type) answered.add(`proof-${idx}-type`);
        if (element.description?.trim()) answered.add(`proof-${idx}-description`);
        if (element.url?.trim()) answered.add(`proof-${idx}-url`);
      });
      if (data.notes?.trim()) {
        answered.add("notes");
      }
      if (persistedState?.answeredQuestions) {
        persistedState.answeredQuestions.forEach(q => answered.add(q));
      }
      if (persistedState?.questionAnswers) {
        Object.keys(persistedState.questionAnswers).forEach((key) => {
          answered.add(key);
        });
      }
      return answered;
    };
    
    if (sessionHasStep8Data && session.step8ProofElements) {
      const data = session.step8ProofElements as any;
      const nextProofElements = data.proofElements || [];
      const nextNotes = data.notes || "";
      
      // Only update if different to prevent infinite loops
      const currentProofElementsString = JSON.stringify(proofElements);
      const nextProofElementsString = JSON.stringify(nextProofElements.length > 0 ? nextProofElements : [{ type: "testimonial", description: "", url: "" }]);
      const currentNotesString = notes || "";
      
      if (currentProofElementsString !== nextProofElementsString || currentNotesString !== nextNotes) {
        setProofElements(nextProofElements.length > 0 ? nextProofElements : [{ type: "testimonial", description: "", url: "" }]);
        setNotes(nextNotes);
        setAnsweredQuestions(buildAnsweredFromData({ proofElements: nextProofElements, notes: nextNotes }));
        
        if (store) {
          store.getState().setStep8FormData({
            proofElements: nextProofElements,
            notes: nextNotes,
          });
        }
      }
      return;
    }
    
    if (persistedState && persistedFormData) {
      const nextProofElements = (persistedFormData.proofElements as ProofElement[]) || [];
      const nextNotes = (persistedFormData.notes as string) || "";
      
      // Only update if different to prevent infinite loops
      const currentProofElementsString = JSON.stringify(proofElements);
      const nextProofElementsString = JSON.stringify(nextProofElements.length > 0 ? nextProofElements : [{ type: "testimonial", description: "", url: "" }]);
      const currentNotesString = notes || "";
      
      if (currentProofElementsString !== nextProofElementsString || currentNotesString !== nextNotes) {
        setProofElements(nextProofElements.length > 0 ? nextProofElements : [{ type: "testimonial", description: "", url: "" }]);
        setNotes(nextNotes);
        setAnsweredQuestions(buildAnsweredFromData({ proofElements: nextProofElements, notes: nextNotes }));
      }
      return;
    }
    
    if (!persistedState && !hasInitializedRef.current) {
      // Fresh session after reset - ensure state is empty (only on first mount)
      const currentProofElementsString = JSON.stringify(proofElements);
      const defaultProofElementsString = JSON.stringify([{ type: "testimonial", description: "", url: "" }]);
      
      if (currentProofElementsString !== defaultProofElementsString || notes !== "") {
        setProofElements([{ type: "testimonial", description: "", url: "" }]);
        setNotes("");
        setAnsweredQuestions(new Set());
        setCurrentQuestionKey(null);
        setCurrentInputValue("");
      }
    }
  }, [session?.id, sessionHasStep8Data]); // Removed persistedFormData and persistedState from deps - using refs to track changes instead

  const determineNextQuestion = useCallback(() => {
    // Find first incomplete proof element
    for (let i = 0; i < proofElements.length; i++) {
      const element = proofElements[i];
      if (!answeredQuestions.has(`proof-${i}-type`)) {
        setCurrentQuestionKey(`proof-${i}-type`);
        // Don't pre-fill with default value - let user choose
        setCurrentInputValue("");
        return;
      }
      if (!answeredQuestions.has(`proof-${i}-description`)) {
        setCurrentQuestionKey(`proof-${i}-description`);
        setCurrentInputValue(element.description || "");
        return;
      }
      if (!answeredQuestions.has(`proof-${i}-url`)) {
        setCurrentQuestionKey(`proof-${i}-url`);
        setCurrentInputValue(element.url || "");
        return;
      }
    }

    // All proof elements complete, check if ready to submit or need notes
    const validElements = proofElements.filter(e => 
      e.type && 
      e.description?.trim() && 
      e.description.trim().length >= DESCRIPTION_MIN_LENGTH
    );

    if (validElements.length === 0) {
      // Need at least one complete proof element
      return;
    }

    // After at least one proof element, check if we should review and suggest missing proof
    if (!answeredQuestions.has("review-proof") && validElements.length > 0) {
      setCurrentQuestionKey("review-proof");
      setCurrentInputValue("");
      return;
    }

    // Check if ask-more-proof is needed
    if (!answeredQuestions.has("ask-more-proof") && answeredQuestions.has("review-proof")) {
      setCurrentQuestionKey("ask-more-proof");
      setCurrentInputValue("");
      return;
    }

    // Check notes
    if (!answeredQuestions.has("notes")) {
      setCurrentQuestionKey("notes");
      setCurrentInputValue(notes || "");
      return;
    }

    // Ready to submit
    setCurrentQuestionKey(null);
    setCurrentInputValue("");
    // handleFinalSubmit will be called via ref
    if (handleFinalSubmitRef.current) {
      handleFinalSubmitRef.current();
    }
  }, [proofElements, answeredQuestions, notes]);

  // Initialize current question when step becomes active
  const determineNextQuestionRef = useRef(determineNextQuestion);
  useEffect(() => {
    determineNextQuestionRef.current = determineNextQuestion;
  }, [determineNextQuestion]);

  const resetProofElementState = useCallback((index: number) => {
    setAnsweredQuestions((prev) => {
      const next = new Set(prev);
      next.delete(`proof-${index}-type`);
      next.delete(`proof-${index}-description`);
      next.delete(`proof-${index}-url`);
      return next;
    });
    setSkippedQuestions((prev) => {
      if (!prev.has(`proof-${index}-url`)) return prev;
      const next = new Set(prev);
      next.delete(`proof-${index}-url`);
      return next;
    });
    setQuestionAnswers((prev) => {
      const next = { ...prev };
      delete next[`proof-${index}-type`];
      delete next[`proof-${index}-description`];
      delete next[`proof-${index}-url`];
      return next;
    });
  }, []);

  const focusProofQuestion = useCallback((index: number, stage: "description" | "url") => {
    const targetKey = (`proof-${index}-${stage}`) as QuestionKey;
    if (!answeredQuestionsRef.current.has(targetKey)) {
      const latestElement = proofElementsRef.current[index];
      const nextValue = stage === "description"
        ? latestElement?.description || ""
        : latestElement?.url || "";
      setCurrentQuestionKey(targetKey);
      setCurrentInputValue(nextValue);
      return true;
    }
    return false;
  }, []);

  const isDeterminingNextRef = useRef(false);
  const lastDeterminedQuestionRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Skip if we're manually navigating (prevents blinking during navigation)
    if (isManuallyNavigatingRef.current || isDeterminingNextRef.current) {
      return;
    }
    
    // Skip if user is currently on a valid question (prevents resetting during typing)
    if (currentQuestionKey !== null) {
      // Check if the current question is still valid (not answered yet)
      const isCurrentQuestionAnswered = answeredQuestions.has(currentQuestionKey);
      if (!isCurrentQuestionAnswered) {
        return; // User is actively on a question, don't interfere
      }
      // Also check if we just determined this question (prevent double calls)
      if (lastDeterminedQuestionRef.current === currentQuestionKey) {
        return;
      }
    }
    
    if (isActive && !isCompleted) {
      isDeterminingNextRef.current = true;
      determineNextQuestionRef.current();
      lastDeterminedQuestionRef.current = currentQuestionKey;
      // Reset flag after a delay
      setTimeout(() => {
        isDeterminingNextRef.current = false;
      }, 100);
    }
  }, [isActive, isCompleted, proofElements, notes, answeredQuestions, currentQuestionKey]);

  const handleQuestionSubmit = useCallback(async (questionKey: QuestionKey, value: string) => {
    // Prevent double submission
    if (isSubmitting || submittingQuestionKeyRef.current === questionKey) {
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

    // Handle proof type questions
    if (questionKey.startsWith("proof-") && questionKey.endsWith("-type")) {
      const index = parseInt(questionKey.split("-")[1]);
      const normalizedType = trimmedValue.toLowerCase().replace(/[_\s]/g, "_");
      const matchedType = PROOF_TYPES.find(t => 
        t === normalizedType || 
        t.replace(/_/g, " ") === trimmedValue.toLowerCase() ||
        PROOF_TYPE_LABELS[t].toLowerCase() === trimmedValue.toLowerCase()
      );

      if (!matchedType) {
        setValidationError(`Please enter one of: ${PROOF_TYPES.map(t => PROOF_TYPE_LABELS[t]).join(", ")}`);
        return;
      }

      setValidationError(null);
      setIsSubmitting(true);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      try {
        const updated = [...proofElements];
        updated[index] = { ...updated[index], type: matchedType };
        
        // Batch state updates to prevent blinking
        setProofElements(updated);
        setAnsweredQuestions(prev => new Set([...prev, questionKey]));
        
        // Save to Zustand store immediately for persistence
        if (store) {
          store.getState().setStep8FormData({
            proofElements: updated,
            notes: notes,
          });
        }
        
      // Move to next question after a small delay
      setTimeout(() => {
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking
        const advanced = focusProofQuestion(index, "description");
        if (!advanced) {
          isDeterminingNextRef.current = true;
          determineNextQuestionRef.current();
          setTimeout(() => {
            isDeterminingNextRef.current = false;
          }, 100);
        }
      }, 200);
      } catch (error: any) {
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking on error
        setValidationError(error?.message || "Failed to save proof type");
      }
      return;
    }

    // Handle proof description questions
    if (questionKey.startsWith("proof-") && questionKey.endsWith("-description")) {
      const index = parseInt(questionKey.split("-")[1]);
      if (!trimmedValue) {
        setValidationError("Description is required");
        return;
      }
      if (trimmedValue.length < DESCRIPTION_MIN_LENGTH) {
        setValidationError(`Description must be at least ${DESCRIPTION_MIN_LENGTH} characters`);
        return;
      }

      setValidationError(null);
      setIsSubmitting(true);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      try {
        const updated = [...proofElements];
        updated[index] = { ...updated[index], description: trimmedValue };
        
        // Batch state updates to prevent blinking
        setProofElements(updated);
        setAnsweredQuestions(prev => new Set([...prev, questionKey]));
        
        // Save to Zustand store immediately for persistence
        if (store) {
          store.getState().setStep8FormData({
            proofElements: updated,
            notes: notes,
          });
        }
        
        // Move to next question after a small delay
        setTimeout(() => {
          isManuallyNavigatingRef.current = false;
          setIsSubmitting(false);
          submittingQuestionKeyRef.current = null; // Clear submission tracking
          const advanced = focusProofQuestion(index, "url");
          if (!advanced) {
            isDeterminingNextRef.current = true;
            determineNextQuestionRef.current();
            setTimeout(() => {
              isDeterminingNextRef.current = false;
            }, 100);
          }
        }, 200);
      } catch (error: any) {
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking on error
        setValidationError(error?.message || "Failed to save description");
      }
      return;
    }

    // Handle proof URL questions (optional)
    if (questionKey.startsWith("proof-") && questionKey.endsWith("-url")) {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      const index = parseInt(questionKey.split("-")[1]);
      
      setIsSubmitting(true);
      setValidationError(null);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      // Optional field - allow blank or skip command - show "Saving..." indicator
      const isSkipped = isSkipCommand(trimmedValue) || !trimmedValue;
      const updated = [...proofElements];
      updated[index] = { ...updated[index], url: isSkipped ? "" : trimmedValue };
      
      // Track skipped state
      if (isSkipped) {
        setSkippedQuestions(prev => new Set([...prev, questionKey]));
        setQuestionAnswers(prev => ({ ...prev, [questionKey]: "" }));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete(questionKey);
          return next;
        });
        setQuestionAnswers(prev => ({ ...prev, [questionKey]: trimmedValue }));
      }
      
      // Batch state updates to prevent blinking
      setProofElements(updated);
      setAnsweredQuestions(prev => new Set([...prev, questionKey]));
      
      // Move to next question - show "Saving..." for a moment
      setTimeout(() => {
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking
        if (pendingAskMoreRef.current === "yes") {
          pendingAskMoreRef.current = null;
          setAnsweredQuestions((prev) => {
            const next = new Set(prev);
            next.delete("ask-more-proof");
            return next;
          });
          setSkippedQuestions((prev) => {
            if (!prev.has("ask-more-proof")) return prev;
            const next = new Set(prev);
            next.delete("ask-more-proof");
            return next;
          });
          setCurrentQuestionKey("ask-more-proof");
          setCurrentInputValue("");
          return;
        }
        // Use ref to prevent double calls
        isDeterminingNextRef.current = true;
        determineNextQuestionRef.current();
        setTimeout(() => {
          isDeterminingNextRef.current = false;
        }, 100);
      }, 200);
      return;
    }

    // Handle review-proof question - analyze what's missing
    if (questionKey === "review-proof") {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      setValidationError(null);
      setIsSubmitting(true);
      
      // Analyze collected proof types
      const collectedTypes = new Set(proofElements.map(e => e.type).filter(Boolean));
      const allTypes = PROOF_TYPES.map(t => t);
      const missingTypes = allTypes.filter(t => !collectedTypes.has(t));
      
      // Generate suggestions for missing proof types
      const suggestions: string[] = [];
      if (missingTypes.includes("testimonial")) {
        suggestions.push("Consider adding customer testimonials to build trust and credibility");
      }
      if (missingTypes.includes("case_study")) {
        suggestions.push("Case studies showing real results can significantly increase conversion");
      }
      if (missingTypes.includes("screenshot")) {
        suggestions.push("Screenshots of your product or results provide visual proof");
      }
      if (missingTypes.includes("visual")) {
        suggestions.push("Visual elements like charts or infographics make your proof more compelling");
      }
      if (missingTypes.includes("track_record")) {
        suggestions.push("Track record information (years in business, clients served) establishes authority");
      }
      
      setMissingProofSuggestions(suggestions);
      setAnsweredQuestions(prev => new Set([...prev, "review-proof"]));
      
      // Track question answer
      setQuestionAnswers(prev => ({ ...prev, "review-proof": "reviewed" }));
      
      // Ask if they want to add more proof
      setTimeout(() => {
        setCurrentQuestionKey("ask-more-proof");
        setCurrentInputValue("");
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
      }, 200);
      return;
    }

    // Handle ask-more-proof question
    if (questionKey === "ask-more-proof") {
      const wantsToAdd = isAffirmativeResponse(trimmedValue);
      const wantsToSkip = isSkipCommand(trimmedValue) || (!trimmedValue && !wantsToAdd);
      
      if (!wantsToSkip && !wantsToAdd) {
        setValidationError("Please respond with yes to add more proof or no/skip to continue.");
        return;
      }
      
      setValidationError(null);
      setIsSubmitting(true);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      setAnsweredQuestions(prev => new Set([...prev, "ask-more-proof"]));
      
      // Track question answer
      const answerText = wantsToAdd ? "yes" : "no";
      setQuestionAnswers(prev => ({ ...prev, "ask-more-proof": answerText }));
      pendingAskMoreRef.current = wantsToAdd ? "yes" : null;
      
      // Track skipped state
      if (wantsToSkip) {
        setSkippedQuestions(prev => new Set([...prev, "ask-more-proof"]));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete("ask-more-proof");
          return next;
        });
      }
      
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      if (wantsToAdd) {
        // Add new proof element
        const newIndex = proofElements.length;
        const newProofElements = [...proofElements, { type: "", description: "", url: "" }];
        setProofElements(newProofElements);
        resetProofElementState(newIndex);
        
        // Save to Zustand store
        if (store) {
          store.getState().setStep8FormData({
            proofElements: newProofElements,
            notes: notes,
          });
        }
        
        // Move to new proof element
        setTimeout(() => {
          setCurrentQuestionKey(`proof-${newIndex}-type`);
          setCurrentInputValue("");
          isManuallyNavigatingRef.current = false;
          setIsSubmitting(false);
          submittingQuestionKeyRef.current = null; // Clear submission tracking
        }, 200);
      } else {
        // Skip - move to notes
        setTimeout(() => {
          setCurrentQuestionKey("notes");
          setCurrentInputValue(notes || "");
          isManuallyNavigatingRef.current = false;
          setIsSubmitting(false);
          submittingQuestionKeyRef.current = null; // Clear submission tracking
        }, 200);
      }
      return;
    }

    // Handle notes question (optional, last question)
    if (questionKey === "notes") {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      setValidationError(null);
      setIsSubmitting(true);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      // Optional field - allow blank or skip command
      const isSkipped = isSkipCommand(trimmedValue) || !trimmedValue;
      const finalNotes = isSkipped ? "" : trimmedValue;
      
      // Track skipped state
      if (isSkipped) {
        setSkippedQuestions(prev => new Set([...prev, "notes"]));
        setQuestionAnswers(prev => ({ ...prev, "notes": "" }));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete("notes");
          return next;
        });
        setQuestionAnswers(prev => ({ ...prev, "notes": trimmedValue }));
      }
      
      // Batch state updates to prevent blinking
      setNotes(finalNotes);
      setAnsweredQuestions(prev => new Set([...prev, "notes"]));
      
      // Save to Zustand store immediately for persistence
      if (store) {
        store.getState().setStep8FormData({
          proofElements: proofElements,
          notes: finalNotes,
        });
      }
      
      // This is the last question, submit the step
      // Use setTimeout to ensure state updates propagate and show loading state
      setTimeout(() => {
        submittingQuestionKeyRef.current = null; // Clear submission tracking before final submit
        handleFinalSubmit();
      }, 200);
      return;
    }
  }, [proofElements, notes, session, toast, isSkipCommand, answeredQuestions, isSubmitting, isAffirmativeResponse]);

  // Auto-process review-proof question when it becomes active
  const handleQuestionSubmitRefForAuto = useRef(handleQuestionSubmit);
  useEffect(() => {
    handleQuestionSubmitRefForAuto.current = handleQuestionSubmit;
  }, [handleQuestionSubmit]);
  
  useEffect(() => {
    if (isActive && !isCompleted && currentQuestionKey === "review-proof" && !answeredQuestions.has("review-proof") && !isSubmitting) {
      // Auto-process the review question after a short delay to show the question first
      const timeoutId = setTimeout(() => {
        handleQuestionSubmitRefForAuto.current("review-proof", "");
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isActive, isCompleted, currentQuestionKey, answeredQuestions, isSubmitting]);

  const handleFinalSubmitRef = useRef<() => void>();
  const handleFinalSubmit = useCallback(async () => {
    const currentSession = sessionRef.current || session;
    if (!currentSession?.id) {
      isManuallyNavigatingRef.current = false; // Reset flag on error
      return;
    }

    const validElements = proofElements.filter(e => 
      e.type && 
      e.description?.trim() && 
      e.description.trim().length >= DESCRIPTION_MIN_LENGTH
    );

    if (validElements.length === 0) {
      isManuallyNavigatingRef.current = false; // Reset flag on validation error
      setValidationError("At least one complete proof element is required");
      // Go back to first proof element
      if (proofElements.length === 0) {
        setProofElements([{ type: "", description: "", url: "" }]);
      }
      setCurrentQuestionKey("proof-0-type");
      setCurrentInputValue(""); // Don't pre-fill with default value
      setIsSubmitting(false);
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);
    setIsFinalizing(true); // Mark that we're finalizing
    onError?.(null);

    try {
      const response = await submitStep8ProofElements(currentSession.id, {
        proofElements: validElements,
        notes: notes.trim() || undefined,
      });

      // Extract missing proof suggestions from API response if available
      if (response.missingProof && Array.isArray(response.missingProof)) {
        const suggestions = response.missingProof.map((item: any) => 
          typeof item === 'string' ? item : item.suggestion || item.type || ''
        ).filter(Boolean);
        if (suggestions.length > 0) {
          setMissingProofSuggestions(suggestions);
        }
      }

      const updatedSession: ProductRefinerSession = {
        ...currentSession,
        step8ProofElements: {
          proofElements: validElements,
          notes: notes.trim() || undefined,
        },
        step8Completed: true,
        currentStep: 9,
      };
      onSessionChange(updatedSession);

      setCurrentQuestionKey(null);
      setCurrentInputValue("");
    } catch (error: any) {
      const message = error?.message || "Failed to submit proof elements";
      onError?.(message);
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      isManuallyNavigatingRef.current = false; // Reset navigation flag
      setIsSubmitting(false);
      setIsFinalizing(false); // Clear finalizing flag
      submittingQuestionKeyRef.current = null; // Clear submission tracking
      hasResumedFinalSubmitRef.current = false; // Reset resume flag
    }
  }, [session, onSessionChange, onError, toast, proofElements, notes]);
  
  useEffect(() => {
    handleFinalSubmitRef.current = handleFinalSubmit;
  }, [handleFinalSubmit]);

  // Resume final submission if we were in the middle of it (page refresh scenario)
  useEffect(() => {
    if (
      isActive &&
      !isCompleted &&
      persistedState?.isFinalizing &&
      !session.step8Completed &&
      !hasResumedFinalSubmitRef.current
    ) {
      hasResumedFinalSubmitRef.current = true;
      setIsFinalizing(true);
      handleFinalSubmitRef.current?.();
    }
  }, [isActive, isCompleted, persistedState?.isFinalizing, session.step8Completed]);


  // Expose input handlers to parent component
  const onInputHandlersReadyRef = useRef(onInputHandlersReady);
  const handleQuestionSubmitRef = useRef(handleQuestionSubmit);
  
  useEffect(() => {
    onInputHandlersReadyRef.current = onInputHandlersReady;
    handleQuestionSubmitRef.current = handleQuestionSubmit;
  }, [onInputHandlersReady, handleQuestionSubmit]);
  
  useEffect(() => {
    if (!onInputHandlersReadyRef.current) return;
    
    const shouldProvideHandlers = isActive && !isCompleted && currentQuestionKey !== null && !isFinalizing;
    
    if (shouldProvideHandlers) {
      const getQuestionLabel = (key: QuestionKey): string => {
        if (key.startsWith("proof-") && key.endsWith("-type")) {
          const index = parseInt(key.split("-")[1]);
          return `What type of proof is element ${index + 1}? You can type: ${PROOF_TYPES.map(t => PROOF_TYPE_LABELS[t]).join(", ")}`;
        }
        if (key.startsWith("proof-") && key.endsWith("-description")) {
          const index = parseInt(key.split("-")[1]);
          return `What is the description for proof element ${index + 1}?`;
        }
        if (key.startsWith("proof-") && key.endsWith("-url")) {
          const index = parseInt(key.split("-")[1]);
          return `What is the URL for proof element ${index + 1}? (Optional — you can skip this)`;
        }
        if (key === "review-proof") {
          return "Let me review your proof elements and suggest what might be missing...";
        }
        if (key === "ask-more-proof") {
          return "Would you like to add more proof elements? (Optional — you can skip this)";
        }
        if (key === "notes") {
          return "Any additional notes? (Optional — you can skip this)";
        }
        return "";
      };

      const isOptional = currentQuestionKey?.endsWith("-url") || 
                        currentQuestionKey === "notes" || 
                        currentQuestionKey === "ask-more-proof";
      const isOptionQuestion = currentQuestionKey === "ask-more-proof";
      const isReviewQuestion = currentQuestionKey === "review-proof";
      
      const wrappedSubmit = () => {
        if (currentQuestionKey) {
          // Review question is auto-processed, don't require user input
          if (isReviewQuestion) {
            handleQuestionSubmitRef.current(currentQuestionKey, "");
            return;
          }
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
      
      // Use generic placeholder, not the full question
      const placeholder = currentQuestionKey?.endsWith("-type")
        ? `Type one of: ${PROOF_TYPES.map(t => PROOF_TYPE_LABELS[t]).join(", ")}`
        : "Enter your answer...";
      
      onInputHandlersReadyRef.current({
        inputValue: isReviewQuestion ? "" : currentInputValue,
        onInputChange: handleInputChange,
        onInputSubmit: wrappedSubmit,
        isSubmitting,
        placeholder: isReviewQuestion ? "" : placeholder,
        currentQuestionKey: currentQuestionKey,
        currentQuestionLabel: questionLabel,
        validationError: validationError,
        validationHint: isOptionQuestion ? "Type yes to add more or no to continue." : null,
      });
    } else {
      onInputHandlersReadyRef.current(null);
    }
  }, [isActive, isCompleted, currentQuestionKey, currentInputValue, isSubmitting, validationError, isSkipCommand, isAffirmativeResponse]); // Removed handleQuestionSubmit and onInputHandlersReady from deps

  // Persist UI state whenever it changes (for refresh persistence)
  const prevPersistedStateRef = useRef<{
    currentQuestionKey: string | null;
    currentInputValue: string;
    answeredQuestions: string[];
    questionAnswers: Record<string, string>;
    isCompleted: boolean;
    isActive: boolean;
    isFinalizing: boolean;
  } | null>(null);
  const onPersistedStateChangeRef = useRef(onPersistedStateChange);
  
  useEffect(() => {
    onPersistedStateChangeRef.current = onPersistedStateChange;
  }, [onPersistedStateChange]);
  
  const answeredQuestionsSizeRef = useRef<number>(0);
  const answeredQuestionsStringRef = useRef<string>("");
  
  useEffect(() => {
    const callback = onPersistedStateChangeRef.current;
    if (!callback) return;
    
    const answeredQuestionsArray = Array.from(answeredQuestions).sort();
    const answeredQuestionsString = JSON.stringify(answeredQuestionsArray);
    const hasState =
      answeredQuestionsArray.length > 0 ||
      (currentQuestionKey !== null && currentQuestionKey !== undefined) ||
      (currentInputValue && currentInputValue.trim().length > 0) ||
      Object.keys(questionAnswers ?? {}).length > 0 ||
      isFinalizing;
    
    if (!hasState) {
      if (prevPersistedStateRef.current) {
        prevPersistedStateRef.current = null;
        callback(null);
      }
      return;
    }
    
    // Only proceed if answeredQuestions actually changed
    if (answeredQuestions.size === answeredQuestionsSizeRef.current && 
        answeredQuestionsString === answeredQuestionsStringRef.current &&
        prevPersistedStateRef.current) {
      // Check if other state changed
      const prevState = prevPersistedStateRef.current;
      if (prevState.currentQuestionKey === currentQuestionKey &&
          prevState.currentInputValue === currentInputValue &&
          prevState.isCompleted === isCompleted &&
          prevState.isActive === isActive &&
          (prevState as any).isFinalizing === isFinalizing &&
          JSON.stringify(prevState.questionAnswers) === JSON.stringify(questionAnswers)) {
        return; // Nothing changed
      }
    }
    
    answeredQuestionsSizeRef.current = answeredQuestions.size;
    answeredQuestionsStringRef.current = answeredQuestionsString;
    
    const state: StepPersistedState = {
      currentQuestionKey: currentQuestionKey,
      currentInputValue,
      answeredQuestions: answeredQuestionsArray,
      questionAnswers: questionAnswers,
      isFinalizing: isFinalizing,
    };

    const prevState = prevPersistedStateRef.current;
    const stateChanged = !prevState || 
        prevState.currentQuestionKey !== state.currentQuestionKey ||
        prevState.currentInputValue !== state.currentInputValue ||
        prevState.answeredQuestions.length !== state.answeredQuestions.length ||
        prevState.answeredQuestions.some((q, i) => q !== state.answeredQuestions[i]) ||
        JSON.stringify(prevState.questionAnswers) !== JSON.stringify(state.questionAnswers) ||
        prevState.isCompleted !== isCompleted ||
        prevState.isActive !== isActive ||
        (prevState as any).isFinalizing !== isFinalizing;
    
    if (stateChanged) {
      prevPersistedStateRef.current = {
        currentQuestionKey: state.currentQuestionKey,
        currentInputValue: state.currentInputValue,
        answeredQuestions: [...state.answeredQuestions],
        questionAnswers: state.questionAnswers ? { ...state.questionAnswers } : {},
        isCompleted,
        isActive,
        isFinalizing: isFinalizing,
      } as any;
      callback(state);
    }
  }, [currentQuestionKey, currentInputValue, answeredQuestions.size, questionAnswers, isCompleted, isActive, isFinalizing]); // Added isFinalizing to deps

  // Restore from persistedState on mount/refresh
  const persistedStateRestoredRef = useRef<string>("");
  useEffect(() => {
    // Skip if we're manually navigating (prevents blinking during navigation)
    if (isManuallyNavigatingRef.current) {
      return;
    }
    
    // Only run on mount or when persistedState changes, not on every proofElements/notes change
    if (persistedState) {
      // Create a unique key for this persistedState to prevent infinite loops
      const persistedStateKey = JSON.stringify({
        currentQuestionKey: persistedState.currentQuestionKey,
        answeredQuestions: persistedState.answeredQuestions?.sort(),
      });
      
      // Only run if persistedState actually changed
      if (persistedStateRestoredRef.current === persistedStateKey) {
        return;
      }
      
      persistedStateRestoredRef.current = persistedStateKey;
      
      // Restore questionAnswers if available
      if (persistedState.questionAnswers && Object.keys(persistedState.questionAnswers).length > 0) {
        setQuestionAnswers(persistedState.questionAnswers);
        
        // Restore skipped questions from questionAnswers
        const skipped = new Set<string>();
        Object.entries(persistedState.questionAnswers).forEach(([key, value]) => {
          if (!value || value.trim() === "" || value.toLowerCase() === "no") {
            if (key.endsWith("-url") || key === "notes" || key === "ask-more-proof") {
              skipped.add(key);
            }
          }
        });
        setSkippedQuestions(skipped);
      }
      
      // First, ensure answeredQuestions includes all questions with answers from proofElements
      const answeredFromData = new Set<string>();
      proofElements.forEach((element, idx) => {
        if (element.type) answeredFromData.add(`proof-${idx}-type`);
        if (element.description?.trim()) answeredFromData.add(`proof-${idx}-description`);
        if (element.url?.trim()) answeredFromData.add(`proof-${idx}-url`);
      });
      if (notes?.trim()) {
        answeredFromData.add("notes");
      }
      // Also check questionAnswers for review-proof and ask-more-proof
      if (persistedState.questionAnswers) {
        if (persistedState.questionAnswers["review-proof"]) {
          answeredFromData.add("review-proof");
        }
        if (persistedState.questionAnswers["ask-more-proof"]) {
          answeredFromData.add("ask-more-proof");
        }
      }
      // Merge with persistedState answeredQuestions
      if (persistedState.answeredQuestions) {
        persistedState.answeredQuestions.forEach(q => answeredFromData.add(q));
      }
      
      // Only update if answeredQuestions actually changed
      const currentAnsweredArray = Array.from(answeredQuestions).sort();
      const newAnsweredArray = Array.from(answeredFromData).sort();
      if (JSON.stringify(currentAnsweredArray) !== JSON.stringify(newAnsweredArray)) {
        setAnsweredQuestions(answeredFromData);
      }
      
      // Only restore current question if it's not already answered
      if (persistedState.currentQuestionKey && !answeredFromData.has(persistedState.currentQuestionKey)) {
        setCurrentQuestionKey(persistedState.currentQuestionKey as QuestionKey);
        setCurrentInputValue(persistedState.currentInputValue || "");
      }
    }
  }, [persistedState?.currentQuestionKey, persistedState?.answeredQuestions?.length, isActive, isCompleted]); // Only depend on persistedState keys, not the whole object

  if (!isUnlocked && !isActive && !isCompleted) {
    return null;
  }

  // Show why proof matters explanation on first activation
  useEffect(() => {
    if (isActive && !isCompleted && !hasShownInitialExplanation) {
      setHasShownInitialExplanation(true);
    }
  }, [isActive, isCompleted, hasShownInitialExplanation]);

  return (
    <>
      {/* Why Proof Matters - Initial Explanation */}
      {(isActive || isCompleted) && showWhyProofMatters && !isCompleted && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="space-y-3">
              <ChunkedText
                text="Why proof matters: Evidence builds trust and credibility. When prospects see real testimonials, case studies, screenshots, or track records, they're more likely to believe your claims and take action. Let's collect proof elements to support your offer."
                staggerMs={30}
              />
              <button
                onClick={() => setShowWhyProofMatters(false)}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Got it, continue
              </button>
            </div>
          </div>
        </div>
      )}

      {(isActive || isCompleted) && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            {isCompleted ? (
              <p>Perfect! Your proof elements are saved. Now let's set up your pricing structure.</p>
            ) : (
              <ChunkedText
                text={`Now let's add proof and credibility elements. We'll collect proof elements such as testimonials, screenshots, case studies, visuals, or track record information.`}
                staggerMs={30}
              />
            )}
          </div>
        </div>
      )}


      {/* Show all proof elements with their questions and answers */}
      {proofElements.map((element, index) => {
        const elementNumber = index + 1;
        const isActiveElement = currentQuestionKey?.startsWith(`proof-${index}-`) || false;
        const elementHasContent =
          !!element.type ||
          !!(element.description && element.description.trim()) ||
          !!(element.url && element.url.trim());
        
        return (
          <div key={index} className="space-y-4">
            {/* Proof element header */}
            {((isActive || isCompleted) && (isActiveElement || elementHasContent)) && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">

                  <p className="text-sm font-bold text-gray-700">
                    Proof Element {elementNumber}
                  </p>
                </div>
                      </div>

            )}

            {/* Type question */}
            {(() => {
              const questionKey: QuestionKey = `proof-${index}-type`;
              // A question is answered if it's in answeredQuestions Set OR has a value in the element
              const hasValue = !!element.type;
              const isAnswered = answeredQuestions.has(questionKey) || hasValue;
              const isActiveQuestion = isActive && questionKey === currentQuestionKey;
              const shouldShow = isCompleted || isActiveQuestion || isAnswered;
              if (!shouldShow) return null;

              return (
                <div key={questionKey} className="space-y-4">
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content">
                      <div className="space-y-2">
                        {isCompleted ? (
                          <p className="text-base text-gray-900">What type of proof is element {elementNumber}? You can type: {PROOF_TYPES.map(t => PROOF_TYPE_LABELS[t]).join(", ")}</p>
                        ) : (
                          <>
                            <ChunkedText
                              text={`What type of proof is element ${elementNumber}?`}
                              chunkClassName="text-base text-gray-900"
                              staggerMs={30}
                            />
                            {isActiveQuestion && (
                              <>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {PROOF_TYPES.map((type) => (
                                    <button
                                      key={type}
                                      onClick={() => {
                                        if (!isSubmitting) {
                                          handleQuestionSubmit(questionKey, PROOF_TYPE_LABELS[type]);
                                        }
                                      }}
                                      className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      disabled={isSubmitting}
                                    >
                                      {PROOF_TYPE_LABELS[type]}
                                    </button>
                                  ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2 italic">Click a button above or type the name</p>
                              </>
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
                  {hasValue && (
                    <div className="margo-chat-bubble margo-chat-bubble--user">
                      <div className="margo-message-content">
                        <p className="text-sm text-gray-700">{PROOF_TYPE_LABELS[element.type] || element.type}</p>
                      </div>
                    </div>
                  )}
                      </div>

              );
            })()}

            {/* Description question */}
            {(() => {
              const questionKey: QuestionKey = `proof-${index}-description`;
              // A question is answered if it's in answeredQuestions Set OR has a value in the element
              const hasValue = !!(element.description && element.description.trim());
              const isAnswered = answeredQuestions.has(questionKey) || hasValue;
              const isActiveQuestion = isActive && questionKey === currentQuestionKey;
              const shouldShow = isCompleted || isActiveQuestion || isAnswered;
              if (!shouldShow) return null;

              return (
                <div key={questionKey} className="space-y-4">
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content">
                      <div className="space-y-2">
                        {isCompleted ? (
                          <p className="text-base text-gray-900">What is the description for proof element {elementNumber}?</p>
                        ) : (
                          <ChunkedText
                            text={`What is the description for proof element ${elementNumber}?`}
                            chunkClassName="text-base text-gray-900"
                            staggerMs={30}
                          />
                        )}
                        {isAnswered && (
                          <span className="inline-block rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 mt-2">
                            ✓ Saved
                          </span>
                        )}
                      </div>
                    </div>

                  </div>
                  {hasValue && (
                    <div className="margo-chat-bubble margo-chat-bubble--user">
                      <div className="margo-message-content">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{element.description}</p>
                      </div>
                    </div>
                  )}
              </div>

              );
            })()}

            {/* URL question (optional) */}
            {(() => {
              const questionKey: QuestionKey = `proof-${index}-url`;
              const hasValue = !!(element.url && element.url.trim());
              const wasMarkedAnswered = answeredQuestions.has(questionKey);
              const isAnswered = wasMarkedAnswered || hasValue;
              const isActiveQuestion = isActive && questionKey === currentQuestionKey;
              const isSkipped = skippedQuestions.has(questionKey) || (isAnswered && !hasValue);
              const shouldShow = isCompleted || isActiveQuestion || isAnswered;
              if (!shouldShow) return null;

              return (
                <div key={questionKey} className="space-y-4">
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content">
                      <div className="space-y-2">
                        {isCompleted ? (
                          <p className="text-base text-gray-900">What is the URL for proof element {elementNumber}? (Optional — you can skip this)</p>
                        ) : questionKey === currentQuestionKey ? (
                          <>
                            <ChunkedText
                              text={`What is the URL for proof element ${elementNumber}? (Optional — you can skip this)`}
                              chunkClassName="text-base text-gray-900"
                              staggerMs={30}
                            />
                            <p className="text-xs text-gray-500 mt-1 italic">You can skip this by typing 'skip' or leaving it blank.</p>
                          </>
                        ) : null}
                        {isAnswered && (
                          <span className="inline-block rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 mt-2">
                            ✓ Saved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isAnswered && (
                    <>
                      {hasValue && !isSkipped ? (
                        <div className="margo-chat-bubble margo-chat-bubble--user">
                          <div className="margo-message-content">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{element.url}</p>
                          </div>
                        </div>
                      ) : isSkipped ? (
                        <div className="margo-chat-bubble margo-chat-bubble--user">
                          <div className="margo-message-content">
                            <p className="text-sm text-gray-500 italic">Skipped</p>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })()}
              </div>

        );
      })}

      {/* Review Proof and Suggestions */}
      {(() => {
        const reviewAnswer = questionAnswers?.["review-proof"];
        const hasSuggestions = missingProofSuggestions.length > 0;
        const isReviewAnswered = answeredQuestions.has("review-proof") || !!reviewAnswer || hasSuggestions;
        const isReviewActive = isActive && currentQuestionKey === "review-proof";
        const shouldShow = isCompleted || isReviewAnswered || isReviewActive;
        if (!shouldShow) return null;
        
        return (
          <div className="space-y-4">
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <div className="space-y-2">
                  {isCompleted ? (
                    <p className="text-base text-gray-900">Let me review your proof elements and suggest what might be missing...</p>
                  ) : isReviewActive ? (
                    <ChunkedText
                      text="Let me review your proof elements and suggest what might be missing..."
                      chunkClassName="text-base text-gray-900"
                      staggerMs={30}
                    />
                  ) : null}
                  {isReviewAnswered && (
                    <span className="inline-block rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 mt-2">
                      ✓ Reviewed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Missing Proof Suggestions */}
            {hasSuggestions && (isReviewAnswered || isCompleted) && (
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content p-0">
                  <div className="rounded-2xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 text-gray-900 font-medium">
                        <Lightbulb className="w-4 h-4 text-vox-pink" />
                        <span>Proof Suggestions</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSuggestions(prev => ({
                            ...prev,
                            suggestions: !prev.suggestions
                          }));
                        }}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showSuggestions.suggestions ? "Hide suggestions" : "Show suggestions"}
                      >
                        {showSuggestions.suggestions ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {showSuggestions.suggestions && (
                      <div className="px-4 py-4 space-y-3">
                        <div className="space-y-2 text-sm text-gray-700">
                          {missingProofSuggestions.map((suggestion, idx) => (
                            <p key={idx}>• {suggestion}</p>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500">
                          Consider adding these types of proof to strengthen your offer.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Ask More Proof Question */}
            {(() => {
              const askMoreAnswer = questionAnswers?.["ask-more-proof"];
              const isAskMoreAnswered = answeredQuestions.has("ask-more-proof");
              const isAskMoreActive = isActive && currentQuestionKey === "ask-more-proof";
              const hasHistory = !!askMoreAnswer;
              const shouldShow = isCompleted || isAskMoreAnswered || isAskMoreActive || skippedQuestions.has("ask-more-proof") || hasHistory;
              if (!shouldShow) return null;
              
              return (
                <div className="space-y-4">
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content">
                      <div className="space-y-2">
                        {isCompleted ? (
                          <p className="text-base text-gray-900">Would you like to add more proof elements? (Optional — you can skip this)</p>
                        ) : isAskMoreActive ? (
                          <>
                            <ChunkedText
                              text="Would you like to add more proof elements? (Optional — you can skip this)"
                              chunkClassName="text-base text-gray-900"
                              staggerMs={30}
                            />
                            <p className="text-xs text-gray-500 mt-1 italic">Type yes to add more or no to continue.</p>
                          </>
                        ) : null}
                        {isAskMoreAnswered && (
                          <span className="inline-block rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 mt-2">
                            ✓ Saved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isAskMoreAnswered && (
                    <div className="margo-chat-bubble margo-chat-bubble--user">
                      <div className="margo-message-content">
                        <p className="text-sm text-gray-500 italic">
                          {(() => {
                            const answer = questionAnswers?.["ask-more-proof"] || "";
                            if (skippedQuestions.has("ask-more-proof") || answer === "no") {
                              return "No, continue";
                            }
                            return isAffirmativeResponse(answer) ? "Yes, add more" : "No, continue";
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Notes */}
      {notes !== undefined && (
        <div className="space-y-4">
          <div className="margo-chat-bubble margo-chat-bubble--bot">
            <div className="margo-message-content">
              <div className="space-y-2">
                {isCompleted ? (
                  <p className="text-base text-gray-900">Any additional notes? (Optional — you can skip this)</p>
                ) : currentQuestionKey === "notes" ? (
                  <>
                    <ChunkedText
                      text="Any additional notes? (Optional — you can skip this)"
                      chunkClassName="text-base text-gray-900"
                      staggerMs={30}
                    />
                    <p className="text-xs text-gray-500 mt-1 italic">You can skip this by typing 'skip' or leaving it blank.</p>
                  </>
                ) : null}
                {(() => {
                  const isAnswered = answeredQuestions.has("notes") || skippedQuestions.has("notes") || !!(notes && notes.trim());
                  return isAnswered ? (
                    <span className="inline-block rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 mt-2">
                      ✓ Saved
                    </span>
                  ) : null;
                })()}
            </div>

            </div>
          </div>
          {(() => {
            const isAnswered = answeredQuestions.has("notes") || skippedQuestions.has("notes") || !!(notes && notes.trim());
            if (!isAnswered) return null;
            const isSkipped = skippedQuestions.has("notes") || !notes?.trim();
            if (notes?.trim() && !isSkipped) {
              return (
                <div className="margo-chat-bubble margo-chat-bubble--user">
                  <div className="margo-message-content">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
                  </div>
                </div>
              );
            }
            return (
              <div className="margo-chat-bubble margo-chat-bubble--user">
                <div className="margo-message-content">
                  <p className="text-sm text-gray-500 italic">Skipped</p>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Show loading state when finalizing (final submission in progress) */}
      {isFinalizing && !isCompleted && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="flex items-start gap-3">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mt-0.5"></div>
              <div>
                <p className="font-medium text-gray-900">Saving your proof elements...</p>
                <p className="text-sm text-gray-600 mt-1">Please wait while we save your proof elements and move to the next step.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <p className="text-sm text-gray-600">✓ Step 8 completed - Proof elements saved</p>
          </div>
        </div>
      )}


      {!isCompleted && isActive && !isFinalizing && <div className="h-24" aria-hidden />}
    </>
  );
};

