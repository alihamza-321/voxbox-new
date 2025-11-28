import { useState, useEffect, useRef } from "react";
import { FastForward, PlayCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AVAMessage } from "./AVAMessage";
import { AVATypingIndicator } from "./AVATypingIndicator";
import { AVAChatInput } from "./AVAChatInput";
import { AVAHeader } from "./AVAHeader";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import type { ChatMessage, AVAChatSession } from "@/lib/ava-chat-types";
import { createNewChatSession } from "@/lib/ava-chat-types";
import { startPhase1, submitAnswer, createAvaSession } from "@/lib/ava-api";
import { API_BASE_URL } from "@/config/api.config";
import avaAvatar from "@/assets/ava-avatar.png";
import { AVA_DEFAULT_INTRO_VIDEO_URL, buildAvaFallbackIntroMessages } from "@/constants/ava";

interface Video {
  title: string;
  url: string;
  thumbnail?: string;
  description?: string;
}

const phase1HelpVideos: Video[] = [
  {
    title: "How to Answer Phase 1 Questions",
    description: "Learn the best approach to answering questions for maximum insight",
    url: "",
    thumbnail: ""
  },
  {
    title: "Understanding Your Ideal Client",
    description: "Deep dive into client psychology and what really matters",
    url: "",
    thumbnail: ""
  }
];

const phase1HelpText = `Answer each question thinking deeply about your ideal client.

Take your time with each response - the more detail you provide, the more accurate your client profile will be.

Tips:
• Be specific and detailed
• Think about real examples
• Consider emotional motivations
• Focus on their perspective, not yours

You can skip questions if needed, but more answers = better results.`;

interface AVAChatInterfaceProps {
  session: AVAChatSession;
  onUpdateSession: (session: AVAChatSession) => void;
  onError?: (error: string) => void;
}

export const AVAChatInterface = ({ session, onUpdateSession, onError }: AVAChatInterfaceProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);
  const shouldRetriggerNameSubmit = useRef<string | null>(null);

  // Ensure name collection stage is active in chat mode
  useEffect(() => {
    if (session.currentStage === "welcome" && !session.userName) {
      onUpdateSession({ ...session, currentStage: "name-collection" });
    }
    
    // Check if name submission was in progress when page was refreshed
    const nameSubmissionInProgress = sessionStorage.getItem('name-submission-in-progress');
    const storedName = sessionStorage.getItem('name-submission-stored-name');
    
    if (nameSubmissionInProgress === 'true' && storedName) {
      console.log('🔄 Page was refreshed during name submission - will re-trigger API from start');
      // Clear the state flags but keep stored name and messages for re-trigger
      sessionStorage.removeItem('name-submission-in-progress');
      sessionStorage.removeItem('name-submission-messages-total');
      sessionStorage.removeItem('name-submission-messages-displayed');
      
      // Reset to name collection stage
      if (session.currentStage === "phase1-intro") {
        onUpdateSession({ ...session, currentStage: "name-collection", userName: "" });
      }
      
      // Clear any partially displayed messages
      updateSession(prev => ({
        ...prev,
        messages: prev.messages.filter(msg => !msg.id?.includes('name-submit'))
      }));
      
      // Set flag to trigger name submission after handleNameSubmit is available
      shouldRetriggerNameSubmit.current = storedName;
    } else if (nameSubmissionInProgress === 'true') {
      // Just clear state if no stored name
      sessionStorage.removeItem('name-submission-in-progress');
      sessionStorage.removeItem('name-submission-messages-total');
      sessionStorage.removeItem('name-submission-messages-displayed');
      sessionStorage.removeItem('name-submission-stored-name');
      sessionStorage.removeItem('name-submission-messages');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Check if we need to retrigger name submission after handleNameSubmit is defined
  useEffect(() => {
    if (shouldRetriggerNameSubmit.current) {
      const nameToSubmit = shouldRetriggerNameSubmit.current;
      shouldRetriggerNameSubmit.current = null;
      console.log('🔄 Retriggering name submission API with stored name:', nameToSubmit);
      // Use a small delay to ensure component is fully mounted and state is reset
      setTimeout(() => {
        handleNameSubmit(nameToSubmit);
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages, isTyping]);

  // Centralized updater that keeps ref in sync to avoid race conditions
  const updateSession = (updater: (prev: AVAChatSession) => AVAChatSession) => {
    const next = updater(sessionRef.current);
    sessionRef.current = next;
    onUpdateSession(next);
  };

  const addMessage = (message: ChatMessage) => {
    updateSession(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  };

  const addAVAMessage = async (content: string, metadata?: any, delay: number = 1500) => {
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, delay));
    setIsTyping(false);
    
    addMessage({
      id: `msg-${Date.now()}-${Math.random()}`,
      role: "ava",
      type: "text",
      content,
      timestamp: new Date(),
      metadata,
    });
  };

  // Ensure Phase 1 is started on backend when stage changes to phase1
  useEffect(() => {
    const ensurePhase1Started = async () => {
      const s = sessionRef.current;
      if (s.currentStage !== "phase1") return;
      if (!s.backendSessionId) return;

      // Check if we've already verified Phase 1 is started
      const phase1StartedKey = `phase1-started-${s.backendSessionId}`;
      if (sessionStorage.getItem(phase1StartedKey) === 'true') {
        console.log('✅ Phase 1 already verified as started');
        return;
      }

      console.log('🔍 Verifying Phase 1 is started on backend...');
      try {
        await startPhase1(s.backendSessionId);
        sessionStorage.setItem(phase1StartedKey, 'true');
        console.log('✅ Phase 1 confirmed started on backend');
      } catch (error: any) {
        console.error('❌ Failed to start Phase 1 on backend:', error);
        // Don't block UI, but log the error
        if (error.message?.includes('already started')) {
          sessionStorage.setItem(phase1StartedKey, 'true');
          console.log('⚠️ Phase 1 already started (backend confirmation)');
        }
      }
    };

    ensurePhase1Started();
  }, [session.currentStage, session.backendSessionId]);

  // Load current question when in phase1 (guarded against duplicate inserts)
  useEffect(() => {
    const loadQuestion = async () => {
      const s = sessionRef.current;
      if (s.currentStage !== "phase1") return;
      
      const currentQ = s.phase1Progress.currentQuestionIndex;
      
      // Validate currentQ
      if (currentQ < 0) {
        console.warn('⚠️ Invalid question index:', currentQ);
        return;
      }
      
      // Phase 1 questions are stored and managed by the backend
      // Backend returns questions via getPhase1Answers API
      // We trust the backend to track progress via currentQuestionIndex
      const TOTAL_PHASE1_QUESTIONS = 27;
      
      // Validate bounds
      if (currentQ >= TOTAL_PHASE1_QUESTIONS) {
        console.log('✅ All questions completed');
        return;
      }
      
      const questionId = `q-${currentQ}`;
      
      // Check if this question is already in messages (use latest ref to avoid stale closure)
      const hasQuestion = s.messages.some(m => m.metadata?.questionId === questionId);
      if (hasQuestion) return;

      // Backend will provide question text via getPhase1Answers
      // For now, show a generic message prompting user to answer
      const questionText = `Question ${currentQ + 1}/${TOTAL_PHASE1_QUESTIONS}: Please provide your answer below.`;
      
      await addAVAMessage(
        questionText,
        {
          questionId,
          badge: `Question ${currentQ + 1}/${TOTAL_PHASE1_QUESTIONS}`,
        },
        currentQ === 0 ? 500 : 900
      );
    };

    loadQuestion();
  }, [session.currentStage, session.phase1Progress.currentQuestionIndex]);

  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const base = sessionRef.current;
    console.log('📝 handleSubmit - current backendSessionId:', base.backendSessionId);

    // Append user message and optionally advance stage in a single atomic update
    updateSession(prev => {
      const withMsg = {
        ...prev,
        backendSessionId: prev.backendSessionId, // PRESERVE backendSessionId
        messages: [
          ...prev.messages,
          {
            id: `msg-${Date.now()}`,
            role: "user",
            type: "text",
            content: trimmed,
            timestamp: new Date(),
          } as ChatMessage,
        ],
      };

      if (prev.currentStage === "welcome" || prev.currentStage === "name-collection") {
        return { 
          ...withMsg, 
          backendSessionId: prev.backendSessionId, // PRESERVE backendSessionId
          userName: trimmed, 
          currentStage: "phase1-intro" 
        } as AVAChatSession;
      }

      return withMsg as AVAChatSession;
    });

    setInputValue("");

    // Continue flow after the state is atomically updated
    if (base.currentStage === "welcome" || base.currentStage === "name-collection") {
      await handleNameSubmit(trimmed);
    } else if (base.currentStage === "phase1-intro") {
      updateSession(prev => ({ ...prev, backendSessionId: prev.backendSessionId, currentStage: "phase1" }));
    } else if (base.currentStage === "phase1") {
      await handlePhase1Answer(trimmed);
    }
  };

  const handleNameSubmit = async (name: string) => {
    try {
      // Check if name submission was in progress when page was refreshed
      const nameSubmissionInProgress = sessionStorage.getItem('name-submission-in-progress');
      if (nameSubmissionInProgress === 'true') {
        console.log('🔄 Page was refreshed during name submission - clearing state to allow resubmission');
        sessionStorage.removeItem('name-submission-in-progress');
        // Clear any partially displayed messages
        updateSession(prev => ({
          ...prev,
          messages: prev.messages.filter(msg => !msg.id?.includes('name-submit'))
        }));
      }
      
      // Mark that name submission is in progress and store the name
      sessionStorage.setItem('name-submission-in-progress', 'true');
      sessionStorage.setItem('name-submission-stored-name', name);
      
      // Clear retrigger flag if this was a retrigger
      if (shouldRetriggerNameSubmit.current === name) {
        shouldRetriggerNameSubmit.current = null;
      }
      
      // Get or create backend session ID
      let backendSessionId = sessionRef.current.backendSessionId;
      console.log('📝 handleNameSubmit - initial backendSessionId:', backendSessionId);
      
      // If no backend session exists, try to create one
      if (!backendSessionId) {
        console.log('⚠️ No backend session found, attempting to create one...');
        try {
          // Try to get workspace ID from localStorage or context
          const workspaceStr = localStorage.getItem('currentWorkspace');
          const workspaceId = workspaceStr ? JSON.parse(workspaceStr)?.id : null;
          
          if (workspaceId) {
            console.log('🔨 Creating backend session with workspace:', workspaceId);
            const newBackendSession = await createAvaSession(workspaceId, `AVA Profile - ${name}`);
            // Handle both id and sessionId formats from backend
            backendSessionId = newBackendSession.id || newBackendSession.sessionId;
            console.log('✅ Created backend session:', backendSessionId);
            
            // Update the session with the new backend ID
            updateSession(prev => ({
              ...prev,
              backendSessionId: backendSessionId
            }));
          } else {
            console.warn('⚠️ No workspace ID found, proceeding without backend');
          }
        } catch (error) {
          console.error('❌ Failed to create backend session:', error);
        }
      }
      
      // Call backend API to update session name if we have a session ID
      let responseData = null;
      if (backendSessionId) {
        console.log('📤 Updating backend session name:', backendSessionId);
        const response = await fetch(`${API_BASE_URL}/ava-sessions/${backendSessionId}/name`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({ name }),
        });

        if (response.ok) {
          const result = await response.json();
          responseData = result.data || result;
          console.log('✅ Name updated successfully, response:', responseData);
        }
      }

      // Move to intro and store name - PRESERVE backendSessionId
      console.log('📝 Name submitted - final backendSessionId:', backendSessionId);
      updateSession(prev => ({ 
        ...prev,
        backendSessionId: backendSessionId || prev.backendSessionId, // Use the backendSessionId we just created/found
        userName: name, 
        currentStage: "phase1-intro" as const 
      }));
      
      // Use API response messages if available, otherwise fallback to hardcoded
      let messagesToRender: string[] = [];
      if (responseData?.message && Array.isArray(responseData.message)) {
        // Use messages from API response
        messagesToRender = responseData.message;
        console.log('✅ Using API response messages:', messagesToRender.length);
      } else {
        // Fallback to hardcoded messages (for backward compatibility)
        console.log('⚠️ No API messages, using fallback');
        messagesToRender = buildAvaFallbackIntroMessages(name);
      }
      
      // Store messages for refresh recovery
      sessionStorage.setItem('name-submission-messages', JSON.stringify(messagesToRender));
      sessionStorage.setItem('name-submission-messages-total', String(messagesToRender.length));
      sessionStorage.setItem('name-submission-messages-displayed', '0');
      
      // Wait 2-3 seconds before starting to display chunks
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
      
      // Display messages progressively with delays
      for (let idx = 0; idx < messagesToRender.length; idx++) {
        const msgHtml = messagesToRender[idx];
        
        await addAVAMessage(msgHtml, {}, idx === 0 ? 500 : (idx < messagesToRender.length - 1 ? 800 : 600));
        sessionStorage.setItem('name-submission-messages-displayed', String(idx + 1));
        
        // Small delay between chunks for smooth rendering
        if (idx < messagesToRender.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Show video if available from backend
      const resolvedVideoUrl = responseData?.videoUrl?.trim() || AVA_DEFAULT_INTRO_VIDEO_URL;
      if (resolvedVideoUrl) {
        await addAVAMessage(
          `Before we proceed, please watch this video to understand the process:`,
          {
            videoUrl: resolvedVideoUrl,
            actions: [{
              label: "Watch Video",
              variant: "default" as const,
              actionType: "play-video",
              videoUrl: resolvedVideoUrl,
            }]
          },
          800
        );
      }
      
      await addAVAMessage(
        `Confirm when you are ready to move on.`,
        {},
        600
      );
      
      // Show help resources
      await addAVAMessage(
        `📹 Before we start, I've prepared some help resources for you. Click below if you'd like guidance on how to answer effectively!`,
        {
          actions: [
            {
              label: "📹 Watch Help Videos",
              variant: "ghost" as const,
              actionType: "show-videos",
            },
            {
              label: "💡 View Tips & Guidelines",
              variant: "ghost" as const,
              actionType: "show-help",
            }
          ]
        },
        800
      );
      
      // Mark name submission as complete
      sessionStorage.setItem('name-submission-in-progress', 'false');
      sessionStorage.removeItem('name-submission-messages-total');
      sessionStorage.removeItem('name-submission-messages-displayed');
      sessionStorage.removeItem('name-submission-stored-name');
      sessionStorage.removeItem('name-submission-messages');

      // Call backend API to start Phase 1 - MUST SUCCEED before proceeding
      if (backendSessionId) {
        try {
          console.log('🚀 Starting Phase 1 on backend...');
          await startPhase1(backendSessionId);
          console.log('✅ Phase 1 started successfully on backend');
          
          // Mark as started in sessionStorage
          sessionStorage.setItem(`phase1-started-${backendSessionId}`, 'true');
          
          // Auto-start Phase 1 UI - PRESERVE backendSessionId
          updateSession(prev => ({
            ...prev,
            backendSessionId: prev.backendSessionId, // PRESERVE backendSessionId
            currentStage: "phase1"
          }));
        } catch (error: any) {
          console.error('❌ Failed to start Phase 1 on backend:', error);
          
          // If error says "already started", that's okay - proceed with Phase 1
          if (error.message?.includes('already started') || error.message?.includes('already in phase1') || error.message?.includes('already in phase2')) {
            console.log('⚠️ Phase 1 already started or session in different phase, starting Phase 1 UI anyway...');
            sessionStorage.setItem(`phase1-started-${backendSessionId}`, 'true');
            updateSession(prev => ({
              ...prev,
              backendSessionId: prev.backendSessionId,
              currentStage: "phase1"
            }));
          } else {
            // Real error - show it and don't proceed
            if (onError) {
              onError(error.message || 'Failed to start Phase 1. Please try again.');
            }
            // Clear name submission state on error
            sessionStorage.removeItem('name-submission-in-progress');
            sessionStorage.removeItem('name-submission-messages-total');
            sessionStorage.removeItem('name-submission-messages-displayed');
            sessionStorage.removeItem('name-submission-stored-name');
            return; // Don't change stage if Phase 1 start failed
          }
        }
      } else {
        // No backend session - proceed with local only
        console.warn('⚠️ No backend session, proceeding with local Phase 1');
        updateSession(prev => ({
          ...prev,
          backendSessionId: prev.backendSessionId,
          currentStage: "phase1"
        }));
      }
    } catch (error: any) {
      console.error('Failed to submit name:', error);
      // Clear name submission state on error
      sessionStorage.removeItem('name-submission-in-progress');
      sessionStorage.removeItem('name-submission-messages-total');
      sessionStorage.removeItem('name-submission-messages-displayed');
      sessionStorage.removeItem('name-submission-stored-name');
      if (onError) {
        onError(error.message || 'Failed to submit name');
      }
    }
  };

  const handlePhase1Answer = async (answer: string) => {
    const base = sessionRef.current;
    console.log('📝 Phase 1 Answer - backendSessionId:', base.backendSessionId);

    try {
      // Call backend API to submit answer
      const backendSessionId = base.backendSessionId;
      if (backendSessionId) {
        console.log('✅ Using backend session ID:', backendSessionId);
        console.log(`📝 Submitting answer ${base.phase1Progress.currentQuestionIndex + 1}/27 to backend...`);
        
        // Ensure Phase 1 is started before submitting answer
        const phase1StartedKey = `phase1-started-${backendSessionId}`;
        if (sessionStorage.getItem(phase1StartedKey) !== 'true') {
          console.log('⚠️ Phase 1 not confirmed started, starting now...');
          try {
            await startPhase1(backendSessionId);
            sessionStorage.setItem(phase1StartedKey, 'true');
            console.log('✅ Phase 1 started before answer submission');
          } catch (error: any) {
            if (!error.message?.includes('already started')) {
              console.error('❌ Could not start Phase 1:', error);
              throw new Error(`Cannot submit answer: Phase 1 not started. ${error.message}`);
            }
            sessionStorage.setItem(phase1StartedKey, 'true');
          }
        }
        
        // Ensure Phase 1 is started before submitting
        if (!sessionStorage.getItem(phase1StartedKey)) {
          try {
            console.log('🚀 Ensuring Phase 1 is started before submitting answer...');
            await startPhase1(backendSessionId);
            sessionStorage.setItem(phase1StartedKey, 'true');
            console.log('✅ Phase 1 started');
          } catch (startError: any) {
            // If already started, that's fine
            if (startError.message?.includes('already started') || startError.message?.includes('already in phase1')) {
              sessionStorage.setItem(phase1StartedKey, 'true');
              console.log('✅ Phase 1 already started');
            } else {
              console.warn('⚠️ Could not start Phase 1 (continuing anyway):', startError.message);
            }
          }
        }
        
        const response = await submitAnswer(backendSessionId, answer);
        
        console.log('✅ Backend confirmed answer saved:', {
          questionIndex: response.currentQuestionIndex,
          isPhaseComplete: response.isPhaseComplete,
          totalAnswers: response.totalAnswers || 'unknown',
        });
        
        // Store the answer locally
        const currentQuestion = base.phase1Progress.currentQuestionIndex;
        const updatedAnswers = [...base.phase1Answers];
        
        // Ensure array is large enough
        while (updatedAnswers.length <= currentQuestion) {
          updatedAnswers.push({ questionId: `q-${updatedAnswers.length}`, answer: '' });
        }
        
        updatedAnswers[currentQuestion] = {
          questionId: `q-${currentQuestion}`,
          answer,
        };

        // Check if phase is complete based on backend response
        if (response.isPhaseComplete) {
          console.log('🎉 Phase 1 Complete! All 27 answers saved to database.');
          console.log('📊 Phase 2 Auto-Started:', response.phase2AutoStarted);
          console.log('📊 Backend Response:', JSON.stringify(response, null, 2));
          
          // If Phase 2 auto-started, switch to Phase 2 stage immediately
          if (response.phase2AutoStarted) {
            console.log('🚀 Auto-switching to Phase 2 stage...');
            console.log('   Setting currentStage to "phase2"');
            
            const updatedSession = {
              ...base,
              backendSessionId: base.backendSessionId,
              phase1Answers: updatedAnswers,
              currentStage: "phase2" as const, // Switch to Phase 2 stage
            };
            
            console.log('   Updated session:', updatedSession);
            onUpdateSession(updatedSession);
            
            addMessage({
              id: `msg-system-${Date.now()}`,
              role: "system",
              type: "system-message",
              content: "✓ Phase 1 Complete! → Starting Phase 2",
              timestamp: new Date(),
            });
            
            await addAVAMessage(`Amazing work, ${base.userName}! 🎉 You've completed all 27 questions.`, {}, 1000);
            await addAVAMessage(`Phase 2 has been automatically started. Generating your 21-section profile now...`, {}, 1500);
            
            console.log('✅ Phase 2 transition complete. AVAPhase2ChatInterface should now mount.');
          } else {
            // Phase 2 not auto-started, show completion message
            onUpdateSession({
              ...base,
              backendSessionId: base.backendSessionId,
              phase1Answers: updatedAnswers,
              currentStage: "complete",
            });
            
            addMessage({
              id: `msg-system-${Date.now()}`,
              role: "system",
              type: "system-message",
              content: "✓ Phase 1 Complete!",
              timestamp: new Date(),
            });
            
            await addAVAMessage(`Amazing work, ${base.userName}! 🎉 You've completed all 27 questions and all answers are saved to the database.`, {}, 1000);
            await addAVAMessage(`Phase 1 is now complete. You can start Phase 2 when ready.`, {}, 1500);
          }
        } else {
          // Move to next question - PRESERVE backendSessionId
          // Validate the next question index from backend
          const totalQuestions = 27;
          const nextIndex = response.currentQuestionIndex !== undefined 
            ? Math.min(Math.max(0, response.currentQuestionIndex), totalQuestions) 
            : Math.min(currentQuestion + 1, totalQuestions);
          
          // Double-check: if nextIndex equals totalQuestions, we're done
          const isActuallyComplete = nextIndex >= totalQuestions;
          
          console.log('📊 Question index update:', {
            fromBackend: response.currentQuestionIndex,
            current: currentQuestion,
            calculated: nextIndex,
            totalQuestions,
            isActuallyComplete,
            answeredCount: updatedAnswers.filter(a => a && a.answer && a.answer.trim()).length,
          });
          
          // This should not happen if backend is working correctly
          // Backend returns isPhaseComplete: true for last question
          if (isActuallyComplete) {
            console.warn('⚠️ Frontend detected completion but backend did not return isPhaseComplete');
            // Don't auto-start Phase 2 - just show completion
            onUpdateSession({
              ...base,
              backendSessionId: base.backendSessionId,
              phase1Answers: updatedAnswers,
              currentStage: "complete",
            });
            await addAVAMessage(`Amazing work, ${base.userName}! 🎉 Phase 1 complete.`, {}, 1000);
          } else {
            // Move to next question
            onUpdateSession({
              ...base,
              backendSessionId: base.backendSessionId, // PRESERVE backendSessionId
              phase1Answers: updatedAnswers,
              phase1Progress: {
                ...base.phase1Progress,
                currentQuestionIndex: nextIndex,
              },
            });
            
            await addAVAMessage(`Excellent! 🎯 That gives me great context.`, {}, 800);
          }
        }
      } else {
        // Fallback to local logic if no backend session
        const currentQuestion = base.phase1Progress.currentQuestionIndex;
        const updatedAnswers = [...base.phase1Answers];
        updatedAnswers[currentQuestion] = {
          questionId: `q-${currentQuestion}`,
          answer,
        };

        const nextIndex = currentQuestion + 1;
        const totalQuestions = 27;
        const isComplete = nextIndex >= totalQuestions;

        if (isComplete) {
          console.log('🎉 Phase 1 Complete (fallback)! backendSessionId:', base.backendSessionId);
          onUpdateSession({
            ...base,
            backendSessionId: base.backendSessionId, // PRESERVE backendSessionId
            phase1Answers: updatedAnswers,
            currentStage: "transition",
          });
          
          addMessage({
            id: `msg-system-${Date.now()}`,
            role: "system",
            type: "system-message",
            content: "✓ Phase 1 Complete!",
            timestamp: new Date(),
          });
          
        await addAVAMessage(`Amazing work, ${base.userName}! 🎉 Phase 1 complete. All answers saved.`, {}, 1000);
        } else {
          // Move to next question (fallback) - PRESERVE backendSessionId
          onUpdateSession({
            ...base,
            backendSessionId: base.backendSessionId, // PRESERVE backendSessionId
            phase1Answers: updatedAnswers,
            phase1Progress: {
              ...base.phase1Progress,
              currentQuestionIndex: nextIndex,
            },
          });
          
          await addAVAMessage(`Excellent! 🎯 That gives me great context.`, {}, 800);
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to submit answer:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        currentQuestion: base.phase1Progress.currentQuestionIndex,
        totalAnswers: base.phase1Answers.length,
      });
      
      // IMPORTANT: Save answer locally even if backend fails
      const currentQuestion = base.phase1Progress.currentQuestionIndex;
      const updatedAnswers = [...base.phase1Answers];
      
      // Ensure array is large enough
      while (updatedAnswers.length <= currentQuestion) {
        updatedAnswers.push({ questionId: `q-${updatedAnswers.length}`, answer: '' });
      }
      
      updatedAnswers[currentQuestion] = {
        questionId: `q-${currentQuestion}`,
        answer,
      };
      
      // Check if we've completed all questions locally
      const totalQuestions = 27;
      const nextIndex = currentQuestion + 1;
      const isComplete = nextIndex >= totalQuestions;
      
      console.log('📊 Local progress check:', {
        currentQuestion,
        nextIndex,
        totalQuestions,
        isComplete,
        answersCount: updatedAnswers.filter(a => a.answer).length,
      });
      
      if (onError) {
        onError(error.message || 'Failed to submit answer');
      }
      
      // Show error message but continue
      await addAVAMessage(`⚠️ There was an issue saving your answer to the backend, but your progress is saved locally. Continuing...`, {}, 500);
      
      if (isComplete) {
        // All questions completed - proceed to Phase 2
        console.log('🎉 Phase 1 Complete (after error recovery)! backendSessionId:', base.backendSessionId);
        onUpdateSession({
          ...base,
          backendSessionId: base.backendSessionId, // PRESERVE backendSessionId
          phase1Answers: updatedAnswers,
          currentStage: "transition",
        });
        
        addMessage({
          id: `msg-system-${Date.now()}`,
          role: "system",
          type: "system-message",
          content: "✓ Phase 1 Complete!",
          timestamp: new Date(),
        });
        
        await addAVAMessage(`Amazing work, ${base.userName}! 🎉 Phase 1 complete. All answers saved.`, {}, 1000);
        onUpdateSession({
          ...base,
          backendSessionId: base.backendSessionId,
          phase1Answers: updatedAnswers,
          currentStage: "complete",
        });
      } else {
        // Move to next question even after error
        onUpdateSession({
          ...base,
          backendSessionId: base.backendSessionId, // PRESERVE backendSessionId
          phase1Answers: updatedAnswers,
          phase1Progress: {
            ...base.phase1Progress,
            currentQuestionIndex: nextIndex,
          },
        });
        
        await addAVAMessage(`Excellent! 🎯 That gives me great context.`, {}, 800);
      }
    }
  };

  const handleExampleSelect = (example: string) => {
    setInputValue(example);
  };

  const handleActionClick = (actionType: string, videoUrl?: string) => {
    if (actionType === "start") {
      onUpdateSession({ ...session, currentStage: "phase1" });
    } else if (actionType === "generate-profile") {
      // Disabled: Phase 2 not implemented
      return;
    } else if (actionType === "show-videos") {
      setShowVideoDialog(true);
    } else if (actionType === "show-help") {
      setShowHelpDialog(true);
    } else if (actionType === "play-video" && videoUrl) {
      // Open video in new tab or show in dialog
      setSelectedVideo({ title: "AVA Introduction", url: videoUrl });
    }
  };

  const handleSkipPhase1 = async () => {
    const totalQuestions = 27;
    const dummyAnswers = Array.from({ length: totalQuestions }, (_, i) => ({
      questionId: `q-${i}`,
      answer: "Sample answer for design testing purposes",
    }));

    console.log('⏭️ Skipping Phase 1 - backendSessionId:', sessionRef.current.backendSessionId);
    
    updateSession(prev => ({
      ...prev,
      backendSessionId: prev.backendSessionId, // PRESERVE backendSessionId
      phase1Answers: dummyAnswers,
      currentStage: "transition",
    }));

    addMessage({
      id: `msg-system-${Date.now()}`,
      role: "system",
      type: "system-message",
      content: "⚡ Phase 1 Skipped (Design Mode)",
      timestamp: new Date(),
    });

    await addAVAMessage(`Amazing work, ${sessionRef.current.userName}! 🎉 Phase 1 skipped for design testing.`, {}, 1000);
    
    // Skip Phase 1 - just mark as complete, don't auto-start Phase 2
    updateSession(prev => ({
      ...prev,
      backendSessionId: prev.backendSessionId,
      phase1Answers: dummyAnswers,
      currentStage: "complete",
    }));
  };

  return (
    <>
      {/* Video Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-4xl">
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-xl flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              Help Videos
            </h3>
            <div className="grid gap-3">
              {phase1HelpVideos.map((video, index) => (
                <Card
                  key={index}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedVideo(video)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-24 h-16 bg-muted rounded-md flex items-center justify-center">
                      {video.thumbnail ? (
                        <img 
                          src={video.thumbnail} 
                          alt={video.title}
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <PlayCircle className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{video.title}</h4>
                      {video.description && (
                        <p className="text-sm text-muted-foreground">{video.description}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Selected Video Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl">
          {selectedVideo && (
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-xl">{selectedVideo.title}</h3>
              {selectedVideo.description && (
                <p className="text-muted-foreground">{selectedVideo.description}</p>
              )}
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {selectedVideo.url ? (
                  <video 
                    controls 
                    className="w-full h-full"
                    poster={selectedVideo.thumbnail}
                  >
                    <source src={selectedVideo.url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <PlayCircle className="h-16 w-16 mx-auto mb-2 opacity-50" />
                      <p>Video coming soon</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Help Tips Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-lg">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <h3 className="font-heading font-bold text-xl">Phase 1 Tips & Guidelines</h3>
            </div>
            <div className="prose prose-sm dark:prose-invert">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {phase1HelpText}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Chat Interface */}
      <div className="flex flex-col min-h-[calc(100vh-80px)] overflow-hidden bg-background pt-24 pb-32">
        <div className="sticky top-20 z-50">
          <AVAHeader 
            stage={session.currentStage}
            progress={session.phase1Progress}
            userName={session.userName}
            offsetClassName="top-20"
            onReset={() => {
              if (confirm("Start a new session? Your current progress will be saved in browser history.")) {
                const newSession = createNewChatSession();
                onUpdateSession(newSession);
                localStorage.removeItem("ava-chat-session");
              }
            }}
          />
          {session.currentStage === "phase1" && (
            <div className="bg-background/95 backdrop-blur-xl border-b border-border px-4 sm:px-6 py-2">
              <div className="max-w-3xl mx-auto flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkipPhase1}
                  className="h-7 text-xs gap-1"
                >
                  <FastForward className="w-3 h-3" />
                  Skip Phase 1
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 pb-32">
          <div className="max-w-3xl mx-auto space-y-6">
            {session.messages.map(msg => (
              <AVAMessage 
                key={msg.id} 
                message={msg}
                onExampleSelect={handleExampleSelect}
                onActionClick={handleActionClick}
              />
            ))}
            {isTyping && (
              <div className="flex gap-3 animate-fade-in">
                <img 
                  src={avaAvatar} 
                  alt="AVA" 
                  className="w-10 h-10 rounded-xl object-contain flex-shrink-0"
                />
                <AVATypingIndicator />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <AVAChatInput 
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          disabled={isTyping || session.currentStage === "transition" || session.currentStage === "phase2"}
          placeholder={
            session.currentStage === "name-collection" 
              ? "Enter your name..." 
              : session.currentStage === "phase1"
              ? "Type your answer..."
              : "Processing..."
          }
        />
      </div>
    </>
  );
};

