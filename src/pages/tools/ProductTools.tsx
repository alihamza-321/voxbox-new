import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ProductTools = () => {
  return (
    <div className="min-h-[calc(100vh-80px)] ">
      <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="rounded-2xl border border-white/70 bg-white/90 px-5 py-5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] backdrop-blur-md">
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground/70">
              Product Intelligence Suite
            </span>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-[26px] font-bold text-gray-900">Product Tools</h1>
              <Sparkles className="h-6 w-6 text-vox-pink" />
            </div>
            <p className="text-sm text-muted-foreground sm:max-w-2xl">
              Unlock structured frameworks to evaluate, refine, and elevate your product positioning with AI-guided workflows.
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] backdrop-blur">
          <div className="h-full overflow-y-auto px-4 py-6 sm:px-6 sm:py-7">
            <div className="grid gap-6">
              <Card className="col-span-1 sm:col-span-2 xl:col-span-3 relative overflow-hidden border-vox-pink/20 shadow-lg shadow-vox-pink/10 transition-all hover:-translate-y-1 hover:shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-vox-pink/10 via-vox-orange/5 to-transparent" />
                <CardHeader className="relative">
                  <CardTitle className="flex items-center justify-between text-2xl sm:text-3xl">
                    <span>M.A.R.G.O.</span>
                  </CardTitle>
                  <CardDescription className="text-base sm:text-lg">
                    Multi-dimensional product assessment journey to align your offer with your ideal buyer.
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative space-y-4 pt-0 text-sm text-muted-foreground">
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-vox-pink" />
                      <span>Structured 7-step evaluation guided by an AI strategist</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-vox-orange" />
                      <span>Capture blind spots across messaging, positioning, and objections</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-vox-purple" />
                      <span>Generate an actionable brief tailored to your offer</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="relative flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="group w-full sm:w-auto bg-gradient-to-r from-vox-pink via-vox-orange to-vox-pink text-white shadow-lg hover:shadow-xl">
                    <Link to="/tools/margo">
                      Launch Margo
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full sm:w-auto border-vox-pink/30 text-vox-pink hover:bg-vox-pink/10">
                    <Link to="/tools/margo/previous-briefs">
                      Previous MARGO Briefs
                    </Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card className="col-span-1 sm:col-span-2 xl:col-span-3 relative overflow-hidden border-vox-orange/20 shadow-lg shadow-vox-orange/10 transition-all hover:-translate-y-1 hover:shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-vox-orange/10 via-vox-pink/5 to-transparent" />
                <CardHeader className="relative">
                  <CardTitle className="flex items-center justify-between text-2xl sm:text-3xl">
                    <span>Product Refiner</span>
                  </CardTitle>
                  <CardDescription className="text-base sm:text-lg">
                    Comprehensive 10-step product refinement workflow to transform your product into a market-ready offer.
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative space-y-4 pt-0 text-sm text-muted-foreground">
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-vox-orange" />
                      <span>Step-by-step product refinement process with AI guidance</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-vox-pink" />
                      <span>Define product promise, outcomes, features, and pricing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-vox-purple" />
                      <span>Generate comprehensive product specification documents</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="relative flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="group w-full sm:w-auto bg-gradient-to-r from-vox-orange via-vox-pink to-vox-orange text-white shadow-lg hover:shadow-xl">
                    <Link to="/tools/product-refiner">
                      Launch Product Refiner
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full sm:w-auto border-vox-orange/30 text-vox-orange hover:bg-vox-orange/10">
                    <Link to="/tools/product-refiner/previous-sessions">
                      Previous Sessions
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductTools;
