import { API_BASE_URL } from '@/config/api.config';
import { AuthService } from './auth';

// Product Refiner Session type matching backend DTO
export interface ProductRefinerSession {
  id: string;
  workspaceId: string;
  userId: string;
  sessionName: string | null;
  userName: string | null;
  welcomeMessage?: string | null;
  question?: string | null;
  currentStep: number;
  status: string;
  version: number;
  nextAction?: string | null;
  message?: string | null;
  step1Completed: boolean;
  step2Completed: boolean;
  step2Product: string | null;
  step2TargetAudience: string | null;
  step2Problem: string | null;
  step2Features: string | null;
  step2Delivery: string | null;
  step2Pricing: string | null;
  step3Completed: boolean;
  step3Assessment: any | null;
  step4Completed: boolean;
  step4CorePromise: string | null;
  step4FinalPromise: string | null;
  step5Completed: boolean;
  step5Outcomes: any | null;
  step6Completed: boolean;
  step6FeatureBenefitTable: any | null;
  step7Completed: boolean;
  step7ValueStack: any | null;
  step8Completed: boolean;
  step8ProofElements: any | null;
  step9Completed: boolean;
  step9Pricing: any | null;
  step10Completed: boolean;
  step10FinalSpecification: string | null;
  completedAt: string | Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// List workspace sessions
export const listProductRefinerSessions = async (workspaceId: string): Promise<ProductRefinerSession[]> => {
  const endpoint = `${API_BASE_URL}/product-refiner/workspace/${workspaceId}`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to load Product Refiner sessions' }));
      throw new Error(errorData.message || 'Failed to load Product Refiner sessions');
    }

    const result = await response.json();
    return result?.data || result || [];
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to load Product Refiner sessions';
    throw new Error(message);
  }
};

// Create session
export const createProductRefinerSession = async (
  workspaceId: string,
  sessionName?: string
): Promise<{ data: ProductRefinerSession }> => {
  const endpoint = `${API_BASE_URL}/product-refiner`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        workspaceId,
        sessionName: sessionName || 'My Product Refinement',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create Product Refiner session' }));
      throw new Error(errorData.message || 'Failed to create Product Refiner session');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to create Product Refiner session';
    throw new Error(message);
  }
};

// Submit Step 1 Name
export const submitStep1Name = async (
  sessionId: string,
  payload: { userName: string }
): Promise<{ data: ProductRefinerSession; message?: string; nextAction?: string }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/step1`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 1' }));
      throw new Error(errorData.message || 'Failed to submit Step 1');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to submit Step 1';
    throw new Error(message);
  }
};

// Confirm Ready
export const confirmReady = async (
  sessionId: string,
  payload: { message: string }
): Promise<{ data: ProductRefinerSession }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/ready`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to confirm readiness' }));
      throw new Error(errorData.message || 'Failed to confirm readiness');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to confirm readiness';
    throw new Error(message);
  }
};

// Submit Step 2 Intake
export interface Step2IntakeData {
  product: string;
  targetAudience: string;
  problem: string;
  features: string;
  delivery: string;
  pricing: string;
}

export const submitStep2Intake = async (
  sessionId: string,
  payload: Step2IntakeData
): Promise<{ data: ProductRefinerSession }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/step2`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 2' }));
      throw new Error(errorData.message || 'Failed to submit Step 2');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to submit Step 2';
    throw new Error(message);
  }
};

// Generate Assessment (Step 3)
export const generateAssessment = async (
  sessionId: string
): Promise<{ data: ProductRefinerSession; assessment: any }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/step3/assess`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to generate assessment' }));
      throw new Error(errorData.message || 'Failed to generate assessment');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to generate assessment';
    throw new Error(message);
  }
};

// Submit Step 4 Promise
export interface Step4PromiseData {
  corePromise: string;
  finalPromise?: string;
}

export const submitStep4Promise = async (
  sessionId: string,
  payload: Step4PromiseData
): Promise<{ data: ProductRefinerSession; suggestion?: string }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/step4`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 4' }));
      throw new Error(errorData.message || 'Failed to submit Step 4');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to submit Step 4';
    throw new Error(message);
  }
};

// Submit Step 5 Outcomes
export interface OutcomeItem {
  outcome: string;
  change: string;
  whyItMatters: string;
  howProductProduces: string;
}

export const submitStep5Outcomes = async (
  sessionId: string,
  payload: { outcomes: OutcomeItem[] }
): Promise<{ data: ProductRefinerSession }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/step5`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 5' }));
      throw new Error(errorData.message || 'Failed to submit Step 5');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to submit Step 5';
    throw new Error(message);
  }
};

// Submit Step 6 Feature Benefit
export interface FeatureBenefitItem {
  feature: string;
  benefit: string;
  emotionalBenefit?: string;
}

export const submitStep6FeatureBenefit = async (
  sessionId: string,
  payload: { featureBenefitTable: FeatureBenefitItem[] }
): Promise<{ data: ProductRefinerSession }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/step6`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 6' }));
      throw new Error(errorData.message || 'Failed to submit Step 6');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to submit Step 6';
    throw new Error(message);
  }
};

// Submit Step 7 Value Stack
export interface ValueStackData {
  components: string[];
  bonuses: string[];
  supportElements: string[];
  logistics: string;
}

export const submitStep7ValueStack = async (
  sessionId: string,
  payload: { valueStack: ValueStackData }
): Promise<{ data: ProductRefinerSession }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/step7`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 7' }));
      throw new Error(errorData.message || 'Failed to submit Step 7');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to submit Step 7';
    throw new Error(message);
  }
};

// Submit Step 8 Proof Elements
export interface ProofElement {
  type: string;
  description: string;
  url?: string;
}

export const submitStep8ProofElements = async (
  sessionId: string,
  payload: { proofElements: ProofElement[]; notes?: string }
): Promise<{ data: ProductRefinerSession; missingProof?: unknown[] }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/step8`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 8' }));
      throw new Error(errorData.message || 'Failed to submit Step 8');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to submit Step 8';
    throw new Error(message);
  }
};

// Submit Step 9 Pricing
export interface PricingPlan {
  name: string;
  price: number;
  description: string;
}

export interface PricingTier {
  name: string;
  price: number;
  features: string[];
}

export const submitStep9Pricing = async (
  sessionId: string,
  payload: {
    standardPrice?: number;
    standardPriceDescription?: string;
    paymentPlans: PricingPlan[];
    tiers: PricingTier[];
    pricingNarrative?: string;
  }
): Promise<{ data: ProductRefinerSession; pricingNarrative?: { narrative?: string; justification?: string; recommendations?: string } }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/step9`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to submit Step 9' }));
      throw new Error(errorData.message || 'Failed to submit Step 9');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to submit Step 9';
    throw new Error(message);
  }
};

// Generate Final Specification (Step 10)
export const generateFinalSpecification = async (
  sessionId: string
): Promise<{ data: ProductRefinerSession; finalSpecification: string }> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/step10`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to generate final specification' }));
      throw new Error(errorData.message || 'Failed to generate final specification');
    }

    return await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to generate final specification';
    throw new Error(message);
  }
};

// Delete session
export const deleteProductRefinerSession = async (sessionId: string): Promise<void> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to delete session' }));
      throw new Error(errorData.message || 'Failed to delete session');
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to delete session';
    throw new Error(message);
  }
};

// Export PDF
export const exportProductRefinerPDF = async (sessionId: string): Promise<Blob> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/export/pdf`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to export PDF' }));
      throw new Error(errorData.message || 'Failed to export PDF');
    }

    return await response.blob();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to export PDF';
    throw new Error(message);
  }
};

// Export DOCX
export const exportProductRefinerDOCX = async (sessionId: string): Promise<Blob> => {
  const endpoint = `${API_BASE_URL}/product-refiner/${sessionId}/export/docx`;
  
  try {
    const response = await AuthService.makeAuthenticatedRequest(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to export DOCX' }));
      throw new Error(errorData.message || 'Failed to export DOCX');
    }

    return await response.blob();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to export DOCX';
    throw new Error(message);
  }
};

