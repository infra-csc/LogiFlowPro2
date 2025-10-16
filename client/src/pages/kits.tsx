import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Boxes, Settings } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Kit } from "@shared/schema";
import { KitDialog } from "@/components/kit-dialog";
import { Badge } from "@/components/ui/badge";

export default function Kits() {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedKit, setSelectedKit] = useState<Kit | undefined>();

  const { data: kits, isLoading } = useQuery<Kit[]>({
    queryKey: ["/api/kits"],
  });

  const handleEdit = (kit: Kit) => {
    setSelectedKit(kit);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedKit(undefined);
    setShowDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading kits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Kits & BOM</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage parametric structures and bill of materials</p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-kit">
          <Plus className="h-4 w-4 mr-2" />
          Create Kit
        </Button>
      </div>

      {!kits || kits.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Boxes className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No kits yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create parametric kits that auto-generate bills of materials
              </p>
              <Button onClick={() => setShowDialog(true)} className="mt-4" data-testid="button-create-first-kit">
                <Plus className="h-4 w-4 mr-2" />
                Create Kit
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <Card 
              key={kit.id}
              className="hover-elevate cursor-pointer"
              onClick={() => handleEdit(kit)}
              data-testid={`card-kit-${kit.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Boxes className="h-5 w-5" />
                    {kit.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(kit);
                    }}
                    data-testid={`button-configure-${kit.id}`}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {kit.description && (
                  <p className="text-sm text-muted-foreground">{kit.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {kit.parameters.map((param, idx) => (
                    <Badge key={idx} variant="outline">
                      {param.name}
                      {param.unit && ` (${param.unit})`}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <KitDialog 
        open={showDialog}
        onOpenChange={handleClose}
        kit={selectedKit}
      />
    </div>
  );
}
