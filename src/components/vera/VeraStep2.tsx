import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { submitVeraStep2 } from "@/lib/vera-api";
import type { VeraProfile } from "@/lib/vera-api";
import avaAvatar from "@/assets/ava-avatar.png";
import { ChunkedText } from "@/components/margo/ChunkedText";
import FormattedChunkedText from "@/components/margo/FormattedChunkedText";

export interface VeraStep2InputHandlers {
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

interface VeraStep2Props {
  workspaceId: string;
  profile: VeraProfile | null;
  isActive: boolean;
  isCompleted: boolean;
  onProfileChange: (profile: VeraProfile) => void;
  onError?: (message: string | null) => void;
  onInputHandlersReady?: (handlers: VeraStep2InputHandlers | null) => void;
}

export const VeraStep2 = ({
  profile,
  isActive,
  isCompleted,
  onProfileChange,
  onError,
  onInputHandlersReady,
}: VeraStep2Props) => {
  const QUESTION_MIN_LENGTHS: Record<string, number> = {
    brandStandsFor: 10,
    valuesToExpress: 10,
    targetEmotions: 10,
    desiredPerception: 10,
  };
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [currentInputValue, setCurrentInputValue] = useState("");
  const [currentQuestionKey, setCurrentQuestionKey] = useState<string | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState<Record<string, boolean>>({});
  const activeQuestionRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<VeraProfile | null>(profile);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const persistProfileDraft = useCallback((updates: Partial<VeraProfile>) => {
    if (!profileRef.current) return;
    const updatedProfile: VeraProfile = {
      ...profileRef.current,
      ...updates,
    };
    profileRef.current = updatedProfile;
    onProfileChange(updatedProfile);
  }, [onProfileChange]);

  const questions = useMemo(() => [
    {
      key: "brandStandsFor",
      label: "What does your brand stand for?",
      example: "Example: 'We stand for empowering small business owners to build sustainable, profitable businesses without sacrificing their personal lives. We believe that success should enhance life, not consume it.'",
    },
    {
      key: "valuesToExpress",
      label: "What values do you want your communication to express?",
      example: "Example: 'We want our communication to express authenticity, transparency, and genuine care. We value honesty over perfection, and we want our audience to feel understood and supported.'",
    },
    {
      key: "targetEmotions",
      label: "What emotions should the audience feel when interacting with your brand?",
      example: "Example: 'We want our audience to feel inspired, confident, and empowered. They should feel like they're part of a community that understands their challenges and believes in their potential.'",
    },
    {
      key: "desiredPerception",
      label: "How should your communication make the audience perceive you?",
      example: "Example: 'We want to be perceived as trusted advisors who are both knowledgeable and approachable. We're experts who remember what it's like to be a beginner, and we're here to guide, not to intimidate.'",
    },
  ], []);

  const TOTAL_QUESTIONS = questions.length;

  const [formData, setFormData] = useState({
    brandStandsFor: profile?.brandStandsFor || "",
    valuesToExpress: profile?.valuesToExpress || "",
    targetEmotions: profile?.targetEmotions || "",
    desiredPerception: profile?.desiredPerception || "",
  });

  // Auto-scroll to active question when it changes
  useEffect(() => {
    if (currentQuestionKey && activeQuestionRef.current) {
      setTimeout(() => {
        activeQuestionRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "start" 
        });
      }, 100);
    }
  }, [currentQuestionKey]);

  useEffect(() => {
    setFormData({
      brandStandsFor: profile?.brandStandsFor || "",
      valuesToExpress: profile?.valuesToExpress || "",
      targetEmotions: profile?.targetEmotions || "",
      desiredPerception: profile?.desiredPerception || "",
    });
  }, [profile]);

  // Initialize answered questions from formData
  useEffect(() => {
    const answered = new Set<string>();
    questions.forEach((q) => {
      const value = formData[q.key as keyof typeof formData];
      if (value && value.trim()) {
        answered.add(q.key);
      }
    });
    setAnsweredQuestions(answered);
  }, [formData, questions]);

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

  // Initialize current question when step becomes active
  useEffect(() => {
    if (isActive && !isCompleted) {
      const nextQuestion = getNextQuestion();
      if (nextQuestion) {
        const questionIndex = questions.findIndex(q => q.key === nextQuestion.key);
        if (questionIndex >= 0) {
          setCurrentQuestionKey(nextQuestion.key);
          setCurrentInputValue(formData[nextQuestion.key as keyof typeof formData] || "");
        }
      }
    }
  }, [isActive, isCompleted, getNextQuestion, questions, formData]);

  // Automatically reveal example for the active question
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
    const cleanExample = example.replace(/^Example:\s*/i, "").replace(/^['"]|['"]$/g, "").trim();
    
    // Set as current question and populate unified input
    setCurrentQuestionKey(questionKey);
    setCurrentInputValue(cleanExample);

    requestAnimationFrame(() => {
      document
        .getElementById("vera-unified-input")
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

  useEffect(() => {
    if (isActive && !isCompleted) {
      setTimeout(() => setShowIntro(true), 300);
    } else {
      setShowIntro(true);
      setIntroComplete(true);
    }
  }, [isActive, isCompleted]);

  const handleSingleFieldSubmit = useCallback(async (questionKey: string, value: string) => {
    if (!profileRef.current?.id) {
      toast({
        title: "Profile missing",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    const trimmedValue = value.trim();
    const minLength = QUESTION_MIN_LENGTHS[questionKey] ?? 3;
    
    // Validate required field - show error immediately in red
    if (!trimmedValue) {
      const currentQuestion = questions.find(q => q.key === questionKey);
      setValidationError(`${currentQuestion?.label || "This field"} is required`);
      return;
    }
    
    if (trimmedValue.length < minLength) {
      const currentQuestion = questions.find(q => q.key === questionKey);
      const label = currentQuestion?.label || "This field";
      const message = `${label} must be at least ${minLength} characters`;
      setValidationError(message);
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

      // Check if all fields are now filled
      const allFilled = updatedFormData.brandStandsFor.trim() && 
                       updatedFormData.valuesToExpress.trim() && 
                       updatedFormData.targetEmotions.trim() && 
                       updatedFormData.desiredPerception.trim();

      if (allFilled) {
        // Submit all data to backend
        await submitVeraStep2(profileRef.current.id, {
          brandStandsFor: updatedFormData.brandStandsFor.trim(),
          valuesToExpress: updatedFormData.valuesToExpress.trim(),
          targetEmotions: updatedFormData.targetEmotions.trim(),
          desiredPerception: updatedFormData.desiredPerception.trim(),
        });
        
        const updatedProfile: VeraProfile = {
          ...profileRef.current,
          brandStandsFor: updatedFormData.brandStandsFor.trim(),
          valuesToExpress: updatedFormData.valuesToExpress.trim(),
          targetEmotions: updatedFormData.targetEmotions.trim(),
          desiredPerception: updatedFormData.desiredPerception.trim(),
          currentStep: 3,
        };
        profileRef.current = updatedProfile;
        onProfileChange(updatedProfile);
        setCurrentQuestionKey(null);
        setCurrentInputValue("");
      } else {
        persistProfileDraft(updatedFormData);
        // Move to next question using updated form data
        const nextQuestion = getNextQuestion(updatedFormData);
        if (nextQuestion) {
          const questionIndex = questions.findIndex(q => q.key === nextQuestion.key);
          if (questionIndex >= 0) {
            // Mark current question as answered
            setAnsweredQuestions(prev => new Set([...prev, questionKey]));
            // Collapse example for current question
            setShowExamples(prev => ({ ...prev, [questionKey]: false }));
            // Move to next question
            setCurrentQuestionKey(nextQuestion.key);
            setCurrentInputValue("");
            // Auto-scroll to next question after a short delay
            setTimeout(() => {
              if (activeQuestionRef.current) {
                activeQuestionRef.current.scrollIntoView({ 
                  behavior: "smooth", 
                  block: "start" 
                });
              }
            }, 300);
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
  }, [formData, getNextQuestion, onError, onProfileChange, questions, toast]);

  // Expose input handlers to parent component
  useEffect(() => {
    if (!onInputHandlersReady) return;
    
    // Only provide handlers when Step 2 is active and not completed
    const shouldProvideHandlers = isActive && !isCompleted && currentQuestionKey !== null;
    
    if (shouldProvideHandlers) {
      const currentQuestion = questions.find(q => q.key === currentQuestionKey);
      const wrappedSubmit = () => {
        if (currentQuestionKey && currentInputValue.trim()) {
          handleSingleFieldSubmit(currentQuestionKey, currentInputValue);
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
      onInputHandlersReady({
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
    } else {
      onInputHandlersReady(null);
    }
  }, [onInputHandlersReady, isActive, isCompleted, currentQuestionKey, currentInputValue, isSubmitting, handleSingleFieldSubmit, questions, validationError, TOTAL_QUESTIONS]);

  if (!profile) return null;

  return (
    <>
      {isActive && !isCompleted && (
        <>
          {/* Step Intro */}
          {showIntro && (
            <div className="flex gap-4">
              <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1">
                {introComplete ? (
                  <FormattedChunkedText text={`Great, ${profile.userName || 'there'}!\n\nStep 2: Communication Identity Foundation\n\nBefore we dive into specific voice characteristics, let's establish the foundation of your brand's communication identity. This foundation will guide all the decisions we make in the steps ahead.\n\nI'll ask you four foundational questions. Take your time to think about each one, and provide detailed, thoughtful answers. I'll provide examples to help guide you.\n\nLet's begin:`} />
                ) : (
                  <ChunkedText
                    text={`Great, ${profile.userName || 'there'}!\n\nStep 2: Communication Identity Foundation\n\nBefore we dive into specific voice characteristics, let's establish the foundation of your brand's communication identity. This foundation will guide all the decisions we make in the steps ahead.\n\nI'll ask you four foundational questions. Take your time to think about each one, and provide detailed, thoughtful answers. I'll provide examples to help guide you.\n\nLet's begin:`}
                    onComplete={() => setIntroComplete(true)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Show answered questions */}
          {questions.map((question, index) => {
            const isAnswered = answeredQuestions.has(question.key);
            const isActive = question.key === currentQuestionKey;
            
            // Only show answered questions or the active question
            if (!isAnswered && !isActive) {
              return null;
            }

            const questionNumber = index + 1;
            const answer = formData[question.key as keyof typeof formData];

            return (
              <div
                key={question.key}
                className="space-y-3 mb-2"
                ref={isActive ? (el) => {
                  if (el) {
                    activeQuestionRef.current = el;
                  }
                } : undefined}
              >
                {/* Question */}
                <div className="flex gap-3">
                  <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1">
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold text-gray-700">
                        Question {questionNumber} of {TOTAL_QUESTIONS}
                      </p>
                      <ChunkedText
                        text={question.label}
                        chunkClassName="text-base text-gray-900"
                        staggerMs={30}
                      />
                      {isAnswered && (
                        <span className="inline-block rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 mt-2 transition-opacity duration-300 opacity-100">
                          ✓ Saved
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Example Inspiration - Only show when active and not answered */}
                {isActive && !isAnswered && (
                  <div className="flex gap-3">
                    <div className="w-10 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="rounded-2xl border border-gray-200 bg-white">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
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
                          <div className="px-4 py-3 space-y-2">
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
                  <div className="flex gap-3">
                    <div className="w-10 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="bg-vox-pink/5 border border-vox-pink/20 rounded-lg p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{answer}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="h-12" aria-hidden />
        </>
      )}

      {isCompleted && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <p className="text-gray-600 italic">✓ Step 2 completed - Communication Identity Foundation saved</p>
          </div>
        </div>
      )}
    </>
  );
};
