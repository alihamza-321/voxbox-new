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

interface WorkspaceSwitchConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWorkspace: string;
  targetWorkspace: string;
  onConfirm: () => void;
}

export const WorkspaceSwitchConfirmDialog = ({
  open,
  onOpenChange,
  currentWorkspace,
  targetWorkspace,
  onConfirm,
}: WorkspaceSwitchConfirmDialogProps) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[70] max-h-[calc(100vh-120px)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Switch Workspace</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to switch from <strong>"{currentWorkspace}"</strong> to <strong>"{targetWorkspace}"</strong>?
            <br />
            <br />
            This will change your current workspace context and may affect your current work.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Switch Workspace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
