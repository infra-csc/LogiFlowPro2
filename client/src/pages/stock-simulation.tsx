import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BarChart3,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Play,
  Filter,
  Search,
  X,
  PackageX,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import * as XLSX from "xlsx";

interface SimulationFilters {
  eventIds: string[];
  requestIds: string[];
  requestStatus: string[];
}

interface ProductSimulation {
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  totalNeed: number;
  currentStock: number;
  balance: number;
  status: "FALTA" | "CRÍTICO" | "ADEQUADO";
  eventBreakdown: Array<{
    eventId: string;
    eventName: string;
    eventDate: string;
    quantity: number;
  }>;
  requestBreakdown: Array<{
    requestId: string;
    requestArea: string;
    eventId: string;
    eventName: string;
    eventDate: string;
    quantity: number;
  }>;
}

interface SimulationResult {
  generatedAt: string;
  filters: any;
  summary: {
    totalProducts: number;
    productsShortage: number;
    productsCritical: number;
    productsAdequate: number;
  };
  consideredRequests: Array<{
    id: string;
    area: string;
    eventId: string;
    eventName: string;
    status: string;
  }>;
  products: ProductSimulation[];
}

const REQUEST_STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "pending_approval", label: "Aguardando Aprovação" },
  { value: "approved", label: "Aprovado" },
  { value: "rejected", label: "Rejeitado" },
  { value: "cutoff_locked", label: "Bloqueado por Prazo" },
];

function SimStatusBadge({ status }: { status: string }) {
  if (status === "FALTA") {
    return (
      <Badge className="gap-1 bg-destructive text-destructive-foreground text-xs">
        <AlertTriangle className="w-3 h-3" />
        Falta
      </Badge>
    );
  }
  if (status === "CRÍTICO") {
    return (
      <Badge className="gap-1 bg-chart-5/20 text-chart-5 border border-chart-5/30 text-xs">
        <AlertCircle className="w-3 h-3" />
        Crítico
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-chart-4/20 text-chart-4 border border-chart-4/30 text-xs">
      <CheckCircle2 className="w-3 h-3" />
      Adequado
    </Badge>
  );
}

export default function StockSimulation() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<SimulationFilters>({
    eventIds: [],
    requestIds: [],
    requestStatus: ["approved", "pending_approval"],
  });
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [showOnlyShortage, setShowOnlyShortage] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [breakdownView, setBreakdownView] = useState<"event" | "request">("event");
  const [eventSearch, setEventSearch] = useState("");

  const { data: events } = useQuery<any[]>({
    queryKey: ["/api/reports/simulation-events"],
  });

  const { data: requests } = useQuery<any[]>({
    queryKey: ["/api/reports/simulation-requests", filters.eventIds.join(",")],
    enabled: filters.eventIds.length > 0,
  });

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!eventSearch.trim()) return events;
    const q = eventSearch.toLowerCase();
    return events.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.client?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
    );
  }, [events, eventSearch]);

  const runSimulation = useMutation({
    mutationFn: async (): Promise<SimulationResult> => {
      const response = await apiRequest("POST", "/api/reports/stock-simulation", filters);
      return (await response.json()) as SimulationResult;
    },
    onSuccess: (data: SimulationResult) => {
      setSimulation(data);
      toast({
        title: "Simulação concluída",
        description: `Analisados ${data.summary.totalProducts} produtos`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro na simulação",
        description: error.message,
      });
    },
  });

  const toggleEvent = (id: string) =>
    setFilters((p) => ({
      ...p,
      eventIds: p.eventIds.includes(id)
        ? p.eventIds.filter((x) => x !== id)
        : [...p.eventIds, id],
    }));

  const toggleRequest = (id: string) =>
    setFilters((p) => ({
      ...p,
      requestIds: p.requestIds.includes(id)
        ? p.requestIds.filter((x) => x !== id)
        : [...p.requestIds, id],
    }));

  const toggleStatus = (value: string, checked: boolean) =>
    setFilters((p) => ({
      ...p,
      requestStatus: checked
        ? [...p.requestStatus, value]
        : p.requestStatus.filter((s) => s !== value),
    }));

  const selectAllEvents = () =>
    setFilters((p) => ({ ...p, eventIds: (events || []).map((e) => e.id) }));
  const clearEvents = () =>
    setFilters((p) => ({ ...p, eventIds: [] }));

  const toggleProductExpansion = (id: string) =>
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const exportToExcel = () => {
    if (!simulation) return;
    const wb = XLSX.utils.book_new();
    const summaryData = [
      ["RELATÓRIO DE SIMULAÇÃO DE ESTOQUE"],
      [""],
      ["Data/Hora:", new Date(simulation.generatedAt).toLocaleString("pt-BR")],
      ["Eventos Selecionados:", filters.eventIds.length],
      ["Requisições Consideradas:", simulation.consideredRequests?.length || 0],
      [""],
      ["RESUMO"],
      ["Total de Produtos:", simulation.summary.totalProducts],
      ["Em Falta:", simulation.summary.productsShortage],
      ["Crítico:", simulation.summary.productsCritical],
      ["Adequado:", simulation.summary.productsAdequate],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Resumo Executivo");

    if (simulation.consideredRequests?.length) {
      const data = [["Área", "Evento", "Status"]];
      simulation.consideredRequests.forEach((r) =>
        data.push([
          r.area,
          r.eventName,
          REQUEST_STATUS_OPTIONS.find((o) => o.value === r.status)?.label ?? r.status,
        ])
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Requisições");
    }

    const pData = [["Código/SKU", "Produto", "Necessidade", "Inventário", "Saldo", "Status", "Unidade"]];
    simulation.products.forEach((p) =>
      pData.push([p.productSku, p.productName, String(p.totalNeed), String(p.currentStock), String(p.balance), p.status, p.unit])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pData), "Produtos");

    const evData = [["Código/SKU", "Produto", "Evento", "Data do Evento", "Quantidade"]];
    simulation.products.forEach((p) =>
      p.eventBreakdown?.forEach((e) =>
        evData.push([p.productSku, p.productName, e.eventName, new Date(e.eventDate).toLocaleDateString("pt-BR"), String(e.quantity)])
      )
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(evData), "Por Evento");

    const reqData = [["Código/SKU", "Produto", "Área", "Evento", "Data do Evento", "Quantidade"]];
    simulation.products.forEach((p) =>
      p.requestBreakdown?.forEach((r) =>
        reqData.push([p.productSku, p.productName, r.requestArea, r.eventName, new Date(r.eventDate).toLocaleDateString("pt-BR"), String(r.quantity)])
      )
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reqData), "Por Requisição");

    const fileName = `Simulacao_Estoque_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({ title: "Exportado com sucesso", description: fileName });
  };

  const filteredProducts = useMemo(
    () =>
      (simulation?.products || []).filter((p) => {
        if (showOnlyShortage && p.status !== "FALTA") return false;
        if (
          searchTerm &&
          !p.productName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !p.productSku.toLowerCase().includes(searchTerm.toLowerCase())
        )
          return false;
        return true;
      }),
    [simulation, showOnlyShortage, searchTerm]
  );

  const canRun = filters.eventIds.length > 0 && filters.requestStatus.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulação de Estoque"
        description="Compare requisições de eventos com o inventário disponível."
      >
        {simulation && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSimulation(null)}
            data-testid="button-clear-simulation"
          >
            <X className="w-4 h-4 mr-1.5" />
            Limpar simulação
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Painel de filtros ── */}
        <div className="lg:sticky lg:top-4 space-y-4">
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Filter className="w-4 h-4 text-primary/70" />
                  <p className="font-semibold text-base">Filtros</p>
                </div>
                <p className="text-sm text-muted-foreground">Configure os parâmetros da simulação</p>
              </div>
              {/* ── Eventos ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Eventos
                    {filters.eventIds.length > 0 && (
                      <span className="ml-1.5 text-muted-foreground font-normal">
                        ({filters.eventIds.length} selecionado{filters.eventIds.length !== 1 ? "s" : ""})
                      </span>
                    )}
                  </Label>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllEvents}
                      className="h-6 text-xs px-2"
                      data-testid="button-select-all-events"
                    >
                      Todos
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearEvents}
                      disabled={filters.eventIds.length === 0}
                      className="h-6 text-xs px-2"
                      data-testid="button-clear-events"
                    >
                      Limpar
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar evento..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                    data-testid="input-event-search"
                  />
                </div>

                <div
                  className="border border-border/60 rounded-md p-2 max-h-56 overflow-y-auto space-y-1"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {filteredEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {events?.length === 0 ? "Nenhum evento disponível" : "Nenhum resultado"}
                    </p>
                  ) : (
                    filteredEvents.map((event) => (
                      <label
                        key={event.id}
                        htmlFor={`ev-${event.id}`}
                        className={`flex items-start gap-2.5 rounded px-2 py-1.5 cursor-pointer transition-colors ${
                          filters.eventIds.includes(event.id)
                            ? "bg-primary/8"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          id={`ev-${event.id}`}
                          checked={filters.eventIds.includes(event.id)}
                          onCheckedChange={() => toggleEvent(event.id)}
                          className="mt-0.5"
                          data-testid={`checkbox-event-${event.id}`}
                        />
                        <div className="min-w-0">
                          <div className="text-sm leading-tight truncate">{event.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(event.eventDate).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* ── Requisições opcionais ── */}
              {requests && requests.length > 0 && (
                <div className="space-y-2">
                  <Label>Requisições (opcional)</Label>
                  <div
                    className="border border-border/60 rounded-md p-2 max-h-40 overflow-y-auto space-y-1"
                    style={{ scrollbarWidth: "thin" }}
                  >
                    {requests.map((req) => (
                      <label
                        key={req.id}
                        htmlFor={`req-${req.id}`}
                        className="flex items-start gap-2.5 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`req-${req.id}`}
                          checked={filters.requestIds.includes(req.id)}
                          onCheckedChange={() => toggleRequest(req.id)}
                          className="mt-0.5"
                          data-testid={`checkbox-request-${req.id}`}
                        />
                        <div className="min-w-0">
                          <div className="text-sm truncate">{req.area}</div>
                          <div className="text-xs text-muted-foreground">
                            {REQUEST_STATUS_OPTIONS.find((o) => o.value === req.status)?.label ?? req.status}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Status das requisições ── */}
              <div className="space-y-2">
                <Label>
                  Status das Requisições
                  {filters.requestStatus.length === 0 && (
                    <span className="ml-1.5 text-xs text-destructive">(obrigatório)</span>
                  )}
                </Label>
                <div className="space-y-1.5">
                  {REQUEST_STATUS_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      htmlFor={`st-${value}`}
                      className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                    >
                      <Checkbox
                        id={`st-${value}`}
                        checked={filters.requestStatus.includes(value)}
                        onCheckedChange={(checked) => toggleStatus(value, !!checked)}
                        data-testid={`checkbox-status-${value}`}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => runSimulation.mutate()}
                disabled={!canRun || runSimulation.isPending}
                data-testid="button-run-simulation"
              >
                {runSimulation.isPending ? (
                  "Processando..."
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Gerar Simulação
                  </>
                )}
              </Button>

              {!canRun && !runSimulation.isPending && (
                <p className="text-xs text-muted-foreground text-center">
                  {filters.eventIds.length === 0
                    ? "Selecione ao menos 1 evento"
                    : "Selecione ao menos 1 status"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Painel de resultados ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          {simulation && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{simulation.summary.totalProducts}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Total Analisado</div>
                  </CardContent>
                </Card>
                <Card className="border-destructive/40">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-destructive">
                      {simulation.summary.productsShortage}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Em Falta</div>
                  </CardContent>
                </Card>
                <Card className="border-chart-5/40">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-chart-5">
                      {simulation.summary.productsCritical}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Crítico</div>
                  </CardContent>
                </Card>
                <Card className="border-chart-4/40">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-chart-4">
                      {simulation.summary.productsAdequate}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Adequado</div>
                  </CardContent>
                </Card>
              </div>

              {/* Requisições consideradas */}
              {simulation.consideredRequests?.length > 0 && (
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <div className="mb-3">
                      <p className="font-semibold text-base">Requisições Consideradas</p>
                      <p className="text-sm text-muted-foreground">
                        {simulation.consideredRequests.length} requisição
                        {simulation.consideredRequests.length !== 1 ? "ões" : ""} incluída
                        {simulation.consideredRequests.length !== 1 ? "s" : ""} nesta simulação
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {simulation.consideredRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-start justify-between gap-2 p-2.5 border border-border/60 rounded-md"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{req.area}</div>
                            <div className="text-xs text-muted-foreground truncate">{req.eventName}</div>
                          </div>
                          <StatusBadge status={req.status} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detalhamento por produto */}
              <Card className="border-border/60">
                <CardContent className="p-4 pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="font-semibold text-base">Detalhamento por Produto</p>
                      <p className="text-sm text-muted-foreground">
                        Gerado em{" "}
                        {new Date(simulation.generatedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex rounded-md border border-border/60 overflow-hidden">
                        <Button
                          variant={breakdownView === "event" ? "default" : "ghost"}
                          size="sm"
                          className="rounded-none"
                          onClick={() => setBreakdownView("event")}
                          data-testid="button-view-event"
                        >
                          Por Evento
                        </Button>
                        <Button
                          variant={breakdownView === "request" ? "default" : "ghost"}
                          size="sm"
                          className="rounded-none"
                          onClick={() => setBreakdownView("request")}
                          data-testid="button-view-request"
                        >
                          Por Requisição
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportToExcel}
                        data-testid="button-export-excel"
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                        Exportar Excel
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardContent className="space-y-4">
                  {/* Busca + filtro */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-48">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar produto ou SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                        data-testid="input-search-product"
                      />
                    </div>
                    <label
                      htmlFor="showOnlyShortage"
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <Checkbox
                        id="showOnlyShortage"
                        checked={showOnlyShortage}
                        onCheckedChange={(v) => setShowOnlyShortage(!!v)}
                        data-testid="checkbox-only-shortage"
                      />
                      Apenas em falta
                    </label>
                    {(searchTerm || showOnlyShortage) && (
                      <span className="text-xs text-muted-foreground">
                        {filteredProducts.length} de {simulation.products.length} produto
                        {simulation.products.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {filteredProducts.length === 0 ? (
                    <EmptyState
                      icon={PackageX}
                      title="Nenhum produto encontrado"
                      description="Ajuste a busca ou os filtros para ver resultados."
                      compact
                    />
                  ) : (
                    <div
                      className="border border-border/60 rounded-md overflow-hidden"
                      style={{ scrollbarWidth: "thin" }}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8" />
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Necessário</TableHead>
                            <TableHead className="text-right">Inventário</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.map((product) => (
                            <Collapsible
                              key={product.productId}
                              open={expandedProducts.has(product.productId)}
                              onOpenChange={() => toggleProductExpansion(product.productId)}
                              asChild
                            >
                              <>
                                <CollapsibleTrigger asChild>
                                  <TableRow
                                    className={`cursor-pointer hover-elevate ${
                                      product.status === "FALTA"
                                        ? "bg-destructive/5"
                                        : ""
                                    }`}
                                    data-testid={`row-product-${product.productId}`}
                                  >
                                    <TableCell className="pr-0">
                                      {expandedProducts.has(product.productId) ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium text-sm leading-tight">
                                        {product.productName}
                                      </div>
                                      <div className="text-xs text-muted-foreground font-mono">
                                        {product.productSku}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-sm">
                                      {product.totalNeed} {product.unit}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {product.currentStock} {product.unit}
                                    </TableCell>
                                    <TableCell
                                      className={`text-right font-semibold text-sm ${
                                        product.balance < 0
                                          ? "text-destructive"
                                          : "text-chart-4"
                                      }`}
                                    >
                                      {product.balance} {product.unit}
                                    </TableCell>
                                    <TableCell>
                                      <SimStatusBadge status={product.status} />
                                    </TableCell>
                                  </TableRow>
                                </CollapsibleTrigger>
                                <CollapsibleContent asChild>
                                  <TableRow>
                                    <TableCell colSpan={6} className="bg-muted/30 p-0">
                                      <div
                                        className="p-4 space-y-1.5"
                                        style={{ scrollbarWidth: "thin" }}
                                      >
                                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                          {breakdownView === "event"
                                            ? "Detalhamento por Evento"
                                            : "Detalhamento por Requisição"}
                                        </div>
                                        {breakdownView === "event"
                                          ? product.eventBreakdown?.map((ev, idx) => (
                                              <div
                                                key={idx}
                                                className="flex items-center gap-2 text-sm pl-2 py-0.5"
                                              >
                                                <span className="flex-1 text-foreground">
                                                  {ev.eventName}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                  {new Date(ev.eventDate).toLocaleDateString("pt-BR")}
                                                </span>
                                                <span className="font-semibold tabular-nums">
                                                  {ev.quantity} {product.unit}
                                                </span>
                                              </div>
                                            ))
                                          : product.requestBreakdown?.map((req, idx) => (
                                              <div
                                                key={idx}
                                                className="flex items-start gap-2 text-sm pl-2 py-0.5"
                                              >
                                                <div className="flex-1 min-w-0">
                                                  <div className="truncate">{req.requestArea}</div>
                                                  <div className="text-xs text-muted-foreground truncate">
                                                    {req.eventName}
                                                  </div>
                                                </div>
                                                <span className="text-muted-foreground text-xs whitespace-nowrap">
                                                  {new Date(req.eventDate).toLocaleDateString("pt-BR")}
                                                </span>
                                                <span className="font-semibold tabular-nums">
                                                  {req.quantity} {product.unit}
                                                </span>
                                              </div>
                                            ))}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                </CollapsibleContent>
                              </>
                            </Collapsible>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!simulation && (
            <EmptyState
              icon={BarChart3}
              title="Nenhuma simulação executada"
              description="Selecione eventos e status de requisições, depois clique em Gerar Simulação para ver disponibilidade e alocações."
              action={
                canRun
                  ? {
                      label: "Gerar Simulação",
                      onClick: () => runSimulation.mutate(),
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
