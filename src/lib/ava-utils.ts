// AVA utility functions

export interface Phase1Answer {
  questionId: string;
  answer: string;
}

export interface Phase2Section {
  sectionId: number;
  content: string;
  confirmed: boolean;
}

export interface AVASession {
  phase: 'welcome' | 'phase1' | 'transition' | 'phase2' | 'complete';
  currentQuestionIndex: number;
  phase1Answers: Phase1Answer[];
  phase2Sections: Phase2Section[];
  profileName: string;
  createdAt: string;
  lastUpdated: string;
}

const STORAGE_KEY = 'ava-session';

export const saveSession = (session: AVASession): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...session,
      lastUpdated: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Failed to save AVA session:', error);
  }
};

export const loadSession = (): AVASession | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load AVA session:', error);
  }
  return null;
};

export const clearSession = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear AVA session:', error);
  }
};

export const createNewSession = (): AVASession => {
  return {
    phase: 'welcome',
    currentQuestionIndex: 0,
    phase1Answers: [],
    phase2Sections: [],
    profileName: '',
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
};

export const calculateProgress = (session: AVASession, totalQuestions: number): number => {
  if (session.phase === 'welcome') return 0;
  if (session.phase === 'phase1' || session.phase === 'transition') {
    return Math.round((session.phase1Answers.length / totalQuestions) * 100);
  }
  if (session.phase === 'phase2') {
    const confirmedSections = session.phase2Sections.filter(s => s.confirmed).length;
    return Math.round((confirmedSections / 21) * 100);
  }
  return 100;
};

export const exportProfileAsText = (
  phase1Answers: Phase1Answer[],
  phase2Sections: Phase2Section[],
  questions: any[]
): string => {
  let output = '='.repeat(60) + '\n';
  output += 'IDEAL CLIENT PERSUASION PROFILE\n';
  output += 'Generated with AVA (Audience Values Analyzer)\n';
  output += '='.repeat(60) + '\n\n';

  output += 'PHASE 1: FOUNDATIONAL INSIGHTS\n';
  output += '-'.repeat(60) + '\n\n';

  const allQuestions = questions.flatMap(section => 
    section.questions.map((q: any) => ({ ...q, section: section.sectionTitle }))
  );

  phase1Answers.forEach(answer => {
    const question = allQuestions.find((q: any) => q.id === answer.questionId);
    if (question) {
      output += `Q: ${question.text}\n`;
      output += `A: ${answer.answer}\n\n`;
    }
  });

  output += '\n' + '='.repeat(60) + '\n';
  output += 'PHASE 2: PSYCHOLOGICAL PROFILE\n';
  output += '='.repeat(60) + '\n\n';

  phase2Sections.forEach(section => {
    output += `SECTION ${section.sectionId}\n`;
    output += '-'.repeat(60) + '\n';
    output += section.content + '\n\n';
  });

  return output;
};

