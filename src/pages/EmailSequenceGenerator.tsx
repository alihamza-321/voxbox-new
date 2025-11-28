import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/components/ui/use-toast';

import {
  createEmailSequenceAmplifier,
  listAmplifierRuns,
  type AmplifierEmailSequence,
  type EmailSequenceAmplifierRun,
} from '@/lib/amplifiers';
import { listWorkspaceSessions, type WorkspaceSession } from '@/lib/ava-api';
import { listWorkspaceBriefs, type WorkspaceBrief } from '@/lib/margo-api';
import { pickDisplayName } from '@/lib/display';
import { useAmplifierField, useAmplifierScrollRestoration } from '@/hooks/useAmplifierPersistence';

const sanitizeEmailCount = (value: string): number => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 1;
  }
  return Math.min(Math.max(parsed, 1), 20);
};

const isCompletedSession = (session: WorkspaceSession): boolean => {
  return session.status === 'completed' || session.currentPhase === 'completed';
};

const isCompletedBrief = (brief: WorkspaceBrief): boolean => {
  return ['completed', 'ready_for_export'].includes((brief.status || '').toLowerCase());
};

const extractEmailArray = (value: unknown): AmplifierEmailSequence[] => {
  if (!value) {
    return [];
  }

  const normalizeCandidate = (candidate: unknown): AmplifierEmailSequence[] | null => {
    if (!candidate) {
      return null;
    }

    if (Array.isArray(candidate)) {
      return candidate as AmplifierEmailSequence[];
    }

    if (typeof candidate === 'object') {
      // Some providers wrap the array in a property like "content" or "emails"
      const nestedKeys = [
        'content',
        'emails',
        'emailSequence',
        'sequence',
        'items',
        'messages',
        'data',
      ];

      for (const key of nestedKeys) {
        const nested = (candidate as Record<string, unknown>)[key];
        if (Array.isArray(nested)) {
          return nested as AmplifierEmailSequence[];
        }
      }

      // As a last resort, scan all enumerable values
      for (const nested of Object.values(candidate as Record<string, unknown>)) {
        if (Array.isArray(nested)) {
          return nested as AmplifierEmailSequence[];
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

const getEmailsFromRun = (run: EmailSequenceAmplifierRun): AmplifierEmailSequence[] => {
  return extractEmailArray(run.output?.content);
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

const numberOptions = Array.from({ length: 10 }).map((_, idx) => String(idx + 1));

const EmailSequenceGenerator = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [avaSessions, setAvaSessions] = useState<WorkspaceSession[]>([]);
  const [margoBriefs, setMargoBriefs] = useState<WorkspaceBrief[]>([]);
  const [runs, setRuns] = useState<EmailSequenceAmplifierRun[]>([]);

  const amplifierKey = 'emailSequence' as const;

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
  const [sequenceGoal, setSequenceGoal] = useAmplifierField<string>(
    amplifierKey,
    'sequenceGoal',
    '',
  );
  const [numberOfEmails, setNumberOfEmails] = useAmplifierField<string>(
    amplifierKey,
    'numberOfEmails',
    '5',
  );
  const [cta] = useState('Start your free trial today!');

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
        listAmplifierRuns(workspaceId, 'email_sequence'),
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

      const trimmedGoal = sequenceGoal.trim();
      const emailCount = sanitizeEmailCount(numberOfEmails);

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

      if (!trimmedGoal) {
        toast({
          title: 'Sequence goal required',
          description: 'Describe what you want this email sequence to accomplish.',
          variant: 'destructive',
        });
        return;
      }

      setIsSubmitting(true);

      try {
        const newRun = await createEmailSequenceAmplifier({
          workspaceId,
          avaSessionId: selectedAvaSessionId,
          margoProfileId: selectedMargoBriefId,
          cta,
          sequenceGoal: trimmedGoal,
          numberOfEmails: emailCount,
        });

        setRuns((prev) => [newRun, ...prev]);

        toast({
          title: 'Email sequence generated',
          description: 'Scroll down to review the freshly generated sequence.',
        });
        setSequenceGoal('');
        setNumberOfEmails(String(emailCount));
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
    [workspaceId, toast, selectedAvaSessionId, selectedMargoBriefId, sequenceGoal, numberOfEmails, cta],
  );

  const hasPrerequisites = useMemo(() => {
    return avaSessions.length > 0 && margoBriefs.length > 0;
  }, [avaSessions.length, margoBriefs.length]);

  const isSequenceGoalValid = useMemo(() => {
    return sequenceGoal.trim().length >= 10;
  }, [sequenceGoal]);

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
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Email Sequence Generator</h1>
            <p className="text-sm text-muted-foreground">Create engaging email sequences</p>
          </div>
        </div>
      </header>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Configure Email Sequence</CardTitle>
          <CardDescription>Select profiles and configure your sequence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
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
                        {pickDisplayName([brief.userName, brief.productName, brief.sessionName], 'Product Profile')} •{' '}
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
              <Label>Sequence Goal</Label>
              <Textarea
                placeholder="What's the goal of this email sequence? (e.g., nurture leads, promote launch, onboard customers)"
                minLength={10}
                rows={4}
                value={sequenceGoal}
                onChange={(event) => setSequenceGoal(event.target.value)}
                disabled={isSubmitting || !hasPrerequisites}
                className="rounded-2xl border-border/70 bg-white resize-none"
              />
              {sequenceGoal.trim().length < 10 && (
                <p className="text-xs text-destructive">
                  {sequenceGoal.trim().length} / 10 characters minimum required
                </p>
              )}
            </div>

            <div className="grid gap-5 md:w-1/2">
              <div className="space-y-2">
                <Label>Number of Emails</Label>
                <Select
                  value={numberOfEmails}
                  onValueChange={setNumberOfEmails}
                  disabled={isSubmitting || !hasPrerequisites}
                >
                  <SelectTrigger className="h-12 rounded-xl border-border/80 bg-white">
                    <SelectValue placeholder="Select number" />
                  </SelectTrigger>
                  <SelectContent>
                    {numberOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={!hasPrerequisites || !isSequenceGoalValid || isSubmitting}
              className="h-12 rounded-xl bg-[#ff1f6c] text-base font-semibold text-white transition hover:bg-[#e51860]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Email Sequence…
                </span>
              ) : (
                'Generate Email Sequence'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Generated Output</CardTitle>
          <CardDescription>Your generated email sequence will appear here</CardDescription>
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
              Your generated email sequence will appear here once ready.
            </div>
          ) : (
            runs.map((run) => {
              const emails = getEmailsFromRun(run);
              return (
                <Card key={run.id} className="rounded-xl border border-border/70 bg-white shadow-sm">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-lg font-semibold">
                      {run.title || run.output?.title || 'Email Sequence'}
                    </CardTitle>
                    <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
                      Generated {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {emails.length > 0 ? (
                      <Accordion type="multiple" className="rounded-xl border border-border/60">
                        {emails.map((email, index) => {
                          const logicalIndex = email.emailNumber ? email.emailNumber - 1 : index;
                          const uniqueKey = `${run.id}-email-${logicalIndex}`;
                          return (
                            <AccordionItem key={uniqueKey} value={uniqueKey}>
                            <AccordionTrigger className="px-4 py-3 text-left text-sm font-medium">
                              Email {email.emailNumber ?? index + 1}: {email.subject || 'Untitled email'}
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 text-sm leading-relaxed">
                              {email.preheader && (
                                <p className="mb-3 text-xs text-muted-foreground">
                                  Preheader: {email.preheader}
                                </p>
                              )}
                              <div className="whitespace-pre-line rounded-lg bg-muted px-4 py-3">
                                {email.body || 'No email body provided.'}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                          );
                        })}
                      </Accordion>
                    ) : typeof run.output?.content === 'string' ? (
                      <div className="rounded-lg bg-muted px-4 py-4 text-sm whitespace-pre-wrap leading-relaxed">
                        {run.output.content}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                        The amplifier returned an unexpected format. Please regenerate the sequence.
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

export default EmailSequenceGenerator;

