import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  User,
  LogOut,
  Settings as SettingsIcon,
  Building2,
  ChevronDown,
  Check,
  Plus,
  Menu,
  Bell,
  Search,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceStatusBadge } from "@/components/workspace/WorkspaceStatusBadge";
import { WorkspaceSwitchConfirmDialog } from "@/components/workspace/WorkspaceSwitchConfirmDialog";
import { WorkspaceSuccessModal } from "@/components/workspace/WorkspaceSuccessModal";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { SubscriptionStatus } from "@/lib/payment";
import { toast } from "sonner";

const AppNavbar = ({ onMenuClick }: { onMenuClick?: () => void }) => {
  const { user, logout } = useAuth();
  const {
    currentWorkspace,
    workspaces,
    isLoading: workspacesLoading,
    setCurrentWorkspace,
  } = useWorkspace();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdWorkspaceName] = useState("");
  const [targetWorkspace, setTargetWorkspace] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  
  // AVA Progress data from localStorage (updated by AVA Phase 1)
  const [avaProgress, setAvaProgress] = useState<{
    isScrolled: boolean;
    currentQuestionIndex: number;
    totalQuestions: number;
  } | null>(null);

  const isAvaPage = location.pathname === "/tools/ava";

  // Listen for AVA progress updates via custom event
  useEffect(() => {
    const handleAvaProgress = (e: CustomEvent) => {
      setAvaProgress(e.detail);
    };

    const handleStorageChange = () => {
      const progressData = localStorage.getItem("avaProgressData");
      if (progressData) {
        setAvaProgress(JSON.parse(progressData));
      } else {
        setAvaProgress(null);
      }
    };

    window.addEventListener("avaProgressUpdate" as any, handleAvaProgress);
    window.addEventListener("storage", handleStorageChange);
    
    // Check initial state
    const progressData = localStorage.getItem("avaProgressData");
    if (progressData) {
      setAvaProgress(JSON.parse(progressData));
    }

    return () => {
      window.removeEventListener("avaProgressUpdate" as any, handleAvaProgress);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Calculate progress percentage
  const getProgressValue = () => {
    if (!avaProgress || !avaProgress.isScrolled) return 0;
    const { currentQuestionIndex, totalQuestions } = avaProgress;
    if (!totalQuestions || totalQuestions === 0) return 0;
    if (currentQuestionIndex >= totalQuestions) return 100;
    const percentage = (currentQuestionIndex / totalQuestions) * 100;
    return Math.min(100, Math.max(0, isNaN(percentage) ? 0 : percentage));
  };

  // Load subscription information
  useEffect(() => {
    const loadSubscription = async () => {
      if (!user) {
        setSubscription(null);
        return;
      }

      try {
        const { PaymentService } = await import("@/lib/payment");

        const subscriptionData = await PaymentService.getUserSubscription(user.id);
        console.log("AppNavbar - Loaded subscription:", subscriptionData);

        const unusedData = await PaymentService.checkUnusedSubscriptions(user.id);
        console.log("AppNavbar - Unused subscriptions:", unusedData);

        if (subscriptionData && subscriptionData.hasSubscription) {
          setSubscription({
            ...subscriptionData,
            hasUnusedSubscription: unusedData.hasUnusedSubscription,
            unusedSubscriptionCount: unusedData.unusedSubscriptionCount,
          });
        } else {
          if (workspaces && workspaces.length > 0) {
            console.log("AppNavbar - User has", workspaces.length, "workspace(s) - subscription active");
            setSubscription({
              hasSubscription: true,
              workspaceId: `workspace_${user.id}`,
              plan: "pro",
              status: "active",
              hasUnusedSubscription: unusedData.hasUnusedSubscription,
              unusedSubscriptionCount: unusedData.unusedSubscriptionCount,
            });
          } else {
            console.log("AppNavbar - User has no subscription");
            setSubscription({
              hasSubscription: false,
              workspaceId: `workspace_${user.id}`,
              hasUnusedSubscription: false,
              unusedSubscriptionCount: 0,
            });
          }
        }
      } catch (error) {
        console.error("AppNavbar - Error loading subscription:", error);
        if (workspaces && workspaces.length > 0) {
          setSubscription({
            hasSubscription: true,
            workspaceId: `workspace_${user.id}`,
            plan: "pro",
            status: "active",
            hasUnusedSubscription: false,
            unusedSubscriptionCount: 0,
          });
        } else {
          setSubscription({
            hasSubscription: false,
            workspaceId: `workspace_${user.id}`,
            hasUnusedSubscription: false,
            unusedSubscriptionCount: 0,
          });
        }
      }
    };

    loadSubscription();
  }, [user, workspaces.length]);

  const handleWorkspaceSelect = (workspaceId: string, workspaceName: string) => {
    if (workspaceId === currentWorkspace?.id) return;
    setTargetWorkspace(workspaceName);
    setShowSwitchConfirm(true);
  };

  const confirmWorkspaceSwitch = () => {
    if (targetWorkspace) {
      const targetWorkspaceData = workspaces.find((w) => w.name === targetWorkspace);
      if (targetWorkspaceData) {
        setCurrentWorkspace(targetWorkspaceData);
        setShowSwitchConfirm(false);
        toast.success(`Switched to ${targetWorkspace}`);
      }
    }
  };

  const handleCreateWorkspaceClick = () => {
    console.log("AppNavbar - Create workspace clicked, subscription status:", {
      hasSubscription: subscription?.hasSubscription,
      subscription,
      workspacesCount: workspaces?.length || 0,
    });

    if (!subscription?.hasSubscription) {
      window.location.href = "/pricing";
      return;
    }

    if (!canCreateWorkspace) {
      if (workspaces && workspaces.length > 0) {
        window.location.href = "/pricing";
      }
      return;
    }

    navigate("/create-workspace");
  };

  const hasRecentPayment = searchParams.get("payment_success") === "true" || searchParams.get("session_id");

  const canCreateWorkspace =
    subscription?.hasSubscription &&
    ((!workspaces || workspaces.length === 0) ||
      (subscription as any).hasUnusedSubscription ||
      hasRecentPayment);

  return (
    <nav className={`${isAvaPage && avaProgress?.isScrolled ? "pb-1" : ""} px-4 md:px-8 flex flex-col border-b border-slate-800/50 bg-slate-900/20 backdrop-blur-sm z-20 w-full transition-all duration-300`}>
      {/* Main Navbar Content */}
      <div className="h-20 flex items-center justify-between gap-4">
        {/* Left Section: Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search workspaces, profiles or templates..."
            className="w-full bg-slate-950/50 border border-slate-800 rounded-full pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
          />
        </div>

        {/* Right Section: Mobile Menu + Workspace Switcher + Notifications + User Menu */}
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-white hover:bg-slate-800/50 md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>
        {/* Workspace Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="px-2 md:px-4 py-2 h-auto rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 text-slate-200 max-w-[200px] md:max-w-none"
            >
              <Building2 className="w-4 h-4 mr-1 md:mr-2 text-slate-400 flex-shrink-0" />
              <span className="text-slate-200 font-semibold text-xs md:text-sm truncate">
                {currentWorkspace?.name || "Select Workspace"}
              </span>
              <ChevronDown className="w-4 h-4 ml-1 md:ml-2 text-slate-400 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 z-[70] bg-slate-900 border-slate-700">
            <DropdownMenuLabel className="text-white">Switch Workspace</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-700" />
            {workspacesLoading ? (
              <DropdownMenuItem disabled className="flex items-center justify-center py-3 text-slate-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400 mr-2"></div>
                Loading workspaces...
              </DropdownMenuItem>
            ) : workspaces.length === 0 ? (
              <DropdownMenuItem disabled className="flex items-center justify-center py-3 text-slate-500">
                No workspaces found
              </DropdownMenuItem>
            ) : (
              workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  className="flex items-center justify-between cursor-pointer py-3 text-slate-200 hover:bg-slate-800 hover:text-white"
                  onClick={() => handleWorkspaceSelect(workspace.id, workspace.name)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{workspace.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <WorkspaceStatusBadge status="active" />
                    {workspace.id === currentWorkspace?.id && (
                      <Check className="w-4 h-4 text-cyan-400" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer text-cyan-400 hover:bg-slate-800 hover:text-cyan-300"
              onClick={handleCreateWorkspaceClick}
              title="Create a new workspace"
            >
              <Plus className="w-4 h-4" />
              Create New Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>


        {/* Notifications */}
        <button className="relative p-2.5 rounded-full hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-900"></span>
        </button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800/50">
              <User className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 z-[70] bg-slate-900 border-slate-700">
            <DropdownMenuLabel className="text-white">
              <div className="flex flex-col">
                <span className="font-semibold">{user?.name}</span>
                <span className="text-xs text-slate-400">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem asChild className="text-slate-200 hover:bg-slate-800 hover:text-white">
              <Link to="/profile" className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-slate-200 hover:bg-slate-800 hover:text-white">
              <Link to="/workspace/settings" className="cursor-pointer">
                <SettingsIcon className="w-4 h-4 mr-2" />
                Workspace Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-slate-200 hover:bg-slate-800 hover:text-white">
              <Link to="/billing" className="cursor-pointer">
                <SettingsIcon className="w-4 h-4 mr-2" />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem
              className="cursor-pointer text-red-400 hover:bg-slate-800 hover:text-red-300"
              onClick={async () => {
                try {
                  await logout();
                  navigate("/login");
                } catch (error) {
                  console.error("Logout error:", error);
                  navigate("/login");
                }
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>

      {/* Progress Bar - Show when AVA Phase 1 is scrolled */}
      {isAvaPage && avaProgress?.isScrolled && (
        <div className="px-4 md:px-8 pb-1 flex items-center gap-2">
          <div className="flex-1 bg-slate-800/50 rounded-full h-0.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${getProgressValue()}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-slate-400 min-w-[2.5rem] text-right">
            {Math.round(getProgressValue())}%
          </span>
        </div>
      )}

      {/* Modals */}
      <WorkspaceSwitchConfirmDialog
        open={showSwitchConfirm}
        onOpenChange={setShowSwitchConfirm}
        currentWorkspace={currentWorkspace?.name || ""}
        targetWorkspace={targetWorkspace || ""}
        onConfirm={confirmWorkspaceSwitch}
      />

      <WorkspaceSuccessModal
        key={`success-modal-${createdWorkspaceName}`}
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        workspaceName={createdWorkspaceName}
        onContinue={() => {
          console.log("User continued from navbar success modal");
          setShowSuccessModal(false);
        }}
      />
    </nav>
  );
};

export default AppNavbar;
