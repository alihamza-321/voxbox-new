import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ResetProgressConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  onConfirm: () => void;
}

export const ResetProgressConfirmDialog = ({
  open,
  onOpenChange,
  workspaceName,
  onConfirm,
}: ResetProgressConfirmDialogProps) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[70] max-h-[calc(100vh-120px)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Reset MARGO Progress</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to reset your MARGO progress in <strong>"{workspaceName}"</strong>?
            <br />
            <br />
            This will clear all your current progress and start over from Step 1. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Reset Progress
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

