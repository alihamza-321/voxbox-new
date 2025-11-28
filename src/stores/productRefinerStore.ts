import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ProductRefinerSession } from '@/lib/product-refiner-api';
import type { ProductRefinerStep2PersistedState } from '@/components/product-refiner/ProductRefinerStep2';
import type { ProductRefinerStep4PersistedState } from '@/components/product-refiner/ProductRefinerStep4';

export interface StepPersistedState {
  currentQuestionKey: string | null;
  currentInputValue: string;
  answeredQuestions: string[];
  // ChatGPT-style history tracking
  questionOrder?: string[]; // Chronological order of all questions asked
  questionAnswers?: Record<string, string>; // All answers including blank/skipped
  isFinalizing?: boolean;
  // Step-specific additional state
  currentOutcomeIndex?: number;
  currentEntryIndex?: number;
  currentFieldKey?: string | null;
}

interface ProductRefinerUiState {
  step2?: ProductRefinerStep2PersistedState | null;
  step3?: { hasGenerated: boolean } | null;
  step4?: ProductRefinerStep4PersistedState | null;
  step5?: StepPersistedState | null;
  step6?: StepPersistedState | null;
  step7?: StepPersistedState | null;
  step8?: StepPersistedState | null;
  step9?: StepPersistedState | null;
}

interface ProductRefinerFormData {
  // Step 2 form data
  step2: {
    product: string;
    targetAudience: string;
    problem: string;
    features: string;
    delivery: string;
    pricing: string;
  } | null;
  
  // Step 4 form data
  step4: {
    corePromise: string;
    finalPromise: string;
  } | null;
  
  // Step 5 form data (outcomes)
  step5: any[] | null;
  
  // Step 6 form data (feature-benefit table)
  step6: any[] | null;
  
  // Step 7 form data (value stack)
  step7: any | null;
  
  // Step 8 form data (proof elements)
  step8: {
    proofElements: any[] | null;
    notes: string;
  } | null;
  
  // Step 9 form data (pricing)
  step9: any | null;
}

interface ProductRefinerState {
  // Session data
  session: ProductRefinerSession | null;
  
  // UI state
  uiState: ProductRefinerUiState;
  
  // Form data for all steps (for ChatGPT-style persistence)
  formData: ProductRefinerFormData;
  
  // Actions
  setSession: (session: ProductRefinerSession | null) => void;
  setUiState: (uiState: ProductRefinerUiState) => void;
  setStep2FormData: (formData: ProductRefinerFormData['step2']) => void;
  setStep4FormData: (formData: ProductRefinerFormData['step4']) => void;
  setStep5FormData: (formData: ProductRefinerFormData['step5']) => void;
  setStep6FormData: (formData: ProductRefinerFormData['step6']) => void;
  setStep7FormData: (formData: ProductRefinerFormData['step7']) => void;
  setStep8FormData: (formData: ProductRefinerFormData['step8']) => void;
  setStep9FormData: (formData: ProductRefinerFormData['step9']) => void;
  clearState: () => void;
}

// Create workspace-scoped storage key
const getStorageKey = (workspaceId: string) => `product-refiner-store-${workspaceId}`;

// Factory function to create a workspace-scoped store
export const createProductRefinerStore = (workspaceId: string) => {
  const storageKey = getStorageKey(workspaceId);
  
  return create<ProductRefinerState>()(
    persist(
      (set) => ({
        session: null,
        uiState: {},
        formData: {
          step2: null,
          step4: null,
          step5: null,
          step6: null,
          step7: null,
          step8: null,
          step9: null,
        },
        
        setSession: (session) => {
          set({ session });
          // Auto-sync form data from session when session is set
          if (session) {
            set((state) => ({
              formData: {
                step2: session.step2Product || session.step2TargetAudience || session.step2Problem || 
                       session.step2Features || session.step2Delivery || session.step2Pricing
                  ? {
                      product: session.step2Product || "",
                      targetAudience: session.step2TargetAudience || "",
                      problem: session.step2Problem || "",
                      features: session.step2Features || "",
                      delivery: session.step2Delivery || "",
                      pricing: session.step2Pricing || "",
                    }
                  : state.formData.step2,
                step4: session.step4CorePromise || session.step4FinalPromise
                  ? {
                      corePromise: session.step4CorePromise || "",
                      finalPromise: session.step4FinalPromise || "",
                    }
                  : state.formData.step4,
                step5: session.step5Outcomes && Array.isArray(session.step5Outcomes) && session.step5Outcomes.length > 0
                  ? session.step5Outcomes
                  : state.formData.step5,
                step6: session.step6FeatureBenefitTable && Array.isArray(session.step6FeatureBenefitTable) && session.step6FeatureBenefitTable.length > 0
                  ? session.step6FeatureBenefitTable
                  : state.formData.step6,
                step7: session.step7ValueStack
                  ? session.step7ValueStack
                  : state.formData.step7,
                step8: session.step8ProofElements
                  ? {
                      proofElements: (session.step8ProofElements as any).proofElements || null,
                      notes: (session.step8ProofElements as any).notes || "",
                    }
                  : state.formData.step8,
                step9: session.step9Pricing
                  ? session.step9Pricing
                  : state.formData.step9,
              },
            }));
          }
        },
        
        setUiState: (uiState) => set({ uiState }),
        
        setStep2FormData: (formData) => 
          set((state) => ({
            formData: {
              ...state.formData,
              step2: formData,
            },
          })),
        
        setStep4FormData: (formData) => 
          set((state) => ({
            formData: {
              ...state.formData,
              step4: formData,
            },
          })),
        
        setStep5FormData: (formData) => 
          set((state) => ({
            formData: {
              ...state.formData,
              step5: formData,
            },
          })),
        
        setStep6FormData: (formData) => 
          set((state) => ({
            formData: {
              ...state.formData,
              step6: formData,
            },
          })),
        
        setStep7FormData: (formData) => 
          set((state) => ({
            formData: {
              ...state.formData,
              step7: formData,
            },
          })),
        
        setStep8FormData: (formData) => 
          set((state) => ({
            formData: {
              ...state.formData,
              step8: formData,
            },
          })),
        
        setStep9FormData: (formData) => 
          set((state) => ({
            formData: {
              ...state.formData,
              step9: formData,
            },
          })),
        
        clearState: () => set({
          session: null,
          uiState: {},
          formData: {
            step2: null,
            step4: null,
            step5: null,
            step6: null,
            step7: null,
            step8: null,
            step9: null,
          },
        }),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => localStorage),
        // Persist everything for ChatGPT-style full history
        partialize: (state) => ({
          session: state.session,
          formData: state.formData,
          // Don't persist uiState as it's temporary UI state
        }),
      }
    )
  );
};

// Store instances cache (one per workspace)
const storeInstances = new Map<string, ReturnType<typeof createProductRefinerStore>>();

// Function to clear store instance for a workspace (used during reset)
export const clearProductRefinerStore = (workspaceId: string) => {
  const store = storeInstances.get(workspaceId);
  if (store) {
    // Clear the store state
    store.getState().clearState();
  }
  // Also remove from cache so it gets recreated fresh
  storeInstances.delete(workspaceId);
};

// Hook to get or create store for a workspace
export const useProductRefinerStore = (workspaceId: string | null) => {
  if (!workspaceId) {
    return null;
  }
  
  // Get or create store instance for this workspace
  if (!storeInstances.has(workspaceId)) {
    storeInstances.set(workspaceId, createProductRefinerStore(workspaceId));
  }
  
  return storeInstances.get(workspaceId)!;
};
