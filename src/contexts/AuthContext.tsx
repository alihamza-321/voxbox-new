import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthService } from '@/lib/auth';
import type { User, RegisterRequest, LoginRequest } from '@/lib/auth';
import { clearAmplifierState } from '@/stores/amplifierStateStore';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = AuthService.getCurrentUser();
        const isAuth = AuthService.isAuthenticated();
        
        if (isAuth && currentUser) {
          setUser(currentUser);
        } else {
          // Check if we have tokens but no user data
          const token = AuthService.getAccessToken();
          if (token) {
            try {
              await AuthService.refreshToken();
              const refreshedUser = AuthService.getCurrentUser();
              setUser(refreshedUser);
            } catch (error) {
              // Token refresh failed, clear everything
              await AuthService.logout();
              setUser(null);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Set up periodic token refresh check (every 10 minutes)
    const refreshInterval = setInterval(() => {
      if (AuthService.isAuthenticated() && AuthService.shouldRefreshToken()) {
        AuthService.refreshToken().catch((error) => {
          console.error('Periodic token refresh failed:', error);
        });
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(refreshInterval);
  }, []);

  const login = async (data: LoginRequest) => {
    try {
      console.log('AuthContext: Starting login process');
      setIsLoading(true);
      const response = await AuthService.login(data);
      console.log('AuthContext: Login successful, setting user:', response.user);
      setUser(response.user);
      console.log('AuthContext: User state updated');
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      setIsLoading(true);
      const response = await AuthService.register(data);
      setUser(response.user);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      let shouldRedirectToDashboard = false;

      if (user) {
        try {
          const { PaymentService } = await import('@/lib/payment');
          const subscription = await PaymentService.getUserSubscription(user.id);
          shouldRedirectToDashboard = !!subscription?.hasSubscription;
        } catch (error) {
          console.error('Logout subscription check failed:', error);
        }
      }

      if (!shouldRedirectToDashboard && typeof window !== 'undefined') {
        try {
          const hasCompletedPayment = localStorage.getItem('hasCompletedPayment') === 'true';
          shouldRedirectToDashboard = hasCompletedPayment;
        } catch (error) {
          console.error('Logout payment fallback check failed:', error);
        }
      }

      if (typeof window !== 'undefined') {
        if (shouldRedirectToDashboard) {
          sessionStorage.setItem('forceDashboardRedirect', 'true');
          sessionStorage.setItem('redirectAfterLogin', '/dashboard');
        } else {
          sessionStorage.removeItem('forceDashboardRedirect');
          sessionStorage.removeItem('redirectAfterLogin');
        }
      }
      clearAmplifierState();
      await AuthService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      const response = await AuthService.refreshToken();
      setUser(response.user);
    } catch (error) {
      console.error('Token refresh error:', error);
      setUser(null);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
