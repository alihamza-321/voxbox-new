import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChunkedText } from "@/components/margo/ChunkedText";
import {
  submitMargoStep7Generate,
  fetchMargoFinalProductBriefData,
  fetchMargoFinalProductBrief,
  type MargoBrief,
  type MargoStep7Section,
} from "@/lib/margo-api";
import { useToast } from "@/hooks/use-toast";
import { renderMinimalMarkdown, convertMarkdownToPlainText } from "@/lib/margo-text-utils";

interface MargoStep7Props {
  session: MargoBrief;
  isActive: boolean;
  isCompleted?: boolean;
  onSessionChange: (session: MargoBrief) => void;
  onComplete?: (sections: MargoStep7Section[]) => void;
  state: MargoStep7UIState;
  onStateChange: (updater: (current: MargoStep7UIState) => MargoStep7UIState) => void;
  onStartNew?: () => void;
}

const MAX_SECTIONS = 9;
const ORDINAL_LABELS = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
  "Ninth",
];

// Note: convertMarkdownToPlainText and renderMinimalMarkdown are now imported from @/lib/margo-text-utils

const createPdfBlobFromBrief = (
  title: string,
  summary: string | null,
  sections: MargoStep7Section[]
): Blob => {
  const PAGE_WIDTH = 612;
  const PAGE_HEIGHT = 792;
  const TOP_MARGIN = 36;
  const LEFT_MARGIN = 20;
  const RIGHT_MARGIN = PAGE_WIDTH - 40;
  const FONT_SIZE = 12;
  const LINE_HEIGHT = FONT_SIZE + 2;
  const MAX_DIVIDER_LENGTH = 48;
  const TEXT_WIDTH = RIGHT_MARGIN - LEFT_MARGIN;
  const AVERAGE_CHAR_WIDTH = 6.5;
  const MAX_LINE_LENGTH = Math.max(32, Math.floor(TEXT_WIDTH / AVERAGE_CHAR_WIDTH));
  const MAX_LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - TOP_MARGIN * 2) / LINE_HEIGHT);
  const BODY_INDENT = "    ";

  const clampDivider = (input: string) => {
    const trimmed = input.trim();
    if (/^=+$/.test(trimmed) && trimmed.length > MAX_DIVIDER_LENGTH) {
      return "=".repeat(MAX_DIVIDER_LENGTH);
    }
    return input;
  };

  const wrapLine = (input: string, maxChars: number = MAX_LINE_LENGTH): string[] => {
    const raw = clampDivider(input);
    const trimmed = raw.trim();
    if (!trimmed) {
      return [""];
    }

    const words = trimmed.split(/\s+/);
    const wrapped: string[] = [];
    let current = "";

    words.forEach((word) => {
      const tentative = current ? `${current} ${word}` : word;
      if (tentative.length <= maxChars) {
        current = tentative;
      } else {
        if (current) {
          wrapped.push(current);
        }
        if (word.length > maxChars) {
          let remaining = word;
          while (remaining.length > maxChars) {
            wrapped.push(remaining.slice(0, maxChars));
            remaining = remaining.slice(maxChars);
          }
          current = remaining;
        } else {
          current = word;
        }
      }
    });

    if (current) {
      wrapped.push(current);
    }

    return wrapped.length > 0 ? wrapped : [""];
  };

  const appendContent = (lines: string[], content: string, indent = BODY_INDENT) => {
    content.split(/\n/).forEach((line) => {
      if (!line.trim()) {
        lines.push("");
        return;
      }
      const available = Math.max(20, MAX_LINE_LENGTH - indent.length);
      wrapLine(line, available).forEach((wrapped) => {
        lines.push(indent + wrapped);
      });
    });
  };

  const sanitizedSummary = summary ? convertMarkdownToPlainText(summary) : "";
  const lines: string[] = [];

  lines.push(title.toUpperCase());
  lines.push(`${BODY_INDENT}${new Date().toLocaleString()}`);
  lines.push("");

  if (sanitizedSummary) {
    appendContent(lines, sanitizedSummary);
    lines.push("");
  }

  sections.forEach((section, index) => {
    const sectionTitle = (section.title || `Section ${index + 1}`).toUpperCase();
    const sectionContent = convertMarkdownToPlainText(section.content || "");
    lines.push("");
    lines.push(`${BODY_INDENT}SECTION ${index + 1}: ${sectionTitle}`);
    lines.push("");
    appendContent(lines, sectionContent, BODY_INDENT + "  ");
  });

  if (lines.length === 0) {
    lines.push(title);
  }

  const escapePdfText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const pages: string[][] = [];
  lines.forEach((line) => {
    const current = pages[pages.length - 1];
    if (!current || current.length >= MAX_LINES_PER_PAGE) {
      pages.push([]);
    }
    pages[pages.length - 1].push(line);
  });

  const objects: string[] = [];
  const kidsRefs: string[] = [];
  const pageObjects: { pageObjId: number; contentObjId: number }[] = [];

  pages.forEach((pageLines, pageIndex) => {
    const pageObjId = 3 + pageIndex * 2;
    const contentObjId = pageObjId + 1;
    pageObjects.push({ pageObjId, contentObjId });
    kidsRefs.push(`${pageObjId} 0 R`);

    let textStream = `BT\n/F1 ${FONT_SIZE} Tf\n1 0 0 1 ${LEFT_MARGIN} ${PAGE_HEIGHT - TOP_MARGIN} Tm\n`;
    pageLines.forEach((rawLine, lineIndex) => {
      const escaped = escapePdfText(rawLine);
      if (lineIndex === 0) {
        if (escaped) {
          textStream += `(${escaped}) Tj\n`;
        }
      } else {
        textStream += `0 -${LINE_HEIGHT} Td\n`;
        if (escaped) {
          textStream += `(${escaped}) Tj\n`;
        }
      }
    });
    textStream += "ET";

    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 5 0 R >> >> /CropBox [${LEFT_MARGIN} 0 ${RIGHT_MARGIN} ${PAGE_HEIGHT}] >>\nendobj`
    );
    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${textStream.length} >>\nstream\n${textStream}\nendstream\nendobj`
    );
  });

  const fontObjId = 3 + pages.length * 2;

  objects.unshift(`2 0 obj\n<< /Type /Pages /Kids [${kidsRefs.join(" ")}] /Count ${pages.length} >>\nendobj`);
  objects.unshift("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push(`${fontObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  let pdf = "%PDF-1.4\n";
  const offsets: string[] = ["0000000000 65535 f \n"];

  objects.forEach((obj) => {
    const offset = pdf.length;
    offsets.push(String(offset).padStart(10, "0") + " 00000 n \n");
    pdf += obj + "\n";
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  offsets.forEach((entry) => {
    pdf += entry;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
};

export interface MargoStep7UIState {
  sections: MargoStep7Section[];
  generateAttempts: number;
  statusMessage: string | null;
  completionMessage: string | null;
  statusHistory: string[];
  statusHistoryContent: string[];
  finalBriefText: string | null;
  finalSections: MargoStep7Section[];
}




export const MargoStep7 = ({ session, isActive, isCompleted: _isCompleted = false, onSessionChange, onComplete, state, onStateChange, onStartNew }: MargoStep7Props) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const { sections, generateAttempts, statusMessage, completionMessage, statusHistory, finalBriefText, finalSections,statusHistoryContent } = state;

  useEffect(() => {
    if (!isActive) {
      setErrorMessage(null);
      setIsGenerating(false);
    }
  }, [isActive]);
  console.log("statusHistoryContent....",statusHistoryContent);

  const handleGenerate = async () => {
    if (!session?.id || isGenerating || generateAttempts >= MAX_SECTIONS) return;

    try {
      setIsGenerating(true);
      setErrorMessage(null);

      const response = await submitMargoStep7Generate(session.id, { message: "generate" });
      const payload = response?.data ?? {};
      const nextSection = payload?.section ?? null;
      const progress = (payload as any)?.progress as { completed?: number; total?: number } | undefined;
      const responseMessage = (payload as any)?.message as string | undefined;
      const responseMessageContent = (payload as any)?.content as string | undefined;
      const payloadFinalBrief = (payload as any)?.finalProductBrief ?? (payload as any)?.finalBrief ?? null;
      const payloadSections = Array.isArray((payload as any)?.sections)
        ? ((payload as any)?.sections as MargoStep7Section[])
        : null;

      const backendSignalsComplete = Boolean((payload as any)?.isComplete);
      const progressSignalsComplete =
        progress?.completed !== undefined &&
        progress?.total !== undefined &&
        progress.completed >= progress.total;

      const nextAttempts = generateAttempts + 1;
      const updatedSections = nextSection ? [...sections, nextSection] : sections;
      const nextAction = (payload?.nextAction as string | undefined) || "step7_generating";

      const totalTarget = progress?.total ?? MAX_SECTIONS;
      const completedCount = progress?.completed ?? updatedSections.length;

      const fallbackProgressMessage =
        completedCount > 0 && completedCount < totalTarget
          ? `Section ${completedCount}/${totalTarget} generated successfully! Continue to generate the next section.`
          : null;

      const displayMessage = responseMessage || fallbackProgressMessage;
      
      // Completion message for when all sections are generated
      const completionFallbackMessage = 
        completedCount >= totalTarget || updatedSections.length >= MAX_SECTIONS
          ? `All ${totalTarget} sections have been generated. Your product brief is complete!`
          : null;

      // Only mark as complete if:
      // 1. Backend explicitly signals complete AND we have the 9th section, OR
      // 2. Progress shows all sections completed (completed >= total) AND we have all sections, OR
      // 3. nextAction is explicitly "step7_complete" AND we have all sections, OR
      // 4. We have exactly MAX_SECTIONS (9) sections generated (not just attempts)
      // Don't complete if we haven't generated the 9th section yet
      const hasAllSections = updatedSections.length >= MAX_SECTIONS;
      const willComplete =
        (backendSignalsComplete && hasAllSections) ||
        (progressSignalsComplete && hasAllSections) ||
        (nextAction === "step7_complete" && hasAllSections) ||
        (hasAllSections && completedCount >= totalTarget);

      const completionCopy = willComplete
        ? responseMessage ||
          completionFallbackMessage ||
          `MARGO brief profile completed. (${progress?.completed ?? totalTarget}/${totalTarget})`
        : undefined;

      onStateChange((current) => {
        const nextHistory = displayMessage
          ? [...current.statusHistory, displayMessage].slice(-MAX_SECTIONS)
          : current.statusHistory;

        const nextContentHistory = responseMessageContent
          ? [...(current.statusHistoryContent || []), responseMessageContent].slice(-MAX_SECTIONS)
          : current.statusHistoryContent || [];

        return {
          ...current,
          sections: updatedSections,
          generateAttempts: nextAttempts,
          statusMessage: willComplete ? null : displayMessage ?? current.statusMessage,
          statusHistory: nextHistory,
          statusHistoryContent: nextContentHistory,
          completionMessage: completionCopy ?? current.completionMessage,
          finalBriefText: payloadFinalBrief ?? current.finalBriefText,
          finalSections: payloadSections ?? current.finalSections,
        };
      });

      onSessionChange({
        ...session,
        currentStep: Math.max(session.currentStep ?? 6, 7),
        nextAction,
      });

      if (willComplete) {
        handleComplete(payloadSections ?? updatedSections, completionCopy ?? undefined);
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to generate the next section. Please try again.";
      
      // Check if backend indicates we're already past step 7 (shouldn't happen, but handle gracefully)
      if (errorMessage.includes("current step is") && errorMessage.includes("Expected step 7")) {
        // Backend is already past step 7, mark as complete
        onSessionChange({
          ...session,
          currentStep: 7,
          nextAction: "step7_complete",
        });
        
        toast({
          title: "Already completed",
          description: "This step has already been completed.",
          variant: "default",
        });
        
        setErrorMessage(null);
      } else {
        setErrorMessage(errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = (finalSectionsInput?: MargoStep7Section[], completionCopy?: string) => {
    const mergedSections = finalSectionsInput ?? sections;
    onSessionChange({
      ...session,
      currentStep: Math.max(session.currentStep ?? 6, 7),
      nextAction: "step7_complete",
    });
    if (completionCopy) {
      onStateChange((current) => ({
        ...current,
        completionMessage: completionCopy,
      }));
    }
    onComplete?.(mergedSections);
  };

  const handleDownloadBrief = async () => {
    if (isDownloading) return;
    if (!session?.id) {
      toast({
        title: "Download unavailable",
        description: "No MARGO session found.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsDownloading(true);

      // Try to fetch PDF from backend first (properly formatted with font embedding)
      try {
        const pdfBlob = await fetchMargoFinalProductBrief(session.id);
        
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "Margo - Product Brief.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({
          title: "Download started",
          description: "Your Product Positioning Brief PDF is downloading.",
        });
        return;
      } catch (backendError) {
        console.warn("Backend PDF generation failed, falling back to client-side generation:", backendError);
        
        // Fallback to client-side generation if backend fails
        let summarySource = finalBriefText ?? null;
        let sectionSource = finalSections.length > 0 ? finalSections : sections;

        try {
          const payload = await fetchMargoFinalProductBriefData(session.id);
          if (payload?.data) {
            if (payload.data.finalProductBrief) {
              summarySource = payload.data.finalProductBrief;
            }
            if (Array.isArray(payload.data.sections) && payload.data.sections.length > 0) {
              sectionSource = payload.data.sections;
            }
          }
        } catch (error) {
          console.warn("Unable to fetch final product brief data; falling back to local state", error);
        }

        if (!summarySource && sectionSource.length === 0) {
          toast({
            title: "Download unavailable",
            description: "Generate the brief first to download the PDF.",
            variant: "destructive",
          });
          return;
        }

        const pdfBlob = createPdfBlobFromBrief("Margo - Product Brief", summarySource, sectionSource);

        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "Margo - Product Brief.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({
          title: "Download started",
          description: "Your Product Positioning Brief PDF is downloading (client-side generation).",
        });
      }
    } catch (error: any) {
      console.error("MARGO final brief download failed", error);
      toast({
        title: "Download failed",
        description: error?.message || "Unable to download the Product Positioning Brief.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const generationCount = sections.length;
  const canGenerateMore = generateAttempts < MAX_SECTIONS && generationCount < MAX_SECTIONS;
  const primaryButtonLabel =
    generationCount === 0 ? "Generate Product Positioning Brief" : "Generate Product Positioning Brief again";

  return (
    <div className="space-y-4">
      <div className="margo-chat-bubble margo-chat-bubble--bot">
        <div className="margo-message-content">
          <ChunkedText
            text={
              generationCount === 0
                ? "Ready for the final synthesis? I'll craft each section of your Product Positioning Brief one at a time."
                : "Keep the momentum going—each click stitches another section into your Product Positioning Brief."
            }
            chunkClassName="text-sm"
            animation="typewriter"
            isChunk={false}
            minChunkLength={70}
            staggerMs={300}
          />
        </div>
      </div>
      {statusMessage && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <ChunkedText
              key={statusMessage}
              text={statusMessage}
              chunkClassName="text-sm"
              animation="typewriter"
              isChunk={false}
              minChunkLength={20}
              staggerMs={200}
            />
          </div>
        </div>
      )}
      {((statusHistoryContent && statusHistoryContent.length > 0) || statusHistory.length > 0) && (
        <div className="space-y-2">
          {Array.from({ length: Math.max(statusHistory.length, statusHistoryContent?.length || 0) }).map((_, index) => {
            const userMsg = statusHistory[index] || null;
            const botRaw = (statusHistoryContent && statusHistoryContent[index]) ? statusHistoryContent[index] : null;
            return (
              <div key={`chat-row-${index}`} className="space-y-2">
                {userMsg && (
                  <div className="margo-chat-bubble margo-chat-bubble--user">
                    <div className="margo-message-content">
                      <span className="whitespace-pre-wrap leading-relaxed">{userMsg}</span>
                    </div>
                  </div>
                )}
                {botRaw && (
                  <div className="margo-chat-bubble margo-chat-bubble--bot">
                    <div className="margo-message-content">
                      {renderMinimalMarkdown(botRaw)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {canGenerateMore && (
        <div className="ml-4 mb-4">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="margo-soft-button w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              primaryButtonLabel
            )}
          </Button>
        </div>
      )}
      {generationCount > 0 && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="space-y-4">
              <p className="text-xs font-medium text-gray-500">
                Generated Sections ({generationCount} / {MAX_SECTIONS})
              </p>
              <div className="space-y-3">
                {sections.map((section, index) => (
                  <div key={section.id || `section-${index}`} className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-xs font-medium text-gray-500">{`Section ${index + 1}`}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {`${ORDINAL_LABELS[index] ?? `Brief ${index + 1}`} Product Positioning Brief generated`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Progress {index + 1}/{MAX_SECTIONS}
                    </p>
                    <h3 className="text-base font-semibold text-gray-900 mt-2">{section.title || `Section ${index + 1}`}</h3>
                    <Textarea
                      value={convertMarkdownToPlainText(section.content)}
                      onChange={(event) =>
                        onStateChange((current) => {
                          const updated = current.sections.map((entry, idx) =>
                            idx === index ? { ...entry, content: event.target.value } : entry
                          );
                          return {
                            ...current,
                            sections: updated,
                          };
                        })
                      }
                      className="mt-3 min-h-[120px] rounded border-gray-300 bg-white text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {(statusHistoryContent.length === MAX_SECTIONS || completionMessage) && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-gray-500">Journey Complete</p>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">Product Positioning Brief ready</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {completionMessage || `All ${MAX_SECTIONS} sections have been generated. Your product brief is complete!`}
                  </p>
                </div>
              </div>

              {finalBriefText && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Executive Summary</p>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                    {convertMarkdownToPlainText(finalBriefText)}
                  </div>
                </div>
              )}

              {((finalSections.length > 0) || (generationCount >= MAX_SECTIONS && sections.length > 0)) && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-500">Brief Sections</p>
                  <div className="grid gap-3">
                    {(finalSections.length > 0 ? finalSections : sections).map((section, index) => (
                      <div key={section.id || `final-section-${index}`} className="rounded-lg border border-gray-200 bg-white p-4">
                        <p className="text-xs font-medium text-gray-500">{section.title || `Section ${index + 1}`}</p>
                        <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                          {convertMarkdownToPlainText(section.content)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-4 border-t border-gray-200 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-gray-500">
                  Archived in this workspace and ready to share with Amplifier collaborators.
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    onClick={handleDownloadBrief}
                    disabled={isDownloading}
                    variant="outline"
                    className="margo-soft-button margo-soft-button--outline"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Preparing PDF…
                      </>
                    ) : (
                      "Download PDF"
                    )}
                  </Button>
                  {onStartNew && (
                    <Button type="button" onClick={onStartNew} className="margo-soft-button">
                      Start a new MARGO
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content bg-red-50 border-red-200">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MargoStep7;
