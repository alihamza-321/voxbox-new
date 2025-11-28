import { useEffect, useState, useCallback, useRef } from "react";

import { useToast } from "@/hooks/use-toast";
import { submitStep9Pricing, type PricingPlan } from "@/lib/product-refiner-api";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { useProductRefinerStore, type StepPersistedState } from "@/stores/productRefinerStore";


export interface ProductRefinerStep9InputHandlers {
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

interface ProductRefinerStep9Props {
  workspaceId: string;
  session: ProductRefinerSession;
  isActive: boolean;
  isCompleted: boolean;
  onSessionChange: (session: ProductRefinerSession) => void;
  onError?: (message: string | null) => void;
  isUnlocked?: boolean;
  pricingNarrative?: any;

  onInputHandlersReady?: (handlers: ProductRefinerStep9InputHandlers | null) => void;
  persistedState?: StepPersistedState | null;
  onPersistedStateChange?: (state: StepPersistedState | null) => void;
}

type QuestionKey = 
  | "standard-price"
  | "standard-price-description"
  | "ask-payment-plans"
  | `payment-plan-${number}-name`
  | `payment-plan-${number}-price`
  | `payment-plan-${number}-description`
  | "ask-tiers"
  | `tier-${number}-name`
  | `tier-${number}-price`
  | `tier-${number}-feature-${number}`
  | "pricing-narrative";

export const ProductRefinerStep9 = ({
  workspaceId,
  session,
  isActive,
  isCompleted,
  onSessionChange,
  onError,
  isUnlocked = false,
  pricingNarrative,

  onInputHandlersReady,
  persistedState,
  onPersistedStateChange,
}: ProductRefinerStep9Props) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const store = useProductRefinerStore(workspaceId);
  const sessionHasStep9Data = !!session.step9Pricing;
  const canUsePersistedFormData = (sessionHasStep9Data || !!persistedState) && store?.getState().formData.step9;
  const persistedFormData = canUsePersistedFormData ? store?.getState().formData.step9 ?? null : null;

  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentInputValue, setCurrentInputValue] = useState(persistedState?.currentInputValue || "");
  const [currentQuestionKey, setCurrentQuestionKey] = useState<QuestionKey | null>(persistedState?.currentQuestionKey as QuestionKey | null || null);
  const initialPricingData = (sessionHasStep9Data && session.step9Pricing
    ? (session.step9Pricing as any)
    : (persistedFormData as any)) ?? null;
  
  const [standardPrice, setStandardPrice] = useState<string>(() => {
    if (initialPricingData?.standardPrice != null && initialPricingData.standardPrice !== "") {
      return String(initialPricingData.standardPrice);
    }
    return "";
  });
  const [standardPriceDescription, setStandardPriceDescription] = useState(() => {
    return initialPricingData?.standardPriceDescription || "";
  });
  const [paymentPlans, setPaymentPlans] = useState<PricingPlan[]>(() => {
    return initialPricingData?.paymentPlans ? [...initialPricingData.paymentPlans] : [];
  });
  const [tiers, setTiers] = useState<{ name: string; price: number; features: string[] }[]>(() => {
    return initialPricingData?.tiers ? [...initialPricingData.tiers] : [];
  });
  const [pricingNarrativeText, setPricingNarrativeText] = useState(() => {
    return initialPricingData?.pricingNarrative || "";
  });

  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(
    persistedState?.answeredQuestions ? new Set(persistedState.answeredQuestions) : new Set()
  );
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
          if (key === "standard-price" || key === "standard-price-description" || 
              key === "ask-payment-plans" || key === "ask-tiers" || key === "pricing-narrative" ||
              key.startsWith("payment-plan-") && key.endsWith("-description")) {
            skipped.add(key);
          }
        }
      });
    }
    return skipped;
  });
  const [isFinalizing, setIsFinalizing] = useState<boolean>(() => persistedState?.isFinalizing ?? false);
  const sessionRef = useRef<ProductRefinerSession>(session);
  const isManuallyNavigatingRef = useRef(false); // Prevent useEffect from interfering with manual navigation
  const submittingQuestionKeyRef = useRef<string | null>(null); // Track which question is being submitted
  const hasResumedFinalSubmitRef = useRef(false);
  const pendingAddPaymentPlanRef = useRef(false);
  const pendingAddTierRef = useRef(false);
  
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
      store.getState().setStep9FormData({
        standardPrice,
        standardPriceDescription,
        paymentPlans,
        tiers,
        pricingNarrative: pricingNarrativeText,
      });
    }, 100);
    
    return () => {
      if (zustandUpdateTimeoutRef.current) {
        clearTimeout(zustandUpdateTimeoutRef.current);
      }
    };
  }, [store, standardPrice, standardPriceDescription, paymentPlans, tiers, pricingNarrativeText]);

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
    const persistedFormDataString = persistedFormData ? JSON.stringify(persistedFormData) : "";
    const persistedStateKey = persistedState ? JSON.stringify({
      currentQuestionKey: persistedState.currentQuestionKey,
      answeredQuestionsLength: persistedState.answeredQuestions?.length,
    }) : "";
    
    const sessionKey = `${session?.id || ''}-${sessionHasStep9Data}-${persistedFormDataString}-${persistedStateKey}`;
    
    // Only run if session state actually changed
    if (sessionSyncRef.current === sessionKey && hasInitializedRef.current) {
      return;
    }
    
    sessionSyncRef.current = sessionKey;
    hasInitializedRef.current = true;
    
    const buildAnsweredFromPricing = (pricing: any) => {
      const answered = new Set<string>();
      if (pricing.standardPrice) answered.add("standard-price");
      if (pricing.standardPriceDescription) answered.add("standard-price-description");
      if (pricing.paymentPlans?.length > 0) answered.add("ask-payment-plans");
      if (pricing.tiers?.length > 0) answered.add("ask-tiers");
      if (pricing.pricingNarrative) answered.add("pricing-narrative");
      
      pricing.paymentPlans?.forEach((plan: any, idx: number) => {
        if (plan.name) answered.add(`payment-plan-${idx}-name`);
        if (plan.price > 0) answered.add(`payment-plan-${idx}-price`);
        if (plan.description) answered.add(`payment-plan-${idx}-description`);
      });
      
      pricing.tiers?.forEach((tier: any, idx: number) => {
        if (tier.name) answered.add(`tier-${idx}-name`);
        if (tier.price > 0) answered.add(`tier-${idx}-price`);
      });
      
      if (persistedState?.answeredQuestions) {
        persistedState.answeredQuestions.forEach(q => answered.add(q));
      }
      return answered;
    };
    
    if (sessionHasStep9Data && session.step9Pricing) {
      const pricing = session.step9Pricing as any;
      const nextStandardPrice = pricing.standardPrice ? String(pricing.standardPrice) : "";
      const nextStandardPriceDescription = pricing.standardPriceDescription || "";
      const nextPaymentPlans = pricing.paymentPlans ? [...pricing.paymentPlans] : [];
      const nextTiers = pricing.tiers ? [...pricing.tiers] : [];
      const nextPricingNarrativeText = pricing.pricingNarrative || "";
      
      // Only update if different to prevent infinite loops
      const currentPricingString = JSON.stringify({
        standardPrice,
        standardPriceDescription,
        paymentPlans,
        tiers,
        pricingNarrativeText,
      });
      const nextPricingString = JSON.stringify({
        standardPrice: nextStandardPrice,
        standardPriceDescription: nextStandardPriceDescription,
        paymentPlans: nextPaymentPlans,
        tiers: nextTiers,
        pricingNarrativeText: nextPricingNarrativeText,
      });
      
      if (currentPricingString !== nextPricingString) {
        setStandardPrice(nextStandardPrice);
        setStandardPriceDescription(nextStandardPriceDescription);
        setPaymentPlans(nextPaymentPlans);
        setTiers(nextTiers);
        setPricingNarrativeText(nextPricingNarrativeText);
        setAnsweredQuestions(buildAnsweredFromPricing(pricing));
        
        if (store) {
          store.getState().setStep9FormData({
            standardPrice: nextStandardPrice,
            standardPriceDescription: nextStandardPriceDescription,
            paymentPlans: nextPaymentPlans,
            tiers: nextTiers,
            pricingNarrative: nextPricingNarrativeText,
          });
        }
      }
      return;
    }
    
    if (persistedState && persistedFormData) {
      const pricing = persistedFormData as any;
      const nextStandardPrice = pricing.standardPrice ? String(pricing.standardPrice) : "";
      const nextStandardPriceDescription = pricing.standardPriceDescription || "";
      const nextPaymentPlans = pricing.paymentPlans ? [...pricing.paymentPlans] : [];
      const nextTiers = pricing.tiers ? [...pricing.tiers] : [];
      const nextPricingNarrativeText = pricing.pricingNarrative || "";
      
      // Only update if different to prevent infinite loops
      const currentPricingString = JSON.stringify({
        standardPrice,
        standardPriceDescription,
        paymentPlans,
        tiers,
        pricingNarrativeText,
      });
      const nextPricingString = JSON.stringify({
        standardPrice: nextStandardPrice,
        standardPriceDescription: nextStandardPriceDescription,
        paymentPlans: nextPaymentPlans,
        tiers: nextTiers,
        pricingNarrativeText: nextPricingNarrativeText,
      });
      
      if (currentPricingString !== nextPricingString) {
        setStandardPrice(nextStandardPrice);
        setStandardPriceDescription(nextStandardPriceDescription);
        setPaymentPlans(nextPaymentPlans);
        setTiers(nextTiers);
        setPricingNarrativeText(nextPricingNarrativeText);
        setAnsweredQuestions(buildAnsweredFromPricing(pricing));
      }
      return;
    }
    
    if (!persistedState && !hasInitializedRef.current) {
      // Fresh session after reset - ensure state is empty (only on first mount)
      const currentPricingString = JSON.stringify({
        standardPrice,
        standardPriceDescription,
        paymentPlans,
        tiers,
        pricingNarrativeText,
      });
      const defaultPricingString = JSON.stringify({
        standardPrice: "",
        standardPriceDescription: "",
        paymentPlans: [],
        tiers: [],
        pricingNarrativeText: "",
      });
      
      if (currentPricingString !== defaultPricingString) {
        setStandardPrice("");
        setStandardPriceDescription("");
        setPaymentPlans([]);
        setTiers([]);
        setPricingNarrativeText("");
        setAnsweredQuestions(new Set());
        setCurrentQuestionKey(null);
        setCurrentInputValue("");
      }
    }
  }, [session?.id, sessionHasStep9Data]); // Removed unstable dependencies

  useEffect(() => {
    if (typeof persistedState?.isFinalizing === "boolean" && !session.step9Completed) {
      setIsFinalizing(persistedState.isFinalizing);
    }
  }, [persistedState?.isFinalizing, session.step9Completed]);

  const determineNextQuestion = useCallback(() => {
    if (isFinalizing) {
      return;
    }
    // Standard price
    if (!answeredQuestions.has("standard-price")) {
      setCurrentQuestionKey("standard-price");
      setCurrentInputValue(standardPrice || "");
      return;
    }

    // Standard price description (only if price was provided)
    if (standardPrice && !answeredQuestions.has("standard-price-description")) {
      setCurrentQuestionKey("standard-price-description");
      setCurrentInputValue(standardPriceDescription || "");
      return;
    }

    // Payment plans
    if (!answeredQuestions.has("ask-payment-plans")) {
      console.log('[ProductRefinerStep9] Setting currentQuestionKey to ask-payment-plans');
      setCurrentQuestionKey("ask-payment-plans");
      setCurrentInputValue("");
      return;
    }

    // Process payment plans if any
    if (paymentPlans.length > 0) {
      for (let i = 0; i < paymentPlans.length; i++) {
        const plan = paymentPlans[i];
        if (!answeredQuestions.has(`payment-plan-${i}-name`)) {
          setCurrentQuestionKey(`payment-plan-${i}-name`);
          setCurrentInputValue(plan.name || "");
          return;
        }
        if (!answeredQuestions.has(`payment-plan-${i}-price`)) {
          setCurrentQuestionKey(`payment-plan-${i}-price`);
          setCurrentInputValue(plan.price ? String(plan.price) : "");
          return;
        }
        if (!answeredQuestions.has(`payment-plan-${i}-description`)) {
          setCurrentQuestionKey(`payment-plan-${i}-description`);
          setCurrentInputValue(plan.description || "");
          return;
        }
      }
    }

    // Tiers
    if (!answeredQuestions.has("ask-tiers")) {
      setCurrentQuestionKey("ask-tiers");
      setCurrentInputValue("");
      return;
    }

    // Process tiers if any
    if (tiers.length > 0) {
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        if (!answeredQuestions.has(`tier-${i}-name`)) {
          setCurrentQuestionKey(`tier-${i}-name`);
          setCurrentInputValue(tier.name || "");
          return;
        }
        if (!answeredQuestions.has(`tier-${i}-price`)) {
          setCurrentQuestionKey(`tier-${i}-price`);
          setCurrentInputValue(tier.price ? String(tier.price) : "");
          return;
        }
        // For simplicity, skip individual tier features and just handle name/price
      }
    }

    // Pricing narrative
    if (!answeredQuestions.has("pricing-narrative")) {
      setCurrentQuestionKey("pricing-narrative");
      setCurrentInputValue(pricingNarrativeText || "");
      return;
    }

    // All done - ready to submit
    if (!isFinalizing) {
      setIsFinalizing(true);
    }
    setCurrentQuestionKey(null);
    setCurrentInputValue("");
    if (handleFinalSubmitRef.current) {
      handleFinalSubmitRef.current();
    }
  }, [answeredQuestions, standardPrice, standardPriceDescription, paymentPlans, tiers, pricingNarrativeText, isFinalizing]);
  
  // Initialize current question when step becomes active
  const determineNextQuestionRef = useRef(determineNextQuestion);
  useEffect(() => {
    determineNextQuestionRef.current = determineNextQuestion;
  }, [determineNextQuestion]);
  
  useEffect(() => {
    if (!isActive || isCompleted) return;
    if (isManuallyNavigatingRef.current) return;
    if (isFinalizing) return;
    if (currentQuestionKey === null) {
      determineNextQuestionRef.current();
    }
  }, [isActive, isCompleted, currentQuestionKey, isFinalizing]);

  const handleQuestionSubmit = useCallback(async (questionKey: QuestionKey, value: string) => {
    // Prevent double submission
    if (isSubmitting || submittingQuestionKeyRef.current === questionKey || isFinalizing) {
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

    // Handle standard price (optional)
    if (questionKey === "standard-price") {
      setIsSubmitting(true);
      setValidationError(null);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      isManuallyNavigatingRef.current = true; // Mark that we're manually navigating
      
      // Allow blank or skip command for optional price
      const isSkipped = isSkipCommand(trimmedValue) || !trimmedValue;
      if (isSkipped) {
        setStandardPrice("");
        setAnsweredQuestions(prev => new Set([...prev, "standard-price"]));
        setSkippedQuestions(prev => new Set([...prev, "standard-price"]));
        setQuestionAnswers(prev => ({ ...prev, "standard-price": "" }));
        setTimeout(() => {
          isManuallyNavigatingRef.current = false;
          setIsSubmitting(false);
          submittingQuestionKeyRef.current = null; // Clear submission tracking
          determineNextQuestionRef.current();
        }, 100);
        return;
      }

      const price = parseFloat(trimmedValue);
      if (isNaN(price) || price < 0) {
        setValidationError("Please enter a valid positive number");
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking on error
        isManuallyNavigatingRef.current = false;
        return;
      }

      setStandardPrice(trimmedValue);
      setAnsweredQuestions(prev => new Set([...prev, "standard-price"]));
      setSkippedQuestions(prev => {
        const next = new Set(prev);
        next.delete("standard-price");
        return next;
      });
      setQuestionAnswers(prev => ({ ...prev, "standard-price": trimmedValue }));
      setTimeout(() => {
        isManuallyNavigatingRef.current = false;
        determineNextQuestion();
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking
      }, 100);
      return;
    }

    // Handle standard price description (optional)
    if (questionKey === "standard-price-description") {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      setIsSubmitting(true);
      setValidationError(null);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      // Allow blank or skip command for optional description
      const isSkipped = isSkipCommand(trimmedValue) || !trimmedValue;
      setStandardPriceDescription(isSkipped ? "" : trimmedValue);
      setAnsweredQuestions(prev => new Set([...prev, "standard-price-description"]));
      
      // Track skipped state
      if (isSkipped) {
        setSkippedQuestions(prev => new Set([...prev, "standard-price-description"]));
        setQuestionAnswers(prev => ({ ...prev, "standard-price-description": "" }));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete("standard-price-description");
          return next;
        });
        setQuestionAnswers(prev => ({ ...prev, "standard-price-description": trimmedValue }));
      }
      
      // Show "Saving..." for a moment before moving to next question
      setTimeout(() => {
        determineNextQuestion();
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking
      }, 200);
      return;
    }

    // Handle ask payment plans
    if (questionKey === "ask-payment-plans") {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      setIsSubmitting(true);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      // Allow blank submission for optional questions
      if (!trimmedValue) {
        // Treat blank as skip for optional questions
        setValidationError(null);
        setAnsweredQuestions(prev => new Set([...prev, "ask-payment-plans"]));
        
        // Track question answer
        setQuestionAnswers(prev => ({ ...prev, "ask-payment-plans": "no" }));
        
        // Skip payment plans - move to next question
        setTimeout(() => {
          isManuallyNavigatingRef.current = false;
          determineNextQuestionRef.current();
          setIsSubmitting(false);
          submittingQuestionKeyRef.current = null; // Clear submission tracking
        }, 200);
        return;
      }
      
      const wantsToSkip = isSkipCommand(trimmedValue);
      const wantsToAdd = isAffirmativeResponse(trimmedValue);
      
      if (!wantsToSkip && !wantsToAdd) {
        setValidationError("Please respond with yes to add payment plans or no/skip to continue.");
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking on error
        isManuallyNavigatingRef.current = false;
        return;
      }
      
      setValidationError(null);
      setAnsweredQuestions(prev => new Set([...prev, "ask-payment-plans"]));
      
      // Track question answer
      const answerText = wantsToSkip ? "no" : "yes";
      setQuestionAnswers(prev => ({ ...prev, "ask-payment-plans": answerText }));
      pendingAddPaymentPlanRef.current = wantsToAdd;
      
      // Track skipped state
      if (wantsToSkip) {
        setSkippedQuestions(prev => new Set([...prev, "ask-payment-plans"]));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete("ask-payment-plans");
          return next;
        });
      }
      
      if (wantsToSkip) {
        // Skip payment plans - move to next question
        setTimeout(() => {
          isManuallyNavigatingRef.current = false;
          determineNextQuestionRef.current();
          setIsSubmitting(false);
          submittingQuestionKeyRef.current = null; // Clear submission tracking
        }, 200);
        return;
      }

      // User wants to add payment plan
      setPaymentPlans([{ name: "", price: 0, description: "" }]);
      setCurrentQuestionKey("payment-plan-0-name");
      setCurrentInputValue("");
      setTimeout(() => {
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking
      }, 200);
      return;
    }

    // Handle payment plan name
    if (questionKey.startsWith("payment-plan-") && questionKey.endsWith("-name")) {
      isManuallyNavigatingRef.current = true;
      setIsSubmitting(true);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      const index = parseInt(questionKey.split("-")[2]);
      const updated = [...paymentPlans];
      updated[index] = { ...updated[index], name: trimmedValue };
      setPaymentPlans(updated);
      setAnsweredQuestions(prev => new Set([...prev, questionKey]));
      
      setTimeout(() => {
        setCurrentQuestionKey(`payment-plan-${index}-price`);
        setCurrentInputValue(updated[index].price ? String(updated[index].price) : "");
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking
      }, 150);
      return;
    }

    // Handle payment plan price
    if (questionKey.startsWith("payment-plan-") && questionKey.endsWith("-price")) {
      isManuallyNavigatingRef.current = true;
      setIsSubmitting(true);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      const index = parseInt(questionKey.split("-")[2]);
      const price = parseFloat(trimmedValue);
      if (isNaN(price) || price < 0) {
        setValidationError("Please enter a valid positive number");
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking on error
        isManuallyNavigatingRef.current = false;
        return;
      }
      
      const updated = [...paymentPlans];
      updated[index] = { ...updated[index], price };
      setPaymentPlans(updated);
      setAnsweredQuestions(prev => new Set([...prev, questionKey]));
      
      setTimeout(() => {
        setCurrentQuestionKey(`payment-plan-${index}-description`);
        setCurrentInputValue(updated[index].description || "");
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking
      }, 150);
      return;
    }

    // Handle payment plan description (optional)
    if (questionKey.startsWith("payment-plan-") && questionKey.endsWith("-description")) {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      setIsSubmitting(true);
      setValidationError(null);
      const index = parseInt(questionKey.split("-")[2]);
      const updated = [...paymentPlans];
      // Allow blank or skip command for optional description
      const isSkipped = isSkipCommand(trimmedValue) || !trimmedValue;
      updated[index] = { ...updated[index], description: isSkipped ? "" : trimmedValue };
      
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
      setPaymentPlans(updated);
      setAnsweredQuestions(prev => new Set([...prev, questionKey]));
      
      // Ask if they want more payment plans or move on - show "Saving..." for a moment
      setTimeout(() => {
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking

        if (pendingAddPaymentPlanRef.current) {
          pendingAddPaymentPlanRef.current = false;
          setAnsweredQuestions((prev) => {
            const next = new Set(prev);
            next.delete("ask-payment-plans");
            return next;
          });
          setSkippedQuestions((prev) => {
            if (!prev.has("ask-payment-plans")) return prev;
            const next = new Set(prev);
            next.delete("ask-payment-plans");
            return next;
          });
          setCurrentQuestionKey("ask-payment-plans");
          setCurrentInputValue("");
        } else {
          determineNextQuestionRef.current();
        }
      }, 200);
      return;
    }

    // Handle ask tiers
    if (questionKey === "ask-tiers") {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      setIsSubmitting(true);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      // Allow blank submission for optional questions
      if (!trimmedValue) {
        // Treat blank as skip for optional questions
        setValidationError(null);
        setAnsweredQuestions(prev => new Set([...prev, "ask-tiers"]));
        
        // Track question answer
        setQuestionAnswers(prev => ({ ...prev, "ask-tiers": "no" }));
        
        // Skip tiers - move to next question
        setTimeout(() => {
          isManuallyNavigatingRef.current = false;
          determineNextQuestionRef.current();
          setIsSubmitting(false);
          submittingQuestionKeyRef.current = null; // Clear submission tracking
        }, 200);
        return;
      }
      
      const wantsToSkip = isSkipCommand(trimmedValue);
      const wantsToAdd = isAffirmativeResponse(trimmedValue);
      
      if (!wantsToSkip && !wantsToAdd) {
        setValidationError("Please respond with yes to add pricing tiers or no/skip to continue.");
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking on error
        isManuallyNavigatingRef.current = false;
        return;
      }
      
      setValidationError(null);
      setAnsweredQuestions(prev => new Set([...prev, "ask-tiers"]));
      
      // Track question answer
      const answerText = wantsToSkip ? "no" : "yes";
      setQuestionAnswers(prev => ({ ...prev, "ask-tiers": answerText }));
      pendingAddTierRef.current = wantsToAdd;
      
      // Track skipped state
      if (wantsToSkip) {
        setSkippedQuestions(prev => new Set([...prev, "ask-tiers"]));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete("ask-tiers");
          return next;
        });
      }
      
      if (wantsToSkip) {
        // Skip tiers - move to next question
        setTimeout(() => {
          isManuallyNavigatingRef.current = false;
          determineNextQuestionRef.current();
          setIsSubmitting(false);
          submittingQuestionKeyRef.current = null; // Clear submission tracking
        }, 200);
        return;
      }

      // User wants to add tier
      setTiers([{ name: "", price: 0, features: [""] }]);
      setCurrentQuestionKey("tier-0-name");
      setCurrentInputValue("");
      setTimeout(() => {
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking
      }, 200);
      return;
    }

    // Handle tier name
    if (questionKey.startsWith("tier-") && questionKey.endsWith("-name")) {
      isManuallyNavigatingRef.current = true;
      setIsSubmitting(true);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      const index = parseInt(questionKey.split("-")[1]);
      const updated = [...tiers];
      updated[index] = { ...updated[index], name: trimmedValue };
      setTiers(updated);
      setAnsweredQuestions(prev => new Set([...prev, questionKey]));
      
      setTimeout(() => {
        setCurrentQuestionKey(`tier-${index}-price`);
        setCurrentInputValue(updated[index].price ? String(updated[index].price) : "");
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking
      }, 150);
      return;
    }

    // Handle tier price
    if (questionKey.startsWith("tier-") && questionKey.endsWith("-price")) {
      isManuallyNavigatingRef.current = true;
      setIsSubmitting(true);
      submittingQuestionKeyRef.current = questionKey; // Track which question is being submitted
      
      const index = parseInt(questionKey.split("-")[1]);
      const price = parseFloat(trimmedValue);
      if (isNaN(price) || price < 0) {
        setValidationError("Please enter a valid positive number");
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking on error
        isManuallyNavigatingRef.current = false;
        return;
      }
      
      const updated = [...tiers];
      updated[index] = { ...updated[index], price };
      setTiers(updated);
      setAnsweredQuestions(prev => new Set([...prev, questionKey]));
      
      // Ask if they want more tiers or move on
      setTimeout(() => {
        isManuallyNavigatingRef.current = false;
        setIsSubmitting(false);
        submittingQuestionKeyRef.current = null; // Clear submission tracking

        if (pendingAddTierRef.current) {
          pendingAddTierRef.current = false;
          setAnsweredQuestions((prev) => {
            const next = new Set(prev);
            next.delete("ask-tiers");
            return next;
          });
          setSkippedQuestions((prev) => {
            if (!prev.has("ask-tiers")) return prev;
            const next = new Set(prev);
            next.delete("ask-tiers");
            return next;
          });
          setCurrentQuestionKey("ask-tiers");
          setCurrentInputValue("");
        } else {
          determineNextQuestionRef.current();
        }
      }, 150);
      return;
    }

    // Handle pricing narrative (optional, last question)
    if (questionKey === "pricing-narrative") {
      // Mark that we're manually navigating to prevent useEffect interference
      isManuallyNavigatingRef.current = true;
      
      setIsSubmitting(true);
      setValidationError(null);
      
      // Optional field - allow blank or skip command
      const isSkipped = isSkipCommand(trimmedValue) || !trimmedValue;
      const finalNarrative = isSkipped ? "" : trimmedValue;
      
      // Track skipped state
      if (isSkipped) {
        setSkippedQuestions(prev => new Set([...prev, "pricing-narrative"]));
        setQuestionAnswers(prev => ({ ...prev, "pricing-narrative": "" }));
      } else {
        setSkippedQuestions(prev => {
          const next = new Set(prev);
          next.delete("pricing-narrative");
          return next;
        });
        setQuestionAnswers(prev => ({ ...prev, "pricing-narrative": trimmedValue }));
      }
      
      // Batch state updates to prevent blinking
      setPricingNarrativeText(finalNarrative);
      setAnsweredQuestions(prev => new Set([...prev, "pricing-narrative"]));
      
      // Save to Zustand store immediately for persistence
      if (store) {
        store.getState().setStep9FormData({
          standardPrice,
          standardPriceDescription,
          paymentPlans,
          tiers,
          pricingNarrative: finalNarrative,
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
  }, [standardPrice, standardPriceDescription, paymentPlans, tiers, pricingNarrativeText, session, toast, isSkipCommand, answeredQuestions, isSubmitting, isFinalizing]);

  const handleFinalSubmitRef = useRef<() => void>();
  const handleFinalSubmit = useCallback(async () => {
    const currentSession = sessionRef.current || session;
    if (!currentSession?.id) return;

    setValidationError(null);
    setIsSubmitting(true);
    setIsFinalizing(true);
    onError?.(null);

    try {

      const response = await submitStep9Pricing(currentSession.id, {
        standardPrice: standardPrice ? parseFloat(standardPrice) : undefined,
        standardPriceDescription: standardPriceDescription.trim() || undefined,
        paymentPlans: paymentPlans.filter((p) => p.name.trim() && p.price > 0),
        tiers: tiers.filter((t) => t.name.trim() && t.price > 0),
        pricingNarrative: pricingNarrativeText.trim() || undefined,
      });
      
      const updatedSession: ProductRefinerSession = {

        ...currentSession,
        step9Pricing: {
          standardPrice: standardPrice ? parseFloat(standardPrice) : undefined,
          standardPriceDescription: standardPriceDescription.trim() || undefined,
          paymentPlans: paymentPlans.filter((p) => p.name.trim() && p.price > 0),
          tiers: tiers.filter((t) => t.name.trim() && t.price > 0),
          pricingNarrative: response.pricingNarrative?.narrative || pricingNarrativeText.trim() || undefined,
          justification: response.pricingNarrative?.justification,
          recommendations: response.pricingNarrative?.recommendations,
        },
        step9Completed: true,
        currentStep: 10,
      };
      onSessionChange(updatedSession);

      setCurrentQuestionKey(null);
      setCurrentInputValue("");
    } catch (error: any) {
      const message = error?.message || "Failed to submit pricing";
      onError?.(message);
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      submittingQuestionKeyRef.current = null; // Clear submission tracking
      isManuallyNavigatingRef.current = false; // Reset navigation flag
      setIsFinalizing(false);
      hasResumedFinalSubmitRef.current = false;
    }
  }, [session, onSessionChange, onError, toast, standardPrice, standardPriceDescription, paymentPlans, tiers, pricingNarrativeText]);
  
  useEffect(() => {
    handleFinalSubmitRef.current = handleFinalSubmit;
  }, [handleFinalSubmit]);

  useEffect(() => {
    if (
      isActive &&
      !isCompleted &&
      persistedState?.isFinalizing &&
      !session.step9Completed &&
      !hasResumedFinalSubmitRef.current
    ) {
      hasResumedFinalSubmitRef.current = true;
      setIsFinalizing(true);
      handleFinalSubmitRef.current?.();
    }
  }, [isActive, isCompleted, persistedState?.isFinalizing, session.step9Completed]);


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
        if (key === "standard-price") {
          return "What is your standard price? (Optional — you can skip this)";
        }
        if (key === "standard-price-description") {
          return "What's included at this price? (Optional — you can skip this)";
        }
        if (key === "ask-payment-plans") {
          return "Do you want to add any payment plans? (Optional — you can skip this)";
        }
        if (key.startsWith("payment-plan-") && key.endsWith("-name")) {
          const index = parseInt(key.split("-")[2]);
          return `What is the name of payment plan ${index + 1}?`;
        }
        if (key.startsWith("payment-plan-") && key.endsWith("-price")) {
          const index = parseInt(key.split("-")[2]);
          return `What is the price of payment plan ${index + 1}?`;
        }
        if (key.startsWith("payment-plan-") && key.endsWith("-description")) {
          const index = parseInt(key.split("-")[2]);
          return `What is the description of payment plan ${index + 1}? (Optional — you can skip this)`;
        }
        if (key === "ask-tiers") {
          return "Do you want to add any pricing tiers? (Optional — you can skip this)";
        }
        if (key.startsWith("tier-") && key.endsWith("-name")) {
          const index = parseInt(key.split("-")[1]);
          return `What is the name of tier ${index + 1}?`;
        }
        if (key.startsWith("tier-") && key.endsWith("-price")) {
          const index = parseInt(key.split("-")[1]);
          return `What is the price of tier ${index + 1}?`;
        }
        if (key === "pricing-narrative") {
          return "Describe your pricing structure and justification? (Optional — you can skip this, AI will generate)";
        }
        return "";
      };

      const isOptionQuestion = currentQuestionKey === "ask-payment-plans" || currentQuestionKey === "ask-tiers";
      
      const wrappedSubmit = () => {
        if (currentQuestionKey) {
          handleQuestionSubmitRef.current(currentQuestionKey, currentInputValue);
        }
      };
      
      const handleInputChange = (value: string) => {
        setCurrentInputValue(value);
        // Clear validation error when user starts typing (for all question types)
        if (validationError) {
          if (isOptionQuestion) {
            // For option questions, clear error when user types valid response or empty
            if (isAffirmativeResponse(value) || isSkipCommand(value) || value.trim().length === 0) {
              setValidationError(null);
            }
          } else {
            // For other questions, clear error when user types anything
            setValidationError(null);
          }
        }
      };
      
      const questionLabel = getQuestionLabel(currentQuestionKey);
      
      // Use generic placeholder, not the full question
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
        validationHint: isOptionQuestion ? "Type yes to add or no to skip." : null,
      });
    } else {
      onInputHandlersReadyRef.current(null);
    }
  }, [isActive, isCompleted, currentQuestionKey, currentInputValue, isSubmitting, validationError, isSkipCommand, isAffirmativeResponse, isFinalizing]);

  // Persist UI state whenever it changes (for refresh persistence)
  const prevPersistedStateRef = useRef<{
    currentQuestionKey: string | null;
    currentInputValue: string;
    answeredQuestions: string[];
    questionAnswers?: Record<string, string>;
    isFinalizing: boolean;
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
      Object.keys(questionAnswers ?? {}).length > 0 ||
      isFinalizing;
    
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
      questionAnswers,
      isFinalizing,
    };

    const prevState = prevPersistedStateRef.current;
    const stateChanged = !prevState || 
        prevState.currentQuestionKey !== state.currentQuestionKey ||
        prevState.currentInputValue !== state.currentInputValue ||
        prevState.answeredQuestions.length !== state.answeredQuestions.length ||
        prevState.answeredQuestions.some((q, i) => q !== state.answeredQuestions[i]) ||
        JSON.stringify(prevState.questionAnswers) !== JSON.stringify(state.questionAnswers) ||
        prevState.isFinalizing !== state.isFinalizing ||
        prevState.isCompleted !== isCompleted ||
        prevState.isActive !== isActive;
    
    if (stateChanged) {
      prevPersistedStateRef.current = {
        currentQuestionKey: state.currentQuestionKey,
        currentInputValue: state.currentInputValue,
        answeredQuestions: [...state.answeredQuestions],
        questionAnswers: state.questionAnswers ? { ...state.questionAnswers } : undefined,
        isFinalizing,
        isCompleted,
        isActive,
      };
      callback(state);
    }
  }, [currentQuestionKey, currentInputValue, answeredQuestions, isCompleted, isActive, questionAnswers, isFinalizing]);

  // Restore from persistedState on mount/refresh
  const prevPricingDataRef = useRef<string>("");
  useEffect(() => {
    // Skip if we're manually navigating (prevents blinking during navigation)
    if (isManuallyNavigatingRef.current) {
      return;
    }
    
    // Only run on mount or when persistedState changes, not on every pricing data change
    if (persistedState) {
      // Check if pricing data actually changed
      const currentPricingDataString = JSON.stringify({
        standardPrice,
        standardPriceDescription,
        paymentPlans,
        tiers,
        pricingNarrativeText,
      });
      
      // Only update if data actually changed (prevents unnecessary re-renders)
      if (currentPricingDataString === prevPricingDataRef.current) {
        return;
      }
      
      prevPricingDataRef.current = currentPricingDataString;
      
      // Restore questionAnswers and skipped questions if available
      if (persistedState.questionAnswers && Object.keys(persistedState.questionAnswers).length > 0) {
        setQuestionAnswers(persistedState.questionAnswers);
        
        // Restore skipped questions from questionAnswers
        const skipped = new Set<string>();
        Object.entries(persistedState.questionAnswers).forEach(([key, value]) => {
          if (!value || value.trim() === "" || value.toLowerCase() === "no") {
            if (key === "standard-price" || key === "standard-price-description" || 
                key === "ask-payment-plans" || key === "ask-tiers" || key === "pricing-narrative" ||
                key.startsWith("payment-plan-") && key.endsWith("-description")) {
              skipped.add(key);
            }
          }
        });
        setSkippedQuestions(skipped);
      }
      
      // First, ensure answeredQuestions includes all questions with answers from pricing data
      const answeredFromData = new Set<string>();
      if (standardPrice) answeredFromData.add("standard-price");
      if (standardPriceDescription) answeredFromData.add("standard-price-description");
      if (paymentPlans.length > 0) answeredFromData.add("ask-payment-plans");
      if (tiers.length > 0) answeredFromData.add("ask-tiers");
      if (pricingNarrativeText) answeredFromData.add("pricing-narrative");
      
      paymentPlans.forEach((plan, idx) => {
        if (plan.name) answeredFromData.add(`payment-plan-${idx}-name`);
        if (plan.price > 0) answeredFromData.add(`payment-plan-${idx}-price`);
        if (plan.description) answeredFromData.add(`payment-plan-${idx}-description`);
      });
      
      tiers.forEach((tier, idx) => {
        if (tier.name) answeredFromData.add(`tier-${idx}-name`);
        if (tier.price > 0) answeredFromData.add(`tier-${idx}-price`);
      });
      
      // Merge with persistedState answeredQuestions
      if (persistedState.answeredQuestions) {
        persistedState.answeredQuestions.forEach(q => answeredFromData.add(q));
      }
      if (persistedState.questionAnswers) {
        Object.keys(persistedState.questionAnswers).forEach((key) => answeredFromData.add(key));
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
  }, [persistedState, isActive, isCompleted]); // Removed pricing data from deps to prevent blinking

  if (!isUnlocked && !isActive && !isCompleted) {
    return null;
  }

  return (
    <>
      {(isActive || isCompleted) && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            {isCompleted ? (
              <p>Perfect! Your pricing structure is saved. Generating your final product specification...</p>
            ) : (
            <ChunkedText
                text={`Now let's structure your pricing. All fields are optional — you can skip any section by typing 'skip' or leaving it blank.`}
              staggerMs={30}
            />
            )}
          </div>
        </div>
      )}


      {/* Show all questions and answers in chat format (like Step 6) */}
      
      {/* Standard price question */}
      {(() => {
        const questionKey: QuestionKey = "standard-price";
        const hasValue = !!standardPrice;
        // A question is answered if it has a value OR is in answeredQuestions Set
        const isAnswered = hasValue || answeredQuestions.has(questionKey);
        const isActiveQuestion = isActive && questionKey === currentQuestionKey;
        
        // Show if answered, completed, currently active, or explicitly skipped
        if (!isCompleted && !isAnswered && !isActiveQuestion && !skippedQuestions.has(questionKey)) return null;
        
        return (
          <div key={questionKey} className="space-y-4">
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <div className="space-y-2">
                  {isCompleted ? (
                    <p className="text-base text-gray-900">What is your standard price? (Optional — you can skip this)</p>
                  ) : (
                    <>
                      <ChunkedText
                        text="What is your standard price? (Optional — you can skip this)"
                        chunkClassName="text-base text-gray-900"
                        staggerMs={30}
                      />
                      <p className="text-xs text-gray-500 mt-1 italic">You can skip this by typing 'skip' or leaving it blank.</p>
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
            {isAnswered && (
              <>
                {standardPrice && !skippedQuestions.has("standard-price") ? (
                  <div className="margo-chat-bubble margo-chat-bubble--user">
                    <div className="margo-message-content">
                      <p className="text-sm text-gray-700">${standardPrice}</p>
                    </div>
                  </div>
                ) : skippedQuestions.has("standard-price") ? (
                  <div className="margo-chat-bubble margo-chat-bubble--user">
                    <div className="margo-message-content">
                      <p className="text-sm text-gray-500 italic">Skipped</p>
                    </div>
                  </div>
                ) : null}
                {/* Loading indicator when submitting */}
                {isSubmitting && !isCompleted && questionKey === currentQuestionKey && (
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
      })()}

      {/* Standard price description question */}
      {standardPrice && (() => {
        const questionKey: QuestionKey = "standard-price-description";
        const hasValue = !!standardPriceDescription;
        // A question is answered if it has a value OR is in answeredQuestions Set
        const isAnswered = hasValue || answeredQuestions.has(questionKey);
        const isActiveQuestion = isActive && questionKey === currentQuestionKey;
        
        if (!isCompleted && !isAnswered && !isActiveQuestion && !skippedQuestions.has(questionKey)) return null;
        
        return (
          <div key={questionKey} className="space-y-4">
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <div className="space-y-2">
                  {isCompleted ? (
                    <p className="text-base text-gray-900">What's included at this price? (Optional — you can skip this)</p>
                  ) : (
                    <>
                      <ChunkedText
                        text="What's included at this price? (Optional — you can skip this)"
                        chunkClassName="text-base text-gray-900"
                        staggerMs={30}
                      />
                      <p className="text-xs text-gray-500 mt-1 italic">You can skip this by typing 'skip' or leaving it blank.</p>
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
            {isAnswered && (
              <>
                {standardPriceDescription && !skippedQuestions.has("standard-price-description") ? (
                  <div className="margo-chat-bubble margo-chat-bubble--user">
                    <div className="margo-message-content">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{standardPriceDescription}</p>
                    </div>
                  </div>
                ) : skippedQuestions.has("standard-price-description") ? (
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

      {/* Ask payment plans question */}
      {(() => {
        const questionKey: QuestionKey = "ask-payment-plans";
        const hasValue = paymentPlans.length > 0;
        const askPlansAnswer = questionAnswers?.["ask-payment-plans"];
        const isAnswered = answeredQuestions.has(questionKey);
        const isActiveQuestion = isActive && questionKey === currentQuestionKey;
        const hasHistory = hasValue || !!askPlansAnswer;
        
        const shouldShow = isCompleted || isAnswered || isActiveQuestion || skippedQuestions.has(questionKey) || hasHistory;
        if (!shouldShow) return null;
        
        return (
          <div key={questionKey} className="space-y-4">
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <div className="space-y-2">
                  {isCompleted ? (
                    <p className="text-base text-gray-900">Do you want to add any payment plans? (Optional — you can skip this)</p>
                  ) : (
                    <>
                      <ChunkedText
                        text="Do you want to add any payment plans? (Optional — you can skip this)"
                        chunkClassName="text-base text-gray-900"
                        staggerMs={30}
                      />
                      <p className="text-xs text-gray-500 mt-1 italic">You can skip this by typing 'skip' or leaving it blank.</p>
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
            {isAnswered && (paymentPlans.length === 0 || skippedQuestions.has("ask-payment-plans")) && (
              <div className="margo-chat-bubble margo-chat-bubble--user">
                <div className="margo-message-content">
                  <p className="text-sm text-gray-500 italic">
                    {questionAnswers["ask-payment-plans"] === "no" ? "No" : "Skipped"}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Payment plan questions */}
      {paymentPlans.map((plan, index) => {
        const planNumber = index + 1;
        
        return (
          <div key={`payment-plan-${index}`} className="space-y-4">
            {index === 0 && paymentPlans.length > 0 && (
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content">
                  <p className="text-sm font-bold text-gray-700">Payment Plans</p>
                </div>
              </div>
            )}
            
            {/* Payment plan name */}
            {(() => {
              const questionKey: QuestionKey = `payment-plan-${index}-name`;
              const hasValue = !!plan.name;
              // A question is answered if it has a value OR is in answeredQuestions Set
              const isAnswered = hasValue || answeredQuestions.has(questionKey);
              const isActiveQuestion = isActive && questionKey === currentQuestionKey;
              
              if (!isCompleted && !isAnswered && !isActiveQuestion) return null;
              
              return (
                <div key={questionKey} className="space-y-4">
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content">
                      <div className="space-y-2">
                        {isCompleted ? (
                          <p className="text-base text-gray-900">What is the name of payment plan {planNumber}?</p>
                        ) : (
                          <ChunkedText
                            text={`What is the name of payment plan ${planNumber}?`}
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
                  {isAnswered && plan.name && (
                    <div className="margo-chat-bubble margo-chat-bubble--user">
                      <div className="margo-message-content">
                        <p className="text-sm text-gray-700">{plan.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* Payment plan price */}
            {(() => {
              const questionKey: QuestionKey = `payment-plan-${index}-price`;
              const hasValue = plan.price > 0;
              // A question is answered if it has a value OR is in answeredQuestions Set
              const isAnswered = hasValue || answeredQuestions.has(questionKey);
              const isActiveQuestion = isActive && questionKey === currentQuestionKey;
              
              if (!isCompleted && !isAnswered && !isActiveQuestion) return null;
              
              return (
                <div key={questionKey} className="space-y-4">
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content">
                      <div className="space-y-2">
                        {isCompleted ? (
                          <p className="text-base text-gray-900">What is the price of payment plan {planNumber}?</p>
                        ) : (
                          <ChunkedText
                            text={`What is the price of payment plan ${planNumber}?`}
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
                  {isAnswered && plan.price > 0 && (
                    <div className="margo-chat-bubble margo-chat-bubble--user">
                      <div className="margo-message-content">
                        <p className="text-sm text-gray-700">${plan.price}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* Payment plan description */}
            {(() => {
              const questionKey: QuestionKey = `payment-plan-${index}-description`;
              const hasValue = !!plan.description;
              // A question is answered if it has a value OR is in answeredQuestions Set
              const isAnswered = hasValue || answeredQuestions.has(questionKey);
              const isActiveQuestion = isActive && questionKey === currentQuestionKey;
              
              if (!isCompleted && !isAnswered && !isActiveQuestion) return null;
              
              return (
                <div key={questionKey} className="space-y-4">
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content">
                      <div className="space-y-2">
                        {isCompleted ? (
                          <p className="text-base text-gray-900">What is the description of payment plan {planNumber}? (Optional — you can skip this)</p>
                        ) : (
                          <>
                            <ChunkedText
                              text={`What is the description of payment plan ${planNumber}? (Optional — you can skip this)`}
                              chunkClassName="text-base text-gray-900"
                              staggerMs={30}
                            />
                            <p className="text-xs text-gray-500 mt-1 italic">You can skip this by typing 'skip' or leaving it blank.</p>
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
                  {isAnswered && (
                    <>
                      {plan.description && !skippedQuestions.has(questionKey) ? (
                        <div className="margo-chat-bubble margo-chat-bubble--user">
                          <div className="margo-message-content">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.description}</p>
                          </div>
                        </div>
                      ) : skippedQuestions.has(questionKey) ? (
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

      {/* Ask tiers question */}
      {(() => {
        const questionKey: QuestionKey = "ask-tiers";
        const hasValue = tiers.length > 0;
        const askTiersAnswer = questionAnswers?.["ask-tiers"];
        const isAnswered = answeredQuestions.has(questionKey);
        const isActiveQuestion = isActive && questionKey === currentQuestionKey;
        const hasHistory = hasValue || !!askTiersAnswer;
        
        const shouldShow = isCompleted || isAnswered || isActiveQuestion || skippedQuestions.has(questionKey) || hasHistory;
        if (!shouldShow) return null;
        
        return (
          <div key={questionKey} className="space-y-4">
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <div className="space-y-2">
                  {isCompleted ? (
                    <p className="text-base text-gray-900">Do you want to add any pricing tiers? (Optional — you can skip this)</p>
                  ) : (
                    <>
                      <ChunkedText
                        text="Do you want to add any pricing tiers? (Optional — you can skip this)"
                        chunkClassName="text-base text-gray-900"
                        staggerMs={30}
                      />
                      <p className="text-xs text-gray-500 mt-1 italic">You can skip this by typing 'skip' or leaving it blank.</p>
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
            {isAnswered && (tiers.length === 0 || skippedQuestions.has("ask-tiers")) && (
              <div className="margo-chat-bubble margo-chat-bubble--user">
                <div className="margo-message-content">
                  <p className="text-sm text-gray-500 italic">
                    {questionAnswers["ask-tiers"] === "no" ? "No" : "Skipped"}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tier questions */}
      {tiers.map((tier, index) => {
        const tierNumber = index + 1;
        
        return (
          <div key={`tier-${index}`} className="space-y-4">
            {index === 0 && tiers.length > 0 && (
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content">
                  <p className="text-sm font-bold text-gray-700">Pricing Tiers</p>
                </div>
              </div>
            )}
            
            {/* Tier name */}
            {(() => {
              const questionKey: QuestionKey = `tier-${index}-name`;
              const hasValue = !!tier.name;
              // A question is answered if it has a value OR is in answeredQuestions Set
              const isAnswered = hasValue || answeredQuestions.has(questionKey);
              const isActiveQuestion = isActive && questionKey === currentQuestionKey;
              
              if (!isCompleted && !isAnswered && !isActiveQuestion) return null;
              
              return (
                <div key={questionKey} className="space-y-4">
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content">
                      <div className="space-y-2">
                        {isCompleted ? (
                          <p className="text-base text-gray-900">What is the name of tier {tierNumber}?</p>
                        ) : (
                          <ChunkedText
                            text={`What is the name of tier ${tierNumber}?`}
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
                  {isAnswered && tier.name && (
                    <div className="margo-chat-bubble margo-chat-bubble--user">
                      <div className="margo-message-content">
                        <p className="text-sm text-gray-700">{tier.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* Tier price */}
            {(() => {
              const questionKey: QuestionKey = `tier-${index}-price`;
              const hasValue = tier.price > 0;
              // A question is answered if it has a value OR is in answeredQuestions Set
              const isAnswered = hasValue || answeredQuestions.has(questionKey);
              const isActiveQuestion = isActive && questionKey === currentQuestionKey;
              
              if (!isCompleted && !isAnswered && !isActiveQuestion) return null;
              
              return (
                <div key={questionKey} className="space-y-4">
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content">
                      <div className="space-y-2">
                        {isCompleted ? (
                          <p className="text-base text-gray-900">What is the price of tier {tierNumber}?</p>
                        ) : (
                          <ChunkedText
                            text={`What is the price of tier ${tierNumber}?`}
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
                  {isAnswered && tier.price > 0 && (
                    <div className="margo-chat-bubble margo-chat-bubble--user">
                      <div className="margo-message-content">
                        <p className="text-sm text-gray-700">${tier.price}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* Pricing narrative question */}
      {(() => {
        const questionKey: QuestionKey = "pricing-narrative";
        const hasValue = !!pricingNarrativeText;
        // A question is answered if it has a value OR is in answeredQuestions Set
        const isAnswered = hasValue || answeredQuestions.has(questionKey);
        const isActiveQuestion = isActive && questionKey === currentQuestionKey;
        
        if (!isCompleted && !isAnswered && !isActiveQuestion && !skippedQuestions.has(questionKey)) return null;
        
        return (
          <div key={questionKey} className="space-y-4">
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <div className="space-y-2">
                  {isCompleted ? (
                    <p className="text-base text-gray-900">Describe your pricing structure and justification? (Optional — you can skip this, AI will generate)</p>
                  ) : (
                    <>
                      <ChunkedText
                        text="Describe your pricing structure and justification? (Optional — you can skip this, AI will generate)"
                        chunkClassName="text-base text-gray-900"
                        staggerMs={30}
                      />
                      <p className="text-xs text-gray-500 mt-1 italic">You can skip this by typing 'skip' or leaving it blank.</p>
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
            {isAnswered && (
              <>
                {pricingNarrativeText && pricingNarrativeText.trim() && !skippedQuestions.has("pricing-narrative") ? (
                  <div className="margo-chat-bubble margo-chat-bubble--user">
                    <div className="margo-message-content">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{pricingNarrativeText}</p>
                    </div>
                  </div>
                ) : skippedQuestions.has("pricing-narrative") ? (
                  <div className="margo-chat-bubble margo-chat-bubble--user">
                    <div className="margo-message-content">
                      <p className="text-sm text-gray-500 italic">Skipped</p>
                    </div>
                  </div>
                ) : null}
                {/* Loading indicator when submitting */}
                {isSubmitting && !isCompleted && questionKey === currentQuestionKey && (
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
      })()}

      {/* Show all pricing data in chat format when completed */}
      {isCompleted && (
        <>
          {standardPrice && (
            <>
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">

                  <p className="text-base text-gray-900">What is your standard price? (Optional)</p>
              </div>
                      </div>

              <div className="margo-chat-bubble margo-chat-bubble--user">
                <div className="margo-message-content">
                  <p className="text-sm text-gray-700">${standardPrice}{standardPriceDescription && ` - ${standardPriceDescription}`}</p>
                    </div>
                </div>

            </>
          )}
          
          {paymentPlans.length > 0 && (
            <>
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content">
                  <p className="text-sm font-bold text-gray-700">Payment Plans</p>
                      </div>
                            </div>

              {paymentPlans.map((plan, index) => (
                <div key={index} className="margo-chat-bubble margo-chat-bubble--user">
                  <div className="margo-message-content">
                    <p className="text-sm text-gray-700">{plan.name}: ${plan.price}{plan.description && ` - ${plan.description}`}</p>
                      </div>
                    </div>
                  ))}

            </>
          )}

          {tiers.length > 0 && (
            <>
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content">
                  <p className="text-sm font-bold text-gray-700">Pricing Tiers</p>
                </div>
                </div>

              {tiers.map((tier, index) => (
                <div key={index} className="margo-chat-bubble margo-chat-bubble--user">
                  <div className="margo-message-content">
                    <p className="text-sm text-gray-700">{tier.name}: ${tier.price}</p>
                    {tier.features?.length > 0 && tier.features.some(f => f.trim()) && (
                      <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
                        {tier.features.filter(f => f.trim()).map((f, idx) => <li key={idx}>{f}</li>)}
                      </ul>
                    )}
              </div>
              </div>

              ))}
            </>
          )}

          {pricingNarrativeText && (
            <>
              <div className="margo-chat-bubble margo-chat-bubble--bot">
                <div className="margo-message-content">
                  <p className="text-base text-gray-900">Describe your pricing structure and justification? (Optional)</p>
            </div>

              </div>
              <div className="margo-chat-bubble margo-chat-bubble--user">
                <div className="margo-message-content">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{pricingNarrativeText}</p>
          </div>
        </div>
            </>
      )}

      {pricingNarrative && pricingNarrative.narrative && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content bg-blue-50 border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">AI-Generated Pricing Narrative</h4>
            <p className="text-sm text-blue-800 mb-2">{pricingNarrative.narrative}</p>
            {pricingNarrative.justification && (
              <p className="text-sm text-blue-700 mb-2"><strong>Justification:</strong> {pricingNarrative.justification}</p>
            )}
            {pricingNarrative.recommendations && Array.isArray(pricingNarrative.recommendations) && (
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
                {pricingNarrative.recommendations.map((rec: string, idx: number) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <p className="text-sm text-gray-600">✓ Step 9 completed - Pricing structure saved</p>
          </div>
        </div>
        </>
      )}

      {isFinalizing && !isCompleted && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <p className="text-sm text-gray-600">Saving your pricing details...</p>
          </div>
        </div>
      )}


      {!isCompleted && isActive && <div className="h-24" aria-hidden />}
    </>
  );
};

