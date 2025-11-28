import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Check, Clapperboard, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/components/ui/use-toast';

import {
  createVideoScriptAmplifier,
  listAmplifierRuns,
  type VideoScriptAmplifierRun,
} from '@/lib/amplifiers';
import { listWorkspaceSessions, type WorkspaceSession } from '@/lib/ava-api';
import { listWorkspaceBriefs, type WorkspaceBrief } from '@/lib/margo-api';
import { pickDisplayName } from '@/lib/display';
import { useAmplifierField, useAmplifierScrollRestoration } from '@/hooks/useAmplifierPersistence';

interface VideoScriptSegment {
  title: string;
  timeRange?: string;
  paragraphs: string[];
  visualCue?: string;
}

const videoDurationOptions: { value: string; label: string }[] = [
  { value: '60-90 seconds', label: 'Short (60-90 seconds)' },
  { value: '90-120 seconds', label: 'Medium (1.5-2 minutes)' },
  { value: '2-3 minutes', label: 'Extended (2-3 minutes)' },
  { value: '3-5 minutes', label: 'Long-form (3-5 minutes)' },
];

const videoStyleOptions: { value: string; label: string }[] = [
  { value: 'Educational and engaging', label: 'Educational & Engaging' },
  { value: 'High-energy promotional', label: 'High-Energy Promotional' },
  { value: 'Story-driven narrative', label: 'Story-Driven Narrative' },
  { value: 'Conversational tutorial', label: 'Conversational Tutorial' },
  { value: 'Case study spotlight', label: 'Case Study Spotlight' },
];

const defaultCta = 'Subscribe for more insights';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return 'Something went wrong. Please try again.';
};

const parseVideoScriptContent = (content: unknown): VideoScriptSegment[] => {
  if (typeof content !== 'string') {
    return [];
  }

  const segments: VideoScriptSegment[] = [];
  const lines = content.split(/\r?\n/);

  interface WorkingSegment {
    title: string;
    timeRange?: string;
    lines: string[];
    visualCue?: string;
  }

  let current: WorkingSegment | null = null;

  const flush = () => {
    if (!current) {
      return;
    }

    const paragraphs: string[] = [];
    let buffer: string[] = [];

    const pushBuffer = () => {
      if (buffer.length > 0) {
        paragraphs.push(buffer.join(' '));
        buffer = [];
      }
    };

    for (const line of current.lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        pushBuffer();
        continue;
      }

      buffer.push(trimmed);
    }

    pushBuffer();

    if (paragraphs.length > 0 || current.visualCue) {
      segments.push({
        title: current.title,
        timeRange: current.timeRange,
        paragraphs,
        visualCue: current.visualCue,
      });
    }

    current = null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (/^\*\*(.+)\*\*$/.test(trimmed)) {
      const match = trimmed.match(/^\*\*(.+)\*\*$/);
      flush();

      if (match) {
        const heading = match[1].trim();
        const timeMatch = heading.match(/\(([^)]+)\)/);
        const title = heading.replace(/\s*\([^)]*\)\s*$/, '').trim();

        current = {
          title: title || 'Section',
          timeRange: timeMatch?.[1]?.trim(),
          lines: [],
        };
      }
      continue;
    }

    if (!current) {
      if (!trimmed) {
        continue;
      }

      current = {
        title: 'Overview',
        lines: [],
      };
    }

    if (/^\[Visual:\s*(.+)\]$/i.test(trimmed)) {
      const visualMatch = trimmed.match(/^\[Visual:\s*(.+)\]$/i);
      if (visualMatch?.[1]) {
        current.visualCue = visualMatch[1].trim();
      }
      continue;
    }

    current.lines.push(rawLine);
  }

  flush();

  return segments;
};

let inlineElementId = 0;
const renderInline = (text: string): ReactNode[] => {
  const getKey = () => `video-inline-${inlineElementId++}`;

  const renderBold = (segment: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = boldRegex.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(segment.slice(lastIndex, match.index));
      }

      nodes.push(
        <span key={getKey()} className="font-semibold text-foreground">
          {match[1]}
        </span>,
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < segment.length) {
      nodes.push(segment.slice(lastIndex));
    }

    return nodes;
  };

  const nodes: ReactNode[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderBold(text.slice(lastIndex, match.index)));
    }

    const linkText = match[1] ?? '';
    const linkHref = (match[2] ?? '').trim();
    const linkChildren = renderBold(linkText);

    nodes.push(
      <a
        key={getKey()}
        href={linkHref || undefined}
        target={linkHref ? '_blank' : undefined}
        rel={linkHref ? 'noopener noreferrer' : undefined}
        className="font-semibold text-[vox-pink] underline decoration-2 underline-offset-4 hover:text-[vox-pink/90]"
      >
        {linkChildren}
      </a>,
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderBold(text.slice(lastIndex)));
  }

  return nodes;
};

const VideoScriptGenerator = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [avaSessions, setAvaSessions] = useState<WorkspaceSession[]>([]);
  const [margoBriefs, setMargoBriefs] = useState<WorkspaceBrief[]>([]);
  const [runs, setRuns] = useState<VideoScriptAmplifierRun[]>([]);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);

  const amplifierKey = 'videoScript' as const;

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
  const [videoTopic, setVideoTopic] = useAmplifierField<string>(amplifierKey, 'videoTopic', '');
  const [videoDuration, setVideoDuration] = useAmplifierField<string>(
    amplifierKey,
    'videoDuration',
    videoDurationOptions[2]?.value ?? '2-3 minutes',
  );
  const [videoStyle, setVideoStyle] = useAmplifierField<string>(
    amplifierKey,
    'videoStyle',
    videoStyleOptions[0]?.value ?? 'Educational and engaging',
  );
  const [cta, setCta] = useAmplifierField<string>(amplifierKey, 'cta', defaultCta);

  useAmplifierScrollRestoration(amplifierKey);

  const workspaceId = currentWorkspace?.id;

  const hasPrerequisites = useMemo(() => {
    return avaSessions.length > 0 && margoBriefs.length > 0;
  }, [avaSessions.length, margoBriefs.length]);

  const isCtaValid = useMemo(() => {
    return cta.trim().length >= 10;
  }, [cta]);

  const isVideoTopicValid = useMemo(() => {
    return videoTopic.trim().length >= 10;
  }, [videoTopic]);

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
        listAmplifierRuns<string>(workspaceId, 'video_script'),
      ]);

      const completedSessions = [
        ...(sessionsResponse?.completed ?? []),
        ...(sessionsResponse?.active ?? []).filter(
          (session) => session.status === 'completed' || session.currentPhase === 'completed',
        ),
      ];

      const completedBriefs = (briefsResponse ?? []).filter((brief) =>
        ['completed', 'ready_for_export'].includes((brief.status || '').toLowerCase()),
      );

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
        title: 'Unable to load video script data',
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

      if (!selectedAvaSessionId) {
        toast({
          title: 'Select an AVA profile',
          description: 'Complete an AVA session and select it to power the amplifier.',
          variant: 'destructive',
        });
        return;
      }

      if (!selectedMargoBriefId) {
        toast({
          title: 'Select a MARGO product brief',
          description: 'Complete a MARGO product brief and select it to power the amplifier.',
          variant: 'destructive',
        });
        return;
      }

      const trimmedTopic = videoTopic.trim();
      if (!isVideoTopicValid) {
        toast({
          title: 'Video topic required',
          description: 'Please provide a video topic with at least 10 characters.',
          variant: 'destructive',
        });
        return;
      }

      if (!isCtaValid) {
        toast({
          title: 'Call-to-action required',
          description: 'Please provide a call-to-action with at least 10 characters.',
          variant: 'destructive',
        });
        return;
      }

      setIsSubmitting(true);

      try {
        const newRun = await createVideoScriptAmplifier({
          workspaceId,
          avaSessionId: selectedAvaSessionId,
          margoProfileId: selectedMargoBriefId,
          videoTopic: trimmedTopic,
          videoDuration,
          videoStyle,
          cta,
        });

        setRuns((prev) => [newRun, ...prev]);

        toast({
          title: 'Video script generated',
          description: 'Scroll down to review the generated script.',
        });

        setVideoTopic('');
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
      selectedAvaSessionId,
      selectedMargoBriefId,
      videoTopic,
      videoDuration,
      videoStyle,
      cta,
      isCtaValid,
      isVideoTopicValid,
    ],
  );

  const handleCopyScript = useCallback(
    async (content: string, runId: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedRunId(runId);
        setTimeout(() => {
          setCopiedRunId(null);
        }, 2000);
        toast({
          title: 'Script copied',
          description: 'The video script is ready to paste.',
        });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Unable to copy',
          description: 'Please copy the script manually.',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const selectedAvaName = useMemo(() => {
    const session = avaSessions.find((candidate) => candidate.id === selectedAvaSessionId);
    if (!session) {
      return 'Client Profile';
    }
    return pickDisplayName([session.userName, session.sessionName], 'Client Profile');
  }, [avaSessions, selectedAvaSessionId]);

  const selectedBriefName = useMemo(() => {
    const brief = margoBriefs.find((candidate) => candidate.id === selectedMargoBriefId);
    if (!brief) {
      return 'Product Profile';
    }
    return pickDisplayName([brief.userName, brief.productName, brief.sessionName], 'Product Profile');
  }, [margoBriefs, selectedMargoBriefId]);

  if (!workspaceId) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Select a workspace</CardTitle>
            <CardDescription>
              Choose a workspace to access Amplifiers and generate marketing content.
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
            className="border-[vox-pink]/20 bg-white text-foreground hover:bg-[vox-pink/10] hover:text-[vox-pink] hover:border-[vox-pink]/40 transition-all duration-300 ease-in-out hover:shadow-md hover:shadow-[vox-pink]/10 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black">
            <Clapperboard className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Video Script Generator</h1>
            <p className="text-sm text-muted-foreground">Create engaging scripts ready for filming.</p>
          </div>
        </div>
      </header>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Configure Video Script</CardTitle>
          <CardDescription>Generate scripts for your video content</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="video-topic">Video Topic</Label>
              <Textarea
                id="video-topic"
                value={videoTopic}
                onChange={(event) => setVideoTopic(event.target.value)}
                placeholder="What is your video about?"
                rows={4}
                disabled={isSubmitting || !hasPrerequisites}
                className="rounded-2xl border-border/70 bg-white resize-none"
              />
              {videoTopic.trim().length < 10 && (
                <p className="text-xs text-destructive">
                  {videoTopic.trim().length} / 10 characters minimum required
                </p>
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="video-duration">Video Duration</Label>
                <Select
                  value={videoDuration}
                  onValueChange={setVideoDuration}
                  disabled={isSubmitting || !hasPrerequisites}
                >
                  <SelectTrigger id="video-duration" className="h-12 rounded-xl border-border/80 bg-white">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoDurationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-style">Video Style</Label>
                <Select
                  value={videoStyle}
                  onValueChange={setVideoStyle}
                  disabled={isSubmitting || !hasPrerequisites}
                >
                  <SelectTrigger id="video-style" className="h-12 rounded-xl border-border/80 bg-white">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoStyleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ava-profile">Client Profile</Label>
                <Select
                  value={selectedAvaSessionId}
                  onValueChange={setSelectedAvaSessionId}
                  disabled={avaSessions.length === 0 || isSubmitting}
                >
                  <SelectTrigger id="ava-profile" className="h-12 rounded-xl border-border/80 bg-white">
                    <SelectValue placeholder="Select client profile" />
                  </SelectTrigger>
                  <SelectContent>
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
                <Label htmlFor="product-brief">Product Profile</Label>
                <Select
                  value={selectedMargoBriefId}
                  onValueChange={setSelectedMargoBriefId}
                  disabled={margoBriefs.length === 0 || isSubmitting}
                >
                  <SelectTrigger id="product-brief" className="h-12 rounded-xl border-border/80 bg-white">
                    <SelectValue placeholder="Select product profile" />
                  </SelectTrigger>
                  <SelectContent>
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

            <div className="space-y-2">
              <Label htmlFor="cta-text">Call-To-Action (used in the script)</Label>
              <Input
                id="cta-text"
                value={cta}
                onChange={(event) => setCta(event.target.value)}
                placeholder="Subscribe for more insights"
                disabled={isSubmitting || !hasPrerequisites}
                className="h-12 rounded-xl border-border/80 bg-white"
              />
              {cta.trim().length < 10 && (
                <p className="text-xs text-destructive">
                  {cta.trim().length} / 10 characters minimum required
                </p>
              )}
            </div>

            <div className="rounded-xl bg-[#f5f7f9] px-4 py-3 text-xs text-muted-foreground">
              Using <span className="font-medium text-foreground">{selectedAvaName}</span> with{' '}
              <span className="font-medium text-foreground">{selectedBriefName}</span> to personalize this script.
            </div>

            <Button
              type="submit"
              disabled={!hasPrerequisites || !isVideoTopicValid || !isCtaValid || isSubmitting}
              className="h-12 rounded-xl bg-[vox-pink] text-base font-semibold text-white transition hover:bg-[vox-pink/90]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Script…
                </span>
              ) : (
                'Generate Script'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Video Script</CardTitle>
          <CardDescription>Complete script with timing and visual cues</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-6 text-destructive">
              {loadError}
            </div>
          ) : runs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 px-6 py-12 text-center text-sm text-muted-foreground">
              Your generated video scripts will appear here once ready.
            </div>
          ) : (
            runs.map((run) => {
              const content = run.output?.content ?? '';
              const parsedSegments = parseVideoScriptContent(content);
              const metadataSections = Array.isArray(run.output?.metadata?.sections)
                ? (run.output?.metadata?.sections as string[])
                : [];
              const runInputs = (run.inputs ?? {}) as Record<string, unknown>;
              const durationFromInputs =
                typeof runInputs['videoDuration'] === 'string' ? (runInputs['videoDuration'] as string) : null;
              const styleFromInputs =
                typeof runInputs['videoStyle'] === 'string' ? (runInputs['videoStyle'] as string) : null;
              const topicFromInputs =
                typeof runInputs['videoTopic'] === 'string' ? (runInputs['videoTopic'] as string) : null;
              const runtimeLabel =
                durationFromInputs ??
                (typeof run.output?.metadata?.wordCount === 'number'
                  ? `Approx. ${Math.ceil((run.output.metadata.wordCount / 150) * 60)} seconds`
                  : 'Runtime unavailable');
              const videoStyleLabel = styleFromInputs ?? 'Style unavailable';
              const topicLabel = topicFromInputs ?? '';

              return (
                <Card key={run.id} className="rounded-xl border border-border/70 bg-white shadow-sm">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {metadataSections.length > 0 &&
                            metadataSections.map((section) => (
                              <span
                                key={`${run.id}-section-${section}`}
                                className="rounded-full bg-[vox-pink/10] px-3 py-1 text-xs font-medium text-[vox-pink]"
                              >
                                {section}
                              </span>
                            ))}
                        </div>
                        <CardTitle className="text-lg font-semibold">
                          {run.title || run.output?.title || 'Video Script'}
                        </CardTitle>
                        <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
                          Generated {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                        </CardDescription>
                      </div>
                      {typeof content === 'string' && content && (
                        <Button
                          variant="outline"
                          className="h-9 rounded-lg border-[vox-pink/20] text-sm font-semibold text-[vox-pink] hover:border-[vox-pink] flex items-center gap-2 shrink-0"
                          onClick={() => {
                            if (typeof content === 'string') {
                              void handleCopyScript(content, run.id);
                            }
                          }}
                        >
                          {copiedRunId === run.id ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            'Copy Script'
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-[#f7f8fa] px-3 py-1">
                        Total runtime: <span className="font-medium text-foreground">{runtimeLabel}</span>
                      </span>
                      <span className="rounded-full bg-[#f7f8fa] px-3 py-1">
                        Style: <span className="font-medium text-foreground">{videoStyleLabel}</span>
                      </span>
                      {topicLabel && (
                        <span className="rounded-full bg-[#f7f8fa] px-3 py-1">
                          Topic: <span className="font-medium text-foreground">{topicLabel}</span>
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {parsedSegments.length > 0 ? (
                      parsedSegments.map((segment, index) => (
                        <section
                          key={`${run.id}-segment-${index}`}
                          className="space-y-3 rounded-3xl border border-border/60 bg-[#fcfdfd] px-6 py-6 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start gap-3">
                            {segment.timeRange && (
                              <span className="inline-flex h-7 items-center rounded-full bg-[vox-pink/10] px-3 text-xs font-semibold text-[vox-pink]">
                                {segment.timeRange}
                              </span>
                            )}
                            <h3 className="text-lg font-semibold uppercase tracking-wide text-foreground">
                              {renderInline(segment.title)}
                            </h3>
                          </div>
                          <div className="space-y-3">
                            {segment.paragraphs.map((paragraph, paragraphIndex) => (
                              <p key={`${run.id}-paragraph-${index}-${paragraphIndex}`} className="text-sm text-muted-foreground">
                                {renderInline(paragraph)}
                              </p>
                            ))}
                          </div>
                          {segment.visualCue && (
                            <div className="rounded-xl bg-[vox-pink/10] px-4 py-3 text-xs font-medium text-[vox-pink]">
                              Visual: {segment.visualCue}
                            </div>
                          )}
                        </section>
                      ))
                    ) : typeof content === 'string' ? (
                      <div className="whitespace-pre-line rounded-xl bg-muted px-4 py-4 text-sm leading-relaxed text-muted-foreground">
                        {content}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                        The amplifier returned an unexpected format. Please regenerate the video script.
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VideoScriptGenerator;

