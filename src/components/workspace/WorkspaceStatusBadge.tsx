import { Badge } from "@/components/ui/badge";

interface WorkspaceStatusBadgeProps {
  status: 'active' | 'trial' | 'past_due' | 'suspended' | 'grace_period';
}

export const WorkspaceStatusBadge = ({ status }: WorkspaceStatusBadgeProps) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          label: 'Active',
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'trial':
        return {
          label: 'Trial',
          variant: 'secondary' as const,
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'past_due':
        return {
          label: 'Past Due',
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      case 'suspended':
        return {
          label: 'Suspended',
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      case 'grace_period':
        return {
          label: 'Grace Period',
          variant: 'secondary' as const,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        };
      default:
        return {
          label: 'Unknown',
          variant: 'secondary' as const,
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      variant={config.variant}
      className={config.className}
    >
      {config.label}
    </Badge>
  );
};
