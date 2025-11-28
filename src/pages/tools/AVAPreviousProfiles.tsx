import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Calendar, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listWorkspaceSessions, exportProfilePDF, type WorkspaceSession } from "@/lib/ava-api";

const AVAPreviousProfiles = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [completedSessions, setCompletedSessions] = useState<WorkspaceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentWorkspace?.id) {
      toast({
        title: "No Workspace Selected",
        description: "Please select a workspace to view previous profiles",
        variant: "destructive",
      });
      navigate("/tools/ava");
      return;
    }

    loadCompletedSessions();
  }, [currentWorkspace?.id]);

  const loadCompletedSessions = async () => {
    if (!currentWorkspace?.id) return;

    setLoading(true);
    try {
      const response = await listWorkspaceSessions(currentWorkspace.id);
      // Only show completed sessions (status === 'completed')
      const completed = response.completed || [];
      setCompletedSessions(completed);
    } catch (error: any) {
      console.error("Failed to load completed sessions:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load previous profiles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (session: WorkspaceSession) => {
    if (downloadingIds.has(session.id)) return;

    setDownloadingIds((prev) => new Set(prev).add(session.id));
    try {
      const blob = await exportProfilePDF(session.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Format: Ava-Profile-{submit name}-{timestamps}
      const date = session.completedAt ? new Date(session.completedAt) : new Date(session.createdAt);
      const timestamp = date.toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5); // Format: YYYY-MM-DD-HH-MM-SS
      const submitName = session.userName || session.sessionName || "Client";
      const fileName = `Ava-Profile-${submitName}-${timestamp}.pdf`;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Profile Downloaded",
        description: `Downloaded ${fileName}`,
      });
    } catch (error: any) {
      console.error("Failed to download PDF:", error);
      toast({
        title: "Download Failed",
        description: error?.message || "Failed to download profile PDF",
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
    <div className="h-[calc(100vh-80px)] overflow-hidden flex items-center justify-center p-6 relative">
      {/* Background with Colors */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[#020617] opacity-80"></div>
      <div className="max-w-6xl w-full max-h-full flex flex-col space-y-6 overflow-hidden relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/tools/ava")}
              className="border-slate-700/50 bg-slate-800/50 text-slate-200 hover:bg-gradient-to-r hover:from-cyan-500/80 hover:to-blue-500/80 hover:text-white hover:border-cyan-500/40 transition-all duration-300 ease-in-out hover:shadow-md hover:shadow-cyan-500/20 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100"
            >
              Back to AVA
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Previous Profiles
              </h1>
              <p className="text-slate-400 mt-1">
                View and download your completed AVA profiles
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <Card className="border-slate-700/50 bg-slate-900/40 backdrop-blur-xl flex-1 flex items-center justify-center">
            <CardContent className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <span className="ml-3 text-slate-400">Loading profiles...</span>
            </CardContent>
          </Card>
        ) : completedSessions.length === 0 ? (
          <Card className="border-slate-700/50 bg-slate-900/40 backdrop-blur-xl flex-1 flex items-center justify-center">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-slate-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-slate-100">No Completed Profiles</h3>
              <p className="text-slate-400 mb-6">
                You haven't completed any AVA profiles yet. Start creating your first profile to see it here.
              </p>
              <Button
                onClick={() => {
                  navigate("/tools/ava", { state: { scrollToBottom: true } });
                }}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg shadow-cyan-500/30"
              >
                Create New Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 overflow-y-auto flex-1 pr-2">
            {completedSessions.map((session) => {
              const isDownloading = downloadingIds.has(session.id);
              const date = session.completedAt ? new Date(session.completedAt) : new Date(session.createdAt);
              const timestamp = date.toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5); // Format: YYYY-MM-DD-HH-MM-SS
              const submitName = session.userName || session.sessionName || "Client";
              const fileName = `Ava-Profile-${submitName}-${timestamp}.pdf`;

              return (
                <Card
                  key={session.id}
                  className="border-slate-700/50 bg-slate-900/40 backdrop-blur-xl hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-100 mb-1">
                            {session.sessionName}
                          </h3>
                          <p className="text-sm text-slate-400 font-mono">
                            {fileName}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                          {session.userName && (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>{session.userName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Completed: {formatDate(session.completedAt || session.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleDownloadPDF(session)}
                        disabled={isDownloading}
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg shadow-cyan-500/30 transition-all duration-300 shrink-0"
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

export default AVAPreviousProfiles;

