import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import About from "@/components/About";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentService } from "@/lib/payment";
import { WorkspaceService } from "@/lib/workspace";

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const hasCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    const checkUserStatus = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      // If not authenticated, show the landing page
      if (!isAuthenticated || !user) {
        hasCheckedRef.current = null;
        return;
      }

      // Prevent multiple checks for the same user
      if (isChecking || hasCheckedRef.current === user.id) {
        return;
      }

      setIsChecking(true);
      hasCheckedRef.current = user.id;

      console.log('Index - Checking user status for user:', user.id);

      try {
        // Priority: Check workspaces first - if user has workspaces, they must have paid
        // This is the most reliable indicator since workspaces can only be created after payment
        // Fetch workspaces directly to ensure we have the latest data
        try {
          const workspaces = await WorkspaceService.getWorkspaces();
          console.log('Index - Fetched workspaces:', workspaces?.length || 0, workspaces);
          
          if (workspaces && workspaces.length > 0) {
            // User has workspaces → they have subscription → redirect to dashboard
            console.log('Index - User has workspaces, redirecting to dashboard. Workspaces:', workspaces.map(w => w.name));
            navigate('/dashboard', { replace: true });
            return;
          }
        } catch (workspaceError) {
          console.error('Index - Error fetching workspaces:', workspaceError);
          // Continue to check subscription as fallback
        }

        // If no workspaces, check subscription status from API
        console.log('Index - No workspaces found, checking subscription status...');
        const subscription = await PaymentService.getUserSubscription(user.id);
        console.log('Index - Subscription check result:', subscription);
        
        // Check if user has subscription
        const hasSubscription = subscription && subscription.hasSubscription;
        
        if (hasSubscription) {
          // User has subscription but no workspace → redirect to pricing
          console.log('Index - User has subscription but no workspace - redirecting to pricing');
          navigate('/pricing', { replace: true });
        } else {
          // User has no subscription → redirect to pricing
          console.log('Index - User has no subscription - redirecting to pricing');
          navigate('/pricing', { replace: true });
        }
      } catch (error) {
        console.error('Index - Error checking user status:', error);
        // On error, default to pricing
        console.log('Index - Error occurred - redirecting to pricing');
        navigate('/pricing', { replace: true });
      } finally {
        setIsChecking(false);
      }
    };

    checkUserStatus();
  }, [isAuthenticated, user, authLoading, navigate]);

  // Show loading state while checking
  if (authLoading || (isAuthenticated && isChecking)) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/80">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <About />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
