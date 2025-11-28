import { Button } from "@/components/ui/button";
import { AlertTriangle, X, CreditCard } from "lucide-react";

interface WorkspaceStatusBannerProps {
  type: 'trial' | 'past_due' | 'suspended' | 'grace_period';
  daysRemaining?: number;
  onAction: () => void;
  onDismiss: () => void;
}

export const WorkspaceStatusBanner = ({ 
  type, 
  daysRemaining, 
  onAction, 
  onDismiss 
}: WorkspaceStatusBannerProps) => {
  const getBannerConfig = (type: string) => {
    switch (type) {
      case 'trial':
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
          title: 'Trial Period',
          message: daysRemaining 
            ? `Your trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`
            : 'Your trial period is ending soon.',
          actionText: 'Upgrade Now',
          actionIcon: CreditCard
        };
      case 'past_due':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          title: 'Payment Past Due',
          message: 'Your subscription payment is past due. Please update your payment method.',
          actionText: 'Update Payment',
          actionIcon: CreditCard
        };
      case 'suspended':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          title: 'Account Suspended',
          message: 'Your account has been suspended due to payment issues.',
          actionText: 'Reactivate Account',
          actionIcon: CreditCard
        };
      case 'grace_period':
        return {
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
          title: 'Grace Period',
          message: 'Your subscription is in a grace period. Please update your payment method.',
          actionText: 'Update Payment',
          actionIcon: CreditCard
        };
      default:
        return {
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
          title: 'Account Status',
          message: 'Please check your account status.',
          actionText: 'Manage Account',
          actionIcon: CreditCard
        };
    }
  };

  const config = getBannerConfig(type);
  const ActionIcon = config.actionIcon;

  return (
    <div className={`${config.bgColor} ${config.borderColor} border-b`}>
      <div className="container px-6">
        <div className="flex items-center justify-between h-15">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${config.iconColor}`} />
            <div>
              <div className={`font-semibold ${config.textColor}`}>
                {config.title}
              </div>
              <div className={`text-sm ${config.textColor}`}>
                {config.message}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onAction}
              className={`${config.textColor} ${config.borderColor} border hover:bg-white/50`}
            >
              <ActionIcon className="w-4 h-4 mr-2" />
              {config.actionText}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className={`${config.textColor} hover:bg-white/50`}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
