import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { listProductRefinerSessions, exportProductRefinerPDF, type ProductRefinerSession } from "@/lib/product-refiner-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar, Download, FileText, Loader2, User } from "lucide-react";

const ProductRefinerPreviousSessions = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ProductRefinerSession[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentWorkspace?.id) {
      toast({
        title: "No Workspace Selected",
        description: "Please select a workspace to view previous Product Refiner sessions",
        variant: "destructive",
      });
      navigate("/tools/products");
      return;
    }
    void loadSessions();
  }, [currentWorkspace?.id]);

  const loadSessions = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const all = await listProductRefinerSessions(currentWorkspace.id);
      // Filter for completed sessions (status === 'completed' or step10Completed === true)
      const completed = (all || []).filter(
        (s) => s.status === "completed" || s.step10Completed === true || Boolean(s.completedAt)
      );
      setSessions(completed);
    } catch (error: any) {
      console.error("Failed to load Product Refiner sessions:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load previous Product Refiner sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (session: ProductRefinerSession) => {
    if (downloadingIds.has(session.id)) return;
    setDownloadingIds((prev) => new Set(prev).add(session.id));
    try {
      const blob = await exportProductRefinerPDF(session.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const date = session.completedAt ? new Date(session.completedAt) : new Date(session.updatedAt || session.createdAt);
      const timestamp = date.toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5);
      const sessionName = session.sessionName || session.userName || "Product";
      const fileName = `Product-Refiner-${sessionName}-${timestamp}.pdf`;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: `Downloaded ${fileName}`,
      });
    } catch (error: any) {
      console.error("Failed to download Product Refiner PDF:", error);
      toast({
        title: "Download Failed",
        description: error?.message || "Failed to download product specification PDF",
        variant: "destructive",
      });
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(session.id);
        return next;
      });
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden bg-gradient-to-br from-background via-background to-vox-orange/5 flex items-center justify-center p-6">
      <div className="max-w-6xl w-full max-h-full flex flex-col space-y-6 overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/tools/products")}
              className="border-vox-orange/20 bg-background hover:!bg-gradient-to-r hover:!from-vox-orange/80 hover:!to-vox-pink/80 hover:!text-white hover:!border-vox-orange/40 transition-all duration-300 ease-in-out hover:shadow-md hover:shadow-vox-orange/20 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Product Tools
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-vox-orange via-vox-pink to-vox-orange bg-clip-text text-transparent">
                Previous Product Refiner Sessions
              </h1>
              <p className="text-muted-foreground mt-1">
                View and download completed product specifications
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <Card className="border-vox-orange/20 flex-1 flex items-center justify-center">
            <CardContent className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-vox-orange" />
              <span className="ml-3 text-muted-foreground">Loading sessions...</span>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="border-vox-orange/20 flex-1 flex items-center justify-center">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Completed Sessions</h3>
              <p className="text-muted-foreground mb-6">
                You haven't completed any Product Refiner sessions yet. Start a session to see it here.
              </p>
              <Button
                onClick={() => {
                  navigate("/tools/product-refiner", { state: { scrollToBottom: true } as any });
                }}
                className="bg-gradient-to-r from-vox-orange to-vox-pink text-white"
              >
                Create New Session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 overflow-y-auto flex-1 pr-2">
            {sessions.map((session) => {
              const isDownloading = downloadingIds.has(session.id);
              const date = session.completedAt ? new Date(session.completedAt) : new Date(session.createdAt);
              const timestamp = date.toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5);
              const sessionName = session.sessionName || session.userName || "Product";
              const fileName = `Product-Refiner-${sessionName}-${timestamp}.pdf`;

              return (
                <Card
                  key={session.id}
                  className="border-vox-orange/20 hover:border-vox-orange/40 transition-all duration-300 hover:shadow-lg"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-xl font-semibold text-foreground mb-1">
                            {session.sessionName || session.userName || "Product Refinement Session"}
                          </h3>
                          <p className="text-sm text-muted-foreground font-mono">
                            {fileName}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {session.userName && (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>{session.userName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Completed: {formatDate(session.completedAt || session.updatedAt || session.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDownload(session)}
                        disabled={isDownloading}
                        className="bg-gradient-to-r from-vox-orange to-vox-pink text-white hover:shadow-lg transition-all duration-300 shrink-0"
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductRefinerPreviousSessions;

