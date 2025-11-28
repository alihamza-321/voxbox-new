import { useEffect, useState } from "react";
import { Loader2, Download, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { submitVeraStep10 } from "@/lib/vera-api";
import type { VeraProfile } from "@/lib/vera-api";
import { API_BASE_URL } from "@/config/api.config";
import { AuthService } from "@/lib/auth";
import avaAvatar from "@/assets/ava-avatar.png";
import { ChunkedText } from "@/components/margo/ChunkedText";
import FormattedChunkedText from "@/components/margo/FormattedChunkedText";

interface VeraStep10Props {
  workspaceId: string;
  profile: VeraProfile | null;
  isActive: boolean;
  isCompleted: boolean;
  onProfileChange: (profile: VeraProfile) => void;
  onError?: (message: string | null) => void;
}

export const VeraStep10 = ({
  profile,
  isActive,
  isCompleted,
  onProfileChange,
  onError,
}: VeraStep10Props) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [finalProfile, setFinalProfile] = useState<string | null>(null);

  useEffect(() => {
    setFinalProfile(profile?.finalProfile || null);
  }, [profile]);

  useEffect(() => {
    if (isActive && !isCompleted) {
      setTimeout(() => setShowIntro(true), 300);
      // Auto-generate final profile when step becomes active
      if (profile && !finalProfile) {
        handleGenerateFinal();
      }
    } else {
      setShowIntro(true);
      setIntroComplete(true);
    }
  }, [isActive, isCompleted]);

  const handleGenerateFinal = async () => {
    if (!profile || isGenerating) return;

    setIsGenerating(true);
    onError?.(null);

    try {
      const response = await submitVeraStep10(profile.id, { approve: false });

      const generated = response?.data?.finalProfile;
      if (generated) {
        setFinalProfile(generated);
        const updatedProfile: VeraProfile = {
          ...profile,
          finalProfile: generated,
        };
        onProfileChange(updatedProfile);
      }
    } catch (error: any) {
      const message = error?.message || "Failed to generate final profile";
      onError?.(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!profile || isSubmitting) return;

    setIsSubmitting(true);
    onError?.(null);

    try {
      const response = await submitVeraStep10(profile.id, { approve: true });

      const final = response?.data?.finalProfile || finalProfile;

      const updatedProfile: VeraProfile = {
        ...profile,
        finalProfile: final || profile.finalProfile,
        isComplete: true,
        completedAt: new Date().toISOString(),
        status: "completed",
      };

      onProfileChange(updatedProfile);

      toast({
        title: "Congratulations!",
        description: "Your Voice Identity Profile is now complete.",
      });
    } catch (error: any) {
      const message = error?.message || "Failed to finalize profile";
      onError?.(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!profile) return;
    
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
        description: "Your Voice Identity Profile has been downloaded as PDF.",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error?.message || "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  const handleDownloadWord = async () => {
    if (!profile) return;
    
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/vera-profiles/${profile.id}/export/docx`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to download Word document');
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
      a.download = `Vera-Profile-${userName}-${date}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Word Document Downloaded",
        description: "Your Voice Identity Profile has been downloaded as Word document.",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error?.message || "Failed to download Word document",
        variant: "destructive",
      });
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-6">
      {/* Step Intro */}
      {showIntro && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            {introComplete ? (
              <FormattedChunkedText text={`Congratulations, ${profile.userName || 'there'}!\n\nStep 10: Final Voice Identity Profile\n\nWe're at the final step! I'll now compile your complete voice identity into a polished, structured document.\n\nYour final profile will include:\n• Communication identity foundation\n• Personality traits\n• Style principles\n• Do's and Don'ts\n• Audience relationship map\n• Scenario guidelines\n• Model paragraphs\n• Calibration summary\n\nOnce you approve this final profile, your Voice Identity Profile will be complete and ready to use across all VoxBox tools.\n\nGenerating your final profile...`} />
            ) : (
              <ChunkedText
                text={`Congratulations, ${profile.userName || 'there'}!\n\nStep 10: Final Voice Identity Profile\n\nWe're at the final step! I'll now compile your complete voice identity into a polished, structured document.\n\nYour final profile will include:\n• Communication identity foundation\n• Personality traits\n• Style principles\n• Do's and Don'ts\n• Audience relationship map\n• Scenario guidelines\n• Model paragraphs\n• Calibration summary\n\nOnce you approve this final profile, your Voice Identity Profile will be complete and ready to use across all VoxBox tools.\n\nGenerating your final profile...`}
                onComplete={() => setIntroComplete(true)}
              />
            )}
          </div>
        </div>
      )}

      {isActive && !isCompleted && (
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-red-600">
              Final profile must be generated and reviewed before approving and downloading.
            </p>
          </div>
        </div>
      )}

      {/* Generating Indicator */}
      {isGenerating && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-vox-pink" />
              <p className="text-gray-700">Compiling your complete Voice Identity Profile...</p>
            </div>
          </div>
        </div>
      )}

      {/* Download Options - Show after profile is generated */}
      {finalProfile && isActive && !isCompleted && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <div className="p-6 bg-white border-2 border-vox-pink rounded-lg">
              <h3 className="font-bold text-xl mb-4 text-center">Your Voice Identity Profile is Ready!</h3>
              <p className="text-gray-600 mb-6 text-center">
                Download your complete Voice Identity Profile in your preferred format.
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={handleDownloadPDF}
                  className="flex-1 max-w-xs"
                  size="lg"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadWord}
                  className="flex-1 max-w-xs"
                  size="lg"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download Word
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Button */}
      {isActive && !isCompleted && finalProfile && (
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1">
            <Button
              onClick={handleFinalize}
              disabled={isSubmitting}
              className="bg-vox-pink hover:bg-vox-pink/90 w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Finalizing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Approve & Complete Voice Identity Profile
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Completion Message */}
      {isCompleted && finalProfile && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 p-6 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h3 className="font-bold text-lg text-green-900">
                Your Voice Identity Profile is now complete.
              </h3>
            </div>
            <p className="text-green-800 mb-4">
              Your voice identity has been saved and is ready to use across all VoxBox tools. You can export it as a PDF or Word document, or use it directly when creating content through Amplifiers and other tools.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadPDF}
                className="border-green-300 text-green-700 hover:bg-green-100"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadWord}
                className="border-green-300 text-green-700 hover:bg-green-100"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Word
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

