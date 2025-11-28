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
          "fixed left-0 top-0 h-screen bg-slate-900/60 backdrop-blur-xl border-r border-slate-800 z-40 transition-all duration-300 flex flex-col",
          isCollapsed ? "w-16" : "w-72",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo Section */}
        <div className={cn("p-6 flex items-center gap-3 border-b border-slate-800/50", isCollapsed && "justify-center")}>
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 flex-shrink-0">
            <Box className="text-white w-6 h-6" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-xl tracking-tight text-white">VOXBOX</h1>
              <p className="text-xs text-cyan-400 font-medium tracking-wider">AI SUITE</p>
            </div>
          )}
        </div>

        {/* Compact floating collapse toggle */}
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
              "absolute top-4 -right-3 h-7 w-7 rounded-full bg-slate-800 border border-slate-700 shadow-sm hover:bg-slate-700 transition-all duration-200 flex items-center justify-center z-50",
              isCollapsed && "right-[-14px]"
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            )}
          </Button>
        )}

        {/* Navigation with Scroll Controls */}
        <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
          {/* Scrollable Navigation */}
          <nav
            ref={scrollContainerRef}
            className={cn(
              "flex-1 overflow-y-auto overflow-x-hidden space-y-1 transition-all duration-300",
              "scrollbar-hide",
              isCollapsed ? "p-2 pr-4" : "px-4 py-4"
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
                    "flex items-center rounded-xl text-sm font-medium transition-all duration-300 group",
                    isCollapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/20"
                      : isDisabled
                      ? "text-slate-500 cursor-not-allowed opacity-50"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  )}
                  onClick={(e) => {
                    if (isDisabled) {
                      e.preventDefault();
                    }
                  }}
                  title={isCollapsed ? item.label : isDisabled ? "Complete payment to access" : ""}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 flex-shrink-0 transition-colors",
                      isActive
                        ? "text-cyan-400"
                        : "text-slate-500 group-hover:text-white"
                    )}
                  />
                  {!isCollapsed && <span className="leading-none">{item.label}</span>}
                  {!isCollapsed && isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Custom Scrollbar Arrows - Right Side */}
          {!isCollapsed && (showTopArrow || showBottomArrow) && (
            <div className="absolute right-0 top-0 bottom-0 w-5 flex flex-col items-center justify-between py-1 pointer-events-none z-30">
              {showTopArrow && (
                <button
                  onClick={scrollUp}
                  className="w-5 h-5 flex items-center justify-center bg-transparent hover:bg-slate-800 active:bg-slate-700 rounded-sm pointer-events-auto transition-colors duration-150 cursor-pointer border-0 outline-none focus:outline-none"
                  title="Scroll up"
                  aria-label="Scroll up"
                  type="button"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 rotate-180" strokeWidth={2.5} />
                </button>
              )}

              {showBottomArrow && (
                <button
                  onClick={scrollDown}
                  className="w-5 h-5 flex items-center justify-center bg-transparent hover:bg-slate-800 active:bg-slate-700 rounded-sm pointer-events-auto transition-colors duration-150 cursor-pointer border-0 outline-none focus:outline-none"
                  title="Scroll down"
                  aria-label="Scroll down"
                  type="button"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" strokeWidth={2.5} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* User Profile Snippet */}
        {!isCollapsed && (
          <div className="p-4 border-t border-slate-800/50">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/60 cursor-pointer transition-colors border border-slate-700/30">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                {getUserInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name || "User"}</p>
                <p className="text-xs text-slate-400 truncate">
                  {subscription?.plan
                    ? `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan`
                    : "Free Plan"}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
