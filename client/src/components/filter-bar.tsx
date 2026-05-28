import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Filter } from "lucide-react";
import React, { useState } from "react";

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export function FilterBar({ children, className, defaultOpen = false }: FilterBarProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filtros</span>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            <span className="sr-only">Alternar filtros</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg border">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
