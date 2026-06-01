import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Calendar,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  PackageSearch,
  TrendingDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from "xlsx";

interface StockPositionFilters {
  startDate: string;
  endDate: string;
  eventIds: string[];
  orderStatus: string[];
}

interface AllocationPeriod {
  start: string;
  end: string;
  days: number;
}

interface OrderDetail {
  orderId: string;
  orderNumber: string;
  eventName: string;
  quantity: number;
  periodStart: string;
  periodEnd: string;
  periodDetail: string;
  hasMultipleTrips: boolean;
  status: string;
  daysUnavailable: number;
}

interface ProductResult {
  productId: string;
  productSku: string;
  productName: string;
  currentStock: number;
  allocatedQuantity: number;
  availableStock: number;
  utilization: number;
  status: "DISPONÍVEL" | "PARCIAL" | "TOTALMENTE_ALOCADO";
  allocationPeriod: AllocationPeriod | null;
  ordersDetails: OrderDetail[];
}

interface SimulationResult {
  generatedAt: string;
  filters: StockPositionFilters;
  summary: {
    totalProducts: number;
    availableProducts: number;
    partialProducts: number;
    fullyAllocatedProducts: number;
  };
  products: ProductResult[];
  errors: Array<{ orderId: string; orderNumber: string; message: string }>;
  warnings: Array<{ orderId: string; orderNumber: string; message: string }>;
}

const ORDER_STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "ready", label: "Pronta" },
  { value: "approved", label: "Aprovada" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "completed", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
];

function StockStatusBadge({ status }: { status: string }) {
  if (status === "DISPONÍVEL") {
    return (
      <Badge className="bg-chart-4/20 text-chart-4 border border-chart-4/30 text-xs">
        Disponível
      </Badge>
    );
  }
  if (status === "PARCIAL") {
    return (
      <Badge className="bg-chart-5/20 text-chart-5 border border-chart-5/30 text-xs">
        Parcial
      </Badge>
    );
  }
  return (
    <Badge className="bg-destructive text-destructive-foreground text-xs">
      Totalmente Alocado
    </Badge>
  );
}

const DEFAULT_START = format(new Date(), "yyyy-MM-dd");
const DEFAULT_END = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

export default function StockPositionSimulation() {
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [endDate, setEndDate] = useState(DEFAULT_END);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["approved", "in_progress", "ready"]);
  const [eventSearch, setEventSearch] = useState("");

  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const { data: events } = useQuery<any[]>({
    queryKey: ["/api/events"],
  });

  const dateError = startDate && endDate && startDate > endDate;

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!eventSearch.trim()) return events;
    const q = eventSearch.toLowerCase();
    return events.filter(
      (e: any) =>
        e.name?.toLowerCase().includes(q) ||
        e.client?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
    );
  }, [events, eventSearch]);

  const canGenerate =
    !dateError &&
    startDate &&
    endDate &&
    selectedStatuses.length > 0;

  const handleGenerateSimulation = async () => {
    if (!canGenerate) return;
    try {
      setIsGenerating(true);
      const payload = {
        startDate,
        endDate,
        eventIds: selectedEventIds,
        orderStatus: selectedStatuses,
      };
      const response = await apiRequest("POST", "/api/reports/stock-position-simulation", payload);
      const result = (await response.json()) as SimulationResult;
      setSimulationResult(result);
    } catch (error) {
      console.error("Error generating simulation:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    setSelectedEventIds([]);
    setSelectedStatuses(["approved", "in_progress", "ready"]);
    setStartDate(DEFAULT_START);
    setEndDate(DEFAULT_END);
    setSimulationResult(null);
    setEventSearch("");
  };

  const toggleEvent = (id: string) =>
    setSelectedEventIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    );

  const toggleStatus = (value: string) =>
    setSelectedStatuses((p) =>
      p.includes(value) ? p.filter((s) => s !== value) : [...p, value]
    );

  const selectAllEvents = () =>
    setSelectedEventIds((events || []).map((e: any) => e.id));

  const clearEvents = () => setSelectedEventIds([]);

  const toggleProductExpansion = (id: string) =>
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const exportToExcel = () => {
    if (!simulationResult) return;
    const wb = XLSX.utils.book_new();
    const summaryData = [
      ["RELATÓRIO DE POSIÇÃO DE ESTOQUE"],
      [""],
      ["Gerado em:", new Date(simulationResult.generatedAt).toLocaleString("pt-BR")],
      [""],
      ["RESUMO"],
      ["Total de Produtos:", simulationResult.summary.totalProducts],
      ["Disponíveis:", simulationResult.summary.availableProducts],
      ["Parcialmente Alocados:", simulationResult.summary.partialProducts],
      ["Totalmente Alocados:", simulationResult.summary.fullyAllocatedProducts],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Resumo");
    const pData = [
      ["Código/SKU", "Produto", "Estoque Atual", "Qtd Alocada", "Saldo Disponível", "% Utilização", "Status"],
    ];
    simulationResult.products.forEach((p) =>
      pData.push([
        p.productSku,
        p.productName,
        String(p.currentStock),
        String(p.allocatedQuantity),
        String(p.availableStock),
        `${p.utilization.toFixed(1)}%`,
        p.status,
      ])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pData), "Posição de Estoque");
    const fileName = `Posicao_Estoque_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulação de Posição de Estoque"
        description="Visualize o saldo projetado considerando alocações temporárias por período."
      >
        {simulationResult && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
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
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Filter className="w-4 h-4" />
                Filtros
              </CardTitle>
              <CardDescription>Configure o período e as ordens a simular</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* ── Datas ── */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Data Início</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={dateError ? "border-destructive" : ""}
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate">Data Fim</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={dateError ? "border-destructive" : ""}
                    data-testid="input-end-date"
                  />
                </div>
                {dateError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Data de início deve ser anterior à data fim
                  </div>
                )}
                {!dateError && startDate && endDate && (
                  <p className="text-xs text-muted-foreground">
                    Período para calcular o saldo projetado.
                  </p>
                )}
              </div>

              {/* ── Eventos ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Eventos
                    {selectedEventIds.length > 0 && (
                      <span className="ml-1.5 text-muted-foreground font-normal">
                        ({selectedEventIds.length} selecionado{selectedEventIds.length !== 1 ? "s" : ""})
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
                      disabled={selectedEventIds.length === 0}
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
                  className="border border-border/60 rounded-md p-2 max-h-52 overflow-y-auto space-y-0.5"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {filteredEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {!events?.length ? "Nenhum evento disponível" : "Nenhum resultado"}
                    </p>
                  ) : (
                    filteredEvents.map((event: any) => (
                      <label
                        key={event.id}
                        htmlFor={`ev-${event.id}`}
                        className={`flex items-start gap-2.5 rounded px-2 py-1.5 cursor-pointer transition-colors ${
                          selectedEventIds.includes(event.id)
                            ? "bg-primary/8"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          id={`ev-${event.id}`}
                          checked={selectedEventIds.includes(event.id)}
                          onCheckedChange={() => toggleEvent(event.id)}
                          className="mt-0.5"
                          data-testid={`checkbox-event-${event.id}`}
                        />
                        <div className="min-w-0">
                          <div className="text-sm leading-tight truncate">{event.name}</div>
                          {event.eventDate && (
                            <div className="text-xs text-muted-foreground">
                              {new Date(event.eventDate).toLocaleDateString("pt-BR")}
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* ── Status das ordens ── */}
              <div className="space-y-2">
                <Label>
                  Status das Ordens
                  {selectedStatuses.length === 0 && (
                    <span className="ml-1.5 text-xs text-destructive">(obrigatório)</span>
                  )}
                </Label>
                <div
                  className="border border-border/60 rounded-md p-2 space-y-0.5"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {ORDER_STATUS_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      htmlFor={`st-${value}`}
                      className="flex items-center gap-2.5 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`st-${value}`}
                        checked={selectedStatuses.includes(value)}
                        onCheckedChange={() => toggleStatus(value)}
                        data-testid={`checkbox-status-${value}`}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Ações ── */}
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={handleGenerateSimulation}
                  disabled={!canGenerate || isGenerating}
                  data-testid="button-generate"
                >
                  {isGenerating ? "Gerando..." : "Gerar Simulação"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleClear}
                  data-testid="button-clear"
                >
                  Limpar Filtros
                </Button>
              </div>

              {!canGenerate && !isGenerating && (
                <p className="text-xs text-muted-foreground text-center">
                  {dateError
                    ? "Corrija as datas para continuar"
                    : !startDate || !endDate
                    ? "Informe o período"
                    : "Selecione ao menos 1 status"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Painel de resultados ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Erros acionáveis */}
          {simulationResult && simulationResult.errors.length > 0 && (
            <Card className="border-destructive/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  Algumas ordens não puderam ser simuladas
                </CardTitle>
                <CardDescription>
                  {simulationResult.errors.length} ordem
                  {simulationResult.errors.length !== 1 ? "ns" : ""} ignorada
                  {simulationResult.errors.length !== 1 ? "s" : ""} por falta de dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="space-y-2 max-h-48 overflow-y-auto"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {simulationResult.errors.map((err, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 border border-destructive/20 bg-destructive/5 rounded-md"
                    >
                      <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{err.orderNumber}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{err.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Avisos */}
          {simulationResult && simulationResult.warnings.length > 0 && (
            <Card className="border-chart-5/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-chart-5">
                  <Info className="w-4 h-4" />
                  Avisos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="space-y-2 max-h-40 overflow-y-auto"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {simulationResult.warnings.map((w, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 border border-chart-5/20 bg-chart-5/5 rounded-md"
                    >
                      <Info className="w-4 h-4 text-chart-5 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{w.orderNumber}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{w.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {simulationResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{simulationResult.summary.totalProducts}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Total de Produtos</div>
                </CardContent>
              </Card>
              <Card className="border-chart-4/40">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-chart-4">
                    {simulationResult.summary.availableProducts}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Disponíveis</div>
                </CardContent>
              </Card>
              <Card className="border-chart-5/40">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-chart-5">
                    {simulationResult.summary.partialProducts}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Parcialmente Alocados</div>
                </CardContent>
              </Card>
              <Card className="border-destructive/40">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-destructive">
                    {simulationResult.summary.fullyAllocatedProducts}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Totalmente Alocados</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabela de produtos */}
          {simulationResult && simulationResult.products.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">Detalhamento por Produto</CardTitle>
                    <CardDescription>
                      Gerado em {new Date(simulationResult.generatedAt).toLocaleString("pt-BR")}
                    </CardDescription>
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
              </CardHeader>
              <CardContent className="p-0">
                <div
                  className="overflow-x-auto"
                  style={{ scrollbarWidth: "thin" }}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Estoque</TableHead>
                        <TableHead className="text-right">Alocado</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="text-right">Util.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Período</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulationResult.products.map((product) => (
                        <>
                          <TableRow
                            key={product.productId}
                            className={`cursor-pointer hover-elevate ${
                              product.utilization >= 100 ? "bg-destructive/5" : ""
                            }`}
                            onClick={() => toggleProductExpansion(product.productId)}
                            data-testid={`row-product-${product.productId}`}
                          >
                            <TableCell className="pr-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleProductExpansion(product.productId);
                                }}
                                className="text-muted-foreground"
                                data-testid={`button-expand-${product.productId}`}
                              >
                                {expandedProducts.has(product.productId) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm leading-tight">
                                {product.productName}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {product.productSku}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {product.currentStock}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {product.allocatedQuantity}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums font-semibold">
                              <span
                                className={
                                  product.availableStock < 0
                                    ? "text-destructive"
                                    : "text-chart-4"
                                }
                              >
                                {product.availableStock}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      product.utilization >= 100
                                        ? "bg-destructive"
                                        : product.utilization >= 80
                                        ? "bg-chart-5"
                                        : "bg-chart-4"
                                    }`}
                                    style={{ width: `${Math.min(product.utilization, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                  {product.utilization.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <StockStatusBadge status={product.status} />
                            </TableCell>
                            <TableCell>
                              {product.allocationPeriod ? (
                                <div className="text-xs leading-tight">
                                  <div>
                                    {format(new Date(product.allocationPeriod.start), "dd/MM")} –{" "}
                                    {format(new Date(product.allocationPeriod.end), "dd/MM/yyyy")}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {product.allocationPeriod.days} dia{product.allocationPeriod.days !== 1 ? "s" : ""}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem alocação</span>
                              )}
                            </TableCell>
                          </TableRow>

                          {expandedProducts.has(product.productId) && (
                            <TableRow key={`${product.productId}-detail`} className="bg-muted/30">
                              <TableCell colSpan={8} className="p-4">
                                <div className="space-y-4">
                                  {/* Timeline visual */}
                                  {product.allocationPeriod && product.ordersDetails.length > 0 && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                        Timeline de Alocação — {product.productName}
                                      </div>
                                      <div className="bg-muted/50 rounded-md p-3">
                                        <div className="relative h-7 bg-muted rounded-full overflow-hidden">
                                          {product.ordersDetails.map((order, idx) => {
                                            const filterStart = new Date(simulationResult.filters.startDate);
                                            const filterEnd = new Date(simulationResult.filters.endDate);
                                            const totalDays = Math.ceil(
                                              (filterEnd.getTime() - filterStart.getTime()) /
                                                (1000 * 60 * 60 * 24)
                                            );
                                            const orderStart = new Date(order.periodStart);
                                            const orderEnd = new Date(order.periodEnd);
                                            const daysFromStart = Math.ceil(
                                              (orderStart.getTime() - filterStart.getTime()) /
                                                (1000 * 60 * 60 * 24)
                                            );
                                            const orderDuration = Math.ceil(
                                              (orderEnd.getTime() - orderStart.getTime()) /
                                                (1000 * 60 * 60 * 24)
                                            );
                                            const leftPercent = Math.max(0, (daysFromStart / totalDays) * 100);
                                            const widthPercent = Math.min(
                                              (orderDuration / totalDays) * 100,
                                              100 - leftPercent
                                            );
                                            const colors = [
                                              "bg-primary",
                                              "bg-chart-2",
                                              "bg-chart-5",
                                              "bg-chart-1",
                                              "bg-chart-3",
                                            ];
                                            return (
                                              <div
                                                key={idx}
                                                className={`absolute h-7 ${colors[idx % colors.length]} opacity-70 flex items-center justify-center`}
                                                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                                                title={`${order.orderNumber} — ${format(orderStart, "dd/MM/yyyy")} até ${format(orderEnd, "dd/MM/yyyy")}`}
                                              >
                                                <span className="text-xs text-white font-medium px-1 truncate">
                                                  {order.orderNumber}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                                          <span>
                                            {format(new Date(simulationResult.filters.startDate), "dd/MM/yyyy")}
                                          </span>
                                          <span>
                                            {format(new Date(simulationResult.filters.endDate), "dd/MM/yyyy")}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Ordens que usam o produto */}
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                      Ordens que Utilizam este Produto
                                    </div>
                                    <div
                                      className="space-y-2 max-h-64 overflow-y-auto"
                                      style={{ scrollbarWidth: "thin" }}
                                    >
                                      {product.ordersDetails.map((order, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-start justify-between gap-3 p-3 border border-border/60 rounded-md bg-background"
                                        >
                                          <div className="space-y-0.5 min-w-0">
                                            <div className="text-sm font-medium">
                                              {order.orderNumber} — {order.eventName}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              Quantidade: {order.quantity}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {order.periodDetail}:{" "}
                                              {format(new Date(order.periodStart), "dd/MM/yyyy")} até{" "}
                                              {format(new Date(order.periodEnd), "dd/MM/yyyy")}{" "}
                                              ({order.daysUnavailable} dia{order.daysUnavailable !== 1 ? "s" : ""})
                                            </div>
                                            {order.hasMultipleTrips && (
                                              <div className="flex items-center gap-1 text-xs text-chart-5">
                                                <Info className="w-3 h-3 flex-shrink-0" />
                                                Período consolidado de múltiplas viagens
                                              </div>
                                            )}
                                          </div>
                                          <StatusBadge status={order.status} />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {simulationResult && simulationResult.products.length === 0 && (
            <EmptyState
              icon={PackageSearch}
              title="Nenhum produto encontrado"
              description="Tente ajustar os filtros de período, eventos ou status de ordens para ver resultados."
            />
          )}

          {!simulationResult && !isGenerating && (
            <EmptyState
              icon={TrendingDown}
              title="Nenhuma simulação executada"
              description="Defina o período e os status de ordens desejados, depois clique em Gerar Simulação para visualizar o saldo projetado."
              action={
                canGenerate
                  ? { label: "Gerar Simulação", onClick: handleGenerateSimulation }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
