import { Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Mic,
  Magnet,
  Zap,
  FolderOpen,
  History,
  FileText,
  UsersRound,
  Settings,
  CreditCard,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentService } from "@/lib/payment";
import type { SubscriptionStatus } from "@/lib/payment";

interface SidebarProps {
  isOpen: boolean;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
}

const Sidebar = ({ isOpen, isCollapsed = false, onCollapseToggle }: SidebarProps) => {
  const location = useLocation();
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showTopArrow, setShowTopArrow] = useState(false);
  const [showBottomArrow, setShowBottomArrow] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", disabled: false },
    { icon: Users, label: "AVA Creator", path: "/tools/ava" },
    { icon: Package, label: "Product Tools", path: "/tools/products" },
    { icon: Mic, label: "Vera Creator", path: "/tools/vera" },
    { icon: Magnet, label: "Lead Magnet", path: "/tools/lead-magnet" },
    { icon: Zap, label: "Amplifiers", path: "/amplifiers" },
    { icon: FolderOpen, label: "My Profiles", path: "/profiles" },
    { icon: History, label: "Output History", path: "/outputs" },
    { icon: FileText, label: "Templates", path: "/templates" },
    { icon: UsersRound, label: "Team", path: "/team" },
    { icon: CreditCard, label: "Billing", path: "/billing" },
    { icon: Settings, label: "Workspace", path: "/workspace/settings" },
  ];

  // Load subscription for plan display
  useEffect(() => {
    const loadSubscription = async () => {
      if (!user) return;
      try {
        const subscriptionData = await PaymentService.getUserSubscription(user.id);
        if (subscriptionData && subscriptionData.hasSubscription) {
          setSubscription(subscriptionData);
        } else {
          setSubscription({
            hasSubscription: false,
            workspaceId: `workspace_${user.id}`,
            plan: "free",
            status: "inactive",
          });
        }
      } catch (error) {
        console.error("Error loading subscription:", error);
        setSubscription({
          hasSubscription: false,
          workspaceId: `workspace_${user.id}`,
          plan: "free",
          status: "inactive",
        });
      }
    };
    loadSubscription();
  }, [user]);

  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollHeight, clientHeight } = container;
    const threshold = 5;
    const isScrollable = scrollHeight > clientHeight + threshold;

    setShowTopArrow(isScrollable);
    setShowBottomArrow(isScrollable);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollButtons();
    container.addEventListener("scroll", checkScrollButtons);

    const resizeObserver = new ResizeObserver(checkScrollButtons);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", checkScrollButtons);
      resizeObserver.disconnect();
    };
  }, [isCollapsed, isOpen]);

  const scrollUp = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 50;
      container.scrollBy({ top: -scrollAmount, behavior: "smooth" });
    }
  };

  const scrollDown = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 50;
      container.scrollBy({ top: scrollAmount, behavior: "smooth" });
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.name) {
      const names = user.name.split(" ");
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30 md:hidden"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-900/95 backdrop-blur-2xl border-r border-slate-800/60 z-40 transition-all duration-300 flex flex-col shadow-2xl",
          isCollapsed ? "w-16" : "w-72",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo Section - Modern ChatGPT-style */}
        <div className={cn(
          "relative p-5 flex items-center gap-3 border-b border-slate-800/40 transition-all duration-300",
          isCollapsed && "justify-center px-0"
        )}>
          <div className="relative w-10 h-10 bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30 flex-shrink-0 group-hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-105">
            <Box className="text-white w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-purple-500/20 rounded-xl blur-sm" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <h1 className="font-bold text-lg tracking-tight text-white bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
                VOXBOX
              </h1>
              <p className="text-[10px] text-cyan-400/80 font-medium tracking-[0.15em] uppercase">
                AI SUITE
              </p>
            </div>
          )}
        </div>

        {/* Compact floating collapse toggle - Modern ChatGPT-style */}
        {onCollapseToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCollapseToggle();
            }}
            className={cn(
              "absolute top-5 -right-3 h-8 w-8 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 shadow-lg hover:bg-slate-700/80 hover:border-cyan-500/30 hover:shadow-cyan-500/20 transition-all duration-300 flex items-center justify-center z-50 group",
              isCollapsed && "right-[-16px]"
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors duration-300" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors duration-300" />
            )}
          </Button>
        )}

        {/* Navigation with Scroll Controls */}
        <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
          {/* Scrollable Navigation */}
          <nav
            ref={scrollContainerRef}
            className={cn(
              "flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300",
              "scrollbar-hide",
              isCollapsed ? "p-2 pr-4 space-y-1" : "px-3 py-3 space-y-1"
            )}
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {menuItems.map((item) => {
              const Icon = item.icon;
              const productToolPaths = ["/tools/products", "/tools/margo", "/tools/product-refiner"];
              const isProductItem = item.path === "/tools/products";
              const isActive =
                isProductItem
                  ? productToolPaths.some((path) => location.pathname.startsWith(path))
                  : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              const isDisabled = item.disabled === true;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "relative flex items-center rounded-lg text-sm font-medium transition-all duration-300 group overflow-hidden",
                    isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-lg shadow-cyan-500/10"
                      : isDisabled
                      ? "text-slate-500 cursor-not-allowed opacity-50"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/40 hover:border-l-2 hover:border-slate-700"
                  )}
                  onClick={(e) => {
                    if (isDisabled) {
                      e.preventDefault();
                    }
                  }}
                  title={isCollapsed ? item.label : isDisabled ? "Complete payment to access" : ""}
                >
                  {/* Active indicator glow effect */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent rounded-lg" />
                  )}
                  
                  {/* Hover effect overlay */}
                  {!isActive && !isDisabled && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
                  )}
                  
                  <Icon
                    className={cn(
                      "relative z-10 w-5 h-5 flex-shrink-0 transition-all duration-300",
                      isActive
                        ? "text-cyan-400 scale-110"
                        : "text-slate-400 group-hover:text-white group-hover:scale-105"
                    )}
                  />
                  {!isCollapsed && (
                    <span className="relative z-10 leading-tight font-medium">{item.label}</span>
                  )}
                  {!isCollapsed && isActive && (
                    <div className="ml-auto relative z-10 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)] animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Custom Scrollbar Arrows - Right Side - Modern ChatGPT-style */}
          {!isCollapsed && (showTopArrow || showBottomArrow) && (
            <div className="absolute right-2 top-0 bottom-0 w-6 flex flex-col items-center justify-between py-2 pointer-events-none z-30">
              {showTopArrow && (
                <button
                  onClick={scrollUp}
                  className="w-6 h-6 flex items-center justify-center bg-slate-800/60 backdrop-blur-sm hover:bg-slate-700/80 active:bg-slate-600 rounded-md pointer-events-auto transition-all duration-200 cursor-pointer border border-slate-700/50 hover:border-cyan-500/30 hover:shadow-md hover:shadow-cyan-500/10 outline-none focus:outline-none group"
                  title="Scroll up"
                  aria-label="Scroll up"
                  type="button"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 rotate-180 transition-colors duration-200" strokeWidth={2.5} />
                </button>
              )}

              {showBottomArrow && (
                <button
                  onClick={scrollDown}
                  className="w-6 h-6 flex items-center justify-center bg-slate-800/60 backdrop-blur-sm hover:bg-slate-700/80 active:bg-slate-600 rounded-md pointer-events-auto transition-all duration-200 cursor-pointer border border-slate-700/50 hover:border-cyan-500/30 hover:shadow-md hover:shadow-cyan-500/10 outline-none focus:outline-none group"
                  title="Scroll down"
                  aria-label="Scroll down"
                  type="button"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors duration-200" strokeWidth={2.5} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* User Profile Snippet - Modern ChatGPT-style */}
        {!isCollapsed && (
          <div className="p-4 border-t border-slate-800/40">
            <div className="group relative flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-800/30 hover:from-slate-800/70 hover:to-slate-800/50 cursor-pointer transition-all duration-300 border border-slate-700/40 hover:border-slate-700/60 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden">
              {/* Hover glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative z-10 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 group-hover:scale-105 transition-all duration-300">
                {getUserInitials()}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
              </div>
              <div className="relative z-10 flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-100 transition-colors duration-300">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-slate-400 truncate group-hover:text-slate-300 transition-colors duration-300">
                  {subscription?.plan
                    ? `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan`
                    : "Free Plan"}
                </p>
              </div>
              <ChevronDown className="relative z-10 w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-y-0.5 transition-all duration-300 flex-shrink-0" />
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
