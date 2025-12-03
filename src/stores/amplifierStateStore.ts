import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AmplifierKey =
  | 'emailSequence'
  | 'salesPage'
  | 'socialMedia'
  | 'adCopy'
  | 'videoScript'
  | 'webinarScript'
  | 'valueProposition'
  | 'blogPost'
  | 'caseStudy';

type FormValue = unknown;

interface AmplifierStateEntry {
  formValues: Record<string, FormValue>;
  scrollPosition: number;
  updatedAt: number;
}

// interface AmplifierStateEntry {
//   formValues: Record<string, FormValue>;
//   scrollPosition: number;
//   updatedAt: number;
// }

interface AmplifierStateStore {
  states: Partial<Record<AmplifierKey, AmplifierStateEntry>>;
  updateFormState: (key: AmplifierKey, values: Record<string, FormValue>) => void;
  setScrollPosition: (key: AmplifierKey, position: number) => void;
  clearState: (key: AmplifierKey) => void;
  clearAll: () => void;
}

// interface AmplifierStateStore {
//   states: Partial<Record<AmplifierKey, AmplifierStateEntry>>;
//   updateFormState: (key: AmplifierKey, values: Record<string, FormValue>) => void;
//   setScrollPosition: (key: AmplifierKey, position: number) => void;
//   clearState: (key: AmplifierKey) => void;
//   clearAll: () => void;
// }

const shallowEqual = (
  a: Record<string, FormValue> | undefined,
  b: Record<string, FormValue>,
): boolean => {
  if (!a) {
    return Object.keys(b).length === 0;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }

    if (!Object.is(a[key], b[key])) {
      return false;
    }
  }

  return true;
};

export const useAmplifierStateStore = create<AmplifierStateStore>()(
  persist(
    (set) => ({
      states: {},
      updateFormState: (key, values) => {
        set((state) => {
          const existing = state.states[key] ?? {
            formValues: {},
            scrollPosition: 0,
            updatedAt: Date.now(),
          };

          const nextFormValues = {
            ...existing.formValues,
            ...values,
          };

          if (shallowEqual(existing.formValues, nextFormValues)) {
            return state;
          }

          return {
            states: {
              ...state.states,
              [key]: {
                ...existing,
                formValues: nextFormValues,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },
      setScrollPosition: (key, position) => {
        set((state) => {
          const existing = state.states[key] ?? {
            formValues: {},
            scrollPosition: 0,
            updatedAt: Date.now(),
          };

          if (Math.abs(existing.scrollPosition - position) < 1) {
            return state;
          }

          return {
            states: {
              ...state.states,
              [key]: {
                ...existing,
                scrollPosition: position,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },
      clearState: (key) =>
        set((state) => {
          if (!state.states[key]) {
            return state;
          }

          const nextStates = { ...state.states };
          delete nextStates[key];

          return { states: nextStates };
        }),
      clearAll: () => set({ states: {} }),
    }),
    {
      name: 'amplifier-state',
      partialize: (state) => state,
    },
  ),
);

export const clearAmplifierState = () => {
  useAmplifierStateStore.getState().clearAll();
};


