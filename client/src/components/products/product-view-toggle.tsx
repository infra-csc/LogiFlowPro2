import { LayoutGrid, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ViewMode } from "./product-helpers";

interface ProductViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

export function ProductViewToggle({ value, onChange }: ProductViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v === "grid" || v === "list") onChange(v);
      }}
      className="gap-1"
    >
      <ToggleGroupItem value="grid" aria-label="Visualização em grade" data-testid="toggle-view-grid">
        <LayoutGrid className="h-4 w-4 mr-2" />
        Grade
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="Visualização em lista" data-testid="toggle-view-list">
        <List className="h-4 w-4 mr-2" />
        Lista
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
