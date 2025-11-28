import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const CTA = () => {
  return (
    <section className="py-20 bg-primary relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-vox-pink/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-vox-pink/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-heading font-bold text-4xl md:text-6xl mb-6 text-white">
            Ready to Transform Your
            <span className="block text-white">
            {/* <span className="block bg-gradient-to-r from-vox-pink via-vox-orange to-vox-blue bg-clip-text text-transparent"> */}
              Content Strategy?
            </span>
          </h2>
          
          <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed">
            Join thousands of marketers who are already using VoxBox to create more engaging, 
            persuasive content that converts. Start your free trial today.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
            <Button 
              asChild
              size="lg" 
              className="bg-white hover:bg-white/90 text-vox-dark font-heading font-bold text-lg px-8 py-6 rounded-xl shadow-strong hover:scale-105 transition-transform group"
            >
              <Link to="/register">
                Start Free Trial
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            
            <Button 
              asChild
              size="lg" 
              variant="outline"
              className="border-2 border-white text-white hover:bg-white hover:text-vox-dark font-heading font-semibold text-lg px-8 py-6 rounded-xl backdrop-blur-sm bg-white/10 hover:scale-105 transition-all"
            >
              <Link to="/pricing">
                <Sparkles className="mr-2" />
                View Pricing
              </Link>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="font-heading font-bold text-3xl text-white mb-2">14-Day</div>
              <div className="text-white/80 font-sans">Free Trial</div>
            </div>
            <div className="text-center">
              <div className="font-heading font-bold text-3xl text-white mb-2">No</div>
              <div className="text-white/80 font-sans">Credit Card</div>
            </div>
            <div className="text-center">
              <div className="font-heading font-bold text-3xl text-white mb-2">24/7</div>
              <div className="text-white/80 font-sans">Support</div>
            </div>
            <div className="text-center">
              <div className="font-heading font-bold text-3xl text-white mb-2">Cancel</div>
              <div className="text-white/80 font-sans">Anytime</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
