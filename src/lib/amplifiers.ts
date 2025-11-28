import { API_BASE_URL } from '@/config/api.config';
import { AuthService } from '@/lib/auth';

export type AmplifierType =
  | 'email_sequence'
  | 'sales_page'
  | 'value_proposition'
  | 'video_script'
  | 'social_media'
  | 'ad_copy'
  | 'blog_post'
  | 'webinar_script'
  | 'case_study'
  | string;

export interface AmplifierEmailSequence {
  emailNumber?: number;
  subject?: string;
  preheader?: string;
  body: string;
  [key: string]: unknown;
}

export interface AmplifierSocialMediaPost {
  postNumber?: number;
  caption?: string;
  hashtags?: string[];
  notes?: string;
  platform?: string;
  characterCount?: number;
  [key: string]: unknown;
}

export interface AmplifierAdCopyVariation {
  variationName?: string;
  name?: string;
  angle?: string;
  title?: string;
  headline?: string;
  headlineText?: string;
  primaryText?: string;
  description?: string;
  body?: string;
  hook?: string;
  subheadline?: string;
  callToAction?: string;
  cta?: string;
  supportingPoints?: string[];
  [key: string]: unknown;
}

export interface AmplifierOutput<TContent = unknown> {
  title: string;
  content: TContent;
  metadata?: Record<string, unknown>;
}

export interface AmplifierRun<TContent = unknown> {
  id: string;
  workspaceId: string;
  type: AmplifierType;
  status: string;
  title?: string;
  language?: string;
  inputs: Record<string, unknown>;
  output?: AmplifierOutput<TContent>;
  createdAt: string;
  updatedAt: string;
}

export type EmailSequenceAmplifierRun = AmplifierRun<AmplifierEmailSequence[] | string>;
export type SalesPageAmplifierRun = AmplifierRun<string>;
export interface ValuePropositionContent {
  benefits?: string[];
  headline?: string;
  solution?: string;
  guarantee?: string;
  socialProof?: string;
  subheadline?: string;
  uniqueAdvantage?: string;
  callToAction?: string;
  problemStatement?: string;
  [key: string]: unknown;
}

export type VideoScriptAmplifierRun = AmplifierRun<string>;
export type WebinarScriptAmplifierRun = AmplifierRun<string>;
export type SocialMediaAmplifierRun = AmplifierRun<AmplifierSocialMediaPost[] | string>;
export type AdCopyAmplifierRun = AmplifierRun<AmplifierAdCopyVariation[] | string>;
export type ValuePropositionAmplifierRun = AmplifierRun<ValuePropositionContent>;
export type BlogPostAmplifierRun = AmplifierRun<string>;
export type CaseStudyAmplifierRun = AmplifierRun<string>;

export interface CreateEmailSequencePayload {
  workspaceId: string;
  avaSessionId: string;
  margoProfileId: string;
  cta: string;
  sequenceGoal: string;
  numberOfEmails: number;
}

interface RawAmplifierRun {
  id: string;
  workspaceId?: string;
  workspace_id?: string;
  type: AmplifierType;
  status: string;
  title?: string;
  language?: string;
  inputs?: Record<string, unknown>;
  output?: AmplifierOutput<AmplifierEmailSequence[] | string>;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

const deepUnwrap = (payload: unknown): any => {
  if (!payload) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload === 'object') {
    const maybeData = (payload as Record<string, unknown>).data;
    if (maybeData !== undefined) {
      return deepUnwrap(maybeData);
    }
  }

  return payload;
};

const mapAmplifierRun = <TContent = unknown>(raw: RawAmplifierRun): AmplifierRun<TContent> => {
  const run = deepUnwrap(raw) as RawAmplifierRun;

  const workspaceId =
    typeof run.workspaceId === 'string'
      ? run.workspaceId
      : typeof run.workspace_id === 'string'
        ? run.workspace_id
        : '';

  const createdAt =
    typeof run.createdAt === 'string'
      ? run.createdAt
      : typeof run.created_at === 'string'
        ? run.created_at
        : new Date().toISOString();

  const updatedAt =
    typeof run.updatedAt === 'string'
      ? run.updatedAt
      : typeof run.updated_at === 'string'
        ? run.updated_at
        : createdAt;

  return {
    id: run.id,
    workspaceId,
    type: run.type,
    status: run.status,
    title: run.title,
    language: run.language,
    inputs: (run.inputs ?? {}) as Record<string, unknown>,
    output: run.output as AmplifierOutput<TContent> | undefined,
    createdAt,
    updatedAt,
  };
};

export const createEmailSequenceAmplifier = async (
  payload: CreateEmailSequencePayload,
): Promise<EmailSequenceAmplifierRun> => {
  const endpoint = `${API_BASE_URL}/workspaces/${payload.workspaceId}/amplifiers`;

  const response = await AuthService.makeAuthenticatedRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      amplifierType: 'email_sequence',
      avaSessionId: payload.avaSessionId,
      margoProfileId: payload.margoProfileId,
      cta: payload.cta,
      inputs: {
        sequenceGoal: payload.sequenceGoal,
        numberOfEmails: payload.numberOfEmails,
        cta: payload.cta,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to generate email sequence' }));
    throw new Error(errorData.message || 'Failed to generate email sequence');
  }

  const result = await response.json();
  const run = deepUnwrap(result) as RawAmplifierRun;
  return mapAmplifierRun<AmplifierEmailSequence[] | string>(run);
};

export interface CreateSalesPagePayload {
  workspaceId: string;
  avaSessionId: string;
  margoProfileId: string;
  cta: string;
  pageLength: 'short' | 'medium' | 'long';
}

export const createSalesPageAmplifier = async (
  payload: CreateSalesPagePayload,
): Promise<SalesPageAmplifierRun> => {
  const endpoint = `${API_BASE_URL}/workspaces/${payload.workspaceId}/amplifiers`;

  const requestBody: Record<string, unknown> = {
    amplifierType: 'sales_page',
    avaSessionId: payload.avaSessionId,
    margoProfileId: payload.margoProfileId,
    cta: payload.cta,
    inputs: {
      pageLength: payload.pageLength,
      cta: payload.cta,
    },
  };

  const response = await AuthService.makeAuthenticatedRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to generate sales page' }));
    throw new Error(errorData.message || 'Failed to generate sales page');
  }

  const result = await response.json();
  const run = deepUnwrap(result) as RawAmplifierRun;
  return mapAmplifierRun<string>(run);
};

export interface CreateVideoScriptPayload {
  workspaceId: string;
  avaSessionId: string;
  margoProfileId: string;
  videoTopic: string;
  videoDuration: string;
  videoStyle: string;
  cta?: string;
}

const DEFAULT_VIDEO_SCRIPT_CTA = 'Subscribe for more insights';

export const createVideoScriptAmplifier = async (
  payload: CreateVideoScriptPayload,
): Promise<VideoScriptAmplifierRun> => {
  const endpoint = `${API_BASE_URL}/workspaces/${payload.workspaceId}/amplifiers`;

  const resolvedCta = payload.cta?.trim() || DEFAULT_VIDEO_SCRIPT_CTA;

  const requestBody: Record<string, unknown> = {
    amplifierType: 'video_script',
    avaSessionId: payload.avaSessionId,
    margoProfileId: payload.margoProfileId,
    cta: resolvedCta,
    inputs: {
      videoTopic: payload.videoTopic,
      videoDuration: payload.videoDuration,
      videoStyle: payload.videoStyle,
      cta: resolvedCta,
    },
  };

  const response = await AuthService.makeAuthenticatedRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to generate video script' }));
    throw new Error(errorData.message || 'Failed to generate video script');
  }

  const result = await response.json();
  const run = deepUnwrap(result) as RawAmplifierRun;
  return mapAmplifierRun<string>(run);
};

export interface CreateWebinarScriptPayload {
  workspaceId: string;
  avaSessionId: string;
  margoProfileId: string;
  webinarTitle: string;
  webinarTopic: string;
  duration: string;
  offerAtEnd: boolean;
  cta?: string;
}

const DEFAULT_WEBINAR_SCRIPT_CTA = 'Register for our next webinar';

export const createWebinarScriptAmplifier = async (
  payload: CreateWebinarScriptPayload,
): Promise<WebinarScriptAmplifierRun> => {
  const endpoint = `${API_BASE_URL}/workspaces/${payload.workspaceId}/amplifiers`;

  const resolvedCta = payload.cta?.trim() || DEFAULT_WEBINAR_SCRIPT_CTA;

  const requestBody: Record<string, unknown> = {
    amplifierType: 'webinar_script',
    avaSessionId: payload.avaSessionId,
    margoProfileId: payload.margoProfileId,
    cta: resolvedCta,
    inputs: {
      webinarTitle: payload.webinarTitle.trim(),
      webinarTopic: payload.webinarTopic.trim(),
      duration: payload.duration,
      offerAtEnd: payload.offerAtEnd,
      cta: resolvedCta,
    },
  };

  const response = await AuthService.makeAuthenticatedRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to generate webinar script' }));
    throw new Error(errorData.message || 'Failed to generate webinar script');
  }

  const result = await response.json();
  const run = deepUnwrap(result) as RawAmplifierRun;
  return mapAmplifierRun<string>(run);
};

export interface CreateSocialMediaPayload {
  workspaceId: string;
  avaSessionId: string;
  margoProfileId: string;
  cta: string;
  platform: string;
  topicOrTheme: string;
  numberOfPosts: number;
}

export const createSocialMediaAmplifier = async (
  payload: CreateSocialMediaPayload,
): Promise<SocialMediaAmplifierRun> => {
  const endpoint = `${API_BASE_URL}/workspaces/${payload.workspaceId}/amplifiers`;

  const requestBody: Record<string, unknown> = {
    amplifierType: 'social_media',
    avaSessionId: payload.avaSessionId,
    margoProfileId: payload.margoProfileId,
    cta: payload.cta,
    inputs: {
      platform: payload.platform,
      topicOrTheme: payload.topicOrTheme,
      numberOfPosts: payload.numberOfPosts,
    },
  };

  const response = await AuthService.makeAuthenticatedRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to generate social media posts' }));
    throw new Error(errorData.message || 'Failed to generate social media posts');
  }

  const result = await response.json();
  const run = deepUnwrap(result) as RawAmplifierRun;
  return mapAmplifierRun<AmplifierSocialMediaPost[] | string>(run);
};

export interface CreateAdCopyPayload {
  workspaceId: string;
  avaSessionId: string;
  margoProfileId: string;
  cta: string;
  platform: string;
  adFormat: string;
  campaignGoal: string;
}

export const createAdCopyAmplifier = async (
  payload: CreateAdCopyPayload,
): Promise<AdCopyAmplifierRun> => {
  const endpoint = `${API_BASE_URL}/workspaces/${payload.workspaceId}/amplifiers`;

  const requestBody: Record<string, unknown> = {
    amplifierType: 'ad_copy',
    avaSessionId: payload.avaSessionId,
    margoProfileId: payload.margoProfileId,
    cta: payload.cta,
    inputs: {
      platform: payload.platform,
      adFormat: payload.adFormat,
      campaignGoal: payload.campaignGoal,
      cta: payload.cta,
    },
  };

  const response = await AuthService.makeAuthenticatedRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to generate ad copy' }));
    throw new Error(errorData.message || 'Failed to generate ad copy');
  }

  const result = await response.json();
  const run = deepUnwrap(result) as RawAmplifierRun;
  return mapAmplifierRun<AmplifierAdCopyVariation[] | string>(run);
};

export interface CreateBlogPostPayload {
  workspaceId: string;
  avaSessionId: string;
  margoProfileId: string;
  blogTopic: string;
  keyPointsToCover: string[];
  wordCount: number;
  cta: string;
}

export const createBlogPostAmplifier = async (
  payload: CreateBlogPostPayload,
): Promise<BlogPostAmplifierRun> => {
  const endpoint = `${API_BASE_URL}/workspaces/${payload.workspaceId}/amplifiers`;

  const normalizedKeyPoints = payload.keyPointsToCover
    .map((point) => point.trim())
    .filter((point, index, all) => Boolean(point) && all.indexOf(point) === index);

  const requestBody: Record<string, unknown> = {
    amplifierType: 'blog_post',
    avaSessionId: payload.avaSessionId,
    margoProfileId: payload.margoProfileId,
    cta: payload.cta,
    inputs: {
      blogTopic: payload.blogTopic.trim(),
      keyPointsToCover: normalizedKeyPoints,
      wordCount: payload.wordCount,
      cta: payload.cta,
    },
  };

  console.log('[BlogPostAmplifier] ↗️ Creating blog post run');
  console.log('[BlogPostAmplifier] Endpoint:', endpoint);
  console.log('[BlogPostAmplifier] Payload:', {
    ...requestBody,
    inputs: {
      ...(requestBody.inputs as Record<string, unknown>),
      keyPointsToCover: normalizedKeyPoints,
    },
  });

  const response = await AuthService.makeAuthenticatedRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to generate blog post' }));
    console.error('[BlogPostAmplifier] ❌ Request failed:', errorData);
    throw new Error(errorData.message || 'Failed to generate blog post');
  }

  const result = await response.json();
  console.log('[BlogPostAmplifier] ✅ Received blog post run:', result);
  const run = deepUnwrap(result) as RawAmplifierRun;
  return mapAmplifierRun<string>(run);
};

export interface CreateValuePropositionPayload {
  workspaceId: string;
  avaSessionId: string;
  margoProfileId: string;
  format: string;
  cta?: string;
}

const DEFAULT_VALUE_PROPOSITION_CTA = 'Learn more';

export const createValuePropositionAmplifier = async (
  payload: CreateValuePropositionPayload,
): Promise<ValuePropositionAmplifierRun> => {
  const endpoint = `${API_BASE_URL}/workspaces/${payload.workspaceId}/amplifiers`;

  const resolvedCta = payload.cta?.trim() || DEFAULT_VALUE_PROPOSITION_CTA;

  const requestBody: Record<string, unknown> = {
    amplifierType: 'value_proposition',
    avaSessionId: payload.avaSessionId,
    margoProfileId: payload.margoProfileId,
    cta: resolvedCta,
    inputs: {
      format: payload.format,
    },
  };

  const response = await AuthService.makeAuthenticatedRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to generate value proposition' }));
    throw new Error(errorData.message || 'Failed to generate value proposition');
  }

  const result = await response.json();
  const run = deepUnwrap(result) as RawAmplifierRun;
  return mapAmplifierRun<ValuePropositionContent>(run);
};

const DEFAULT_CASE_STUDY_CTA = 'See how we can help you';

export interface CreateCaseStudyPayload {
  workspaceId: string;
  avaSessionId: string;
  margoProfileId: string;
  clientName: string;
  challenge: string;
  solution: string;
  results: string;
  format: string;
  cta?: string;
}

export const createCaseStudyAmplifier = async (
  payload: CreateCaseStudyPayload,
): Promise<CaseStudyAmplifierRun> => {
  const endpoint = `${API_BASE_URL}/workspaces/${payload.workspaceId}/amplifiers`;

  const resolvedCta = payload.cta?.trim() || DEFAULT_CASE_STUDY_CTA;

  const requestBody: Record<string, unknown> = {
    amplifierType: 'case_study',
    avaSessionId: payload.avaSessionId,
    margoProfileId: payload.margoProfileId,
    cta: resolvedCta,
    inputs: {
      clientName: payload.clientName.trim(),
      challenge: payload.challenge.trim(),
      solution: payload.solution.trim(),
      results: payload.results.trim(),
      format: payload.format,
      cta: resolvedCta,
    },
  };

  const response = await AuthService.makeAuthenticatedRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to generate case study' }));
    throw new Error(errorData.message || 'Failed to generate case study');
  }

  const result = await response.json();
  const run = deepUnwrap(result) as RawAmplifierRun;
  return mapAmplifierRun<string>(run);
};

export const listAmplifierRuns = async <TContent = AmplifierEmailSequence[] | string>(
  workspaceId: string,
  type: AmplifierType = 'email_sequence',
): Promise<AmplifierRun<TContent>[]> => {
  const url = new URL(`${API_BASE_URL}/workspaces/${workspaceId}/amplifiers`);
  if (type) {
    url.searchParams.set('type', type);
  }

  const response = await AuthService.makeAuthenticatedRequest(url.toString(), {
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to load amplifier runs' }));
    throw new Error(errorData.message || 'Failed to load amplifier runs');
  }

  const result = await response.json();
  const runs = deepUnwrap(result);

  if (!Array.isArray(runs)) {
    return [];
  }

  return runs.map((run) => mapAmplifierRun<TContent>(run as RawAmplifierRun));
};

