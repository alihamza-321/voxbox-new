import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { listWorkspaceBriefs, type WorkspaceBrief, fetchMargoFinalProductBrief } from "@/lib/margo-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar, Download, FileText, Loader2, User } from "lucide-react";

const MargoPreviousBriefs = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [briefs, setBriefs] = useState<WorkspaceBrief[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentWorkspace?.id) {
      toast({
        title: "No Workspace Selected",
        description: "Please select a workspace to view previous MARGO briefs",
        variant: "destructive",
      });
      navigate("/tools/products");
      return;
    }
    void loadBriefs();
  }, [currentWorkspace?.id]);

  const loadBriefs = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const all = await listWorkspaceBriefs(currentWorkspace.id);
      // Completed if status says so or final step completed or a completedAt timestamp exists
      const completed = (all || []).filter(
        (b) => b.status === "completed" || Boolean((b as any).step7Completed) || Boolean(b.completedAt)
      );
      setBriefs(completed);
    } catch (error: any) {
      console.error("Failed to load MARGO briefs:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load previous MARGO briefs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (brief: WorkspaceBrief) => {
    if (downloadingIds.has(brief.id)) return;
    setDownloadingIds((prev) => new Set(prev).add(brief.id));
    try {
      const blob = await fetchMargoFinalProductBrief(brief.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const date = brief.completedAt ? new Date(brief.completedAt) : new Date(brief.updatedAt || brief.createdAt);
      const timestamp = date.toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5);
      const submitName = brief.userName || brief.sessionName || "Client";
      const fileName = `Margo-Product-Brief-${submitName}-${timestamp}.pdf`;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Brief Downloaded",
        description: `Downloaded ${fileName}`,
      });
    } catch (error: any) {
      console.error("Failed to download MARGO brief:", error);
      toast({
        title: "Download Failed",
        description: error?.message || "Failed to download product brief PDF",
        variant: "destructive",
      });
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(brief.id);
        return next;
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden bg-gradient-to-br from-background via-background to-vox-pink/5 flex items-center justify-center p-6">
      <div className="max-w-6xl w-full max-h-full flex flex-col space-y-6 overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/tools/products")}
              className="border-vox-pink/20 bg-background hover:!bg-gradient-to-r hover:!from-vox-pink/80 hover:!to-vox-orange/80 hover:!text-white hover:!border-vox-pink/40 transition-all duration-300 ease-in-out hover:shadow-md hover:shadow-vox-pink/20 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to MARGO
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-vox-pink via-vox-orange to-vox-pink bg-clip-text text-transparent">
                Previous MARGO Briefs
              </h1>
              <p className="text-muted-foreground mt-1">
                View and download completed product briefs
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <Card className="border-vox-pink/20 flex-1 flex items-center justify-center">
            <CardContent className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-vox-pink" />
              <span className="ml-3 text-muted-foreground">Loading briefs...</span>
            </CardContent>
          </Card>
        ) : briefs.length === 0 ? (
          <Card className="border-vox-pink/20 flex-1 flex items-center justify-center">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Completed Briefs</h3>
              <p className="text-muted-foreground mb-6">
                You haven't completed any MARGO briefs yet. Start a MARGO session to see it here.
              </p>
              <Button
                onClick={() => {
                  navigate("/tools/margo", { state: { scrollToBottom: true } as any });
                }}
                className="bg-gradient-to-r from-vox-pink to-vox-orange text-white"
              >
                Create New Brief
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 overflow-y-auto flex-1 pr-2">
            {briefs.map((brief) => {
              const isDownloading = downloadingIds.has(brief.id);
              const date = brief.completedAt ? new Date(brief.completedAt) : new Date(brief.createdAt);
              const timestamp = date.toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5);
              const submitName = brief.userName || brief.sessionName || "Client";
              const fileName = `Margo-Product-Brief-${submitName}-${timestamp}.pdf`;

              return (
                <Card
                  key={brief.id}
                  className="border-vox-pink/20 hover:border-vox-pink/40 transition-all duration-300 hover:shadow-lg"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-xl font-semibold text-foreground mb-1">
                            {brief.sessionName}
                          </h3>
                          <p className="text-sm text-muted-foreground font-mono">
                            {fileName}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {brief.userName && (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>{brief.userName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Completed: {formatDate(brief.completedAt || brief.updatedAt || brief.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDownload(brief)}
                        disabled={isDownloading}
                        className="bg-gradient-to-r from-vox-pink to-vox-orange text-white hover:shadow-lg transition-all duration-300 shrink-0"
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

export default MargoPreviousBriefs;


