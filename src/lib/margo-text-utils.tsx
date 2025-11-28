/**
 * Renders minimal markdown for chat bubbles: bold headings, **bold**, *bold*, and "quoted" text spans, preserve line breaks
 * Extracted from MargoStep7 for reuse across components
 */
export const renderMinimalMarkdown = (input?: string | null) => {
  if (!input) {
    return null;
  }

  const lines = input.split(/\n/);

  const renderInlineBold = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let keyCounter = 0;

    // First pass: process double asterisks (**text**)
    const doubleAsteriskRegex = /\*\*(.+?)\*\*/g;
    const doubleMatches: Array<{ start: number; end: number; content: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = doubleAsteriskRegex.exec(text)) !== null) {
      doubleMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    // Second pass: process single asterisks (*text*), but skip if inside double asterisk ranges
    const singleAsteriskRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g;
    const singleMatches: Array<{ start: number; end: number; content: string }> = [];
    while ((match = singleAsteriskRegex.exec(text)) !== null) {
      // Check if this match overlaps with any double asterisk match
      const overlaps = doubleMatches.some(
        (dm) => match!.index < dm.end && match!.index + match![0].length > dm.start
      );
      if (!overlaps) {
        singleMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[1],
        });
      }
    }

    // Third pass: process quoted text ("text"), but skip if inside asterisk ranges
    const quotedTextRegex = /"([^"]+)"/g;
    const quotedMatches: Array<{ start: number; end: number; content: string }> = [];
    while ((match = quotedTextRegex.exec(text)) !== null) {
      // Check if this match overlaps with any asterisk match (double or single)
      const allAsteriskMatches = [...doubleMatches, ...singleMatches];
      const overlaps = allAsteriskMatches.some(
        (am) => match!.index < am.end && match!.index + match![0].length > am.start
      );
      if (!overlaps) {
        quotedMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[1],
        });
      }
    }

    // Combine and sort all matches by position
    const allMatches = [
      ...doubleMatches.map((m) => ({ ...m, type: 'double' as const })),
      ...singleMatches.map((m) => ({ ...m, type: 'single' as const })),
      ...quotedMatches.map((m) => ({ ...m, type: 'quoted' as const })),
    ].sort((a, b) => a.start - b.start);

    // Build the parts array
    let lastIndex = 0;
    for (const match of allMatches) {
      if (match.start > lastIndex) {
        parts.push(text.slice(lastIndex, match.start));
      }
      parts.push(
        <strong key={`bold-${keyCounter++}-${match.start}`} className="font-semibold text-gray-900">
          {match.content}
        </strong>
      );
      lastIndex = match.end;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          return <div key={`empty-${idx}`} className="h-2" />;
        }
        const headingMatch = /^\s*#{1,6}\s+(.+)/.exec(line);
        if (headingMatch) {
          return (
            <div key={`h-${idx}`} className="font-bold text-base text-gray-900 mb-1">
              {headingMatch[1]}
            </div>
          );
        }
        return (
          <div key={`p-${idx}`} className="whitespace-pre-wrap text-gray-700">
            {renderInlineBold(line)}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Converts markdown to plain text by stripping all markdown syntax
 */
export const convertMarkdownToPlainText = (input?: string | null) => {
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
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
};

