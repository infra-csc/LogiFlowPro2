import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import React, { useState } from "react";

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  badgeCount?: number;
  onClear?: () => void;
}

export function FilterBar({ children, className, defaultOpen = false, badgeCount, onClear }: FilterBarProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span>Filtros</span>
          {badgeCount !== undefined && badgeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {badgeCount} ativo{badgeCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onClear && badgeCount !== undefined && badgeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
              <span className="sr-only">Alternar filtros</span>
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4 bg-muted/40 rounded-lg border border-border/60">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
