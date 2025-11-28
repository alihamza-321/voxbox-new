import { useEffect, useState } from "react";
import { Loader2, Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateFinalSpecification, exportProductRefinerPDF, exportProductRefinerDOCX } from "@/lib/product-refiner-api";
import type { ProductRefinerSession } from "@/lib/product-refiner-api";
import { ChunkedText } from "@/components/margo/ChunkedText";

interface ProductRefinerStep10Props {
  workspaceId: string;
  session: ProductRefinerSession;
  isActive: boolean;
  isCompleted: boolean;
  onSessionChange: (session: ProductRefinerSession) => void;
  onError?: (message: string | null) => void;
  isUnlocked?: boolean;
}

export const ProductRefinerStep10 = ({
  session,
  isActive,
  isCompleted,
  onSessionChange,
  onError,
  isUnlocked = false,
}: ProductRefinerStep10Props) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingDOCX, setIsDownloadingDOCX] = useState(false);

  useEffect(() => {
    if (isActive && !isCompleted && !hasGenerated && session.step9Completed) {
      handleGenerateFinalSpec();
    }
  }, [isActive, isCompleted, hasGenerated, session.step9Completed]);

  const handleGenerateFinalSpec = async () => {
    if (!session.id || hasGenerated || isGenerating) return;

    setIsGenerating(true);
    setHasGenerated(true);
    onError?.(null);

    try {
      const response = await generateFinalSpecification(session.id);
      
      const updatedSession: ProductRefinerSession = {
        ...session,
        step10FinalSpecification: response.finalSpecification || null,
        step10Completed: true,
        status: "completed",
        completedAt: new Date().toISOString(),
      };
      onSessionChange(updatedSession);
    } catch (error: any) {
      const message = error?.message || "Failed to generate final specification";
      onError?.(message);
      setHasGenerated(false);
      toast({
        title: "Generation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!session.id) {
      toast({
        title: "Session missing",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingPDF(true);

    try {
      const blob = await exportProductRefinerPDF(session.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      // Format filename like AVA: Product-Refiner-{userName}-{date}.pdf
      const date = session.completedAt 
        ? new Date(session.completedAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const userName = session.userName || session.sessionName || "Client";
      const fileName = `Product-Refiner-${userName}-${date}.pdf`;
      
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Profile Downloaded",
        description: `Downloaded ${fileName}`,
      });
    } catch (error: any) {
      console.error("Failed to download PDF:", error);
      toast({
        title: "Download Failed",
        description: error?.message || "Failed to download Product Specification PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleDownloadDOCX = async () => {
    if (!session.id) {
      toast({
        title: "Session missing",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingDOCX(true);

    try {
      const blob = await exportProductRefinerDOCX(session.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName =
        session.sessionName?.trim().replace(/[^\w\d-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "product-specification";
      link.href = url;
      link.download = `${safeName}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Download started",
        description: "Your Product Specification DOCX is downloading.",
      });
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error?.message || "Unable to download the Product Specification.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingDOCX(false);
    }
  };

  if (!isUnlocked && !isActive && !isCompleted) {
    return null;
  }

  return (
    <>
      {isActive && !isCompleted && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <ChunkedText
              text={`Pricing structure saved! Now let's generate your final Product Specification document that compiles all the refined elements.`}
              staggerMs={30}
            />
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="margo-chat-bubble margo-chat-bubble--bot">
          <div className="margo-message-content">
            <div className="flex items-start gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Generating your Product Specification...</p>
                <p className="text-sm text-gray-600 mt-1">Compiling all refined elements into a complete document.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCompleted && (
        <>
          {session.step10FinalSpecification && (
            <div className="margo-chat-bubble margo-chat-bubble--bot">
              <div className="margo-message-content">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Product Specification</h3>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDownloadPDF}
                        disabled={isDownloadingPDF || isDownloadingDOCX}
                        size="sm"
                        variant="outline"
                      >
                        {isDownloadingPDF ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        PDF
                      </Button>
                      <Button
                        onClick={handleDownloadDOCX}
                        disabled={isDownloadingPDF || isDownloadingDOCX}
                        size="sm"
                        variant="outline"
                      >
                        {isDownloadingDOCX ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <FileText className="h-4 w-4 mr-2" />
                        )}
                        DOCX
                      </Button>
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm text-gray-700">
                      {session.step10FinalSpecification}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="margo-chat-bubble margo-chat-bubble--bot">
            <div className="margo-message-content">
              <p className="text-sm text-gray-600">✓ Step 10 completed - Final Product Specification generated</p>
            </div>
          </div>

          <div className="margo-chat-bubble margo-chat-bubble--bot">
            <div className="margo-message-content bg-green-50 border border-green-200">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-green-900 mb-2">🎉 Your product refinement journey is now complete!</h4>
                  <p className="text-sm text-green-800">
                    You've successfully refined your product into a complete, strong, and confidently positioned offer.
                    {session.step10FinalSpecification 
                      ? " Review your Product Specification above and download it in PDF or Word format."
                      : " Download your Product Specification in PDF or Word format below."
                    }
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleDownloadPDF}
                      disabled={isDownloadingPDF || isDownloadingDOCX}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isDownloadingPDF ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleDownloadDOCX}
                      disabled={isDownloadingPDF || isDownloadingDOCX}
                      size="sm"
                      variant="outline"
                      className="border-green-600 text-green-700 hover:bg-green-50"
                    >
                      {isDownloadingDOCX ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Download DOCX
                        </>
                      )}
                    </Button>
                  </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

