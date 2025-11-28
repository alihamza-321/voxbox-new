import { CheckCircle, ArrowRight } from "lucide-react";

const About = () => {
  const benefits = [
    "Increase content engagement by 300%",
    "Reduce content creation time by 80%",
    "Improve conversion rates by 150%",
    "Scale content production 10x faster"
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Content */}
            <div>
              <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6 flex items-center gap-2">
                Why Choose
                <span className="block bg-gradient-to-r from-vox-pink to-vox-blue bg-clip-text text-transparent">
                  VoxBox?
                </span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                We understand that great content isn't just about words—it's about understanding your audience, 
                crafting the perfect message, and delivering it at the right time. VoxBox combines cutting-edge 
                AI with deep marketing psychology to give you an unfair advantage.
              </p>
              
              <div className="space-y-4 mb-8">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-vox-green flex-shrink-0" />
                    <span className="font-sans text-lg">{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <a 
                  href="/register" 
                  className="inline-flex items-center justify-center px-8 py-3 bg-primary text-white font-heading font-bold rounded-lg hover:bg-primary/90 transition-all"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 transition-transform" />
                </a>
                <a 
                  href="/contact" 
                  className="inline-flex items-center justify-center px-8 py-4 border border-vox-pink text-vox-pink font-heading font-semibold rounded-lg hover:bg-vox-pink hover:text-white transition-colors"
                >
                  Talk to Sales
                </a>
              </div>
            </div>

            {/* Visual */}
            {/* <div className="relative">
              <div className="relative z-10">
                <Card className="p-8 bg-gradient-to-br from-vox-pink/10 to-vox-blue/10 border border-vox-pink/20">
                  <CardContent className="p-0">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-vox-pink to-vox-blue flex items-center justify-center">
                          <span className="text-white font-bold text-lg">AI</span>
                        </div>
                        <div>
                          <h3 className="font-heading font-bold text-lg">AI Analysis</h3>
                          <p className="text-muted-foreground">Deep audience insights</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="h-2 bg-gradient-to-r from-vox-pink to-vox-blue rounded-full w-3/4"></div>
                        <div className="h-2 bg-gradient-to-r from-vox-orange to-vox-yellow rounded-full w-2/3"></div>
                        <div className="h-2 bg-gradient-to-r from-vox-blue to-vox-green rounded-full w-4/5"></div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-white/50 rounded-lg">
                          <div className="font-heading font-bold text-2xl text-vox-pink">95%</div>
                          <div className="text-sm text-muted-foreground">Accuracy</div>
                        </div>
                        <div className="text-center p-4 bg-white/50 rounded-lg">
                          <div className="font-heading font-bold text-2xl text-vox-blue">10x</div>
                          <div className="text-sm text-muted-foreground">Faster</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="absolute -top-4 -right-4 w-32 h-32 bg-gradient-to-br from-vox-pink/20 to-vox-blue/20 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-to-br from-vox-orange/20 to-vox-yellow/20 rounded-full blur-2xl"></div>
            </div> */}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
