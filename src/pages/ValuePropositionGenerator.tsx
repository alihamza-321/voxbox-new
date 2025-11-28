import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Layers3, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/components/ui/use-toast';

import {
  createValuePropositionAmplifier,
  listAmplifierRuns,
  type ValuePropositionAmplifierRun,
  type ValuePropositionContent,
} from '@/lib/amplifiers';
import { listWorkspaceSessions, type WorkspaceSession } from '@/lib/ava-api';
import { listWorkspaceBriefs, type WorkspaceBrief } from '@/lib/margo-api';
import { pickDisplayName } from '@/lib/display';
import { useAmplifierField, useAmplifierScrollRestoration } from '@/hooks/useAmplifierPersistence';

const DEFAULT_CTA = 'Learn more';

const formatOptions: { value: string; label: string }[] = [{ value: 'all_formats', label: 'All formats' }];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return 'Something went wrong. Please try again.';
};

const isValuePropositionContent = (value: unknown): value is ValuePropositionContent => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const extractBeforeItems = (problemStatement?: string): string[] => {
  if (!problemStatement || typeof problemStatement !== 'string') {
    return [];
  }

  const segments = problemStatement
    .split(/[\n.]+/)
    .map((segment) => segment.replace(/^[\s-]+/, '').trim())
    .filter(Boolean);

  return segments.slice(0, 4);
};

const extractAfterItems = (content: ValuePropositionContent): string[] => {
  const items: string[] = [];

  if (Array.isArray(content.benefits)) {
    items.push(...content.benefits.filter((benefit) => typeof benefit === 'string' && benefit.trim()));
  }

  if (content.uniqueAdvantage && typeof content.uniqueAdvantage === 'string') {
    items.push(content.uniqueAdvantage);
  }

  if (content.guarantee && typeof content.guarantee === 'string') {
    items.push(content.guarantee);
  }

  if (content.callToAction && typeof content.callToAction === 'string') {
    items.push(content.callToAction);
  }

  return items.slice(0, 4);
};

const ValuePropositionGenerator = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedHeadline, setCopiedHeadline] = useState<string | null>(null);

  const [avaSessions, setAvaSessions] = useState<WorkspaceSession[]>([]);
  const [margoBriefs, setMargoBriefs] = useState<WorkspaceBrief[]>([]);
  const [runs, setRuns] = useState<ValuePropositionAmplifierRun[]>([]);

  const amplifierKey = 'valueProposition' as const;

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
  const [selectedFormat, setSelectedFormat] = useAmplifierField<string>(
    amplifierKey,
    'selectedFormat',
    formatOptions[0]?.value ?? 'all_formats',
  );
  const [cta, setCta] = useAmplifierField<string>(amplifierKey, 'cta', DEFAULT_CTA);

  useAmplifierScrollRestoration(amplifierKey);

  const workspaceId = currentWorkspace?.id;

  const hasPrerequisites = useMemo(() => {
    return avaSessions.length > 0 && margoBriefs.length > 0;
  }, [avaSessions.length, margoBriefs.length]);

  const isCtaValid = useMemo(() => {
    return cta.trim().length >= 3;
  }, [cta]);

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
        listAmplifierRuns<ValuePropositionContent>(workspaceId, 'value_proposition'),
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
      setSelectedRunId((prev) => prev || runsResponse?.[0]?.id || '');
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(error);
      setLoadError(message);
      toast({
        title: 'Unable to load value proposition data',
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
          title: 'Select a product brief',
          description: 'Complete a product brief and select it to power the amplifier.',
          variant: 'destructive',
        });
        return;
      }

      const trimmedCta = cta.trim();
      if (!trimmedCta || trimmedCta.length < 3) {
        toast({
          title: 'Call to action required',
          description: 'Please enter a call to action with at least 3 characters.',
          variant: 'destructive',
        });
        return;
      }

      setIsSubmitting(true);

      try {
        const run = await createValuePropositionAmplifier({
          workspaceId,
          avaSessionId: selectedAvaSessionId,
          margoProfileId: selectedMargoBriefId,
          format: selectedFormat,
          cta: trimmedCta,
        });

        setRuns((prev) => [run, ...prev]);
        setSelectedRunId(run.id);

        toast({
          title: 'Value proposition generated',
          description: 'Scroll down to review the generated messaging.',
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
    [workspaceId, toast, selectedAvaSessionId, selectedMargoBriefId, selectedFormat, cta],
  );

  const selectedRun = useMemo(() => {
    if (!selectedRunId) {
      return runs[0] ?? null;
    }

    return runs.find((run) => run.id === selectedRunId) ?? null;
  }, [runs, selectedRunId]);

  const selectedContent = useMemo<ValuePropositionContent | null>(() => {
    if (!selectedRun?.output) {
      return null;
    }

    const rawContent = selectedRun.output.content;

    if (isValuePropositionContent(rawContent)) {
      return rawContent;
    }

    if (typeof rawContent === 'string') {
      return { solution: rawContent };
    }

    return null;
  }, [selectedRun]);

  const headlineVariants = useMemo(() => {
    if (!selectedRun?.output) {
      return [];
    }

    const variants: string[] = [];

    if (selectedRun.output.title && typeof selectedRun.output.title === 'string') {
      variants.push(selectedRun.output.title);
    }

    if (selectedContent?.headline && typeof selectedContent.headline === 'string') {
      variants.push(selectedContent.headline);
    }

    if (selectedContent?.subheadline && typeof selectedContent.subheadline === 'string') {
      variants.push(selectedContent.subheadline);
    }

    return variants;
  }, [selectedRun, selectedContent]);

  const beforeItems = useMemo(() => extractBeforeItems(selectedContent?.problemStatement), [selectedContent]);
  const afterItems = useMemo(() => (selectedContent ? extractAfterItems(selectedContent) : []), [selectedContent]);

  const handleCopySection = useCallback(
    async (text: string, headlineKey?: string) => {
      try {
        await navigator.clipboard.writeText(text);
        if (headlineKey) {
          setCopiedHeadline(headlineKey);
          setTimeout(() => {
            setCopiedHeadline(null);
          }, 2000);
        }
        toast({
          title: 'Copied',
          description: 'Content copied to clipboard.',
        });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Unable to copy',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

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
            <Layers3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Value Proposition Generator</h1>
            <p className="text-base text-muted-foreground">
              Craft compelling value statements tailored to your ideal clients.
            </p>
          </div>
        </div>
      </header>

      <section>
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-foreground">Generate Value Proposition</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Create clear, compelling value statements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ava-profile">Client Profile</Label>
                  <Select value={selectedAvaSessionId} onValueChange={setSelectedAvaSessionId}>
                    <SelectTrigger id="ava-profile" className="h-12 rounded-xl border-border/80 bg-white">
                      <SelectValue placeholder="Select client profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {avaSessions.map((session) => {
                        const completedOrCreatedAt = session.completedAt ?? session.createdAt;
                        const completedDate = completedOrCreatedAt ? new Date(completedOrCreatedAt) : null;
                        const relativeTime =
                          completedDate && !Number.isNaN(completedDate.getTime())
                            ? formatDistanceToNow(completedDate, { addSuffix: true })
                            : null;
                        const sessionLabel = pickDisplayName(
                          [session.userName, session.sessionName, session.id],
                          'Client Profile',
                        );
                        const fullLabel = relativeTime ? `${sessionLabel} • ${relativeTime}` : sessionLabel;

                        return (
                          <SelectItem key={session.id} value={session.id}>
                            {fullLabel}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-brief">Product Profile</Label>
                  <Select value={selectedMargoBriefId} onValueChange={setSelectedMargoBriefId}>
                    <SelectTrigger id="product-brief" className="h-12 rounded-xl border-border/80 bg-white">
                      <SelectValue placeholder="Select product profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {margoBriefs.map((brief) => {
                        const updatedOrCreatedAt = brief.updatedAt ?? brief.createdAt;
                        const updatedDate = updatedOrCreatedAt ? new Date(updatedOrCreatedAt) : null;
                        const relativeTime =
                          updatedDate && !Number.isNaN(updatedDate.getTime())
                            ? formatDistanceToNow(updatedDate, { addSuffix: true })
                            : null;
                        const briefLabel = pickDisplayName(
                          [brief.userName, brief.productName, brief.sessionName, brief.id],
                          'Product Profile',
                        );
                        const fallbackLabel = briefLabel || 'Product Profile';
                        const fullLabel = relativeTime ? `${fallbackLabel} • ${relativeTime}` : fallbackLabel;

                        return (
                          <SelectItem key={brief.id} value={brief.id}>
                            {fullLabel}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="format">Format</Label>
                  <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                    <SelectTrigger id="format" className="h-12 rounded-xl border-border/80 bg-white">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {formatOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
                    onChange={(event) => setCta(event.target.value)}
                    placeholder="Enter CTA"
                    disabled={isSubmitting || !hasPrerequisites}
                    className="h-12 rounded-xl border-border/80 bg-white"
                  />
                  {cta.trim().length > 0 && cta.trim().length < 3 && (
                    <p className="text-xs text-destructive">
                      {cta.trim().length} / 3 characters minimum required
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  {hasPrerequisites
                    ? 'Select your profiles and generate a tailored value proposition.'
                    : 'Complete an AVA profile and a product brief to use this amplifier.'}
                </p>
                <Button
                  type="submit"
                  disabled={!hasPrerequisites || !isCtaValid || isSubmitting}
                  className="h-12 rounded-xl bg-[vox-pink] px-8 text-base font-semibold text-white hover:bg-[vox-pink/90]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Value Proposition'
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
            <h2 className="text-2xl font-semibold text-foreground">Generated Value Propositions</h2>
            <p className="text-sm text-muted-foreground">
              Multiple formats ready to plug into landing pages, ads, and outreach.
            </p>
          </div>
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>

        {loadError && (
          <Card className="border border-destructive/20 bg-destructive/5">
            <CardContent className="py-6 text-destructive">
              <p>{loadError}</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && runs.length === 0 && (
          <Card className="border border-dashed border-border/60 bg-muted/30">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Sparkles className="h-10 w-10 text-[vox-pink]" />
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">No value propositions yet</h3>
                <p className="text-sm text-muted-foreground">
                  Generate your first value proposition to see ready-to-use messaging formats here.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {runs.length > 0 && selectedRun && (
          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6">
              {headlineVariants.length > 0 && (
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-xl font-semibold text-foreground">Headline Format</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      High-impact headlines for landing pages, ads, and hero sections.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {headlineVariants.map((headline) => (
                      <button
                        key={headline}
                        type="button"
                        onClick={() => handleCopySection(headline, headline)}
                        className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-white px-4 py-3 text-left text-base font-semibold text-foreground transition hover:-translate-y-[1px] hover:border-[vox-pink] hover:shadow-md"
                      >
                        <span className="pr-3">{headline}</span>
                        <span className="text-xs font-medium uppercase text-[vox-pink]">
                          {copiedHeadline === headline ? 'Copied!' : 'Copy'}
                        </span>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {selectedContent?.solution && (
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-xl font-semibold text-foreground">Paragraph Format</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      Use this narrative in emails, sales pages, or social captions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedContent.problemStatement && (
                      <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                        {selectedContent.problemStatement}
                      </p>
                    )}
                    <p className="rounded-xl bg-white p-4 text-base leading-relaxed text-foreground shadow-sm">
                      {selectedContent.solution}
                    </p>
                    {selectedContent.guarantee && (
                      <p className="rounded-xl bg-white p-4 text-sm font-medium text-foreground shadow-sm">
                        {selectedContent.guarantee}
                      </p>
                    )}
                    {selectedContent.callToAction && (
                      <Button
                        type="button"
                        onClick={() => handleCopySection(selectedContent.callToAction ?? '')}
                        className="w-full rounded-xl bg-[vox-pink] text-base font-semibold text-white hover:bg-[vox-pink/90]"
                      >
                        {selectedContent.callToAction}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedContent?.benefits && selectedContent.benefits.length > 0 && (
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-xl font-semibold text-foreground">Bullet Point Format</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      Spotlight the core benefits in decks, webinars, or pitch scripts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedContent.socialProof && (
                      <div className="rounded-xl bg-white p-4 text-sm font-medium text-foreground shadow-sm">
                        {selectedContent.socialProof}
                      </div>
                    )}
                    <ul className="space-y-3">
                      {selectedContent.benefits.map((benefit, index) => (
                        <li
                          key={`${benefit}-${index}`}
                          className="flex items-start gap-3 rounded-xl bg-white p-4 text-sm text-foreground shadow-sm"
                        >
                          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[vox-pink]" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {(beforeItems.length > 0 || afterItems.length > 0) && (
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-xl font-semibold text-foreground">Before / After Format</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      Paint a vivid transformation for case studies or webinar intros.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
                      <p className="text-sm font-semibold uppercase text-muted-foreground">Before</p>
                      <ul className="space-y-2">
                        {beforeItems.map((item, index) => (
                          <li key={`${item}-${index}`} className="text-sm text-foreground">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-3 rounded-xl bg-[vox-pink/10] p-4 shadow-sm">
                      <p className="text-sm font-semibold uppercase text-[vox-pink]">After</p>
                      <ul className="space-y-2">
                        {afterItems.map((item, index) => (
                          <li key={`${item}-${index}`} className="text-sm text-foreground">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <aside className="space-y-4">
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-foreground">Recent Generations</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Tap a run to review its value proposition formats.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {runs.map((run) => {
                    const isActive = run.id === selectedRun?.id;
                    const timestamp = run.createdAt
                      ? formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })
                      : 'Unknown time';

                    return (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => setSelectedRunId(run.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          isActive
                            ? 'border-[vox-pink] bg-[vox-pink/10] text-foreground'
                            : 'border-border/60 bg-white text-foreground hover:-translate-y-[1px] hover:border-[vox-pink] hover:shadow-md'
                        }`}
                      >
                        <p className="text-sm font-semibold">{run.output?.title || 'Value Proposition'}</p>
                        <p className="text-xs text-muted-foreground">{timestamp}</p>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border border-dashed border-border/60 bg-muted/20 shadow-none">
                <CardContent className="space-y-3 py-6 text-sm text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">Tip:</span> Highlight the top headline and bullet
                    points in your hero section, then weave the paragraph format through your narrative.
                  </p>
                  <p>
                    Save different generations to test messaging angles, or copy individual sections to your team
                    workspace.
                  </p>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
};

export default ValuePropositionGenerator;

