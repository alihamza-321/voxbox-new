import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/components/ui/use-toast';

import {
  createWebinarScriptAmplifier,
  listAmplifierRuns,
  type WebinarScriptAmplifierRun,
} from '@/lib/amplifiers';
import { listWorkspaceSessions, type WorkspaceSession } from '@/lib/ava-api';
import { listWorkspaceBriefs, type WorkspaceBrief } from '@/lib/margo-api';
import { pickDisplayName } from '@/lib/display';
import { useAmplifierField, useAmplifierScrollRestoration } from '@/hooks/useAmplifierPersistence';

interface WebinarScriptBlock {
  type: 'subheading' | 'paragraph' | 'list' | 'note';
  content?: string;
  items?: string[];
}

interface WebinarScriptSection {
  title: string;
  durationLabel?: string;
  durationMinutes?: number;
  startMinute?: number;
  endMinute?: number;
  blocks: WebinarScriptBlock[];
}

interface ParsedWebinarScript {
  title: string;
  sections: WebinarScriptSection[];
}

const durationOptions = [
  { value: '30 minutes', label: '30 minutes' },
  { value: '45 minutes', label: '45 minutes' },
  { value: '60 minutes', label: '60 minutes' },
  { value: '90 minutes', label: '90 minutes' },
];

const offerOptions = [
  { value: 'true', label: 'Yes - Include an offer' },
  { value: 'false', label: 'No - Focus on value only' },
];

const DEFAULT_WEBINAR_CTA = 'Register for our next webinar';
const WEBINAR_TITLE_MIN = 5;
const WEBINAR_TOPIC_MIN = 10;
const CTA_MIN = 5;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Something went wrong. Please try again.';
};

let inlineElementId = 0;
const renderInline = (text: string): ReactNode[] => {
  const getKey = () => `webinar-inline-${inlineElementId++}`;

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
        className="font-semibold text-vox-pink underline decoration-2 underline-offset-4 hover:text-vox-pink/90"
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

const parseDurationMinutes = (label?: string): number | undefined => {
  if (!label) {
    return undefined;
  }

  const digitMatch = label.match(/(\d+(?:\.\d+)?)/);
  if (!digitMatch) {
    return undefined;
  }

  const value = Number.parseFloat(digitMatch[1]);
  if (Number.isNaN(value)) {
    return undefined;
  }

  return value;
};

const formatMinuteMark = (minutes: number | undefined): string => {
  if (minutes === undefined || Number.isNaN(minutes)) {
    return '';
  }

  const totalMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:00`;
  }

  return `${totalMinutes}:00`;
};

const parseWebinarScriptContent = (content: unknown): ParsedWebinarScript => {
  if (typeof content !== 'string' || !content.trim()) {
    return { title: '', sections: [] };
  }

  const lines = content.split(/\r?\n/);
  let documentTitle = '';
  const sections: WebinarScriptSection[] = [];
  let currentSection: WebinarScriptSection | null = null;
  let paragraphBuffer: string[] = [];
  let currentList: string[] | null = null;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    const paragraph = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
    paragraphBuffer = [];

    if (!paragraph || !currentSection) {
      return;
    }

    currentSection.blocks.push({
      type: 'paragraph',
      content: paragraph,
    });
  };

  const flushList = () => {
    if (!currentList || currentList.length === 0 || !currentSection) {
      currentList = null;
      return;
    }

    currentSection.blocks.push({
      type: 'list',
      items: currentList,
    });

    currentList = null;
  };

  const flushText = () => {
    flushParagraph();
    flushList();
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushText();
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      flushText();
      documentTitle = trimmed.replace(/^#\s*/, '').trim();
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      flushText();
      const heading = trimmed.replace(/^##\s*/, '').trim();
      const durationMatch = heading.match(/\(([^)]+)\)\s*$/);
      const durationLabel = durationMatch?.[1] ? durationMatch[1].trim() : undefined;
      const sectionTitle = durationMatch ? heading.replace(/\([^)]*\)\s*$/, '').trim() : heading;

      currentSection = {
        title: sectionTitle,
        durationLabel,
        durationMinutes: parseDurationMinutes(durationLabel),
        blocks: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (/^\*\*(.+)\*\*$/.test(trimmed)) {
      flushText();
      if (currentSection) {
        currentSection.blocks.push({
          type: 'subheading',
          content: trimmed.replace(/^\*\*(.+)\*\*$/, '$1').trim(),
        });
      }
      continue;
    }

    if (/^\[(.+)\]$/.test(trimmed)) {
      flushText();
      if (currentSection) {
        currentSection.blocks.push({
          type: 'note',
          content: trimmed.replace(/^\[(.+)\]$/, '$1').trim(),
        });
      }
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      flushParagraph();
      const bullet = trimmed.replace(/^[-*•]\s+/, '').trim();
      if (!currentList) {
        currentList = [];
      }
      currentList.push(bullet);
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushText();

  let elapsedMinutes = 0;
  for (const section of sections) {
    const durationMinutes = section.durationMinutes ?? 0;
    section.startMinute = elapsedMinutes;
    section.endMinute = elapsedMinutes + durationMinutes;
    elapsedMinutes += durationMinutes;
  }

  return {
    title: documentTitle,
    sections,
  };
};

const isCompletedSession = (session: WorkspaceSession): boolean => {
  return session.status === 'completed' || session.currentPhase === 'completed';
};

const isCompletedBrief = (brief: WorkspaceBrief): boolean => {
  return ['completed', 'ready_for_export'].includes((brief.status || '').toLowerCase());
};

const WebinarScriptGenerator = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const [avaSessions, setAvaSessions] = useState<WorkspaceSession[]>([]);
  const [margoBriefs, setMargoBriefs] = useState<WorkspaceBrief[]>([]);
  const [runs, setRuns] = useState<WebinarScriptAmplifierRun[]>([]);
  const amplifierKey = 'webinarScript' as const;

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
  const [webinarTitle, setWebinarTitle] = useAmplifierField<string>(
    amplifierKey,
    'webinarTitle',
    '',
  );
  const [webinarTopic, setWebinarTopic] = useAmplifierField<string>(
    amplifierKey,
    'webinarTopic',
    '',
  );
  const [duration, setDuration] = useAmplifierField<string>(
    amplifierKey,
    'duration',
    durationOptions[1]?.value ?? '45 minutes',
  );
  const [offerAtEnd, setOfferAtEnd] = useAmplifierField<'true' | 'false'>(
    amplifierKey,
    'offerAtEnd',
    'true',
  );
  const [cta, setCta] = useAmplifierField<string>(amplifierKey, 'cta', DEFAULT_WEBINAR_CTA);

  const isWebinarTitleValid = useMemo(() => {
    return webinarTitle.trim().length >= WEBINAR_TITLE_MIN;
  }, [webinarTitle]);

  const isWebinarTopicValid = useMemo(() => {
    return webinarTopic.trim().length >= WEBINAR_TOPIC_MIN;
  }, [webinarTopic]);

  const isCtaValid = useMemo(() => {
    return cta.trim().length >= CTA_MIN;
  }, [cta]);

  useAmplifierScrollRestoration(amplifierKey);

  const workspaceId = currentWorkspace?.id;

  const hasPrerequisites = useMemo(() => {
    return avaSessions.length > 0 && margoBriefs.length > 0;
  }, [avaSessions.length, margoBriefs.length]);

  const selectedRun = useMemo(() => {
    if (!selectedRunId) {
      return runs[0];
    }
    return runs.find((run) => run.id === selectedRunId) ?? runs[0];
  }, [runs, selectedRunId]);

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
        listAmplifierRuns<string>(workspaceId, 'webinar_script'),
      ]);

      const completedSessions = [
        ...(sessionsResponse?.completed ?? []),
        ...(sessionsResponse?.active ?? []).filter(isCompletedSession),
      ];

      const completedBriefs = (briefsResponse ?? []).filter(isCompletedBrief);

      setAvaSessions(completedSessions);
      setMargoBriefs(completedBriefs);
      setRuns((runsResponse ?? []) as WebinarScriptAmplifierRun[]);

      setSelectedAvaSessionId((prev) => prev || completedSessions[0]?.id || '');
      setSelectedMargoBriefId((prev) => prev || completedBriefs[0]?.id || '');
      setSelectedRunId((prev) => prev || runsResponse?.[0]?.id || '');
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(error);
      setLoadError(message);
      toast({
        title: 'Unable to load webinar scripts',
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

      const trimmedTitle = webinarTitle.trim();
      const trimmedTopic = webinarTopic.trim();
      const trimmedCta = cta.trim();

      if (!isWebinarTitleValid) {
        toast({
          title: 'Webinar title required',
          description: `Provide a clear title of at least ${WEBINAR_TITLE_MIN} characters to anchor the webinar script.`,
          variant: 'destructive',
        });
        return;
      }

      if (!isWebinarTopicValid) {
        toast({
          title: 'Webinar topic required',
          description: `Describe the theme or promise of this webinar in at least ${WEBINAR_TOPIC_MIN} characters.`,
          variant: 'destructive',
        });
        return;
      }

      if (!isCtaValid) {
        toast({
          title: 'Call to action required',
          description: `Provide a compelling CTA of at least ${CTA_MIN} characters.`,
          variant: 'destructive',
        });
        return;
      }

      setIsSubmitting(true);

      try {
        const newRun = await createWebinarScriptAmplifier({
          workspaceId,
          avaSessionId: selectedAvaSessionId,
          margoProfileId: selectedMargoBriefId,
          webinarTitle: trimmedTitle,
          webinarTopic: trimmedTopic,
          duration,
          offerAtEnd: offerAtEnd === 'true',
          cta: trimmedCta,
        });

        setRuns((prev) => [newRun, ...prev]);
        setSelectedRunId(newRun.id);

        toast({
          title: 'Webinar script generated',
          description: 'Scroll down to review the complete webinar outline.',
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
      selectedAvaSessionId,
      selectedMargoBriefId,
      webinarTitle,
      webinarTopic,
      duration,
      offerAtEnd,
      cta,
    ],
  );

  const handleCopyScript = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedScript(true);
        setTimeout(() => {
          setCopiedScript(false);
        }, 2000);
        toast({
          title: 'Script copied',
          description: 'The webinar script is ready to paste.',
        });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Unable to copy',
          description: 'Copying to clipboard failed. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const renderSection = (section: WebinarScriptSection, index: number) => {
    const timeLabel =
      section.startMinute !== undefined && section.endMinute !== undefined
        ? `${formatMinuteMark(section.startMinute)}-${formatMinuteMark(section.endMinute)}`
        : section.durationLabel ?? '';

    return (
      <div
        key={`${section.title}-${index}`}
        className="rounded-2xl border border-pink/20 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-pink/10 border border-pink/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-vox-pink">
              {timeLabel || 'Section'}
            </span>
            <h3 className="mt-3 text-xl font-semibold text-foreground">{section.title}</h3>
          </div>
          {section.durationLabel && (
            <span className="text-sm font-medium text-muted-foreground">
              Duration: {section.durationLabel}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3 text-base leading-relaxed text-muted-foreground">
          {section.blocks.map((block, blockIndex) => {
            if (block.type === 'subheading' && block.content) {
              return (
                <p key={`subheading-${blockIndex}`} className="font-semibold text-foreground">
                  {renderInline(block.content)}
                </p>
              );
            }

            if (block.type === 'note' && block.content) {
              return (
                <p
                  key={`note-${blockIndex}`}
                  className="rounded-lg bg-pink/10 border border-pink/20 px-4 py-3 text-sm font-medium text-vox-pink"
                >
                  {renderInline(block.content)}
                </p>
              );
            }

            if (block.type === 'list' && block.items) {
              return (
                <ul key={`list-${blockIndex}`} className="list-disc space-y-2 pl-6 text-muted-foreground">
                  {block.items.map((item, itemIndex) => (
                    <li key={`item-${itemIndex}`}>{renderInline(item)}</li>
                  ))}
                </ul>
              );
            }

            if (block.type === 'paragraph' && block.content) {
              return (
                <p key={`paragraph-${blockIndex}`} className="text-muted-foreground">
                  {renderInline(block.content)}
                </p>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  };

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
            <Monitor className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Webinar Script Generator</h1>
            <p className="text-base text-muted-foreground">
              Create complete webinar presentations with timing, talking points, and slide prompts.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <Card className="rounded-3xl border border-pink/20 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Configure Webinar Script</CardTitle>
            <CardDescription>Generate a detailed webinar outline tailored to your offer.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="ava-session">Client Profile</Label>
                <Select
                  value={selectedAvaSessionId}
                  onValueChange={setSelectedAvaSessionId}
                  disabled={isLoading || !avaSessions.length}
                >
                  <SelectTrigger id="ava-session" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                    <SelectValue placeholder="Select client profile" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                    {avaSessions.map((session) => {
                      const sessionLabel = pickDisplayName(
                        [session.userName, session.sessionName, session.id],
                        'Client Profile',
                      );
                      const timestamp = session.completedAt ?? session.createdAt ?? null;
                      const relativeTime =
                        timestamp !== null
                          ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
                          : null;
                      return (
                        <SelectItem key={session.id} value={session.id}>
                          {sessionLabel}
                          {relativeTime ? ` • ${relativeTime}` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="margo-brief">Product Profile</Label>
                <Select
                  value={selectedMargoBriefId}
                  onValueChange={setSelectedMargoBriefId}
                  disabled={isLoading || !margoBriefs.length}
                >
                  <SelectTrigger id="margo-brief" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                    <SelectValue placeholder="Select product profile" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                    {margoBriefs.map((brief) => {
                      const briefLabel = pickDisplayName(
                        [brief.userName, brief.productName, brief.sessionName, brief.id],
                        'Product Profile',
                      );
                      const timestamp = brief.updatedAt ?? brief.completedAt ?? brief.createdAt ?? null;
                      const relativeTime =
                        timestamp !== null
                          ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
                          : null;
                      return (
                        <SelectItem key={brief.id} value={brief.id}>
                          {briefLabel}
                          {relativeTime ? ` • ${relativeTime}` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webinar-title">Webinar Title</Label>
                <Input
                  id="webinar-title"
                  value={webinarTitle}
                  onChange={(event) => setWebinarTitle(event.target.value)}
                  minLength={WEBINAR_TITLE_MIN}
                  placeholder="Enter your webinar title"
                  className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink"
                />
                {webinarTitle.trim().length < WEBINAR_TITLE_MIN && (
                  <p className="text-xs text-destructive">
                    {webinarTitle.trim().length} / {WEBINAR_TITLE_MIN} characters minimum required
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="webinar-topic">Webinar Topic</Label>
                <Textarea
                  id="webinar-topic"
                  value={webinarTopic}
                  onChange={(event) => setWebinarTopic(event.target.value)}
                  placeholder="What will you teach in this webinar?"
                  rows={4}
                  className="resize-none rounded-xl border border-pink/20 bg-white focus:border-vox-pink"
                  minLength={WEBINAR_TOPIC_MIN}
                />
                {webinarTopic.trim().length < WEBINAR_TOPIC_MIN && (
                  <p className="text-xs text-destructive">
                    {webinarTopic.trim().length} / {WEBINAR_TOPIC_MIN} characters minimum required
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="webinar-duration">Duration</Label>
                  <Select value={duration} onValueChange={setDuration} disabled={isLoading}>
                    <SelectTrigger id="webinar-duration" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                      {durationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webinar-offer">Offer at End?</Label>
                  <Select
                    value={offerAtEnd}
                    onValueChange={(value) => setOfferAtEnd(value === 'true' ? 'true' : 'false')}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="webinar-offer" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                      {offerOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webinar-cta">Primary Call to Action</Label>
                <Input
                  id="webinar-cta"
                  value={cta}
                  onChange={(event) => setCta(event.target.value)}
                  placeholder="Register for our next webinar"
                  className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink"
                  minLength={CTA_MIN}
                />
                {cta.trim().length < CTA_MIN && (
                  <p className="text-xs text-destructive">
                    {cta.trim().length} / {CTA_MIN} characters minimum required
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full rounded-full bg-vox-pink text-base font-semibold text-white shadow-sm transition hover:bg-vox-pink/90"
                disabled={
                  isSubmitting ||
                  !hasPrerequisites ||
                  !isWebinarTitleValid ||
                  !isWebinarTopicValid ||
                  !isCtaValid
                }
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Webinar Script...
                  </span>
                ) : (
                  'Generate Webinar Script'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-pink/20 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Recent Webinar Scripts</CardTitle>
            <CardDescription>Review your latest runs and revisit earlier scripts.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : runs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-pink/20 bg-white p-6 text-sm text-muted-foreground">
                Generate your first webinar script to see it listed here.
              </div>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => {
                  const isSelected = run.id === (selectedRun?.id ?? '');
                  const runDuration =
                    typeof run.inputs?.duration === 'string' ? run.inputs.duration : undefined;
                  return (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-vox-pink bg-pink/10'
                          : 'border-pink/20 bg-white hover:border-vox-pink hover:bg-pink/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {run.output?.title || run.title || 'Webinar Script'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Generated {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <span className="rounded-full bg-pink/10 border border-pink/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-vox-pink">
                          {runDuration || durationOptions[1]?.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-6">
        {loadError && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
            {loadError}
          </div>
        )}

        {!isLoading && hasPrerequisites === false && (
          <div className="rounded-2xl border border-dashed border-pink/20 bg-white p-6 text-sm text-muted-foreground">
            Complete an AVA profile and a MARGO product brief to generate your first webinar script.
          </div>
        )}

        {selectedRun && selectedRun.output?.content ? (
          (() => {
            const parsed = parseWebinarScriptContent(selectedRun.output?.content);
            const metadata = (selectedRun.output?.metadata ?? {}) as Record<string, unknown>;
            const contentType =
              typeof metadata.contentType === 'string' ? metadata.contentType : undefined;
            const generatedTimestamp =
              typeof metadata.generatedAt === 'string' ? metadata.generatedAt : undefined;
            const topTitle =
              parsed.title || selectedRun.output?.title || selectedRun.title || 'Webinar Script';

            return (
              <Card className="rounded-3xl border border-pink/20 bg-white shadow-md">
                <CardHeader className="border-b border-pink/20">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wide text-vox-pink">
                        Complete Webinar Script
                      </p>
                      <CardTitle className="mt-2 text-2xl font-semibold text-foreground">{topTitle}</CardTitle>
                      {contentType && (
                        <CardDescription>
                          {contentType === 'webinar_script'
                            ? 'Full presentation with timing and slide suggestions.'
                            : contentType}
                        </CardDescription>
                      )}
                      {generatedTimestamp && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Generated {formatDistanceToNow(new Date(generatedTimestamp), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        type="button"
                        onClick={() => handleCopyScript(selectedRun.output?.content || '')}
                        className="grow rounded-xl border border-pink/30 bg-white text-vox-pink shadow-sm hover:bg-pink/10"
                      >
                        {copiedScript ? 'Copied!' : 'Copy Script'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 bg-white py-8">
                  {parsed.sections.map((section, index) => renderSection(section, index))}
                </CardContent>
              </Card>
            );
          })()
        ) : runs.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-pink/20 bg-white p-6 text-sm text-muted-foreground">
            The latest run does not have any content to display.
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default WebinarScriptGenerator;

