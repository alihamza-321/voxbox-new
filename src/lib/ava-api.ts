// AVA Session API Service
import { API_BASE_URL } from '@/config/api.config';
import { AuthService } from './auth';

export interface CreateSessionRequest {
  workspaceId: string;
  sessionName?: string;
}

export interface CreateSessionResponse {
  id?: string;
  sessionId?: string; // Backend may return sessionId instead of id
  workspaceId: string;
  userId: string;
  sessionName: string;
  userName?: string; // User's name after submission
  status: string;
  currentPhase: string;
  currentSectionId?: string;
  currentQuestionIndex: number;
  createdAt: string;
  updatedAt: string;
  message?: string | string[]; // HTML-formatted intro message(s) from backend - can be single string or array of HTML strings
  phase?: string;
  resuming?: boolean;
}

export interface UpdateNameRequest {
  name: string;
}

export interface SubmitAnswerRequest {
  answer: string;
}

export interface SubmitAnswerResponse {
  success: boolean;
  currentQuestionIndex?: number;
  isPhaseComplete?: boolean;
  message?: string;
  totalAnswers?: number;
  phase2AutoStarted?: boolean;
  nextAction?: string;
}

export interface Phase1Question {
  id: string;
  sectionId: string;
  sectionTitle: string;
  text: string;
  videoUrl?: string;
}

export interface Phase1QuestionResponse {
  question: Phase1Question;
  examples: string[];
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
}

export interface StartPhase1Response {
  question: Phase1Question;
  examples: string[];
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
}

export interface SubmitNameResponse {
  message: string | string[]; // Can be single string or array of HTML strings
  videoUrl?: string;
  nextAction: string;
}

// Note: All API calls now use AuthService.makeAuthenticatedRequest for automatic token refresh
// The getAuthToken function is no longer needed, but kept for backward compatibility if needed

// Create AVA Session
export const createAvaSession = async (
  workspaceId: string,
  sessionName?: string
): Promise<CreateSessionResponse> => {
  console.log('🔐 AVA API Debug:');
  console.log('- Workspace ID:', workspaceId);
  console.log('- API URL:', `${API_BASE_URL}/ava-sessions`);

  if (!workspaceId) {
    throw new Error('No workspace selected');
  }

  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions`,
    {
      method: 'POST',
      body: JSON.stringify({
        workspaceId,
        sessionName: sessionName || 'AVA Ideal Client Profile',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create session' }));
    console.error('❌ AVA API Error:', error);
    throw new Error(error.message || 'Failed to create AVA session');
  }

  const result = await response.json();
  console.log('✅ AVA Session Created, full response:', result);
  console.log('✅ Response data.message type:', typeof result.data?.message, Array.isArray(result.data?.message) ? 'array' : typeof result.data?.message);
  
  // Backend returns { data: { sessionId: "...", message: [...], ... } }
  // But our interface expects { id: "...", ... }
  const sessionData = result.data || result;
  
  // Map sessionId to id for compatibility
  if (sessionData.sessionId && !sessionData.id) {
    sessionData.id = sessionData.sessionId;
  }
  
  // Preserve the message field from the response (can be string or array of strings)
  if (result.data?.message !== undefined) {
    sessionData.message = result.data.message;
    console.log('✅ Extracted message from result.data.message:', Array.isArray(sessionData.message) ? `array of ${sessionData.message.length} items` : 'string');
  } else if (result.message !== undefined) {
    sessionData.message = result.message;
    console.log('✅ Extracted message from result.message:', Array.isArray(sessionData.message) ? `array of ${sessionData.message.length} items` : 'string');
  }
  
  console.log('✅ Mapped session data:', sessionData);
  console.log('✅ Final sessionData.message:', sessionData.message);
  return sessionData;
};

// Update Session Name (when user provides their name)
export const updateSessionName = async (
  sessionId: string,
  name: string
): Promise<SubmitNameResponse> => {
  console.log('📡 updateSessionName API call:', {
    url: `${API_BASE_URL}/ava-sessions/${sessionId}/name`,
    method: 'POST',
    body: { name }
  });
  
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/name`,
    {
      method: 'POST',
      body: JSON.stringify({ name }),
    }
  );

  console.log('📡 updateSessionName response status:', response.status, response.ok);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ updateSessionName API error response:', errorText);
    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = { message: errorText || 'Failed to update name' };
    }
    throw new Error(error.message || error.error || 'Failed to update session name');
  }

  const result = await response.json();
  console.log('✅ updateSessionName API success, full response:', result);
  const responseData = result.data || result;
  console.log('✅ updateSessionName extracted data:', responseData);
  return responseData;
};

// Start Phase 1
export const startPhase1 = async (sessionId: string): Promise<StartPhase1Response> => {
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/start-phase1`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to start phase 1' }));
    throw new Error(error.message || 'Failed to start Phase 1');
  }

  const result = await response.json();
  return result.data || result;
};

// Submit Answer - Returns next question or completion status
export const submitAnswer = async (
  sessionId: string,
  answer: string
): Promise<{
  success?: boolean;
  completed?: boolean;
  isPhaseComplete?: boolean;
  phase2AutoStarted?: boolean;
  currentQuestionIndex?: number;
  totalAnswers?: number;
  message?: string;
  videoUrl?: string;
  nextAction?: string;
  question?: Phase1Question;
  examples?: string[];
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  motivationalMessage?: string;
}> => {
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/answer`,
    {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to submit answer' }));
    throw new Error(error.message || 'Failed to submit answer');
  }

  const result = await response.json();
  // Backend wraps response in a 'data' object
  const answerData = result.data || result;
  return answerData;
};

// Get Session Details (optional - for resuming sessions)
export const getSessionDetails = async (sessionId: string): Promise<CreateSessionResponse> => {
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to get session' }));
    throw new Error(error.message || 'Failed to get session details');
  }

  const result = await response.json();
  const data = result?.data || result;
  if (data.sessionId && !data.id) data.id = data.sessionId;
  return data;
};

// Get Phase 1 answers from backend
export const getPhase1Answers = async (sessionId: string): Promise<Array<{
  questionId: string;
  sectionId: string;
  sectionTitle?: string;
  questionText: string;
  answer: string;
}>> => {
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/phase1-answers`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to get Phase 1 answers' }));
    throw new Error(error.message || 'Failed to retrieve Phase 1 answers');
  }

  const result = await response.json();
  const data = result?.data || result;
  if (!Array.isArray(data)) {
    console.warn('⚠️ Unexpected getPhase1Answers response shape:', data);
    return [];
  }
  return data.map((r: any) => ({
    questionId: r.questionId || r.question_id || r.id,
    sectionId: r.sectionId || r.section_id,
    sectionTitle: r.sectionTitle || r.section_title || undefined,
    questionText: r.questionText || r.question_text,
    answer: r.answer || r.userAnswer || r.user_answer || '',
  }));
};

// Sync Phase 1 Answers - ensure all local answers are saved to backend
export const syncPhase1Answers = async (
  sessionId: string,
  phase1Answers: Array<{ questionId: string; answer: string }>
): Promise<void> => {
  console.log('🔄 Syncing Phase 1 answers to backend...', {
    sessionId,
    answersCount: phase1Answers.length,
  });

  // Get current session to check what's already saved
  try {
    await getSessionDetails(sessionId);
    console.log('✅ Got session details for sync');
  } catch (error) {
    console.warn('⚠️ Could not get session details for sync:', error);
  }

  // Note: Individual answer syncing would require a batch endpoint
  // For now, we'll rely on submitAnswer being called for each answer
  // This function is mainly for validation/checking
  console.log('✅ Phase 1 answers sync check complete');
};

// Start Phase 2
export const startPhase2 = async (sessionId: string): Promise<any> => {
  // Use AuthService for automatic token refresh on 401
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/start-phase2`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to start phase 2' }));
    throw new Error(error.message || 'Failed to start Phase 2');
  }

  return response.json();
};

// Generate Section
export const generateSection = async (sessionId: string, sectionNumber: number, retryCount = 0): Promise<any> => {
  const maxRetries = 3;

  try {
    // Use AuthService for automatic token refresh on 401
    const response = await AuthService.makeAuthenticatedRequest(
      `${API_BASE_URL}/ava-sessions/${sessionId}/generate-section/${sectionNumber}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `Server returned ${response.status} ${response.statusText}` };
      }
      
      // Retry on 429 (quota) and 500 errors
      if (response.status === 429 && retryCount < maxRetries) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryDelayMs = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : (errorData?.retryDelay ? parseInt(String(errorData.retryDelay)) * 1000 : 30000);
        console.log(`⏳ Quota hit (429). Retrying section ${sectionNumber} in ${Math.round(retryDelayMs/1000)}s... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        return generateSection(sessionId, sectionNumber, retryCount + 1);
      }

      if (response.status === 500 && retryCount < maxRetries) {
        console.log(`⚠️ Section ${sectionNumber} generation failed (500), retrying... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return generateSection(sessionId, sectionNumber, retryCount + 1);
      }
      
      const errorMessage = errorData.message || errorData.error || `Failed to generate section ${sectionNumber}`;
      console.error(`❌ Generate Section Error (${response.status}):`, {
        sessionId,
        sectionNumber,
        error: errorMessage,
        fullError: errorData,
      });
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log(`✅ Section ${sectionNumber} generated successfully:`, result);
    return result;
  } catch (error: any) {
    console.error(`❌ Generate Section Exception:`, {
      sessionId,
      sectionNumber,
      error: error.message,
      stack: error.stack,
    });
    
    // If it's not already an Error we created, wrap it
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(error.message || 'Failed to generate section');
  }
};

// Get Section Status
export const getSectionStatus = async (sessionId: string, sectionNumber: number): Promise<any> => {
  // Use AuthService for automatic token refresh on 401
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/section/${sectionNumber}/status`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to get section status' }));
    throw new Error(error.message || 'Failed to get section status');
  }

  return response.json();
};

// Update Section Response
export const updateSectionResponse = async (
  sessionId: string,
  sectionNumber: number,
  responseId: string,
  editedAnswer: string
): Promise<any> => {
  // Use AuthService for automatic token refresh on 401
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/section/${sectionNumber}/response/${responseId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ editedAnswer }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update response' }));
    throw new Error(error.message || 'Failed to update section response');
  }

  return response.json();
};

// Confirm a single question/response within a section (gracefully degrades if endpoint not available)
export const confirmSectionResponse = async (
  sessionId: string,
  _sectionNumber: number, // Included for API consistency, not used in endpoint
  responseId: string
): Promise<{
  completed?: boolean;
  sectionCompleted?: boolean;
  nextQuestion?: number;
  nextSection?: number;
  nextAction?: string;
  message?: string;
}> => {
  // Use AuthService for automatic token refresh on 401 to prevent redirects during confirmation
  try {
    const response = await AuthService.makeAuthenticatedRequest(
      `${API_BASE_URL}/ava-sessions/${sessionId}/confirm-phase2-question/${responseId}`,
      {
        method: 'POST',
      }
    );

    // Handle 404 - response not found
    if (response.status === 404) {
      console.error('❌ Response not found:', responseId);
      throw new Error('Response not found. Please try refreshing the page.');
    }

    // Handle other errors
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to confirm response' }));
      console.error('⚠️ Confirm endpoint returned error:', error);
      throw new Error(error.message || 'Failed to confirm response');
    }

    // Success case
    const result = await response.json();
    console.log('✅ Question confirmed:', result);
    return result?.data || result || {};
  } catch (err: any) {
    console.error('❌ Error confirming question:', err);
    // Don't let auth errors redirect - throw the error so the UI can handle it gracefully
    throw err;
  }
};

// Confirm Section
export const confirmSection = async (sessionId: string, sectionNumber: number): Promise<any> => {
  // Use AuthService for automatic token refresh on 401
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/confirm-section/${sectionNumber}`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to confirm section' }));
    throw new Error(error.message || 'Failed to confirm section');
  }

  return response.json();
};

// Export Profile as PDF
export const exportProfilePDF = async (sessionId: string): Promise<Blob> => {
  // Use AuthService for automatic token refresh on 401
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/export/pdf`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to export PDF' }));
    throw new Error(error.message || 'Failed to export profile as PDF');
  }

  return response.blob();
};

// Regenerate specific question in Phase 2
export const regeneratePhase2Question = async (
  sessionId: string,
  responseId: string
): Promise<any> => {
  // Use AuthService for automatic token refresh on 401
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/regenerate-phase2-question/${responseId}`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to regenerate question' }));
    throw new Error(error.message || 'Failed to regenerate question');
  }

  return response.json();
};

// Cancel an active session
export const cancelAvaSession = async (sessionId: string): Promise<any> => {
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/cancel`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to cancel session' }));
    throw new Error(error.message || 'Failed to cancel session');
  }

  return response.json();
};

// Save Phase 2 progress (current section and question index)
export const savePhase2Progress = async (
  sessionId: string,
  sectionNumber: number,
  questionIndex: number
): Promise<any> => {
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/phase2-progress`,
    {
      method: 'POST',
      body: JSON.stringify({ sectionNumber, questionIndex }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to save Phase 2 progress' }));
    throw new Error(error.message || 'Failed to save Phase 2 progress');
  }

  return response.json();
};

// Get Phase 2 progress state (for restoration)
export const getPhase2Progress = async (sessionId: string): Promise<any> => {
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/phase2-progress`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    // If not in Phase 2, return null (not an error)
    if (response.status === 400 || response.status === 404) {
      return null;
    }
    const error = await response.json().catch(() => ({ message: 'Failed to get Phase 2 progress' }));
    throw new Error(error.message || 'Failed to get Phase 2 progress');
  }

  const result = await response.json();
  return result?.data || result;
};

// List workspace sessions (active, completed, cancelled)
export interface WorkspaceSession {
  id: string;
  sessionName: string;
  status: string;
  currentPhase: string;
  createdAt: string;
  completedAt: string | null;
  userName: string;
}

export interface WorkspaceSessionsResponse {
  active: WorkspaceSession[];
  completed: WorkspaceSession[];
  cancelled: WorkspaceSession[];
  total: number;
}

export const listWorkspaceSessions = async (workspaceId: string): Promise<WorkspaceSessionsResponse> => {
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/workspace/${workspaceId}`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to get workspace sessions' }));
    throw new Error(error.message || 'Failed to get workspace sessions');
  }

  const result = await response.json();
  return result?.data || result;
};

// Save conversation history to backend
export const saveConversationHistory = async (
  sessionId: string,
  messages: any[]
): Promise<{ success: boolean; messageCount: number }> => {
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/conversation-history`,
    {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to save conversation history' }));
    throw new Error(error.message || 'Failed to save conversation history');
  }

  const result = await response.json();
  return result?.data || result;
};

// Get conversation history from backend
export const getConversationHistory = async (
  sessionId: string
): Promise<{ messages: any[] }> => {
  const response = await AuthService.makeAuthenticatedRequest(
    `${API_BASE_URL}/ava-sessions/${sessionId}/conversation-history`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    // If not found, return empty messages array
    if (response.status === 404) {
      return { messages: [] };
    }
    const error = await response.json().catch(() => ({ message: 'Failed to get conversation history' }));
    throw new Error(error.message || 'Failed to get conversation history');
  }

  const result = await response.json();
  return result?.data || result;
};

