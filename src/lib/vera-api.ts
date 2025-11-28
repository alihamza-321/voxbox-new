import { API_BASE_URL } from '@/config/api.config';
import { AuthService } from './auth';

const logVeraApiEvent = (stage: 'request' | 'success' | 'failure', action: string, details?: Record<string, unknown>) => {
  const env = typeof import.meta !== 'undefined' ? (import.meta as any)?.env : undefined;
  const isTestEnv = env?.MODE === 'test' || env?.VITEST;
  if (isTestEnv) {
    return;
  }

  const timestamp = new Date().toISOString();
  const baseMessage = `[VERA API][${stage.toUpperCase()}][${action}]`;

  if (details && Object.keys(details).length > 0) {
    console.log(baseMessage, { ...details, timestamp });
  } else {
    console.log(baseMessage, { timestamp });
  }
};

export interface VeraProfile {
  id: string;
  workspaceId: string;
  name: string;
  version: number;
  pdfFileId: string | null;
  currentStep: number;
  status: string;
  userName: string | null;
  brandStandsFor: string | null;
  valuesToExpress: string | null;
  targetEmotions: string | null;
  desiredPerception: string | null;
  primaryTraits: any | null;
  secondaryTraits: any | null;
  traitsToAvoid: any | null;
  emotionalToneRange: string | null;
  traitDescriptions: any | null;
  sentenceStyle: string | null;
  vocabularyPreferences: string | null;
  pacingAndRhythm: string | null;
  useOfMetaphors: string | null;
  degreeOfDirectness: string | null;
  formalityLevel: string | null;
  useOfExamples: string | null;
  useOfEncouragement: string | null;
  dos: any | null;
  donts: any | null;
  supportApproach: string | null;
  challengeApproach: string | null;
  reassuranceApproach: string | null;
  consistentUnderstanding: string | null;
  relationshipPrinciples: string | null;
  scenarios: any | null;
  userSamples: any | null;
  modelParagraphs: any | null;
  approvedSamples: any | null;
  calibrationNotes: any | null;
  refinements: any | null;
  consistencyScore: number | null;
  isCalibrated: boolean;
  finalProfile: string | null;
  isComplete: boolean;
  completedAt: string | null;
  aiKeywords: string | null;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVeraProfileResponse {
  data?: VeraProfile & {
    welcomeMessage?: string;
    nextAction?: string;
    question?: string;
    [key: string]: any;
  };
  message?: string;
  statusCode?: number;
}

export const createVeraProfile = async (
  workspaceId: string,
  name: string
): Promise<CreateVeraProfileResponse> => {
  const endpoint = `${API_BASE_URL}/vera-profiles`;
  const action = 'createVeraProfile';
  logVeraApiEvent('request', action, { endpoint, workspaceId, name });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        workspaceId,
        name,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create Vera profile' }));
      logVeraApiEvent('failure', action, { endpoint, workspaceId, name, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to create Vera profile');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, {
      endpoint,
      workspaceId,
      name,
      status: response.status,
      response: result,
    });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, {
      endpoint,
      workspaceId,
      name,
      error: error?.message || error,
    });
    throw error;
  }
};

export interface GetVeraProfileResponse {
  data?: VeraProfile;
  message?: string;
  statusCode?: number;
}

export const getVeraProfile = async (profileId: string): Promise<GetVeraProfileResponse> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}`;
  const action = 'getVeraProfile';
  logVeraApiEvent('request', action, { endpoint, profileId });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to get Vera profile' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to get Vera profile');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface GetVeraProfilesResponse {
  data?: VeraProfile[];
  message?: string;
  statusCode?: number;
}

export const getVeraProfiles = async (workspaceId: string): Promise<GetVeraProfilesResponse> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/workspace/${workspaceId}`;
  const action = 'getVeraProfiles';
  logVeraApiEvent('request', action, { endpoint, workspaceId });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to get Vera profiles' }));
      logVeraApiEvent('failure', action, { endpoint, workspaceId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to get Vera profiles');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, workspaceId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, workspaceId, error: error?.message || error });
    throw error;
  }
};

export interface SubmitStep1Payload {
  userName: string;
}

export interface SubmitStep1Response {
  data?: {
    message: string;
    nextAction: string;
  };
  message?: string;
  statusCode?: number;
}

export const submitVeraStep1 = async (
  profileId: string,
  payload: SubmitStep1Payload
): Promise<SubmitStep1Response> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step1/welcome`;
  const action = 'submitVeraStep1';
  logVeraApiEvent('request', action, { endpoint, profileId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 1' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to submit Step 1');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface ConfirmReadyResponse {
  data?: {
    message: string;
    nextAction: string;
    questions?: any;
  };
  message?: string;
  statusCode?: number;
}

export const confirmVeraReady = async (profileId: string): Promise<ConfirmReadyResponse> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step1/confirm-ready`;
  const action = 'confirmVeraReady';
  logVeraApiEvent('request', action, { endpoint, profileId });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to confirm ready' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to confirm ready');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface SubmitStep2Payload {
  brandStandsFor: string;
  valuesToExpress: string;
  targetEmotions: string;
  desiredPerception: string;
}

export interface SubmitStep2Response {
  data?: {
    message: string;
    nextAction: string;
  };
  message?: string;
  statusCode?: number;
}

export const submitVeraStep2 = async (
  profileId: string,
  payload: SubmitStep2Payload
): Promise<SubmitStep2Response> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step2/foundation`;
  const action = 'submitVeraStep2';
  logVeraApiEvent('request', action, { endpoint, profileId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 2' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to submit Step 2');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface TraitDefinition {
  trait: string;
  description: string;
}

export interface SubmitStep3Payload {
  primaryTraits: TraitDefinition[];
  secondaryTraits?: TraitDefinition[];
  traitsToAvoid?: string[];
  emotionalToneRange?: string;
}

export interface SubmitStep3Response {
  data?: {
    message: string;
    nextAction: string;
    refinedDescriptions?: any;
  };
  message?: string;
  statusCode?: number;
}

export const submitVeraStep3 = async (
  profileId: string,
  payload: SubmitStep3Payload
): Promise<SubmitStep3Response> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step3/personality`;
  const action = 'submitVeraStep3';
  logVeraApiEvent('request', action, { endpoint, profileId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 3' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to submit Step 3');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface SubmitStep4Payload {
  sentenceStyle: string;
  vocabularyPreferences: string;
  pacingAndRhythm: string;
  useOfMetaphors: string;
  degreeOfDirectness: string;
  formalityLevel: string;
  useOfExamples: string;
  useOfEncouragement: string;
}

export interface SubmitStep4Response {
  data?: {
    message: string;
    nextAction: string;
  };
  message?: string;
  statusCode?: number;
}

export const submitVeraStep4 = async (
  profileId: string,
  payload: SubmitStep4Payload
): Promise<SubmitStep4Response> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step4/style`;
  const action = 'submitVeraStep4';
  logVeraApiEvent('request', action, { endpoint, profileId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 4' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to submit Step 4');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface SubmitStep5Payload {
  dos: string[];
  donts: string[];
}

export interface SubmitStep5Response {
  data?: {
    message: string;
    nextAction: string;
  };
  message?: string;
  statusCode?: number;
}

export const submitVeraStep5 = async (
  profileId: string,
  payload: SubmitStep5Payload
): Promise<SubmitStep5Response> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step5/dos-donts`;
  const action = 'submitVeraStep5';
  logVeraApiEvent('request', action, { endpoint, profileId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 5' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to submit Step 5');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface SubmitStep6Payload {
  supportApproach: string;
  challengeApproach: string;
  reassuranceApproach: string;
  consistentUnderstanding: string;
}

export interface SubmitStep6Response {
  data?: {
    message: string;
    nextAction: string;
    relationshipPrinciples?: string;
  };
  message?: string;
  statusCode?: number;
}

export const submitVeraStep6 = async (
  profileId: string,
  payload: SubmitStep6Payload
): Promise<SubmitStep6Response> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step6/relationship`;
  const action = 'submitVeraStep6';
  logVeraApiEvent('request', action, { endpoint, profileId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 6' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to submit Step 6');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface SubmitStep7Payload {
  educationalContent: string;
  socialMediaPosts: string;
  salesMessaging: string;
  coachingInteractions: string;
  problemResolution: string;
  onboardingCommunication: string;
}

export interface SubmitStep7Response {
  data?: {
    message: string;
    nextAction: string;
  };
  message?: string;
  statusCode?: number;
}

export const submitVeraStep7 = async (
  profileId: string,
  payload: SubmitStep7Payload
): Promise<SubmitStep7Response> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step7/scenarios`;
  const action = 'submitVeraStep7';
  logVeraApiEvent('request', action, { endpoint, profileId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 7' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to submit Step 7');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface SubmitStep8Payload {
  userSamples: string[];
  approvedSamples?: string[];
}

export interface SubmitStep8Response {
  data?: {
    message: string;
    nextAction: string;
    modelParagraphs?: string[];
  };
  message?: string;
  statusCode?: number;
}

export const submitVeraStep8 = async (
  profileId: string,
  payload: SubmitStep8Payload
): Promise<SubmitStep8Response> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step8/samples`;
  const action = 'submitVeraStep8';
  logVeraApiEvent('request', action, { endpoint, profileId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 8' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to submit Step 8');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface SubmitStep9Payload {
  refinements?: Record<string, string>;
  isCalibrated?: boolean;
}

export interface SubmitStep9Response {
  data?: {
    message: string;
    nextAction: string;
    consistencyScore?: number;
    calibrationNotes?: string[];
  };
  message?: string;
  statusCode?: number;
}

export const submitVeraStep9 = async (
  profileId: string,
  payload: SubmitStep9Payload
): Promise<SubmitStep9Response> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step9/calibrate`;
  const action = 'submitVeraStep9';
  logVeraApiEvent('request', action, { endpoint, profileId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 9' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to submit Step 9');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

export interface SubmitStep10Payload {
  approve?: boolean;
}

export interface SubmitStep10Response {
  data?: {
    message: string;
    finalProfile?: string;
  };
  message?: string;
  statusCode?: number;
}

export const submitVeraStep10 = async (
  profileId: string,
  payload: SubmitStep10Payload = {}
): Promise<SubmitStep10Response> => {
  const endpoint = `${API_BASE_URL}/vera-profiles/${profileId}/step10/finalize`;
  const action = 'submitVeraStep10';
  logVeraApiEvent('request', action, { endpoint, profileId, payload });

  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to finalize profile' }));
      logVeraApiEvent('failure', action, { endpoint, profileId, status: response.status, error: errorData });
      throw new Error(errorData.message || 'Failed to finalize profile');
    }

    const result = await response.json();
    logVeraApiEvent('success', action, { endpoint, profileId, status: response.status });
    return result;
  } catch (error: any) {
    logVeraApiEvent('failure', action, { endpoint, profileId, error: error?.message || error });
    throw error;
  }
};

