import { Button } from "@/components/ui/button";
import { Menu, X, User, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import voxboxLogoWhite from "@/assets/voxbox-logo-white.png";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDashboard, setShowDashboard] = useState(true);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);

  // Check subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (isAuthenticated && user) {
        try {
          const { PaymentService } = await import('@/lib/payment');
          const subscription = await PaymentService.getUserSubscription(user.id);
          setHasSubscription(subscription?.hasSubscription || false);
        } catch (error) {
          console.error('Error checking subscription:', error);
          setHasSubscription(false);
        }
      } else {
        setHasSubscription(null);
      }
    };

    checkSubscription();
  }, [isAuthenticated, user]);

  // Hide Dashboard for new users who haven't completed payment
  // Also hide on pricing route for users without subscription
  useEffect(() => {
    if (isAuthenticated) {
      const isPricingRoute = location.pathname === '/pricing';
      
      // If on pricing route and user has no subscription, hide dashboard
      if (isPricingRoute && hasSubscription === false) {
        setShowDashboard(false);
        return;
      }

      // If on pricing route and user has subscription, show dashboard
      if (isPricingRoute && hasSubscription === true) {
        setShowDashboard(true);
        return;
      }

      const isNewUser = localStorage.getItem('isNewUser') === 'true';
      if (isNewUser) {
        // Check if they have completed payment (subscription or payment_success param)
        const urlParams = new URLSearchParams(location.search);
        const paymentSuccess = urlParams.get('payment_success') === 'true';
        const localHasSubscription = localStorage.getItem('hasSubscription') === 'true';
        // Hide dashboard if new user and no subscription/payment success
        setShowDashboard(localHasSubscription || paymentSuccess || false);
      } else {
        // Existing users always see dashboard (unless on pricing without subscription, handled above)
        setShowDashboard(true);
      }
    } else {
      setShowDashboard(true);
    }
  }, [isAuthenticated, location.search, location.pathname, hasSubscription]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/dashboard');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Helper function to check if a route is active
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Helper function to get link classes with active state
  const getLinkClasses = (path: string) => {
    const baseClasses = "font-sans font-semibold transition-colors";
    const activeClasses = isActive(path)
      ? "text-white border-b-2 border-white"
      : "text-white/80 hover:text-white";
    return `${baseClasses} ${activeClasses}`;
  };

  // Helper function to get mobile link classes with active state
  const getMobileLinkClasses = (path: string) => {
    const baseClasses = "font-sans font-semibold transition-colors py-2";
    const activeClasses = isActive(path)
      ? "text-white border-l-4 border-white pl-4"
      : "text-white/80 hover:text-white";
    return `${baseClasses} ${activeClasses}`;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-vox-dark/80 backdrop-blur-lg border-b border-white/10">
      <div className="container px-6">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <img src={voxboxLogoWhite} alt="VoxBox Logo" className="h-10" />
            {/* <span className="font-heading font-bold text-2xl text-white">VOXBOX</span> */}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className={getLinkClasses("/")}>
              Home
            </Link>
            <Link to="/features" className={getLinkClasses("/features")}>
              Features
            </Link>
            <Link to="/pricing" className={getLinkClasses("/pricing")}>
              Pricing
            </Link>
            <Link to="/contact" className={getLinkClasses("/contact")}>
              Contact
            </Link>
          </div>

          {/* Desktop CTA */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <div className="text-white/80 text-sm">
                  Welcome, {user?.name}
                </div>
                {showDashboard && (
                  <Button asChild variant="ghost" className="font-heading font-semibold text-white hover:text-white hover:bg-white/10">
                    <Link to="/dashboard">
                      <User className="w-4 h-4 mr-2" />
                      Dashboard
                    </Link>
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="font-heading font-semibold text-black border-white hover:bg-white hover:text-vox-dark"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2 text-black" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" className="font-heading font-semibold text-white hover:text-white hover:bg-white/10">
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild className="bg-primary hover:bg-primary/90 font-heading font-bold">
                  <Link to="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button - Only show on very small screens */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="sm:hidden text-white p-2"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation - Only show on very small screens */}
        {isOpen && (
          <div className="sm:hidden py-6 border-t border-white/10">
            <div className="flex flex-col gap-4">
              <Link to="/" className={getMobileLinkClasses("/")} onClick={() => setIsOpen(false)}>
                Home
              </Link>
              <Link to="/features" className={getMobileLinkClasses("/features")} onClick={() => setIsOpen(false)}>
                Features
              </Link>
              <Link to="/pricing" className={getMobileLinkClasses("/pricing")} onClick={() => setIsOpen(false)}>
                Pricing
              </Link>
              <Link to="/contact" className={getMobileLinkClasses("/contact")} onClick={() => setIsOpen(false)}>
                Contact
              </Link>
              <div className="pt-4 flex flex-col gap-3">
                {isAuthenticated ? (
                  <>
                    <div className="text-white/80 text-sm text-center mb-2">
                      Welcome, {user?.name}
                    </div>
                    {showDashboard && (
                      <Button asChild variant="ghost" className="font-heading font-semibold text-white hover:text-white hover:bg-white/10 w-full">
                        <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                          <User className="w-4 h-4 mr-2" />
                          Dashboard
                        </Link>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      className="font-heading font-semibold text-black border-white hover:bg-white hover:text-vox-dark w-full"
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2 text-black" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="ghost" className="font-heading font-semibold text-white hover:text-white hover:bg-white/10 w-full">
                      <Link to="/login" onClick={() => setIsOpen(false)}>Sign In</Link>
                    </Button>
                    <Button asChild className="bg-primary hover:bg-primary/90 font-heading font-bold w-full">
                      <Link to="/register" onClick={() => setIsOpen(false)}>Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
