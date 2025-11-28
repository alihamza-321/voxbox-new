import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkspaceResponse } from '@/lib/workspace';

interface WorkspaceState {
  currentWorkspace: WorkspaceResponse | null;
  workspaces: WorkspaceResponse[];
  isLoading: boolean;
  setCurrentWorkspace: (workspace: WorkspaceResponse | null) => void;
  setWorkspaces: (workspaces: WorkspaceResponse[]) => void;
  setLoading: (loading: boolean) => void;
  addWorkspace: (workspace: WorkspaceResponse) => void;
  clearWorkspaces: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspace: null,
      workspaces: [],
      isLoading: true,
      
      setCurrentWorkspace: (workspace) => {
        console.log('🏪 Zustand: Setting current workspace:', workspace?.name, workspace?.id);
        set({ currentWorkspace: workspace });
      },
      
      setWorkspaces: (workspaces) => {
        console.log('🏪 Zustand: Setting workspaces:', workspaces.length);
        set({ workspaces });
      },
      
      setLoading: (isLoading) => {
        set({ isLoading });
      },
      
      addWorkspace: (workspace) => {
        set((state) => {
          const exists = state.workspaces.some(w => w.id === workspace.id || w.name === workspace.name);
          if (exists) {
            console.log('🏪 Zustand: Workspace already exists, not adding duplicate:', workspace.name);
            return state;
          }
          console.log('🏪 Zustand: Adding new workspace:', workspace.name);
          return {
            workspaces: [...state.workspaces, workspace],
            currentWorkspace: workspace
          };
        });
      },
      
      clearWorkspaces: () => {
        set({
          currentWorkspace: null,
          workspaces: [],
          isLoading: false
        });
      },
    }),
    {
      name: 'workspace-storage',
      partialize: (state) => ({
        currentWorkspace: state.currentWorkspace,
        // Don't persist workspaces list as it should be fetched from API
        // Don't persist isLoading as it should always start as true
      }),
    }
  )
);

