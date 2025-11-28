import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Calendar, User, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getVeraProfiles, type VeraProfile } from "@/lib/vera-api";
import { AuthService } from "@/lib/auth";
import { API_BASE_URL } from "@/config/api.config";

const VeraPreviousProfiles = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<VeraProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentWorkspace?.id) {
      toast({
        title: "No Workspace Selected",
        description: "Please select a workspace to view previous profiles",
        variant: "destructive",
      });
      navigate("/tools/vera");
      return;
    }

    loadProfiles();
  }, [currentWorkspace?.id]);

  const loadProfiles = async () => {
    if (!currentWorkspace?.id) return;

    setLoading(true);
    try {
      const response = await getVeraProfiles(currentWorkspace.id);
      const profilesList = response?.data || [];
      // Only show completed profiles, sorted by most recently updated
      const sorted = profilesList
        .filter((profile: VeraProfile) => profile.isComplete)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      setProfiles(sorted);
    } catch (error: any) {
      console.error("Failed to load profiles:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load previous profiles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (profile: VeraProfile) => {
    if (downloadingIds.has(profile.id)) return;

    setDownloadingIds((prev) => new Set(prev).add(profile.id));
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/vera-profiles/${profile.id}/export/pdf`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Format filename like Product Refiner: Vera-Profile-{userName}-{date}
      const date = profile.completedAt 
        ? new Date(profile.completedAt).toISOString().split('T')[0]
        : new Date(profile.createdAt).toISOString().split('T')[0];
      const userName = profile.userName || 'Client';
      a.download = `Vera-Profile-${userName}-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: `Downloaded ${a.download}`,
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
        next.delete(profile.id);
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

  const getStatusBadge = () => (
    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
      Complete
    </span>
  );

  const handleContinueProfile = (profile: VeraProfile) => {
    navigate("/tools/vera", { state: { profileId: profile.id } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-vox-pink" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/tools/vera")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Vera Creator
          </Button>
          <h1 className="text-3xl font-bold mb-2">Previous Voice Identity Profiles</h1>
          <p className="text-gray-600">
            View and download your completed voice identity profiles.
          </p>
        </div>

        {profiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Completed Profiles Yet</h3>
              <p className="text-gray-600 mb-6">
                Finish a Vera journey to see it listed here.
              </p>
              <Button
                onClick={() => navigate("/tools/vera")}
                className="bg-vox-pink hover:bg-vox-pink/90"
              >
                Create Your First Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <Card key={profile.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold flex-1">{profile.name}</h3>
                    {getStatusBadge()}
                  </div>

                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    {profile.userName && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{profile.userName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {profile.isComplete && profile.completedAt
                          ? `Completed ${formatDate(profile.completedAt)}`
                          : `Updated ${formatDate(profile.updatedAt)}`}
                      </span>
                    </div>
                    {profile.consistencyScore !== null && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Consistency Score:</span>
                        <span
                          className={
                            profile.consistencyScore >= 80
                              ? "text-green-600 font-semibold"
                              : profile.consistencyScore >= 60
                              ? "text-yellow-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          {profile.consistencyScore}/100
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPDF(profile)}
                      disabled={downloadingIds.has(profile.id)}
                      className="flex-1"
                    >
                      {downloadingIds.has(profile.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          PDF
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleContinueProfile(profile)}
                      className="flex-1"
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VeraPreviousProfiles;

