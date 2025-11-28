import { useState, useEffect } from 'react';

interface SidebarState {
  sidebarWidth: number;
  leftOffset: number;
}

export const useSidebarState = (): SidebarState => {
  const [state, setState] = useState<SidebarState>(() => {
    // Initial state - will be updated in useEffect
    // Check localStorage for collapsed state as fallback
    const saved = localStorage.getItem('sidebarCollapsed');
    const isCollapsed = saved ? JSON.parse(saved) : false;
    const initialWidth = isCollapsed ? 64 : 256; // w-16 = 64px, w-64 = 256px
    
    return {
      sidebarWidth: initialWidth,
      leftOffset: initialWidth,
    };
  });

  useEffect(() => {
    const updateState = () => {
      // Get sidebar width from main element's margin-left
      const main = document.querySelector('main');
      if (!main) {
        // Fallback: check localStorage and window size
        const saved = localStorage.getItem('sidebarCollapsed');
        const isCollapsed = saved ? JSON.parse(saved) : false;
        const isMobile = window.innerWidth < 768;
        const sidebarWidth = isMobile ? 0 : (isCollapsed ? 64 : 256);
        
        setState({
          sidebarWidth,
          leftOffset: sidebarWidth,
        });
        return;
      }
      
      const computedStyle = getComputedStyle(main);
      const marginLeft = parseInt(computedStyle.marginLeft) || 0;
      
      // On mobile (< 768px), sidebar might be hidden
      const isMobile = window.innerWidth < 768;
      const sidebarWidth = isMobile ? 0 : marginLeft;
      
      setState({
        sidebarWidth,
        leftOffset: sidebarWidth,
      });
    };

    // Initial update with small delay to ensure DOM is ready
    const timeoutId = setTimeout(updateState, 100);
    updateState(); // Also try immediately

    // Listen for resize
    window.addEventListener('resize', updateState);
    
    // Observe main element for margin changes
    const main = document.querySelector('main');
    if (main) {
      const observer = new MutationObserver(updateState);
      observer.observe(main, {
        attributes: true,
        attributeFilter: ['class'],
      });

      // Also observe sidebar for class changes
      const sidebar = document.querySelector('aside');
      if (sidebar) {
        observer.observe(sidebar, {
          attributes: true,
          attributeFilter: ['class'],
        });
      }

      // Poll for changes (fallback for localStorage changes)
      const interval = setInterval(updateState, 300);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', updateState);
        observer.disconnect();
        clearInterval(interval);
      };
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateState);
    };
  }, []);

  return state;
};

