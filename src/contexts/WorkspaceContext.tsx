import { createContext, useContext, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { WorkspaceService, type WorkspaceResponse } from '@/lib/workspace';
import { useAuth } from './AuthContext';
import { useWorkspaceStore } from '@/stores/workspaceStore';

interface WorkspaceContextType {
  currentWorkspace: WorkspaceResponse | null;
  workspaces: WorkspaceResponse[];
  isLoading: boolean;
  setCurrentWorkspace: (workspace: WorkspaceResponse) => void;
  refreshWorkspaces: () => Promise<void>;
  addWorkspace: (workspace: WorkspaceResponse) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export const WorkspaceProvider = ({ children }: WorkspaceProviderProps) => {
  const { user } = useAuth();
  const hasLoadedWorkspaces = useRef(false);
  
  // Use Zustand store for state management with persistence
  const {
    currentWorkspace,
    workspaces,
    isLoading,
    setCurrentWorkspace: setStoreWorkspace,
    setWorkspaces: setStoreWorkspaces,
    setLoading: setStoreLoading,
    addWorkspace: addStoreWorkspace,
    clearWorkspaces: clearStoreWorkspaces,
  } = useWorkspaceStore();

  // Helper to read persisted workspace directly from localStorage
  const getPersistedWorkspace = useCallback((): { id: string; workspace?: WorkspaceResponse } | null => {
    try {
      // Read directly from localStorage where Zustand persists the workspace
      const storageKey = 'workspace-storage';
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Zustand persist stores data in { state: { ... } } structure
        const persistedWorkspace = parsed?.state?.currentWorkspace;
        if (persistedWorkspace?.id) {
          console.log('🔍 Found persisted workspace in localStorage:', persistedWorkspace.id, persistedWorkspace.name);
          return { id: persistedWorkspace.id, workspace: persistedWorkspace };
        }
        // Fallback: check if it's stored directly (older format)
        if (parsed?.currentWorkspace?.id) {
          console.log('🔍 Found persisted workspace (fallback format):', parsed.currentWorkspace.id);
          return { id: parsed.currentWorkspace.id, workspace: parsed.currentWorkspace };
        }
      }
      console.log('🔍 No persisted workspace found in localStorage');
    } catch (e) {
      console.error('Failed to read persisted workspace from localStorage:', e);
    }
    return null;
  }, []);

  const loadWorkspaces = useCallback(async () => {
    if (!user) {
      setStoreWorkspaces([]);
      setStoreWorkspace(null);
      setStoreLoading(false);
      hasLoadedWorkspaces.current = false;
      clearStoreWorkspaces();
      return;
    }

    // Prevent multiple simultaneous loads
    if (hasLoadedWorkspaces.current) {
      console.log('⏸️ Workspaces already loaded, skipping duplicate load');
      return;
    }

    try {
      setStoreLoading(true);
      hasLoadedWorkspaces.current = true;
      console.log('🏪 WorkspaceContext - Loading workspaces from API...');
      
      // CRITICAL: Read persisted workspace directly from localStorage FIRST (synchronously)
      // This MUST happen before API call to ensure we know which workspace to restore
      // Set it immediately in the store so other components can use it
      const persisted = getPersistedWorkspace();
      const persistedWorkspaceId = persisted?.id;
      if (persisted?.workspace && persistedWorkspaceId) {
        console.log('🔍 Setting persisted workspace immediately from localStorage:', persisted.workspace.name);
        // Set it immediately so components don't see null/undefined
        setStoreWorkspace(persisted.workspace);
      }
      console.log('🔍 Persisted workspace ID from localStorage:', persistedWorkspaceId);
      
      const workspacesData = await WorkspaceService.getWorkspaces();
      console.log('🏪 WorkspaceContext - Workspaces loaded:', workspacesData.length);
      console.log('📋 Workspace IDs:', workspacesData.map(w => ({ id: w.id, name: w.name })));
      
      setStoreWorkspaces(workspacesData);
      
      // CRITICAL: ALWAYS restore persisted workspace FIRST if it exists in API response
      // This is the KEY FIX - we MUST check persisted workspace BEFORE defaulting to first
      // This ensures Workspace2 stays Workspace2 on refresh, not switching to Workspace1
      if (persistedWorkspaceId) {
        const targetWorkspace = workspacesData.find(w => w.id === persistedWorkspaceId);
        if (targetWorkspace) {
          console.log('✅✅✅ RESTORING persisted workspace from API:', targetWorkspace.name, 'ID:', targetWorkspace.id);
          // Update with fresh data from API (may have changed)
          setStoreWorkspace(targetWorkspace);
          setStoreLoading(false);
          return; // EXIT EARLY - workspace restored successfully, DO NOT default to first
        } else {
          console.log('⚠️ Persisted workspace not found in API (may have been deleted):', persistedWorkspaceId);
          // Clear the invalid persisted workspace from store
          setStoreWorkspace(null);
        }
      }
      
      // ONLY use first workspace if NO persisted workspace exists
      // This should only happen on first-ever load when no workspace was ever selected
      if (!persistedWorkspaceId && workspacesData.length > 0) {
        console.log('📂 No persisted workspace found - using first available workspace (first load)');
        setStoreWorkspace(workspacesData[0]);
      } else if (persistedWorkspaceId && workspacesData.length > 0) {
        // Persisted workspace was deleted but we have other workspaces
        console.log('📂 Persisted workspace deleted - switching to first available workspace');
        setStoreWorkspace(workspacesData[0]);
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
      setStoreWorkspaces([]);
      hasLoadedWorkspaces.current = false;
    } finally {
      setStoreLoading(false);
      const finalWorkspace = useWorkspaceStore.getState().currentWorkspace;
      console.log('🏪 WorkspaceContext - Loading completed. Final workspace:', finalWorkspace?.name, 'ID:', finalWorkspace?.id);
    }
  }, [user, setStoreWorkspace, setStoreWorkspaces, setStoreLoading, clearStoreWorkspaces, getPersistedWorkspace]);

  const refreshWorkspaces = useCallback(async () => {
    hasLoadedWorkspaces.current = false;
    await loadWorkspaces();
  }, [loadWorkspaces]);

  const setCurrentWorkspace = useCallback((workspace: WorkspaceResponse) => {
    console.log('🏪 WorkspaceContext - Setting current workspace via context:', workspace.name, workspace.id);
    setStoreWorkspace(workspace);
  }, [setStoreWorkspace]);

  const addWorkspace = useCallback((workspace: WorkspaceResponse) => {
    addStoreWorkspace(workspace);
  }, [addStoreWorkspace]);

  // Load workspaces on mount and when user changes
  useEffect(() => {
    // Reset flag on mount to ensure we load on refresh
    if (user) {
      hasLoadedWorkspaces.current = false;
      loadWorkspaces();
    }
  }, [user, loadWorkspaces]);

  const value: WorkspaceContextType = {
    currentWorkspace,
    workspaces,
    isLoading,
    setCurrentWorkspace,
    refreshWorkspaces,
    addWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
