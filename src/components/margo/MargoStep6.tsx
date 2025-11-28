import { useEffect, useMemo, useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  submitMargoStep6Ready,
  submitMargoStep6VideoWatched,
  submitMargoStep6BonusRequest,
  type MargoBrief,
  type MargoStep6BonusSuggestion,
  type MargoStep6FalseBelief,
} from "@/lib/margo-api";
import { ChunkedText } from "@/components/margo/ChunkedText";
import { MargoTypingIndicator } from "@/components/margo/MargoTypingIndicator";
import FormattedChunkedText from "./FormattedChunkedText";

interface MargoStep6Props {
  session: MargoBrief;
  isActive: boolean;
  isCompleted?: boolean;
  onSessionChange: (session: MargoBrief) => void;
  onContinue?: () => void;
  onError?: (message: string | null) => void;
}

type FalseBeliefRow = MargoStep6FalseBelief & {
  includeBonus: boolean;
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

const normalizeFalseBeliefs = (rows: MargoStep6FalseBelief[]): FalseBeliefRow[] => {
  return [...rows]
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((row, index) => ({
      rank: index + 1,
      vehicleBelief: row.vehicleBelief,
      internalBelief: row.internalBelief,
      externalBelief: row.externalBelief,
      includeBonus: index < 5,
    }));
};

export const MargoStep6 = ({ session, isActive, isCompleted = false, onSessionChange, onContinue, onError }: MargoStep6Props) => {
  const { toast } = useToast();
  const { id: briefId } = session;
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [instructionMessage, setInstructionMessage] = useState<string | null>(null);
  const [instructionVideoUrl, setInstructionVideoUrl] = useState<string | null>(null);
  const [isAcknowledgingVideo, setIsAcknowledgingVideo] = useState(false);
  const [videoAcknowledgementMessage, setVideoAcknowledgementMessage] = useState<string | null>(null);
  const [falseBeliefRows, setFalseBeliefRows] = useState<FalseBeliefRow[]>([]);
  const [formattedOutput, setFormattedOutput] = useState<string | null>(null);
  const [bonusRequestMessage, setBonusRequestMessage] = useState<string | null>(null);
  const [bonusSuggestions, setBonusSuggestions] = useState<MargoStep6BonusSuggestion[]>([]);
  const [isGeneratingBonuses, setIsGeneratingBonuses] = useState(false);
  const [isSkippingBonuses, setIsSkippingBonuses] = useState(false);
  const [step7IntroMessage, setStep7IntroMessage] = useState<string | null>(null);
  const [step7IntroVideoUrl, setStep7IntroVideoUrl] = useState<string | null>(null);
  const [isContinuing, setIsContinuing] = useState(false);
  const [hasStep6Completed, setHasStep6Completed] = useState(false);
  const [hasContinuedToStep7, setHasContinuedToStep7] = useState(false);
  const [hasHydratedState, setHasHydratedState] = useState(false);
  const [isShowVideoPlayer, setIsShowVideoPlayer] = useState(false);
  const [isShowStep7VideoPlayer, setIsShowStep7VideoPlayer] = useState(false);
  const [bonusRequestMessageComplete, setBonusRequestMessageComplete] = useState(false);
  
  // Progressive reveal states for smooth transitions
  const [shownInitialMessage, setShownInitialMessage] = useState(false);
  const [initialMessageComplete, setInitialMessageComplete] = useState(false);
  const [shownInstructionMessage, setShownInstructionMessage] = useState(false);
  const [instructionMessageComplete, setInstructionMessageComplete] = useState(false);
  const [shownVideoAcknowledgement, setShownVideoAcknowledgement] = useState(false);
  const [videoAcknowledgementComplete, setVideoAcknowledgementComplete] = useState(false);
  const [shownFalseBeliefTable, setShownFalseBeliefTable] = useState(false);
  const [shownBonusRequest, setShownBonusRequest] = useState(false);
  const [shownBonusSuggestions, setShownBonusSuggestions] = useState(false);
  const [shownStep7Intro, setShownStep7Intro] = useState(false);
  const [step7IntroMessageComplete, setStep7IntroMessageComplete] = useState(false);

  const hasFalseBeliefTable = falseBeliefRows.length > 0;
  const hasBonusSuggestions = bonusSuggestions.length > 0;

  const storageKey = useMemo(() => {
    if (!briefId) {
      return null;
    }
    return `margo-step6-${briefId}`;
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
          hasInitialized?: boolean;
          instructionMessage?: string | null;
          instructionVideoUrl?: string | null;
          videoAcknowledgementMessage?: string | null;
          falseBeliefRows?: FalseBeliefRow[];
          formattedOutput?: string | null;
          bonusRequestMessage?: string | null;
          bonusSuggestions?: MargoStep6BonusSuggestion[];
          step7IntroMessage?: string | null;
          step7IntroVideoUrl?: string | null;
          hasStep6Completed?: boolean;
          hasContinuedToStep7?: boolean;
        };

        setHasInitialized(Boolean(parsed.hasInitialized));
        setInstructionMessage(parsed.instructionMessage ?? null);
        setInstructionVideoUrl(parsed.instructionVideoUrl ?? null);
        setVideoAcknowledgementMessage(parsed.videoAcknowledgementMessage ?? null);
        setFalseBeliefRows(Array.isArray(parsed.falseBeliefRows) ? parsed.falseBeliefRows : []);
        setFormattedOutput(parsed.formattedOutput ?? null);
        setBonusRequestMessage(parsed.bonusRequestMessage ?? null);
        setBonusSuggestions(Array.isArray(parsed.bonusSuggestions) ? parsed.bonusSuggestions : []);
        setStep7IntroMessage(parsed.step7IntroMessage ?? null);
        setStep7IntroVideoUrl(parsed.step7IntroVideoUrl ?? null);
        setHasStep6Completed(Boolean(parsed.hasStep6Completed));
        setHasContinuedToStep7(Boolean(parsed.hasContinuedToStep7));
        
        // If persisted, mark all as shown and complete (no animation)
        if (parsed.hasInitialized || parsed.instructionMessage || parsed.falseBeliefRows?.length) {
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
          if (parsed.falseBeliefRows?.length) {
            setShownFalseBeliefTable(true);
          }
          if (parsed.bonusRequestMessage) {
            setShownBonusRequest(true);
          }
          if (parsed.bonusSuggestions?.length) {
            setShownBonusSuggestions(true);
          }
          if (parsed.step7IntroMessage) {
            setShownStep7Intro(true);
            setStep7IntroMessageComplete(true);
            setIsShowStep7VideoPlayer(true);
          }
        }
      }
    } catch (error) {
      console.error("Failed to hydrate Step 6 state:", error);
      try {
        window.localStorage.removeItem(storageKey);
      } catch (removeError) {
        console.error("Failed to clear corrupted Step 6 state:", removeError);
      }
    } finally {
      setHasHydratedState(true);
    }
  }, [storageKey, hasHydratedState]);



  

  useEffect(() => {
    if (!storageKey || typeof window === "undefined" || !hasHydratedState) {
      return;
    }

    const snapshot = {
      hasInitialized,
      instructionMessage,
      instructionVideoUrl,
      videoAcknowledgementMessage,
      falseBeliefRows,
      formattedOutput,
      bonusRequestMessage,
      bonusSuggestions,
      step7IntroMessage,
      step7IntroVideoUrl,
      hasStep6Completed,
      hasContinuedToStep7,
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch (error) {
      console.error("Failed to persist Step 6 state:", error);
    }
      console.log("step7IntroMessage.....",step7IntroMessage);
  }, [
    storageKey,
    hasHydratedState,
    hasInitialized,
    instructionMessage,
    instructionVideoUrl,
    videoAcknowledgementMessage,
    falseBeliefRows,
    formattedOutput,
    bonusRequestMessage,
    bonusSuggestions,
    step7IntroMessage,
    step7IntroVideoUrl,
    hasStep6Completed,
    hasContinuedToStep7,
  ]);

  // Progressive reveal: Show initial message
  useEffect(() => {
    if (isCompleted || hasInitialized || instructionMessage) {
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
  }, [hasHydratedState, isActive, isCompleted, hasInitialized, instructionMessage]);

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
    const isPersisted = hasInitialized && instructionMessage;
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
  }, [instructionMessage, hasHydratedState, isCompleted, hasInitialized]);

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
    const isPersisted = hasInitialized && videoAcknowledgementMessage;
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
  }, [videoAcknowledgementMessage, hasHydratedState, isCompleted, hasInitialized, instructionMessageComplete]);

  // Progressive reveal: Show false belief table
  useEffect(() => {
    if (isCompleted) {
      if (hasFalseBeliefTable) {
        setShownFalseBeliefTable(true);
      }
      return;
    }

    if (!hasFalseBeliefTable || !hasHydratedState) return;

    // Check if persisted
    const isPersisted = hasInitialized && hasFalseBeliefTable;
    if (isPersisted) {
      setShownFalseBeliefTable(true);
    } else {
      // New table - show after video acknowledgement completes or immediately if no acknowledgement
      const delay = videoAcknowledgementMessage ? (videoAcknowledgementComplete ? 300 : 0) : 300;
      if (delay === 0 && !videoAcknowledgementMessage) {
        const timer = setTimeout(() => {
          setShownFalseBeliefTable(true);
        }, 300);
        return () => clearTimeout(timer);
      } else if (videoAcknowledgementComplete || !videoAcknowledgementMessage) {
        const timer = setTimeout(() => {
          setShownFalseBeliefTable(true);
        }, delay);
        return () => clearTimeout(timer);
      }
    }
  }, [hasFalseBeliefTable, hasHydratedState, isCompleted, hasInitialized, videoAcknowledgementMessage, videoAcknowledgementComplete]);

  // Progressive reveal: Show bonus request
  useEffect(() => {
    if (isCompleted) {
      if (bonusRequestMessage) {
        setShownBonusRequest(true);
      }
      return;
    }

    if (!bonusRequestMessage || !hasHydratedState) return;

    // Check if persisted
    const isPersisted = hasInitialized && bonusRequestMessage;
    if (isPersisted) {
      setShownBonusRequest(true);
    } else {
      // New message - show after false belief table is shown
      if (shownFalseBeliefTable || !hasFalseBeliefTable) {
        const timer = setTimeout(() => {
          setShownBonusRequest(true);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [bonusRequestMessage, hasHydratedState, isCompleted, hasInitialized, shownFalseBeliefTable, hasFalseBeliefTable]);

  // Progressive reveal: Show bonus suggestions
  useEffect(() => {
    if (isCompleted) {
      if (hasBonusSuggestions) {
        setShownBonusSuggestions(true);
      }
      return;
    }

    if (!hasBonusSuggestions || !hasHydratedState) return;

    // Check if persisted
    const isPersisted = hasInitialized && hasBonusSuggestions;
    if (isPersisted) {
      setShownBonusSuggestions(true);
    } else {
      // New suggestions - show after bonus request completes
      if (shownBonusRequest || !bonusRequestMessage) {
        const timer = setTimeout(() => {
          setShownBonusSuggestions(true);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [hasBonusSuggestions, hasHydratedState, isCompleted, hasInitialized, shownBonusRequest, bonusRequestMessage]);

  // Progressive reveal: Show step 7 intro
  useEffect(() => {
    if (isCompleted) {
      if (step7IntroMessage) {
        setShownStep7Intro(true);
      }
      return;
    }

    if (!step7IntroMessage || !hasHydratedState) return;

    // Check if persisted
    const isPersisted = hasInitialized && step7IntroMessage;
    if (isPersisted) {
      setShownStep7Intro(true);
    } else {
      // New message - show after bonus suggestions or bonus request completes
      const delay = hasBonusSuggestions ? (shownBonusSuggestions ? 300 : 0) : (shownBonusRequest ? 300 : 0);
      if (delay === 0 && !hasBonusSuggestions && !bonusRequestMessage) {
        const timer = setTimeout(() => {
          setShownStep7Intro(true);
        }, 300);
        return () => clearTimeout(timer);
      } else if (shownBonusSuggestions || (shownBonusRequest && !hasBonusSuggestions)) {
        const timer = setTimeout(() => {
          setShownStep7Intro(true);
        }, delay || 300);
        return () => clearTimeout(timer);
      }
    }
  }, [step7IntroMessage, hasHydratedState, isCompleted, hasInitialized, shownBonusSuggestions, shownBonusRequest, hasBonusSuggestions, bonusRequestMessage]);

  const handleStartStep = async () => {
    if (!briefId) return;

    try {
      setIsInitializing(true);
      const response = await submitMargoStep6Ready(briefId, { message: "yes" });
      const payload = response?.data ?? {};
      const nextAction = (payload?.nextAction ?? session.nextAction ?? "") as string;
      const rawMessage = payload?.message ?? "";
      const { videoUrl } = parseInstructionMessage(rawMessage);
      const plainMessage = convertMarkdownToPlainText(rawMessage);

      onSessionChange({
        ...session,
        currentStep: Math.max(session.currentStep ?? 5, 6),
        nextAction: nextAction || "step6_ready",
      });

      setInstructionMessage(plainMessage || null);
      setInstructionVideoUrl(videoUrl);
      setHasInitialized(true);
      
      // Trigger instruction message reveal
      if (plainMessage) {
        setTimeout(() => {
          setShownInstructionMessage(true);
        }, 300);
      }
      
      onError?.(null);
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to prepare Step 6.";
      
      // Check if backend indicates we're already past step 6
      if (errorMessage.includes("current step is 7") || errorMessage.includes("Expected step 6")) {
        // Backend is already at step 7, update session state to match
        onSessionChange({
          ...session,
          currentStep: 7,
          nextAction: "step7_ready",
        });
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
        
        onError?.(null);
      } else {
        console.error("Failed to start MARGO Step 6:", error);
        onError?.(errorMessage);
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const handleVideoWatched = async () => {
    if (!briefId) return;

    try {
      setIsAcknowledgingVideo(true);
      const response = await submitMargoStep6VideoWatched(briefId, { message: "I've watched the video" });
      const payload = response?.data ?? {};
      const acknowledgement = payload?.message ?? null;
      const falseBeliefs = Array.isArray(payload?.falseBeliefs) ? payload.falseBeliefs : [];

      onSessionChange({
        ...session,
        currentStep: Math.max(session.currentStep ?? 5, 6),
        nextAction: (payload?.nextAction as string | undefined) || "view_false_beliefs",
      });

      // Don't clear instructionMessage - keep it in history for persistence
      // setInstructionMessage(null);
      // Keep instructionVideoUrl for history as well
      // setInstructionVideoUrl(null);
      setVideoAcknowledgementMessage(acknowledgement ? convertMarkdownToPlainText(acknowledgement) : null);
      setFalseBeliefRows(normalizeFalseBeliefs(falseBeliefs));
      setFormattedOutput(payload?.formattedOutput ?? null);
      setBonusRequestMessage(payload?.bonusRequestMessage ? convertMarkdownToPlainText(payload.bonusRequestMessage) : null);
      setBonusSuggestions([]);
      setStep7IntroMessage(null);
      
      // Trigger video acknowledgement reveal
      if (acknowledgement) {
        setTimeout(() => {
          setShownVideoAcknowledgement(true);
        }, 200);
      }
      
      // Trigger false belief table reveal after acknowledgement
      if (falseBeliefs.length > 0) {
        setTimeout(() => {
          setShownFalseBeliefTable(true);
        }, acknowledgement ? 500 : 300);
      }
      
      // Trigger bonus request reveal after table
      if (payload?.bonusRequestMessage) {
        setTimeout(() => {
          setShownBonusRequest(true);
        }, falseBeliefs.length > 0 ? 500 : 300);
      }
      
      onError?.(null);
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to acknowledge the Step 6 video.";
      
      // Check if backend indicates we're already past step 6
      if (errorMessage.includes("current step is 7") || errorMessage.includes("Expected step 6")) {
        // Backend is already at step 7, update session state to match
        onSessionChange({
          ...session,
          currentStep: 7,
          nextAction: "step7_ready",
        });
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
        
        onError?.(null);
      } else {
        console.error("Failed to acknowledge Step 6 video:", error);
        onError?.(errorMessage);
      }
    } finally {
      setIsAcknowledgingVideo(false);
    }
  };

  const handleBonusRequest = async (shouldGenerate: boolean) => {
    if (!briefId) return;

    try {
      // Set the appropriate loading state based on the button clicked
      if (shouldGenerate) {
        setIsGeneratingBonuses(true);
        setIsSkippingBonuses(false);
      } else {
        setIsSkippingBonuses(true);
        setIsGeneratingBonuses(false);
      }
      
      const message = shouldGenerate ? "yes" : "no";
      const payload = await submitMargoStep6BonusRequest(briefId, {
        message,
      });
      const data = payload?.data ?? {};

      onSessionChange({
        ...session,
        currentStep: Math.max(session.currentStep ?? 5, 6),
        nextAction: (data?.nextAction as string | undefined) || "view_bonuses",
      });

      setBonusSuggestions(Array.isArray(data?.bonusSuggestions) ? data.bonusSuggestions : []);
      setBonusRequestMessage(null);
      const rawStep7Message = data?.step7IntroMessage ? convertMarkdownToPlainText(data.step7IntroMessage) : null;
      if (rawStep7Message) {
        const { cleanedMessage, videoUrl } = parseInstructionMessage(rawStep7Message);
        setStep7IntroMessage(cleanedMessage);
        setStep7IntroVideoUrl(videoUrl);
      } else {
        setStep7IntroMessage(null);
        setStep7IntroVideoUrl(null);
      }
      setHasStep6Completed(true);
      
      // Trigger bonus suggestions reveal
      if (Array.isArray(data?.bonusSuggestions) && data.bonusSuggestions.length > 0) {
        setTimeout(() => {
          setShownBonusSuggestions(true);
        }, 300);
      }
      
      // Trigger step 7 intro reveal
      if (data?.step7IntroMessage) {
        setTimeout(() => {
          setShownStep7Intro(true);
        }, Array.isArray(data?.bonusSuggestions) && data.bonusSuggestions.length > 0 ? 500 : 300);
      }
      
      onError?.(null);
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to process the bonus request.";
      
      // Check if backend indicates we're already past step 6
      if (errorMessage.includes("current step is 7") || errorMessage.includes("Expected step 6")) {
        // Backend is already at step 7, update session state to match
        onSessionChange({
          ...session,
          currentStep: 7,
          nextAction: "step7_ready",
        });
        
        toast({
          title: "Already completed",
          description: "This step has already been completed. Moving forward...",
          variant: "default",
        });
        
        // Clear the button state by marking as completed
        setHasStep6Completed(true);
        onError?.(null);
      } else {
        console.error("Failed to process Step 6 bonus request:", error);
        onError?.(errorMessage);
      }
    } finally {
      // Reset both loading states
      setIsGeneratingBonuses(false);
      setIsSkippingBonuses(false);
    }
  };

  const handleContinueToStep7 = async () => {
    if (!briefId || isCompleted || hasContinuedToStep7) return;

    try {
      setIsContinuing(true);
      setHasContinuedToStep7(true);
      onSessionChange({
        ...session,
        currentStep: Math.max(session.currentStep ?? 6, 6) + 1,
        nextAction: "step7_ready",
      });
      onContinue?.();
    } finally {
      setIsContinuing(false);
    }
  };

  const hasStarted = hasInitialized || instructionMessage !== null || hasFalseBeliefTable;
  const isInitialMessagePersisted = hasInitialized || instructionMessage;
  const shouldAnimateInitialMessage = shownInitialMessage && !isInitialMessagePersisted && !initialMessageComplete;

  return (
    <div className="space-y-4">
      {!hasStarted && shownInitialMessage && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownInitialMessage ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">
            {/* {isInitialMessagePersisted || isCompleted ? (
              <p className="text-sm">Ready to tackle belief barriers? I'll map out the psychological objections preventing Clara from saying "yes."</p>
            ) : ( */}
              <ChunkedText
                text={`Ready to tackle belief barriers? I'll map out the psychological objections preventing Clara from saying "yes."`}
                chunkClassName="text-sm"
                animation="typewriter"
                isChunk={isInitialMessagePersisted||isCompleted?false:true}
                minChunkLength={60}
                staggerMs={30}
                onComplete={() => {
                  setInitialMessageComplete(true);
                }}
              />
            {/* )} */}
            {shouldAnimateInitialMessage && <MargoTypingIndicator className="text-gray-400" />}
            {isInitializing && <MargoTypingIndicator className="text-gray-400" />}
          </div>
        </div>
      )}

      {!hasStarted &&initialMessageComplete&& (
        <div className="ml-4 mb-4 flex flex-col items-center">
          <Button
            type="button"
            onClick={handleStartStep}
            disabled={isInitializing}
            className="margo-soft-button w-full"
          >
            {isInitializing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing false beliefs…
              </>
            ) : (
              "Yes"
            )}
          </Button>
        </div>
      )}

      {instructionMessage && shownInstructionMessage && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownInstructionMessage ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">



            <FormattedChunkedText
              text={instructionMessage}
              chunkClassName="text-sm"
              animation="typewriter"
              isChunk={hasFalseBeliefTable && shownFalseBeliefTable?false:true}
              staggerMs={30}
              minChunkLength={100}
              onComplete={() => {
                setIsShowVideoPlayer(true);              
                setInstructionMessageComplete(true);
              }}
            />
            {!instructionMessageComplete && !isCompleted && <MargoTypingIndicator className="text-gray-400" />}
            {/* {(isAcknowledgingVideo || isInitializing) && <MargoTypingIndicator className="text-gray-400" />} */}
          </div>
        </div>
      )}

      {instructionMessage && instructionVideoUrl &&isShowVideoPlayer &&(
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

      {instructionMessage && instructionVideoUrl && isShowVideoPlayer &&(!hasFalseBeliefTable && !shownFalseBeliefTable)&&(
        <div className="ml-4 space-y-3 mb-4 flex flex-col items-center">
          <Button
            type="button"
            onClick={handleVideoWatched}
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

      {hasFalseBeliefTable && shownFalseBeliefTable && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownFalseBeliefTable ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">
                  False Beliefs Table
                </p>
                <span className="text-xs text-gray-500">
                  Drag controls give you quick refinements before we lock the brief.
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="grid grid-cols-12 gap-0 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-600">
                  <div className="col-span-1 text-center">Rank</div>
                  <div className="col-span-4">Vehicle</div>
                  <div className="col-span-4">Internal</div>
                  <div className="col-span-3">External</div>
                </div>
                <div className="divide-y divide-gray-100 text-sm text-gray-700">
                  {falseBeliefRows.map((row) => (
                    <div key={`belief-row-${row.rank}-${row.vehicleBelief}`} className="grid grid-cols-12 items-start gap-0 px-4 py-3">
                      <div className="col-span-1 flex items-center justify-center text-sm font-semibold text-gray-900">{row.rank}</div>
                      <div className="col-span-4 pr-3">
                        <div>{row.vehicleBelief}</div>
                      </div>
                      <div className="col-span-4 pr-3">
                        <div>{row.internalBelief}</div>   
                      </div>
                      <div className="col-span-3 pr-3">
                        <div>{row.externalBelief}</div>         
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* {formattedOutput && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500">Formatted Output</p>
              <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                {formattedOutput}
              </pre>
            </div>
          </div>
        </div>
      )} */}

      {bonusRequestMessage && shownBonusRequest && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownBonusRequest ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">
            {isCompleted ? (
              <p className="text-sm">{bonusRequestMessage}</p>
            ) : (
              <FormattedChunkedText
                text={bonusRequestMessage}
                chunkClassName="text-sm"
                animation="typewriter"
                isChunk={true}
                minChunkLength={70}
                staggerMs={30}
                onComplete={() => {
                  setBonusRequestMessageComplete(true);
                }}
              />
            )}
          </div>
        </div>
      )}

      {bonusRequestMessage && shownBonusRequest &&bonusRequestMessageComplete&& (
        <div className="ml-4 space-y-3 mb-4">
          <div className="flex flex-col gap-2 w-full">
            <Button
              type="button"
              onClick={() => handleBonusRequest(true)}
              disabled={isGeneratingBonuses || isSkippingBonuses}
              className="margo-soft-button w-full"
            >
              {isGeneratingBonuses ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Crafting bonus ideas…
                </>
              ) : (
                "Yes, suggest bonuses"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleBonusRequest(false)}
              disabled={isGeneratingBonuses || isSkippingBonuses}
              className="margo-soft-button margo-soft-button--outline w-full"
            >
              {isSkippingBonuses ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                "I'll skip bonuses"
              )}
            </Button>
          </div>
        </div>
      )}

      {hasBonusSuggestions && shownBonusSuggestions && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownBonusSuggestions ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">
            <div className="space-y-4">
              <p className="text-xs font-medium text-gray-500">
                Bonus ideas mapped to beliefs
              </p>
              <div className="space-y-3">
                {bonusSuggestions.map((bonus, index) => (
                  <div key={`${bonus.falseBelief}-${index}`} className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-xs font-medium text-gray-500">False belief addressed</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{bonus.falseBelief}</p>
                    <p className="mt-3 text-xs font-medium text-gray-500">Bonus title</p>
                    <p className="text-sm font-semibold text-gray-900">{bonus.title}</p>
                    <p className="mt-3 text-xs font-medium text-gray-500">Bonus description</p>
                    <p className="text-sm leading-6 text-gray-600">{bonus.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step7IntroMessage && shownStep7Intro && (
        <div className={`margo-chat-bubble margo-chat-bubble--bot transition-opacity duration-500 ${shownStep7Intro ? 'opacity-100' : 'opacity-0'}`}>
          <div className="margo-message-content">
            {/* {isCompleted || step7IntroMessageComplete ? (
              <p className="text-sm">{step7IntroMessage}</p>
            ) : ( */}
              <FormattedChunkedText
                text={step7IntroMessage}
                chunkClassName="text-sm"
                animation="typewriter"
                isChunk={step7IntroMessage && hasStep6Completed && !hasContinuedToStep7?true:false}
                minChunkLength={70}
                staggerMs={30}
                onComplete={() => {
                  setIsShowStep7VideoPlayer(true);
                  setStep7IntroMessageComplete(true);
                }}
              />
            {/* )} */}
            {!step7IntroMessageComplete && !isCompleted && <MargoTypingIndicator className="text-gray-400" />}
          </div>
        </div>
      )}

      {step7IntroMessage && step7IntroVideoUrl && (isShowStep7VideoPlayer || isCompleted || step7IntroMessageComplete) && (
        <div className="ml-4 mb-4">
          {(() => {
            const vimeoData = parseVimeoUrl(step7IntroVideoUrl);
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
                onClick={() => window.open(step7IntroVideoUrl, "_blank", "noopener")}
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

      {step7IntroMessage && hasStep6Completed && !hasContinuedToStep7 &&step7IntroMessageComplete&& (
        <div className="ml-4 mb-4">
          <Button
            type="button"
            onClick={handleContinueToStep7}
            disabled={isContinuing || isCompleted}
            className="margo-soft-button w-full"
          >
            {isContinuing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               "Confirming…"
              </>
            ) : (
               "I've watched the video"
            )}
          </Button>
        </div>
      )}

      {/* {!step7IntroMessage && hasStep6Completed && (
        <div className="ml-12 space-y-3 mb-4">
          <p className="text-xs text-gray-500">
            Select beliefs for bonus ideas, tweak language on the fly, and reorder as needed — everything autosaves into
            your journey.
          </p>
          <Button
            type="button"
            onClick={handleContinueToStep7}
            disabled={isContinuing || isCompleted}
            className="margo-soft-button"
          >
            {isContinuing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moving to Step 7…
              </>
            ) : (
              "Continue to Step 7"
            )}
          </Button>
        </div>
      )} */}
    </div>
  );
};

export default MargoStep6;

