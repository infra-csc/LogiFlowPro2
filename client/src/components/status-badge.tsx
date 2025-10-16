import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  // Event statuses
  planning: { color: "bg-chart-2 text-white", label: "Planning" },
  approved: { color: "bg-chart-4 text-white", label: "Approved" },
  in_progress: { color: "bg-primary text-primary-foreground", label: "In Progress" },
  completed: { color: "bg-chart-4 text-white", label: "Completed" },
  cancelled: { color: "bg-destructive text-destructive-foreground", label: "Cancelled" },
  
  // Request statuses
  draft: { color: "bg-muted text-muted-foreground", label: "Draft" },
  pending_approval: { color: "bg-chart-5 text-white", label: "Pending Approval" },
  cutoff_locked: { color: "bg-chart-3 text-white", label: "Cutoff Locked" },
  in_picking: { color: "bg-chart-2 text-white", label: "In Picking" },
  partially_loaded: { color: "bg-chart-5 text-white", label: "Partially Loaded" },
  loaded: { color: "bg-chart-4 text-white", label: "Loaded" },
  in_transit: { color: "bg-primary text-primary-foreground", label: "In Transit" },
  in_use: { color: "bg-chart-2 text-white", label: "In Use" },
  return_pending: { color: "bg-chart-5 text-white", label: "Return Pending" },
  
  // Trip statuses
  planned: { color: "bg-chart-2 text-white", label: "Planned" },
  loading: { color: "bg-chart-5 text-white", label: "Loading" },
  at_destination: { color: "bg-chart-2 text-white", label: "At Destination" },
  unloading: { color: "bg-chart-5 text-white", label: "Unloading" },
  
  // Product statuses
  available: { color: "bg-chart-4 text-white", label: "Available" },
  reserved: { color: "bg-chart-2 text-white", label: "Reserved" },
  damaged: { color: "bg-destructive text-destructive-foreground", label: "Damaged" },
  in_repair: { color: "bg-chart-5 text-white", label: "In Repair" },
  unusable: { color: "bg-muted text-muted-foreground", label: "Unusable" },
  lost: { color: "bg-destructive text-destructive-foreground", label: "Lost" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { color: "bg-muted text-muted-foreground", label: status };
  
  return (
    <Badge 
      className={cn(config.color, "text-xs font-medium", className)}
      data-testid={`status-${status}`}
    >
      {config.label}
    </Badge>
  );
}
