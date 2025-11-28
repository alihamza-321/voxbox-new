import { CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface WorkspaceSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  onContinue?: () => void;
}

export const WorkspaceSuccessModal = ({ 
  open, 
  onOpenChange, 
  workspaceName, 
  onContinue 
}: WorkspaceSuccessModalProps) => {
  console.log('WorkspaceSuccessModal - Props:', { open, workspaceName });
  
  const handleContinue = () => {
    onContinue?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-vox-dark border-none shadow-2xl z-[80]">
        <DialogHeader className="text-center space-y-6">
          {/* Success Icon */}
          <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 stroke-[2.5]" />
          </div>
          
          {/* Title */}
          <DialogTitle className="text-3xl font-bold text-green-600 dark:text-green-400">
            Workspace Created Successfully! 🎉
          </DialogTitle>
          
          {/* Description */}
          <DialogDescription className="text-base text-muted-foreground">
            Welcome to VoxBox! Your workspace has been activated successfully.
          </DialogDescription>
        </DialogHeader>

        {/* Subscription Activated Card */}
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20 mt-4">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
              <div className="space-y-2">
                <h3 className="font-semibold text-green-700 dark:text-green-300 text-lg">
                  Workspace Activated
                </h3>
                <p className="text-sm text-green-700/80 dark:text-green-300/80">
                  Your workspace "<span className="font-semibold">{workspaceName}</span>" is now ready. You can now start generating content right away.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What's Next Section */}
        <div className="mt-6 space-y-4">
          <h3 className="font-bold text-lg text-foreground">What's Next?</h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-pink-600 dark:text-pink-400 font-bold text-sm">1</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Create your first AVA profile to understand your audience
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">2</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Set up your workspace and invite team members
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-600 dark:text-green-400 font-bold text-sm">3</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Start generating content with our AI amplifiers
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col gap-3 pt-4">
          <Button 
            onClick={handleContinue}
            size="lg"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-base py-6"
          >
            Continue to Dashboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
