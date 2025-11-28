import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Newspaper } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/components/ui/use-toast';

import {
  createBlogPostAmplifier,
  listAmplifierRuns,
  type BlogPostAmplifierRun,
} from '@/lib/amplifiers';
import { listWorkspaceSessions, type WorkspaceSession } from '@/lib/ava-api';
import { listWorkspaceBriefs, type WorkspaceBrief } from '@/lib/margo-api';
import { pickDisplayName } from '@/lib/display';
import { useAmplifierField, useAmplifierScrollRestoration } from '@/hooks/useAmplifierPersistence';
import { getVeraProfiles, type VeraProfile } from '@/lib/vera-api';

const wordCountOptions = [
  { value: '800', label: 'Short (≈800 words)' },
  { value: '1200', label: 'Standard (≈1,200 words)' },
  { value: '1500', label: 'In-depth (≈1,500 words)' },
  { value: '2000', label: 'Comprehensive (≈2,000 words)' },
];

const DEFAULT_CTA = 'Download our free guide';
const MIN_TEXT_LENGTH = 10;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Something went wrong. Please try again.';
};

const parseKeyPointsInput = (value: string): string[] => {
  return value
    .split(/[\r\n,]+/)
    .map((point) => point.replace(/^[\s*-•]+/, '').trim())
    .filter(Boolean);
};

interface BlogPostSection {
  heading: string;
  paragraphs: string[];
  bullets: string[];
}

interface ParsedBlogPost {
  intro: string[];
  sections: BlogPostSection[];
  cta?: string;
}

const parseBlogPostContent = (content: string): ParsedBlogPost => {
  if (!content || typeof content !== 'string') {
    return { intro: [], sections: [] };
  }

  const lines = content.split(/\r?\n/);
  const intro: string[] = [];
  const sections: BlogPostSection[] = [];
  let currentSection: BlogPostSection | null = null;
  let buffer: string[] = [];
  let extractedCta: string | undefined;

  const flushBuffer = () => {
    if (buffer.length === 0) {
      return;
    }

    const paragraph = buffer.join(' ').replace(/\s+/g, ' ').trim();
    buffer = [];

    if (!paragraph) {
      return;
    }

    if (currentSection) {
      currentSection.paragraphs.push(paragraph);
    } else {
      intro.push(paragraph);
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBuffer();
      continue;
    }

    if (/^#{2,6}\s+/.test(trimmed)) {
      flushBuffer();
      const heading = trimmed.replace(/^#{2,6}\s*/, '').trim();
      currentSection = {
        heading,
        paragraphs: [],
        bullets: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      flushBuffer();
      const bullet = trimmed.replace(/^[-*•]\s+/, '').replace(/\*\*/g, '').trim();
      if (currentSection) {
        currentSection.bullets.push(bullet);
      } else if (bullet) {
        intro.push(bullet);
      }
      continue;
    }

    if (/^\*\*(.+)\*\*$/.test(trimmed) && !extractedCta) {
      flushBuffer();
      extractedCta = trimmed.replace(/^\*\*(.+)\*\*$/, '$1').trim();
      continue;
    }

    buffer.push(trimmed.replace(/\*\*/g, ''));
  }

  flushBuffer();

  return {
    intro,
    sections,
    cta: extractedCta,
  };
};

const isCompletedSession = (session: WorkspaceSession): boolean => {
  return session.status === 'completed' || session.currentPhase === 'completed';
};

const isCompletedBrief = (brief: WorkspaceBrief): boolean => {
  return ['completed', 'ready_for_export'].includes((brief.status || '').toLowerCase());
};

const BlogPostGenerator = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [avaSessions, setAvaSessions] = useState<WorkspaceSession[]>([]);
  const [margoBriefs, setMargoBriefs] = useState<WorkspaceBrief[]>([]);
  const [runs, setRuns] = useState<BlogPostAmplifierRun[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<VeraProfile[]>([]);

  const amplifierKey = 'blogPost' as const;

  const [selectedRunId, setSelectedRunId] = useAmplifierField<string>(
    amplifierKey,
    'selectedRunId',
    '',
  );

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

  const [blogTopic, setBlogTopic] = useAmplifierField<string>(amplifierKey, 'blogTopic', '');
  const [keyPoints, setKeyPoints] = useAmplifierField<string>(amplifierKey, 'keyPoints', '');
  const [wordCount, setWordCount] = useAmplifierField<string>(
    amplifierKey,
    'wordCount',
    wordCountOptions[2]?.value ?? '1500',
  );
  const [cta, setCta] = useAmplifierField<string>(amplifierKey, 'cta', DEFAULT_CTA);
  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useAmplifierField<string>(
    amplifierKey,
    'selectedVoiceProfileId',
    '',
  );

  useAmplifierScrollRestoration(amplifierKey);

  const workspaceId = currentWorkspace?.id;

  const hasPrerequisites = useMemo(() => {
    return avaSessions.length > 0 && margoBriefs.length > 0;
  }, [avaSessions.length, margoBriefs.length]);

  const voiceProfileOptions = useMemo(() => {
    return voiceProfiles
      .filter((profile) => profile.isComplete && Boolean(profile.finalProfile))
      .map((profile) => ({
        value: profile.id,
        label: profile.name?.trim() || 'Untitled voice profile',
      }));
  }, [voiceProfiles]);

  const hasVoiceProfiles = voiceProfileOptions.length > 0;

  const trimmedBlogTopicLength = useMemo(() => blogTopic.trim().length, [blogTopic]);
  const trimmedKeyPointsLength = useMemo(() => keyPoints.trim().length, [keyPoints]);
  const trimmedCtaLength = useMemo(() => cta.trim().length, [cta]);

  const isBlogTopicValid = trimmedBlogTopicLength >= MIN_TEXT_LENGTH;
  const isKeyPointsValid = trimmedKeyPointsLength >= MIN_TEXT_LENGTH;
  const isCtaValid = trimmedCtaLength >= MIN_TEXT_LENGTH;

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
        listAmplifierRuns<string>(workspaceId, 'blog_post'),
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
      setSelectedRunId((prev) => prev || runsResponse?.[0]?.id || '');
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(error);
      setLoadError(message);
      toast({
        title: 'Unable to load blog post data',
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
        console.error('[BlogPostGenerator] Failed to load voice profiles', error);
        toast({
          title: 'Could not load voice profiles',
          description: getErrorMessage(error),
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

  const executeGeneration = useCallback(async () => {
      console.log('[BlogPostGenerator] Attempting blog post generation');

      if (!workspaceId) {
        console.warn('[BlogPostGenerator] Aborted: no workspace selected');
        toast({
          title: 'No workspace selected',
          description: 'Please select or create a workspace before generating content.',
          variant: 'destructive',
        });
        return;
      }

      if (!selectedAvaSessionId) {
        console.warn('[BlogPostGenerator] Aborted: AVA profile missing');
        toast({
          title: 'Select an AVA profile',
          description: 'Complete an AVA session and select it to power the amplifier.',
          variant: 'destructive',
        });
        return;
      }

      if (!selectedMargoBriefId) {
        console.warn('[BlogPostGenerator] Aborted: MARGO brief missing');
        toast({
          title: 'Select a product brief',
          description: 'Complete a MARGO product brief and select it to power the amplifier.',
          variant: 'destructive',
        });
        return;
      }

      if (!blogTopic.trim()) {
        console.warn('[BlogPostGenerator] Aborted: blog topic missing');
        toast({
          title: 'Blog topic required',
          description: 'Enter the blog topic you want to generate.',
          variant: 'destructive',
        });
        return;
      }

      let keyPointsArray = parseKeyPointsInput(keyPoints);
      if (keyPointsArray.length === 0) {
        console.warn('[BlogPostGenerator] No key points provided, falling back to topic headline');
        keyPointsArray = [blogTopic.trim()];
      }

      const resolvedCta = cta.trim() || DEFAULT_CTA;
      const resolvedWordCount = Number(wordCount) || 1500;

      setIsSubmitting(true);

      try {
        console.log('[BlogPostGenerator] ▶️ Sending amplifier request', {
          workspaceId,
          avaSessionId: selectedAvaSessionId,
          margoProfileId: selectedMargoBriefId,
          blogTopic: blogTopic.trim(),
          keyPoints: keyPointsArray,
          wordCount: resolvedWordCount,
          cta: resolvedCta,
        });

        const newRun = await createBlogPostAmplifier({
          workspaceId,
          avaSessionId: selectedAvaSessionId,
          margoProfileId: selectedMargoBriefId,
          blogTopic: blogTopic.trim(),
          keyPointsToCover: keyPointsArray,
          wordCount: resolvedWordCount,
          cta: resolvedCta,
        });

        setRuns((prev) => [newRun, ...prev]);
        setSelectedRunId(newRun.id);

        console.log('[BlogPostGenerator] ✅ Received blog post run', {
          runId: newRun.id,
          title: newRun.output?.title,
          createdAt: newRun.createdAt,
        });

        toast({
          title: 'Blog post generated',
          description: 'Scroll down to review the generated content.',
        });
      } catch (error) {
        console.error('[BlogPostGenerator] ❌ Generation failed', error);
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
      selectedAvaSessionId,
      selectedMargoBriefId,
      blogTopic,
      keyPoints,
      cta,
      wordCount,
    ],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isBlogTopicValid || !isKeyPointsValid || !isCtaValid) {
        return;
      }
      void executeGeneration();
    },
    [executeGeneration, isBlogTopicValid, isKeyPointsValid, isCtaValid],
  );

  const selectedRun = useMemo(() => {
    if (!selectedRunId) {
      return runs[0] ?? null;
    }
    return runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;
  }, [runs, selectedRunId]);

  const parsedContent = useMemo(() => {
    const content = selectedRun?.output?.content ?? '';
    const parsed = parseBlogPostContent(content);
    if (selectedRun) {
      console.groupCollapsed('[BlogPostGenerator] 📄 Parsed blog post content');
      console.info('[BlogPostGenerator] Run ID:', selectedRun.id);
      console.info('[BlogPostGenerator] Title:', selectedRun.output?.title);
      console.info('[BlogPostGenerator] Sections:', parsed.sections.map((section) => section.heading));
      console.groupEnd();
    }
    return parsed;
  }, [selectedRun]);

  const runInputs = (selectedRun?.inputs ?? {}) as Record<string, unknown>;
  const runMetadata = (selectedRun?.output?.metadata ?? {}) as Record<string, unknown>;

  const runTopic =
    typeof runInputs.blogTopic === 'string' && runInputs.blogTopic
      ? runInputs.blogTopic
      : blogTopic.trim();

  const runKeyPoints = useMemo(() => {
    if (Array.isArray(runInputs.keyPointsToCover)) {
      return (runInputs.keyPointsToCover as unknown[])
        .map((point) => (typeof point === 'string' ? point.trim() : ''))
        .filter(Boolean);
    }

    if (typeof runInputs.keyPointsToCover === 'string') {
      return parseKeyPointsInput(runInputs.keyPointsToCover);
    }

    return parseKeyPointsInput(keyPoints);
  }, [runInputs.keyPointsToCover, keyPoints]);

  const metadataWordCountRaw = runMetadata.wordCount;
  const metadataWordCount =
    typeof metadataWordCountRaw === 'number'
      ? metadataWordCountRaw
      : typeof metadataWordCountRaw === 'string'
        ? Number(metadataWordCountRaw)
        : 0;

  const runWordCount =
    metadataWordCount ||
    (typeof runInputs.wordCount === 'number'
      ? runInputs.wordCount
      : typeof runInputs.wordCount === 'string'
        ? Number(runInputs.wordCount)
        : Number(wordCount) || 1500);

  const metadataSections = useMemo(() => {
    if (Array.isArray(runMetadata.sections)) {
      return (runMetadata.sections as unknown[])
        .map((section) => (typeof section === 'string' ? section.trim() : ''))
        .filter(Boolean);
    }
    return [];
  }, [runMetadata.sections]);

  const estimatedReadMinutes = Math.max(1, Math.round(runWordCount / 200));

  const generatedDate = selectedRun?.createdAt ? new Date(selectedRun.createdAt) : null;

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
            <Newspaper className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Blog Post Generator</h1>
            <p className="text-base text-muted-foreground">
              Generate engaging, SEO-optimized blog articles powered by your AVA and MARGO insights.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <section>
          <Card className="border border-pink/20 bg-white shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl font-semibold text-foreground">Configure Blog Post</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Select your profiles and define the outline to generate tailored blog content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="avaSession">Client Profile</Label>
                    <Select
                      value={selectedAvaSessionId}
                      onValueChange={setSelectedAvaSessionId}
                      disabled={avaSessions.length === 0}
                    >
                      <SelectTrigger id="avaSession" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                        <SelectValue
                          placeholder={
                            avaSessions.length > 0 ? 'Select client profile' : 'No completed client profiles yet'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                        {avaSessions.map((session) => {
                          const completedDate = new Date(session.completedAt ?? session.createdAt);
                          const relativeTime = formatDistanceToNow(completedDate, {
                            addSuffix: true,
                          });
                          const label = pickDisplayName(
                            [session.userName, session.sessionName, session.id],
                            'Client Profile',
                          );
                          return (
                            <SelectItem key={session.id} value={session.id}>
                              {`${label} • ${relativeTime}`}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="margoBrief">Product Profile</Label>
                    <Select
                      value={selectedMargoBriefId}
                      onValueChange={setSelectedMargoBriefId}
                      disabled={margoBriefs.length === 0}
                    >
                      <SelectTrigger id="margoBrief" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                        <SelectValue
                          placeholder={
                            margoBriefs.length > 0 ? 'Select product profile' : 'No completed product profiles yet'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                        {margoBriefs.map((brief) => {
                          const updatedDate = new Date(brief.updatedAt ?? brief.createdAt);
                          const relativeTime = formatDistanceToNow(updatedDate, {
                            addSuffix: true,
                          });
                          const label = pickDisplayName(
                            [brief.userName, brief.productName, brief.sessionName, brief.id],
                            'Product Profile',
                          );
                          return (
                            <SelectItem key={brief.id} value={brief.id}>
                              {`${label} • ${relativeTime}`}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="blogTopic">Blog topic</Label>
                    <Input
                      id="blogTopic"
                      value={blogTopic}
                      onChange={(event) => setBlogTopic(event.target.value)}
                      placeholder="Enter your blog post topic"
                      className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink"
                      minLength={MIN_TEXT_LENGTH}
                    />
                    {!isBlogTopicValid && (
                      <p className="text-xs text-destructive">
                        {trimmedBlogTopicLength} / {MIN_TEXT_LENGTH} characters minimum required
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keyPoints">Key points to cover</Label>
                    <Textarea
                      id="keyPoints"
                      value={keyPoints}
                      onChange={(event) => setKeyPoints(event.target.value)}
                      placeholder="List the main points or sections you want to include"
                      minLength={MIN_TEXT_LENGTH}
                      className="min-h-[120px] resize-none rounded-xl border border-pink/20 bg-white focus:border-vox-pink"
                    />
                    <p className="text-xs text-muted-foreground">
                      Separate each key point with a new line or comma.
                    </p>
                    {!isKeyPointsValid && (
                      <p className="text-xs text-destructive">
                        {trimmedKeyPointsLength} / {MIN_TEXT_LENGTH} characters minimum required
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wordCount">Word count</Label>
                    <Select value={wordCount} onValueChange={setWordCount}>
                      <SelectTrigger id="wordCount" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                        <SelectValue placeholder="Select length" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                        {wordCountOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voiceProfile">Voice profile (optional)</Label>
                    <Select
                      value={selectedVoiceProfileId}
                      onValueChange={setSelectedVoiceProfileId}
                      disabled={!hasVoiceProfiles}
                    >
                      <SelectTrigger id="voiceProfile" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                        <SelectValue
                          placeholder={
                            hasVoiceProfiles ? 'Select voice' : 'No voice profiles available yet'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                        {voiceProfileOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cta">Call to action</Label>
                  <Input
                    id="cta"
                    value={cta}
                    onChange={(event) => setCta(event.target.value)}
                    placeholder="Download our free guide"
                    minLength={MIN_TEXT_LENGTH}
                    className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink"
                  />
                  {!isCtaValid && (
                    <p className="text-xs text-destructive">
                      {trimmedCtaLength} / {MIN_TEXT_LENGTH} characters minimum required
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {hasPrerequisites
                      ? 'Complete the form to generate a ready-to-publish blog article.'
                      : 'Complete an AVA profile and a product brief to use this amplifier.'}
                  </p>
                  <Button
                    type="submit"
                    disabled={
                      !hasPrerequisites || isSubmitting || !isBlogTopicValid || !isKeyPointsValid || !isCtaValid
                    }
                    onClick={() => {
                      if (!isSubmitting && isBlogTopicValid && isKeyPointsValid && isCtaValid) {
                        void executeGeneration();
                      }
                    }}
                    className="h-12 w-full md:w-auto rounded-full bg-vox-pink px-6 text-base font-semibold text-white shadow-sm hover:bg-vox-pink/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Blog Post'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-foreground">Generated Blog Posts</h2>
              <p className="text-sm text-muted-foreground">
                Review and refine AI-generated drafts tailored to your audience insights.
              </p>
            </div>
            {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>

          {loadError && (
            <Card className="border border-red-200 bg-red-50">
              <CardContent className="py-6 text-destructive">
                <p>{loadError}</p>
              </CardContent>
            </Card>
          )}

          {!isLoading && runs.length === 0 && (
            <Card className="border border-dashed border-pink/20 bg-white">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Newspaper className="h-10 w-10 text-black" />
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">No blog posts yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate your first blog post to see rich, structured content appear here.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {runs.length > 0 && selectedRun && (
            <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
              <Card className="border border-pink/20 bg-white shadow-sm">
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold uppercase tracking-wide text-vox-pink">Generated Blog Post</p>
                    <h3 className="text-2xl font-semibold text-foreground">
                      {selectedRun.output?.title || runTopic || 'Untitled blog post'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {generatedDate && (
                        <span>
                          Published on {format(generatedDate, 'MMMM d, yyyy')}
                        </span>
                      )}
                      <span>•</span>
                      <span>{estimatedReadMinutes} min read</span>
                      {selectedRun.createdAt && (
                        <>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(selectedRun.createdAt), { addSuffix: true })}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {parsedContent.intro.length > 0 && (
                    <div className="space-y-4">
                      {parsedContent.intro.map((paragraph, index) => (
                        <p key={`intro-${index}`} className="text-base leading-relaxed text-foreground">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}

                  {parsedContent.sections.map((section, index) => (
                    <div key={`${section.heading}-${index}`} className="space-y-3">
                      <h4 className="text-xl font-semibold text-foreground">{section.heading}</h4>
                      {section.paragraphs.map((paragraph, paragraphIndex) => (
                        <p
                          key={`${section.heading}-paragraph-${paragraphIndex}`}
                          className="text-base leading-relaxed text-foreground"
                        >
                          {paragraph}
                        </p>
                      ))}
                      {section.bullets.length > 0 && (
                        <ul className="space-y-2 rounded-xl bg-pink/5 border border-pink/10 p-4 text-sm leading-relaxed text-foreground">
                          {section.bullets.map((bullet, bulletIndex) => (
                            <li key={`${section.heading}-bullet-${bulletIndex}`} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-vox-pink" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  {parsedContent.cta && (
                    <div className="rounded-xl bg-pink/10 border border-pink/20 p-6 text-center">
                      <p className="text-base font-semibold text-vox-pink">{parsedContent.cta}</p>
                    </div>
                  )}

                </CardContent>
              </Card>

              <aside className="space-y-4">
                <Card className="border border-pink/20 bg-white shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-foreground">Recent Generations</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Select a run to review its generated content.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {runs.map((run) => {
                      const isActive = run.id === selectedRun.id;
                      const runCreatedAt = run.createdAt ? new Date(run.createdAt) : null;
                      const relativeTime = runCreatedAt
                        ? formatDistanceToNow(runCreatedAt, { addSuffix: true })
                        : 'Unknown time';
                      const runInputsMap = (run.inputs ?? {}) as Record<string, unknown>;
                      const runTitle =
                        typeof run.output?.title === 'string' && run.output.title
                          ? run.output.title
                          : typeof runInputsMap.blogTopic === 'string'
                            ? runInputsMap.blogTopic
                            : 'Blog Post';

                      return (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => setSelectedRunId(run.id)}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                            isActive
                              ? 'border-vox-pink bg-pink/10 text-foreground'
                              : 'border-pink/20 bg-white text-foreground hover:-translate-y-[1px] hover:border-vox-pink hover:shadow-md'
                          }`}
                        >
                          <p className="text-sm font-semibold">{runTitle}</p>
                          <p className="text-xs text-muted-foreground">{relativeTime}</p>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="border border-dashed border-pink/20 bg-white shadow-none">
                  <CardContent className="space-y-4 py-6 text-sm text-muted-foreground">
                    <div>
                      <p className="font-semibold text-foreground">Blog topic</p>
                      <p>{runTopic || '—'}</p>
                    </div>
                    {runKeyPoints.length > 0 && (
                      <div>
                        <p className="font-semibold text-foreground">Key points included</p>
                        <ul className="mt-2 space-y-2">
                          {runKeyPoints.map((point, index) => (
                            <li key={`${point}-${index}`} className="flex items-start gap-2 text-sm">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-vox-pink" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsedContent.cta && (
                      <div>
                        <p className="font-semibold text-foreground">Call to action</p>
                        <p>{parsedContent.cta}</p>
                      </div>
                    )}
                    {metadataSections.length > 0 && (
                      <div>
                        <p className="font-semibold text-foreground">Sections included</p>
                        <ul className="mt-2 space-y-2">
                          {metadataSections.map((section, index) => (
                            <li key={`${section}-${index}`} className="flex items-start gap-2 text-sm">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-vox-pink" />
                              <span>{section}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-foreground">Approximate word count</p>
                      <p>{runWordCount ? `${runWordCount.toLocaleString()} words` : '—'}</p>
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default BlogPostGenerator;


