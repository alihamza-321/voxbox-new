import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/components/ui/use-toast';

import {
  createSalesPageAmplifier,
  listAmplifierRuns,
  type SalesPageAmplifierRun,
} from '@/lib/amplifiers';
import { listWorkspaceSessions, type WorkspaceSession } from '@/lib/ava-api';
import { listWorkspaceBriefs, type WorkspaceBrief } from '@/lib/margo-api';
import { pickDisplayName } from '@/lib/display';
import { useAmplifierField, useAmplifierScrollRestoration } from '@/hooks/useAmplifierPersistence';

type SalesPageBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

interface SalesPageSection {
  title: string;
  level: number;
  blocks: SalesPageBlock[];
}

interface ParsedSalesPageContent {
  title: string;
  subtitle?: string;
  heroBlocks: SalesPageBlock[];
  sections: SalesPageSection[];
}

const parseSalesPageMarkdown = (content: string): ParsedSalesPageContent | null => {
  if (!content || typeof content !== 'string') {
    return null;
  }

  interface RawBlock {
    type: 'heading' | 'paragraph' | 'list' | 'separator';
    level?: number;
    text?: string;
    items?: string[];
  }

  const rawBlocks: RawBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] | null = null;

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      rawBlocks.push({
        type: 'paragraph',
        text: paragraphBuffer.join(' '),
      });
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer && listBuffer.length > 0) {
      rawBlocks.push({
        type: 'list',
        items: listBuffer,
      });
      listBuffer = null;
    }
  };

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      const levelMatch = trimmed.match(/^#{1,6}/);
      const level = levelMatch ? levelMatch[0].length : 1;
      const text = trimmed.replace(/^#{1,6}\s*/, '').trim();
      rawBlocks.push({
        type: 'heading',
        level,
        text,
      });
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed) || /^[•✗]\s*/.test(trimmed)) {
      flushParagraph();
      if (!listBuffer) {
        listBuffer = [];
      }
      const normalized = trimmed
        .replace(/^[-*•]\s+/, '')
        .replace(/^[•✗]\s*/, '')
        .trim();
      listBuffer.push(normalized);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      rawBlocks.push({ type: 'separator' });
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      const text = trimmed.replace(/^>\s*/, '').trim();
      rawBlocks.push({ type: 'paragraph', text });
      continue;
    }

    flushList();
    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  flushList();

  let title = '';
  let subtitle: string | undefined;
  const heroBlocks: SalesPageBlock[] = [];
  const sections: SalesPageSection[] = [];
  let currentSection: SalesPageSection | null = null;
  let inHero = true;

  const pushBlock = (block: SalesPageBlock) => {
    if (inHero) {
      heroBlocks.push(block);
    } else if (currentSection) {
      currentSection.blocks.push(block);
    } else if (sections.length > 0) {
      sections[sections.length - 1]?.blocks.push(block);
    } else {
      heroBlocks.push(block);
    }
  };

  for (const block of rawBlocks) {
    if (block.type === 'heading') {
      if (block.level === 1 && !title) {
        title = block.text ?? '';
        continue;
      }

      if (block.level === 2 && inHero && !subtitle) {
        subtitle = block.text;
        continue;
      }

      inHero = false;
      const sectionTitle = block.text ?? '';
      currentSection = {
        title: sectionTitle,
        level: block.level ?? 2,
        blocks: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (block.type === 'separator') {
      inHero = false;
      currentSection = null;
      continue;
    }

    if (block.type === 'paragraph' && block.text) {
      pushBlock({ type: 'paragraph', text: block.text });
      continue;
    }

    if (block.type === 'list' && block.items) {
      pushBlock({ type: 'list', items: block.items });
      continue;
    }
  }

  if (!title && heroBlocks.length === 0 && sections.length === 0) {
    return null;
  }

  return {
    title,
    subtitle,
    heroBlocks,
    sections,
  };
};

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Something went wrong. Please try again.';
};

const pageLengthOptions: { value: 'short' | 'medium' | 'long'; label: string }[] = [
  { value: 'short', label: 'Short (≈300 words)' },
  { value: 'medium', label: 'Medium (≈600 words)' },
  { value: 'long', label: 'Long (≈1,000 words)' },
];

const SalesPageGenerator = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [avaSessions, setAvaSessions] = useState<WorkspaceSession[]>([]);
  const [margoBriefs, setMargoBriefs] = useState<WorkspaceBrief[]>([]);
  const [runs, setRuns] = useState<SalesPageAmplifierRun[]>([]);

  const amplifierKey = 'salesPage' as const;

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
  const [pageLength, setPageLength] = useAmplifierField<'short' | 'medium' | 'long'>(
    amplifierKey,
    'pageLength',
    'medium',
  );
  const [cta, setCta] = useAmplifierField<string>(amplifierKey, 'cta', 'Buy now for $99');

  useAmplifierScrollRestoration(amplifierKey);

  const workspaceId = currentWorkspace?.id;

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
        listAmplifierRuns<string>(workspaceId, 'sales_page'),
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
      const message = formatErrorMessage(error);
      setLoadError(message);
      toast({
        title: 'Unable to load sales page data',
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

  const hasPrerequisites = useMemo(() => {
    return avaSessions.length > 0 && margoBriefs.length > 0;
  }, [avaSessions.length, margoBriefs.length]);

  const isCtaValid = useMemo(() => {
    return cta.trim().length >= 5;
  }, [cta]);

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

      setIsSubmitting(true);

      try {
        const newRun = await createSalesPageAmplifier({
          workspaceId,
          avaSessionId: selectedAvaSessionId,
          margoProfileId: selectedMargoBriefId,
          pageLength,
          cta: cta.trim(),
        });

        setRuns((prev) => [newRun, ...prev]);

        toast({
          title: 'Sales page generated',
          description: 'Scroll down to review the generated sales page.',
        });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Generation failed',
          description: formatErrorMessage(error),
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [workspaceId, toast, selectedAvaSessionId, selectedMargoBriefId, pageLength, cta],
  );

  let inlineElementId = 0;
  const renderInline = (text: string): ReactNode[] => {
    const getKey = () => `inline-${inlineElementId++}`;

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

      const rawLinkText = match[1] ?? '';
      const linkHref = (match[2] ?? '').trim();
      const boldFreeText = rawLinkText.replace(/\*\*/g, '').trim().toLowerCase();
      const isPrimaryCta = /buy|save|start|join|enroll|get|book/.test(boldFreeText);

      const linkChildren = renderBold(rawLinkText);
      nodes.push(
        <a
          key={getKey()}
          href={linkHref || undefined}
          target={linkHref ? '_blank' : undefined}
          rel={linkHref ? 'noopener noreferrer' : undefined}
          className={
            isPrimaryCta
              ? 'inline-flex items-center justify-center rounded-xl bg-[#ff1f6c] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#e51860]'
              : 'font-semibold text-[#ff1f6c] underline decoration-2 underline-offset-4 hover:text-[#e51860]'
          }
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

  const renderBlock = (block: SalesPageBlock, index: number) => {
    if (block.type === 'paragraph') {
      return (
        <p key={`paragraph-${index}`} className="text-sm leading-relaxed text-muted-foreground">
          {renderInline(block.text)}
        </p>
      );
    }

    if (block.type === 'list') {
      return (
        <ul key={`list-${index}`} className="space-y-2">
          {block.items.map((item, itemIndex) => (
            <li key={`list-${index}-item-${itemIndex}`} className="relative pl-5 text-sm text-muted-foreground">
              <span className="absolute left-0 top-[0.65rem] h-2 w-2 -translate-y-1/2 rounded-full bg-[#ff1f6c]" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    }

    return null;
  };

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
            className="border-[#ff1f6c]/20 bg-white text-foreground hover:bg-[#ffe8f1] hover:text-[#ff1f6c] hover:border-[#ff1f6c]/40 transition-all duration-300 ease-in-out hover:shadow-md hover:shadow-[#ff1f6c]/10 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Sales Page Generator</h1>
            <p className="text-sm text-muted-foreground">
              Generate high-converting sales pages using your AVA and product profiles.
            </p>
          </div>
        </div>
      </header>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Configure Sales Page</CardTitle>
          <CardDescription>Create compelling sales copy</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Client Profile</Label>
                <Select
                  value={selectedAvaSessionId}
                  onValueChange={setSelectedAvaSessionId}
                  disabled={avaSessions.length === 0}
                >
                  <SelectTrigger className="h-12 rounded-xl border-border/80 bg-white">
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
                <Label>Product Profile</Label>
                <Select
                  value={selectedMargoBriefId}
                  onValueChange={setSelectedMargoBriefId}
                  disabled={margoBriefs.length === 0}
                >
                  <SelectTrigger className="h-12 rounded-xl border-border/80 bg-white">
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

              <div className="space-y-2">
                <Label>Page Length</Label>
                <Select value={pageLength} onValueChange={(value) => setPageLength(value as typeof pageLength)}>
                  <SelectTrigger className="h-12 rounded-xl border-border/80 bg-white">
                    <SelectValue placeholder="Select length" />
                  </SelectTrigger>
                  <SelectContent>
                    {pageLengthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Primary Call-To-Action</Label>
              <Input
                value={cta}
                onChange={(event) => setCta(event.target.value)}
                placeholder="Buy now for $99"
                disabled={isSubmitting || !hasPrerequisites}
                className="h-12 rounded-xl border-border/80 bg-white"
                minLength={5}
              />
              {cta.trim().length < 5 && (
                <p className="text-xs text-destructive">
                  {cta.trim().length} / 5 characters minimum required
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={!hasPrerequisites || !isCtaValid || isSubmitting}
              className="h-12 rounded-xl bg-[#ff1f6c] text-base font-semibold text-white transition hover:bg-[#e51860]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Sales Page…
                </span>
              ) : (
                'Generate Sales Page'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Generated Sales Copy</CardTitle>
          <CardDescription>Complete sales page structure and content</CardDescription>
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
              Your generated sales page will appear here once ready.
            </div>
          ) : (
            runs.map((run) => {
              const parsed = parseSalesPageMarkdown(run.output?.content ?? '');
              const sectionsFromMetadata =
                (Array.isArray(run.output?.metadata?.sections)
                  ? (run.output?.metadata?.sections as string[])
                  : []) ?? [];

              return (
                <Card key={run.id} className="rounded-xl border border-border/70 bg-white shadow-sm">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg font-semibold">
                          {run.title || run.output?.title || 'Sales Page'}
                        </CardTitle>
                        <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
                          Generated {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                        </CardDescription>
                      </div>
                      {sectionsFromMetadata.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {sectionsFromMetadata.map((chip) => (
                            <span
                              key={`${run.id}-chip-${chip}`}
                              className="rounded-full bg-[#fff3f9] px-3 py-1 text-xs font-medium text-[#ff1f6c]"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {parsed ? (
                      <div className="space-y-6">
                        <section className="space-y-4 rounded-3xl border border-[#ffe4f1] bg-[#fff8fb] px-6 py-7">
                          {parsed.title && (
                            <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
                              {renderInline(parsed.title)}
                            </h2>
                          )}
                          {parsed.subtitle && (
                            <p className="text-base font-medium text-[#ff1f6c]">
                              {renderInline(parsed.subtitle)}
                            </p>
                          )}
                          <div className="space-y-3">
                            {parsed.heroBlocks.map((block, blockIndex) => renderBlock(block, blockIndex))}
                          </div>
                        </section>

                        {parsed.sections.map((section, sectionIndex) => (
                          <section
                            key={`${run.id}-section-${sectionIndex}`}
                            className="space-y-4 rounded-3xl border border-border/60 bg-[#fcfdfd] px-6 py-6 shadow-sm"
                          >
                            <h3 className="text-lg font-semibold uppercase tracking-wide text-foreground">
                              {renderInline(section.title)}
                            </h3>
                            <div className="space-y-3">
                              {section.blocks.map((block, blockIndex) =>
                                renderBlock(block, sectionIndex * 100 + blockIndex),
                              )}
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : typeof run.output?.content === 'string' ? (
                      <div className="whitespace-pre-line rounded-xl bg-muted px-4 py-4 text-sm leading-relaxed text-muted-foreground">
                        {run.output.content}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                        The amplifier returned an unexpected format. Please regenerate the sales page.
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

export default SalesPageGenerator;


