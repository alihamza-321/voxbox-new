import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAvaNameResponseStore } from "@/stores/avaNameResponseStore";
import avaAvatar from "@/assets/ava-avatar.png";
import { AVA_DEFAULT_INTRO_VIDEO_URL } from "@/constants/ava";

interface AVAWelcomeProps {
  onStart: () => void;
  isLoading?: boolean;
}

export const AVAWelcome = ({ onStart, isLoading = false }: AVAWelcomeProps) => {
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const storeVideoUrl = useAvaNameResponseStore((state) => state.videoUrl);
  const fallbackVideoUrl = AVA_DEFAULT_INTRO_VIDEO_URL;
  const [videoUrl, setVideoUrl] = useState<string>(fallbackVideoUrl);

  // Check for stored video URL from multiple sources - always try to show video
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const resolveVideo = (candidate?: string | null) => {
      if (!candidate) return null;
      const trimmed = candidate.trim();
      return trimmed.length ? trimmed : null;
    };

    const resolvedFromStore = resolveVideo(storeVideoUrl);
    if (resolvedFromStore) {
      setVideoUrl(resolvedFromStore);
      return;
    }

    const sessionVideo = resolveVideo(sessionStorage.getItem('name-submission-video-url'));
    if (sessionVideo) {
      setVideoUrl(sessionVideo);
      return;
    }

    if (currentWorkspace?.id) {
      try {
        const persistedStore = localStorage.getItem('ava-name-response-store');
        if (persistedStore) {
          const parsed = JSON.parse(persistedStore);
          const persistedVideo = resolveVideo(parsed.state?.videoUrl);
          if (persistedVideo) {
            setVideoUrl(persistedVideo);
            return;
          }
        }
      } catch {
        // Ignore parse errors
      }

      const nameResponseKey = `ava-name-response-${currentWorkspace.id}`;
      try {
        const stored = localStorage.getItem(nameResponseKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          const legacyVideo = resolveVideo(parsed.videoUrl);
          if (legacyVideo) {
            setVideoUrl(legacyVideo);
            return;
          }
        }
      } catch {
        // Ignore parse errors
      }

      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (!key.startsWith(`ava-phase1-chat-${currentWorkspace.id}-`)) continue;
          const phase1State = localStorage.getItem(key);
          if (!phase1State) continue;
          const parsed = JSON.parse(phase1State);
          const phaseVideo = resolveVideo(parsed.videoUrl);
          if (phaseVideo) {
            setVideoUrl(phaseVideo);
            return;
          }
        }
      } catch {
        // Ignore errors
      }
    }

    if (currentWorkspace?.id) {
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (!key.startsWith(`activate-now-messages-${currentWorkspace.id}-`)) continue;
          const activateData = localStorage.getItem(key);
          if (!activateData) continue;
          const parsed = JSON.parse(activateData);
          const activateVideo = resolveVideo(parsed.videoUrl);
          if (activateVideo) {
            setVideoUrl(activateVideo);
            return;
          }
        }
      } catch {
        // Ignore errors
      }
    }

    if (fallbackVideoUrl) {
      setVideoUrl(fallbackVideoUrl);
    }
  }, [currentWorkspace?.id, storeVideoUrl, fallbackVideoUrl]);

  // Scroll to Activate button when coming from "Start New Session"
  useEffect(() => {
    if (location.state?.scrollToActivateButton) {
      // Wait for page to render, then scroll to button
      setTimeout(() => {
        const button = document.getElementById("activate-ava-button");
        if (button) {
          button.scrollIntoView({ 
            behavior: "smooth", 
            block: "center" 
          });
        }
      }, 300);
    }
  }, [location.state]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      {/* Background - White */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-white"></div>
      <div className="max-w-6xl w-full space-y-8 animate-fade-in relative z-10">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            {/* Animated glow rings */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-cyan-500 rounded-full blur-2xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
            
            {/* Avatar circle with border */}
            <div className="relative w-40 h-40 mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-1 bg-[#020617] rounded-full"></div>
              <img 
                src={avaAvatar} 
                alt="AVA Avatar"
                className="absolute inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)] rounded-full object-cover"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="inline-block px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-sm">
              <span className="text-sm font-medium bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                AI-Powered Audience Intelligence
              </span>
            </div>
            
            <h1 className="font-heading font-bold text-5xl md:text-7xl bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              Meet AVA
            </h1>
            
            <p className="text-2xl md:text-3xl font-semibold text-slate-100">
              Advanced Virtual Audience Analyzer
            </p>
            
            <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-[1.75] space-y-4">
              Create a deep psychological profile of your ideal client that goes beyond demographics. 
              AVA helps you understand the <span className="text-cyan-400 font-semibold">subconscious motivations</span>, 
              <span className="text-purple-400 font-semibold"> emotional triggers</span>, and 
              <span className="text-blue-400 font-semibold"> decision-making patterns</span> that drive purchasing behavior.
            </p>
          </div>
        </div>

        {/* Phase 1 Video Section - Replaces Feature Cards */}
        <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl shadow-xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h3 className="font-heading font-bold text-2xl mb-2 text-slate-100">Get Started with AVA</h3>
              <p className="text-sm text-slate-400">Watch this video to understand how AVA works</p>
            </div>
            <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ paddingTop: '56.25%' }}>
              {videoUrl ? (
                <iframe
                  src={(() => {
                    if (!videoUrl) return '';
                    // Support both vimeo.com and player.vimeo.com URLs
                    let match = videoUrl.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
                    if (!match) {
                      // Try player.vimeo.com format
                      match = videoUrl.match(/player\.vimeo\.com\/video\/(\d+)/);
                      if (match) {
                        // Extract hash from original URL if present
                        const hashMatch = videoUrl.match(/[?&]h=([a-zA-Z0-9]+)/);
                        const videoId = match[1];
                        const privacyHash = hashMatch ? hashMatch[1] : undefined;
                        let embedUrl = `https://player.vimeo.com/video/${videoId}`;
                        const params = new URLSearchParams({
                          title: '0',
                          byline: '0',
                          portrait: '0',
                          autoplay: '0'
                        });
                        if (privacyHash) params.set('h', privacyHash);
                        embedUrl += '?' + params.toString();
                        return embedUrl;
                      }
                      return '';
                    }
                    const videoId = match[1];
                    const privacyHash = match[2];
                    let embedUrl = `https://player.vimeo.com/video/${videoId}`;
                    const params = new URLSearchParams({
                      title: '0',
                      byline: '0',
                      portrait: '0',
                      autoplay: '0'
                    });
                    if (privacyHash) params.set('h', privacyHash);
                    embedUrl += '?' + params.toString();
                    return embedUrl;
                  })()}
                  className="absolute top-0 left-0 w-full h-full border-0"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title="AVA Profile Video"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center px-4">
                    <p className="text-white/80 text-sm mb-2">Loading video...</p>
                    <p className="text-white/60 text-xs">The video will appear here once available</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Process Section */}
        <Card className="border border-slate-700/50 shadow-2xl bg-slate-900/40 backdrop-blur-xl">
          <CardContent className="p-10 space-y-8">
            <div className="flex items-center justify-center gap-3 mb-8">
              <Sparkles className="w-7 h-7 text-cyan-400" />
              <h2 className="font-heading font-bold text-3xl text-slate-100">Your Journey with AVA</h2>
              <Sparkles className="w-7 h-7 text-purple-400" />
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="relative space-y-4 group">
                <div className="absolute -inset-2 bg-gradient-to-br from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-20 rounded-xl blur-xl transition-opacity"></div>
                <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 via-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-cyan-500/30">
                  1
                </div>
                <h3 className="font-bold text-xl text-slate-100">Phase 1: Discovery</h3>
                <p className="text-sm text-slate-400 leading-[1.75] space-y-2">
                  Engage in an intelligent conversation with AVA. Answer <span className="font-semibold text-slate-200">25-30 strategically designed questions</span> that uncover the foundational elements of your ideal client profile. AVA adapts to your responses for deeper insights.
                </p>
                <div className="text-xs text-cyan-400 font-semibold">⏱ 15-20 minutes</div>
              </div>

              <div className="relative space-y-4 group">
                <div className="absolute -inset-2 bg-gradient-to-br from-purple-500 to-cyan-500 opacity-0 group-hover:opacity-20 rounded-xl blur-xl transition-opacity"></div>
                <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/30">
                  2
                </div>
                <h3 className="font-bold text-xl text-slate-100">Phase 2: Deep Analysis</h3>
                <p className="text-sm text-slate-400 leading-[1.75] space-y-2">
                  Watch as AVA generates your <span className="font-semibold text-slate-200">complete 21-section profile</span> in real-time. Each section is crafted using advanced AI to analyze patterns, extract insights, and build a comprehensive psychological map of your audience.
                </p>
                <div className="text-xs text-purple-400 font-semibold">⏱ 10-15 minutes</div>
              </div>

              <div className="relative space-y-4 group">
                <div className="absolute -inset-2 bg-gradient-to-br from-blue-500 to-purple-500 opacity-0 group-hover:opacity-20 rounded-xl blur-xl transition-opacity"></div>
                <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30">
                  3
                </div>
                <h3 className="font-bold text-xl text-slate-100">Phase 3: Activation</h3>
                <p className="text-sm text-slate-400 leading-[1.75] space-y-2">
                  <span className="font-semibold text-slate-200">Download your complete profile</span> as a formatted document. Immediately integrate it into VoxBox Amplifiers to generate content that resonates at a subconscious level with your ideal clients.
                </p>
                <div className="text-xs text-blue-400 font-semibold">⏱ Instant download</div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="pt-8 space-y-6">
              <Button 
                id="activate-ava-button"
                onClick={onStart}
                size="lg"
                disabled={isLoading}
                className="w-full h-14 text-lg bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:brightness-110 transform hover:-translate-y-0.5 transition duration-300 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating Session...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 w-6 h-6" />
                    Activate AVA Now
                    <ArrowRight className="ml-2 w-6 h-6" />
                  </>
                )}
              </Button>
              
              <p className="text-center text-xs text-slate-400">
                🔒 Your data stays private • 💾 Progress auto-saves • ⚡ Instant profile generation
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

