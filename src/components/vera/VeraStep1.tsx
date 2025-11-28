import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { useToast } from "@/hooks/use-toast";
import { confirmVeraReady, createVeraProfile, submitVeraStep1, getVeraProfiles } from "@/lib/vera-api";
import type { VeraProfile } from "@/lib/vera-api";
import FormattedChunkedText from "@/components/margo/FormattedChunkedText";
import avaAvatar from "@/assets/ava-avatar.png";

export interface VeraStep1InputHandlers {
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputSubmit: () => void;
  isSubmitting: boolean;
  placeholder: string;
  validationError?: string | null;
  validationHint?: string | null;
}

export interface VeraStep1PersistedState {
  roleExplanationMessage?: string | null;
}

interface VeraStep1Props {
  workspaceId: string;
  profile: VeraProfile | null;
  onProfileChange: (profile: VeraProfile) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onErrorChange?: (message: string | null) => void;
  isCompleted?: boolean;
  onInputHandlersReady?: (handlers: VeraStep1InputHandlers | null) => void;
  persistedState?: VeraStep1PersistedState | null;
  onPersistedStateChange?: (state: VeraStep1PersistedState | null) => void;
}

export const VeraStep1 = ({
  workspaceId,
  profile,
  onProfileChange,
  onLoadingChange,
  onErrorChange,
  isCompleted = false,
  onInputHandlersReady,
  persistedState,
  onPersistedStateChange,
}: VeraStep1Props) => {
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState(profile?.userName ?? "");
  const [readyMessage, setReadyMessage] = useState("I'm ready");
  const [isReadySubmitting, setIsReadySubmitting] = useState(false);
  const [roleExplanationMessage, setRoleExplanationMessage] = useState<string | null>(
    persistedState?.roleExplanationMessage ?? null
  );
  const welcomeCompleteRef = useRef(false);
  const initializationAttemptedRef = useRef(false);
  
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [welcomeMessageComplete, setWelcomeMessageComplete] = useState(false);
  const [namePromptComplete, setNamePromptComplete] = useState(false);

  useEffect(() => {
    setUserName(profile?.userName ?? "");
  }, [profile?.userName]);

  useEffect(() => {
    setRoleExplanationMessage(persistedState?.roleExplanationMessage ?? null);
  }, [persistedState?.roleExplanationMessage]);

  useEffect(() => {
    if (profile?.isComplete) {
      setReadyMessage("I'm ready");
    }
  }, [profile?.isComplete]);

  // Name is considered submitted if userName exists (regardless of step)
  const hasSubmittedName = !!(profile?.userName);

  useEffect(() => {
    if (!profile) {
      welcomeCompleteRef.current = false;
    }
  }, [profile]);

  // Reset initialization ref when workspace changes or profile is cleared (e.g., after reset)
  useEffect(() => {
    if (!profile) {
      // Reset initialization ref when profile is null so it can initialize again
      initializationAttemptedRef.current = false;
      setIsInitializing(false);
      onLoadingChange?.(false);
    }
  }, [workspaceId, profile, onLoadingChange]);

  useEffect(() => {
    if (!hasSubmittedName) {
      setRoleExplanationMessage(null);
      onPersistedStateChange?.(null);
    }
  }, [hasSubmittedName, onPersistedStateChange]);

  useEffect(() => {
    const isNameSectionActive = !profile || profile.currentStep === 1;
    
    if (!profile || isCompleted || !isNameSectionActive || hasSubmittedName) {
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
  }, [profile, isCompleted, hasSubmittedName]);

  useEffect(() => {
    // Only initialize if we have a workspace and no profile yet
    if (!workspaceId) {
      setIsInitializing(false);
      onLoadingChange?.(false);
      return;
    }
    
    // If profile exists, don't initialize and clear loading
    if (profile) {
      setIsInitializing(false);
      onLoadingChange?.(false);
      return;
    }
    
    // If already attempted initialization, don't retry (unless profile was cleared)
    if (initializationAttemptedRef.current) {
      setIsInitializing(false);
      onLoadingChange?.(false);
      return;
    }

    let isCancelled = false;
    initializationAttemptedRef.current = true;

    const initializeProfile = async () => {
      setIsInitializing(true);
      onLoadingChange?.(true);
      onErrorChange?.(null);

      try {
        // First, try to get existing profiles
        const existingProfilesResponse = await getVeraProfiles(workspaceId);
        if (isCancelled) return;

        const existingProfiles = existingProfilesResponse?.data || [];
        
        // If there's an in-progress profile, check if we should use it or create new
        // After reset, we want to start fresh, so we only reuse if profile is truly at step 1 with no name
        const inProgressProfile = existingProfiles.find((p: VeraProfile) => !p.isComplete);
        if (inProgressProfile) {
          // Only reuse if profile is at step 1 AND has no userName (truly fresh)
          // If it has userName or currentStep > 1, it means user clicked reset, so create new
          if (inProgressProfile.currentStep === 1 && !inProgressProfile.userName) {
            // This is a fresh profile at step 1, use it
            onProfileChange(inProgressProfile);
            setIsInitializing(false);
            onLoadingChange?.(false);
            return;
          }
          
          // Profile exists but is not at step 1 or has a name (user clicked reset)
          // Create a new profile to start fresh
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const uniqueName = `My Voice Identity ${timestamp}`;
          
          const response = await createVeraProfile(workspaceId, uniqueName);
          if (isCancelled) return;
          
          const profileData = response?.data;
          if (!profileData || !profileData.id) {
            throw new Error("Failed to create profile - invalid response");
          }
          
          const newProfile: VeraProfile = {
            ...profileData,
            currentStep: 1,
            status: profileData.status || "active",
          };
          
          onProfileChange(newProfile);
          setIsInitializing(false);
          onLoadingChange?.(false);
          return;
        }

        // Generate a unique name to avoid conflicts
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const uniqueName = `My Voice Identity ${timestamp}`;

        // Create a new profile with unique name
        const response = await createVeraProfile(workspaceId, uniqueName);
        if (isCancelled) return;

        const profileData = response?.data;
        if (!profileData || !profileData.id) {
          throw new Error("Failed to create profile - invalid response");
        }

        const newProfile: VeraProfile = {
          ...profileData,
          currentStep: profileData.currentStep || 1,
          status: profileData.status || "active",
        };

        onProfileChange(newProfile);
        setIsInitializing(false);
        onLoadingChange?.(false);
      } catch (error: any) {
        if (isCancelled) return;
        
        // Handle 409 Conflict - profile already exists
        if (error?.message?.includes("409") || error?.message?.toLowerCase().includes("already exists") || error?.message?.toLowerCase().includes("conflict")) {
          // Try to fetch existing profiles one more time
          try {
            const existingProfilesResponse = await getVeraProfiles(workspaceId);
            if (isCancelled) return;
            const existingProfiles = existingProfilesResponse?.data || [];
            const inProgressProfile = existingProfiles.find((p: VeraProfile) => !p.isComplete);
            if (inProgressProfile) {
              onProfileChange(inProgressProfile);
              return;
            }
            // If no in-progress profile, use the most recent one
            if (existingProfiles.length > 0) {
              const mostRecent = existingProfiles.sort((a: VeraProfile, b: VeraProfile) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              )[0];
              onProfileChange(mostRecent);
              return;
            }
          } catch (fetchError) {
            console.error("Failed to fetch existing profiles:", fetchError);
          }
        }
        
        const message = error?.message || "Failed to initialize Vera profile";
        onErrorChange?.(message);
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        // Reset the ref so user can retry manually
        initializationAttemptedRef.current = false;
      } finally {
        if (!isCancelled) {
          setIsInitializing(false);
          onLoadingChange?.(false);
        } else {
          // If cancelled, still clear loading state
          setIsInitializing(false);
          onLoadingChange?.(false);
        }
      }
    };

    initializeProfile();

    return () => {
      isCancelled = true;
    };
  }, [workspaceId, profile]);

  const handleNameSubmit = useCallback(async () => {
    if (!profile || isSubmitting) return;

    const trimmedName = userName.trim();
    
    if (!trimmedName) {
      toast({
        title: "Name required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedName.length < 2) {
      toast({
        title: "Name too short",
        description: "Name must be at least 2 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    onErrorChange?.(null);

    try {
      // First submit the name
      const response = await submitVeraStep1(profile.id, { userName: trimmedName });
      const message = response?.data?.message || response?.message || "";

      setRoleExplanationMessage(message);
      onPersistedStateChange?.({ roleExplanationMessage: message });

      // Update profile with the name - don't advance step yet, wait for "I'm ready" button
      const updatedProfile: VeraProfile = {
        ...profile,
        userName: trimmedName,
        // Keep currentStep at 1, will advance to 2 when "I'm ready" is clicked
      };

      onProfileChange(updatedProfile);
    } catch (error: any) {
      const message = error?.message || "Failed to submit name";
      onErrorChange?.(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [profile, isSubmitting, userName, toast, onErrorChange, onProfileChange]);

  const handleReadySubmit = async () => {
    if (!profile || isReadySubmitting) return;

    setIsReadySubmitting(true);
    onErrorChange?.(null);

    try {
      // Confirm ready and advance to step 2
      await confirmVeraReady(profile.id);

      const updatedProfile: VeraProfile = {
        ...profile,
        currentStep: 2,
      };

      onProfileChange(updatedProfile);
      
      toast({
        title: "Step 1 completed",
        description: "Welcome and introduction completed.",
      });
    } catch (error: any) {
      const message = error?.message || "Failed to confirm ready";
      onErrorChange?.(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsReadySubmitting(false);
    }
  };

  useEffect(() => {
    if (!onInputHandlersReady) return;
    
    // Only provide input handlers when actively in the name input phase
    // Clear handlers if: name already submitted, step completed, or moved past name input
    const isNameInputPhase = profile && profile.currentStep === 1 && !hasSubmittedName;
    
    if (isNameInputPhase && !isCompleted) {
      const trimmedName = userName.trim();
      const needsHint = trimmedName.length > 0 && trimmedName.length < 2;
      onInputHandlersReady({
        inputValue: userName,
        onInputChange: setUserName,
        onInputSubmit: handleNameSubmit,
        isSubmitting,
        placeholder: "Enter your name",
        validationHint: needsHint ? "Required • minimum 2 characters" : null,
        validationError: needsHint ? null : undefined,
      });
    } else {
      // Clear handlers when not in name input phase
      onInputHandlersReady(null);
    }
  }, [onInputHandlersReady, profile, hasSubmittedName, isCompleted, userName, isSubmitting, handleNameSubmit]);

  // Show loading state while initializing or if no profile yet
  if (isInitializing || !profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-vox-pink" />
      </div>
    );
  }

  const welcomeMessage = "Welcome to Vera — Your Voice Identity System\n\nI'm here to help you define, refine, and stabilize the tone, style, personality, communication principles, and expression of your brand voice.";
  // Show "I'm ready" button when name is submitted but step 1 is not yet completed
  const needsReadyConfirmation = hasSubmittedName && profile.currentStep === 1 && !isCompleted;

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      {showWelcomeMessage && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            {welcomeMessageComplete ? (
              <FormattedChunkedText text={welcomeMessage} />
            ) : (
              <ChunkedText
                text={welcomeMessage}
                onComplete={() => setWelcomeMessageComplete(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* Name Prompt */}
      {showNamePrompt && profile.currentStep === 1 && !hasSubmittedName && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            {namePromptComplete ? (
              <p className="text-gray-800">👉 What's your name?</p>
            ) : (
              <ChunkedText
                text="👉 What's your name?"
                onComplete={() => setNamePromptComplete(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* Role Explanation */}
      {roleExplanationMessage && hasSubmittedName && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <FormattedChunkedText text={roleExplanationMessage} />
          </div>
        </div>
      )}

      {/* Ready Confirmation - Styled like Product Refiner */}
      {needsReadyConfirmation && (
        <div
          className="margo-chat-bubble margo-chat-bubble--user w-full"
          style={{ maxWidth: "100%" }}
        >
          <div className="margo-message-content" style={{ padding: 0 }}>
            <Button
              onClick={handleReadySubmit}
              disabled={isReadySubmitting}
              className="margo-soft-button w-full text-lg font-semibold justify-center"
              style={{ height: "auto" }}
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

      {/* Completed Indicator */}
      {isCompleted && profile.userName && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <p className="text-gray-600 italic">Step 1 completed: Welcome and introduction</p>
          </div>
        </div>
      )}
    </div>
  );
};

