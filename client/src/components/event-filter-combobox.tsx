import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EventFilterComboboxProps {
  events: Array<{ id: string; name: string }>;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  "data-testid"?: string;
}

export function EventFilterCombobox({
  events,
  value,
  onValueChange,
  placeholder = "Todos os eventos",
  className,
  triggerClassName,
  "data-testid": testId,
}: EventFilterComboboxProps) {
  const [open, setOpen] = useState(false);

  const sorted = [...events].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  );

  const normalizedValue = value === "all" ? "" : value;
  const selected = sorted.find((e) => e.id === normalizedValue);

  function handleSelect(id: string) {
    onValueChange(id === normalizedValue ? "" : id);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onValueChange("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid={testId}
          className={cn(
            "h-9 justify-between bg-card border-border/60 font-normal text-sm w-full min-w-0",
            !selected && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate min-w-0 flex-1 text-left">
            {selected ? selected.name : placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0 ml-1">
            {selected && (
              <X
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("p-0", className)}
        style={{ width: "var(--radix-popover-trigger-width)", minWidth: "260px" }}
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar evento..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum evento encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => { onValueChange(""); setOpen(false); }}
                className="text-muted-foreground"
              >
                <Check className={cn("mr-2 h-4 w-4", !normalizedValue ? "opacity-100" : "opacity-0")} />
                Todos os eventos
              </CommandItem>
              {sorted.map((event) => (
                <CommandItem
                  key={event.id}
                  value={event.name}
                  onSelect={() => handleSelect(event.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      normalizedValue === event.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{event.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
