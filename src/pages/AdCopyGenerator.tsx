import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Megaphone, Loader2, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/components/ui/use-toast';

import {
  createAdCopyAmplifier,
  listAmplifierRuns,
  type AmplifierAdCopyVariation,
  type AdCopyAmplifierRun,
} from '@/lib/amplifiers';
import { listWorkspaceSessions, type WorkspaceSession } from '@/lib/ava-api';
import { listWorkspaceBriefs, type WorkspaceBrief } from '@/lib/margo-api';
import { pickDisplayName } from '@/lib/display';
import { useAmplifierField, useAmplifierScrollRestoration } from '@/hooks/useAmplifierPersistence';

const platformOptions = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'google_display', label: 'Google Display' },
  { value: 'tiktok', label: 'TikTok' },
];

const adFormatOptions = [
  { value: 'image_ad', label: 'Image Ad' },
  { value: 'video_ad', label: 'Video Ad' },
  { value: 'carousel_ad', label: 'Carousel Ad' },
  { value: 'story_ad', label: 'Story / Reels Ad' },
  { value: 'search_ad', label: 'Search Ad' },
];

const DEFAULT_CTA = 'Shop now';

const isCompletedSession = (session: WorkspaceSession): boolean => {
  return session.status === 'completed' || session.currentPhase === 'completed';
};

const isCompletedBrief = (brief: WorkspaceBrief): boolean => {
  return ['completed', 'ready_for_export'].includes((brief.status || '').toLowerCase());
};

interface NormalizedAdCopyVariation {
  id: string;
  label: string;
  headline?: string;
  primaryText?: string;
  supportingPoints: string[];
  cta?: string;
  extraFields: Array<{ label: string; value: string }>;
  copyPayload: string;
}

const asTrimmedString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
};

const toStringArray = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim();
        }
        if (entry && typeof entry === 'object') {
          return asTrimmedString((entry as Record<string, unknown>).value);
        }
        return '';
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const tryNormalizeAdCopy = (candidate: unknown): AmplifierAdCopyVariation[] | null => {
  if (!candidate) {
    return null;
  }

  if (Array.isArray(candidate)) {
    if (candidate.length === 0) {
      return [];
    }

    if (candidate.every((item) => typeof item === 'string')) {
      return (candidate as string[]).map((primary) => ({ primaryText: primary }));
    }

    return candidate as AmplifierAdCopyVariation[];
  }

  if (isPlainObject(candidate)) {
    const record = candidate as Record<string, unknown>;
    const nestedKeys = [
      'variations',
      'ads',
      'items',
      'content',
      'data',
      'adVariations',
      'results',
      'entries',
    ];

    for (const key of nestedKeys) {
      if (record[key] !== undefined) {
        const nested = tryNormalizeAdCopy(record[key]);
        if (nested && nested.length > 0) {
          return nested;
        }
      }
    }

    const hasAdFields = ['headline', 'headlineText', 'primaryText', 'description', 'body', 'hook', 'cta', 'callToAction']
      .some((field) => asTrimmedString(record[field]));

    if (hasAdFields) {
      return [record as AmplifierAdCopyVariation];
    }

    const nestedCandidates = Object.values(record)
      .map((value) => tryNormalizeAdCopy(value))
      .filter((value): value is AmplifierAdCopyVariation[] => Array.isArray(value) && value.length > 0);

    if (nestedCandidates.length > 0) {
      return nestedCandidates.flat();
    }

    return null;
  }

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      const normalized = tryNormalizeAdCopy(parsed);
      if (normalized) {
        return normalized;
      }
    } catch {
      // If parsing fails, fall back to treating it as plain text.
    }

    return [{ primaryText: trimmed }];
  }

  return null;
};

const extractAdCopyVariations = (value: unknown): AmplifierAdCopyVariation[] => {
  const normalized = tryNormalizeAdCopy(value);
  if (normalized) {
    return normalized;
  }
  return [];
};

const normalizeAdCopyVariation = (
  variation: AmplifierAdCopyVariation,
  index: number,
): NormalizedAdCopyVariation => {
  const variationName =
    asTrimmedString(variation.variationName) ||
    asTrimmedString(variation.name) ||
    asTrimmedString(variation.angle) ||
    asTrimmedString(variation.title);

  const headline =
    asTrimmedString(variation.headline) ||
    asTrimmedString(variation.headlineText) ||
    asTrimmedString(variation.hook) ||
    asTrimmedString(variation.subheadline);

  const primaryText =
    asTrimmedString(variation.primaryText) ||
    asTrimmedString(variation.body) ||
    asTrimmedString(variation.description);

  const cta = asTrimmedString(variation.callToAction) || asTrimmedString(variation.cta);

  const supportingPoints = Array.from(
    new Set([
      ...toStringArray(variation.supportingPoints),
      ...toStringArray((variation as Record<string, unknown>).bullets),
      ...toStringArray((variation as Record<string, unknown>).keyPoints),
    ]),
  );

  const extraFields: Array<{ label: string; value: string }> = [];

  const addField = (label: string, value: unknown) => {
    const text = asTrimmedString(value);
    if (text) {
      extraFields.push({ label, value: text });
    }
  };

  addField('Hook', variation.hook);
  addField('Subheadline', variation.subheadline);
  addField('Description', variation.description && variation.description !== primaryText ? variation.description : '');
  addField('Angle', variationName && !variationName.startsWith('Variation') ? variationName : '');

  const copySegments: string[] = [];
  if (headline) {
    copySegments.push(`Headline: ${headline}`);
  }
  if (primaryText) {
    copySegments.push(primaryText);
  }
  if (supportingPoints.length > 0) {
    copySegments.push(
      ['Key Points:', ...supportingPoints.map((point) => `• ${point}`)].join('\n'),
    );
  }
  if (cta) {
    copySegments.push(`CTA: ${cta}`);
  }

  if (copySegments.length === 0) {
    copySegments.push(JSON.stringify(variation, null, 2));
  }

  return {
    id: `ad-copy-variation-${index + 1}`,
    label: variationName ? `Ad Variation ${index + 1} - ${variationName}` : `Ad Variation ${index + 1}`,
    headline,
    primaryText,
    supportingPoints,
    cta,
    extraFields,
    copyPayload: copySegments.join('\n\n'),
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return 'Something went wrong. Please try again.';
};

const AdCopyGenerator = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [avaSessions, setAvaSessions] = useState<WorkspaceSession[]>([]);
  const [margoBriefs, setMargoBriefs] = useState<WorkspaceBrief[]>([]);
  const [runs, setRuns] = useState<AdCopyAmplifierRun[]>([]);

  const amplifierKey = 'adCopy' as const;

  const [selectedAvaSessionId, setSelectedAvaSessionId] = useAmplifierField<string>(
    amplifierKey,
    'selectedAvaSessionId',
    '',
  );
  const [selectedMargoBriefId, setSelectedMargoBriefId] = useAmplifierField<string>(
    amplifierKey,
    'selectedMargoBriefId',
    '',
  );

  const [platform, setPlatform] = useAmplifierField<string>(
    amplifierKey,
    'platform',
    platformOptions[0]?.value ?? 'facebook',
  );
  const [adFormat, setAdFormat] = useAmplifierField<string>(
    amplifierKey,
    'adFormat',
    adFormatOptions[0]?.value ?? 'image_ad',
  );
  const [campaignGoal, setCampaignGoal] = useAmplifierField<string>(
    amplifierKey,
    'campaignGoal',
    '',
  );
  const [cta] = useState(DEFAULT_CTA);
  const [copiedVariationId, setCopiedVariationId] = useState('');

  useAmplifierScrollRestoration(amplifierKey);

  const workspaceId = currentWorkspace?.id;

  const hasPrerequisites = useMemo(() => {
    return avaSessions.length > 0 && margoBriefs.length > 0;
  }, [avaSessions.length, margoBriefs.length]);

  const isCampaignGoalValid = useMemo(() => {
    return campaignGoal.trim().length >= 10;
  }, [campaignGoal]);

  const loadAmplifierData = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [sessionsResponse, briefsResponse, runsResponse] = await Promise.all([
        listWorkspaceSessions(workspaceId),
        listWorkspaceBriefs(workspaceId),
        listAmplifierRuns<AmplifierAdCopyVariation[] | string>(workspaceId, 'ad_copy'),
      ]);

      const completedSessions = [
        ...(sessionsResponse?.completed ?? []),
        ...(sessionsResponse?.active ?? []).filter((session) => isCompletedSession(session)),
      ];

      const completedBriefs = (briefsResponse ?? []).filter((brief) => isCompletedBrief(brief));

      setAvaSessions(completedSessions);
      setMargoBriefs(completedBriefs);
      setRuns(runsResponse ?? []);

      setSelectedAvaSessionId((prev) => prev || completedSessions[0]?.id || '');
      setSelectedMargoBriefId((prev) => prev || completedBriefs[0]?.id || '');
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(error);
      setLoadError(message);
      toast({
        title: 'Unable to load amplifier data',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, workspaceId]);

  useEffect(() => {
    void loadAmplifierData();
  }, [loadAmplifierData]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!workspaceId) {
        toast({
          title: 'No workspace selected',
          description: 'Please select or create a workspace before generating content.',
          variant: 'destructive',
        });
        return;
      }

      if (!hasPrerequisites) {
        toast({
          title: 'Profiles required',
          description: 'Complete an AVA session and a MARGO product brief to power this amplifier.',
          variant: 'destructive',
        });
        return;
      }

      if (!selectedAvaSessionId) {
        toast({
          title: 'Select an AVA profile',
          description: 'Choose which AVA profile should inform the ad copy.',
          variant: 'destructive',
        });
        return;
      }

      if (!selectedMargoBriefId) {
        toast({
          title: 'Select a product brief',
          description: 'Choose which product brief should inform the ad copy.',
          variant: 'destructive',
        });
        return;
      }

      const trimmedGoal = campaignGoal.trim();
      if (!trimmedGoal) {
        toast({
          title: 'Campaign goal required',
          description: 'Describe the goal of this campaign so the AI can focus the messaging.',
          variant: 'destructive',
        });
        return;
      }

      setIsSubmitting(true);

      try {
        const newRun = await createAdCopyAmplifier({
          workspaceId,
          avaSessionId: selectedAvaSessionId,
          margoProfileId: selectedMargoBriefId,
          cta,
          platform,
          adFormat,
          campaignGoal: trimmedGoal,
        });

        setRuns((prev) => [newRun, ...prev]);
        setCampaignGoal('');

        toast({
          title: 'Ad copy generated',
          description: 'Scroll down to review the new ad variations.',
        });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Generation failed',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      workspaceId,
      toast,
      hasPrerequisites,
      selectedAvaSessionId,
      selectedMargoBriefId,
      campaignGoal,
      cta,
      platform,
      adFormat,
    ],
  );

  const handleCopy = useCallback(
    async (payload: string, variationId: string) => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          throw new Error('Clipboard API unavailable');
        }
        await navigator.clipboard.writeText(payload);
        setCopiedVariationId(variationId);
        setTimeout(() => setCopiedVariationId(''), 2000);
        toast({
          title: 'Copied to clipboard',
          description: 'The ad copy is ready to paste.',
        });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Copy failed',
          description: 'Unable to copy to clipboard. Please copy manually.',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const platformLabel = useMemo(() => {
    return new Map(platformOptions.map((option) => [option.value, option.label]));
  }, []);

  if (!workspaceId) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Select a workspace</CardTitle>
            <CardDescription>
              Choose a workspace to access Amplifiers and generate tailored ad copy.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/amplifiers')}
            className="border-pink/20 bg-white text-foreground hover:bg-pink/10 hover:text-vox-pink hover:border-pink/40 transition-all duration-300 ease-in-out hover:shadow-md hover:shadow-pink/10 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black">
            <Megaphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Ad Copy Generator</h1>
            <p className="text-sm text-muted-foreground">
              Create high-converting ad variations for your chosen platform.
            </p>
          </div>
        </div>
      </header>

      <Card className="rounded-2xl border border-pink/20 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Configure Ad Copy</CardTitle>
          <CardDescription>Generate ads across platforms and formats</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Client Profile</Label>
                <Select
                  value={selectedAvaSessionId}
                  onValueChange={setSelectedAvaSessionId}
                  disabled={avaSessions.length === 0 || isSubmitting}
                >
                  <SelectTrigger className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                    <SelectValue placeholder="Select client profile" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                    {avaSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {pickDisplayName([session.userName, session.sessionName], 'Client Profile')} •{' '}
                        {formatDistanceToNow(new Date(session.completedAt ?? session.createdAt), {
                          addSuffix: true,
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isLoading && avaSessions.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Complete an AVA session to activate this amplifier.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Product Profile</Label>
                <Select
                  value={selectedMargoBriefId}
                  onValueChange={setSelectedMargoBriefId}
                  disabled={margoBriefs.length === 0 || isSubmitting}
                >
                  <SelectTrigger className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                    <SelectValue placeholder="Select product profile" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                    {margoBriefs.map((brief) => (
                      <SelectItem key={brief.id} value={brief.id}>
                        {pickDisplayName(
                          [brief.userName, brief.productName, brief.sessionName],
                          'Product Profile',
                        )}{' '}
                        •{' '}
                        {formatDistanceToNow(new Date(brief.updatedAt ?? brief.createdAt), {
                          addSuffix: true,
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isLoading && margoBriefs.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Complete a MARGO product brief to activate this amplifier.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select
                  value={platform}
                  onValueChange={setPlatform}
                  disabled={isSubmitting || !hasPrerequisites}
                >
                  <SelectTrigger className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                    {platformOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ad Format</Label>
                <Select
                  value={adFormat}
                  onValueChange={setAdFormat}
                  disabled={isSubmitting || !hasPrerequisites}
                >
                  <SelectTrigger className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                    <SelectValue placeholder="Select ad format" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                    {adFormatOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Campaign Goal</Label>
              <Textarea
                placeholder="What's the goal of this ad campaign?"
                minLength={10}
                rows={4}
                value={campaignGoal}
                onChange={(event) => setCampaignGoal(event.target.value)}
                disabled={isSubmitting || !hasPrerequisites}
                className="rounded-2xl border border-pink/20 bg-white resize-none focus:border-vox-pink"
              />
              {campaignGoal.trim().length < 10 && (
                <p className="text-xs text-destructive">
                  {campaignGoal.trim().length} / 10 characters minimum required
                </p>
              )}
            </div>

            {!hasPrerequisites && (
              <p className="text-sm text-amber-600">
                Complete an AVA profile and a MARGO product brief to enable ad copy generation.
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !hasPrerequisites || !isCampaignGoalValid}
              className="h-12 w-full rounded-full bg-vox-pink text-base font-semibold text-white shadow-sm transition hover:bg-vox-pink/90"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </span>
              ) : (
                'Generate Ad Copy'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Generated Ad Variations</h2>
          {runs.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing {runs.length} {runs.length === 1 ? 'run' : 'runs'}
            </p>
          )}
        </div>

        {isLoading ? (
          <Card className="flex items-center justify-center rounded-2xl border border-pink/20 bg-white py-16">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading previous ad copy runs...</span>
            </div>
          </Card>
        ) : loadError ? (
          <Card className="rounded-2xl border border-red-200 bg-red-50 py-10 text-center">
            <CardContent className="space-y-2">
              <p className="font-medium text-red-700">Failed to load ad copy runs</p>
              <p className="text-sm text-red-600">{loadError}</p>
              <Button
                variant="outline"
                className="mt-2 rounded-xl border-pink/20 hover:bg-pink/10"
                onClick={() => {
                  void loadAmplifierData();
                }}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : runs.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-pink/20 bg-white py-16 text-center">
            <CardContent className="space-y-2">
              <p className="font-medium text-foreground">No ad copy yet</p>
              <p className="text-sm text-muted-foreground">
                Configure the form above to generate your first set of ad variations.
              </p>
            </CardContent>
          </Card>
        ) : (
          runs.map((run) => {
            const variations = extractAdCopyVariations(run.output?.content).map((variation, index) =>
              normalizeAdCopyVariation(variation, index),
            );

            const createdTime = run.createdAt
              ? formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })
              : null;

            const platformLabelText =
              platformLabel.get((run.inputs?.platform as string) || '') ||
              asTrimmedString(run.inputs?.platform) ||
              'Ad Campaign';

            const sections = Array.isArray(run.output?.metadata?.sections)
              ? (run.output?.metadata?.sections as unknown[])
                  .map(asTrimmedString)
                  .filter(Boolean)
              : [];

            return (
              <Card key={run.id} className="space-y-6 rounded-2xl border border-pink/20 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {run.output?.title || run.title || `${platformLabelText} Campaign`}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {platformLabelText} • {asTrimmedString(run.inputs?.adFormat) || 'Format selected'}
                      {createdTime ? ` • ${createdTime}` : ''}
                    </p>
                  </div>
                  {sections.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {sections.map((section) => (
                        <Badge key={section} variant="secondary" className="rounded-full bg-pink/10 text-vox-pink border-pink/20 px-3 py-1 text-xs">
                          {section}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {variations.length === 0 ? (
                    <Card className="rounded-2xl border border-dashed border-pink/20 bg-white p-6">
                      <p className="text-sm text-muted-foreground">
                        Unable to parse structured variations. Raw output:
                      </p>
                      <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-white border border-pink/20 p-4 text-xs text-muted-foreground">
                        {typeof run.output?.content === 'string'
                          ? run.output?.content
                          : JSON.stringify(run.output?.content, null, 2)}
                      </pre>
                    </Card>
                  ) : (
                    variations.map((variation) => (
                      <Card key={variation.id} className="rounded-2xl border border-pink/20 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-base font-semibold text-foreground">{variation.label}</h4>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-pink/30 bg-white hover:bg-pink/10"
                            onClick={() => {
                              void handleCopy(variation.copyPayload, variation.id);
                            }}
                          >
                            {copiedVariationId === variation.id ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <Check className="h-4 w-4" />
                                Copied
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Copy className="h-4 w-4" />
                                Copy
                              </span>
                            )}
                          </Button>
                        </div>

                        <div className="mt-4 space-y-3">
                          {variation.headline && (
                            <div>
                              <p className="text-xs font-semibold uppercase text-vox-pink">Headline</p>
                              <p className="mt-1 text-base font-semibold text-foreground">{variation.headline}</p>
                            </div>
                          )}

                          {variation.primaryText && (
                            <div>
                              <p className="text-xs font-semibold uppercase text-vox-pink">Primary Text</p>
                              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                                {variation.primaryText}
                              </p>
                            </div>
                          )}

                          {variation.supportingPoints.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase text-vox-pink">Key Points</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                {variation.supportingPoints.map((point, pointIndex) => (
                                  <li key={`${variation.id}-point-${pointIndex}`}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {variation.cta && (
                            <div>
                              <p className="text-xs font-semibold uppercase text-vox-pink">CTA</p>
                              <p className="mt-1 text-sm font-semibold text-vox-pink">{variation.cta}</p>
                            </div>
                          )}

                          {variation.extraFields.length > 0 && (
                            <div className="grid gap-3 md:grid-cols-2">
                              {variation.extraFields.map((field) => (
                                <div
                                  key={`${variation.id}-${field.label}`}
                                  className="rounded-xl bg-pink/5 border border-pink/10 p-3"
                                >
                                  <p className="text-xs font-semibold uppercase text-vox-pink">
                                    {field.label}
                                  </p>
                                  <p className="mt-1 text-sm leading-relaxed text-foreground">{field.value}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
};

export default AdCopyGenerator;


