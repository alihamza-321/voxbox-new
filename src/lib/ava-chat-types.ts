export interface ChatMessage {
  id: string;
  role: "ava" | "user" | "system";
  type: "text" | "question" | "section" | "system-message";
  content: string;
  timestamp: Date;
  metadata?: {
    questionId?: string;
    sectionId?: number;
    sectionNumber?: number;
    examples?: string[];
    badge?: string;
    actions?: MessageAction[];
  };
  animation?: "fade-in" | "slide-up" | "none";
}

export interface MessageAction {
  label: string;
  variant: "default" | "secondary" | "ghost";
  actionType?: string;
  onClick?: () => void;
}

export interface Phase1Answer {
  questionId: string;
  answer: string;
}

export interface AVAChatSession {
  id: string;
  backendSessionId?: string; // Backend AVA session ID
  userName: string;
  currentStage: "welcome" | "name-collection" | "phase1-intro" | "phase1" | "transition" | "phase2" | "complete";
  messages: ChatMessage[];
  phase1Answers: Phase1Answer[];
  phase1Progress: {
    currentQuestionIndex: number;
    totalQuestions: number;
  };
  phase2Sections: any[];
  createdAt: Date;
  lastModifiedAt: Date;
}

export const createNewChatSession = (): AVAChatSession => {
  return {
    id: `session-${Date.now()}`,
    userName: "",
    currentStage: "welcome",
    messages: [
      {
        id: "msg-welcome-1",
        role: "ava",
        type: "text",
        content: "Hi there! 👋 I'm AVA, your Audience Visualisation Accelerator.",
        timestamp: new Date(),
      },
      {
        id: "msg-welcome-2",
        role: "ava",
        type: "text",
        content: "I'm here to help you build a deep psychological profile of your ideal client. This isn't just demographics—we're uncovering buying behaviors, hidden motivations, and emotional triggers.",
        timestamp: new Date(),
      },
      {
        id: "msg-welcome-3",
        role: "ava",
        type: "text",
        content: "Before we begin, what's your name?",
        timestamp: new Date(),
      },
    ],
    phase1Answers: [],
    phase1Progress: {
      currentQuestionIndex: 0,
      totalQuestions: 30,
    },
    phase2Sections: [],
    createdAt: new Date(),
    lastModifiedAt: new Date(),
  };
};

