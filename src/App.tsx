import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AppLayout from "./components/layouts/AppLayout";
import Index from "./pages/Index";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CreateWorkspace from "./pages/CreateWorkspace";
import Dashboard from "./pages/Dashboard";
import ThankYou from "./pages/ThankYou";
import Cancel from "./pages/Cancel";
import Empty from "./pages/Empty";
import AVA from "./pages/tools/AVA";
import AVAPreviousProfiles from "./pages/tools/AVAPreviousProfiles";
import ProductTools from "./pages/tools/ProductTools";
import Margo from "./pages/tools/Margo";
import MargoPreviousBriefs from "./pages/tools/MargoPreviousBriefs";
import ProductRefiner from "./pages/tools/ProductRefiner";
import ProductRefinerPreviousSessions from "./pages/tools/ProductRefinerPreviousSessions";
import Vera from "./pages/tools/Vera";
import VeraPreviousProfiles from "./pages/tools/VeraPreviousProfiles";
import Amplifiers from "./pages/Amplifiers";
import EmailSequenceGenerator from "./pages/EmailSequenceGenerator";
import SalesPageGenerator from "./pages/SalesPageGenerator";
import SocialMediaGenerator from "./pages/SocialMediaGenerator.tsx";
import AdCopyGenerator from "./pages/AdCopyGenerator.tsx";
import VideoScriptGenerator from "./pages/VideoScriptGenerator";
import WebinarScriptGenerator from "./pages/WebinarScriptGenerator.tsx";
import ValuePropositionGenerator from "./pages/ValuePropositionGenerator";
import BlogPostGenerator from "./pages/BlogPostGenerator.tsx";
import CaseStudyGenerator from "./pages/CaseStudyGenerator";

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/features" element={<Features />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route 
              path="/create-workspace" 
              element={
                <ProtectedRoute>
                  <CreateWorkspace />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              } 
            />
            {/* AVA Creator Page */}
            <Route 
              path="/tools/ava"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AVA />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* AVA Previous Profiles Page */}
            <Route 
              path="/tools/ava/previous-profiles"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AVAPreviousProfiles />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* Product Tools Landing */}
            <Route
              path="/tools/products"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProductTools />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* MARGO Module */}
            <Route
              path="/tools/margo"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Margo />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* MARGO Previous Briefs */}
            <Route
              path="/tools/margo/previous-briefs"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <MargoPreviousBriefs />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* Product Refiner Module */}
            <Route
              path="/tools/product-refiner"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProductRefiner />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* Product Refiner Previous Sessions */}
            <Route
              path="/tools/product-refiner/previous-sessions"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProductRefinerPreviousSessions />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* Vera Creator Module */}
            <Route
              path="/tools/vera"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Vera />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* Vera Previous Profiles */}
            <Route
              path="/tools/vera/previous-profiles"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <VeraPreviousProfiles />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* Empty pages for other side navbar targets used in design */}
            <Route 
              path="/tools/:slug"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Empty />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/outputs"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Empty />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/amplifiers"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Amplifiers />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/amplifiers/email-sequence"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EmailSequenceGenerator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/amplifiers/sales-page"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SalesPageGenerator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/amplifiers/social-media"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SocialMediaGenerator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/amplifiers/ad-copy"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AdCopyGenerator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/amplifiers/blog-post"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <BlogPostGenerator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/amplifiers/case-study"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CaseStudyGenerator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/amplifiers/video-script"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <VideoScriptGenerator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/amplifiers/webinar-script"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <WebinarScriptGenerator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/amplifiers/value-proposition"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ValuePropositionGenerator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/profiles"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Empty />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/templates"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Empty />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/team"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Empty />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/billing"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Empty />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/workspace/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Empty />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/thank-you" element={<ThankYou />} />
            <Route path="/cancel" element={<Cancel />} />
          </Routes>
        </BrowserRouter>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
