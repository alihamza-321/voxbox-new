import { useState, useEffect } from "react";
import {
  Users,
  Box,
  Mic,
  Magnet,
  Zap,
  Sparkles,
  TrendingUp,
  Clock,
  Plus,
  Building2,
  FileText,
  Users2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PaymentService } from "@/lib/payment";
import type { SubscriptionStatus } from "@/lib/payment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceSuccessModal } from "@/components/workspace/WorkspaceSuccessModal";

const Dashboard = () => {
  const { user } = useAuth();
  const { workspaces, isLoading: workspacesLoading } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdWorkspaceName] = useState("");
  const [hasCompletedPayment, setHasCompletedPayment] = useState(false);

  // Check if user is new and hasn't paid yet
  useEffect(() => {
    if (workspacesLoading) {
      return;
    }

    const isNewUser = localStorage.getItem("isNewUser");
    const paymentComplete = searchParams.get("payment_success");

    if (workspaces && workspaces.length > 0) {
      if (isNewUser === "true") {
        localStorage.removeItem("isNewUser");
      }
      return;
    }

    if (
      isNewUser === "true" &&
      !paymentComplete &&
      !subscription?.hasSubscription &&
      !subscriptionLoading
    ) {
      console.log("New user without subscription - redirecting to pricing");
      navigate("/pricing", { replace: true });
      return;
    }

    if (isNewUser === "true" && (subscription?.hasSubscription || paymentComplete)) {
      localStorage.removeItem("isNewUser");
    }
  }, [subscription, subscriptionLoading, searchParams, navigate, workspaces, workspacesLoading]);

  // Check for createWorkspace parameter
  useEffect(() => {
    const createWorkspace = searchParams.get("createWorkspace");
    const paymentSuccess = searchParams.get("payment_success");

    if (createWorkspace === "true") {
      if (paymentSuccess === "true" || subscription?.hasSubscription) {
        console.log("Navigating to workspace creation page - payment success or subscription active");
        if (paymentSuccess === "true") {
          setHasCompletedPayment(true);
        }
        navigate("/create-workspace", { replace: true });
      } else if (!subscriptionLoading) {
        setSearchParams({});
        console.log("User does not have active subscription - workspace creation blocked");
      }
    }
  }, [searchParams, setSearchParams, subscription, subscriptionLoading, navigate]);

  // Update hasCompletedPayment when payment success is detected
  useEffect(() => {
    const paymentSuccess = searchParams.get("payment_success");
    const sessionId = searchParams.get("session_id");

    if (paymentSuccess === "true" || sessionId) {
      console.log("Payment success detected - setting hasCompletedPayment to true");
      setHasCompletedPayment(true);
      localStorage.setItem("hasCompletedPayment", "true");
    }
  }, [searchParams]);

  // Check localStorage for payment completion
  useEffect(() => {
    const storedPaymentCompletion = localStorage.getItem("hasCompletedPayment");
    if (storedPaymentCompletion === "true") {
      console.log("Found stored payment completion - setting hasCompletedPayment to true");
      setHasCompletedPayment(true);
    }
  }, []);

  // Check for unused subscriptions
  useEffect(() => {
    const checkUnusedSubscriptions = async () => {
      if (!user || subscriptionLoading) return;

      try {
        console.log("🔍 Checking for unused subscriptions...");
        const unusedData = await PaymentService.checkUnusedSubscriptions(user.id);
        console.log("📊 Unused subscription check result:", unusedData);

        if (unusedData.hasUnusedSubscription && unusedData.unusedSubscriptionCount > 0) {
          console.log("✅ Found unused subscription(s) - enabling workspace creation");
          setHasCompletedPayment(true);
          localStorage.setItem("hasCompletedPayment", "true");
        } else if (
          unusedData.unusedSubscriptionCount === 0 &&
          workspaces &&
          workspaces.length > 0
        ) {
          console.log("⚠️ All subscriptions are in use - payment required for more workspaces");
          setHasCompletedPayment(false);
          localStorage.removeItem("hasCompletedPayment");
        }
      } catch (error) {
        console.error("Error checking unused subscriptions:", error);
      }
    };

    checkUnusedSubscriptions();
  }, [user, subscriptionLoading, workspaces?.length]);

  // Load subscription information
  useEffect(() => {
    const loadSubscription = async () => {
      if (!user) return;

      try {
        const paymentSuccess = searchParams.get("payment_success");
        const sessionId = searchParams.get("session_id");

        if (paymentSuccess === "true" || sessionId) {
          console.log("Payment success detected - setting subscription to active");
          setSubscription({
            hasSubscription: true,
            workspaceId: `workspace_${user.id}`,
            plan: "pro",
            status: "active",
          });
        } else {
          try {
            const debugData = await PaymentService.debugUserSubscription(user.id);
            console.log("Debug subscription data:", debugData);

            const subscriptionData = await PaymentService.getUserSubscription(user.id);
            console.log("Loaded subscription data:", subscriptionData);

            if (subscriptionData && subscriptionData.hasSubscription) {
              setSubscription(subscriptionData);
            } else if (debugData && debugData.hasActiveSubscription) {
              setSubscription({
                hasSubscription: true,
                workspaceId: `workspace_${user.id}`,
                plan: debugData.status?.plan || "pro",
                status: debugData.status?.status || "active",
              });
            } else {
              if (workspaces && workspaces.length > 0) {
                console.log("User has workspaces - assuming subscription active");
                setSubscription({
                  hasSubscription: true,
                  workspaceId: `workspace_${user.id}`,
                  plan: "pro",
                  status: "active",
                });
              } else {
                setSubscription({
                  hasSubscription: false,
                  workspaceId: "",
                  plan: "free",
                  status: "inactive",
                });
              }
            }
          } catch (error) {
            console.error("Error loading user subscription:", error);
            if (workspaces && workspaces.length > 0) {
              console.log(
                "Error loading subscription but user has workspaces - assuming subscription active"
              );
              setSubscription({
                hasSubscription: true,
                workspaceId: `workspace_${user.id}`,
                plan: "pro",
                status: "active",
              });
            } else {
              setSubscription({
                hasSubscription: false,
                workspaceId: "",
                plan: "free",
                status: "inactive",
              });
            }
          }
        }
      } catch (error) {
        console.error("Error loading subscription:", error);
        if (workspaces && workspaces.length > 0) {
          console.log(
            "Error loading subscription but user has workspaces - assuming subscription active"
          );
          setSubscription({
            hasSubscription: true,
            workspaceId: `workspace_${user.id}`,
            plan: "pro",
            status: "active",
          });
        } else {
          setSubscription({
            hasSubscription: false,
            workspaceId: `workspace_${user.id}`,
          });
        }
      } finally {
        setSubscriptionLoading(false);
      }
    };

    loadSubscription();
  }, [user, searchParams, setSearchParams, workspaces]);

  return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
      {/* Workspace Status Cards */}
      {!subscriptionLoading && (
        <>
          {!subscription?.hasSubscription && !hasCompletedPayment && (
            <div className="mb-8">
              <Card className="border-2 border-red-500/50 bg-red-500/10 backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/20">
                        <Building2 className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-white">Subscription Required</CardTitle>
                        <CardDescription className="text-slate-300">
                          You need an active subscription to create workspaces
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                    onClick={() => navigate("/pricing")}
                  >
                    Upgrade Plan
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {(subscription?.hasSubscription && (!workspaces || workspaces.length === 0)) ||
          (hasCompletedPayment || (subscription as any)?.hasUnusedSubscription) ? (
            !hasCompletedPayment ? (
              <div className="mb-8">
                <Card className="border-2 border-green-500/50 bg-green-500/10 backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/20">
                          <Building2 className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <CardTitle className="text-lg text-white">Ready to Create Workspace</CardTitle>
                          <CardDescription className="text-slate-300">
                            {hasCompletedPayment || (subscription as any)?.hasUnusedSubscription
                              ? `You can now create ${(subscription as any)?.unusedSubscriptionCount > 1 ? "another" : "a new"} workspace`
                              : "You can now create your first workspace"}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                      onClick={() => navigate("/create-workspace")}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {hasCompletedPayment || (subscription as any)?.hasUnusedSubscription
                        ? "Create Additional Workspace"
                        : "Create Your First Workspace"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : null
          ) : null}
        </>
      )}

      {/* Welcome Section */}
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">
          Welcome back,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
            {user?.name?.split(" ")[0] || "there"}!
          </span>
        </h2>
        <p className="text-slate-400">Your AI workforce is ready. What shall we build today?</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          {
            label: "Total Profiles",
            value: "12",
            icon: Users,
            color: "text-cyan-400",
            bg: "bg-cyan-500/10",
            border: "border-cyan-500/20",
          },
          {
            label: "Outputs Created",
            value: "47",
            icon: FileText,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            border: "border-purple-500/20",
          },
          {
            label: "Amplifiers Used",
            value: "8/10",
            icon: Zap,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
          },
          {
            label: "Team Members",
            value: "1",
            icon: Users2,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className={`bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border ${stat.border} hover:border-opacity-50 transition-all duration-300 hover:shadow-lg group`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <TrendingUp className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-1">{stat.value}</h3>
            <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-cyan-400" />
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          {
            title: "Create AVA Profile",
            desc: "Define your ideal client persona",
            icon: Users,
            color: "from-cyan-500 to-blue-500",
            path: "/tools/ava",
          },
          {
            title: "Refine Product",
            desc: "Use AI tools to polish features",
            icon: Box,
            color: "from-purple-500 to-pink-500",
            path: "/tools/products",
          },
          {
            title: "Build Voice Profile",
            desc: "Clone your brand voice with Vera",
            icon: Mic,
            color: "from-amber-500 to-orange-500",
            path: "/tools/vera",
          },
          {
            title: "Design Lead Magnet",
            desc: "Attract your perfect audience",
            icon: Magnet,
            color: "from-emerald-500 to-teal-500",
            path: "/tools/lead-magnet",
          },
        ].map((action, idx) => (
          <button
            key={idx}
            onClick={() => navigate(action.path)}
            className="group relative overflow-hidden rounded-2xl bg-slate-900/60 border border-slate-700/50 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-slate-600"
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
            />

            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} p-[1px] mb-4`}>
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                <action.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h4 className="text-lg font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
              {action.title}
            </h4>
            <p className="text-sm text-slate-400">{action.desc}</p>
          </button>
        ))}
      </div>

      {/* Bottom Section: Recent Outputs & Promo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Outputs Table */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              Recent Outputs
            </h3>
            <button className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {[
              {
                title: "Email Campaign - Product Launch",
                type: "Email Sequence",
                time: "2 hours ago",
              },
              {
                title: "Social Post - Value Proposition",
                type: "Social Media",
                time: "5 hours ago",
              },
              {
                title: "Landing Page Copy",
                type: "Sales Page",
                time: "1 day ago",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800/50 hover:border-slate-600 transition-all cursor-pointer group"
              >
                <div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">{item.type}</p>
                </div>
                <span className="text-xs text-slate-500 font-mono">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Amplifiers Promo Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-800 p-8 flex flex-col justify-center">
          {/* Background Glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-400 opacity-20 blur-[80px] rounded-full pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-6 h-6 text-white" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/90 border border-white/20 px-2 py-1 rounded">
                Pro Feature
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Amplifiers</h3>
            <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
              Transform your profiles into content. 10 powerful tools to generate emails, social posts,
              sales pages, and more.
            </p>
            <button
              onClick={() => navigate("/amplifiers")}
              className="w-full py-3 bg-white text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <Zap className="w-4 h-4" />
              Explore Amplifiers
            </button>
          </div>
        </div>
      </div>

      <WorkspaceSuccessModal
        key={`success-modal-${createdWorkspaceName}`}
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        workspaceName={createdWorkspaceName}
        onContinue={() => {}}
      />
    </div>
  );
};

export default Dashboard;
