import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { renderMinimalMarkdown } from "@/lib/margo-text-utils";

interface FormattedChunkedTextProps extends HTMLAttributes<HTMLDivElement> {
  text?: string | null;
  chunkClassName?: string;
  minChunkLength?: number;
  staggerMs?: number;
  animation?: "fade" | "typewriter";
  onComplete?: () => void;
  isCompleted?: boolean;
  isChunk?: boolean;
}

/**
 * Formats instruction message by:
 * 1. Removing video URLs and related lines
 * 2. Adding bold formatting to headings and key phrases (ChatGPT-style)
 * 3. Converting colon-separated lists to bullet points
 */
const formatInstructionMessage = (text: string | null): string => {
  if (!text) return "";
  
  // Remove ellipsis character
  let formatted = text.replace(/…/g, "");
  
  // Split into lines for processing
  const lines = formatted.split("\n");
  const filteredLines: string[] = [];
  let skipNext = false;
  
  // Filter out video-related lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip lines with video URLs
    if (trimmed.match(/https?:\/\/[^\s]+/)) {
      skipNext = true;
      continue;
    }
    
    // Skip "Please watch this short video" line
    if (trimmed.match(/^Please watch this short video/i)) {
      skipNext = true;
      continue;
    }
    
    // Skip lines that are just "🎥" emoji
    if (trimmed === "🎥" || trimmed.match(/^🎥\s*$/)) {
      continue;
    }
    
    // Skip the line after "Please watch" if it's just the URL explanation
    if (skipNext && trimmed.match(/^It explains/i)) {
      skipNext = false;
      continue;
    }
    
    skipNext = false;
    filteredLines.push(line);
  }
  
  // Process lines: remove emoji from start and bold the line
  const processedLines = filteredLines.map((line) => {
    const trimmed = line.trim();
    // Check if line starts with an emoji (Unicode emoji pattern)
    const emojiMatch = trimmed.match(/^(\p{Emoji}+)\s*(.+)$/u);
    if (emojiMatch) {
      // Remove emoji and bold the rest of the line
      const textWithoutEmoji = emojiMatch[2].trim();
      // Preserve original indentation
      const leadingWhitespace = line.match(/^\s*/)?.[0] || "";
      return `${leadingWhitespace}**${textWithoutEmoji}**`;
    }
    return line;
  });
  
  formatted = processedLines.join("\n");
  
  // Remove any remaining URLs
  formatted = formatted.replace(/https?:\/\/[^\s]+/g, "");
  
  // Format headings and key phrases with bold markers
  // Step headers (e.g., "🟢 Step 4: Product Relevancy Score Assessment")
  formatted = formatted.replace(/^(🟢\s*Step\s+\d+:[^\n]+)/gm, "**$1**");
  
  // Section headers (e.g., "🧭 What Happens Next & Why")
  formatted = formatted.replace(/^(🧭\s+[^\n]+)/gm, "**$1**");
  
  // Key action phrases (e.g., "👉 Once you've watched it, type:")
  formatted = formatted.replace(/(👉\s+[^\n]+)/g, "**$1**");
  
  // Bold key phrases like "Where your offer already excels"
  formatted = formatted.replace(/(Where your offer already excels)/g, "**$1**");
  formatted = formatted.replace(/(Where we can refine to increase traction and conversions)/g, "**$1**");
  
  // Bold quoted text (e.g., "I've watched the video")
  // Only bold quotes that aren't already inside bold markers
  formatted = formatted.replace(/(?<!\*\*)"([^"]+)"(?!\*\*)/g, '**"$1"**');
  
  // Clean up malformed patterns: if quotes appear right after ** (from other formatting),
  // remove the quotes to avoid **" showing up literally
  // Convert **"text"** to **text** (quotes are redundant inside bold)
  formatted = formatted.replace(/\*\*"([^"]+)"\*\*/g, '**$1**');
  
  // Also handle incomplete patterns like **"text" (missing closing **)
  formatted = formatted.replace(/\*\*"([^"]+)"/g, '**$1');
  formatted = formatted.replace(/"([^"]+)"\*\*/g, '$1**');
  
  // Format colon-separated lists: detect lines ending with colon followed by list items
  // Pattern: "Text ending with colon:\n\nItem 1\nItem 2\nItem 3"
  const formattedLinesForLists = formatted.split('\n');
  const listFormattedLines: string[] = [];
  let i = 0;
  
  while (i < formattedLinesForLists.length) {
    const line = formattedLinesForLists[i];
    const trimmed = line.trim();
    
    // Check if line ends with colon (and isn't already a bullet/numbered list item)
    if (trimmed.endsWith(':') && !trimmed.match(/^[-*•]\s/) && !trimmed.match(/^\d+\.\s/)) {
      // Found a line ending with colon - check if next lines are list items
      const listItems: string[] = [];
      let j = i + 1;
      let foundListItems = false;
      
      // Skip empty lines after the colon
      while (j < formattedLinesForLists.length && formattedLinesForLists[j].trim() === '') {
        j++;
      }
      
      // Collect consecutive non-empty lines that look like list items
      // Stop when we hit:
      // - A line that's already a bullet/numbered list
      // - A line that starts with bold markers (**)
      // - A line that looks like a heading or section break
      // - An empty line followed by a non-list line
      while (j < formattedLinesForLists.length) {
        const nextLine = formattedLinesForLists[j];
        const nextTrimmed = nextLine.trim();
        
        // Stop if we hit an empty line and we've already found list items
        if (nextTrimmed === '' && foundListItems) {
          // Check if the next non-empty line is NOT a list item
          let k = j + 1;
          while (k < formattedLinesForLists.length && formattedLinesForLists[k].trim() === '') {
            k++;
          }
          if (k < formattedLinesForLists.length) {
            const afterEmpty = formattedLinesForLists[k].trim();
            // If next line is already formatted or looks like a new section, stop
            if (afterEmpty.startsWith('**') || 
                afterEmpty.match(/^[-*•]\s/) || 
                afterEmpty.match(/^\d+\.\s/) ||
                afterEmpty.length > 100) { // Likely a paragraph, not a list item
              break;
            }
          }
        }
        
        // Stop if line is empty and we haven't found any list items yet
        if (nextTrimmed === '' && !foundListItems) {
          break;
        }
        
        // Stop if line is already formatted as a list
        if (nextTrimmed.match(/^[-*•]\s/) || nextTrimmed.match(/^\d+\.\s/)) {
          break;
        }
        
        // Stop if line starts with bold markers (likely a heading)
        if (nextTrimmed.startsWith('**')) {
          break;
        }
        
        // Stop if line looks like a section break or heading (contains emoji or special markers)
        if (nextTrimmed.match(/^[🟢🧭👉]/)) {
          break;
        }
        
        // If line is non-empty and doesn't match stop conditions, it's a list item
        if (nextTrimmed !== '') {
          // Heuristic: list items are usually short (less than 150 chars) and don't end with periods
          // But we'll be lenient and accept most non-empty lines
          listItems.push(nextTrimmed);
          foundListItems = true;
        }
        
        j++;
      }
      
      // If we found list items, format them as bullets
      if (foundListItems && listItems.length > 0) {
        listFormattedLines.push(line); // Keep the colon line as-is
        // Add bullet points for each list item
        listItems.forEach(item => {
          listFormattedLines.push(`- ${item}`);
        });
        i = j; // Skip the lines we just processed
        continue;
      }
    }
    
    // Not a colon list pattern, keep the line as-is
    listFormattedLines.push(line);
    i++;
  }
  
  formatted = listFormattedLines.join('\n');
  
  // Fix multi-line bold sections: when ** appears at start of line and ** at end of a later line
  // Markdown doesn't support bold across line breaks, so merge content into single line
  // This handles patterns like:
  // **text
  // 
  // more text**
  // -> **text more text**
  
  // Use a more robust approach: find ** at line start, collect all content until ** at line end
  const formattedLines = formatted.split('\n');
  const fixedLines: string[] = [];
  let inBoldSection = false;
  let boldContent: string[] = [];
  
  for (let i = 0; i < formattedLines.length; i++) {
    const line = formattedLines[i];
    const trimmed = line.trim();
    
    // Check if line starts with ** (opening bold) - could be standalone or start of multi-line
    if (trimmed.startsWith('**') && !trimmed.endsWith('**')) {
      // Starting a bold section that spans multiple lines
      inBoldSection = true;
      boldContent = [trimmed];
    } else if (inBoldSection) {
      // We're in a bold section
      if (trimmed.endsWith('**')) {
        // This line ends the bold section
        if (trimmed.startsWith('**')) {
          // Line is both start and end: **text** - shouldn't happen but handle it
          boldContent.push(trimmed);
        } else {
          // Line ends with **, closing the section
          boldContent.push(trimmed);
        }
        // Merge all content into single line, preserving the ** markers
        const firstLine = boldContent[0] || '';
        const lastLine = boldContent[boldContent.length - 1] || '';
        const middleLines = boldContent.slice(1, -1).filter(Boolean);
        // Extract content from first line (remove leading **)
        const firstContent = firstLine.replace(/^\*\*+/, '').trim();
        // Extract content from last line (remove trailing **)
        const lastContent = lastLine.replace(/\*\*+$/, '').trim();
        // Combine all content
        const allContent = [firstContent, ...middleLines, lastContent].filter(Boolean).join(' ');
        const mergedContent = `**${allContent}**`;
        fixedLines.push(mergedContent);
        inBoldSection = false;
        boldContent = [];
      } else if (trimmed) {
        // Continuation of bold section (content line)
        boldContent.push(trimmed);
      }
      // Empty lines are ignored in bold sections
    } else {
      // Normal line (not in bold section)
      fixedLines.push(line);
    }
  }
  
  // If we ended with an unclosed bold section, add it back as-is
  if (inBoldSection && boldContent.length > 0) {
    fixedLines.push(...boldContent);
  }
  
  formatted = fixedLines.join('\n');
  
  // Also handle simpler cases with regex for edge cases (single line break)
  formatted = formatted.replace(/(\*\*[^\n]+)\n+([^\n]+)\*\*/g, '$1 $2**');
  
  // Clean up multiple newlines
  formatted = formatted.replace(/\n{3,}/g, "\n\n");
  
  return formatted.trim();
};

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

export const FormattedChunkedText = ({
  text,
  className,
  chunkClassName,
  minChunkLength = 120,
  staggerMs = 200,
  animation = "fade",
  onComplete,
  isCompleted = false,
  isChunk = true,
  ...props
}: FormattedChunkedTextProps) => {
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

  const formattedText = useMemo(() => formatInstructionMessage(normalizedText), [normalizedText]);

  const chunks = useMemo(() => {
    if (!formattedText) return [];
    const generated = splitIntoChunks(formattedText, minChunkLength);
    if (generated.length === 0) {
      return formattedText ? [formattedText] : [];
    }
    return generated;
  }, [formattedText, minChunkLength]);

  const chunkBoundaries = useMemo(() => {
    if (!formattedText || !chunks.length) {
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

      const chunkIndex = formattedText.indexOf(trimmedChunk, searchIndex);
      if (chunkIndex === -1) {
        boundaries.push(boundaries.length > 0 ? boundaries[boundaries.length - 1] : formattedText.length);
        return;
      }

      const endIndex = chunkIndex + trimmedChunk.length;
      boundaries.push(endIndex);
      searchIndex = endIndex;
    });

    if (boundaries[boundaries.length - 1] !== formattedText.length) {
      boundaries[boundaries.length - 1] = formattedText.length;
    }

    return boundaries;
  }, [chunks, formattedText]);

  const [visibleChunks, setVisibleChunks] = useState(animation === "typewriter" ? 0 : 0);
  const [displayedText, setDisplayedText] = useState("");
  const latestOnComplete = useRef(onComplete);

  useEffect(() => {
    latestOnComplete.current = onComplete;
  }, [onComplete]);

  // Animation effect (only runs when isChunk is true)
  useEffect(() => {
    if (!isChunk) {
      return;
    }

    if (isCompleted) {
      setVisibleChunks(chunks.length);
      setDisplayedText(formattedText || "");
      latestOnComplete.current?.();
      return;
    }

    if (!formattedText) {
      setVisibleChunks(0);
      setDisplayedText("");
      latestOnComplete.current?.();
      return;
    }

    if (animation === "typewriter") {
      setDisplayedText("");
      setVisibleChunks(0);

      let active = true;
      const totalText = formattedText;
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
      latestOnComplete.current?.();
      return;
    }

    if (!staggerMs || staggerMs <= 0) {
      setVisibleChunks(chunks.length);
      latestOnComplete.current?.();
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
  }, [chunks, staggerMs, isCompleted, animation, formattedText, chunkBoundaries, isChunk]);

  // Call onComplete immediately when not using chunking
  useEffect(() => {
    if (!isChunk && formattedText) {
      onComplete?.();
    }
  }, [isChunk, formattedText, onComplete]);

  if (!formattedText) {
    return null;
  }

  // If isChunk is false, render formatted text directly without animation
  if (!isChunk) {
    return (
      <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props}>
        <div className={cn("leading-relaxed whitespace-pre-wrap", chunkClassName)}>
          {renderMinimalMarkdown(formattedText)}
        </div>
      </div>
    );
  }

  const renderTypewriter = () => (
    <div className={cn("leading-relaxed whitespace-pre-wrap", chunkClassName)}>
      {renderMinimalMarkdown(displayedText)}
    </div>
  );

  const renderFade = () => (
    <>
      {chunks.map((chunk, index) => {
        if (index >= visibleChunks) {
          return null;
        }

        return (
          <div
            key={`${index}-${chunk.slice(0, 24)}`}
            className={cn("leading-relaxed margo-chunk", chunkClassName)}
          >
            {renderMinimalMarkdown(chunk)}
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

export default FormattedChunkedText;

