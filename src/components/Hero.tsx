import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroBgExplosion from "@/assets/hero-bg-explosion.jpg";
import frameOverlay from "@/assets/frame-overlay.png";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Layer */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Vibrant explosion background */}
        <div className="absolute inset-0">
          <img 
            src={heroBgExplosion} 
            alt="" 
            className="w-full h-full object-cover animate-[scale_20s_ease-in-out_infinite]"
          />
        </div>
        
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-vox-dark/85 via-vox-dark/70 to-vox-dark/85" />
        
        {/* Frame overlay */}
        <div className="absolute inset-0 opacity-5">
          <img 
            src={frameOverlay} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Animated glow effects */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-vox-gold/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container relative z-10 px-6 py-20">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          {/* Tagline */}
          <div className="mb-6">
            <p className="text-vox-gold text-lg md:text-xl font-semibold tracking-wide">
              AI for Audience Persuasion
            </p>
          </div>

          {/* Hero Text */}
          <h1 className="font-heading font-bold text-5xl md:text-7xl lg:text-8xl mb-6 text-white drop-shadow-lg">
            Unlock Your
            <span className="block text-primary">
              Content Power
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-2xl mx-auto font-sans leading-relaxed">
            Create persuasive marketing content with AI-powered profiles and amplifiers.
            <span className="font-semibold"> Strategic. Powerful. Effective.</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              asChild
              size="lg" 
              className="bg-white hover:bg-white/90 text-vox-dark font-heading font-bold text-lg px-8 py-6 rounded-xl shadow-strong hover:scale-105 transition-transform group"
            >
              <Link to="/register">
                Get Started
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button 
              asChild
              size="lg" 
              variant="outline"
              className="border-2 border-white text-white hover:bg-white hover:text-vox-dark font-heading font-semibold text-lg px-8 py-6 rounded-xl backdrop-blur-sm bg-white/10 hover:scale-105 transition-all"
            >
              <Link to="/features">
                <Sparkles className="mr-2" />
                Explore Features
              </Link>
            </Button>
          </div>

          {/* Stats or Trust Indicators */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="font-heading font-bold text-5xl text-white mb-2">100K+</div>
              <div className="text-white/80 font-sans">Active Users</div>
            </div>
            <div className="text-center">
              <div className="font-heading font-bold text-5xl text-white mb-2">50M+</div>
              <div className="text-white/80 font-sans">Creations</div>
            </div>
            <div className="text-center">
              <div className="font-heading font-bold text-5xl text-white mb-2">99.9%</div>
              <div className="text-white/80 font-sans">Uptime</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      {/* animate-bounce */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center p-1">
          <div className="w-1.5 h-3 bg-white/50 rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
