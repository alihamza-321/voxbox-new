import { API_BASE_URL } from '@/config/api.config';
import { AuthService } from './auth';

const logMargoApiEvent = (stage: 'request' | 'success' | 'failure', action: string, details?: Record<string, unknown>) => {
  const env = typeof import.meta !== 'undefined' ? (import.meta as any)?.env : undefined;
  const isTestEnv = env?.MODE === 'test' || env?.VITEST;
  if (isTestEnv) {
    return;
  }

  const timestamp = new Date().toISOString();
  const baseMessage = `[MARGO API][${stage.toUpperCase()}][${action}]`;

  if (details && Object.keys(details).length > 0) {
    console.log(baseMessage, { ...details, timestamp });
  } else {
    console.log(baseMessage, { timestamp });
  }
};

export interface MargoBrief {
  id: string;
  workspaceId: string;
  userId: string;
  avaProfileId: string | null;
  sessionName: string;
  userName: string | null;
  currentStep: number;
  status: string;
  version: number;
  step1Completed: boolean;
  step2AvaProfileId: string | null;
  step2Completed: boolean;
  nextAction: string | null;
  question: string | null;
  welcomeMessage?: string | null;
  videoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMargoBriefResponse {
  data: MargoBrief & {
    [key: string]: any;
  };
  message?: string;
  statusCode?: number;
}

export const createMargoBrief = async (
  workspaceId: string,
  sessionName = 'My Product Evaluation'
): Promise<CreateMargoBriefResponse> => {
  const endpoint = `${API_BASE_URL}/margo-briefs`;
  const action = 'createMargoBrief';
  logMargoApiEvent('request', action, { endpoint, workspaceId, sessionName });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        workspaceId,
        sessionName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create MARGO session' }));
      logMargoApiEvent('failure', action, { endpoint, workspaceId, sessionName, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to create MARGO session');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      workspaceId,
      sessionName,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      workspaceId,
      sessionName,
      error: error?.message || error,
    });
    throw error;
  }
};

export interface SubmitMargoStep1Payload {
  userName: string;
}

export interface SubmitMargoStep1Response {
  data?: MargoBrief;
  message?: string;
  statusCode?: number;
  [key: string]: any;
}

export const submitMargoStep1 = async (
  briefId: string,
  payload: SubmitMargoStep1Payload
): Promise<SubmitMargoStep1Response> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step1`;
  const action = 'submitMargoStep1';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 1 response' }));
      logMargoApiEvent('failure', action, { endpoint, briefId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to submit Step 1 response');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, { endpoint, briefId, error: error?.message || error });
    throw error;
  }
};

export interface AvaProfileSummary {
  id: string;
  name: string;
  sessionName: string;
  userName: string;
  createdAt: string;
  completedAt: string | null;
  currentPhase: string;
  isAvaSession: boolean;
}

export interface AvailableAvaProfilesResponse {
  data: AvaProfileSummary[];
  message?: string;
  statusCode?: number;
}

export const getAvailableAvaProfiles = async (
  workspaceId: string
): Promise<AvailableAvaProfilesResponse> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/workspace/${workspaceId}/available-ava-profiles`;
  const action = 'getAvailableAvaProfiles';
  logMargoApiEvent('request', action, { endpoint, workspaceId });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to load AVA profiles' }));
      logMargoApiEvent('failure', action, { endpoint, workspaceId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to load AVA profiles');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      workspaceId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, { endpoint, workspaceId, error: error?.message || error });
    throw error;
  }
};

export interface SubmitMargoStep2Payload {
  avaProfileId: string;
}

export interface SubmitMargoStep2Response {
  data?: MargoBrief;
  message?: string;
  statusCode?: number;
  [key: string]: any;
}

export const submitMargoStep2 = async (
  briefId: string,
  payload: SubmitMargoStep2Payload
): Promise<SubmitMargoStep2Response> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step2`;
  const action = 'submitMargoStep2';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to set AVA profile' }));
      logMargoApiEvent('failure', action, { endpoint, briefId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to set AVA profile');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, { endpoint, briefId, error: error?.message || error });
    throw error;
  }
};

export interface ConfirmMargoReadyPayload {
  message: string;
}

export interface ConfirmMargoReadyResponse {
  data?: MargoBrief;
  message?: string;
  statusCode?: number;
  [key: string]: any;
}

export const confirmMargoReady = async (
  briefId: string,
  payload: ConfirmMargoReadyPayload
): Promise<ConfirmMargoReadyResponse> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/ready`;
  const action = 'confirmMargoReady';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to confirm readiness' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to confirm readiness');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export interface MargoStep3Question {
  question?: {
    id: number;
    questionText: string;
    [key: string]: any;
  };
  questionText?: string;
  prompt?: string;
  exampleAnswer?: string;
  answer?: string;
  deeperExample?: string | null;
  [key: string]: any;
}

export interface FetchMargoStep3QuestionResponse {
  data?: MargoStep3Question;
  message?: string;
  statusCode?: number;
  [key: string]: any;
}

export const fetchMargoStep3Question = async (
  briefId: string,
  questionNumber: number
): Promise<FetchMargoStep3QuestionResponse> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step3/question/${questionNumber}`;
  const action = 'fetchMargoStep3Question';
  logMargoApiEvent('request', action, { endpoint, briefId, questionNumber });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to load Step 3 question' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        questionNumber,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to load Step 3 question');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      questionNumber,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      questionNumber,
      error: error?.message || error,
    });
    throw error;
  }
};

export interface SubmitMargoStep3AnswerPayload {
  questionNumber: number;
  answer: string;
}

export interface MargoStep3AnswerResult {
  success: boolean;
  isStepComplete: boolean;
  nextQuestion?: number;
  feedbackMessage?: string;
  [key: string]: any;
}

export interface SubmitMargoStep3AnswerResponse {
  data?: MargoStep3AnswerResult;
  message?: string;
  statusCode?: number;
  [key: string]: any;
}

export const submitMargoStep3Answer = async (
  briefId: string,
  payload: SubmitMargoStep3AnswerPayload
): Promise<SubmitMargoStep3AnswerResponse> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step3/question`;
  const action = 'submitMargoStep3Answer';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 3 answer' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to submit Step 3 answer');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export const fetchMargoStep3DeeperExample = async (
  briefId: string,
  questionNumber: number
): Promise<FetchMargoStep3QuestionResponse> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step3/question/${questionNumber}?depth=deep`;
  const action = 'fetchMargoStep3DeeperExample';
  logMargoApiEvent('request', action, { endpoint, briefId, questionNumber });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to load deeper example' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        questionNumber,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to load deeper example');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      questionNumber,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      questionNumber,
      error: error?.message || error,
    });
    throw error;
  }
};

export interface MargoStep4Score {
  criteria: string;
  score: number;
  reasoning: string;
}

export interface MargoStep4Assessment {
  totalScore: number;
  percentage: number;
  band: "Excellent" | "Good" | "Moderate" | "Weak" | string;
  criteriaScores: MargoStep4Score[];
  videoUrl?: string | null;
  [key: string]: any;
}

export interface SubmitMargoStep4Payload {
  message: string;
}

export interface SubmitMargoStep4Response {
  data?: {
    assessment?: MargoStep4Assessment;
    message?: string;
    nextAction?: string;
    videoUrl?: string | null;
    [key: string]: any;
  };
  message?: string;
  statusCode?: number;
  [key: string]: any;
}

export const submitMargoStep4Ready = async (
  briefId: string,
  payload: SubmitMargoStep4Payload
): Promise<SubmitMargoStep4Response> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step4/ready`;
  const action = 'submitMargoStep4Ready';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to generate Step 4 assessment' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to generate Step 4 assessment');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export const submitMargoStep4VideoWatched = async (
  briefId: string,
  payload: SubmitMargoStep4Payload
): Promise<SubmitMargoStep4Response> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step4/video-watched`;
  const action = 'submitMargoStep4VideoWatched';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to acknowledge video completion' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to acknowledge video completion');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export interface MargoStep5Recommendation {
  negativeFactor: string;
  recommendedEnhancement: string;
  considerations: string;
  score?: number;
  [key: string]: any;
}

export interface MargoStep6FalseBelief {
  rank: number;
  vehicleBelief: string;
  internalBelief: string;
  externalBelief: string;
  [key: string]: any;
}

export interface MargoStep6BonusSuggestion {
  falseBelief: string;
  title: string;
  description: string;
  [key: string]: any;
}

export interface SubmitMargoStep5Payload {
  message: string;
}

export interface SubmitMargoStep5Response {
  data?: {
    recommendations?: MargoStep5Recommendation[];
    message?: string;
    nextAction?: string;
    [key: string]: any;
  };
  message?: string;
  statusCode?: number;
  [key: string]: any;
}

export const submitMargoStep5Ready = async (
  briefId: string,
  payload: SubmitMargoStep5Payload
): Promise<SubmitMargoStep5Response> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step5/ready`;
  const action = 'submitMargoStep5Ready';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to generate Step 5 recommendations' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to generate Step 5 recommendations');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export const submitMargoStep5VideoWatched = async (
  briefId: string,
  payload: SubmitMargoStep5Payload
): Promise<SubmitMargoStep5Response> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step5/video-watched`;
  const action = 'submitMargoStep5VideoWatched';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to acknowledge Step 5 video' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to acknowledge Step 5 video');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export interface SubmitMargoStep6Payload {
  message: string;
  selectedBeliefs?: Array<number | string>;
  sectionId?: string | number;
}

export interface SubmitMargoStep6Response {
  data?: {
    message?: string;
    nextAction?: string;
    videoUrl?: string | null;
    falseBeliefs?: MargoStep6FalseBelief[];
    formattedOutput?: string;
    bonusRequestMessage?: string;
    bonusSuggestions?: MargoStep6BonusSuggestion[];
    step7IntroMessage?: string;
    [key: string]: any;
  };
  message?: string;
  statusCode?: number;
  [key: string]: any;
}

export const submitMargoStep6Ready = async (
  briefId: string,
  payload: SubmitMargoStep6Payload
): Promise<SubmitMargoStep6Response> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step6/ready`;
  const action = 'submitMargoStep6Ready';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to prepare Step 6' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to prepare Step 6');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export const submitMargoStep6VideoWatched = async (
  briefId: string,
  payload: SubmitMargoStep6Payload
): Promise<SubmitMargoStep6Response> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step6/video-watched`;
  const action = 'submitMargoStep6VideoWatched';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to acknowledge Step 6 video' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to acknowledge Step 6 video');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export const submitMargoStep6BonusRequest = async (
  briefId: string,
  payload: SubmitMargoStep6Payload
): Promise<SubmitMargoStep6Response> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step6/bonus-request`;
  const action = 'submitMargoStep6BonusRequest';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to generate Step 6 bonuses' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to generate Step 6 bonuses');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export interface MargoStep7Section {
  id?: string;
  title?: string | null;
  content: string;
  [key: string]: any;
}

export interface SubmitMargoStep7GenerateResponse {
  data?: {
    message?: string;
    section?: MargoStep7Section | null;
    nextAction?: string;
    [key: string]: any;
  };
  message?: string;
  statusCode?: number;
  [key: string]: any;
}

export const submitMargoStep7Generate = async (
  briefId: string,
  payload: SubmitMargoStep6Payload
): Promise<SubmitMargoStep7GenerateResponse> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step7/generate`;
  const action = 'submitMargoStep7Generate';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to generate Step 7 section' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to generate Step 7 section');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};


export interface SubmitMargoStep5DecisionsPayload {
  decisions: Array<{
    negativeFactor: string;
    action: "accept" | "modify" | "dismiss";
    note?: string;
  }>;
}

export interface SubmitMargoStep5DecisionsResponse {
  data?: {
    nextAction?: string;
    message?: string;
    [key: string]: any;
  };
  message?: string;
  statusCode?: number;
  [key: string]: any;
}

export const submitMargoStep5Decisions = async (
  briefId: string,
  payload: SubmitMargoStep5DecisionsPayload
): Promise<SubmitMargoStep5DecisionsResponse> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/step5/decisions`;
  const action = 'submitMargoStep5Decisions';
  logMargoApiEvent('request', action, { endpoint, briefId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to record Step 5 decisions' }));
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData.message || 'Failed to record Step 5 decisions');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export const fetchMargoFinalProductBrief = async (briefId: string): Promise<Blob> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/final-product-brief`;
  const action = 'fetchMargoFinalProductBrief';
  logMargoApiEvent('request', action, { endpoint, briefId });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/pdf',
      },
    });

    if (!response.ok) {
      let errorDetails: any = null;
      try {
        errorDetails = await response.json();
      } catch {
        // likely not JSON (probably binary); ignore parse failure
      }
      logMargoApiEvent('failure', action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorDetails,
      });
      throw new Error(errorDetails?.message || 'Failed to download final product brief');
    }

    const blob = await response.blob();
    logMargoApiEvent('success', action, {
      endpoint,
      briefId,
      status: response.status,
      size: blob.size,
      type: blob.type,
    });
    return blob;
  } catch (error: any) {
    logMargoApiEvent('failure', action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

export interface WorkspaceBrief {
  id: string;
  workspaceId: string;
  userId: string;
  sessionName: string;
  userName?: string | null;
  productName?: string | null;
  status: string;
  currentStep?: number;
  version?: number;
  step1Completed?: boolean;
  step2Completed?: boolean;
  step3Completed?: boolean;
  step4Completed?: boolean;
  step5Completed?: boolean;
  step6Completed?: boolean;
  step7Completed?: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  [key: string]: unknown;
}

export const listWorkspaceBriefs = async (workspaceId: string): Promise<WorkspaceBrief[]> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/workspace/${workspaceId}`;
  const action = 'listWorkspaceBriefs';
  logMargoApiEvent('request', action, { endpoint, workspaceId });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to load MARGO briefs' }));
      logMargoApiEvent('failure', action, { endpoint, workspaceId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to load MARGO briefs');
    }

    const result = await response.json();
    logMargoApiEvent('success', action, { endpoint, workspaceId, status: response.status });
    return result?.data || result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to load MARGO briefs';
    logMargoApiEvent('failure', action, { endpoint, workspaceId, error: message });
    throw new Error(message);
  }
};

export interface MargoFinalProductBriefDataResponse {
  data?: {
    finalProductBrief?: string | null;
    sections?: MargoStep7Section[];
    status?: string | null;
    completedAt?: string | null;
  } | null;
}

export const fetchMargoFinalProductBriefData = async (
  briefId: string
): Promise<MargoFinalProductBriefDataResponse | null> => {
  const endpoint = `${API_BASE_URL}/margo-briefs/${briefId}/final-product-brief`;
  const action = "fetchMargoFinalProductBriefData";
  logMargoApiEvent("request", action, { endpoint, briefId });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      logMargoApiEvent("failure", action, {
        endpoint,
        briefId,
        status: response.status,
        error: "Final product brief not ready",
      });
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Failed to fetch final product brief" }));
      logMargoApiEvent("failure", action, {
        endpoint,
        briefId,
        status: response.status,
        error: errorData,
      });
      throw new Error(errorData?.message || "Failed to fetch final product brief");
    }

    const result = await response.json();
    logMargoApiEvent("success", action, {
      endpoint,
      briefId,
      status: response.status,
      hasSummary: Boolean(result?.data?.finalProductBrief),
      sectionsCount: Array.isArray(result?.data?.sections) ? result.data.sections.length : 0,
    });
    return result as MargoFinalProductBriefDataResponse;
  } catch (error: any) {
    logMargoApiEvent("failure", action, {
      endpoint,
      briefId,
      error: error?.message || error,
    });
    throw error;
  }
};

