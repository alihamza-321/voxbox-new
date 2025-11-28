import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { cleanupLocalStorage, emergencyCleanup } from "@/lib/storage-cleanup";

type NameResponseStatus = "idle" | "rendering" | "complete";

interface AvaNameResponseState {
  sessionId: string | null;
  userName: string | null;
  messages: string[];
  renderedCount: number;
  videoUrl?: string;
  videoShown: boolean;
  status: NameResponseStatus;
  setPayload: (payload: {
    sessionId: string;
    userName: string;
    messages: string[];
    videoUrl?: string;
    renderedCount?: number;
    videoShown?: boolean;
  }) => void;
  incrementRendered: () => void;
  setRenderedCount: (count: number) => void;
  markVideoShown: () => void;
  markComplete: () => void;
  reset: () => void;
}

// Type for the persisted state (only serializable properties, no methods)
type PersistedAvaNameResponseState = Pick<
  AvaNameResponseState,
  "sessionId" | "userName" | "messages" | "renderedCount" | "videoUrl" | "videoShown" | "status"
>;

const initialState = {
  sessionId: null,
  userName: null,
  messages: [],
  renderedCount: 0,
  videoUrl: undefined,
  videoShown: false,
  status: "idle" as NameResponseStatus,
};

// Custom storage implementation that handles quota errors
const createQuotaSafeStorage = (): PersistStorage<PersistedAvaNameResponseState> => {
  return {
    getItem: (name: string) => {
      try {
        const item = localStorage.getItem(name);
        if (!item) return null;
        return JSON.parse(item);
      } catch (error) {
        console.error(`Failed to get item ${name}:`, error);
        return null;
      }
    },
    setItem: (name: string, value: { state: PersistedAvaNameResponseState; version?: number }): void => {
      try {
        // Serialize the value to JSON string for quota handling
        const valueString = JSON.stringify(value);
        const state = value.state;
        
        try {
          localStorage.setItem(name, valueString);
        } catch (error: any) {
          // Check if it's a quota exceeded error
          if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
            console.warn(`⚠️ Quota exceeded when setting ${name}, attempting cleanup...`);
            
            // Try to get current session ID and workspace ID from the value being set
            let currentSessionId: string | undefined;
            let currentWorkspaceId: string | undefined;
            try {
              currentSessionId = state?.sessionId || undefined;
              // Try to get workspace ID from localStorage
              try {
                const workspaceStorage = localStorage.getItem('workspace-storage');
                if (workspaceStorage) {
                  const workspaceParsed = JSON.parse(workspaceStorage);
                  currentWorkspaceId = workspaceParsed?.state?.currentWorkspace?.id;
                }
              } catch {
                // Ignore workspace storage parse errors
              }
            } catch {
              // Ignore parse errors
            }
            
            // Attempt cleanup
            cleanupLocalStorage(currentSessionId, currentWorkspaceId);
            
            try {
              localStorage.setItem(name, valueString);
              console.log(`✅ Successfully set ${name} after cleanup`);
              return;
            } catch (retryError: any) {
              // If still failing, try emergency cleanup
              if (retryError.name === 'QuotaExceededError' || retryError.message?.includes('quota')) {
                console.warn(`⚠️ Still quota exceeded, attempting emergency cleanup...`);
                emergencyCleanup(currentSessionId, currentWorkspaceId);
                
                try {
                  localStorage.setItem(name, valueString);
                  console.log(`✅ Successfully set ${name} after emergency cleanup`);
                  return;
                } catch (finalError: any) {
                  // If messages are too large, truncate them to save space
                  if (name === 'ava-name-response-store' && state?.messages && Array.isArray(state.messages)) {
                    try {
                      // Keep only first 5 messages to save space
                      const truncatedState: PersistedAvaNameResponseState = {
                        ...state,
                        messages: state.messages.slice(0, 5),
                      };
                      const truncatedValue = { state: truncatedState, version: value.version };
                      const truncatedValueString = JSON.stringify(truncatedValue);
                      
                      try {
                        localStorage.setItem(name, truncatedValueString);
                        console.warn(`⚠️ Stored truncated messages due to quota limit`);
                        return;
                      } catch {
                        // If even truncated version fails, clear the store entirely and continue without persistence
                        console.error(`❌ Failed to store even truncated version, continuing without persistence`);
                        try {
                          localStorage.removeItem(name);
                        } catch {
                          // Ignore removal errors
                        }
                        // Don't throw - allow app to continue without persistence
                        return;
                      }
                    } catch {
                      // If we can't create truncated version, just remove the item and continue
                      try {
                        localStorage.removeItem(name);
                      } catch {
                        // Ignore removal errors
                      }
                      return;
                    }
                  }
                  
                  // For other items, just log and continue without persistence
                  console.error(`❌ Failed to set ${name} even after cleanup, continuing without persistence:`, finalError);
                  return;
                }
              }
            }
          }
          
          // For non-quota errors, log and continue
          console.error(`Failed to set ${name}:`, error);
          // Don't throw - allow app to continue without persistence
        }
      } catch (error) {
        console.error(`Failed to serialize value for ${name}:`, error);
        // Don't throw - allow app to continue without persistence
      }
    },
    removeItem: (name: string): void => {
      try {
        localStorage.removeItem(name);
      } catch (error) {
        console.error(`Failed to remove item ${name}:`, error);
      }
    },
  };
};

export const useAvaNameResponseStore = create<AvaNameResponseState>()(
  persist(
    (set) => ({
      ...initialState,
      setPayload: ({ sessionId, userName, messages, videoUrl, renderedCount = 0, videoShown = false }) =>
        set({
          sessionId,
          userName,
          messages,
          renderedCount,
          videoUrl,
          videoShown,
          status: messages.length > 0 ? "rendering" : "idle",
        }),
      incrementRendered: () =>
        set((state) => ({
          renderedCount: Math.min(
            state.renderedCount + 1,
            state.messages.length
          ),
        })),
      setRenderedCount: (count: number) =>
        set((state) => ({
          renderedCount: Math.max(
            0,
            Math.min(count, state.messages.length || count)
          ),
        })),
      markVideoShown: () => set({ videoShown: true }),
      markComplete: () => set({ status: "complete" }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: "ava-name-response-store",
      version: 1,
      storage: createQuotaSafeStorage(),
      partialize: (state): PersistedAvaNameResponseState => ({
        sessionId: state.sessionId,
        userName: state.userName,
        messages: state.messages,
        renderedCount: state.renderedCount,
        videoUrl: state.videoUrl,
        videoShown: state.videoShown,
        status: state.status,
      }),
    }
  )
);

