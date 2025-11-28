// Payment service for handling Stripe checkout sessions
import { AuthService } from './auth';

import { API_BASE_URL } from '@/config/api.config';

export interface CheckoutSessionRequest {
  plan: 'pro' | 'team';
  workspaceId?: string; // Optional - will be created automatically if not provided
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  trialPeriodDays?: number;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
  stripeSubId: string | null;
  message: string;
  webhookUrl: string;
  note: string;
}

export interface SubscriptionStatus {
  hasSubscription: boolean;
  workspaceId: string;
  plan?: string;
  status?: string;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  cancelAt?: string;
  canceledAt?: string;
  hasUnusedSubscription?: boolean;
  unusedSubscriptionCount?: number;
}

export class PaymentService {
  static async createCheckoutSession(data: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    try {
      console.log('PaymentService: Creating checkout session');
      console.log('PaymentService: Data:', data);
      
      // Check if user is authenticated
      const isAuthenticated = AuthService.isAuthenticated();
      console.log('PaymentService: User authenticated:', isAuthenticated);
      
      let response;
      if (isAuthenticated) {
        // Use authenticated request
        console.log('PaymentService: Using authenticated request');
        response = await AuthService.makeAuthenticatedRequest(
          `${API_BASE_URL}/subscriptions/checkout-session`,
          {
            method: 'POST',
            body: JSON.stringify(data),
          }
        );
      } else {
        // Use public request (no authentication required)
        console.log('PaymentService: Using public request');
        console.log('PaymentService: Request URL:', `${API_BASE_URL}/subscriptions/checkout-session`);
        response = await fetch(`${API_BASE_URL}/subscriptions/checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
      }

      console.log('PaymentService: Response status:', response.status);
      console.log('PaymentService: Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('PaymentService: Error response:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('PaymentService: Checkout session created, full response:', result);
      
      // Backend wraps response in a 'data' object
      const sessionData = result.data || result;
      
      console.log('PaymentService: Checkout session data:', sessionData);
      
      // Ensure the response has the expected structure
      if (!sessionData.sessionId || !sessionData.url) {
        console.error('PaymentService: Invalid response structure');
        throw new Error('Invalid response from checkout session API');
      }
      
      return sessionData;
    } catch (error) {
      console.error('PaymentService: Error creating checkout session:', error);
      throw error;
    }
  }

  static async handlePaymentSuccess(sessionId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/subscriptions/payment-success?session_id=${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (error) {
      console.error('Error handling payment success:', error);
      throw error;
    }
  }

  static async getUserSubscription(userId: string): Promise<SubscriptionStatus> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/subscriptions/user/${userId}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  static async getUserSubscriptionStatus(userId: string): Promise<any> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/subscriptions/status/${userId}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  }

  static async debugUserSubscription(userId: string): Promise<any> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/subscriptions/debug/${userId}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Debug subscription data:', result);
      return result.data || result;
    } catch (error) {
      console.error('Error getting debug subscription data:', error);
      throw error;
    }
  }

  static async checkUnusedSubscriptions(userId: string): Promise<any> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/subscriptions/unused/${userId}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Unused subscriptions data:', result);
      return result.data || result;
    } catch (error) {
      console.error('Error checking unused subscriptions:', error);
      throw error;
    }
  }

  static async cancelSubscription(workspaceId: string, immediately: boolean = false): Promise<any> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/subscriptions/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({
            workspaceId,
            immediately,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }
}

// Utility function to redirect to Stripe checkout
export const redirectToCheckout = async (plan: 'pro' | 'team', workspaceId?: string) => {
  try {
    console.log('redirectToCheckout: Starting checkout process');
    const baseUrl = window.location.origin;
    const user = AuthService.getCurrentUser();
    
    console.log('redirectToCheckout: Base URL:', baseUrl);
    console.log('redirectToCheckout: User:', user);
    console.log('redirectToCheckout: Plan:', plan);
    console.log('redirectToCheckout: Workspace ID:', workspaceId);
    
    const checkoutData: CheckoutSessionRequest = {
      plan,
      workspaceId, // Optional - will be created automatically if not provided
      successUrl: `${baseUrl}/thank-you`,
      cancelUrl: `${baseUrl}/cancel`,
      customerEmail: user?.email,
      // Removed trial period to make subscriptions active immediately
    };

    console.log('redirectToCheckout: Checkout data:', checkoutData);
    const session = await PaymentService.createCheckoutSession(checkoutData);
    console.log('redirectToCheckout: Session created:', session);
    
    // Validate session response
    if (!session || !session.url) {
      throw new Error('Invalid checkout session response');
    }
    
    // Redirect to Stripe checkout
    console.log('redirectToCheckout: Redirecting to:', session.url);
    window.location.href = session.url;
  } catch (error) {
    console.error('redirectToCheckout: Error redirecting to checkout:', error);
    throw error;
  }
};

// Utility function for authenticated users
export const redirectToAuthenticatedCheckout = async (plan: 'pro' | 'team') => {
  const user = AuthService.getCurrentUser();
  if (!user) {
    throw new Error('User must be authenticated');
  }
  
  // Don't pass workspaceId - let the backend create it automatically
  return redirectToCheckout(plan);
};
