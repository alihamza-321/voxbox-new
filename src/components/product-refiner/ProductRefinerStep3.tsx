import { useEffect, useState, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { generateAssessment } from "@/lib/product-refiner-api";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import { ChunkedText } from "@/components/margo/ChunkedText";

interface ProductRefinerStep3PersistedState {
  hasGenerated: boolean;
}

interface ProductRefinerStep3Props {
  workspaceId: string;
  session: ProductRefinerSession;
  isActive: boolean;
  isCompleted: boolean;
  onSessionChange: (session: ProductRefinerSession) => void;
  onError?: (message: string | null) => void;
  isUnlocked?: boolean;
  persistedState?: ProductRefinerStep3PersistedState | null;
  onPersistedStateChange?: (state: ProductRefinerStep3PersistedState | null) => void;
}

export const ProductRefinerStep3 = ({
  session,
  isActive,
  isCompleted,
  onSessionChange,
  onError,
  isUnlocked = false,
  persistedState,
  onPersistedStateChange,
}: ProductRefinerStep3Props) => {
  const { toast } = useToast();
  const introMessage = [
    "Step 3: Early Product Assessment",
    "",
    "Purpose",
    "Give you clarity about the current state of your product before refinement.",
    "",
    "Process Flow",
    "- I'll explain what this assessment is and why it matters.",
    "- I'll evaluate your initial intake to surface strengths, weaknesses, gaps, unclear areas, and improvement opportunities.",
    "- I'll present a written summary of the assessment for you.",
    "- You’ll confirm you understand before we continue to the next step.",
  ].join("\n");

  const [isGenerating, setIsGenerating] = useState(() => {
    // If we have persisted state that says we generated, but session is not completed yet,
    // we're likely in the middle of generating (page refresh during API call)
    if (persistedState?.hasGenerated && !session.step3Completed && !session.step3Assessment) {
      return true; // Show loading state on refresh
    }
    return false;
  });
  const [hasGenerated, setHasGenerated] = useState(() => {
    // Restore from persistedState if available, or check if assessment already exists
    if (persistedState?.hasGenerated) return true;
    if (session.step3Completed || session.step3Assessment) return true;
    return false;
  });
  
  // Track if we've attempted generation to prevent infinite retry loops
  // Key by session ID + step2Completed to allow retry if step 2 changes
  const attemptKeyRef = useRef<string | null>(null);
  
  const getAttemptKey = () => {
    return session.id && session.step2Completed 
      ? `${session.id}-${session.step2Completed}` 
      : null;
  };

  // Parse assessment if it's stored as a string (from localStorage)
  const assessment = useMemo(() => {
    if (!session.step3Assessment) return null;
    
    // If it's already an object, return it
    if (typeof session.step3Assessment === 'object') {
      return session.step3Assessment;
    }
    
    // If it's a string, try to parse it
    if (typeof session.step3Assessment === 'string') {
      try {
        return JSON.parse(session.step3Assessment);
      } catch (e) {
        console.error('Failed to parse step3Assessment:', e);
        return null;
      }
    }
    
    return null;
  }, [session.step3Assessment]);

  // Persist state whenever it changes
  useEffect(() => {
    if (onPersistedStateChange) {
      onPersistedStateChange({
        hasGenerated,
      });
    }
  }, [hasGenerated, onPersistedStateChange]);

  useEffect(() => {
    const currentAttemptKey = getAttemptKey();
    
    // Prevent infinite retry loops - only attempt once per session state
    if (attemptKeyRef.current === currentAttemptKey && !session.step3Completed && !session.step3Assessment) {
      // We've already attempted for this session state, don't retry automatically
      return;
    }

    // If we're in analyzing state (hasGenerated but not completed), restart the generation
    if (isActive && !isCompleted && hasGenerated && !session.step3Completed && !session.step3Assessment && !isGenerating) {
      // We were generating but page was refreshed - restart the API call
      handleGenerateAssessment();
    } else if (isActive && !isCompleted && !hasGenerated && session.step2Completed) {
      // Normal flow - start generation
      handleGenerateAssessment();
    }
  }, [isActive, isCompleted, hasGenerated, session.step2Completed, session.step3Completed, session.step3Assessment, session.id, isGenerating]);

  const handleGenerateAssessment = async () => {
    const currentAttemptKey = getAttemptKey();
    
    // Allow restart if we were generating but session is not completed (page refresh scenario)
    const canRestart = hasGenerated && !session.step3Completed && !session.step3Assessment;
    if (!session.id || (hasGenerated && !canRestart) || isGenerating) return;
    
    // Prevent duplicate attempts for the same session state
    if (attemptKeyRef.current === currentAttemptKey && !session.step3Completed && !session.step3Assessment) {
      return;
    }

    // Mark that we've attempted generation for this session state
    attemptKeyRef.current = currentAttemptKey || null;
    setIsGenerating(true);
    if (!hasGenerated) {
      setHasGenerated(true);
    }
    onError?.(null);

    try {
      const response = await generateAssessment(session.id);
      
      const updatedSession: ProductRefinerSession = {
        ...session,
        step3Assessment: response.assessment,
        step3Completed: true,
        currentStep: 4,
      };
      onSessionChange(updatedSession);
      // Clear attempt key on success to allow future operations
      attemptKeyRef.current = null;
    } catch (error: any) {
      const message = error?.message || "Failed to generate assessment";
      onError?.(message);
      // Don't reset hasGenerated to false - keep it true since we attempted
      // The attemptKeyRef will prevent automatic retries
      toast({
        title: "Assessment failed",
        description: message,
        variant: "destructive",
      });
      // Keep attemptKeyRef set to prevent automatic retries
      // It will be reset if the session state changes (e.g., step2 re-completed)
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isUnlocked && !isActive && !isCompleted) {
    return null;
  }

  return (
    <>
      {/* Show initial message only when active and not generating */}
      {isActive && !isCompleted && !isGenerating && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <ChunkedText text={introMessage} staggerMs={30} />
          </div>
        </div>
      )}

      {/* Show loading state when generating */}
      {isGenerating && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="flex items-start gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Analyzing your product...</p>
                <p className="text-sm text-gray-600 mt-1">Identifying strengths, weaknesses, gaps, and improvement opportunities.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show assessment results when completed */}
      {isCompleted && assessment && (
        <>
          <div className="margo-chat-bubble margo-chat-bubble--bot">
            <div className="margo-message-content">
              <div className="space-y-5">
                <h3 className="font-semibold text-lg text-gray-900 mb-4">Early Product Assessment</h3>
                
                {assessment.summary && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Summary</h4>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">
                      {assessment.summary}
                    </p>
                  </div>
                )}

                {assessment.strengths && Array.isArray(assessment.strengths) && assessment.strengths.length > 0 && (
                  <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
                    <h4 className="font-medium text-green-900 mb-3">Strengths</h4>
                    <ul className="list-disc list-inside space-y-2 text-sm text-green-800">
                      {assessment.strengths.map((strength: string, idx: number) => (
                        <li key={idx} className="leading-relaxed">{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {assessment.weaknesses && Array.isArray(assessment.weaknesses) && assessment.weaknesses.length > 0 && (
                  <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg">
                    <h4 className="font-medium text-orange-900 mb-3">Weaknesses</h4>
                    <ul className="list-disc list-inside space-y-2 text-sm text-orange-800">
                      {assessment.weaknesses.map((weakness: string, idx: number) => (
                        <li key={idx} className="leading-relaxed">{weakness}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {assessment.gaps && Array.isArray(assessment.gaps) && assessment.gaps.length > 0 && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                    <h4 className="font-medium text-yellow-900 mb-3">Gaps</h4>
                    <ul className="list-disc list-inside space-y-2 text-sm text-yellow-800">
                      {assessment.gaps.map((gap: string, idx: number) => (
                        <li key={idx} className="leading-relaxed">{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {assessment.unclearAreas && Array.isArray(assessment.unclearAreas) && assessment.unclearAreas.length > 0 && (
                  <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-r-lg">
                    <h4 className="font-medium text-purple-900 mb-3">Unclear Areas</h4>
                    <ul className="list-disc list-inside space-y-2 text-sm text-purple-800">
                      {assessment.unclearAreas.map((area: string, idx: number) => (
                        <li key={idx} className="leading-relaxed">{area}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {assessment.improvementOpportunities && Array.isArray(assessment.improvementOpportunities) && assessment.improvementOpportunities.length > 0 && (
                  <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 rounded-r-lg">
                    <h4 className="font-medium text-indigo-900 mb-3">Improvement Opportunities</h4>
                    <ul className="list-disc list-inside space-y-2 text-sm text-indigo-800">
                      {assessment.improvementOpportunities.map((opp: string, idx: number) => (
                        <li key={idx} className="leading-relaxed">{opp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Show completion message */}
          <div className="margo-chat-bubble margo-chat-bubble--bot">
            <div className="margo-message-content">
              <p className="text-sm text-gray-600">✓ Step 3 completed - Early Product Assessment</p>
            </div>
          </div>
        </>
      )}
    </>
  );
};

