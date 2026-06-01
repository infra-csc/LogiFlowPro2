import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Boxes, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Kit } from "@shared/schema";
import { KitDialog } from "@/components/kit-dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

export default function Kits() {
  const { user } = useAuth();
  const canWrite = userIsAdmin(user);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedKit, setSelectedKit] = useState<Kit | undefined>();

  const { data: kits, isLoading } = useQuery<Kit[]>({
    queryKey: ["/api/kits"],
  });

  // Sync selectedKit with latest data from cache
  useEffect(() => {
    if (selectedKit?.id && kits) {
      const updatedKit = kits.find(k => k.id === selectedKit.id);
      if (updatedKit) {
        setSelectedKit(updatedKit);
      }
    }
  }, [kits, selectedKit?.id]);

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
      <PageLoading message="Carregando kits..." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kits & BOM"
        description="Gerencie estruturas paramétricas e lista de materiais"
      >
        {canWrite && (
          <Button onClick={() => setShowDialog(true)} data-testid="button-create-kit">
            <Plus className="h-4 w-4 mr-2" />
            Criar Kit
          </Button>
        )}
      </PageHeader>

      {!kits || kits.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Nenhum kit ainda"
          description="Crie kits paramétricos que geram automaticamente listas de materiais"
          action={canWrite ? { label: "Criar Kit", onClick: () => setShowDialog(true) } : undefined}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <Card 
              key={kit.id}
              className={`overflow-hidden border-border/60 ${canWrite ? "hover-elevate cursor-pointer" : ""}`}
              onClick={canWrite ? () => handleEdit(kit) : undefined}
              data-testid={`card-kit-${kit.id}`}
            >
              {kit.imageUrl ? (
                <div className="aspect-video w-full bg-muted relative">
                  <img 
                    src={kit.imageUrl} 
                    alt={kit.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video w-full bg-muted flex items-center justify-center">
                  <Boxes className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Boxes className="h-4 w-4 text-primary/70" />
                      </div>
                      <h3 className="font-semibold text-base text-foreground">{kit.name}</h3>
                    </div>
                    {kit.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{kit.description}</p>
                    )}
                  </div>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(kit);
                      }}
                      data-testid={`button-configure-${kit.id}`}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/40">
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
