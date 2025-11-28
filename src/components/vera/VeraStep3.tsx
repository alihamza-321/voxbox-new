import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { submitVeraStep3, type TraitDefinition } from "@/lib/vera-api";
import type { VeraProfile } from "@/lib/vera-api";
import avaAvatar from "@/assets/ava-avatar.png";
import { ChunkedText } from "@/components/margo/ChunkedText";
import FormattedChunkedText from "@/components/margo/FormattedChunkedText";

interface VeraStep3Props {
  workspaceId: string;
  profile: VeraProfile | null;
  isActive: boolean;
  isCompleted: boolean;
  onProfileChange: (profile: VeraProfile) => void;
  onError?: (message: string | null) => void;
}

const SUGGESTED_TRAITS = [
  "Authoritative", "Warm", "Bold", "Direct", "Calm", "Grounded",
  "Inspirational", "Energetic", "Professional", "Friendly", "Empathetic", "Confident"
];

const SUGGESTED_SECONDARY = [
  "Supportive", "Encouraging", "Analytical", "Creative", "Practical", "Visionary", "Humble", "Ambitious"
];

const TRAITS_TO_AVOID_SUGGESTIONS = [
  "Condescending", "Overly casual", "Jargon-heavy", "Vague", "Aggressive", "Passive"
];

export const VeraStep3 = ({
  profile,
  isActive,
  isCompleted,
  onProfileChange,
  onError,
}: VeraStep3Props) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [refinedDescriptions, setRefinedDescriptions] = useState<any>(
    profile?.traitDescriptions || null
  );

  const [primaryTraits, setPrimaryTraits] = useState<TraitDefinition[]>(
    profile?.primaryTraits ? JSON.parse(JSON.stringify(profile.primaryTraits)) : []
  );
  const [secondaryTraits, setSecondaryTraits] = useState<TraitDefinition[]>(
    profile?.secondaryTraits ? JSON.parse(JSON.stringify(profile.secondaryTraits)) : []
  );
  const [traitsToAvoid, setTraitsToAvoid] = useState<string[]>(
    profile?.traitsToAvoid ? JSON.parse(JSON.stringify(profile.traitsToAvoid)) : []
  );
  const [emotionalToneRange, setEmotionalToneRange] = useState(profile?.emotionalToneRange || "");

  useEffect(() => {
    if (profile?.primaryTraits) {
      setPrimaryTraits(JSON.parse(JSON.stringify(profile.primaryTraits)));
    }
    if (profile?.secondaryTraits) {
      setSecondaryTraits(JSON.parse(JSON.stringify(profile.secondaryTraits)));
    }
    if (profile?.traitsToAvoid) {
      setTraitsToAvoid(JSON.parse(JSON.stringify(profile.traitsToAvoid)));
    }
    setEmotionalToneRange(profile?.emotionalToneRange || "");
    if (profile?.traitDescriptions) {
      setRefinedDescriptions(profile.traitDescriptions);
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

  const getTrimmedTraitFields = (trait: TraitDefinition) => {
    const name = trait?.trait ? trait.trait.trim() : "";
    const description = trait?.description ? trait.description.trim() : "";
    return { name, description };
  };

  const isPrimaryTraitNameInvalid = (trait: TraitDefinition) => {
    const { name } = getTrimmedTraitFields(trait);
    return name.length === 0 || name.length < 2;
  };

  const isPrimaryTraitDescriptionInvalid = (trait: TraitDefinition) => {
    const { description } = getTrimmedTraitFields(trait);
    return description.length === 0 || description.length < 10;
  };

  const isSecondaryTraitNameInvalid = (trait: TraitDefinition) => {
    const { name } = getTrimmedTraitFields(trait);
    return name.length > 0 && name.length < 2;
  };

  const isSecondaryTraitDescriptionInvalid = (trait: TraitDefinition) => {
    const { name, description } = getTrimmedTraitFields(trait);
    return name.length > 0 && (description.length === 0 || description.length < 10);
  };

  const addPrimaryTrait = () => {
    setPrimaryTraits([...primaryTraits, { trait: "", description: "" }]);
  };

  const updatePrimaryTrait = (index: number, field: "trait" | "description", value: string) => {
    const updated = [...primaryTraits];
    updated[index] = { ...updated[index], [field]: value };
    setPrimaryTraits(updated);
  };

  const removePrimaryTrait = (index: number) => {
    setPrimaryTraits(primaryTraits.filter((_, i) => i !== index));
  };

  const addSecondaryTrait = () => {
    setSecondaryTraits([...secondaryTraits, { trait: "", description: "" }]);
  };

  const updateSecondaryTrait = (index: number, field: "trait" | "description", value: string) => {
    const updated = [...secondaryTraits];
    updated[index] = { ...updated[index], [field]: value };
    setSecondaryTraits(updated);
  };

  const removeSecondaryTrait = (index: number) => {
    setSecondaryTraits(secondaryTraits.filter((_, i) => i !== index));
  };

  const addTraitToAvoid = (trait: string) => {
    if (!traitsToAvoid.includes(trait)) {
      setTraitsToAvoid([...traitsToAvoid, trait]);
    }
  };

  const removeTraitToAvoid = (trait: string) => {
    setTraitsToAvoid(traitsToAvoid.filter((t) => t !== trait));
  };

  const handleSubmit = async () => {
    if (!profile || isSubmitting) return;

    if (primaryTraits.length === 0) {
      toast({
        title: "Please add at least one primary trait",
        description: "You must define at least one primary personality trait.",
        variant: "destructive",
      });
      return;
    }

    const incompleteTraits = primaryTraits.filter((t) => !t.trait.trim() || !t.description.trim());
    if (incompleteTraits.length > 0) {
      toast({
        title: "Please complete all trait descriptions",
        description: "All primary traits must have both a name and description.",
        variant: "destructive",
      });
      return;
    }

    // Validate minimum lengths
    const invalidTraits = primaryTraits.filter((t) => {
      return t.trait.trim().length < 2 || t.description.trim().length < 10;
    });
    if (invalidTraits.length > 0) {
      toast({
        title: "Trait descriptions too short",
        description: "Trait names must be at least 2 characters and descriptions must be at least 10 characters.",
        variant: "destructive",
      });
      return;
    }

    // Validate secondary traits if they exist
    const invalidSecondaryTraits = secondaryTraits.filter((t) => {
      return t.trait.trim() && (t.trait.trim().length < 2 || t.description.trim().length < 10);
    });
    if (invalidSecondaryTraits.length > 0) {
      toast({
        title: "Secondary trait descriptions too short",
        description: "Secondary trait names must be at least 2 characters and descriptions must be at least 10 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    onError?.(null);

    try {
      const response = await submitVeraStep3(profile.id, {
        primaryTraits: primaryTraits.filter((t) => t.trait.trim() && t.description.trim()),
        secondaryTraits: secondaryTraits.filter((t) => t.trait.trim() && t.description.trim()),
        traitsToAvoid,
        emotionalToneRange: emotionalToneRange.trim(),
      });

      const refined = response?.data?.refinedDescriptions;

      if (refined) {
        setRefinedDescriptions(refined);
      }

      const updatedProfile: VeraProfile = {
        ...profile,
        primaryTraits: primaryTraits.filter((t) => t.trait.trim() && t.description.trim()),
        secondaryTraits: secondaryTraits.filter((t) => t.trait.trim() && t.description.trim()),
        traitsToAvoid,
        emotionalToneRange: emotionalToneRange.trim(),
        traitDescriptions: refined || profile.traitDescriptions,
        currentStep: 4,
      };

      onProfileChange(updatedProfile);

      toast({
        title: "Step 3 completed",
        description: "Voice personality traits saved and refined.",
      });
    } catch (error: any) {
      const message = error?.message || "Failed to submit Step 3";
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
              <FormattedChunkedText text={`Excellent work, ${profile.userName || 'there'}!\n\nStep 3: Voice Personality Definition\n\nNow that we have your communication foundation, let's give your brand voice depth through personality traits and expression qualities.\n\nYour brand voice should have a distinct personality—just like a person. This personality will make your communication more memorable, relatable, and authentic.\n\nHere are some example personality combinations:\n• Authoritative but warm\n• Bold and direct\n• Calm and grounded\n• Inspirational and energetic\n\nYou'll select and define:\n1. Primary personality traits (the core characteristics)\n2. Secondary traits (supporting characteristics)\n3. Traits to avoid (what you don't want to be)\n4. Emotional tone range (the spectrum of emotions you express)\n\nFor each trait you choose, you'll write a description. I'll then help refine these descriptions for clarity and consistency.\n\nLet's start by selecting your primary personality traits.`} />
            ) : (
              <ChunkedText
                text={`Excellent work, ${profile.userName || 'there'}!\n\nStep 3: Voice Personality Definition\n\nNow that we have your communication foundation, let's give your brand voice depth through personality traits and expression qualities.\n\nYour brand voice should have a distinct personality—just like a person. This personality will make your communication more memorable, relatable, and authentic.\n\nHere are some example personality combinations:\n• Authoritative but warm\n• Bold and direct\n• Calm and grounded\n• Inspirational and energetic\n\nYou'll select and define:\n1. Primary personality traits (the core characteristics)\n2. Secondary traits (supporting characteristics)\n3. Traits to avoid (what you don't want to be)\n4. Emotional tone range (the spectrum of emotions you express)\n\nFor each trait you choose, you'll write a description. I'll then help refine these descriptions for clarity and consistency.\n\nLet's start by selecting your primary personality traits.`}
                onComplete={() => setIntroComplete(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* Primary Traits */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-3">Primary Personality Traits</h3>
            {primaryTraits.map((trait, index) => (
              <div key={index} className="mb-4 p-4 border rounded-lg space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={trait.trait}
                    onChange={(e) => updatePrimaryTrait(index, "trait", e.target.value)}
                    placeholder="Trait name (e.g., Authoritative)"
                    className="flex-1"
                    disabled={isCompleted || !isActive}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePrimaryTrait(index)}
                    disabled={isCompleted || !isActive}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {isActive && !isCompleted && isPrimaryTraitNameInvalid(trait) && (
                  <p className="text-xs text-red-600">
                    Required • minimum 2 characters
                  </p>
                )}
                <Textarea
                  value={trait.description}
                  onChange={(e) => updatePrimaryTrait(index, "description", e.target.value)}
                  placeholder="Describe what this trait means for your brand voice..."
                  className="min-h-[80px]"
                  disabled={isCompleted || !isActive}
                />
                {isActive && !isCompleted && isPrimaryTraitDescriptionInvalid(trait) && (
                  <p className="text-xs text-red-600">
                    Required • minimum 10 characters
                  </p>
                )}
              </div>
            ))}
            {isActive && !isCompleted && (
              <Button variant="outline" onClick={addPrimaryTrait} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Primary Trait
              </Button>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED_TRAITS.map((trait) => (
                <Button
                  key={trait}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isActive && !isCompleted) {
                      addPrimaryTrait();
                      updatePrimaryTrait(primaryTraits.length, "trait", trait);
                    }
                  }}
                  disabled={isCompleted || !isActive}
                  className="text-xs"
                >
                  {trait}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Traits */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-3">Secondary Traits (Optional)</h3>
            {secondaryTraits.map((trait, index) => (
              <div key={index} className="mb-4 p-4 border rounded-lg space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={trait.trait}
                    onChange={(e) => updateSecondaryTrait(index, "trait", e.target.value)}
                    placeholder="Trait name"
                    className="flex-1"
                    disabled={isCompleted || !isActive}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSecondaryTrait(index)}
                    disabled={isCompleted || !isActive}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {isActive && !isCompleted && isSecondaryTraitNameInvalid(trait) && (
                  <p className="text-xs text-red-600">
                    Optional • minimum 2 characters when provided
                  </p>
                )}
                <Textarea
                  value={trait.description}
                  onChange={(e) => updateSecondaryTrait(index, "description", e.target.value)}
                  placeholder="Describe this trait..."
                  className="min-h-[80px]"
                  disabled={isCompleted || !isActive}
                />
                {isActive && !isCompleted && isSecondaryTraitDescriptionInvalid(trait) && (
                  <p className="text-xs text-red-600">
                    Optional • minimum 10 characters when provided
                  </p>
                )}
              </div>
            ))}
            {isActive && !isCompleted && (
              <Button variant="outline" onClick={addSecondaryTrait} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Secondary Trait
              </Button>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED_SECONDARY.map((trait) => (
                <Button
                  key={trait}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isActive && !isCompleted) {
                      addSecondaryTrait();
                      updateSecondaryTrait(secondaryTraits.length, "trait", trait);
                    }
                  }}
                  disabled={isCompleted || !isActive}
                  className="text-xs"
                >
                  {trait}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Traits to Avoid */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-3">Traits to Avoid</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {traitsToAvoid.map((trait) => (
                <div
                  key={trait}
                  className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-full"
                >
                  <span className="text-sm">{trait}</span>
                  {isActive && !isCompleted && (
                    <button
                      onClick={() => removeTraitToAvoid(trait)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {TRAITS_TO_AVOID_SUGGESTIONS.map((trait) => (
                <Button
                  key={trait}
                  variant="outline"
                  size="sm"
                  onClick={() => addTraitToAvoid(trait)}
                  disabled={isCompleted || !isActive || traitsToAvoid.includes(trait)}
                  className="text-xs"
                >
                  {trait}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Emotional Tone Range */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-3">Emotional Tone Range (Optional)</h3>
            <Textarea
              value={emotionalToneRange}
              onChange={(e) => setEmotionalToneRange(e.target.value)}
              placeholder="Describe the range of emotions your brand voice expresses (e.g., 'From confident and energetic to calm and reassuring')"
              className="min-h-[100px]"
              disabled={isCompleted || !isActive}
            />
            {isActive &&
              !isCompleted &&
              emotionalToneRange.trim().length > 0 &&
              emotionalToneRange.trim().length < 10 && (
              <p className="text-xs text-red-600 mt-1">
                  Optional • aim for at least 10 characters when provided
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Refined Descriptions */}
      {refinedDescriptions && (
        <div className="flex gap-4">
          <img src={avaAvatar} alt="Vera" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold mb-2">Refined Trait Descriptions</h4>
            <div className="space-y-2 text-sm">
              {Object.entries(refinedDescriptions).map(([trait, description]) => (
                <div key={trait}>
                  <strong>{trait}:</strong> {description as string}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      {isActive && !isCompleted && (
        <div className="flex gap-4">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || primaryTraits.length === 0}
              className="bg-vox-pink hover:bg-vox-pink/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing & Refining...
                </>
              ) : (
                "Continue to Step 4"
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
            <p className="text-gray-600 italic">Step 3 completed: Voice Personality Definition</p>
          </div>
        </div>
      )}
    </div>
  );
};

