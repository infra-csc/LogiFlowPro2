import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Filter,
  Search,
  CalendarRange,
  LayoutGrid,
  ListChecks,
  AlertCircle,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import type { StockProjectionResult, StockProjectionParams } from "@shared/stock-projection";
import { ProjectionMatrix } from "@/components/stock-projection/projection-matrix";
import { ProjectionDayView } from "@/components/stock-projection/projection-day-view";
import { ProjectionConflicts } from "@/components/stock-projection/projection-conflicts";
import { ProjectionMovements } from "@/components/stock-projection/projection-movements";

const DEFAULT_START = format(new Date(), "yyyy-MM-dd");
const DEFAULT_END = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

interface SourceFlags {
  loadingOrders: boolean;
  requests: boolean;
  movements: boolean;
}

const DEFAULT_SOURCES: SourceFlags = {
  loadingOrders: true,
  requests: true,
  movements: true,
};

export default function StockProjection() {
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [endDate, setEndDate] = useState(DEFAULT_END);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [eventSearch, setEventSearch] = useState("");
  const [sources, setSources] = useState<SourceFlags>(DEFAULT_SOURCES);
  const [onlyShortages, setOnlyShortages] = useState(false);

  const [result, setResult] = useState<StockProjectionResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: events } = useQuery<any[]>({ queryKey: ["/api/events"] });

  const dateError = startDate && endDate && startDate > endDate;
  const anySource = sources.loadingOrders || sources.requests || sources.movements;
  const canGenerate = !dateError && !!startDate && !!endDate && anySource;

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!eventSearch.trim()) return events;
    const q = eventSearch.toLowerCase();
    return events.filter(
      (e: any) =>
        e.name?.toLowerCase().includes(q) ||
        e.client?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q),
    );
  }, [events, eventSearch]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    try {
      setIsGenerating(true);
      setError(null);
      const payload: StockProjectionParams = {
        startDate,
        endDate,
        eventIds: selectedEventIds,
        include: {
          loadingOrders: sources.loadingOrders,
          requests: sources.requests,
          movements: sources.movements,
        },
        onlyShortages,
      };
      const response = await apiRequest("POST", "/api/reports/stock-projection", payload);
      const data = (await response.json()) as StockProjectionResult;
      setResult(data);
    } catch (err: any) {
      console.error("Error generating projection:", err);
      setError(err?.message || "Erro ao gerar projeção");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    setSelectedEventIds([]);
    setStartDate(DEFAULT_START);
    setEndDate(DEFAULT_END);
    setSources(DEFAULT_SOURCES);
    setOnlyShortages(false);
    setEventSearch("");
    setResult(null);
    setError(null);
  };

  const toggleEvent = (id: string) =>
    setSelectedEventIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const selectAllEvents = () => setSelectedEventIds((events || []).map((e: any) => e.id));
  const clearEvents = () => setSelectedEventIds([]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projeção de Estoque"
        description="Saldo projetado dia a dia, considerando requisições aprovadas, ordens de carregamento e movimentações."
      >
        {result && (
          <Button variant="outline" size="sm" onClick={handleClear} data-testid="button-clear-projection">
            <X className="w-4 h-4 mr-1.5" />
            Limpar
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Filtros ── */}
        <div className="lg:sticky lg:top-4 space-y-4">
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Filter className="w-4 h-4 text-primary/70" />
                  <p className="font-semibold text-base">Filtros</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Defina o período e as fontes da projeção
                </p>
              </div>

              {/* Datas */}
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
              </div>

              {/* Fontes */}
              <div className="space-y-2">
                <Label>
                  Fontes consideradas
                  {!anySource && <span className="ml-1.5 text-xs text-destructive">(selecione 1)</span>}
                </Label>
                <div className="border border-border/60 rounded-md p-2 space-y-0.5">
                  <label
                    htmlFor="src-loading"
                    className="flex items-center gap-2.5 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      id="src-loading"
                      checked={sources.loadingOrders}
                      onCheckedChange={(v) => setSources((s) => ({ ...s, loadingOrders: !!v }))}
                      data-testid="checkbox-source-loading"
                    />
                    <span className="text-sm">Ordens de carregamento</span>
                  </label>
                  <label
                    htmlFor="src-requests"
                    className="flex items-center gap-2.5 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      id="src-requests"
                      checked={sources.requests}
                      onCheckedChange={(v) => setSources((s) => ({ ...s, requests: !!v }))}
                      data-testid="checkbox-source-requests"
                    />
                    <span className="text-sm">Requisições aprovadas</span>
                  </label>
                  <label
                    htmlFor="src-movements"
                    className="flex items-center gap-2.5 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      id="src-movements"
                      checked={sources.movements}
                      onCheckedChange={(v) => setSources((s) => ({ ...s, movements: !!v }))}
                      data-testid="checkbox-source-movements"
                    />
                    <span className="text-sm">Movimentações</span>
                  </label>
                </div>
              </div>

              {/* Eventos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>
                    Eventos
                    {selectedEventIds.length > 0 && (
                      <span className="ml-1.5 text-muted-foreground font-normal">
                        ({selectedEventIds.length})
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
                <p className="text-xs text-muted-foreground">
                  Vazio = todos os eventos do período.
                </p>
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
                          selectedEventIds.includes(event.id) ? "bg-primary/8" : "hover:bg-muted/50"
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

              {/* Opções */}
              <label
                htmlFor="only-shortages"
                className="flex items-center gap-2.5 rounded px-1 py-1 cursor-pointer"
              >
                <Checkbox
                  id="only-shortages"
                  checked={onlyShortages}
                  onCheckedChange={(v) => setOnlyShortages(!!v)}
                  data-testid="checkbox-only-shortages"
                />
                <span className="text-sm">Mostrar apenas produtos em falta</span>
              </label>

              {/* Ações */}
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  data-testid="button-generate"
                >
                  {isGenerating ? "Gerando..." : "Gerar Projeção"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleClear}
                  data-testid="button-clear-filters"
                >
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Resultados ── */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <Card className="border-destructive/40">
              <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </CardContent>
            </Card>
          )}

          {!result && !isGenerating && (
            <EmptyState
              icon={CalendarRange}
              title="Gere uma projeção"
              description="Selecione o período e as fontes, depois clique em Gerar Projeção para ver o saldo dia a dia."
            />
          )}

          {result && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{result.summary.totalProducts}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Produtos</div>
                  </CardContent>
                </Card>
                <Card className="border-destructive/40">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-destructive">
                      {result.summary.productsShortage}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Em falta</div>
                  </CardContent>
                </Card>
                <Card className="border-chart-5/40">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-chart-5">{result.summary.productsLow}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Abaixo do mínimo</div>
                  </CardContent>
                </Card>
                <Card className="border-chart-4/40">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-chart-4">{result.summary.productsOk}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Adequados</div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="matrix">
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="matrix" data-testid="tab-matrix">
                    <LayoutGrid className="w-4 h-4 mr-1.5" />
                    Matriz por Dia
                  </TabsTrigger>
                  <TabsTrigger value="day" data-testid="tab-day">
                    <ListChecks className="w-4 h-4 mr-1.5" />
                    Visão por Dia
                  </TabsTrigger>
                  <TabsTrigger value="conflicts" data-testid="tab-conflicts">
                    <AlertCircle className="w-4 h-4 mr-1.5" />
                    Conflitos
                    {result.conflicts.length > 0 && (
                      <span className="ml-1.5 text-xs rounded-full bg-destructive/15 text-destructive px-1.5">
                        {result.conflicts.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="movements" data-testid="tab-movements">
                    <Truck className="w-4 h-4 mr-1.5" />
                    Movimentações
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="matrix" className="mt-4">
                  <ProjectionMatrix result={result} />
                </TabsContent>
                <TabsContent value="day" className="mt-4">
                  <ProjectionDayView result={result} />
                </TabsContent>
                <TabsContent value="conflicts" className="mt-4">
                  <ProjectionConflicts result={result} />
                </TabsContent>
                <TabsContent value="movements" className="mt-4">
                  <ProjectionMovements result={result} />
                </TabsContent>
              </Tabs>

              <p className="text-xs text-muted-foreground">
                Base: estoque atual de cada produto. Gerado em{" "}
                {new Date(result.generatedAt).toLocaleString("pt-BR")}.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
