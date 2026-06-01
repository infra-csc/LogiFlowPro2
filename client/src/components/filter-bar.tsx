import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Filter, X } from "lucide-react";
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
      {/* Header bar */}
      <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">Filtros</span>
            {badgeCount !== undefined && badgeCount > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                {badgeCount} ativo{badgeCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onClear && badgeCount !== undefined && badgeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            )}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ChevronDown className={cn("h-4 w-4 transition-transform text-muted-foreground", open && "rotate-180")} />
                <span className="sr-only">Alternar filtros</span>
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
