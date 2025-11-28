import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Users, Zap, Target, BarChart3, Shield } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Profiles",
      description: "Create detailed audience profiles with advanced AI analysis to understand your target market better than ever."
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Work seamlessly with your team on projects, share insights, and maintain consistent brand voice across all content."
    },
    {
      icon: Zap,
      title: "Content Amplifiers",
      description: "Transform your ideas into compelling marketing content with our suite of powerful content generation tools."
    },
    {
      icon: Target,
      title: "Precision Targeting",
      description: "Reach the right audience with laser-focused content that resonates and converts based on deep psychological insights."
    },
    {
      icon: BarChart3,
      title: "Analytics & Insights",
      description: "Track performance, measure engagement, and optimize your content strategy with comprehensive analytics."
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level security with end-to-end encryption, ensuring your data and intellectual property remain protected."
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container px-6">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6">
              Powerful Features for
              <span className="block text-primary">
                Modern Marketers
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Everything you need to create, optimize, and scale your content marketing efforts with AI-powered precision.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-black flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-heading font-bold">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* CTA Section */}
          <div className="text-center mt-16 bg-vox-dark/10 rounded-2xl">
          
           {/* bg-[url('https://picsum.photos/1200/800')] bg-cover  */}
            <div className="bg-white/20 backdrop-blur-lg border border-white/30 shadow-xl rounded-2xl p-8 border border-vox-pink/20  ">
              <h3 className="font-heading font-bold text-2xl mb-4">
                Ready to Transform Your Content Strategy?
              </h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Join thousands of marketers who are already using VoxBox to create more engaging, persuasive content.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href="/register" 
                  className="inline-flex items-center justify-center px-8 py-3 bg-primary text-white font-heading font-bold rounded-lg hover:bg-primary/90 hover:scale-105 transition-all"
                >
                  Start Free Trial
                </a>
                <a 
                  href="/features" 
                  className="inline-flex items-center justify-center px-8 py-3 border border-vox-pink text-vox-pink font-heading font-semibold rounded-lg hover:bg-vox-pink hover:text-white transition-colors"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>

      
        </div>
      </div>
    </section>
  );
};

export default Features;
