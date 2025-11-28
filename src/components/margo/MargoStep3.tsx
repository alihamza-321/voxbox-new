import { useEffect, useMemo, useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchMargoStep3Question, submitMargoStep3Answer } from "@/lib/margo-api";
import type { MargoBrief, MargoStep3Question, MargoStep3AnswerResult } from "@/lib/margo-api";
import { MargoTypingIndicator } from "@/components/margo/MargoTypingIndicator";
import { ChunkedText } from "@/components/margo/ChunkedText";

const TOTAL_QUESTIONS = 9;

interface Step3QuestionState {
  questionNumber: number;
  prompt: string;
  exampleAnswer: string;
  deeperExample?: string | null;
  answer: string;
  isLoading: boolean;
  isSubmitting: boolean;
  hasSubmitted: boolean;
  error: string | null;
  expanded: boolean;
  feedbackMessage: string | null;
}

const normalizeExampleText = (input?: string | null) => {
  if (!input) return "";
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
};

const removeSearchIcon = (text: string) => {
  // Remove search icon (🔍) and "Question X of Y" pattern from the beginning of the text
  let cleaned = text.replace(/^🔍\s*/, "").trim();
  // Remove "Question X of Y" pattern (case insensitive, with optional emoji)
  cleaned = cleaned.replace(/^(🔍\s*)?Question\s+\d+\s+of\s+\d+\s*/i, "").trim();
  return cleaned;
};

const getStep3PersistenceKey = (briefId?: string | null) => (briefId ? `margo-step3-${briefId}` : null);

type Step3PersistedQuestion = {
  questionNumber: number;
  answer: string;
  hasSubmitted: boolean;
  feedbackMessage: string | null;
  expanded: boolean;
  prompt?: string;
};

type Step3PersistedState = {
  activeQuestionNumber: number;
  questions: Step3PersistedQuestion[];
};

export interface MargoStep3InputHandlers {
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputSubmit: () => void;
  isSubmitting: boolean;
  placeholder: string;
}

interface MargoStep3Props {
  session: MargoBrief;
  isActive: boolean;
  isCompleted?: boolean;
  onSessionChange: (session: MargoBrief) => void;
  onComplete?: (session: MargoBrief) => void;
  onError?: (message: string | null) => void;
  onInputHandlersReady?: (handlers: MargoStep3InputHandlers | null) => void;
}

export const MargoStep3 = ({ session, isActive, isCompleted = false, onSessionChange, onComplete, onError, onInputHandlersReady }: MargoStep3Props) => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Step3QuestionState[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [activeQuestionNumber, setActiveQuestionNumber] = useState(1);
  const [completeNotified, setCompleteNotified] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Progressive reveal states for smooth transitions
  const [shownQuestions, setShownQuestions] = useState<Set<number>>(new Set());
  const shownQuestionsRef = useRef<Set<number>>(new Set());
  const [questionAnimationComplete, setQuestionAnimationComplete] = useState<Set<number>>(new Set());
  const [shownAnswers, setShownAnswers] = useState<Set<number>>(new Set());
  const questionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const questionsLoadedRef = useRef(false);
  const isActiveRef = useRef(isActive);
  const isCompletedRef = useRef(isCompleted);
  
  // Keep refs in sync with state
  useEffect(() => {
    shownQuestionsRef.current = shownQuestions;
  }, [shownQuestions]);
  
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);
  
  useEffect(() => {
    isCompletedRef.current = isCompleted;
  }, [isCompleted]);

  const briefId = session.id;
  const persistenceKey = useMemo(() => getStep3PersistenceKey(briefId), [briefId]);

  useEffect(() => {
    // Only clear persistence if step is not active AND not completed (truly abandoned)
    // Always load questions if step is active OR completed (to show history)
    if (!briefId) {
      return;
    }
    
    if (!isActive && !isCompleted) {
      if (persistenceKey) {
        try {
          localStorage.removeItem(persistenceKey);
        } catch (error) {
          console.warn("Failed to clear Step 3 persistence", error);
        }
      }
      questionsLoadedRef.current = false;
      return;
    }

    // Prevent reloading if questions are already loaded and we're just transitioning to completed
    // This prevents rerender when step completes
    if (questionsLoadedRef.current && questions.length > 0 && isCompleted) {
      return;
    }

    let isCancelled = false;

    let persistedState: Step3PersistedState | null = null;
    const persistedMap = (() => {
      if (!persistenceKey) return null;
      try {
        const stored = localStorage.getItem(persistenceKey);
        if (!stored) return null;
        const parsed = JSON.parse(stored) as Step3PersistedState | null;
        if (!parsed || !Array.isArray(parsed.questions)) return null;
        persistedState = parsed;
        return new Map<number, Step3PersistedQuestion>(
          parsed.questions.map((entry) => [entry.questionNumber, entry])
        );
      } catch (error) {
        console.warn("Failed to restore Step 3 state", error);
        return null;
      }
    })();

    const loadQuestions = async () => {
      setIsLoadingQuestions(true);
      setQuestionsError(null);
      setQuestions([]);
      setActiveQuestionNumber(1);

      try {
        const results: Step3QuestionState[] = [];
        let firstIncomplete: number | null = null;
        for (let i = 1; i <= TOTAL_QUESTIONS; i += 1) {
          try {
            const response = await fetchMargoStep3Question(briefId, i);
            const data = (response?.data ?? null) as MargoStep3Question | null;
            const questionText = data?.question?.questionText || data?.questionText || data?.prompt || `Question ${i}`;
            const example = data?.exampleAnswer || (data as any)?.example || "";
            const existingAnswer = (data as any)?.answer || (data as any)?.userAnswer || "";
            const alreadySubmitted = Boolean(existingAnswer && existingAnswer.trim().length > 0);
            const persisted = persistedMap?.get(i);
            // Prioritize persisted answer if it exists and is not empty, otherwise use backend answer
            const mergedAnswer = (persisted?.answer && persisted.answer.trim().length > 0) 
              ? persisted.answer 
              : (existingAnswer || persisted?.answer || "");
            // If persisted has hasSubmitted, use it; otherwise check if we have an answer (persisted or backend)
            const mergedSubmitted = persisted?.hasSubmitted !== undefined 
              ? persisted.hasSubmitted 
              : (alreadySubmitted || Boolean(mergedAnswer && mergedAnswer.trim().length > 0));
            const mergedFeedback = persisted?.feedbackMessage ?? null;
            const mergedExpanded = persisted?.expanded ?? false;
            // Consider both backend and persisted data when determining first incomplete
            if (!mergedSubmitted && firstIncomplete === null) {
              firstIncomplete = i;
            }

            console.log("data....",response);
            results.push({
              questionNumber: i,
              prompt: questionText,
              exampleAnswer: example,
              deeperExample: data?.deeperExample || null,
              answer: mergedAnswer,
              isLoading: false,
              isSubmitting: false,
              hasSubmitted: mergedSubmitted,
              error: null,
              expanded: mergedExpanded,
              feedbackMessage: mergedFeedback,
            });
            onError?.(null);
          } catch (error: any) {
            // If step is completed, don't show errors for step validation - just use persisted data
            const errorMessage = error?.message || "";
            const isStepValidationError = errorMessage.includes("Expected step") || errorMessage.includes("current step");
            
            if (!isCompleted && !isStepValidationError) {
              console.error(`Failed to load Step 3 question ${i}`, error);
              onError?.(errorMessage || "Unable to load Step 3 question");
            }
            
            const persisted = persistedMap?.get(i);
            console.log("persisted....",persisted);
            
            // Check if question is incomplete based on persisted data
            const hasPersistedAnswer = Boolean(persisted?.answer && persisted.answer.trim().length > 0);
            const isPersistedSubmitted = Boolean(persisted?.hasSubmitted);
            const isQuestionIncomplete = !isPersistedSubmitted && !hasPersistedAnswer;
            
            if (isQuestionIncomplete && firstIncomplete === null) {
              firstIncomplete = i;
            }
            
            results.push({
              questionNumber: i,
              prompt: persisted?.prompt || `Question ${i}`,
              exampleAnswer: "",
              deeperExample: null,
              answer: persisted?.answer ?? "",
              isLoading: false,
              isSubmitting: false,
              hasSubmitted: isPersistedSubmitted,
              error: isCompleted || isStepValidationError ? null : (errorMessage || "Unable to load question"),
              expanded: Boolean(persisted?.expanded),
              feedbackMessage: persisted?.feedbackMessage ?? null,
            });
          }
        }

        if (!isCancelled) {
          const nextActive =
            persistedState?.activeQuestionNumber && persistedState.activeQuestionNumber > 0
              ? persistedState.activeQuestionNumber
              : firstIncomplete ?? TOTAL_QUESTIONS;
          setQuestions(results);
          setActiveQuestionNumber(nextActive);
          questionsLoadedRef.current = true;
          
          // Show questions immediately if not completed
          if (!isCompleted && results.length > 0) {
            const questionsToShow = new Set<number>();
            const questionsComplete = new Set<number>();
            const answersToShow = new Set<number>();
            
            results.forEach((question) => {
              const qNum = question.questionNumber;
              const isPersisted = question.hasSubmitted || (question.answer && question.answer.trim().length > 0);
              
              // Show active or answered questions
              if (qNum === nextActive || question.hasSubmitted) {
                questionsToShow.add(qNum);
                
                // If persisted (already shown before), mark as complete immediately
                if (isPersisted) {
                  questionsComplete.add(qNum);
                  // Show answer if submitted
                  if (question.hasSubmitted) {
                    answersToShow.add(qNum);
                  }
                }
              }
            });
            
            setShownQuestions(questionsToShow);
            setQuestionAnimationComplete(questionsComplete);
            setShownAnswers(answersToShow);
          } else if (isCompleted && results.length > 0) {
            // When completed, show all questions immediately
            const allQuestionNumbers = results.map((q) => q.questionNumber);
            setShownQuestions(new Set(allQuestionNumbers));
            setQuestionAnimationComplete(new Set(allQuestionNumbers));
            // Show all answers that have been submitted
            const submittedAnswers = results.filter((q) => q.hasSubmitted).map((q) => q.questionNumber);
            setShownAnswers(new Set(submittedAnswers));
          }
        }
      } catch (error: any) {
        if (!isCancelled) {
          const message = error?.message || "Unable to load Step 3 questions.";
          setQuestionsError(message);
          toast({
            title: "Unable to load Step 3 questions",
            description: message,
            variant: "destructive",
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingQuestions(false);
        }
      }
    };

    loadQuestions();

    return () => {
      isCancelled = true;
    };
  }, [briefId, isActive, isCompleted, toast, persistenceKey]);

  // Persist state - save when active OR completed (to preserve answers for viewing)
  useEffect(() => {
    if (!persistenceKey) return;
    if (!isActive && !isCompleted) return;
    if (questions.length === 0) return;
    try {
      const payload: Step3PersistedState = {
        activeQuestionNumber,
        questions: questions.map((question) => ({
          questionNumber: question.questionNumber,
          answer: question.answer,
          hasSubmitted: question.hasSubmitted,
          feedbackMessage: question.feedbackMessage ?? null,
          expanded: question.expanded,
          prompt: question.prompt,
        })),
      };
      localStorage.setItem(persistenceKey, JSON.stringify(payload));
    } catch (error) {
      console.warn("Failed to persist Step 3 state", error);
    }
  }, [persistenceKey, isActive, isCompleted, questions, activeQuestionNumber]);

  const allSubmitted = useMemo(() => questions.length === TOTAL_QUESTIONS && questions.every((q) => q.hasSubmitted), [questions]);

  useEffect(() => {
    if (allSubmitted && !completeNotified && session && onComplete) {
      setCompleteNotified(true);
      onComplete(session);
    }
  }, [allSubmitted, completeNotified, onComplete, session]);

  useEffect(() => {
    if (!allSubmitted) {
      setCompleteNotified(false);
    }
  }, [allSubmitted]);

  const updateQuestionState = (questionNumber: number, updater: (current: Step3QuestionState) => Step3QuestionState) => {
    setQuestions((prev) =>
      prev.map((question) => (question.questionNumber === questionNumber ? updater(question) : question))
    );
  };

  // Sync input value with active question's answer
  useEffect(() => {
    if (!isActive || isCompleted) return;
    const activeQuestion = questions.find((q) => q.questionNumber === activeQuestionNumber);
    if (activeQuestion) {
      setInputValue(activeQuestion.answer);
    } else {
      setInputValue("");
    }
    // Only scroll if step 3 is active and not completed
    // Only scroll if question animation is complete (for persisted questions)
    // For new questions, wait for typing animation to complete
    if (isActive && !isCompleted && activeQuestionNumber && shownQuestions.has(activeQuestionNumber)) {
      const isQuestionPersisted = activeQuestion && (activeQuestion.hasSubmitted || (activeQuestion.answer && activeQuestion.answer.trim().length > 0));
      const isAnimationComplete = questionAnimationComplete.has(activeQuestionNumber);
      
      // Only scroll immediately if it's a persisted question (no animation)
      if (isQuestionPersisted && isAnimationComplete) {
        setTimeout(() => {
          const questionElement = questionRefs.current.get(activeQuestionNumber);
          // Check current state via refs to avoid stale closure values
          if (questionElement && isActiveRef.current && !isCompletedRef.current) {
            questionElement.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
          }
        }, 100);
      }
      // For new questions, scrolling will happen in ChunkedText onComplete callback
    }
  }, [activeQuestionNumber, questions, isActive, isCompleted, shownQuestions, questionAnimationComplete]);

  // Focus input when active question changes
  useEffect(() => {
    if (isActive && !isCompleted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeQuestionNumber, isActive, isCompleted]);

  // Progressive reveal: Show questions one at a time with smooth transitions
  useEffect(() => {
    if (isCompleted && questions.length > 0) {
      // When completed, show all questions immediately (only if not already shown)
      const allQuestionNumbers = questions.map((q) => q.questionNumber);
      const allShown = allQuestionNumbers.every((num) => shownQuestions.has(num));
      
      if (!allShown) {
        setShownQuestions(new Set(allQuestionNumbers));
        setQuestionAnimationComplete(new Set(allQuestionNumbers));
        // Show all answers that have been submitted
        const submittedAnswers = questions.filter((q) => q.hasSubmitted).map((q) => q.questionNumber);
        setShownAnswers(new Set(submittedAnswers));
      }
      return;
    }

    if (questions.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const questionsToComplete: number[] = [];
    const answersToShow: number[] = [];
    const currentShown = shownQuestionsRef.current;

    // Collect what needs to be updated
    const questionsToAdd: number[] = [];
    
    questions.forEach((question) => {
      const qNum = question.questionNumber;
      const isActiveOrAnswered = qNum === activeQuestionNumber || question.hasSubmitted;
      const isPersisted = question.hasSubmitted || (question.answer && question.answer.trim().length > 0);
      
      if (isActiveOrAnswered && !currentShown.has(qNum)) {
        questionsToAdd.push(qNum);
        
        // If persisted, mark for immediate completion
        if (isPersisted) {
          questionsToComplete.push(qNum);
          if (question.hasSubmitted) {
            answersToShow.push(qNum);
          }
        } else {
          // New questions show with animation
          const delay = qNum === activeQuestionNumber ? 0 : 200;
          const timer = setTimeout(() => {
            setShownQuestions((current) => {
              if (!current.has(qNum)) {
                return new Set([...current, qNum]);
              }
              return current;
            });
            // Don't scroll here - wait for animation to complete
          }, delay);
          timers.push(timer);
        }
      }
    });

    // Update shownQuestions for persisted questions immediately
    if (questionsToAdd.length > 0) {
      const persistedToAdd = questionsToAdd.filter((qNum) => {
        const question = questions.find((q) => q.questionNumber === qNum);
        return question && (question.hasSubmitted || (question.answer && question.answer.trim().length > 0));
      });
      
      if (persistedToAdd.length > 0) {
        setShownQuestions((prev) => {
          const updated = new Set(prev);
          persistedToAdd.forEach((qNum) => updated.add(qNum));
          return updated;
        });
        // Don't scroll here - let the activeQuestionNumber effect handle it for persisted questions
      }
    }

    // Batch update related states
    if (questionsToComplete.length > 0) {
      setQuestionAnimationComplete((prev) => {
        const updated = new Set(prev);
        questionsToComplete.forEach((qNum) => updated.add(qNum));
        return updated;
      });
    }
    
    if (answersToShow.length > 0) {
      setShownAnswers((prev) => {
        const updated = new Set(prev);
        answersToShow.forEach((qNum) => updated.add(qNum));
        return updated;
      });
    }

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [questions, activeQuestionNumber, isCompleted]);

  // Show answers after question animation completes
  useEffect(() => {
    // Only handle scroll when step 3 is active and not completed
    if (isCompleted || !isActive) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    questions.forEach((question) => {
      const qNum = question.questionNumber;
      if (
        question.hasSubmitted &&
        questionAnimationComplete.has(qNum) &&
        !shownAnswers.has(qNum)
      ) {
        // Show answer after a short delay once question is complete
        const timer = setTimeout(() => {
          setShownAnswers((prev) => new Set([...prev, qNum]));
          // Scroll to ensure answer is visible above input - only if step is still active
          setTimeout(() => {
            const questionElement = questionRefs.current.get(qNum);
            // Check current state via refs to avoid stale closure values
            if (questionElement && isActiveRef.current && !isCompletedRef.current) {
              questionElement.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
            }
          }, 100);
        }, 200);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [questions, questionAnimationComplete, shownAnswers, isCompleted, isActive]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    // Update the active question's answer in real-time
    if (activeQuestionNumber) {
      updateQuestionState(activeQuestionNumber, (current) => ({ ...current, answer: value }));
    }
  };

  const handleSubmitAnswer = async (questionNumber?: number) => {
    const targetQuestionNumber = questionNumber ?? activeQuestionNumber;
    
    // Don't allow submission if Step 3 is completed
    if (isCompleted) {
      toast({
        title: "Step 3 completed",
        description: "This step is already completed. You cannot modify answers.",
        variant: "default",
      });
      return;
    }

    const question = questions.find((q) => q.questionNumber === targetQuestionNumber);
    if (!question) return;

    const answerToSubmit = questionNumber ? question.answer : inputValue.trim();

    if (!answerToSubmit.trim()) {
      updateQuestionState(targetQuestionNumber, (current) => ({
        ...current,
        error: "Please provide an answer before submitting.",
      }));
      toast({
        title: "Answer required",
        description: "Please add your response to continue.",
        variant: "destructive",
      });
      return;
    }

    updateQuestionState(targetQuestionNumber, (current) => ({ ...current, isSubmitting: true, error: null }));

    try {
      const response = await submitMargoStep3Answer(briefId, {
        questionNumber: targetQuestionNumber,
        answer: answerToSubmit.trim(),
      });

      const result = (response?.data ?? null) as MargoStep3AnswerResult | null;

      const mergedSession: MargoBrief = {
        ...session,
        currentStep: result?.isStepComplete
          ? Math.max(session.currentStep ?? 4, 4)
          : Math.max(session.currentStep ?? 3, 3),
        nextAction: result?.isStepComplete
          ? "prepare_step4"
          : session.nextAction || "continue_product_interview",
      };
      onSessionChange(mergedSession);

      // Update question state with the submitted answer
      // Compute updated questions synchronously first
      const updatedQuestions = questions.map((q) =>
        q.questionNumber === targetQuestionNumber
          ? {
              ...q,
              isSubmitting: false,
              hasSubmitted: true,
              error: null,
              feedbackMessage: result?.feedbackMessage || q.feedbackMessage,
              answer: answerToSubmit.trim(), // Ensure answer is preserved
            }
          : q
      );

      // Determine next active question from updated state
      let nextActiveQuestion: number | null = null;
      if (result?.nextQuestion) {
        nextActiveQuestion = result.nextQuestion;
      } else {
        const nextIncomplete = updatedQuestions.find(
          (q) => !q.hasSubmitted && q.questionNumber > targetQuestionNumber
        )?.questionNumber;
        if (nextIncomplete) {
          nextActiveQuestion = nextIncomplete;
        } else if (targetQuestionNumber === TOTAL_QUESTIONS) {
          // If it's the last question, keep it as active so the answer is visible
          nextActiveQuestion = targetQuestionNumber;
        }
      }

      // Update state
      setQuestions(updatedQuestions);

      // Mark question animation as complete and show answer if question was already shown
      // Only scroll if step 3 is still active and not completed
      if (shownQuestions.has(targetQuestionNumber)) {
        setQuestionAnimationComplete((prev) => new Set([...prev, targetQuestionNumber]));
        // Show answer after a short delay
        setTimeout(() => {
          setShownAnswers((prev) => new Set([...prev, targetQuestionNumber]));
          // Scroll to ensure answer is visible above input - only if step is still active
          setTimeout(() => {
            const questionElement = questionRefs.current.get(targetQuestionNumber);
            // Check current state via refs to avoid stale closure values
            if (questionElement && isActiveRef.current && !isCompletedRef.current) {
              questionElement.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
            }
          }, 100);
        }, 300);
      } else {
        // If question wasn't shown yet, show it first
        setShownQuestions((prev) => new Set([...prev, targetQuestionNumber]));
        // Then mark as complete and show answer
        setTimeout(() => {
          setQuestionAnimationComplete((prev) => new Set([...prev, targetQuestionNumber]));
          setTimeout(() => {
            setShownAnswers((prev) => new Set([...prev, targetQuestionNumber]));
            // Scroll to ensure question and answer are visible above input - only if step is still active
            setTimeout(() => {
              const questionElement = questionRefs.current.get(targetQuestionNumber);
              // Check current state via refs to avoid stale closure values
              if (questionElement && isActiveRef.current && !isCompletedRef.current) {
                questionElement.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
              }
            }, 100);
          }, 200);
        }, 100);
      }

      // Immediately persist the updated state to localStorage
      if (persistenceKey) {
        try {
          const payload: Step3PersistedState = {
            activeQuestionNumber: nextActiveQuestion ?? activeQuestionNumber,
            questions: updatedQuestions.map((question) => ({
              questionNumber: question.questionNumber,
              answer: question.answer,
              hasSubmitted: question.hasSubmitted,
              feedbackMessage: question.feedbackMessage ?? null,
              expanded: question.expanded,
              prompt: question.prompt,
            })),
          };
          localStorage.setItem(persistenceKey, JSON.stringify(payload));
        } catch (error) {
          console.warn("Failed to immediately persist Step 3 state", error);
        }
      }

      // Update active question number
      if (nextActiveQuestion !== null) {
        setActiveQuestionNumber(nextActiveQuestion);
      }

      // Clear input after successful submission
      setInputValue("");

      onError?.(null);
      toast({
        title: `Question ${targetQuestionNumber} saved`,
        description: result?.feedbackMessage || "Your response has been captured.",
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to save your answer.";
      
      // Check if backend indicates we're already past step 3
      if (errorMessage.includes("current step is 4") || errorMessage.includes("Expected step 3")) {
        // Backend is already at step 4, update session state to match
        onSessionChange({
          ...session,
          currentStep: 4,
          nextAction: "prepare_step4",
        });
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
        
        updateQuestionState(targetQuestionNumber, (current) => ({
          ...current,
          isSubmitting: false,
          error: null,
        }));
        onError?.(null);
      } else {
        updateQuestionState(targetQuestionNumber, (current) => ({
          ...current,
          isSubmitting: false,
          error: errorMessage,
        }));
        onError?.(errorMessage);
        toast({
          title: "Submission failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };


  const extractQuotedExample = (exampleText: string) => {
    const match = exampleText.match(/"([\s\S]*?)"/);
    if (match && match[1]) {
      return match[1];
    }
    const withoutLabel = exampleText.replace(/^💡 Example Answer (for guidance):\s*/i, '');
    const normalizedWhitespace = withoutLabel.replace(/\s+/g, ' ').trim();
    return normalizedWhitespace.length > 0 ? normalizedWhitespace : withoutLabel.trim();
  };

  const handleUseExample = (questionNumber: number) => {
    const question = questions.find((q) => q.questionNumber === questionNumber);
    if (!question || !question.exampleAnswer) return;
    const example = extractQuotedExample(normalizeExampleText(question.exampleAnswer));
    const exampleText = example || question.exampleAnswer;
    updateQuestionState(questionNumber, (current) => ({
      ...current,
      answer: exampleText,
      error: null,
    }));
    // If this is the active question, update the input value too
    if (questionNumber === activeQuestionNumber) {
      setInputValue(exampleText);
    }
    toast({
      title: "Example copied",
      description: "Feel free to personalize it before saving.",
    });
  };

  const activeQuestion = questions.find((q) => q.questionNumber === activeQuestionNumber);
  const isSubmitting = activeQuestion?.isSubmitting ?? false;

  // Expose input handlers to parent component
  useEffect(() => {
    if (!onInputHandlersReady) return;
    
    if (isActive && !isCompleted && !isLoadingQuestions && !questionsError && questions.length > 0) {
      onInputHandlersReady({
        inputValue,
        onInputChange: handleInputChange,
        onInputSubmit: () => handleSubmitAnswer(),
        isSubmitting,
        placeholder: activeQuestion
          ? `Answer question ${activeQuestionNumber} of ${TOTAL_QUESTIONS}...`
          : "Type your answer...",
      });
    } else {
      onInputHandlersReady(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isCompleted, isLoadingQuestions, questionsError, questions.length, inputValue, isSubmitting, activeQuestionNumber, activeQuestion, onInputHandlersReady]);

  return (
    <div className="space-y-4">
      <div className="margo-chat-bubble margo-chat-bubble--bot">
        <div className="margo-message-content">
          <ChunkedText
            text="Let's capture the heart of your offer. Answer each prompt and I'll guide you with examples and deeper insights."
            chunkClassName="text-sm"
            isChunk={false}
          />
          {(isLoadingQuestions || questions.some((question) => question.isLoading)) && (
            <MargoTypingIndicator className="text-gray-400" />
          )}
        </div>
      </div>
      <div className="margo-chat-bubble margo-chat-bubble--user">
        <div className="margo-message-content">
          <ChunkedText text="Ready! I'll work through each question one at a time." chunkClassName="text-sm" isChunk={false} />
        </div>
      </div>

      {isLoadingQuestions && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="flex items-start gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
              <div>
                <ChunkedText text="Gathering your interview prompts and calibrating examples…" chunkClassName="text-sm" isChunk={false} />
                <MargoTypingIndicator className="text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {!isLoadingQuestions && questionsError && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content bg-red-50 border-red-200">
            <p className="text-sm text-red-600">{questionsError}</p>
          </div>
        </div>
      )}

      {!isLoadingQuestions && !questionsError && (
        <div className="space-y-6">
          {questions.map((question) => {
            const isActiveQuestion = question.questionNumber === activeQuestionNumber;
            const isAnswered = question.hasSubmitted;
            // Always show all questions when completed (ChatGPT-style), otherwise only show active or answered
            const isHidden = isCompleted ? false : (!isActiveQuestion && !isAnswered);

            if (isHidden) {
              return null;
            }

            const shouldShowQuestion = isCompleted || shownQuestions.has(question.questionNumber);
            // Check if question was already shown before (persisted) - if so, don't animate
            const isQuestionPersisted = question.hasSubmitted || (question.answer && question.answer.trim().length > 0);
            // Once a question animation is complete, never re-animate it, even if answer is cleared
            const hasAnimationCompleted = questionAnimationComplete.has(question.questionNumber);
            // Only animate if question hasn't been shown before AND animation hasn't completed
            const shouldAnimateQuestion = !isCompleted && !hasAnimationCompleted && shouldShowQuestion && !isQuestionPersisted;
            const isQuestionAnimating = shouldAnimateQuestion && !hasAnimationCompleted;
            const shouldShowAnswer = isCompleted || (question.hasSubmitted && shownAnswers.has(question.questionNumber));

            return (
              <div 
                key={question.questionNumber} 
                ref={(el) => {
                  if (el) {
                    questionRefs.current.set(question.questionNumber, el);
                  } else {
                    questionRefs.current.delete(question.questionNumber);
                  }
                }}
                className="space-y-4 scroll-mt-32"
              >
                {shouldShowQuestion && (
                  <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shouldShowQuestion ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="margo-message-content">
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-gray-700">
                          Question {question.questionNumber} of {TOTAL_QUESTIONS}
                        </p>

                          <ChunkedText
                            text={removeSearchIcon(question.prompt)}
                            chunkClassName="text-base text-gray-900"
                            animation="typewriter"
                            isChunk={isCompleted || hasAnimationCompleted || isQuestionPersisted ? false : true}
                            staggerMs={30}
                            minChunkLength={100}
                            onComplete={() => {
                              setQuestionAnimationComplete((prev) => new Set([...prev, question.questionNumber]));
                              // Scroll to question after typing animation completes - only for active question and if step is still active
                              if (isActiveQuestion && isActiveRef.current && !isCompletedRef.current) {
                                setTimeout(() => {
                                  const questionElement = questionRefs.current.get(question.questionNumber);
                                  // Check current state via refs to avoid stale closure values
                                  if (questionElement && isActiveRef.current && !isCompletedRef.current) {
                                    questionElement.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
                                  }
                                }, 200);
                              }
                            }}
                          />
                        {isQuestionAnimating && <MargoTypingIndicator className="text-gray-400 pb-20" />}
                        {question.hasSubmitted && (isQuestionPersisted || questionAnimationComplete.has(question.questionNumber)) && (
                          <span className="inline-block rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 mt-2 transition-opacity duration-300 opacity-100">
                            ✓ Saved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {shouldShowAnswer && (
                  <div className={`margo-chat-bubble margo-chat-bubble--user transition-opacity duration-300 ${shouldShowAnswer ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="margo-message-content">
                      <p className="text-sm whitespace-pre-wrap">{question.answer}</p>
                    </div>
                  </div>
                )}

                {!isCompleted && isActiveQuestion && question.exampleAnswer &&hasAnimationCompleted&& (
                  <div className="ml-12 pb-20">
                    <Accordion type="single" collapsible>
                      <AccordionItem value={`example-${question.questionNumber}`} className="border border-gray-200 rounded-lg bg-gray-50">
                        <AccordionTrigger className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 transition">
                          <Lightbulb className="h-4 w-4 flex-shrink-0 text-gray-600" />
                          <span className="flex-1 text-left">Example Inspiration</span>
                          {question.exampleAnswer && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleUseExample(question.questionNumber);
                              }}
                              className="rounded px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            >
                              Use this example
                            </button>
                          )}
                          {/* <ChevronDown className="ml-3 h-4 w-4 text-gray-500 transition-transform data-[state=open]:rotate-180" /> */}
                        </AccordionTrigger>
                        <AccordionContent className="border-t border-gray-200 bg-white px-4 py-4 text-sm text-gray-700">
                          <div className="flex flex-col gap-3">
                            <p className="whitespace-pre-line leading-relaxed">
                              {normalizeExampleText(question.exampleAnswer) || "No example provided for this prompt."}
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}

                {question.error && isActiveQuestion && (
                  <div className="ml-12 mb-4">
                    <p className="text-sm text-red-600">{question.error}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* {allSubmitted && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content bg-green-50 border-green-200">
            <p className="text-sm text-green-700 font-medium">All responses captured. Preparing the next step...</p>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default MargoStep3;


