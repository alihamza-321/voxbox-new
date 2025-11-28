import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/components/ui/use-toast';

import {
  createSocialMediaAmplifier,
  listAmplifierRuns,
  type AmplifierSocialMediaPost,
  type SocialMediaAmplifierRun,
} from '@/lib/amplifiers';
import { listWorkspaceSessions, type WorkspaceSession } from '@/lib/ava-api';
import { listWorkspaceBriefs, type WorkspaceBrief } from '@/lib/margo-api';
import { pickDisplayName } from '@/lib/display';
import { useAmplifierField, useAmplifierScrollRestoration } from '@/hooks/useAmplifierPersistence';
import { getVeraProfiles, type VeraProfile } from '@/lib/vera-api';

const platformOptions = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'tiktok', label: 'TikTok' },
];

const numberOptions = Array.from({ length: 10 }).map((_, idx) => String(idx + 1));

const isCompletedSession = (session: WorkspaceSession): boolean => {
  return session.status === 'completed' || session.currentPhase === 'completed';
};

const isCompletedBrief = (brief: WorkspaceBrief): boolean => {
  return ['completed', 'ready_for_export'].includes((brief.status || '').toLowerCase());
};

const extractSocialMediaPosts = (value: unknown): AmplifierSocialMediaPost[] => {
  if (!value) {
    return [];
  }

  const normalizeCandidate = (candidate: unknown): AmplifierSocialMediaPost[] | null => {
    if (!candidate) {
      return null;
    }

    if (Array.isArray(candidate)) {
      return candidate as AmplifierSocialMediaPost[];
    }

    if (typeof candidate === 'object') {
      const nestedKeys = ['content', 'posts', 'items', 'data'];
      for (const key of nestedKeys) {
        const nested = (candidate as Record<string, unknown>)[key];
        if (Array.isArray(nested)) {
          return nested as AmplifierSocialMediaPost[];
        }
      }

      for (const nested of Object.values(candidate as Record<string, unknown>)) {
        if (Array.isArray(nested)) {
          return nested as AmplifierSocialMediaPost[];
        }
      }
    }

    if (typeof candidate === 'string') {
      try {
        const parsed = JSON.parse(candidate);
        const normalized = normalizeCandidate(parsed);
        if (normalized) {
          return normalized;
        }
      } catch {
        // ignore parse errors
      }
    }

    return null;
  };

  const direct = normalizeCandidate(value);
  if (direct) {
    return direct;
  }

  return [];
};

const formatHashtags = (hashtags: string[] | undefined): string => {
  if (!hashtags || hashtags.length === 0) {
    return '';
  }

  return hashtags
    .map((tag) => {
      if (!tag) {
        return '';
      }
      const trimmed = tag.trim();
      if (!trimmed) {
        return '';
      }
      return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    })
    .filter(Boolean)
    .join(' ');
};

const SocialMediaGenerator = () => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [avaSessions, setAvaSessions] = useState<WorkspaceSession[]>([]);
  const [margoBriefs, setMargoBriefs] = useState<WorkspaceBrief[]>([]);
  const [runs, setRuns] = useState<SocialMediaAmplifierRun[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<VeraProfile[]>([]);

  const amplifierKey = 'socialMedia' as const;

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
    platformOptions[0]?.value ?? 'instagram',
  );
  const [topicOrTheme, setTopicOrTheme] = useAmplifierField<string>(
    amplifierKey,
    'topicOrTheme',
    '',
  );
  const [numberOfPosts, setNumberOfPosts] = useAmplifierField<string>(
    amplifierKey,
    'numberOfPosts',
    '3',
  );
  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useAmplifierField<string>(
    amplifierKey,
    'selectedVoiceProfileId',
    '',
  );
  const [cta] = useState('Start your free trial today!');
  const [copiedPostKey, setCopiedPostKey] = useState<string>('');

  useAmplifierScrollRestoration(amplifierKey);

  const workspaceId = currentWorkspace?.id;

  const platformLabelMap = useMemo(() => {
    return new Map(platformOptions.map((option) => [option.value, option.label]));
  }, []);

  const voiceProfileOptions = useMemo(() => {
    return voiceProfiles
      .filter((profile) => profile.isComplete && Boolean(profile.finalProfile))
      .map((profile) => ({
        value: profile.id,
        label: profile.name?.trim() || 'Untitled voice profile',
      }));
  }, [voiceProfiles]);

  const hasVoiceProfiles = voiceProfileOptions.length > 0;

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
        listAmplifierRuns<AmplifierSocialMediaPost[] | string>(workspaceId, 'social_media'),
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
      const message = error instanceof Error && error.message ? error.message : 'Failed to load amplifier data';
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

  useEffect(() => {
    if (!workspaceId) {
      setVoiceProfiles([]);
      setSelectedVoiceProfileId('');
      return;
    }

    let isMounted = true;

    const fetchVoiceProfiles = async () => {
      try {
        const response = await getVeraProfiles(workspaceId);
        if (!isMounted) {
          return;
        }
        const profiles = (response?.data ?? []).filter(
          (profile) => profile.isComplete && Boolean(profile.finalProfile),
        );
        setVoiceProfiles(profiles);
        setSelectedVoiceProfileId((prev) => prev || profiles[0]?.id || '');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.error('[SocialMediaGenerator] Failed to load voice profiles', error);
        toast({
          title: 'Could not load voice profiles',
          description:
            error instanceof Error && error.message ? error.message : 'Please refresh and try again.',
          variant: 'destructive',
        });
        setVoiceProfiles([]);
      }
    };

    void fetchVoiceProfiles();

    return () => {
      isMounted = false;
    };
  }, [workspaceId, setSelectedVoiceProfileId, toast]);

  useEffect(() => {
    if (!copiedPostKey) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopiedPostKey('');
    }, 2000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copiedPostKey]);

  const handleCopyPost = useCallback(
    async (text: string, key: string) => {
      if (!text) {
        toast({
          title: 'Nothing to copy',
          description: 'This post does not include any text yet.',
          variant: 'destructive',
        });
        return;
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'absolute';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }

        setCopiedPostKey(key);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Copy failed',
          description: 'We could not copy this post to your clipboard. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const handleScrollToForm = useCallback(() => {
    if (!formRef.current) {
      return;
    }

    formRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

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

      if (!selectedAvaSessionId) {
        toast({
          title: 'Select an AVA session',
          description: 'You need a completed AVA session to generate content.',
          variant: 'destructive',
        });
        return;
      }

      if (!selectedMargoBriefId) {
        toast({
          title: 'Select a MARGO brief',
          description: 'You need a completed product brief to generate content.',
          variant: 'destructive',
        });
        return;
      }

      const trimmedTopic = topicOrTheme.trim();
      if (!trimmedTopic) {
        toast({
          title: 'Add a topic or theme',
          description: 'Provide a topic or theme for the social media posts.',
          variant: 'destructive',
        });
        return;
      }

      const parsedPostCount = Number.parseInt(numberOfPosts, 10);
      const normalizedPostCount = Number.isNaN(parsedPostCount) ? 3 : Math.min(Math.max(parsedPostCount, 1), 10);

      try {
        setIsSubmitting(true);

        const newRun = await createSocialMediaAmplifier({
          workspaceId,
          avaSessionId: selectedAvaSessionId,
          margoProfileId: selectedMargoBriefId,
          cta,
          platform,
          topicOrTheme: trimmedTopic,
          numberOfPosts: normalizedPostCount,
        });

        setRuns((prev) => [newRun, ...prev]);

        toast({
          title: 'Social media posts generated',
          description: 'Your social media content is ready.',
        });
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Failed to generate social media posts. Please try again.';
        toast({
          title: 'Generation failed',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      cta,
      platform,
      numberOfPosts,
      selectedAvaSessionId,
      selectedMargoBriefId,
      topicOrTheme,
      toast,
      workspaceId,
    ],
  );

  const isTopicOrThemeValid = useMemo(() => {
    return topicOrTheme.trim().length >= 10;
  }, [topicOrTheme]);

  const isGenerateDisabled = useMemo(() => {
    return (
      isSubmitting ||
      !selectedAvaSessionId ||
      !selectedMargoBriefId ||
      !isTopicOrThemeValid ||
      !platform ||
      !numberOfPosts
    );
  }, [
    isSubmitting,
    isTopicOrThemeValid,
    numberOfPosts,
    platform,
    selectedAvaSessionId,
    selectedMargoBriefId,
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/amplifiers')}
            className="border-pink/20 bg-white text-foreground hover:bg-pink/10 hover:text-[#ff1f6c] hover:border-pink/40 transition-all duration-300 ease-in-out hover:shadow-md hover:shadow-pink/10 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black">
            <Monitor className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Social Media Posts</h1>
            <p className="text-base text-muted-foreground">
              Generate scroll-stopping social content powered by your AVA profiles and MARGO briefs.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <Card className="border border-pink/20 bg-white shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold text-foreground">Configure Social Posts</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Create platform-optimized content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ava-session">Client Profile</Label>
                  <Select
                    value={selectedAvaSessionId}
                    onValueChange={setSelectedAvaSessionId}
                    disabled={isLoading || avaSessions.length === 0}
                  >
                    <SelectTrigger
                      id="ava-session"
                      className="h-12 rounded-2xl border border-pink/20 bg-white text-left shadow-sm focus:border-[#ff1f6c] focus:ring-[#ff1f6c]"
                    >
                      <SelectValue placeholder="Select client profile" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-pink/20 bg-white shadow-lg">
                      {avaSessions.map((session) => {
                        const completedOrCreatedAt = session.completedAt ?? session.createdAt;
                        const relativeTime =
                          completedOrCreatedAt && !Number.isNaN(new Date(completedOrCreatedAt).getTime())
                            ? formatDistanceToNow(new Date(completedOrCreatedAt), { addSuffix: true })
                            : null;
                        const sessionLabel = pickDisplayName(
                          [session.userName, session.sessionName, session.id],
                          'Client Profile',
                        );
                        return (
                          <SelectItem key={session.id} value={session.id}>
                            <div className="flex flex-col">
                              <span>{sessionLabel}</span>
                              {relativeTime ? (
                                <span className="text-xs text-muted-foreground">{relativeTime}</span>
                              ) : null}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {avaSessions.length === 0 && !isLoading ? (
                    <p className="text-xs text-muted-foreground">
                      No completed AVA sessions found. Complete one to power this amplifier.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="margo-brief">Product Profile</Label>
                  <Select
                    value={selectedMargoBriefId}
                    onValueChange={setSelectedMargoBriefId}
                    disabled={isLoading || margoBriefs.length === 0}
                  >
                    <SelectTrigger
                      id="margo-brief"
                      className="h-12 rounded-2xl border border-pink/20 bg-white text-left shadow-sm focus:border-[#ff1f6c] focus:ring-[#ff1f6c]"
                    >
                      <SelectValue placeholder="Select product profile" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-pink/20 bg-white shadow-lg">
                      {margoBriefs.map((brief) => {
                        const updatedOrCreatedAt = brief.updatedAt ?? brief.createdAt;
                        const relativeTime =
                          updatedOrCreatedAt && !Number.isNaN(new Date(updatedOrCreatedAt).getTime())
                            ? formatDistanceToNow(new Date(updatedOrCreatedAt), { addSuffix: true })
                            : null;
                        const briefLabel = pickDisplayName(
                          [brief.userName, typeof brief.productName === 'string' ? brief.productName : null, brief.sessionName],
                          'Product Profile',
                        );
                        return (
                          <SelectItem key={brief.id} value={brief.id}>
                            <div className="flex flex-col">
                              <span>{briefLabel}</span>
                              {relativeTime ? (
                                <span className="text-xs text-muted-foreground">{relativeTime}</span>
                              ) : null}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {margoBriefs.length === 0 && !isLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Finish a MARGO product brief to unlock social content generation.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="voice-profile">Voice profile</Label>
                  <Select
                    value={selectedVoiceProfileId}
                    onValueChange={setSelectedVoiceProfileId}
                    disabled={!hasVoiceProfiles}
                  >
                    <SelectTrigger
                      id="voice-profile"
                      className="h-12 rounded-2xl border border-pink/20 bg-white text-left shadow-sm focus:border-[#ff1f6c] focus:ring-[#ff1f6c]"
                    >
                      <SelectValue placeholder={hasVoiceProfiles ? 'Select voice' : 'No voice profiles yet'} />
                    </SelectTrigger>
                    {hasVoiceProfiles ? (
                      <SelectContent className="rounded-2xl border border-pink/20 bg-white shadow-lg">
                        {voiceProfileOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    ) : null}
                  </Select>
                  {!hasVoiceProfiles ? (
                    <p className="text-xs text-muted-foreground">
                      Voice personalization support is coming soon to this amplifier.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger
                      id="platform"
                      className="h-12 rounded-2xl border border-pink/20 bg-white text-left shadow-sm focus:border-[#ff1f6c] focus:ring-[#ff1f6c]"
                    >
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-pink/20 bg-white shadow-lg">
                      {platformOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic">Topic or theme</Label>
                <Textarea
                  id="topic"
                  placeholder="What should the posts be about?"
                  value={topicOrTheme}
                  onChange={(event) => setTopicOrTheme(event.target.value)}
                  rows={3}
                  minLength={10}
                  className="min-h-[112px] resize-none rounded-2xl border border-pink/20 bg-white shadow-sm focus:border-[#ff1f6c]"
                />
                {topicOrTheme.trim().length < 10 && (
                  <p className="text-xs text-destructive">
                    {topicOrTheme.trim().length} / 10 characters minimum required
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="number-of-posts">Number of posts</Label>
                  <Select value={numberOfPosts} onValueChange={setNumberOfPosts}>
                    <SelectTrigger
                      id="number-of-posts"
                      className="h-12 rounded-2xl border border-pink/20 bg-white text-left shadow-sm focus:border-[#ff1f6c] focus:ring-[#ff1f6c]"
                    >
                      <SelectValue placeholder="Select number" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-pink/20 bg-white shadow-lg">
                      {numberOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cta">Call to action</Label>
                  <Input
                    id="cta"
                    value={cta}
                    disabled
                    className="h-12 rounded-2xl border border-pink/20 bg-white shadow-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Customize CTAs soon—this default keeps campaigns consistent for now.
                  </p>
                </div>
              </div>

              <Button
                className="w-full rounded-full bg-[#ff1f6c] px-6 py-6 text-base font-semibold text-white shadow-sm transition hover:bg-[#e51860]"
                type="submit"
                disabled={isGenerateDisabled}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Posts'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-pink/20 bg-white shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold text-foreground">Generated Social Posts</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Ready-to-publish content for your audience
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {loadError}
              </div>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Generate your first batch of posts to see them appear here instantly.
              </p>
            ) : (
              <div className="space-y-5">
                {runs.map((run) => {
                  const posts = extractSocialMediaPosts(run.output?.content);
                  const generatedAt = run.createdAt ? new Date(run.createdAt) : null;
                  const runInputs = (run.inputs ?? {}) as Record<string, unknown>;
                  const runPlatformValue =
                    typeof runInputs['platform'] === 'string' ? (runInputs['platform'] as string) : undefined;
                  const runTopic =
                    typeof runInputs['topicOrTheme'] === 'string' ? (runInputs['topicOrTheme'] as string) : undefined;
                  const resolvedRunPlatformLabel = runPlatformValue
                    ? platformLabelMap.get(runPlatformValue) ?? runPlatformValue
                    : undefined;
                  const runPostCount =
                    typeof runInputs['numberOfPosts'] === 'number'
                      ? (runInputs['numberOfPosts'] as number)
                      : typeof runInputs['numberOfPosts'] === 'string'
                        ? Number.parseInt(runInputs['numberOfPosts'] as string, 10)
                        : posts.length;
                  const resolvedRunDescription = runTopic
                    ? `Ready-to-publish content for ${
                        resolvedRunPlatformLabel ?? 'your audience'
                      } about “${runTopic}”.`
                    : 'Ready-to-publish content for your audience.';

                  return (
                    <div
                      key={run.id}
                      className="overflow-hidden rounded-3xl border border-[#f3e6ff] bg-white shadow-sm transition hover:shadow-md"
                    >
                      <div className="border-b border-pink/20 bg-pink/5 px-6 py-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#ff1f6c]">
                              Generated Social Posts
                            </p>
                            <h3 className="text-xl font-semibold text-foreground">
                              {run.title || 'Social media campaign'}
                            </h3>
                            <p className="text-sm text-muted-foreground">{resolvedRunDescription}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 text-right">
                            <span className="rounded-full bg-[#ff1f6c]/10 px-3 py-1 text-xs font-semibold uppercase text-[#ff1f6c]">
                              {run.status}
                            </span>
                            {generatedAt && !Number.isNaN(generatedAt.getTime()) ? (
                              <span className="text-xs text-muted-foreground">
                                Generated {formatDistanceToNow(generatedAt, { addSuffix: true })}
                              </span>
                            ) : null}
                            {runPostCount ? (
                              <span className="text-xs text-muted-foreground">
                                {runPostCount} {runPostCount === 1 ? 'post' : 'posts'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="px-6 py-6">
                        {posts.length > 0 ? (
                          <div className="space-y-5">
                            {posts.map((post, index) => {
                              const postKey = `${run.id}-${post.postNumber ?? index + 1}`;
                              const caption = typeof post.caption === 'string' ? post.caption : '';
                              const postPlatformValue =
                                typeof post.platform === 'string' && post.platform
                                  ? post.platform
                                  : runPlatformValue;
                              const postPlatformLabel = postPlatformValue
                                ? platformLabelMap.get(postPlatformValue) ?? postPlatformValue
                                : resolvedRunPlatformLabel;
                              const characterCount =
                                typeof post.characterCount === 'number'
                                  ? post.characterCount
                                  : caption.length;
                              const hashtags =
                                Array.isArray(post.hashtags) && post.hashtags.length > 0
                                  ? post.hashtags.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '')
                                  : [];
                              const metadataParts: string[] = [];
                              if (postPlatformLabel) {
                                metadataParts.push(`Platform: ${postPlatformLabel}`);
                              }
                              if (characterCount > 0) {
                                metadataParts.push(`Character count: ${characterCount}`);
                              }
                              const metadataLine = metadataParts.join(' • ');

                              return (
                                <div
                                  key={postKey}
                                  className="space-y-3 rounded-2xl border border-pink/20 bg-white p-5 shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-foreground">
                                        Post {post.postNumber ?? index + 1}
                                      </p>
                                      {post.notes ? (
                                        <p className="text-xs font-medium uppercase tracking-wide text-[#ff1f6c]">
                                          {post.notes}
                                        </p>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      className="inline-flex items-center rounded-full border border-pink/30 bg-white px-3 py-1 text-xs font-semibold text-[#ff1f6c] shadow-sm transition hover:bg-pink/10"
                                      onClick={() => {
                                        void handleCopyPost(caption, postKey);
                                      }}
                                    >
                                      {copiedPostKey === postKey ? 'Copied!' : 'Copy'}
                                    </button>
                                  </div>

                                  {caption ? (
                                    <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                                      {caption}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      This post does not include text content yet.
                                    </p>
                                  )}

                                  {hashtags.length > 0 ? (
                                    <p className="text-sm font-medium text-[#ff1f6c]">{formatHashtags(hashtags)}</p>
                                  ) : null}

                                  {metadataLine ? (
                                    <p className="text-xs text-muted-foreground">{metadataLine}</p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : typeof run.output?.content === 'string' ? (
                          <pre className="max-h-72 overflow-auto rounded-2xl border border-pink/20 bg-white p-4 text-sm text-foreground whitespace-pre-wrap">
                            {run.output.content}
                          </pre>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No structured posts were returned. The raw output might not be in the expected format.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          {runs.length > 0 ? (
            <div className="px-6 pb-6 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full rounded-full border border-pink/30 bg-pink/5 px-6 py-3 text-sm font-semibold text-[#ff1f6c] shadow-sm transition hover:bg-pink/10"
                onClick={handleScrollToForm}
              >
                Generate More Posts
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

export default SocialMediaGenerator;


