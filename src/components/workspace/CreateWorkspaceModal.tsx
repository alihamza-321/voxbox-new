import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import { WorkspaceService } from "@/lib/workspace";
import { toast } from "sonner";

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkspaceCreated?: (workspace: any) => void;
}

const industries = [
  "Marketing",
  "Technology",
  "E-commerce",
  "Consulting",
  "Healthcare",
  "Education",
  "Finance",
  "Real Estate",
  "Other",
];

const countries = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Other",
];

interface FieldErrors {
  name?: string;
  websiteUrl?: string;
  industry?: string;
  country?: string;
}

export const CreateWorkspaceModal = ({ open, onOpenChange, onWorkspaceCreated }: CreateWorkspaceModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    websiteUrl: "",
    industry: "",
    country: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<{
    name: boolean;
    websiteUrl: boolean;
    industry: boolean;
    country: boolean;
  }>({
    name: false,
    websiteUrl: false,
    industry: false,
    country: false
  });

  const validateName = (name: string): string | undefined => {
    if (!name || name.trim().length === 0) {
      return 'Workspace name is required';
    }
    if (name.trim().length < 3) {
      return 'Workspace name must be at least 3 characters';
    }
    if (name.trim().length > 50) {
      return 'Workspace name must not exceed 50 characters';
    }
    const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!nameRegex.test(name.trim())) {
      return 'Workspace name can only contain letters, numbers, spaces, hyphens, and underscores';
    }
    return undefined;
  };

  const validateWebsiteUrl = (url: string): string | undefined => {
    if (!url || url.trim().length === 0) {
      return undefined; // Optional field
    }
    try {
      const parsedUrl = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return 'URL must start with http:// or https://';
      }
    } catch (error) {
      return 'Please enter a valid URL';
    }
    return undefined;
  };

  const validateField = (name: string, value: string) => {
    let error: string | undefined;
    
    switch (name) {
      case 'name':
        error = validateName(value);
        break;
      case 'websiteUrl':
        error = validateWebsiteUrl(value);
        break;
    }

    setFieldErrors(prev => ({
      ...prev,
      [name]: error
    }));

    return error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Mark all fields as touched
    setTouched({
      name: true,
      websiteUrl: true,
      industry: true,
      country: true
    });

    // Validate all fields
    const nameError = validateName(formData.name);
    const websiteUrlError = validateWebsiteUrl(formData.websiteUrl);

    setFieldErrors({
      name: nameError,
      websiteUrl: websiteUrlError,
      industry: undefined,
      country: undefined
    });

    // If there are validation errors, don't submit
    if (nameError || websiteUrlError) {
      setIsLoading(false);
      return;
    }

    try {
      const workspaceData = {
        name: formData.name.trim(),
        websiteUrl: formData.websiteUrl?.trim() || undefined,
        industry: formData.industry || undefined,
        country: formData.country || undefined,
      };

      const workspace = await WorkspaceService.createWorkspace(workspaceData);
      
      console.log('CreateWorkspaceModal - Workspace created successfully:', workspace);
      
      toast.success("Workspace created!", {
        description: `"${formData.name}" has been created successfully.`,
      });
      
      console.log('CreateWorkspaceModal - Calling onWorkspaceCreated callback');
      onWorkspaceCreated?.(workspace);
      onOpenChange(false);
      setFormData({ name: "", websiteUrl: "", industry: "", country: "" });
      setFieldErrors({});
      setTouched({ name: false, websiteUrl: false, industry: false, country: false });
    } catch (error) {
      console.error('Error creating workspace:', error);
      
      // Check if it's a workspace limit error
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      
      if (errorMessage.includes("already created a workspace with this payment")) {
        toast.error("Payment Required for Additional Workspace", {
          description: "You have already created a workspace with this payment. To create another workspace, please make a new payment.",
          action: {
            label: "Make Payment",
            onClick: () => window.location.href = '/pricing'
          }
        });
      } else if (errorMessage.includes("No active subscription found")) {
        toast.error("Subscription Required", {
          description: "You need an active subscription to create workspaces. Please upgrade your plan first.",
          action: {
            label: "Upgrade Plan",
            onClick: () => window.location.href = '/pricing'
          }
        });
      } else {
        toast.error("Failed to create workspace", {
          description: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Validate field on change if it has been touched
    if (touched[name as keyof typeof touched]) {
      validateField(name, value);
    }
  };

  const handleBlur = (name: string, value: string) => {
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
    validateField(name, value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] z-[80]">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Set up a new workspace to organize your content and team
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">
              Workspace Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="workspace-name"
              placeholder="My Workspace"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              onBlur={(e) => handleBlur('name', e.target.value)}
              className={fieldErrors.name && touched.name ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {fieldErrors.name && touched.name && (
              <p className="text-sm text-red-600 font-medium">{fieldErrors.name}</p>
            )}
            <p className="text-xs text-muted-foreground">3-50 characters, letters, numbers, spaces, hyphens, and underscores only</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website URL</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={formData.websiteUrl}
              onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
              onBlur={(e) => handleBlur('websiteUrl', e.target.value)}
              className={fieldErrors.websiteUrl && touched.websiteUrl ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {fieldErrors.websiteUrl && touched.websiteUrl && (
              <p className="text-sm text-red-600 font-medium">{fieldErrors.websiteUrl}</p>
            )}
            <p className="text-xs text-muted-foreground">Your primary website or landing page (must start with http:// or https://)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Select value={formData.industry} onValueChange={(value) => handleInputChange('industry', value)}>
              <SelectTrigger id="industry">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent className="z-[90]">
                {industries.map((industry) => (
                  <SelectItem key={industry} value={industry.toLowerCase()}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Helps us provide industry-specific suggestions</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select value={formData.country} onValueChange={(value) => handleInputChange('country', value)}>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="z-[90]">
                {countries.map((country) => (
                  <SelectItem key={country} value={country.toLowerCase()}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Used for localizing content and date formats</p>
          </div>

          <div className="bg-vox-orange/10 border border-vox-orange/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-vox-orange flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Additional Workspace</p>
                <p className="text-xs text-muted-foreground">
                  Additional workspaces cost £15/month. You're currently using 1/3 workspaces.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Workspace"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
