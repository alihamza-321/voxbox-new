import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { useToast } from "@/hooks/use-toast";
import { confirmReady, createProductRefinerSession, submitStep1Name } from "@/lib/product-refiner-api";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import FormattedChunkedText from "@/components/margo/FormattedChunkedText";

export interface ProductRefinerStep1InputHandlers {
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputSubmit: () => void;
  isSubmitting: boolean;
  placeholder: string;
  validationError?: string | null;
  validationHint?: string | null;
}

interface ProductRefinerStep1Props {
  workspaceId: string;
  session: ProductRefinerSession | null;
  onSessionChange: (session: ProductRefinerSession) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onErrorChange?: (message: string | null) => void;
  isCompleted?: boolean;
  onInputHandlersReady?: (handlers: ProductRefinerStep1InputHandlers | null) => void;
}

export const ProductRefinerStep1 = ({
  workspaceId,
  session,
  onSessionChange,
  onLoadingChange,
  onErrorChange,
  isCompleted = false,
  onInputHandlersReady,
}: ProductRefinerStep1Props) => {
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = useState(false);
  const NAME_MIN_LENGTH = 3;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState(session?.userName ?? "");
  const [readyMessage, setReadyMessage] = useState("I'm ready");
  const [isReadySubmitting, setIsReadySubmitting] = useState(false);
  const [roleExplanationMessage, setRoleExplanationMessage] = useState<string | null>(null);
  const welcomeCompleteRef = useRef(false);
  const sessionRef = useRef<ProductRefinerSession | null>(session);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [welcomeMessageComplete, setWelcomeMessageComplete] = useState(false);
  const [namePromptComplete, setNamePromptComplete] = useState(false);

  useEffect(() => {
    setUserName(session?.userName ?? "");
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (session?.step1Completed) {
      setReadyMessage("I'm ready");
    }
  }, [session?.step1Completed]);

  useEffect(() => {
    if (!session?.welcomeMessage) {
      welcomeCompleteRef.current = true;
    }
  }, [session?.welcomeMessage]);

  // Check if name has been submitted (userName exists and nextAction is wait_for_ready or later)
  const hasSubmittedName = !!(session?.userName && (session?.nextAction === "wait_for_ready" || session?.nextAction === "confirm_ready" || session?.step1Completed));

  useEffect(() => {
    const isNameSectionActive = session?.nextAction === "submit_name";
    
    if (!session || isCompleted || !isNameSectionActive || hasSubmittedName) {
      setShowWelcomeMessage(true);
      setShowNamePrompt(true);
      setWelcomeMessageComplete(true);
      setNamePromptComplete(true);
      return;
    }

    setShowWelcomeMessage(false);
    setShowNamePrompt(false);
    setWelcomeMessageComplete(false);
    setNamePromptComplete(false);

    const timer1 = setTimeout(() => {
      setShowWelcomeMessage(true);
    }, 300);

    const timer2 = setTimeout(() => {
      setShowNamePrompt(true);
      setWelcomeMessageComplete(true);
      setNamePromptComplete(true);
    }, 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [session, isCompleted, hasSubmittedName]);

  useEffect(() => {
    if (!workspaceId || session) return;

    let isCancelled = false;

    const initializeSession = async () => {
      setIsInitializing(true);
      onLoadingChange?.(true);
      onErrorChange?.(null);

      try {
        console.log('[ProductRefinerStep1] Creating session for workspace:', workspaceId);
        const response = await createProductRefinerSession(workspaceId);
        console.log('[ProductRefinerStep1] Session creation response:', response);
        if (isCancelled) return;

        // Handle both wrapped ({ data: {...} }) and unwrapped responses
        const sessionData = response?.data || response;
        
        if (!sessionData || !sessionData.id) {
          console.error('[ProductRefinerStep1] Invalid session response - missing ID:', { response, sessionData });
          throw new Error('Failed to create session - invalid response');
        }

        const newSession: ProductRefinerSession = {
          id: sessionData.id,
          workspaceId: sessionData.workspaceId,
          userId: sessionData.userId,
          sessionName: sessionData.sessionName,
          userName: sessionData.userName,
          currentStep: sessionData.currentStep,
          status: sessionData.status,
          version: sessionData.version,
          step1Completed: false,
          step2Completed: false,
          step2Product: null,
          step2TargetAudience: null,
          step2Problem: null,
          step2Features: null,
          step2Delivery: null,
          step2Pricing: null,
          step3Completed: false,
          step3Assessment: null,
          step4Completed: false,
          step4CorePromise: null,
          step4FinalPromise: null,
          step5Completed: false,
          step5Outcomes: null,
          step6Completed: false,
          step6FeatureBenefitTable: null,
          step7Completed: false,
          step7ValueStack: null,
          step8Completed: false,
          step8ProofElements: null,
          step9Completed: false,
          step9Pricing: null,
          step10Completed: false,
          step10FinalSpecification: null,
          completedAt: null,
          createdAt: sessionData.createdAt || new Date().toISOString(),
          updatedAt: sessionData.updatedAt || new Date().toISOString(),
          welcomeMessage: sessionData.welcomeMessage,
          question: sessionData.question,
          nextAction: sessionData.nextAction,
        };

        console.log('[ProductRefinerStep1] Created new session:', newSession);
        // Update the ref immediately
        sessionRef.current = newSession;
        // Set session first, then mark initialization as complete
        onSessionChange(newSession);
        // Use setTimeout to ensure state updates happen in the next tick
        // This prevents React from trying to reconcile during the state update
        setTimeout(() => {
          setIsInitializing(false);
          onLoadingChange?.(false);
        }, 0);
      } catch (error: any) {
        if (isCancelled) return;
        const message = error?.message || "Failed to initialize Product Refiner session";
        onErrorChange?.(message);
        toast({
          title: "Initialization failed",
          description: message,
          variant: "destructive",
        });
        setIsInitializing(false);
        onLoadingChange?.(false);
      }
    };

    initializeSession();

    return () => {
      isCancelled = true;
    };
  }, [workspaceId, session, onSessionChange, onLoadingChange, onErrorChange, toast]);

  const handleSubmitName = useCallback(async () => {
    // Get the latest session from ref (always up-to-date) or from props
    const currentSession = sessionRef.current || session;
    console.log('[ProductRefinerStep1] handleSubmitName called!', {
      hasSession: !!session,
      hasRefSession: !!sessionRef.current,
      sessionId: session?.id,
      refSessionId: sessionRef.current?.id,
      currentSessionId: currentSession?.id,
      userName: userName.trim(),
      userNameLength: userName.trim().length,
    });

    if (!currentSession?.id) {
      console.error('[ProductRefinerStep1] No session ID!', {
        session: session,
        refSession: sessionRef.current,
        currentSession: currentSession,
      });
      toast({
        title: "Session missing",
        description: "Please wait for the session to initialize, then try again.",
        variant: "destructive",
      });
      return;
    }

    // Validate required field
    const trimmedName = userName.trim();
    if (!trimmedName) {
      console.warn('[ProductRefinerStep1] No user name provided!');
      setValidationError("Name is required");
      toast({
        title: "Name required",
        description: "Please enter your name to continue.",
        variant: "destructive",
      });
      return;
    }
    if (trimmedName.length < NAME_MIN_LENGTH) {
      const message = `Name must be at least ${NAME_MIN_LENGTH} characters`;
      setValidationError(message);
      toast({
        title: "Name too short",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setValidationError(null);

    console.log('[ProductRefinerStep1] Submitting name:', trimmedName, 'for session:', currentSession.id);
    setIsSubmitting(true);
    onErrorChange?.(null);

    try {
      console.log('[ProductRefinerStep1] Calling submitStep1Name API...');
      const response = await submitStep1Name(currentSession.id, { userName: trimmedName });
      console.log('[ProductRefinerStep1] API response:', response);
      
      // Store the role explanation message from API
      if (response.message) {
        console.log('[ProductRefinerStep1] Setting role explanation message');
        setRoleExplanationMessage(response.message);
      }
      
      // Update session with the response
      const updatedSession: ProductRefinerSession = {
        ...currentSession,
        userName: trimmedName,
        nextAction: response.nextAction || 'wait_for_ready',
      };
      console.log('[ProductRefinerStep1] Updating session:', updatedSession);
      onSessionChange(updatedSession);
    } catch (error: any) {
      console.error('[ProductRefinerStep1] Error submitting name:', error);
      const message = error?.message || "Failed to submit name";
      onErrorChange?.(message);
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [session, userName, toast, onErrorChange, onSessionChange]);

  const handleConfirmReady = async () => {
    if (!session?.id) {
      toast({
        title: "Session missing",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsReadySubmitting(true);
    onErrorChange?.(null);

    try {
      const readyPayload = readyMessage.trim() || "I'm ready";
      await confirmReady(session.id, { message: readyPayload });
      
      const updatedSession: ProductRefinerSession = {
        ...session,
        step1Completed: true,
        currentStep: 2,
      };
      onSessionChange(updatedSession);
    } catch (error: any) {
      const message = error?.message || "Failed to confirm ready";
      onErrorChange?.(message);
      toast({
        title: "Confirmation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsReadySubmitting(false);
    }
  };


  // Expose input handlers to parent component
  useEffect(() => {
    if (!onInputHandlersReady) return;
    
    // Don't set up handlers while initializing
    if (isInitializing) {
      console.log('[ProductRefinerStep1] Still initializing - clearing handlers');
      onInputHandlersReady(null);
      return;
    }
    
    // Only provide handlers when actively in the name input phase
    // Clear handlers if: name already submitted, step completed, or moved past name input
    const isNameInputPhase = session?.nextAction === "submit_name";
    const shouldProvideHandlers = 
      isNameInputPhase && 
      !hasSubmittedName && 
      !isCompleted &&
      session && // Ensure session exists
      session.id; // Ensure session has ID
    
    console.log('[ProductRefinerStep1] Setting up input handlers:', {
      isNameInputPhase,
      hasSubmittedName,
      isCompleted,
      hasSession: !!session,
      hasSessionId: !!session?.id,
      sessionId: session?.id,
      nextAction: session?.nextAction,
      isInitializing,
      shouldProvideHandlers,
    });
    
    if (shouldProvideHandlers) {
      console.log('[ProductRefinerStep1] Registering input handlers with handleSubmitName');
      // Use a ref to get the latest session to avoid closure issues
      const wrappedSubmit = () => {
        const currentSession = sessionRef.current;
        console.log('[ProductRefinerStep1] Wrapped submit function called!', {
          refSessionId: currentSession?.id,
          propSessionId: session?.id,
          currentUserName: userName,
        });
        // Check session from ref (always up-to-date)
        if (currentSession?.id) {
          // Call handleSubmitName - it will use the latest session from props via useCallback
          handleSubmitName();
        } else {
          console.error('[ProductRefinerStep1] Cannot submit - no session ID in ref', {
            refSession: currentSession,
            propSession: session,
          });
          toast({
            title: "Session not ready",
            description: "Please wait for the session to initialize, then try again.",
            variant: "destructive",
          });
        }
      };
      const handleInputChange = (value: string) => {
        setUserName(value);
        // Clear validation error when user meets min requirement
        if (validationError && value.trim().length >= NAME_MIN_LENGTH) {
          setValidationError(null);
        }
      };
      const trimmedName = userName.trim();
      const needsHint = trimmedName.length > 0 && trimmedName.length < NAME_MIN_LENGTH;
      onInputHandlersReady({
        inputValue: userName,
        onInputChange: handleInputChange,
        onInputSubmit: wrappedSubmit,
        isSubmitting,
        placeholder: "Enter your name",
        validationError: validationError,
        validationHint: needsHint ? `Required • minimum ${NAME_MIN_LENGTH} characters` : null,
      });
    } else {
      // Explicitly clear handlers when not in name input phase or name already submitted
      console.log('[ProductRefinerStep1] Clearing input handlers - not in name input phase');
      onInputHandlersReady(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onInputHandlersReady, session?.nextAction, session?.userName, hasSubmittedName, isCompleted, session?.id, userName, isSubmitting, isInitializing]);

  if (isInitializing) {
    return (
      <div className="margo-chat-bubble margo-chat-bubble--bot">
        <div className="margo-message-content">
          <div className="flex items-start gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Initializing Product Refiner…</p>
              <p className="text-sm text-gray-600 mt-1">Setting up your refinement session.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const showRoleExplanation = session.userName && !session.step1Completed;
  const showReadyButton = session.userName && !session.step1Completed;

  return (
    <>
      {session.welcomeMessage && showWelcomeMessage && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            {welcomeMessageComplete ? (
              <FormattedChunkedText text={session.welcomeMessage} />
            ) : (
              <ChunkedText
                text={session.welcomeMessage}
                onComplete={() => setWelcomeMessageComplete(true)}
                staggerMs={50}
              />
            )}
          </div>
        </div>
      )}

      {!session.userName && showNamePrompt && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            {namePromptComplete ? (
              <p>{session.question || "👉 What's your name?"}</p>
            ) : (
              <ChunkedText
                text={session.question || "👉 What's your name?"}
                onComplete={() => setNamePromptComplete(true)}
                staggerMs={30}
              />
            )}
          </div>
        </div>
      )}


      {/* Show user's submitted name - always visible when submitted */}
      {session.userName && (
        <div className="margo-chat-bubble margo-chat-bubble--user">
          <div className="margo-message-content">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{session.userName}</p>
          </div>
        </div>
      )}

      {showRoleExplanation && roleExplanationMessage && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            {isCompleted ? (
              <p>{roleExplanationMessage}</p>
            ) : (
              <ChunkedText
                text={roleExplanationMessage}
                staggerMs={30}
              />
            )}
          </div>
        </div>
      )}

      {showReadyButton && (
        <div
          className="margo-chat-bubble margo-chat-bubble--user w-full"
          style={{ maxWidth: "100%" }}
        >
          <div className="margo-message-content" style={{ padding: 0 }}>
            <Button
              onClick={handleConfirmReady}
              disabled={isReadySubmitting}
              className="margo-soft-button w-full text-lg font-semibold justify-center"
              style={{ height: "auto"}}
            >
              {isReadySubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                readyMessage
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Show completion message when step is completed */}
      {session.step1Completed && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <p className="text-sm text-gray-600">✓ Step 1 completed - Welcome and Role Introduction</p>
          </div>
        </div>
      )}
    </>
  );
};

