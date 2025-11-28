/**
 * Utility functions for cleaning up localStorage when quota is exceeded
 */

/**
 * Cleans up old localStorage data to free up space
 * Prioritizes keeping current session data
 */
export const cleanupLocalStorage = (currentSessionId?: string, currentWorkspaceId?: string): number => {
  if (typeof window === 'undefined') return 0;
  
  let cleanedCount = 0;
  const keysToRemove: string[] = [];
  
  try {
    // Collect all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Skip critical auth and workspace data
      if (key === 'accessToken' || key === 'refreshToken' || key === 'user' || key === 'workspace-storage') {
        continue;
      }
      
      // Remove old AVA session states (keep only current workspace's session)
      if (key.startsWith('ava-session-state')) {
        if (currentWorkspaceId && key.includes(currentWorkspaceId)) {
          // Keep current workspace's session
          continue;
        }
        keysToRemove.push(key);
        continue;
      }
      
      // Remove old name response stores (keep only current session's)
      if (key === 'ava-name-response-store') {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            const storedSessionId = parsed?.state?.sessionId;
            if (storedSessionId && storedSessionId !== currentSessionId) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // If we can't parse it, it's safe to remove
          keysToRemove.push(key);
        }
        continue;
      }
      
      // Remove old activate-now messages
      if (key.startsWith('activate-now-messages-')) {
        if (currentSessionId && key.includes(currentSessionId)) {
          // Keep current session's messages
          continue;
        }
        keysToRemove.push(key);
        continue;
      }
      
      // Remove old phase2 persisted states
      if (key.startsWith('ava-phase2-state-')) {
        if (currentWorkspaceId && key.includes(currentWorkspaceId)) {
          // Keep current workspace's phase2 state
          continue;
        }
        keysToRemove.push(key);
        continue;
      }
      
      // Remove old margo states
      if (key.startsWith('margo-state-')) {
        if (currentWorkspaceId && key.includes(currentWorkspaceId)) {
          // Keep current workspace's margo state
          continue;
        }
        keysToRemove.push(key);
        continue;
      }
      
      // Remove old margo step storage
      if (key.startsWith('margo-step')) {
        keysToRemove.push(key);
        continue;
      }
    }
    
    // Remove collected keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        cleanedCount++;
      } catch (error) {
        console.warn(`Failed to remove localStorage key: ${key}`, error);
      }
    });
    
    console.log(`🧹 Cleaned up ${cleanedCount} localStorage items`);
  } catch (error) {
    console.error('Error during localStorage cleanup:', error);
  }
  
  return cleanedCount;
};

/**
 * Attempts to free up space by removing the largest non-critical items
 */
export const emergencyCleanup = (currentSessionId?: string, currentWorkspaceId?: string): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    // First, try standard cleanup
    cleanupLocalStorage(currentSessionId, currentWorkspaceId);
    
    // If still having issues, remove the name response store entirely
    // (it can be regenerated from the API)
    try {
      const nameStoreKey = 'ava-name-response-store';
      const stored = localStorage.getItem(nameStoreKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const storedSessionId = parsed?.state?.sessionId;
        // Only remove if it's not for the current session
        if (!currentSessionId || storedSessionId !== currentSessionId) {
          localStorage.removeItem(nameStoreKey);
          console.log('🧹 Emergency cleanup: Removed old name response store');
          return true;
        }
      }
    } catch (error) {
      console.warn('Error during emergency cleanup:', error);
    }
    
    return true;
  } catch (error) {
    console.error('Emergency cleanup failed:', error);
    return false;
  }
};

/**
 * Safely sets an item in localStorage with automatic cleanup on quota error
 */
export const safeSetItem = (
  key: string,
  value: string,
  currentSessionId?: string,
  currentWorkspaceId?: string
): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    // Check if it's a quota exceeded error
    if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
      console.warn('⚠️ localStorage quota exceeded, attempting cleanup...');
      
      // Try cleanup and retry
      cleanupLocalStorage(currentSessionId, currentWorkspaceId);
      
      try {
        localStorage.setItem(key, value);
        console.log('✅ Successfully set item after cleanup');
        return true;
      } catch (retryError: any) {
        // If still failing, try emergency cleanup
        if (retryError.name === 'QuotaExceededError' || retryError.message?.includes('quota')) {
          console.warn('⚠️ Still quota exceeded after cleanup, attempting emergency cleanup...');
          emergencyCleanup(currentSessionId, currentWorkspaceId);
          
          try {
            localStorage.setItem(key, value);
            console.log('✅ Successfully set item after emergency cleanup');
            return true;
          } catch (finalError) {
            console.error('❌ Failed to set item even after emergency cleanup:', finalError);
            return false;
          }
        }
        throw retryError;
      }
    }
    throw error;
  }
};

