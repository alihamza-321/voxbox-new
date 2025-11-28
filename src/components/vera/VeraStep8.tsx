import { useEffect, useState } from "react";
import { Loader2, Plus, X, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { submitVeraStep8 } from "@/lib/vera-api";
import type { VeraProfile } from "@/lib/vera-api";
import avaAvatar from "@/assets/ava-avatar.png";
import { ChunkedText } from "@/components/margo/ChunkedText";
import FormattedChunkedText from "@/components/margo/FormattedChunkedText";

interface VeraStep8Props {
  workspaceId: string;
  profile: VeraProfile | null;
  isActive: boolean;
  isCompleted: boolean;
  onProfileChange: (profile: VeraProfile) => void;
  onError?: (message: string | null) => void;
}

export const VeraStep8 = ({
  profile,
  isActive,
  isCompleted,
  onProfileChange,
  onError,
}: VeraStep8Props) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [modelParagraphs, setModelParagraphs] = useState<string[]>([]);
  const [approvedSamples, setApprovedSamples] = useState<string[]>([]);

  const [userSamples, setUserSamples] = useState<string[]>(
    profile?.userSamples ? JSON.parse(JSON.stringify(profile.userSamples)) : []
  );
  const [newSample, setNewSample] = useState("");
  const hasRequiredSamples = userSamples.length > 0;
  const newSampleTrimmed = newSample.trim();
  const needsSampleLengthHint = newSampleTrimmed.length > 0 && newSampleTrimmed.length < 10;

  useEffect(() => {
    if (profile?.userSamples) {
      setUserSamples(JSON.parse(JSON.stringify(profile.userSamples)));
    }
    if (profile?.modelParagraphs) {
      setModelParagraphs(JSON.parse(JSON.stringify(profile.modelParagraphs)));
    }
    if (profile?.approvedSamples) {
      setApprovedSamples(JSON.parse(JSON.stringify(profile.approvedSamples)));
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

  const addSample = () => {
    const trimmed = newSample.trim();
    if (!trimmed) {
      toast({
        title: "Sample required",
        description: "Please enter a sample statement or message.",
        variant: "destructive",
      });
      return;
    }
    if (trimmed.length < 10) {
      toast({
        title: "Sample too short",
        description: "Sample must be at least 10 characters long.",
        variant: "destructive",
      });
      return;
    }
    setUserSamples([...userSamples, trimmed]);
    setNewSample("");
  };

  const removeSample = (index: number) => {
    setUserSamples(userSamples.filter((_, i) => i !== index));
  };

  const approveSample = (index: number) => {
    if (modelParagraphs[index] && !approvedSamples.includes(modelParagraphs[index])) {
      setApprovedSamples([...approvedSamples, modelParagraphs[index]]);
    }
  };

  const handleSubmit = async () => {
    if (!profile || isSubmitting) return;

    if (userSamples.length === 0) {
      toast({
        title: "Please add at least one sample",
        description: "You must provide at least one sample statement or message.",
        variant: "destructive",
      });
      return;
    }

    // Validate minimum length for each sample
    const invalidSamples = userSamples.filter((sample) => sample.trim().length < 10);
    if (invalidSamples.length > 0) {
      toast({
        title: "Samples too short",
        description: "Each sample must be at least 10 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (modelParagraphs.length === 0) {
      toast({
        title: "Please wait for AI rewriting",
        description: "The AI is rewriting your samples. Please wait...",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    onError?.(null);

    try {
      const response = await submitVeraStep8(profile.id, {
        userSamples,
        approvedSamples: approvedSamples.length > 0 ? approvedSamples : modelParagraphs,
      });

      const rewritten = response?.data?.modelParagraphs;

      if (rewritten && Array.isArray(rewritten)) {
        setModelParagraphs(rewritten);
        if (approvedSamples.length === 0) {
          setApprovedSamples(rewritten);
        }
      }

      const updatedProfile: VeraProfile = {
        ...profile,
        userSamples,
        modelParagraphs: rewritten || modelParagraphs,
        approvedSamples: approvedSamples.length > 0 ? approvedSamples : (rewritten || modelParagraphs),
        currentStep: 9,
      };

      onProfileChange(updatedProfile);

      toast({
        title: "Step 8 completed",
        description: "Voice examples and model paragraphs saved.",
      });
    } catch (error: any) {
      const message = error?.message || "Failed to submit Step 8";
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

  const handleRewriteSamples = async () => {
    if (!profile || userSamples.length === 0) return;

    setIsSubmitting(true);
    onError?.(null);

    try {
      const response = await submitVeraStep8(profile.id, {
        userSamples,
      });

      const rewritten = response?.data?.modelParagraphs;
      if (rewritten && Array.isArray(rewritten)) {
        setModelParagraphs(rewritten);
        toast({
          title: "Samples rewritten",
          description: "Your samples have been rewritten in your brand voice.",
        });
      }
    } catch (error: any) {
      const message = error?.message || "Failed to rewrite samples";
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
              <FormattedChunkedText text={`Excellent work, ${profile.userName || 'there'}!\n\nStep 8: Voice Examples and Model Paragraphs\n\nNow let's create concrete voice samples demonstrating your brand's style in action. These model paragraphs will create voice stability and serve as reference material for all future assets.\n\nHere's how this works:\n1. You'll provide sample statements or messages (these can be existing content or new ideas)\n2. I'll rewrite them in your defined brand voice\n3. You'll review and confirm or adjust the samples\n4. These approved samples become your reference material\n\nWhy this matters: Model paragraphs create voice stability. When you or your team need to create new content, you can reference these samples to ensure consistency.\n\nLet's start. Please provide a sample statement or message:`} />
            ) : (
              <ChunkedText
                text={`Excellent work, ${profile.userName || 'there'}!\n\nStep 8: Voice Examples and Model Paragraphs\n\nNow let's create concrete voice samples demonstrating your brand's style in action. These model paragraphs will create voice stability and serve as reference material for all future assets.\n\nHere's how this works:\n1. You'll provide sample statements or messages (these can be existing content or new ideas)\n2. I'll rewrite them in your defined brand voice\n3. You'll review and confirm or adjust the samples\n4. These approved samples become your reference material\n\nWhy this matters: Model paragraphs create voice stability. When you or your team need to create new content, you can reference these samples to ensure consistency.\n\nLet's start. Please provide a sample statement or message:`}
                onComplete={() => setIntroComplete(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* User Samples Input */}
      {isActive && !isCompleted && (
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-semibold mb-2">Your Sample Statements</p>
              {!hasRequiredSamples && (
                <p className="text-xs text-red-600 mb-2">
                  Add at least one sample • each must be 10+ characters.
                </p>
              )}
              <div className="space-y-2 mb-3">
                {userSamples.map((sample, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-3 bg-gray-50 border rounded-lg"
                  >
                    <p className="flex-1 text-sm">{sample}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSample(index)}
                      className="h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={newSample}
                  onChange={(e) => setNewSample(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      addSample();
                    }
                  }}
                  placeholder="Type a sample statement or message..."
                  className="min-h-[80px]"
                />
                <Button onClick={addSample} variant="outline" className="h-[80px]">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {needsSampleLengthHint && (
                <p className="text-xs text-red-600 mt-1">
                  Minimum 10 characters before adding
                </p>
              )}
              {userSamples.length > 0 && (
                <Button
                  onClick={handleRewriteSamples}
                  disabled={isSubmitting}
                  className="mt-3 bg-vox-pink hover:bg-vox-pink/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Rewriting...
                    </>
                  ) : (
                    "Rewrite Samples in Brand Voice"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Model Paragraphs */}
      {modelParagraphs.length > 0 && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-4">
            <h3 className="font-semibold text-lg">Rewritten in Your Brand Voice</h3>
            {modelParagraphs.map((paragraph, index) => {
              const isApproved = approvedSamples.includes(paragraph);
              return (
                <div
                  key={index}
                  className={`p-4 border rounded-lg ${
                    isApproved ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium">Sample {index + 1}</p>
                    {isActive && !isCompleted && (
                      <Button
                        variant={isApproved ? "default" : "outline"}
                        size="sm"
                        onClick={() => approveSample(index)}
                        disabled={isApproved}
                        className={isApproved ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {isApproved ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Approved
                          </>
                        ) : (
                          "Approve"
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{paragraph}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit Button */}
      {isActive && !isCompleted && modelParagraphs.length > 0 && (
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-vox-pink hover:bg-vox-pink/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue to Step 9"
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
            <p className="text-gray-600 italic">Step 8 completed: Voice Examples and Model Paragraphs</p>
          </div>
        </div>
      )}
    </div>
  );
};

