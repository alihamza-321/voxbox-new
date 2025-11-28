import { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { submitVeraStep9 } from "@/lib/vera-api";
import type { VeraProfile } from "@/lib/vera-api";
import avaAvatar from "@/assets/ava-avatar.png";
import { ChunkedText } from "@/components/margo/ChunkedText";
import FormattedChunkedText from "@/components/margo/FormattedChunkedText";

interface VeraStep9Props {
  workspaceId: string;
  profile: VeraProfile | null;
  isActive: boolean;
  isCompleted: boolean;
  onProfileChange: (profile: VeraProfile) => void;
  onError?: (message: string | null) => void;
}

export const VeraStep9 = ({
  profile,
  isActive,
  isCompleted,
  onProfileChange,
  onError,
}: VeraStep9Props) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [calibrationNotes, setCalibrationNotes] = useState<string[]>([]);
  const [consistencyScore, setConsistencyScore] = useState<number | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);

  useEffect(() => {
    if (profile?.calibrationNotes) {
      setCalibrationNotes(JSON.parse(JSON.stringify(profile.calibrationNotes)));
    }
    if (profile?.consistencyScore !== null && profile?.consistencyScore !== undefined) {
      setConsistencyScore(profile.consistencyScore);
    }
    setIsCalibrated(profile?.isCalibrated || false);
  }, [profile]);

  useEffect(() => {
    if (isActive && !isCompleted) {
      setTimeout(() => setShowIntro(true), 300);
      // Auto-check consistency when step becomes active
      if (profile && !isCalibrated) {
        handleConsistencyCheck();
      }
    } else {
      setShowIntro(true);
      setIntroComplete(true);
    }
  }, [isActive, isCompleted]);

  const handleConsistencyCheck = async () => {
    if (!profile || isChecking) return;

    setIsChecking(true);
    onError?.(null);

    try {
      const response = await submitVeraStep9(profile.id, {
        isCalibrated: false,
      });

      const notes = response?.data?.calibrationNotes;
      const score = response?.data?.consistencyScore;

      if (notes && Array.isArray(notes)) {
        setCalibrationNotes(notes);
      }
      if (score !== null && score !== undefined) {
        setConsistencyScore(score);
      }

      const updatedProfile: VeraProfile = {
        ...profile,
        calibrationNotes: notes || profile.calibrationNotes,
        consistencyScore: score !== null && score !== undefined ? score : profile.consistencyScore,
      };

      onProfileChange(updatedProfile);
    } catch (error: any) {
      const message = error?.message || "Failed to check consistency";
      onError?.(message);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!profile || isSubmitting) return;

    setIsSubmitting(true);
    onError?.(null);

    try {
      const response = await submitVeraStep9(profile.id, {
        isCalibrated: true,
      });

      const notes = response?.data?.calibrationNotes;
      const score = response?.data?.consistencyScore;

      const updatedProfile: VeraProfile = {
        ...profile,
        calibrationNotes: notes || profile.calibrationNotes,
        consistencyScore: score !== null && score !== undefined ? score : profile.consistencyScore,
        isCalibrated: true,
        currentStep: 10,
      };

      onProfileChange(updatedProfile);
      setIsCalibrated(true);

      toast({
        title: "Step 9 completed",
        description: "Voice calibration and consistency check completed.",
      });
    } catch (error: any) {
      const message = error?.message || "Failed to submit Step 9";
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

  if (!profile) return null;

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-500";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number | null) => {
    if (score === null) return "Not calculated";
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    return "Needs Improvement";
  };

  return (
    <div className="space-y-6">
      {/* Step Intro */}
      {showIntro && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            {introComplete ? (
              <FormattedChunkedText text={`Great job, ${profile.userName || 'there'}!\n\nStep 9: Voice Calibration and Consistency Check\n\nNow let's ensure your voice identity is coherent, aligned, and internally consistent. I'll review all your previous inputs and identify any inconsistencies or unclear areas.\n\nThis step involves:\n1. Reviewing all previous inputs\n2. Identifying inconsistencies or unclear areas\n3. Allowing you to refine and clarify final voice elements\n4. Confirming that the voice identity is complete and ready to use\n\nLet me analyze your voice identity...`} />
            ) : (
              <ChunkedText
                text={`Great job, ${profile.userName || 'there'}!\n\nStep 9: Voice Calibration and Consistency Check\n\nNow let's ensure your voice identity is coherent, aligned, and internally consistent. I'll review all your previous inputs and identify any inconsistencies or unclear areas.\n\nThis step involves:\n1. Reviewing all previous inputs\n2. Identifying inconsistencies or unclear areas\n3. Allowing you to refine and clarify final voice elements\n4. Confirming that the voice identity is complete and ready to use\n\nLet me analyze your voice identity...`}
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
              Review every calibration note and ensure inconsistencies are resolved before confirming completion.
            </p>
          </div>
        </div>
      )}

      {/* Consistency Check Results */}
      {isChecking && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-vox-pink" />
              <p className="text-gray-700">Analyzing your voice identity for consistency...</p>
            </div>
          </div>
        </div>
      )}

      {/* Consistency Score */}
      {consistencyScore !== null && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Consistency Score</h4>
              <span className={`text-2xl font-bold ${getScoreColor(consistencyScore)}`}>
                {consistencyScore}/100
              </span>
            </div>
            <p className={`text-sm ${getScoreColor(consistencyScore)}`}>
              {getScoreLabel(consistencyScore)}
            </p>
          </div>
        </div>
      )}

      {/* Calibration Notes */}
      {calibrationNotes.length > 0 && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Calibration Notes
            </h4>
            <div className="space-y-2">
              {calibrationNotes.map((note, index) => (
                <div
                  key={index}
                  className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm"
                >
                  {note}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600">
              Please review these notes and refine any areas that need clarification before proceeding.
            </p>
          </div>
        </div>
      )}

      {/* No Issues Found */}
      {calibrationNotes.length === 0 && consistencyScore !== null && consistencyScore >= 80 && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-green-800 font-medium">
                Your voice identity is consistent and well-aligned!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      {isActive && !isCompleted && (
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1 space-y-3">
            {consistencyScore === null && (
              <Button
                onClick={handleConsistencyCheck}
                disabled={isChecking}
                variant="outline"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Check Consistency"
                )}
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isChecking}
              className="bg-vox-pink hover:bg-vox-pink/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue to Final Step"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Completed Indicator */}
      {isCompleted && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <p className="text-gray-600 italic">Step 9 completed: Voice Calibration and Consistency Check</p>
          </div>
        </div>
      )}
    </div>
  );
};

