import { useEffect, useMemo, useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  submitMargoStep5Ready,
  submitMargoStep5VideoWatched,
  type MargoBrief,
} from "@/lib/margo-api";
import { MargoTypingIndicator } from "@/components/margo/MargoTypingIndicator";
import { ChunkedText } from "@/components/margo/ChunkedText";
import FormattedChunkedText from "./FormattedChunkedText";

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

interface MargoStep5Props {
  session: MargoBrief;
  isActive: boolean;
  isCompleted?: boolean;
  onSessionChange: (session: MargoBrief) => void;
  onContinue?: () => void;
  onError?: (message: string | null) => void;
}

const convertMarkdownToPlainText = (input?: string | null) => {
  if (!input) {
    return "";
  }

  return (
    input
      .replace(/```[\s\S]*?```/g, (codeBlock) => codeBlock.replace(/```/g, ""))
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      .replace(/~~(.*?)~~/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*>+\s?/gm, "")
      .replace(/!\[[^\]]*\]\((.*?)\)/g, "$1")
      .replace(/\[([^\]]+)\]\((.*?)\)/g, "$1")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
};

const parseInstructionMessage = (message: string | null | undefined) => {
  if (!message) {
    return { cleanedMessage: null, videoUrl: null };
  }

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let videoUrl: string | null = null;
  const cleanedMessage = message
    .split("\n")
    .map((line) => {
      if (urlRegex.test(line)) {
        urlRegex.lastIndex = 0;
        const match = urlRegex.exec(line);
        if (match && !videoUrl) {
          videoUrl = match[0];
        }
        return line.replace(urlRegex, "").trim();
      }
      return line;
    })
    .filter((line, index, array) => {
      if (!line.trim()) {
        const prev = array[index - 1];
        return prev && prev.trim();
      }
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    cleanedMessage: cleanedMessage || null,
    videoUrl,
  };
};

export const MargoStep5 = ({ session, isActive, isCompleted = false, onSessionChange, onContinue, onError }: MargoStep5Props) => {
  type Step5RecommendationEntry = {
    negativeFactor: string;
    suggestedEnhancement: string;
    keyConsiderations: string;
  };

  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [instructionMessage, setInstructionMessage] = useState<string | null>(null);
  const [instructionVideoUrl, setInstructionVideoUrl] = useState<string | null>(null);
  const [isAcknowledgingVideo, setIsAcknowledgingVideo] = useState(false);
  const [videoAcknowledgementMessage, setVideoAcknowledgementMessage] = useState<string | null>(null);
  const [tableRecommendations, setTableRecommendations] = useState<Step5RecommendationEntry[]>([]);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  const [readyResponseMessage, setReadyResponseMessage] = useState<string | null>(null);
  const [hasRequested, setHasRequested] = useState(false);
  const [hasHydratedState, setHasHydratedState] = useState(false);
  const [isShowVideoPlayer, setIsShowVideoPlayer] = useState(false);
  const [isShowTransitionMessage, setIsShowTransitionMessage] = useState(false);
  
  // Progressive reveal states for smooth transitions
  const [shownInitialMessage, setShownInitialMessage] = useState(false);
  const [initialMessageComplete, setInitialMessageComplete] = useState(false);
  const [shownInstructionMessage, setShownInstructionMessage] = useState(false);
  const [instructionMessageComplete, setInstructionMessageComplete] = useState(false);
  const [shownVideoAcknowledgement, setShownVideoAcknowledgement] = useState(false);
  const [videoAcknowledgementComplete, setVideoAcknowledgementComplete] = useState(false);
  const [shownTransitionMessage, setShownTransitionMessage] = useState(false);

  const briefId = session.id;

  const storageKey = useMemo(() => {
    if (!briefId) {
      return null;
    }
    return `margo-step5-${briefId}`;
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
          instructionVideoUrl?: string | null;
          videoAcknowledgementMessage?: string | null;
          tableRecommendations?: Step5RecommendationEntry[];
          transitionMessage?: string | null;
          readyResponseMessage?: string | null;
          hasGenerated?: boolean;
        };

        setHasRequested(Boolean(parsed.hasRequested));
        setInstructionMessage(parsed.instructionMessage ?? null);
        setInstructionVideoUrl(parsed.instructionVideoUrl ?? null);
        setVideoAcknowledgementMessage(parsed.videoAcknowledgementMessage ?? null);
        setTableRecommendations(Array.isArray(parsed.tableRecommendations) ? parsed.tableRecommendations : []);
        setTransitionMessage(parsed.transitionMessage ?? null);
        setReadyResponseMessage(parsed.readyResponseMessage ?? null);
        setHasGenerated(Boolean(parsed.hasGenerated));
        
        // If persisted, mark all as shown and complete (no animation)
        if (parsed.hasRequested || parsed.instructionMessage || parsed.tableRecommendations?.length) {
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
          if (parsed.transitionMessage) {
            setShownTransitionMessage(true);
          }
        }
      }
    } catch (error) {
      console.error("Failed to hydrate Step 5 state:", error);
      try {
        window.localStorage.removeItem(storageKey);
      } catch (removeError) {
        console.error("Failed to clear corrupted Step 5 state:", removeError);
      }
    } finally {
      setHasHydratedState(true);
    }
  }, [storageKey, hasHydratedState]);

  // Progressive reveal: Show initial message
  useEffect(() => {
    if (isCompleted || hasRequested || instructionMessage) {
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
  }, [hasHydratedState, isActive, isCompleted, hasRequested, instructionMessage]);

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

  // Progressive reveal: Show transition message
  useEffect(() => {
    if (isCompleted) {
      if (transitionMessage) {
        setShownTransitionMessage(true);
      }
      return;
    }

    if (!transitionMessage || !hasHydratedState) return;

    // Check if persisted
    const isPersisted = hasRequested && transitionMessage;
    if (isPersisted) {
      setShownTransitionMessage(true);
    } else {
      // New message - show after video acknowledgement completes or immediately if no acknowledgement
      const delay = videoAcknowledgementMessage ? (videoAcknowledgementComplete ? 300 : 0) : 300;
      if (delay === 0 && !videoAcknowledgementMessage) {
        const timer = setTimeout(() => {
          setShownTransitionMessage(true);
        }, 300);
        return () => clearTimeout(timer);
      } else if (videoAcknowledgementComplete || !videoAcknowledgementMessage) {
        const timer = setTimeout(() => {
          setShownTransitionMessage(true);
        }, delay);
        return () => clearTimeout(timer);
      }
    }
  }, [transitionMessage, hasHydratedState, isCompleted, hasRequested, videoAcknowledgementMessage, videoAcknowledgementComplete]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined" || !hasHydratedState) {
      return;
    }

    const snapshot = {
      hasRequested,
      instructionMessage,
      instructionVideoUrl,
      videoAcknowledgementMessage,
      tableRecommendations,
      transitionMessage,
      readyResponseMessage,
      hasGenerated,
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch (error) {
      console.error("Failed to persist Step 5 state:", error);
    }
  }, [
    storageKey,
    hasHydratedState,
    hasRequested,
    instructionMessage,
    instructionVideoUrl,
    videoAcknowledgementMessage,
    tableRecommendations,
    transitionMessage,
    readyResponseMessage,
    hasGenerated,
  ]);

  const handleGenerateRecommendations = async () => {
    if (!briefId) return;

    try {
      setIsLoading(true);
      setHasRequested(true);
      const response = await submitMargoStep5Ready(briefId, { message: "yes" });
      const payload = response?.data ?? {};
      const recs = Array.isArray(payload?.recommendations) ? (payload?.recommendations as Array<Record<string, any>>) : [];
      const nextAction = (payload?.nextAction ?? session.nextAction ?? "") as string;
      const rawMessage = payload?.message ?? "";
      const { cleanedMessage, videoUrl } = parseInstructionMessage(rawMessage);

      onSessionChange({
        ...session,
        currentStep: Math.max(session.currentStep ?? 4, 5),
        nextAction: nextAction || "step5_recommendations",
      });

      setInstructionMessage(cleanedMessage ? convertMarkdownToPlainText(cleanedMessage) : null);
      setInstructionVideoUrl(videoUrl);
      setVideoAcknowledgementMessage(null);
      setTableRecommendations([]);
      setTransitionMessage(null);
      setIsAcknowledgingVideo(false);
      setReadyResponseMessage(rawMessage || null);
      
      // Trigger instruction message reveal
      if (cleanedMessage) {
        setTimeout(() => {
          setShownInstructionMessage(true);
        }, 300);
      }
      
      onError?.(null);

      if (!recs.length && !rawMessage) {
        toast({
          title: "No adjustments needed",
          description: rawMessage || "All criteria scored above the enhancement threshold.",
        });
      }

      setHasGenerated(recs.length > 0);
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to generate improvement recommendations.";
      
      // Check if backend indicates we're already past step 5
      if (errorMessage.includes("current step is 6") || errorMessage.includes("Expected step 5")) {
        // Backend is already at step 6, update session state to match
        onSessionChange({
          ...session,
          currentStep: 6,
          nextAction: "step6_ready",
        });
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
        
        onError?.(null);
      } else {
        toast({
          title: "Recommendation generation failed",
          description: errorMessage,
          variant: "destructive",
        });
        onError?.(errorMessage);
        setHasRequested(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleWatchVideoAcknowledged = async () => {
    if (!briefId) return;

    try {
      setIsAcknowledgingVideo(true);
      const response = await submitMargoStep5VideoWatched(briefId, { message: "I've watched the video" });
      if(response?.data){

      const payload = response?.data ?? {};
      const ackMessage = payload?.message ?? response?.message ?? null;
      const recs = (payload?.recommendations as Step5RecommendationEntry[] | undefined) ?? [];
      const transition = (payload?.transitionMessage as string | undefined) ?? null;

      onSessionChange({
        ...session,
        currentStep: Math.max(session.currentStep ?? 4, 5),
        nextAction: (payload?.nextAction as string | undefined) || "view_recommendations",
      });

      // Don't clear instructionMessage - keep it in history for persistence
      // setInstructionMessage(null);
      // Keep instructionVideoUrl for history as well
      // setInstructionVideoUrl(null);
      setVideoAcknowledgementMessage(
        ackMessage ? convertMarkdownToPlainText(ackMessage) : null
      );
      setTableRecommendations(recs);
      setTransitionMessage(transition ? convertMarkdownToPlainText(transition) : null);
      setHasGenerated(recs.length > 0);
      
      // Trigger video acknowledgement reveal
      if (ackMessage) {
        setTimeout(() => {
          setShownVideoAcknowledgement(true);
        }, 200);
      }
      
      // Trigger transition message reveal after acknowledgement
      if (transition) {
        setTimeout(() => {
          setShownTransitionMessage(true);
        }, ackMessage ? 500 : 300);
      }
      
      onError?.(null);
    }
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to acknowledge the video at this time.";
      
      // Check if backend indicates we're already past step 5
      if (errorMessage.includes("current step is 6") || errorMessage.includes("Expected step 5")) {
        // Backend is already at step 6, update session state to match
        onSessionChange({
          ...session,
          currentStep: 6,
          nextAction: "step6_ready",
        });
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
        
        // Clear the button state by marking as completed
        setTableRecommendations([]);
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
      setIsAcknowledgingVideo(false);
    }
  };

  const handleContinue = async () => {
    if (!briefId || isCompleted) return;

    setIsSaving(true);

    const nextAction = "step6_ready";

    onSessionChange({
      ...session,
      currentStep: Math.max(session.currentStep ?? 5, 6),
      nextAction,
    });

    onContinue?.();
    setIsSaving(false);
  };

  const isInitialMessagePersisted = hasRequested || instructionMessage;
  const shouldAnimateInitialMessage = shownInitialMessage && !isInitialMessagePersisted && !initialMessageComplete;

  return (
    <div className="space-y-4">
      {!hasRequested && shownInitialMessage && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownInitialMessage ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">
            {/* {isInitialMessagePersisted || isCompleted ? (
              <p className="text-sm">Want tailored recommendations for improvement? I'll surface the precise levers to tighten before you go to market.</p>
            ) : ( */}
              <ChunkedText
                text="Want tailored recommendations for improvement? I'll surface the precise levers to tighten before you go to market."
                chunkClassName="text-sm"
                animation="typewriter"
                isChunk={isInitialMessagePersisted||isCompleted ?false:true}
                minChunkLength={60}
                staggerMs={30}
                onComplete={() => {
                  setInitialMessageComplete(true);
                }}
              />
            {/* )} */}
            {shouldAnimateInitialMessage && <MargoTypingIndicator className="text-gray-400" />}
            {isLoading && <MargoTypingIndicator className="text-gray-400" />}
          </div>
        </div>
      )}

      {!hasRequested && initialMessageComplete && (
        <div className="ml-4 mb-4 flex flex-col items-center">
          <Button
            type="button"
            onClick={handleGenerateRecommendations}
            disabled={isLoading}
            className="margo-soft-button w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning for opportunities…
              </>
            ) : (
              "Ready"
            )}
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="flex items-start gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
              <div>
                <span>Reviewing the scoring layers to pinpoint your sharpest optimization moves…</span>
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
              isChunk={instructionMessage && !tableRecommendations.length?true:false}
              staggerMs={30}
              minChunkLength={100}
              onComplete={() => {
                setIsShowVideoPlayer(true);              
                setInstructionMessageComplete(true);
              }}
            />

            {!instructionMessageComplete && !isCompleted && <MargoTypingIndicator className="text-gray-400" />}
            {/* {(isAcknowledgingVideo || isLoading) && <MargoTypingIndicator className="text-gray-400" />} */}
          </div>
        </div>
      )}

      {instructionMessage && instructionVideoUrl && isShowVideoPlayer&&(
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
              <Button
                type="button"
                onClick={() => window.open(instructionVideoUrl, "_blank", "noopener")}
                variant="outline"
                className="margo-soft-button margo-soft-button--outline inline-flex items-center gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                Watch explainer video
              </Button>
            );
          })()}
        </div>
      )}

      {instructionMessage && !tableRecommendations.length && isShowVideoPlayer && !isCompleted && session.currentStep < 6 && !session.nextAction?.startsWith("step6") && (
        <div className="ml-4">
          <p className="text-xs text-gray-500">
            Confirm once you've watched the explainer so I can generate your improvement table.
          </p>
          <div className="space-y-3 mb-4 mt-4 flex flex-col items-center">
          <Button
            type="button"
            onClick={handleWatchVideoAcknowledged}
            disabled={isAcknowledgingVideo}
            className="margo-soft-button w-full"
          >
            {isAcknowledgingVideo ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming…
              </>
            ) : (
              "I've watched the video"
            )}
          </Button>
          </div>
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
                isChunk={true}
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

      {tableRecommendations.length > 0 && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="space-y-4">
              <p className="text-xs font-medium text-gray-500">
                Improvement Recommendations
              </p>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="grid grid-cols-12 gap-6 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-600">
                  <div className="col-span-4">Negative Factor</div>
                  <div className="col-span-4">Suggested Enhancement</div>
                  <div className="col-span-4">Key Considerations</div>
                </div>
                <div className="divide-y divide-gray-100 text-sm text-gray-700">
                  {tableRecommendations.map((entry, index) => (
                    <div key={`${entry.negativeFactor}-${index}`} className="grid grid-cols-12 gap-6 px-4 py-3">
                      <div className="col-span-4 leading-6 text-gray-900">{entry.negativeFactor}</div>
                      <div className="col-span-4 leading-6 text-gray-900">{entry.suggestedEnhancement}</div>
                      <div className="col-span-4 leading-6">{entry.keyConsiderations}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {transitionMessage && shownTransitionMessage && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownTransitionMessage ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">
            {/* {isCompleted ? (
              <p className="text-sm">{transitionMessage}</p>
            ) : ( */}
              <ChunkedText
                text={transitionMessage}
                chunkClassName="text-sm"
                animation="typewriter"
                isChunk={isCompleted?false:true}
                minChunkLength={70}
                staggerMs={30}
                onComplete={() => {
                  setIsShowTransitionMessage(true);
                }}
              />
            {/* )} */}
          </div>
        </div>
      )}

      {/* {readyResponseMessage && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <ChunkedText
              text={readyResponseMessage}
              chunkClassName="text-sm"
              animation="typewriter"
              isChunk={false}
              minChunkLength={70}
              staggerMs={250}
            />
          </div>
        </div>
      )} */}

      {transitionMessage &&!isCompleted&&isShowTransitionMessage&& (
        <div className="ml-4 mb-4 flex flex-col items-center">
          <Button
            type="button"
            onClick={handleContinue}
            disabled={isSaving || isCompleted}
            className="margo-soft-button w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Locking in Step 6…
              </>
            ) : (
              "Yes, I'm ready to move on"
            )}
          </Button>
        </div>
      )}

      {hasGenerated && tableRecommendations.length === 0 && !isLoading && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <p className="font-medium text-gray-900">All clear!</p>
            <p className="mt-2 text-sm text-gray-600">
              Every scoring criteria landed above our improvement threshold. You're ready to move forward without any changes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MargoStep5;

