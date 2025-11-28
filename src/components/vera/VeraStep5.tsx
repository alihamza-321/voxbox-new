import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { submitVeraStep5 } from "@/lib/vera-api";
import type { VeraProfile } from "@/lib/vera-api";
import avaAvatar from "@/assets/ava-avatar.png";
import { ChunkedText } from "@/components/margo/ChunkedText";
import FormattedChunkedText from "@/components/margo/FormattedChunkedText";

interface VeraStep5Props {
  workspaceId: string;
  profile: VeraProfile | null;
  isActive: boolean;
  isCompleted: boolean;
  onProfileChange: (profile: VeraProfile) => void;
  onError?: (message: string | null) => void;
}

export const VeraStep5 = ({
  profile,
  isActive,
  isCompleted,
  onProfileChange,
  onError,
}: VeraStep5Props) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);

  const [dos, setDos] = useState<string[]>(
    profile?.dos ? JSON.parse(JSON.stringify(profile.dos)) : []
  );
  const [donts, setDonts] = useState<string[]>(
    profile?.donts ? JSON.parse(JSON.stringify(profile.donts)) : []
  );

  const [newDo, setNewDo] = useState("");
  const [newDont, setNewDont] = useState("");
  const hasBehaviorGuidance = dos.length > 0 || donts.length > 0;
  const newDoTrimmed = newDo.trim();
  const newDontTrimmed = newDont.trim();
  const needsDoInputHint = newDoTrimmed.length > 0 && newDoTrimmed.length < 5;
  const needsDontInputHint = newDontTrimmed.length > 0 && newDontTrimmed.length < 5;

  useEffect(() => {
    if (profile?.dos) {
      setDos(JSON.parse(JSON.stringify(profile.dos)));
    }
    if (profile?.donts) {
      setDonts(JSON.parse(JSON.stringify(profile.donts)));
    }
  }, [profile]);

  useEffect(() => {
    if (isActive && !isCompleted) {
      setTimeout(() => setShowIntro(true), 300);
    } else {
      setShowIntro(true);
      setIntroComplete(true);
    }
  }, [isActive, isCompleted]);

  const addDo = () => {
    const trimmed = newDo.trim();
    if (!trimmed) {
      toast({
        title: "Do item required",
        description: "Please enter a Do item.",
        variant: "destructive",
      });
      return;
    }
    if (trimmed.length < 5) {
      toast({
        title: "Do item too short",
        description: "Do item must be at least 5 characters long.",
        variant: "destructive",
      });
      return;
    }
    setDos([...dos, trimmed]);
    setNewDo("");
  };

  const removeDo = (index: number) => {
    setDos(dos.filter((_, i) => i !== index));
  };

  const addDont = () => {
    const trimmed = newDont.trim();
    if (!trimmed) {
      toast({
        title: "Don't item required",
        description: "Please enter a Don't item.",
        variant: "destructive",
      });
      return;
    }
    if (trimmed.length < 5) {
      toast({
        title: "Don't item too short",
        description: "Don't item must be at least 5 characters long.",
        variant: "destructive",
      });
      return;
    }
    setDonts([...donts, trimmed]);
    setNewDont("");
  };

  const removeDont = (index: number) => {
    setDonts(donts.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!profile || isSubmitting) return;

    if (dos.length === 0 && donts.length === 0) {
      toast({
        title: "Please add at least one Do or Don't",
        description: "You must define at least one Do or Don't for your brand voice.",
        variant: "destructive",
      });
      return;
    }

    // Validate minimum length for each do
    const invalidDos = dos.filter((item) => item.trim().length < 5);
    if (invalidDos.length > 0) {
      toast({
        title: "Do items too short",
        description: "Each Do item must be at least 5 characters long.",
        variant: "destructive",
      });
      return;
    }

    // Validate minimum length for each don't
    const invalidDonts = donts.filter((item) => item.trim().length < 5);
    if (invalidDonts.length > 0) {
      toast({
        title: "Don't items too short",
        description: "Each Don't item must be at least 5 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    onError?.(null);

    try {
      await submitVeraStep5(profile.id, {
        dos,
        donts,
      });

      const updatedProfile: VeraProfile = {
        ...profile,
        dos,
        donts,
        currentStep: 6,
      };

      onProfileChange(updatedProfile);

      toast({
        title: "Step 5 completed",
        description: "Voice Do's and Don'ts saved.",
      });
    } catch (error: any) {
      const message = error?.message || "Failed to submit Step 5";
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

  return (
    <div className="space-y-6">
      {/* Step Intro */}
      {showIntro && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1">
            {introComplete ? (
              <FormattedChunkedText text={`Great progress, ${profile.userName || 'there'}!\n\nStep 5: Voice Do's and Don'ts\n\nNow let's create clear behavioral instructions for how your brand should and should not communicate. These boundaries are essential for maintaining consistent voice.\n\nThink about:\n• Preferred tones\n• Preferred behaviors\n• Language patterns to use\n• Communication philosophies\n• Tones to avoid\n• Behaviors to avoid\n• Words or structures that break brand identity\n\nI'll organize these into a clear two-column table for easy reference.\n\nLet's start with your Do's:`} />
            ) : (
              <ChunkedText
                text={`Great progress, ${profile.userName || 'there'}!\n\nStep 5: Voice Do's and Don'ts\n\nNow let's create clear behavioral instructions for how your brand should and should not communicate. These boundaries are essential for maintaining consistent voice.\n\nThink about:\n• Preferred tones\n• Preferred behaviors\n• Language patterns to use\n• Communication philosophies\n• Tones to avoid\n• Behaviors to avoid\n• Words or structures that break brand identity\n\nI'll organize these into a clear two-column table for easy reference.\n\nLet's start with your Do's:`}
                onComplete={() => setIntroComplete(true)}
              />
            )}
          </div>
        </div>
      )}

      {isActive && !isCompleted && !hasBehaviorGuidance && (
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-red-600">
              Add at least one Do or Don't • each entry must be 5+ characters.
            </p>
          </div>
        </div>
      )}

      {/* Do's */}
      <div className="flex gap-4">
        <div className="w-10 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-3 text-green-700">Do's</h3>
          <div className="space-y-2 mb-3">
            {dos.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <span className="flex-1">{item}</span>
                {isActive && !isCompleted && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDo(index)}
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {isActive && !isCompleted && (
            <div className="flex gap-2">
              <Input
                value={newDo}
                onChange={(e) => setNewDo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDo();
                  }
                }}
                placeholder="Add a Do..."
                className="flex-1"
              />
              <Button onClick={addDo} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
          {isActive && !isCompleted && needsDoInputHint && (
            <p className="text-xs text-red-600 mt-1">
              Minimum 5 characters before adding
            </p>
          )}
        </div>
      </div>

      {/* Don'ts */}
      <div className="flex gap-4">
        <div className="w-10 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-3 text-red-700">Don'ts</h3>
          <div className="space-y-2 mb-3">
            {donts.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <span className="flex-1">{item}</span>
                {isActive && !isCompleted && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDont(index)}
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {isActive && !isCompleted && (
            <div className="flex gap-2">
              <Input
                value={newDont}
                onChange={(e) => setNewDont(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDont();
                  }
                }}
                placeholder="Add a Don't..."
                className="flex-1"
              />
              <Button onClick={addDont} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
          {isActive && !isCompleted && needsDontInputHint && (
            <p className="text-xs text-red-600 mt-1">
              Minimum 5 characters before adding
            </p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      {isActive && !isCompleted && (
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (dos.length === 0 && donts.length === 0)}
              className="bg-vox-pink hover:bg-vox-pink/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue to Step 6"
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
            <p className="text-gray-600 italic">Step 5 completed: Voice Do's and Don'ts</p>
          </div>
        </div>
      )}
    </div>
  );
};

