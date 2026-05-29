import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Boxes, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card>
          <CardContent>
            <EmptyState
              icon={Boxes}
              title="Nenhum kit ainda"
              description="Crie kits paramétricos que geram automaticamente listas de materiais"
              action={canWrite ? { label: "Criar Kit", onClick: () => setShowDialog(true) } : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <Card 
              key={kit.id}
              className={`overflow-hidden ${canWrite ? "hover-elevate cursor-pointer" : ""}`}
              onClick={canWrite ? () => handleEdit(kit) : undefined}
              data-testid={`card-kit-${kit.id}`}
            >
              {kit.imageUrl && (
                <div className="aspect-video w-full bg-muted relative">
                  <img 
                    src={kit.imageUrl} 
                    alt={kit.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {!kit.imageUrl && <Boxes className="h-5 w-5" />}
                    {kit.name}
                  </CardTitle>
                  {canWrite && (
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
                  )}
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
