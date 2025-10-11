import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CheckCircle, XCircle, ExternalLink, User, CreditCard, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Commands removed - simplified for Phase-1
import { formatUserRefCode } from "@/lib/utils";
import type { Subscription } from "@/lib/types";

interface SubscriptionCardProps {
  subscription: Subscription;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}

export function SubscriptionCard({ subscription, onApprove, onReject }: SubscriptionCardProps) {
  const { toast } = useToast();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const copyCommand = (command: string, type: string) => {
    navigator.clipboard.writeText(command);
    toast({
      title: "Command Copied",
      description: `${type} command copied to clipboard`,
      duration: 2000,
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm">
                {formatUserRefCode(subscription.user_ref_code)}
              </span>
            </div>
            <StatusBadge status={subscription.status} />
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <CreditCard className="h-3 w-3" />
              <span>{subscription.amount.toLocaleString()} RWF</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {subscription.proof_url && (
              <Button variant="outline" size="sm" asChild>
                <a 
                  href={`https://graph.facebook.com/v20.0/${subscription.proof_url}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>View Proof</span>
                </a>
              </Button>
            )}
            
            {/* Command copy removed for Phase-1 simplification */}
            
            {subscription.status === "pending_review" && (
              <>
                <Button 
                  size="sm" 
                  onClick={() => onApprove(subscription.id)}
                  className="bg-success hover:bg-success/90"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => onReject(subscription.id)}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Started</p>
            <p className="font-medium">{formatDate(subscription.started_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expires</p>
            <p className="font-medium">{formatDate(subscription.expires_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Created</p>
            <p className="font-medium">{formatDate(subscription.created_at)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}