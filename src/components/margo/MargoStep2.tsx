import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAvailableAvaProfiles, submitMargoStep2 } from "@/lib/margo-api";
import type { AvaProfileSummary, MargoBrief } from "@/lib/margo-api";
import { MargoTypingIndicator } from "@/components/margo/MargoTypingIndicator";
import { ChunkedText } from "@/components/margo/ChunkedText";

interface MargoStep2Props {
  workspaceId: string;
  session: MargoBrief;
  isActive: boolean;
  isCompleted: boolean;
  onSessionChange: (session: MargoBrief) => void;
  onError?: (message: string | null) => void;
  isUnlocked?: boolean; // True when previous step (Step 1) is completed
}

export const MargoStep2 = ({ workspaceId, session, isActive, isCompleted, onSessionChange, onError, isUnlocked = false }: MargoStep2Props) => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<AvaProfileSummary[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(session.step2AvaProfileId ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedProfileId(session.step2AvaProfileId ?? "");
  }, [session.step2AvaProfileId]);

  const shouldFetchProfiles = useMemo(() => {
    if (!workspaceId || !session.id) return false;
    // Always fetch if active, completed, unlocked, or if we have a profile ID
    if (isActive || isCompleted || isUnlocked) return true;
    if (session.step2AvaProfileId) return true;
    return false;
  }, [workspaceId, session.id, isActive, isCompleted, isUnlocked, session.step2AvaProfileId]);

  useEffect(() => {
    if (!shouldFetchProfiles) {
      return;
    }

    let isCancelled = false;

    const fetchProfiles = async () => {
      setProfilesLoading(true);
      setProfilesError(null);

      try {
        const response = await getAvailableAvaProfiles(workspaceId);
        if (isCancelled) return;

        const data = response?.data ?? [];
        setProfiles(data);
        onError?.(null);

        const defaultSelection = session.step2AvaProfileId || data[0]?.id || "";
        setSelectedProfileId((prev) => prev || defaultSelection);
      } catch (error: any) {
        if (isCancelled) return;
        const message = error?.message || "Unable to load AVA profiles.";
        setProfilesError(message);
        onError?.(message);
        toast({
          title: "Unable to load AVA profiles",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (isCancelled) return;
        setProfilesLoading(false);
      }
    };

    fetchProfiles();

    return () => {
      isCancelled = true;
    };
  }, [shouldFetchProfiles, workspaceId, session.step2AvaProfileId, toast]);

  const handleConfirm = async () => {
    if (!session.id) {
      toast({
        title: "Session missing",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedProfileId) {
      toast({
        title: "Select a profile",
        description: "Choose an AVA profile to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await submitMargoStep2(session.id, { avaProfileId: selectedProfileId });
      const apiSession = (response?.data ?? null) as Partial<MargoBrief> | null;
      const mergedSession: MargoBrief = {
        ...session,
        ...(apiSession ?? {}),
        step2AvaProfileId: apiSession?.step2AvaProfileId || selectedProfileId,
        step2Completed: apiSession?.step2Completed ?? true,
        currentStep: apiSession?.currentStep && apiSession.currentStep > 3 ? apiSession.currentStep : 3,
        nextAction: apiSession?.nextAction || "start_product_interview",
      };

      onSessionChange(mergedSession);
      if (mergedSession.step2AvaProfileId) {
        setSelectedProfileId(mergedSession.step2AvaProfileId);
      }
      onError?.(null);
      toast({
        title: "Profile locked in",
        description: "MARGO will use this AVA profile for the next steps.",
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to set AVA profile.";
      
      // Check if backend indicates we're already past step 2
      if (errorMessage.includes("current step is 3") || errorMessage.includes("Expected step 2")) {
        // Backend is already at step 3, update session state to match
        const mergedSession: MargoBrief = {
          ...session,
          step2AvaProfileId: session.step2AvaProfileId || selectedProfileId,
          step2Completed: true,
          currentStep: 3,
          nextAction: "start_product_interview",
        };
        
        onSessionChange(mergedSession);
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
        
        onError?.(null);
      } else {
        onError?.(errorMessage);
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


  // Always show if active, completed, or unlocked (ChatGPT-style: all steps remain visible)
  // Only return null if truly not started yet and not unlocked
  if (!isActive && !isCompleted && !isUnlocked && !session.step2AvaProfileId) {
    return null;
  }

  // When completed, show the actual content in read-only mode
  if (isCompleted) {
    return (
      <div className="space-y-4">
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <ChunkedText
              text={
                session.userName
                  ? `Great, ${session.userName}! Select the AVA profile that feels like the perfect match for this evaluation.`
                  : "Great! You're ready for the next step. Select the AVA profile that feels like the perfect match for this evaluation."
              }
              chunkClassName="text-sm"
              isChunk={false}
            />
          </div>
        </div>
        {selectedProfileId && (
          <div className="margo-chat-bubble margo-chat-bubble--user">
            <div className="margo-message-content">
              <ChunkedText
                text={`Let's use the ${profiles.find((profile) => profile.id === selectedProfileId)?.sessionName || "selected profile"}.`}
                chunkClassName="text-sm"
                isChunk={false}
              />
            </div>
          </div>
        )}
        {profiles.length > 0 && (
          <div className="ml-12 space-y-3 mb-4">
            <div className="grid gap-3">
              {profiles.map((profile) => {
                const isSelected = (session.step2AvaProfileId || selectedProfileId) === profile.id;
                return (
                  <div
                    key={profile.id}
                    className={`text-left rounded-lg border p-4 ${
                      isSelected
                        ? "border-gray-400 bg-gray-50"
                        : "border-gray-200 bg-white opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{profile.sessionName || profile.name}</p>
                        <p className="text-sm text-gray-500">
                          Created {new Date(profile.createdAt).toLocaleDateString()} · {profile.userName || "Unnamed"}
                        </p>
                      </div>
                      <div className={`h-4 w-4 rounded-full border ${isSelected ? "border-gray-600 bg-gray-600" : "border-gray-300"}`} />
                    </div>
                    {profile.currentPhase && (
                      <p className="mt-2 text-xs text-gray-500">
                        Status: {profile.currentPhase.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="margo-chat-bubble margo-chat-bubble--bot">
        <div className="margo-message-content">
          <ChunkedText
            text={
              session.userName
                ? `Great, ${session.userName}! Select the AVA profile that feels like the perfect match for this evaluation.`
                : "Great! You're ready for the next step. Select the AVA profile that feels like the perfect match for this evaluation."
            }
            chunkClassName="text-sm"
            isChunk={false}
          />
          {(profilesLoading || isSubmitting) && <MargoTypingIndicator className="text-gray-400" />}
        </div>
      </div>
      {selectedProfileId && (
        <div className="margo-chat-bubble margo-chat-bubble--user">
          <div className="margo-message-content">
            <ChunkedText
              text={`Let's use the ${profiles.find((profile) => profile.id === selectedProfileId)?.sessionName || "selected profile"}.`}
              chunkClassName="text-sm"
              isChunk={false}
            />
          </div>
        </div>
      )}

      {profilesLoading && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="flex items-start gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
              <div>
                <ChunkedText text="Scanning your workspace for the strongest AVA matches…" chunkClassName="text-sm" isChunk={false} />
                <MargoTypingIndicator className="text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {!profilesLoading && profilesError && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content bg-red-50 border-red-200">
            <p className="text-sm text-red-600">{profilesError}</p>
          </div>
        </div>
      )}

      {!profilesLoading && !profilesError && profiles.length === 0 && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <p className="text-sm text-gray-600">No AVA profiles are available for this workspace yet. Create one in AVA Creator to continue.</p>
            <p className="text-sm text-gray-600 mt-1">Once an AVA profile is available, you can connect it here to continue.</p>
          </div>
        </div>
      )}

      {!profilesLoading && !profilesError && profiles.length > 0 && (
        <div className="ml-12 space-y-3 mb-4">
          <div className="grid gap-3">
            {profiles.map((profile) => {
              const isSelected = selectedProfileId === profile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={`text-left rounded-lg border p-4 transition-all ${
                    isSelected
                      ? "border-gray-400 bg-gray-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{profile.sessionName || profile.name}</p>
                      <p className="text-sm text-gray-500">
                        Created {new Date(profile.createdAt).toLocaleDateString()} · {profile.userName || "Unnamed"}
                      </p>
                    </div>
                    <div className={`h-4 w-4 rounded-full border ${isSelected ? "border-gray-600 bg-gray-600" : "border-gray-300"}`} />
                  </div>
                  {profile.currentPhase && (
                    <p className="mt-2 text-xs text-gray-500">
                      Status: {profile.currentPhase.replace(/_/g, " ")}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              type="button"
              disabled={profiles.length === 0 || !selectedProfileId || isSubmitting}
              onClick={handleConfirm}
              className="margo-soft-button w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving selection...
                </>
              ) : (
                "Confirm profile"
              )}
            </Button>
           
          </div>
          <span className="text-sm text-gray-500">
              MARGO will reference this AVA profile for messaging, objections, and emotional insights.
            </span>
        </div>
      )}
    </div>
  );
};

