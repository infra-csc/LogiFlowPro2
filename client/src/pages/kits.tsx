import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Boxes, Settings, Search, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Kit } from "@shared/schema";
import { KitDialog } from "@/components/kit-dialog";
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
  const [search, setSearch] = useState("");

  const { data: kits, isLoading } = useQuery<Kit[]>({
    queryKey: ["/api/kits"],
  });

  useEffect(() => {
    if (selectedKit?.id && kits) {
      const updatedKit = kits.find((k) => k.id === selectedKit.id);
      if (updatedKit) setSelectedKit(updatedKit);
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

  const filteredKits = kits?.filter((k) => {
    const q = search.toLowerCase();
    return (
      !q ||
      k.name.toLowerCase().includes(q) ||
      (k.description && k.description.toLowerCase().includes(q)) ||
      k.parameters.some((p) => p.name.toLowerCase().includes(q))
    );
  });

  if (isLoading) {
    return <PageLoading message="Carregando kits..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kits & BOM"
        description="Gerencie kits paramétricos, parâmetros e listas de materiais"
      >
        {canWrite && (
          <Button onClick={() => setShowDialog(true)} data-testid="button-create-kit">
            <Plus className="h-4 w-4 mr-2" />
            Criar Kit
          </Button>
        )}
      </PageHeader>

      {/* Search */}
      {kits && kits.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, descrição ou parâmetro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-10"
            data-testid="input-search-kits"
          />
          {search && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {!filteredKits || filteredKits.length === 0 ? (
        search ? (
          <EmptyState
            icon={Boxes}
            title="Nenhum kit encontrado"
            description="Tente ajustar a busca."
            action={{ label: "Limpar busca", onClick: () => setSearch("") }}
          />
        ) : (
          <EmptyState
            icon={Boxes}
            title="Nenhum kit cadastrado"
            description="Crie kits paramétricos que geram automaticamente listas de materiais."
            action={canWrite ? { label: "Criar Kit", onClick: () => setShowDialog(true) } : undefined}
          />
        )
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredKits.map((kit) => (
            <Card
              key={kit.id}
              className={`overflow-hidden border-border/60 flex flex-col ${canWrite ? "hover-elevate cursor-pointer" : ""}`}
              onClick={canWrite ? () => handleEdit(kit) : undefined}
              data-testid={`card-kit-${kit.id}`}
            >
              {/* Image area — fixed height */}
              {kit.imageUrl ? (
                <div className="h-36 w-full bg-muted shrink-0">
                  <img
                    src={kit.imageUrl}
                    alt={kit.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-36 w-full bg-muted/50 flex items-center justify-center shrink-0">
                  <Boxes className="h-9 w-9 text-muted-foreground/25" />
                </div>
              )}

              <CardContent className="p-4 flex flex-col flex-1">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base text-foreground leading-snug line-clamp-2">
                      {kit.name}
                    </h3>
                    {kit.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {kit.description}
                      </p>
                    )}
                  </div>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 -mr-1 -mt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(kit);
                      }}
                      data-testid={`button-configure-${kit.id}`}
                      aria-label={`Configurar ${kit.name}`}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Metadata */}
                <div className="mt-auto pt-3 border-t border-border/40">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-xs font-medium">
                      {kit.parameters.length}{" "}
                      {kit.parameters.length === 1 ? "parâmetro" : "parâmetros"}
                    </Badge>
                    {kit.parameters.slice(0, 3).map((param, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {param.name}
                        {param.unit && (
                          <span className="text-muted-foreground ml-1">({param.unit})</span>
                        )}
                      </Badge>
                    ))}
                    {kit.parameters.length > 3 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{kit.parameters.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <KitDialog open={showDialog} onOpenChange={handleClose} kit={selectedKit} />
    </div>
  );
}
