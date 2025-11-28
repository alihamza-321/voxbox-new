import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MargoTypingIndicator } from "@/components/margo/MargoTypingIndicator";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { useToast } from "@/hooks/use-toast";
import { confirmMargoReady, createMargoBrief, submitMargoStep1 } from "@/lib/margo-api";
import type { MargoBrief } from "@/lib/margo-api";
import FormattedChunkedText from "./FormattedChunkedText";

export interface MargoStep1InputHandlers {
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputSubmit: () => void;
  isSubmitting: boolean;
  placeholder: string;
}

interface MargoStep1Props {
  workspaceId: string;
  session: MargoBrief | null;
  onSessionChange: (session: MargoBrief) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onErrorChange?: (message: string | null) => void;
  isCompleted?: boolean;
  onInputHandlersReady?: (handlers: MargoStep1InputHandlers | null) => void;
}

export const MargoStep1 = ({
  workspaceId,
  session,
  onSessionChange,
  onLoadingChange,
  onErrorChange,
  isCompleted = false,
  onInputHandlersReady,
}: MargoStep1Props) => {
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState(session?.userName ?? "");
  const [readyMessage, setReadyMessage] = useState("I'm ready");
  const [isReadySubmitting, setIsReadySubmitting] = useState(false);
  const [isWelcomeComplete, setIsWelcomeComplete] = useState(!session?.welcomeMessage);
  const welcomeCompleteRef = useRef(false);
  
  // Progressive message reveal states
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showInputField, setShowInputField] = useState(false);
  
  // Track when each message animation completes
  const [welcomeMessageComplete, setWelcomeMessageComplete] = useState(false);
  const [namePromptComplete, setNamePromptComplete] = useState(false);

  useEffect(() => {
    setUserName(session?.userName ?? "");
  }, [session?.userName]);

  useEffect(() => {
    if (session?.step1Completed) {
      setReadyMessage("I'm ready");
    }
  }, [session?.step1Completed]);

  useEffect(() => {
    // Initialize state based on welcome message, but don't override if already marked complete
    if (!session?.welcomeMessage) {
      setIsWelcomeComplete(true);
      welcomeCompleteRef.current = true;
    } else if (!welcomeCompleteRef.current) {
      // Only set to false if we haven't marked it complete yet
      setIsWelcomeComplete(false);
    }
  }, [session?.welcomeMessage]);

  // Check if name has been submitted (userName exists and nextAction is confirm_ready or later)
  const hasSubmittedName = !!(session?.userName && (session?.nextAction === "confirm_ready" || session?.nextAction === "select_ava_profile" || session?.step1Completed));

  // Progressive message reveal with delays
  useEffect(() => {
    const isNameSectionActive = session?.nextAction === "submit_name";
    
    // If completed, read-only, or not active, show all immediately
    if (!session || isCompleted || !isNameSectionActive || hasSubmittedName) {
      setShowWelcomeMessage(true);
      setShowNamePrompt(true);
      setShowInputField(true);
      setWelcomeMessageComplete(true);
      setNamePromptComplete(true);
      return;
    }

    // Only do progressive reveal when section is first active
    // Reset states when session changes to trigger progressive reveal
    setShowWelcomeMessage(false);
    setShowNamePrompt(false);
    setShowInputField(false);
    setWelcomeMessageComplete(false);
    setNamePromptComplete(false);

    // Show welcome message after a short initial delay
    const timer1 = setTimeout(() => {
      setShowWelcomeMessage(true);
    }, 300);

    return () => {
      clearTimeout(timer1);
    };
  }, [session?.id, session?.welcomeMessage, isCompleted, session?.nextAction, session?.userName, session?.step1Completed, hasSubmittedName]);

  // Show name prompt when welcome message completes
  useEffect(() => {
    if (welcomeMessageComplete && !showNamePrompt && session?.nextAction === "submit_name" && !hasSubmittedName) {
      // Small delay for smooth transition
      const timer = setTimeout(() => {
        setShowNamePrompt(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [welcomeMessageComplete, showNamePrompt, session?.nextAction, hasSubmittedName]);

  // Show input field when name prompt completes
  useEffect(() => {
    if (namePromptComplete && !showInputField && session?.nextAction === "submit_name" && !hasSubmittedName) {
      // Small delay for smooth transition
      const timer = setTimeout(() => {
        setShowInputField(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [namePromptComplete, showInputField, session?.nextAction, hasSubmittedName]);

  // Reset completion states when session changes
  useEffect(() => {
    if (!session?.welcomeMessage) {
      setWelcomeMessageComplete(false);
      setNamePromptComplete(false);
    }
  }, [session?.id]);

  const needsReadyConfirmation = hasSubmittedName && session?.nextAction === "confirm_ready" && !session?.step1Completed && !session?.step2Completed;
  const showNameSection = session?.nextAction === "submit_name" || hasSubmittedName;
  const showReadySection = needsReadyConfirmation || (hasSubmittedName && session?.nextAction === "confirm_ready" && !session?.step1Completed);

  // Expose input handlers to parent component
  useEffect(() => {
    if (!onInputHandlersReady) return;
    
    // Only provide handlers when actively in the name input phase
    // Clear handlers if: name already submitted, step completed, or moved past name input
    const isNameInputPhase = session?.nextAction === "submit_name";
    const shouldProvideHandlers = 
      isNameInputPhase && 
      !hasSubmittedName && 
      !isCompleted &&
      session; // Ensure session exists
    
    if (shouldProvideHandlers) {
      onInputHandlersReady({
        inputValue: userName,
        onInputChange: setUserName,
        onInputSubmit: handleNameSubmit,
        isSubmitting,
        placeholder: "e.g., Clara",
      });
    } else {
      // Explicitly clear handlers when not in name input phase or name already submitted
      onInputHandlersReady(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onInputHandlersReady, session?.nextAction, session?.userName, hasSubmittedName, isCompleted, session?.id, userName, isSubmitting]);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    if (session?.id) {
      if (!session.workspaceId || session.workspaceId === workspaceId) {
        return;
      }
    }

    let isCancelled = false;

    const initSession = async () => {
      setIsInitializing(true);
      onLoadingChange?.(true);
      onErrorChange?.(null);

      try {
        const response = await createMargoBrief(workspaceId, "My Product Evaluation");
        if (isCancelled) return;

        const sessionData = response?.data as MargoBrief | undefined;
        if (!sessionData) {
          throw new Error("Missing session data in response");
        }

        onSessionChange({
          ...sessionData,
          workspaceId: sessionData.workspaceId ?? workspaceId,
          step1Completed: sessionData.step1Completed ?? false,
          currentStep: sessionData.currentStep && sessionData.currentStep > 1 ? sessionData.currentStep : 1,
        });
        setUserName(sessionData.userName ?? "");

        toast({
          title: "MARGO Activated",
          description: "Your product evaluation journey is ready to begin.",
        });
      } catch (error: any) {
        if (isCancelled) return;
        const message = error?.message || "Unable to start MARGO session.";
        onErrorChange?.(message);
        toast({
          title: "Unable to start MARGO",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (isCancelled) return;
        setIsInitializing(false);
        onLoadingChange?.(false);
      }
    };

    initSession();

    return () => {
      isCancelled = true;
    };
  }, [workspaceId, session?.workspaceId, session?.id, onSessionChange, onLoadingChange, onErrorChange, toast]);

  const handleNameSubmit = async () => {
    if (!session?.id) {
      toast({
        title: "Session missing",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    if (!userName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to continue.",
        variant: "destructive",
      });
      return;
    }

    const trimmedName = userName.trim();

    try {
      setIsSubmitting(true);
      const response = await submitMargoStep1(session.id, { userName: trimmedName });

      const apiSession = (response?.data || null) as Partial<MargoBrief> | null;

      const mergedSession: MargoBrief = {
        ...(session || ({} as MargoBrief)),
        ...(apiSession ?? {}),
        id: session.id,
        workspaceId: apiSession?.workspaceId ?? session.workspaceId ?? workspaceId,
        userName: apiSession?.userName || trimmedName,
        // Don't mark step1Completed as true yet - only when "I'm ready" is clicked
        step1Completed: false,
        currentStep: 1,
        nextAction: "confirm_ready",
      };

      onSessionChange(mergedSession);

      setUserName(trimmedName);
      setReadyMessage("I'm ready");

      toast({
        title: "Step 1 submitted",
        description: "Great! MARGO is preparing the next part of your journey.",
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to submit your answer.";
      
      // Check if backend indicates we're already past step 1
      if (errorMessage.includes("current step is 2") || errorMessage.includes("Expected step 1")) {
        // Backend is already at step 2, update session state to match
        onSessionChange({
          ...session,
          currentStep: 2,
          nextAction: "select_ava_profile",
        });
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
      } else {
        toast({
          title: "Submission failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReadyConfirm = async () => {
    if (!session?.id) {
      toast({
        title: "Session missing",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    const trimmedMessage = readyMessage.trim();
    if (!trimmedMessage) {
      toast({
        title: "Confirmation required",
        description: "Please confirm you're ready to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsReadySubmitting(true);
      onErrorChange?.(null);
      
      const readyResponse = await confirmMargoReady(session.id, { message: trimmedMessage });
      const readySession = (readyResponse?.data || null) as Partial<MargoBrief> | null;

      if (!readySession && !readyResponse?.data) {
        throw new Error("No response data received from server");
      }

      const mergedSession: MargoBrief = {
        ...session,
        ...(readySession ?? {}),
        id: session.id,
        workspaceId: session.workspaceId ?? workspaceId,
        step1Completed: true,
        currentStep:
          readySession?.currentStep && readySession.currentStep > (session.currentStep ?? 0)
            ? readySession.currentStep
            : Math.max(session.currentStep ?? 2, 2),
        nextAction: readySession?.nextAction || "select_ava_profile",
      };

      // Use setTimeout to ensure state updates happen in the next tick
      // This prevents React from trying to reconcile during the state update
      setTimeout(() => {
        onSessionChange(mergedSession);
      }, 0);

      toast({
        title: "Ready to continue",
        description: "Perfect! Let's connect your AVA profile next.",
      });
    } catch (error: any) {
      console.error("Ready confirmation error:", error);
      const errorMessage = error?.message || error?.response?.data?.message || "Unable to confirm readiness. Please try again.";
      
      // Check if backend indicates we're already past step 1
      if (errorMessage.includes("current step is 2") || errorMessage.includes("Expected step 1")) {
        // Backend is already at step 2, update session state to match
        const mergedSession: MargoBrief = {
          ...session,
          currentStep: 2,
          nextAction: "select_ava_profile",
          step1Completed: true,
        };
        
        setTimeout(() => {
          onSessionChange(mergedSession);
        }, 0);
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
        
        onErrorChange?.(null);
      } else {
        onErrorChange?.(errorMessage);
        toast({
          title: "Confirmation failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsReadySubmitting(false);
    }
  };

  if (isInitializing && !session) {
    return (
      <div className="margo-chat-bubble margo-chat-bubble--bot">
        <div className="margo-message-content">
          <div className="flex items-start gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-1">Initializing MARGO...</p>
            <ChunkedText
              text="Booting up your strategic workspace. One moment while I set the stage…"
              chunkClassName="text-sm text-gray-600"
              animation="typewriter"
              isChunk={true}
              staggerMs={300}
              minChunkLength={60}
            />
              <MargoTypingIndicator className="text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // If Step 1 is completed, show the actual content in read-only mode (including "I'm ready" section)
  if (isCompleted) {
    return (
      <>
        {/* Section 1: Name Input */}
        <div className="space-y-4">
              {session.welcomeMessage && (
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
              <FormattedChunkedText
                      text={session.welcomeMessage}
                      chunkClassName="text-sm"
                      animation="typewriter"
                      isChunk={false}
                      staggerMs={30}
                      minChunkLength={100}
                      onComplete={() => {
                      }}
                    />
              </div>
                </div>
              )}
          <div className="margo-chat-bubble margo-chat-bubble--bot">
            <div className="margo-message-content">
                <ChunkedText
                  text="Hey there! I'm MARGO — let me personalize this journey. What name should I greet you by?"
                  chunkClassName="text-sm"
                  // isChunk={false}
                />
            </div>
              </div>
              {session.userName && (
            <div className="margo-chat-bubble margo-chat-bubble--user">
              <div className="margo-message-content">
                  <ChunkedText
                    text={`You can call me ${session.userName}.`}
                    chunkClassName="text-sm"
                    // isChunk={false}
                  />
                </div>
            </div>
          )}
            </div>

        {/* Section 2: "I'm ready" Confirmation (show in history when completed) */}
        {session.step1Completed && (
          <div className="space-y-4 mt-4">
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                  <ChunkedText
                    text={
                      session.userName
                        ? `Amazing, ${session.userName}! When you say the word, I'll lock in your AVA profile options.`
                        : "Amazing! When you say the word, I'll lock in your AVA profile options."
                    }
                    chunkClassName="text-sm"
                    isChunk={false}
                  />
              </div>
                </div>
                {session.userName && (
              <div className="margo-chat-bubble margo-chat-bubble--user">
                <div className="margo-message-content">
                    <ChunkedText
                      text="I'm ready"
                      chunkClassName="text-sm"
                      isChunk={false}
                    />
                  </div>
              </div>
            )}
              </div>
        )}
      </>
    );
  }

  // Show name input section (active or read-only based on state)
  if (showNameSection && !isCompleted) {
    const isNameSectionActive = session.nextAction === "submit_name";
    const isNameSectionReadOnly = hasSubmittedName && !isNameSectionActive;
    
    // For progressive reveal, use the state variables; for read-only, show all
    const shouldShowWelcome = isNameSectionReadOnly ? true : showWelcomeMessage;
    const shouldShowNamePrompt = isNameSectionReadOnly ? true : showNamePrompt;

    return (
      <>
        {/* Section 1: Name Input */}
        <div className="space-y-4">
              {session.welcomeMessage && shouldShowWelcome && (
            <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${showWelcomeMessage ? 'opacity-100' : 'opacity-0'}`}>
              <div className="margo-message-content">
                  {/* {isNameSectionActive ? ( */}
                    <FormattedChunkedText
                      text={session.welcomeMessage}
                      chunkClassName="text-sm"
                      animation="typewriter"
                      isChunk={isNameSectionActive?true:false}
                      staggerMs={30}
                      minChunkLength={100}
                      onComplete={() => {
                        setIsWelcomeComplete(true);
                        welcomeCompleteRef.current = true;
                        setWelcomeMessageComplete(true);
                      }}
                    />
                  {/* ) : (
                    renderMinimalMarkdown(session.welcomeMessage)
                  )} */}
                {!isWelcomeComplete && isNameSectionActive && shouldShowWelcome && <MargoTypingIndicator className="text-gray-400" />}
              </div>
                </div>
              )}
              {shouldShowNamePrompt && (isWelcomeComplete || isNameSectionReadOnly) && (
                <>
              <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${showNamePrompt ? 'opacity-100' : 'opacity-0'}`}>
                <div className="margo-message-content">
                    <ChunkedText
                      text="Hey there! I'm MARGO — let me personalize this journey. What name should I greet you by?"
                      chunkClassName="text-sm"
                      animation={isNameSectionActive ? "typewriter" : undefined}
                      isChunk={true}
                      staggerMs={30}
                      minChunkLength={80}
                      onComplete={() => {
                        setNamePromptComplete(true);
                      }}
                    />
                  {isSubmitting && isNameSectionActive && <MargoTypingIndicator className="text-gray-400" />}
                </div>
                  </div>
                  {isNameSectionReadOnly && session.userName && (
                <div className="margo-chat-bubble margo-chat-bubble--user transition-opacity duration-500 opacity-100">
                  <div className="margo-message-content">
                      <ChunkedText
                        text={`You can call me ${session.userName}.`}
                        chunkClassName="text-sm"
                        isChunk={false}
                      />
                  </div>
                    </div>
                  )}
                </>
              )}

        </div>

        {/* Section 2: "I'm ready" Confirmation - show when name is submitted */}
        {showReadySection && (
          <div className="space-y-4 mt-4">
            <div className="margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 opacity-100">
              <div className="margo-message-content">
                  <ChunkedText
                    text={
                      session.userName
                        ? `Amazing, ${session.userName}! When you say the word, I'll lock in your AVA profile options.`
                        : "Amazing! When you say the word, I'll lock in your AVA profile options."
                    }
                    chunkClassName="text-sm"
                    animation="typewriter"
                    isChunk={true}
                    staggerMs={30}
                    minChunkLength={100}
                  />
                {isReadySubmitting && <MargoTypingIndicator className="text-gray-400" />}
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div className="space-y-2">
                <label htmlFor="margo-ready-confirmation" className="text-sm font-medium text-gray-700">
                  Click on ready button
                </label>
                <p className="text-xs text-gray-500">
                  This message is sent to MARGO to confirm you're ready for the AVA profile step.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Button
                  type="button"
                  onClick={handleReadyConfirm}
                  disabled={isReadySubmitting}
                  className="margo-soft-button text-sm w-full"
                >
                  {isReadySubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending confirmation...
                    </>
                  ) : (
                    "I'm ready"
                  )}
                </Button>
              
              </div>
              <span className="text-sm text-gray-500 text-left w-full">
                  MARGO will advance once you confirm.
                </span>
            </div>
          </div>
        )}
      </>
    );
  }

  // Legacy: Show "I'm ready" confirmation only when active (not in history/completed state)
  // This is a fallback for edge cases
  if (needsReadyConfirmation && !isCompleted && !showNameSection) {
    return (
      <div className="space-y-4">
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
              <ChunkedText
                text={
                  session.userName
                    ? `Amazing, ${session.userName}! When you say the word, I'll lock in your AVA profile options.`
                    : "Amazing! When you say the word, I'll lock in your AVA profile options."
                }
                chunkClassName="text-sm"
                animation="typewriter"
                isChunk={false}
                staggerMs={350}
                minChunkLength={60}
              />
            {isReadySubmitting && <MargoTypingIndicator className="text-gray-400" />}
          </div>
        </div>
        <div className="space-y-3 ml-12 mb-4">
          <div className="space-y-2">
            <label htmlFor="margo-ready-confirmation" className="text-sm font-medium text-gray-700">
              Type your confirmation
            </label>
            <Input
              id="margo-ready-confirmation"
              value={readyMessage}
              onChange={(event) => setReadyMessage(event.target.value)}
              disabled={isReadySubmitting}
              className="h-10 rounded border-gray-300 bg-white transition focus:border-gray-400 focus:ring-gray-400"
            />
            <p className="text-xs text-gray-500">
              This message is sent to MARGO to confirm you're ready for the AVA profile step.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={handleReadyConfirm}
              disabled={isReadySubmitting}
              className="margo-soft-button"
            >
              {isReadySubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending confirmation...
                </>
              ) : (
                "I'm ready"
              )}
            </Button>
            <span className="text-sm text-gray-500">
              MARGO will advance once you confirm.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Fallback: show actual content in read-only mode if step1Completed is true (both sections)
  if (session.step1Completed && !isCompleted) {
    return (
      <>
        {/* Section 1: Name Input */}
        <div className="space-y-4">
              {session.welcomeMessage && (
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
              <FormattedChunkedText
                      text={session.welcomeMessage}
                      chunkClassName="text-sm"
                      animation="typewriter"
                      isChunk={false}
                      staggerMs={30}
                      minChunkLength={100}
                      onComplete={() => {
                      }}
                    />
              </div>
                </div>
              )}
          <div className="margo-chat-bubble margo-chat-bubble--bot">
            <div className="margo-message-content">
                <ChunkedText
                  text="Hey there! I'm MARGO — let me personalize this journey. What name should I greet you by?"
                  chunkClassName="text-sm"
                  isChunk={false}
                />
            </div>
              </div>
              {session.userName && (
            <div className="margo-chat-bubble margo-chat-bubble--user">
              <div className="margo-message-content">
                  <ChunkedText
                    text={`You can call me ${session.userName}.`}
                    chunkClassName="text-sm"
                    isChunk={false}
                  />
                </div>
            </div>
          )}
            </div>

        {/* Section 2: "I'm ready" Confirmation */}
        <div className="space-y-4 mt-4">
          <div className="margo-chat-bubble margo-chat-bubble--bot">
            <div className="margo-message-content">
                <ChunkedText
                  text={
                    session.userName
                      ? `Amazing, ${session.userName}! When you say the word, I'll lock in your AVA profile options.`
                      : "Amazing! When you say the word, I'll lock in your AVA profile options."
                  }
                  chunkClassName="text-sm"
                  isChunk={false}
                />
            </div>
              </div>
              {session.userName && (
            <div className="margo-chat-bubble margo-chat-bubble--user">
              <div className="margo-message-content">
                  <ChunkedText
                    text="I'm ready"
                    chunkClassName="text-sm"
                    isChunk={false}
                  />
                </div>
            </div>
          )}
            </div>
      </>
    );
  }

  return null;
};

