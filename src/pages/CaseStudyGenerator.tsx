import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, FileText, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/components/ui/use-toast';

import {
  createCaseStudyAmplifier,
  listAmplifierRuns,
  type CaseStudyAmplifierRun,
} from '@/lib/amplifiers';
import { listWorkspaceSessions, type WorkspaceSession } from '@/lib/ava-api';
import { listWorkspaceBriefs, type WorkspaceBrief } from '@/lib/margo-api';
import { pickDisplayName } from '@/lib/display';
import { useAmplifierField, useAmplifierScrollRestoration } from '@/hooks/useAmplifierPersistence';

const DEFAULT_CTA = 'See how we can help you';
const MIN_NAME_LENGTH = 2;
const MIN_DETAIL_LENGTH = 10;
const MIN_CTA_LENGTH = 4;

const formatOptions: { value: string; label: string }[] = [
  { value: 'full_case_study', label: 'Full case study' },
  { value: 'executive_summary', label: 'Executive summary' },
  { value: 'social_proof_card', label: 'Social proof spotlight' },
];

interface CaseStudyBullet {
  text: string;
  emphasis?: string;
}

interface CaseStudySection {
  heading: string;
  paragraphs: string[];
  bullets: CaseStudyBullet[];
}

interface ParsedCaseStudyContent {
  sections: CaseStudySection[];
  callout?: CaseStudySection;
}

const stripMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const parseCaseStudyContent = (content: unknown): ParsedCaseStudyContent => {
  if (!content || typeof content !== 'string') {
    return { sections: [] };
  }

  const sectionMatches = [...content.matchAll(/\*\*(.+?)\*\*/g)];

  if (sectionMatches.length === 0) {
    const paragraphs = content
      .split(/\n{2,}/)
      .map((paragraph) => stripMarkdown(paragraph))
      .filter(Boolean);
    return {
      sections: paragraphs.length
        ? [
            {
              heading: 'Case Study',
              paragraphs,
              bullets: [],
            },
          ]
        : [],
    };
  }

  const sections: CaseStudySection[] = [];

  sectionMatches.forEach((match, index) => {
    const heading = stripMarkdown(match[1]).replace(/:+$/, '').trim();
    const startIndex = (match.index ?? 0) + match[0].length;
    const endIndex =
      index + 1 < sectionMatches.length ? (sectionMatches[index + 1].index ?? content.length) : content.length;

    const rawBody = content.slice(startIndex, endIndex).trim();

    if (!rawBody) {
      sections.push({
        heading,
        paragraphs: [],
        bullets: [],
      });
      return;
    }

    const lines = rawBody.split('\n');
    const paragraphs: string[] = [];
    const bullets: CaseStudyBullet[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length) {
        const combined = stripMarkdown(currentParagraph.join(' ').trim());
        if (combined) {
          paragraphs.push(combined);
        }
        currentParagraph = [];
      }
    };

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        flushParagraph();
        return;
      }

      if (trimmed.startsWith('- ')) {
        flushParagraph();
        const withoutDash = trimmed.slice(2).trim();
        const emphasisMatch = withoutDash.match(/^\*\*(.+?)\*\*\s*(.*)$/);
        const emphasis = emphasisMatch ? stripMarkdown(emphasisMatch[1]) : undefined;
        bullets.push({
          text: stripMarkdown(withoutDash),
          emphasis,
        });
      } else {
        currentParagraph.push(trimmed);
      }
    });

    flushParagraph();

    sections.push({
      heading,
      paragraphs,
      bullets,
    });
  });

  let callout: CaseStudySection | undefined;
  if (sections.length > 0) {
    const lastSection = sections[sections.length - 1];
    if (/(ready|next steps|call to action|cta)/i.test(lastSection.heading)) {
      callout = lastSection;
      sections.pop();
    }
  }

  return { sections, callout };
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

const formatRelativeTime = (timestamp?: string | null): string | null => {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatDistanceToNow(date, { addSuffix: true });
};

const CaseStudyGenerator = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [avaSessions, setAvaSessions] = useState<WorkspaceSession[]>([]);
  const [margoBriefs, setMargoBriefs] = useState<WorkspaceBrief[]>([]);
  const [runs, setRuns] = useState<CaseStudyAmplifierRun[]>([]);

  const amplifierKey = 'caseStudy' as const;

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
  const [clientName, setClientName] = useAmplifierField<string>(amplifierKey, 'clientName', '');
  const [challenge, setChallenge] = useAmplifierField<string>(amplifierKey, 'challenge', '');
  const [solution, setSolution] = useAmplifierField<string>(amplifierKey, 'solution', '');
  const [results, setResults] = useAmplifierField<string>(amplifierKey, 'results', '');
  const [cta, setCta] = useAmplifierField<string>(amplifierKey, 'cta', DEFAULT_CTA);
  const [selectedFormat, setSelectedFormat] = useAmplifierField<string>(
    amplifierKey,
    'selectedFormat',
    formatOptions[0]?.value ?? 'full_case_study',
  );

  useAmplifierScrollRestoration(amplifierKey);

  const workspaceId = currentWorkspace?.id;

  const hasPrerequisites = useMemo(() => {
    return avaSessions.length > 0 && margoBriefs.length > 0;
  }, [avaSessions.length, margoBriefs.length]);

  const trimmedClientName = clientName.trim();
  const trimmedChallenge = challenge.trim();
  const trimmedSolution = solution.trim();
  const trimmedResults = results.trim();
  const trimmedCta = cta.trim();

  const isClientNameValid = trimmedClientName.length >= MIN_NAME_LENGTH;
  const isChallengeValid = trimmedChallenge.length >= MIN_DETAIL_LENGTH;
  const isSolutionValid = trimmedSolution.length >= MIN_DETAIL_LENGTH;
  const isResultsValid = trimmedResults.length >= MIN_DETAIL_LENGTH;
  const isCtaValid = trimmedCta.length >= MIN_CTA_LENGTH;

  const isFormValid =
    hasPrerequisites && isClientNameValid && isChallengeValid && isSolutionValid && isResultsValid && isCtaValid;

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
        listAmplifierRuns<string>(workspaceId, 'case_study'),
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
        title: 'Unable to load case study data',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    void loadAmplifierData();
  }, [loadAmplifierData]);

  const generateCaseStudy = useCallback(async () => {
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

    const trimmedClientName = clientName.trim();
    const trimmedChallenge = challenge.trim();
    const trimmedSolution = solution.trim();
    const trimmedResults = results.trim();
    const trimmedCta = cta.trim();

    if (trimmedClientName.length < MIN_NAME_LENGTH) {
      toast({
        title: 'Client name required',
        description: `Enter at least ${MIN_NAME_LENGTH} characters for the client name.`,
        variant: 'destructive',
      });
      return;
    }

    if (
      trimmedChallenge.length < MIN_DETAIL_LENGTH ||
      trimmedSolution.length < MIN_DETAIL_LENGTH ||
      trimmedResults.length < MIN_DETAIL_LENGTH
    ) {
      toast({
        title: 'Add more detail',
        description: `Challenge, solution, and results must be at least ${MIN_DETAIL_LENGTH} characters each.`,
        variant: 'destructive',
      });
      return;
    }

    if (trimmedCta.length < MIN_CTA_LENGTH) {
      toast({
        title: 'Call to action required',
        description: `Provide a call to action of at least ${MIN_CTA_LENGTH} characters.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const run = await createCaseStudyAmplifier({
        workspaceId,
        avaSessionId: selectedAvaSessionId,
        margoProfileId: selectedMargoBriefId,
        clientName: trimmedClientName,
        challenge: trimmedChallenge,
        solution: trimmedSolution,
        results: trimmedResults,
        format: selectedFormat,
        cta: trimmedCta || DEFAULT_CTA,
      });

      setRuns((prev) => [run, ...prev]);
      setSelectedRunId(run.id);

      toast({
        title: 'Case study generated',
        description: 'Scroll down to review the generated story.',
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
  }, [
    workspaceId,
    selectedAvaSessionId,
    selectedMargoBriefId,
    clientName,
    challenge,
    solution,
    results,
    selectedFormat,
    cta,
    toast,
  ]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void generateCaseStudy();
    },
    [generateCaseStudy],
  );

  const selectedRun = useMemo(() => {
    if (!selectedRunId) {
      return runs[0] ?? null;
    }

    return runs.find((run) => run.id === selectedRunId) ?? null;
  }, [runs, selectedRunId]);

  const parsedContent = useMemo(() => {
    return parseCaseStudyContent(selectedRun?.output?.content);
  }, [selectedRun]);

  const metadataSections = useMemo(() => {
    if (!selectedRun?.output?.metadata || typeof selectedRun.output.metadata !== 'object') {
      return [];
    }
    const { sections } = selectedRun.output.metadata as { sections?: string[] };
    return Array.isArray(sections) ? sections.filter((section) => typeof section === 'string') : [];
  }, [selectedRun]);

  const inputsMap = useMemo(() => {
    return (selectedRun?.inputs ?? {}) as Record<string, unknown>;
  }, [selectedRun]);

  const runClientName =
    typeof inputsMap.clientName === 'string' && inputsMap.clientName.trim()
      ? inputsMap.clientName.trim()
      : undefined;
  const runCta =
    typeof inputsMap.cta === 'string' && inputsMap.cta.trim() ? inputsMap.cta.trim() : DEFAULT_CTA;
  const runResultsSummary =
    typeof inputsMap.results === 'string' && inputsMap.results.trim() ? inputsMap.results.trim() : undefined;
  const runFormat =
    typeof inputsMap.format === 'string' && inputsMap.format
      ? formatOptions.find((option) => option.value === inputsMap.format)?.label ?? inputsMap.format
      : undefined;

  const resultsSection = useMemo(() => {
    return parsedContent.sections.find((section) => /result/i.test(section.heading)) ?? null;
  }, [parsedContent]);

  const highlightCards = useMemo(() => {
    if (!resultsSection) {
      return [];
    }
    return resultsSection.bullets.slice(0, 3);
  }, [resultsSection]);

  const getHighlightDescription = useCallback((bullet: CaseStudyBullet): string | undefined => {
    const normalizedText = bullet.text.trim();

    if (!bullet.emphasis) {
      return normalizedText || undefined;
    }

    if (normalizedText.toLowerCase().startsWith(bullet.emphasis.toLowerCase())) {
      const remainder = normalizedText.slice(bullet.emphasis.length).trim();
      return remainder || undefined;
    }

    return normalizedText || undefined;
  }, []);

  const hasCalloutContent = useMemo(() => {
    const paragraphCount = parsedContent.callout?.paragraphs.length ?? 0;
    const bulletCount = parsedContent.callout?.bullets.length ?? 0;
    return paragraphCount + bulletCount > 0;
  }, [parsedContent.callout]);

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
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Case Study Generator</h1>
            <p className="text-base text-muted-foreground">
              Turn client wins into persuasive, proof-driven success stories.
            </p>
          </div>
        </div>
      </header>

      <section>
        <Card className="border border-pink/20 bg-white shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-foreground">Configure Case Study</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Generate client success stories tailored to your offer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ava-profile">Client Profile</Label>
                  <Select value={selectedAvaSessionId} onValueChange={setSelectedAvaSessionId}>
                    <SelectTrigger id="ava-profile" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                      <SelectValue placeholder="Select client profile" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                      {avaSessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {(() => {
                            const baseLabel = pickDisplayName(
                              [session.userName, session.sessionName, session.id],
                              'Client Profile',
                            );
                            const relativeTime =
                              formatRelativeTime(session.completedAt) ??
                              formatRelativeTime((session as { updatedAt?: string }).updatedAt) ??
                              formatRelativeTime(session.createdAt);
                            return relativeTime ? `${baseLabel} • ${relativeTime}` : baseLabel;
                          })()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-brief">Product Profile</Label>
                  <Select value={selectedMargoBriefId} onValueChange={setSelectedMargoBriefId}>
                    <SelectTrigger id="product-brief" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                      <SelectValue placeholder="Select product profile" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                      {margoBriefs.map((brief) => (
                        <SelectItem key={brief.id} value={brief.id}>
                          {(() => {
                            const baseLabel = pickDisplayName(
                              [brief.userName, brief.productName, brief.sessionName, brief.id],
                              'Product Profile',
                            );
                            const relativeTime =
                              formatRelativeTime((brief as { updatedAt?: string | null }).updatedAt) ??
                              formatRelativeTime((brief as { completedAt?: string | null }).completedAt) ??
                              formatRelativeTime(brief.createdAt);
                            return relativeTime ? `${baseLabel} • ${relativeTime}` : baseLabel;
                          })()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-name">Client name or company</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Enter client name or company"
                    className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink"
                    aria-invalid={!isClientNameValid}
                />
                  {!isClientNameValid && (
                    <p className="text-xs text-destructive">
                      {trimmedClientName.length} / {MIN_NAME_LENGTH} characters minimum required
                    </p>
                  )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="challenge">Challenge or problem</Label>
                  <Textarea
                    id="challenge"
                    value={challenge}
                    onChange={(event) => setChallenge(event.target.value)}
                    placeholder="What problem did the client face before working with you?"
                    className="min-h-[120px] rounded-xl border border-pink/20 bg-white resize-none overflow-y-auto focus:border-vox-pink"
                    aria-invalid={!isChallengeValid}
                  />
                  {!isChallengeValid && (
                    <p className="text-xs text-destructive">
                      {trimmedChallenge.length} / {MIN_DETAIL_LENGTH} characters minimum required
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="solution">Solution provided</Label>
                  <Textarea
                    id="solution"
                    value={solution}
                    onChange={(event) => setSolution(event.target.value)}
                    placeholder="How did you help solve their problem?"
                    className="min-h-[120px] rounded-xl border border-pink/20 bg-white resize-none overflow-y-auto focus:border-vox-pink"
                    aria-invalid={!isSolutionValid}
                  />
                  {!isSolutionValid && (
                    <p className="text-xs text-destructive">
                      {trimmedSolution.length} / {MIN_DETAIL_LENGTH} characters minimum required
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="results">Results achieved</Label>
                <Textarea
                  id="results"
                  value={results}
                  onChange={(event) => setResults(event.target.value)}
                  placeholder="What specific results did they achieve? Include metrics if possible."
                    className="min-h-[120px] rounded-xl border border-pink/20 bg-white resize-none overflow-y-auto focus:border-vox-pink"
                    aria-invalid={!isResultsValid}
                />
                  {!isResultsValid && (
                    <p className="text-xs text-destructive">
                      {trimmedResults.length} / {MIN_DETAIL_LENGTH} characters minimum required
                    </p>
                  )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cta">Call to action</Label>
                  <Input
                    id="cta"
                    value={cta}
                    onChange={(event) => setCta(event.target.value)}
                    placeholder="Enter CTA"
                    className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink"
                    aria-invalid={!isCtaValid}
                  />
                  {!isCtaValid && (
                    <p className="text-xs text-destructive">
                      {trimmedCta.length} / {MIN_CTA_LENGTH} characters minimum required
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="format">Format</Label>
                  <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                    <SelectTrigger id="format" className="h-12 rounded-xl border border-pink/20 bg-white focus:border-vox-pink focus:ring-vox-pink">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-pink/20 bg-white shadow-lg">
                      {formatOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  {hasPrerequisites
                    ? 'Select your profiles, describe the win, and generate a polished case study.'
                    : 'Complete an AVA profile and a product brief to use this amplifier.'}
                </p>
                <Button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="h-12 w-full md:w-auto rounded-full bg-vox-pink px-8 text-base font-semibold text-white shadow-sm hover:bg-vox-pink/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Case Study'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        {isLoading ? (
          <Card className="border border-pink/20 bg-white shadow-sm">
            <CardContent className="flex items-center gap-3 py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading case study runs...</p>
            </CardContent>
          </Card>
        ) : loadError ? (
          <Card className="border border-red-200 bg-red-50 shadow-sm">
            <CardContent className="space-y-2 py-8 text-center">
              <p className="text-sm font-semibold text-destructive">Unable to load previous generations</p>
              <p className="text-sm text-destructive/80">{loadError}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void loadAmplifierData();
                }}
                className="mt-2 h-11 rounded-xl border-pink/20 text-destructive hover:bg-pink/10"
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : runs.length === 0 ? (
          <Card className="border border-dashed border-pink/20 bg-white shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Sparkles className="h-6 w-6 text-vox-pink" />
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">No case studies generated yet</p>
                <p className="text-sm text-muted-foreground">
                  Fill in the details above to generate your first success story.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card className="border border-pink/20 bg-white shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-semibold text-foreground">Generated Case Study</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Complete client success story ready to publish.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="rounded-2xl border border-pink/20 bg-pink/5 p-8 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-vox-pink">
                    {runFormat || 'Success Story'}
                  </p>
                  <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
                    {selectedRun?.output?.title || `How ${runClientName ?? 'your client'} succeeded`}
                  </h2>
                  {runClientName && (
                    <p className="text-base text-muted-foreground">
                      A customer success story featuring {runClientName}
                    </p>
                  )}
                  {runResultsSummary && (
                    <p className="text-sm font-semibold text-vox-pink">{runResultsSummary}</p>
                  )}
                </div>

                {highlightCards.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {highlightCards.map((bullet, index) => {
                      const description = bullet.emphasis
                        ? getHighlightDescription(bullet)
                        : bullet.text.trim();
                      return (
                        <div
                          key={`${bullet.text}-${index}`}
                          className="rounded-2xl border border-pink/20 bg-pink/5 p-5"
                        >
                          {bullet.emphasis && (
                            <p className="text-2xl font-semibold text-vox-pink">{bullet.emphasis}</p>
                          )}
                          {description && (
                            <p className="text-sm text-muted-foreground">{description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-8">
                  {parsedContent.sections.map((section, sectionIndex) => (
                    <div key={`${section.heading}-${sectionIndex}`} className="space-y-4">
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-foreground">{section.heading}</h3>
                        <span className="block h-1 w-12 rounded-full bg-vox-pink/40" />
                      </div>
                      <div className="space-y-4">
                        {section.paragraphs.map((paragraph, paragraphIndex) => (
                          <p key={`${section.heading}-paragraph-${paragraphIndex}`} className="text-base leading-relaxed text-foreground">
                            {paragraph}
                          </p>
                        ))}
                        {section.bullets.length > 0 && (
                          <ul className="space-y-3 rounded-xl bg-pink/5 border border-pink/10 p-5 text-sm leading-relaxed text-foreground">
                            {section.bullets.map((bullet, bulletIndex) => (
                              <li key={`${section.heading}-bullet-${bulletIndex}`} className="flex items-start gap-2">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-vox-pink" />
                                <span>{bullet.text}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {hasCalloutContent && (
                  <div className="rounded-2xl border border-pink/20 bg-pink/10 p-7 text-center space-y-3">
                    <p className="text-base font-semibold text-foreground">
                      {parsedContent.callout?.heading || 'Ready for the next step?'}
                    </p>
                    {parsedContent.callout?.paragraphs.map((paragraph, index) => (
                      <p key={`callout-paragraph-${index}`} className="text-sm text-muted-foreground">
                        {paragraph}
                      </p>
                    ))}
                    {parsedContent.callout?.bullets.map((bullet, index) => (
                      <p key={`callout-bullet-${index}`} className="text-sm text-muted-foreground">
                        {bullet.text}
                      </p>
                    ))}
                    {runCta && (
                      <Button
                        type="button"
                        className="mt-2 h-11 rounded-xl bg-vox-pink px-6 text-sm font-semibold text-white hover:bg-vox-pink/90"
                      >
                        {runCta}
                      </Button>
                    )}
                  </div>
                )}

              </CardContent>
            </Card>

            <aside className="space-y-4">
              <Card className="border border-pink/20 bg-white shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-foreground">Recent Generations</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Select a run to review its generated story.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {runs.map((run) => {
                    const isActive = run.id === selectedRun?.id;
                    const runCreatedAt = run.createdAt ? new Date(run.createdAt) : null;
                    const relativeTime = runCreatedAt
                      ? formatDistanceToNow(runCreatedAt, { addSuffix: true })
                      : 'Unknown time';
                    const runInputs = (run.inputs ?? {}) as Record<string, unknown>;
                    const runTitle =
                      typeof run.output?.title === 'string' && run.output.title
                        ? run.output.title
                        : typeof runInputs.clientName === 'string' && runInputs.clientName
                          ? `Case study for ${runInputs.clientName}`
                          : 'Case study';

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
                    <p className="font-semibold text-foreground">Client</p>
                    <p>{runClientName || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Format</p>
                    <p>{runFormat || '—'}</p>
                  </div>
                  {runResultsSummary && (
                    <div>
                      <p className="font-semibold text-foreground">Headline result</p>
                      <p>{runResultsSummary}</p>
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
                  {selectedRun?.output?.metadata && 'wordCount' in selectedRun.output.metadata && (
                    <div>
                      <p className="font-semibold text-foreground">Approximate word count</p>
                      <p>
                        {typeof selectedRun.output.metadata.wordCount === 'number'
                          ? `${selectedRun.output.metadata.wordCount.toLocaleString()} words`
                          : '—'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
};

export default CaseStudyGenerator;

