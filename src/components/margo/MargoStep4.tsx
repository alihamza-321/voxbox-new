import { useEffect, useMemo, useState } from "react";
import { Loader2, PlayCircle, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { submitMargoStep4Ready, submitMargoStep4VideoWatched } from "@/lib/margo-api";
import type { MargoBrief, MargoStep4Assessment } from "@/lib/margo-api";
import { MargoTypingIndicator } from "@/components/margo/MargoTypingIndicator";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { FormattedChunkedText } from "@/components/margo/FormattedChunkedText";

interface MargoStep4Props {
  session: MargoBrief;
  isActive: boolean;
  isCompleted?: boolean;
  onSessionChange: (session: MargoBrief) => void;
  onContinue?: () => void;
  onError?: (message: string | null) => void;
}

const interpretationBands: Array<{ label: string; range: string; description: string; color: string }> = [
  {
    label: "Excellent",
    range: "85 – 100%",
    description: "High resonance. Your offer strongly aligns with the AVA profile across all scoring criteria.",
    color: "text-emerald-600",
  },
  {
    label: "Good",
    range: "70 – 84%",
    description: "Solid fit. Minor improvements could elevate the message and emotional pull.",
    color: "text-vox-orange",
  },
  {
    label: "Moderate",
    range: "50 – 69%",
    description: "Some alignment. Target specific weaknesses to boost product relevancy.",
    color: "text-amber-600",
  },
  {
    label: "Weak",
    range: "0 – 49%",
    description: "Limited resonance. Revisit positioning and core value drivers for this profile.",
    color: "text-red-600",
  },
];

const extractFirstUrlFromMessage = (message?: string | null): string | null => {
  if (!message) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = urlRegex.exec(message);
  return match ? match[0] : null;
};

const parseVimeoUrl = (url: string | null): { videoId: string; hash?: string } | null => {
  if (!url) return null;
  
  // Match Vimeo URL patterns:
  // https://vimeo.com/1131209508/9e459f60a5 (with hash)
  // https://vimeo.com/1131209508 (without hash)
  // https://player.vimeo.com/video/1131209508
  const vimeoRegex = /(?:vimeo\.com|player\.vimeo\.com\/video)\/(\d+)(?:\/([a-f0-9]+))?/i;
  const match = url.match(vimeoRegex);
  
  if (match) {
    return {
      videoId: match[1],
      hash: match[2] || undefined,
    };
  }
  
  return null;
};

const getVimeoEmbedUrl = (videoId: string, hash?: string): string => {
  const baseUrl = `https://player.vimeo.com/video/${videoId}`;
  return hash ? `${baseUrl}?h=${hash}` : baseUrl;
};


export const MargoStep4 = ({ session, isActive, isCompleted = false, onSessionChange, onContinue, onError }: MargoStep4Props) => {
  type Step4ScoreEntry = {
    criteriaId?: number;
    criteriaName: string;
    score: number;
    reasoning: string;
  };

  const { toast } = useToast();
  const [assessment, setAssessment] = useState<MargoStep4Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [instructionMessage, setInstructionMessage] = useState<string | null>(null);
  const [instructionAction, setInstructionAction] = useState<string | null>(null);
  const [instructionVideoUrl, setInstructionVideoUrl] = useState<string | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [watchMessage, setWatchMessage] = useState("I've watched the video");
  const [videoAcknowledgementMessage, setVideoAcknowledgementMessage] = useState<string | null>(null);
  const [videoScores, setVideoScores] = useState<Step4ScoreEntry[]>([]);
  const [videoSummary, setVideoSummary] = useState<{ totalScore?: number; interpretation?: string | null }>({});
  const [hasHydratedState, setHasHydratedState] = useState(false);
  const [isShowVideoPlayer, setIsShowVideoPlayer] = useState(false);
  
  // Progressive reveal states for smooth transitions
  const [shownInitialMessage, setShownInitialMessage] = useState(false);
  const [initialMessageComplete, setInitialMessageComplete] = useState(false);
  const [shownInstructionMessage, setShownInstructionMessage] = useState(false);
  const [instructionMessageComplete, setInstructionMessageComplete] = useState(false);
  const [shownVideoAcknowledgement, setShownVideoAcknowledgement] = useState(false);
  const [videoAcknowledgementComplete, setVideoAcknowledgementComplete] = useState(false);
  const [shownAssessment, setShownAssessment] = useState(false);

  const briefId = session.id;

  const storageKey = useMemo(() => {
    if (!briefId) {
      return null;
    }
    return `margo-step4-${briefId}`;
  }, [briefId]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      if (!hasHydratedState) {
        setHasHydratedState(true);
      }
      return;
    }

    if (hasHydratedState) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          hasRequested?: boolean;
          instructionMessage?: string | null;
          instructionAction?: string | null;
          instructionVideoUrl?: string | null;
          assessment?: MargoStep4Assessment | null;
          videoAcknowledgementMessage?: string | null;
          videoScores?: Step4ScoreEntry[];
          videoSummary?: { totalScore?: number; interpretation?: string | null };
          videoReady?: boolean;
          watchMessage?: string;
        };

        setHasRequested(Boolean(parsed.hasRequested));
        setInstructionMessage(parsed.instructionMessage ?? null);
        setInstructionAction(parsed.instructionAction ?? null);
        setInstructionVideoUrl(parsed.instructionVideoUrl ?? null);
        setAssessment(parsed.assessment ?? null);
        setVideoAcknowledgementMessage(parsed.videoAcknowledgementMessage ?? null);
        setVideoScores(Array.isArray(parsed.videoScores) ? parsed.videoScores : []);
        setVideoSummary(parsed.videoSummary ?? {});
        setVideoReady(Boolean(parsed.videoReady));
        setWatchMessage(parsed.watchMessage ?? "I've watched the video");
        
        // If persisted, mark all as shown and complete (no animation)
        if (parsed.hasRequested || parsed.assessment || parsed.instructionMessage) {
          setShownInitialMessage(true);
          setInitialMessageComplete(true);
          if (parsed.instructionMessage) {
            setShownInstructionMessage(true);
            setInstructionMessageComplete(true);
          }
          if (parsed.videoAcknowledgementMessage) {
            setShownVideoAcknowledgement(true);
            setVideoAcknowledgementComplete(true);
          }
          if (parsed.assessment) {
            setShownAssessment(true);
          }
        }
      }
    } catch (error) {
      console.error("Failed to hydrate Step 4 state:", error);
      try {
        window.localStorage.removeItem(storageKey);
      } catch (removeError) {
        console.error("Failed to clear corrupted Step 4 state:", removeError);
      }
    } finally {
      setHasHydratedState(true);
    }
  }, [storageKey, hasHydratedState]);

  // Progressive reveal: Show initial message
  useEffect(() => {
    if (isCompleted || hasRequested || assessment) {
      setShownInitialMessage(true);
      setInitialMessageComplete(true);
      return;
    }

    if (!hasHydratedState || !isActive) return;

    // Show initial message after a short delay
    const timer = setTimeout(() => {
      setShownInitialMessage(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [hasHydratedState, isActive, isCompleted, hasRequested, assessment]);

  // Progressive reveal: Show instruction message
  useEffect(() => {
    if (isCompleted) {
      if (instructionMessage) {
        setShownInstructionMessage(true);
        setInstructionMessageComplete(true);
      }
      return;
    }

    if (!instructionMessage || !hasHydratedState) return;

    // Check if persisted (already shown before)
    const isPersisted = hasRequested && instructionMessage;
    if (isPersisted) {
      setShownInstructionMessage(true);
      setInstructionMessageComplete(true);
    } else {
      // New message - show with delay
      const timer = setTimeout(() => {
        setShownInstructionMessage(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [instructionMessage, hasHydratedState, isCompleted, hasRequested]);

  // Progressive reveal: Show video acknowledgement
  useEffect(() => {
    if (isCompleted) {
      if (videoAcknowledgementMessage) {
        setShownVideoAcknowledgement(true);
        setVideoAcknowledgementComplete(true);
      }
      return;
    }

    if (!videoAcknowledgementMessage || !hasHydratedState) return;

    // Check if persisted
    const isPersisted = hasRequested && videoAcknowledgementMessage;
    if (isPersisted) {
      setShownVideoAcknowledgement(true);
      setVideoAcknowledgementComplete(true);
    } else {
      // New message - show after instruction completes
      if (instructionMessageComplete) {
        const timer = setTimeout(() => {
          setShownVideoAcknowledgement(true);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [videoAcknowledgementMessage, hasHydratedState, isCompleted, hasRequested, instructionMessageComplete]);

  // Progressive reveal: Show assessment
  useEffect(() => {
    if (isCompleted) {
      if (assessment) {
        setShownAssessment(true);
      }
      return;
    }

    if (!assessment || !hasHydratedState) return;

    // Check if persisted
    const isPersisted = hasRequested && assessment;
    if (isPersisted) {
      setShownAssessment(true);
    } else {
      // New assessment - show after video acknowledgement completes or immediately if no acknowledgement
      const delay = videoAcknowledgementMessage ? (videoAcknowledgementComplete ? 300 : 0) : 300;
      if (delay === 0 && !videoAcknowledgementMessage) {
        const timer = setTimeout(() => {
          setShownAssessment(true);
        }, 300);
        return () => clearTimeout(timer);
      } else if (videoAcknowledgementComplete || !videoAcknowledgementMessage) {
        const timer = setTimeout(() => {
          setShownAssessment(true);
        }, delay);
        return () => clearTimeout(timer);
      }
    }
  }, [assessment, hasHydratedState, isCompleted, hasRequested, videoAcknowledgementMessage, videoAcknowledgementComplete]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined" || !hasHydratedState) {
      return;
    }

    const snapshot = {
      hasRequested,
      instructionMessage,
      instructionAction,
      instructionVideoUrl,
      assessment,
      videoAcknowledgementMessage,
      videoScores,
      videoSummary,
      videoReady,
      watchMessage,
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch (error) {
      console.error("Failed to persist Step 4 state:", error);
    }
  }, [
    storageKey,
    hasHydratedState,
    hasRequested,
    instructionMessage,
    instructionAction,
    instructionVideoUrl,
    assessment,
    videoAcknowledgementMessage,
    videoScores,
    videoSummary,
    videoReady,
    watchMessage,
  ]);

  const handleGenerateAssessment = async () => {
    if (!briefId) return;

    try {
      setIsLoading(true);
      setAssessment(null);
      setInstructionMessage(null);
      setInstructionAction(null);
      setInstructionVideoUrl(null);
      setVideoAcknowledgementMessage(null);
      setVideoScores([]);
      setVideoSummary({});

      const response = await submitMargoStep4Ready(briefId, { message: "yes" });
      const payload = response?.data ?? {};
      const data = (payload?.assessment ?? null) as MargoStep4Assessment | null;
      const nextAction = (payload?.nextAction ?? session.nextAction ?? "") as string;
      const message = (payload?.message ?? response?.message ?? "") as string;
      const videoUrl = (payload?.videoUrl ?? null) as string | null;

      onSessionChange({
        ...session,
        currentStep: Math.max(session.currentStep ?? 3, 4),
        nextAction: nextAction || session.nextAction || "step4_ready",
      });

      if (data) {
        setAssessment(data);
        setInstructionMessage(null);
        setInstructionAction(null);
        setInstructionVideoUrl(data.videoUrl ?? null);
        // Trigger assessment reveal
        setTimeout(() => {
          setShownAssessment(true);
        }, 300);
        onError?.(null);
      } else {
        const instructionMsg = message || "Please confirm once you've watched the video to proceed.";
        setInstructionMessage(instructionMsg);
        setInstructionAction(nextAction || null);
        setInstructionVideoUrl(videoUrl ?? extractFirstUrlFromMessage(message));
        setWatchMessage("I've watched the video");
        // Trigger instruction message reveal
        setTimeout(() => {
          setShownInstructionMessage(true);
        }, 300);
        onError?.(null);
      }

      setHasRequested(true);
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to generate relevancy assessment.";
      
      // Check if backend indicates we're already past step 4
      if (errorMessage.includes("current step is 5") || errorMessage.includes("Expected step 4")) {
        // Backend is already at step 5, update session state to match
        onSessionChange({
          ...session,
          currentStep: 5,
          nextAction: "step5_ready",
        });
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
        
        onError?.(null);
      } else {
        toast({
          title: "Assessment failed",
          description: errorMessage,
          variant: "destructive",
        });
        onError?.(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const percentage = useMemo(() => assessment?.percentage ?? 0, [assessment?.percentage]);
  const band = useMemo(() => assessment?.band ?? "", [assessment?.band]);

  const currentBandDetails = useMemo(() => {
    if (!band) return null;
    return interpretationBands.find((entry) => entry.label.toLowerCase() === band.toLowerCase()) ?? null;
  }, [band]);

  const handleWatchedVideo = async () => {
    if (!briefId) return;

    try {
      setIsAcknowledging(true);
      const trimmedMessage = watchMessage.trim() || "I've watched the video";
      const response = await submitMargoStep4VideoWatched(briefId, { message: trimmedMessage });
      const payload = response?.data ?? {};
      const rawAssessment = (payload?.assessment ?? null) as MargoStep4Assessment | null;
      const acknowledgement =
        payload?.message ??
        response?.message ??
        (payload as Record<string, any>)?.acknowledgement ??
        (response as Record<string, any>)?.acknowledgement ??
        null;
      const scores = Array.isArray(payload?.scores) ? (payload.scores as Step4ScoreEntry[]) : [];
      const totalScoreValue =
        typeof payload?.totalScore === "number"
          ? payload.totalScore
          : typeof rawAssessment?.totalScore === "number"
            ? rawAssessment.totalScore
            : undefined;
      const percentageValue =
        typeof payload?.percentage === "number"
          ? payload.percentage
          : typeof rawAssessment?.percentage === "number"
            ? rawAssessment.percentage
            : totalScoreValue;
      const interpretationValue =
        (payload?.interpretation as string | undefined) ??
        rawAssessment?.band ??
        (typeof payload?.band === "string" ? payload.band : undefined);
      const fallbackAssessment: MargoStep4Assessment | null =
        rawAssessment ??
        (scores.length
          ? {
              totalScore: totalScoreValue ?? 0,
              percentage: percentageValue ?? 0,
              band: interpretationValue ?? "Moderate",
              criteriaScores: scores.map((entry, index) => ({
                criteria: entry.criteriaName ?? `Criteria ${entry.criteriaId ?? index + 1}`,
                score: entry.score,
                reasoning: entry.reasoning,
              })),
              videoUrl: (payload?.videoUrl as string | null | undefined) ?? null,
            }
          : null);

      onSessionChange({
        ...session,
        currentStep: Math.max(session.currentStep ?? 3, 4),
        nextAction: (payload?.nextAction as string | undefined) || "prepare_step4",
      });

      const newAssessment = fallbackAssessment ?? assessment;
      setAssessment(newAssessment);
      // Don't clear instructionMessage - keep it in history for persistence
      // setInstructionMessage(null);
      setInstructionAction(null);
      // Keep instructionVideoUrl for history as well
      // setInstructionVideoUrl((fallbackAssessment?.videoUrl ?? payload?.videoUrl ?? null) as string | null);
      setVideoAcknowledgementMessage(acknowledgement || null);
      setVideoScores(scores);
      setVideoSummary({
        totalScore: totalScoreValue ?? fallbackAssessment?.totalScore ?? fallbackAssessment?.percentage ?? undefined,
        interpretation: interpretationValue ?? null,
      });
      setWatchMessage("I've watched the video");
      
      // Trigger video acknowledgement reveal
      if (acknowledgement) {
        setTimeout(() => {
          setShownVideoAcknowledgement(true);
        }, 200);
      }
      
      // Trigger assessment reveal after acknowledgement
      if (newAssessment) {
        setTimeout(() => {
          setShownAssessment(true);
        }, acknowledgement ? 500 : 300);
      }
      
      toast({
        title: "Great! Generating your score now.",
        description: "Here's how your product resonates with this AVA profile.",
      });
      onError?.(null);
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to continue with scoring. Please try again.";
      
      // Check if backend indicates we're already past step 4
      if (errorMessage.includes("current step is 5") || errorMessage.includes("Expected step 4")) {
        // Backend is already at step 5, update session state to match
        onSessionChange({
          ...session,
          currentStep: 5,
          nextAction: "step5_ready",
        });
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
        
        // Clear the button state by marking as completed
        setAssessment(null);
        onError?.(null);
      } else {
        toast({
          title: "Action required",
          description: errorMessage,
          variant: "destructive",
        });
        onError?.(errorMessage);
      }
    } finally {
      setIsAcknowledging(false);
    }
  };

  const isInitialMessagePersisted = hasRequested || assessment || instructionMessage;
  const shouldAnimateInitialMessage = shownInitialMessage && !isInitialMessagePersisted && !initialMessageComplete;

  return (
    <div className="space-y-4">
      {!hasRequested && shownInitialMessage && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownInitialMessage ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">
            {isInitialMessagePersisted || isCompleted ? (
              <p className="text-sm">Ready to see how your offer scores? I'll analyze your responses and compute the full relevancy model.</p>
            ) : (
              <ChunkedText
                text="Ready to see how your offer scores? I'll analyze your responses and compute the full relevancy model."
                chunkClassName="text-sm"
                animation="typewriter"
                isChunk={true}
                minChunkLength={60}
                staggerMs={30}
                onComplete={() => {
                  setInitialMessageComplete(true);
                }}
              />
            )}
            {shouldAnimateInitialMessage && <MargoTypingIndicator className="text-gray-400" />}
            {isLoading && <MargoTypingIndicator className="text-gray-400" />}
          </div>
        </div>
      )}

      {!hasRequested && initialMessageComplete&&(
        <div className="ml-4 ">
          <div className="space-y-3 mb-4 flex flex-col">
          <Button
            type="button"
            onClick={handleGenerateAssessment}
            disabled={isLoading}
            className="margo-soft-button w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing assessment…
              </>
            ) : (
              "Ready"
            )}
          </Button>
       
          </div>
          <p className="text-xs text-gray-500">
            This takes a moment while I evaluate all ten scoring criteria.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="flex items-start gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
              <div>
                <ChunkedText
                  text="Crunching every signal from your interview responses…"
                  chunkClassName="text-sm"
                  animation="typewriter"
                  isChunk={false}
                  minChunkLength={50}
                  staggerMs={200}
                />
                <MargoTypingIndicator className="text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {instructionMessage && shownInstructionMessage && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownInstructionMessage ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">
            <FormattedChunkedText
              text={instructionMessage}
              chunkClassName="text-sm"
              animation="typewriter"
              isChunk={!!(instructionMessage && instructionAction === "watch_video_step4" && !assessment && instructionMessageComplete) }
              staggerMs={30}
              minChunkLength={100}
              onComplete={() => {
                setIsShowVideoPlayer(true);              
                setInstructionMessageComplete(true);
              }}
            />
            {!instructionMessageComplete && !isCompleted && <MargoTypingIndicator className="text-gray-400" />}
          </div>
        </div>
      )}

      {instructionMessage && instructionVideoUrl && instructionMessageComplete && isShowVideoPlayer&&(
        <div className="ml-4 mb-4">
          {(() => {
            const vimeoData = parseVimeoUrl(instructionVideoUrl);
            if (vimeoData) {
              const embedUrl = getVimeoEmbedUrl(vimeoData.videoId, vimeoData.hash);
              return (
                <div className="w-[85%] rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <div className="relative" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={embedUrl}
                      className="absolute top-0 left-0 w-full h-full"
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      title="Vimeo video player"
                    />
                  </div>
                </div>
              );
            }
            // Fallback to link if not a Vimeo URL
            return (
              <a
                href={instructionVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="margo-soft-button margo-soft-button--outline inline-flex items-center gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                Watch explainer video
              </a>
            );
          })()}
        </div>
      )}

      {instructionMessage && instructionAction === "watch_video_step4" && !assessment && instructionMessageComplete && isShowVideoPlayer&&(
        <div className="ml-4 space-y-3 mb-4 flex flex-col items-center">

          <Button
            type="button"
            onClick={handleWatchedVideo}
            disabled={isAcknowledging}
            className="margo-soft-button w-full"
          >
            {isAcknowledging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Notifying MARGO…
              </>
            ) : (
              "Confirm I watched the video"
            )}
          </Button>
        </div>
      )}

      {videoAcknowledgementMessage && shownVideoAcknowledgement && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownVideoAcknowledgement ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">
            {isCompleted || videoAcknowledgementComplete ? (
              <p className="text-sm">{videoAcknowledgementMessage}</p>
            ) : (
              <ChunkedText
                text={videoAcknowledgementMessage}
                chunkClassName="text-sm"
                animation="typewriter"
                isChunk={isCompleted || videoAcknowledgementComplete?false:true}
                minChunkLength={60}
                staggerMs={30}
                onComplete={() => {
                  setVideoAcknowledgementComplete(true);
                }}
              />
            )}
            {!videoAcknowledgementComplete && !isCompleted && <MargoTypingIndicator className="text-gray-400" />}
          </div>
        </div>
      )}

      {videoScores.length > 0 && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">Assessment Summary</p>
                  {typeof videoSummary.totalScore === "number" && (
                    <p className="mt-1 text-lg font-semibold text-gray-900">Total Score: {videoSummary.totalScore}</p>
                  )}
                </div>
                {videoSummary.interpretation && (
                  <p className="max-w-md text-sm text-gray-600 sm:text-right">{videoSummary.interpretation}</p>
                )}
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="grid grid-cols-12 gap-0 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-600">
                  <div className="col-span-4">Criteria</div>
                  <div className="col-span-2 text-center">Score</div>
                  <div className="col-span-6">Reasoning</div>
                </div>
                <div className="divide-y divide-gray-100 text-sm text-gray-700">
                  {videoScores.map((entry) => (
                    <div key={entry.criteriaId} className="grid grid-cols-12 gap-0 px-4 py-3">
                      <div className="col-span-4 text-gray-900">{entry.criteriaName}</div>
                      <div className="col-span-2 text-center text-gray-900">{entry.score}</div>
                      <div className="col-span-6 leading-6">{entry.reasoning}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {assessment?.videoUrl && !videoReady && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-gray-600" />
              <p className="text-sm text-gray-600">Playing your assessment overview…</p>
            </div>
            <video
              className="h-0 w-full"
              src={assessment.videoUrl}
              autoPlay
              muted
              onEnded={() => setVideoReady(true)}
              onCanPlay={() => setVideoReady(true)}
            />
          </div>
        </div>
      )}

      {assessment && shownAssessment && (
        <>
          <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownAssessment ? 'opacity-100' : 'opacity-0'}`}>
            <div className="margo-message-content">
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Total Relevance</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">{percentage.toFixed(0)}%</p>
                    <p className="text-sm text-gray-600">
                      Based on weighted scoring across positioning, emotional pull, message clarity, and value delivery.
                    </p>
                  </div>
                  <div className="flex min-w-[160px] flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <TrendingUp className="h-4 w-4 text-gray-600" />
                      Interpretation
                    </div>
                    <div className={`text-base font-semibold ${currentBandDetails?.color ?? "text-gray-900"}`}>
                      {(currentBandDetails?.label ?? band) || "Pending"}
                    </div>
                    <p className="text-xs text-gray-600">
                      {currentBandDetails?.description ?? "Your assessment will appear once scoring completes."}
                    </p>
                  </div>
                </div>
                <Progress
                  value={percentage}
                  className="h-2 rounded-full border border-gray-200 bg-gray-100"
                />
              </div>
            </div>
          </div>

          <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownAssessment ? 'opacity-100' : 'opacity-0'}`}>
            <div className="margo-message-content">
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="grid grid-cols-12 gap-0 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-600">
                  <div className="col-span-6">Criteria</div>
                  <div className="col-span-2 text-center">Score</div>
                  <div className="col-span-4">Reasoning</div>
                </div>
                <div className="divide-y divide-gray-100 text-sm text-gray-700">
                  {assessment.criteriaScores?.map((item) => (
                    <div key={item.criteria} className="grid grid-cols-12 gap-0 px-4 py-3">
                      <div className="col-span-6 text-gray-900">{item.criteria}</div>
                      <div className="col-span-2 text-center text-gray-900">{item.score.toFixed(1)}</div>
                      <div className="col-span-4 leading-6">{item.reasoning}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownAssessment ? 'opacity-100' : 'opacity-0'}`}>
            <div className="margo-message-content">
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500">Relevancy Bands</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {interpretationBands.map((entry) => (
                    <div key={entry.label} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-semibold ${entry.color}`}>{entry.label}</p>
                        <span className="text-xs font-semibold text-gray-500">{entry.range}</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-600">{entry.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {!isCompleted && (
            <div className="ml-4">
              <div className="space-y-3 mb-4 flex flex-col items-center">
              <Button
                type="button"
                disabled={!assessment || isLoading || isCompleted}
                onClick={onContinue}
                className="margo-soft-button w-full"
              >
                Continue to Step 5
              </Button>
             
              </div>
              <p className="text-xs text-gray-500">
                MARGO uses internal weighting to balance strategic positioning, emotional resonance, and offer clarity for this AVA profile.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MargoStep4;

