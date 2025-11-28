import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { submitVeraStep4 } from "@/lib/vera-api";
import type { VeraProfile } from "@/lib/vera-api";
import avaAvatar from "@/assets/ava-avatar.png";
import { ChunkedText } from "@/components/margo/ChunkedText";
import FormattedChunkedText from "@/components/margo/FormattedChunkedText";

export interface VeraStep4InputHandlers {
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

interface VeraStep4Props {
  workspaceId: string;
  profile: VeraProfile | null;
  isActive: boolean;
  isCompleted: boolean;
  onProfileChange: (profile: VeraProfile) => void;
  onError?: (message: string | null) => void;
  onInputHandlersReady?: (handlers: VeraStep4InputHandlers | null) => void;
}

export const VeraStep4 = ({
  profile,
  isActive,
  isCompleted,
  onProfileChange,
  onError,
  onInputHandlersReady,
}: VeraStep4Props) => {
  const QUESTION_MIN_LENGTHS: Record<string, number> = {
    sentenceStyle: 10,
    vocabularyPreferences: 10,
    pacingAndRhythm: 10,
    useOfMetaphors: 10,
    degreeOfDirectness: 10,
    formalityLevel: 10,
    useOfExamples: 10,
    useOfEncouragement: 10,
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
      key: "sentenceStyle",
      label: "Sentence Style",
      example: "Example: 'We use short, punchy sentences for impact. Our sentences are clear and direct, avoiding unnecessary complexity. We prefer active voice over passive voice.'",
    },
    {
      key: "vocabularyPreferences",
      label: "Vocabulary Preferences",
      example: "Example: 'Our vocabulary is plain and accessible—no jargon. We use everyday language that our audience understands. When technical terms are necessary, we explain them clearly.'",
    },
    {
      key: "pacingAndRhythm",
      label: "Pacing and Rhythm",
      example: "Example: 'Our communication has a moderate, balanced pace. We vary sentence length to create rhythm. We use pauses (commas, periods) strategically to guide the reader's attention.'",
    },
    {
      key: "useOfMetaphors",
      label: "Use of Metaphors or Storytelling",
      example: "Example: 'We tell stories to illustrate points and make concepts relatable. We use metaphors sparingly but effectively. We prefer real-world examples over abstract comparisons.'",
    },
    {
      key: "degreeOfDirectness",
      label: "Degree of Directness",
      example: "Example: 'We're direct but warm. We get to the point quickly while maintaining a supportive tone. We don't beat around the bush, but we're never harsh or dismissive.'",
    },
    {
      key: "formalityLevel",
      label: "Formality Level",
      example: "Example: 'We maintain a moderately formal tone—professional but approachable. We avoid overly casual language, but we're not stiff or corporate-sounding. We strike a balance between friendly and authoritative.'",
    },
    {
      key: "useOfExamples",
      label: "Use of Examples, Analogies, or Visuals",
      example: "Example: 'We use examples liberally to clarify concepts. We prefer concrete examples over abstract explanations. We use analogies when they help simplify complex ideas. We reference visuals when appropriate.'",
    },
    {
      key: "useOfEncouragement",
      label: "Use of Encouragement or Reinforcement",
      example: "Example: 'We reinforce key points through repetition and positive reinforcement. We celebrate progress and acknowledge effort. We use encouraging language to motivate our audience without being patronizing.'",
    },
  ], []);

  const TOTAL_QUESTIONS = questions.length;

  const [formData, setFormData] = useState({
    sentenceStyle: profile?.sentenceStyle || "",
    vocabularyPreferences: profile?.vocabularyPreferences || "",
    pacingAndRhythm: profile?.pacingAndRhythm || "",
    useOfMetaphors: profile?.useOfMetaphors || "",
    degreeOfDirectness: profile?.degreeOfDirectness || "",
    formalityLevel: profile?.formalityLevel || "",
    useOfExamples: profile?.useOfExamples || "",
    useOfEncouragement: profile?.useOfEncouragement || "",
  });

  useEffect(() => {
    setFormData({
      sentenceStyle: profile?.sentenceStyle || "",
      vocabularyPreferences: profile?.vocabularyPreferences || "",
      pacingAndRhythm: profile?.pacingAndRhythm || "",
      useOfMetaphors: profile?.useOfMetaphors || "",
      degreeOfDirectness: profile?.degreeOfDirectness || "",
      formalityLevel: profile?.formalityLevel || "",
      useOfExamples: profile?.useOfExamples || "",
      useOfEncouragement: profile?.useOfEncouragement || "",
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
      const allFilled = updatedFormData.sentenceStyle.trim() && 
                       updatedFormData.vocabularyPreferences.trim() && 
                       updatedFormData.pacingAndRhythm.trim() && 
                       updatedFormData.useOfMetaphors.trim() &&
                       updatedFormData.degreeOfDirectness.trim() &&
                       updatedFormData.formalityLevel.trim() &&
                       updatedFormData.useOfExamples.trim() &&
                       updatedFormData.useOfEncouragement.trim();

      if (allFilled) {
        // Submit all data to backend
        await submitVeraStep4(profileRef.current.id, {
          sentenceStyle: updatedFormData.sentenceStyle.trim(),
          vocabularyPreferences: updatedFormData.vocabularyPreferences.trim(),
          pacingAndRhythm: updatedFormData.pacingAndRhythm.trim(),
          useOfMetaphors: updatedFormData.useOfMetaphors.trim(),
          degreeOfDirectness: updatedFormData.degreeOfDirectness.trim(),
          formalityLevel: updatedFormData.formalityLevel.trim(),
          useOfExamples: updatedFormData.useOfExamples.trim(),
          useOfEncouragement: updatedFormData.useOfEncouragement.trim(),
        });
        
        const updatedProfile: VeraProfile = {
          ...profileRef.current,
          ...updatedFormData,
          currentStep: 5,
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
    
    // Only provide handlers when Step 4 is active and not completed
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
                  <FormattedChunkedText text={`Well done, ${profile.userName || 'there'}!\n\nStep 4: Voice Style Principles\n\nNow let's establish the rules, patterns, and preferences that define how your brand communicates. These style principles will ensure consistency in your messaging.\n\nI'll ask you about:\n• Sentence style (short and punchy, rhythmic, structured, etc.)\n• Vocabulary preferences (plain language, technical terms, poetic, energetic, etc.)\n• Pacing and rhythm\n• Use of metaphors or storytelling\n• Degree of directness\n• Formality level\n• Use of examples, analogies, or visuals\n• Use of encouragement or reinforcement\n\nI'll provide examples to help guide you.\n\nLet's begin:`} />
                ) : (
                  <ChunkedText
                    text={`Well done, ${profile.userName || 'there'}!\n\nStep 4: Voice Style Principles\n\nNow let's establish the rules, patterns, and preferences that define how your brand communicates. These style principles will ensure consistency in your messaging.\n\nI'll ask you about:\n• Sentence style (short and punchy, rhythmic, structured, etc.)\n• Vocabulary preferences (plain language, technical terms, poetic, energetic, etc.)\n• Pacing and rhythm\n• Use of metaphors or storytelling\n• Degree of directness\n• Formality level\n• Use of examples, analogies, or visuals\n• Use of encouragement or reinforcement\n\nI'll provide examples to help guide you.\n\nLet's begin:`}
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
                  activeQuestionRef.current = el;
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
            <p className="text-gray-600 italic">✓ Step 4 completed - Voice Style Principles saved</p>
          </div>
        </div>
      )}
    </>
  );
};
