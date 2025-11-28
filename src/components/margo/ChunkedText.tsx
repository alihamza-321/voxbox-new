import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface ChunkedTextProps extends HTMLAttributes<HTMLDivElement> {
  text?: string | null;
  chunkClassName?: string;
  minChunkLength?: number;
  staggerMs?: number;
  animation?: "fade" | "typewriter";
  onComplete?: () => void;
  isChunk?: boolean;
}

const splitIntoChunks = (input: string, minChunkLength: number) => {
  const normalized = input.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const expandParagraph = (paragraph: string) => {
    if (paragraph.length <= minChunkLength) {
      return [paragraph];
    }

    if (paragraph.includes("\n")) {
      return paragraph.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    }

    const sentences = paragraph
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    if (sentences.length === 0) {
      return [paragraph];
    }

    if (sentences.length === 1 || sentences.every((sentence) => sentence.length >= minChunkLength)) {
      return sentences;
    }

    const combined: string[] = [];
    let buffer = "";

    sentences.forEach((sentence) => {
      if (!buffer) {
        buffer = sentence;
        return;
      }

      const candidate = `${buffer} ${sentence}`.trim();
      if (candidate.length <= minChunkLength * 1.5) {
        buffer = candidate;
      } else {
        combined.push(buffer);
        buffer = sentence;
      }
    });

    if (buffer) {
      combined.push(buffer);
    }

    return combined;
  };

  return paragraphs.flatMap((paragraph) => expandParagraph(paragraph));
};

export const ChunkedText = ({
  text,
  className,
  chunkClassName,
  minChunkLength = 120,
  staggerMs = 0,
  animation = "fade",
  onComplete,
  isChunk = true,
  ...props
}: ChunkedTextProps) => {
  const normalizedText = useMemo(
    () => {
      const source = (text || "").replace(/\r\n/g, "\n").replace(/\\n/g, "\n");
      const lines = source.split("\n");
      return lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n");
    },
    [text]
  );

  const hasCalledOnCompleteRef = useRef(false);
  const lastTextRef = useRef(normalizedText);

  // Always call all hooks before any early returns to maintain hook order
  const chunks = useMemo(() => {
    if (!isChunk || !normalizedText) return [];
    const generated = splitIntoChunks(normalizedText, minChunkLength);
    if (generated.length === 0) {
      return normalizedText ? [normalizedText] : [];
    }
    return generated;
  }, [normalizedText, minChunkLength, isChunk]);

  const [visibleChunks, setVisibleChunks] = useState(animation === "typewriter" ? 0 : 0);
  const [displayedText, setDisplayedText] = useState("");
  const latestOnComplete = useRef(onComplete);

  useEffect(() => {
    latestOnComplete.current = onComplete;
  }, [onComplete]);

  const chunkBoundaries = useMemo(() => {
    if (!isChunk || !normalizedText || !chunks.length) {
      return [];
    }

    const boundaries: number[] = [];
    let searchIndex = 0;

    chunks.forEach((chunk) => {
      if (!chunk) {
        boundaries.push(searchIndex);
        return;
      }

      const trimmedChunk = chunk.trim();
      if (!trimmedChunk) {
        boundaries.push(searchIndex);
        return;
      }

      const chunkIndex = normalizedText.indexOf(trimmedChunk, searchIndex);
      if (chunkIndex === -1) {
        boundaries.push(boundaries.length > 0 ? boundaries[boundaries.length - 1] : normalizedText.length);
        return;
      }

      const endIndex = chunkIndex + trimmedChunk.length;
      boundaries.push(endIndex);
      searchIndex = endIndex;
    });

    if (boundaries[boundaries.length - 1] !== normalizedText.length) {
      boundaries[boundaries.length - 1] = normalizedText.length;
    }

    return boundaries;
  }, [chunks, normalizedText, isChunk]);

  // If isChunk is false, just render simple text without any animation
  useEffect(() => {
    // Reset ref if text has changed
    if (lastTextRef.current !== normalizedText) {
      hasCalledOnCompleteRef.current = false;
      lastTextRef.current = normalizedText;
    }

    if (!isChunk && onComplete && !hasCalledOnCompleteRef.current) {
      // Call onComplete immediately when chunking is disabled (only once per text)
      hasCalledOnCompleteRef.current = true;
      onComplete();
    }
  }, [isChunk, onComplete, normalizedText]);

  // Animation effect - must be called before early return
  useEffect(() => {
    // Only run animation effects if isChunk is true
    if (!isChunk) {
      return;
    }

    if (animation === "typewriter") {
      if (!normalizedText) {
        setDisplayedText("");
        latestOnComplete.current?.();
        return;
      }

      setDisplayedText("");
      setVisibleChunks(0);

      let active = true;
      const totalText = normalizedText;
      const boundaries = chunkBoundaries.length ? chunkBoundaries : [totalText.length];
      let currentBoundaryIndex = 0;
      let charPosition = 0;
      const intervalDelay = 6;
      let timeoutId: number | null = null;

      const step = () => {
        if (!active) {
          return;
        }

        charPosition += 1;
        setDisplayedText(totalText.slice(0, charPosition));

        if (charPosition >= totalText.length) {
          latestOnComplete.current?.();
          return;
        }

        const boundary = boundaries[currentBoundaryIndex];
        if (boundary !== undefined && charPosition >= boundary) {
          currentBoundaryIndex += 1;
          if (staggerMs > 0) {
            timeoutId = window.setTimeout(step, staggerMs);
            return;
          }
        }

        timeoutId = window.setTimeout(step, intervalDelay);
      };

      timeoutId = window.setTimeout(step, intervalDelay);

      return () => {
        active = false;
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    // fade animation
    if (!chunks.length) {
      setVisibleChunks(0);
      setDisplayedText("");
      return;
    }

    if (!staggerMs || staggerMs <= 0) {
      setVisibleChunks(chunks.length);
      return;
    }

    setVisibleChunks(1);
    let current = 1;
    const intervalId = window.setInterval(() => {
      current += 1;
      if (current >= chunks.length) {
        setVisibleChunks(chunks.length);
        window.clearInterval(intervalId);
        latestOnComplete.current?.();
      } else {
        setVisibleChunks(current);
      }
    }, staggerMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [animation, chunks, normalizedText, staggerMs, isChunk, chunkBoundaries]);

  // Early return AFTER all hooks are called
  if (!isChunk) {
    return (
      <div className={cn("leading-relaxed whitespace-pre-wrap", chunkClassName, className)} {...props}>
        {normalizedText || text || ""}
      </div>
    );
  }

  const renderTypewriter = () => (
    <div className={cn("leading-relaxed whitespace-pre-wrap", chunkClassName)}>{displayedText}</div>
  );

  const renderFade = () => (
    <>
      {chunks.map((chunk, index) => {
        if (index >= visibleChunks) {
          return null;
        }

        return (
          <div key={`${index}-${chunk.slice(0, 24)}`} className={cn("leading-relaxed margo-chunk", chunkClassName)}>
            {chunk}
          </div>
        );
      })}
    </>
  );

  return (
    <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props}>
      {animation === "typewriter" ? renderTypewriter() : renderFade()}
    </div>
  );
};

export default ChunkedText;

