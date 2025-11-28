// Authentication service for handling user authentication
import { API_BASE_URL } from '@/config/api.config';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export class AuthService {
  private static getAuthHeaders() {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  static async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      console.log('AuthService: Attempting registration to:', `${API_BASE_URL}/auth/register`);
      console.log('AuthService: Registration data:', { ...data, password: '***' });
      
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('AuthService: Response status:', response.status);
      console.log('AuthService: Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Registration failed' }));
        console.error('AuthService: Error response:', errorData);
        throw new Error(errorData.message || 'Registration failed');
      }

      const result = await response.json();
      console.log('AuthService: Registration successful, full response:', result);
      
      // Backend wraps response in a 'data' object
      const authData = result.data || result;
      
      console.log('AuthService: Registration data structure:', {
        hasAccessToken: !!authData.access_token,
        hasRefreshToken: !!authData.refresh_token,
        hasUser: !!authData.user,
        userKeys: authData.user ? Object.keys(authData.user) : []
      });
      
      // Validate response structure with detailed error
      if (!authData.access_token) {
        console.error('AuthService: Missing access_token in response');
        throw new Error('Invalid response: missing access token');
      }
      if (!authData.refresh_token) {
        console.error('AuthService: Missing refresh_token in response');
        throw new Error('Invalid response: missing refresh token');
      }
      if (!authData.user) {
        console.error('AuthService: Missing user in response');
        throw new Error('Invalid response: missing user data');
      }
      
      // Store tokens in localStorage
      localStorage.setItem('accessToken', authData.access_token);
      localStorage.setItem('refreshToken', authData.refresh_token);
      localStorage.setItem('user', JSON.stringify(authData.user));

      console.log('AuthService: Tokens stored in localStorage');

      return {
        user: authData.user,
        accessToken: authData.access_token,
        refreshToken: authData.refresh_token,
      };
    } catch (error) {
      console.error('AuthService: Error during registration:', error);
      throw error;
    }
  }

  static async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      console.log('AuthService: Attempting login to:', `${API_BASE_URL}/auth/login`);
      console.log('AuthService: Login data:', data);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('AuthService: Response status:', response.status);
      console.log('AuthService: Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        console.error('AuthService: Error response:', errorData);
        throw new Error(errorData.message || 'Login failed');
      }

      const result = await response.json();
      console.log('AuthService: Login successful, full response:', result);
      
      // Backend wraps response in a 'data' object
      const authData = result.data || result;
      
      console.log('AuthService: Login data structure:', {
        hasAccessToken: !!authData.access_token,
        hasRefreshToken: !!authData.refresh_token,
        hasUser: !!authData.user,
        userKeys: authData.user ? Object.keys(authData.user) : []
      });
      
      // Validate response structure with detailed error
      if (!authData.access_token) {
        console.error('AuthService: Missing access_token in response');
        throw new Error('Invalid response: missing access token');
      }
      if (!authData.refresh_token) {
        console.error('AuthService: Missing refresh_token in response');
        throw new Error('Invalid response: missing refresh token');
      }
      if (!authData.user) {
        console.error('AuthService: Missing user in response');
        throw new Error('Invalid response: missing user data');
      }
      
      // Store tokens in localStorage
      localStorage.setItem('accessToken', authData.access_token);
      localStorage.setItem('refreshToken', authData.refresh_token);
      localStorage.setItem('user', JSON.stringify(authData.user));

      console.log('AuthService: Tokens stored in localStorage');

      return {
        user: authData.user,
        accessToken: authData.access_token,
        refreshToken: authData.refresh_token,
      };
    } catch (error) {
      console.error('AuthService: Error during login:', error);
      throw error;
    }
  }

  static async logout(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Clear local storage regardless of API call success
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      // Clear AVA session state on logout
      localStorage.removeItem('ava-session-state');
      localStorage.removeItem('ava-chat-session');
      localStorage.removeItem('currentWorkspace');
      localStorage.removeItem('hasCompletedPayment');
    }
  }

  private static refreshPromise: Promise<AuthResponse> | null = null;

  static async refreshToken(): Promise<AuthResponse> {
    // If a refresh is already in progress, return the same promise to prevent race conditions
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Token refresh failed' }));
          throw new Error(errorData.message || 'Token refresh failed');
        }

        const result = await response.json();
        
        // Backend wraps response in a 'data' object
        const authData = result.data || result;
        
        // Validate that we have the required data
        if (!authData.access_token) {
          throw new Error('Invalid refresh response: missing access token');
        }
        if (!authData.refresh_token) {
          throw new Error('Invalid refresh response: missing refresh token');
        }
        
        // Update tokens in localStorage
        localStorage.setItem('accessToken', authData.access_token);
        localStorage.setItem('refreshToken', authData.refresh_token);
        if (authData.user) {
          localStorage.setItem('user', JSON.stringify(authData.user));
        }

        return {
          user: authData.user || this.getCurrentUser(),
          accessToken: authData.access_token,
          refreshToken: authData.refresh_token,
        };
      } catch (error) {
        console.error('Error refreshing token:', error);
        // Clear tokens on refresh failure
        this.logout();
        throw error;
      } finally {
        // Clear the promise so future refreshes can proceed
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  static getCurrentUser(): User | null {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  static isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  /**
   * Decode JWT token to get expiration time
   * Returns expiration timestamp in seconds, or null if token is invalid
   */
  private static getTokenExpiration(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired or will expire soon (within 5 minutes)
   * Returns true if token needs refresh
   */
  static shouldRefreshToken(): boolean {
    const token = this.getAccessToken();
    if (!token) {
      return false;
    }

    const exp = this.getTokenExpiration(token);
    if (!exp) {
      return true; // Invalid token, should refresh
    }

    // Check if token expires within 5 minutes (300 seconds)
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = exp - now;
    return timeUntilExpiry < 300; // 5 minutes
  }

  /**
   * Proactively refresh token if it's about to expire
   * This should be called before making API requests
   */
  static async ensureValidToken(): Promise<void> {
    if (this.shouldRefreshToken()) {
      try {
        console.log('🔄 Token expiring soon, refreshing proactively...');
        await this.refreshToken();
      } catch (error) {
        console.error('⚠️ Proactive token refresh failed:', error);
        // Don't throw - let the request proceed and fail naturally if needed
      }
    }
  }

  static async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    // Proactively refresh token if it's about to expire
    await this.ensureValidToken();

    const token = this.getAccessToken();
    
    if (!token) {
      throw new Error('No access token available');
    }

    // Make the initial request
    let response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    // If token is expired, try to refresh and retry
    if (response.status === 401) {
      try {
        console.log('🔄 Token expired, refreshing...');
        await this.refreshToken();
        // Retry the request with new token
        const newToken = this.getAccessToken();
        if (!newToken) {
          throw new Error('Failed to get new token after refresh');
        }
        response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
            ...options.headers,
          },
        });
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        // Refresh failed, clear auth and redirect to login
        this.logout();
        // Only redirect if we're not already on the login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        throw refreshError;
      }
    }

    return response;
  }

  static async forgotPassword(email: string): Promise<void> {
    try {
      console.log('AuthService: Requesting password reset for:', email);
      
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      console.log('AuthService: Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to send reset email' }));
        console.error('AuthService: Error response:', errorData);
        throw new Error(errorData.message || 'Failed to send reset email');
      }

      console.log('AuthService: Password reset email sent successfully');
    } catch (error) {
      console.error('AuthService: Error during forgot password:', error);
      throw error;
    }
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      console.log('AuthService: Resetting password with token');
      
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password: newPassword }),
      });

      console.log('AuthService: Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to reset password' }));
        console.error('AuthService: Error response:', errorData);
        throw new Error(errorData.message || 'Failed to reset password. The link may have expired.');
      }

      console.log('AuthService: Password reset successfully');
    } catch (error) {
      console.error('AuthService: Error during password reset:', error);
      throw error;
    }
  }

  
}
