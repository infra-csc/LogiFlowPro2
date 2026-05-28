import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";
import React from "react";

interface DataCardProps {
  title: string;
  icon?: LucideIcon;
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  meta?: { label: string; value: string }[];
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function DataCard({ title, icon: Icon, badge, meta, children, className, onClick }: DataCardProps) {
  return (
    <Card className={cn("hover-elevate", onClick && "cursor-pointer", className)} onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          {badge && (
            <Badge variant={badge.variant || "default"} className="text-xs">
              {badge.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {meta && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
            {meta.map((m, i) => (
              <span key={i}>
                {m.label}: <span className="text-foreground font-medium">{m.value}</span>
              </span>
            ))}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
