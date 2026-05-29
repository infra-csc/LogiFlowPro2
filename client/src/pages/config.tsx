import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Truck, User, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Vehicle, Driver, Dock } from "@shared/schema";
import { PageHeader } from "@/components/page-header";

export default function Config() {
  const { data: vehicles } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: docks } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });

  const sections = [
    {
      title: "Veículos",
      icon: Truck,
      count: vehicles?.length || 0,
      description: "Gerencie a frota de veículos",
      testId: "vehicles-section"
    },
    {
      title: "Motoristas",
      icon: User,
      count: drivers?.length || 0,
      description: "Gerencie o cadastro de motoristas",
      testId: "drivers-section"
    },
    {
      title: "Docas",
      icon: WarehouseIcon,
      count: docks?.length || 0,
      description: "Configure docas de carregamento",
      testId: "docks-section"
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuração"
        description="Gerencie configurações e recursos do sistema"
      />

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.title} className="hover-elevate overflow-hidden" data-testid={section.testId}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-base text-foreground flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <section.icon className="h-4 w-4 text-primary/70" />
                  </div>
                  {section.title}
                </div>
                <Button variant="ghost" size="icon" data-testid={`button-add-${section.title.toLowerCase()}`}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-2xl font-bold tracking-tight mb-1">{section.count}</div>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="font-semibold text-base text-foreground flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="h-4 w-4 text-primary/70" />
            </div>
            Configurações do Sistema
          </div>
          <p className="text-sm text-muted-foreground">
            Opções de configuração para horários de corte, notificações e preferências do sistema estarão disponíveis aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
