import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  BarChart3, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Play,
  Filter
} from "lucide-react";
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
  status: 'FALTA' | 'CRÍTICO' | 'ADEQUADO';
  eventBreakdown: Array<{
    eventId: string;
    eventName: string;
    eventDate: string;
    requestId: string;
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
  products: ProductSimulation[];
}

export default function StockSimulation() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<SimulationFilters>({
    eventIds: [],
    requestIds: [],
    requestStatus: ['approved', 'submitted'],
  });
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [showOnlyShortage, setShowOnlyShortage] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch events for filter
  const { data: events } = useQuery<any[]>({
    queryKey: ["/api/reports/simulation-events"],
  });

  // Fetch requests based on selected events
  const { data: requests } = useQuery<any[]>({
    queryKey: ["/api/reports/simulation-requests", filters.eventIds.join(',')],
    enabled: filters.eventIds.length > 0,
  });

  // Run simulation
  const runSimulation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/reports/stock-simulation", filters);
    },
    onSuccess: (data) => {
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

  const toggleEventSelection = (eventId: string) => {
    setFilters(prev => ({
      ...prev,
      eventIds: prev.eventIds.includes(eventId)
        ? prev.eventIds.filter(id => id !== eventId)
        : [...prev.eventIds, eventId]
    }));
  };

  const toggleRequestSelection = (requestId: string) => {
    setFilters(prev => ({
      ...prev,
      requestIds: prev.requestIds.includes(requestId)
        ? prev.requestIds.filter(id => id !== requestId)
        : [...prev.requestIds, requestId]
    }));
  };

  const toggleProductExpansion = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const exportToExcel = () => {
    if (!simulation) return;

    const wb = XLSX.utils.book_new();

    // Aba 1: Resumo Executivo
    const summaryData = [
      ["RELATÓRIO DE SIMULAÇÃO DE ESTOQUE"],
      [""],
      ["Data/Hora da Simulação:", new Date(simulation.generatedAt).toLocaleString("pt-BR")],
      ["Eventos Selecionados:", filters.eventIds.length],
      [""],
      ["RESUMO EXECUTIVO"],
      ["Total de Produtos Analisados:", simulation.summary.totalProducts],
      ["Produtos em FALTA:", simulation.summary.productsShortage],
      ["Produtos em estado CRÍTICO:", simulation.summary.productsCritical],
      ["Produtos com estoque ADEQUADO:", simulation.summary.productsAdequate],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Executivo");

    // Aba 2: Detalhamento por Produto
    const productsData = [
      ["Código/SKU", "Produto", "Necessidade", "Inventário", "Saldo", "Status", "Unidade"]
    ];
    simulation.products.forEach(p => {
      productsData.push([
        p.productSku,
        p.productName,
        p.totalNeed,
        p.currentStock,
        p.balance,
        p.status,
        p.unit
      ]);
    });
    const wsProducts = XLSX.utils.aoa_to_sheet(productsData);
    XLSX.utils.book_append_sheet(wb, wsProducts, "Detalhamento por Produto");

    // Aba 3: Detalhamento por Evento
    const eventsData = [
      ["Código/SKU", "Produto", "Evento", "Data do Evento", "Quantidade"]
    ];
    simulation.products.forEach(p => {
      p.eventBreakdown.forEach(e => {
        eventsData.push([
          p.productSku,
          p.productName,
          e.eventName,
          new Date(e.eventDate).toLocaleDateString("pt-BR"),
          e.quantity
        ]);
      });
    });
    const wsEvents = XLSX.utils.aoa_to_sheet(eventsData);
    XLSX.utils.book_append_sheet(wb, wsEvents, "Detalhamento por Evento");

    // Save file
    const fileName = `Simulacao_Estoque_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: "Exportado com sucesso",
      description: `Arquivo ${fileName} baixado`,
    });
  };

  const filteredProducts = simulation?.products.filter(p => {
    if (showOnlyShortage && p.status !== 'FALTA') return false;
    if (searchTerm && !p.productName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !p.productSku.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FALTA':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />FALTA</Badge>;
      case 'CRÍTICO':
        return <Badge className="gap-1 bg-orange-500"><AlertCircle className="w-3 h-3" />CRÍTICO</Badge>;
      case 'ADEQUADO':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" />ADEQUADO</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-8 h-8" />
            Simulação de Estoque
          </h1>
          <p className="text-muted-foreground mt-1">
            Confronte requisições de eventos com inventário disponível
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
            <CardDescription>Configure os parâmetros da simulação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event Selection */}
            <div className="space-y-2">
              <Label>Eventos</Label>
              <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-2">
                {events?.map((event) => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`event-${event.id}`}
                      checked={filters.eventIds.includes(event.id)}
                      onCheckedChange={() => toggleEventSelection(event.id)}
                      data-testid={`checkbox-event-${event.id}`}
                    />
                    <label
                      htmlFor={`event-${event.id}`}
                      className="text-sm flex-1 cursor-pointer"
                    >
                      {event.name}
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.eventDate).toLocaleDateString("pt-BR")}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              {filters.eventIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {filters.eventIds.length} evento(s) selecionado(s)
                </p>
              )}
            </div>

            {/* Request Selection (optional refinement) */}
            {requests && requests.length > 0 && (
              <div className="space-y-2">
                <Label>Requisições (opcional)</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {requests.map((request) => (
                    <div key={request.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`request-${request.id}`}
                        checked={filters.requestIds.includes(request.id)}
                        onCheckedChange={() => toggleRequestSelection(request.id)}
                        data-testid={`checkbox-request-${request.id}`}
                      />
                      <label
                        htmlFor={`request-${request.id}`}
                        className="text-sm flex-1 cursor-pointer"
                      >
                        {request.area} - {request.status}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request Status Filter */}
            <div className="space-y-2">
              <Label>Status das Requisições</Label>
              <div className="space-y-2">
                {['draft', 'submitted', 'approved', 'rejected'].map(status => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status}`}
                      checked={filters.requestStatus.includes(status)}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          requestStatus: checked
                            ? [...prev.requestStatus, status]
                            : prev.requestStatus.filter(s => s !== status)
                        }));
                      }}
                    />
                    <label htmlFor={`status-${status}`} className="text-sm capitalize">
                      {status}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => runSimulation.mutate()}
              disabled={filters.eventIds.length === 0 || runSimulation.isPending}
              data-testid="button-run-simulation"
            >
              {runSimulation.isPending ? (
                "Processando..."
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Simular Estoque
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {simulation && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Total Analisado</CardDescription>
                    <CardTitle className="text-3xl">{simulation.summary.totalProducts}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-red-200 dark:border-red-900">
                  <CardHeader className="pb-3">
                    <CardDescription>Em Falta</CardDescription>
                    <CardTitle className="text-3xl text-red-600">{simulation.summary.productsShortage}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-orange-200 dark:border-orange-900">
                  <CardHeader className="pb-3">
                    <CardDescription>Crítico</CardDescription>
                    <CardTitle className="text-3xl text-orange-600">{simulation.summary.productsCritical}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-green-200 dark:border-green-900">
                  <CardHeader className="pb-3">
                    <CardDescription>Adequado</CardDescription>
                    <CardTitle className="text-3xl text-green-600">{simulation.summary.productsAdequate}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Report Details */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Detalhamento por Produto</CardTitle>
                      <CardDescription>
                        Gerado em {new Date(simulation.generatedAt).toLocaleString("pt-BR")}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportToExcel}
                        data-testid="button-export-excel"
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Exportar Excel
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search and filters */}
                  <div className="flex gap-4">
                    <Input
                      placeholder="Buscar produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                      data-testid="input-search-product"
                    />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="showOnlyShortage"
                        checked={showOnlyShortage}
                        onCheckedChange={(checked) => setShowOnlyShortage(checked as boolean)}
                      />
                      <label htmlFor="showOnlyShortage" className="text-sm">
                        Mostrar apenas produtos em FALTA
                      </label>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Necessidade</TableHead>
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
                                    product.status === 'FALTA' ? 'bg-red-50 dark:bg-red-950/20' : ''
                                  }`}
                                  data-testid={`row-product-${product.productId}`}
                                >
                                  <TableCell>
                                    {expandedProducts.has(product.productId) ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">{product.productName}</div>
                                    <div className="text-sm text-muted-foreground">{product.productSku}</div>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {product.totalNeed} {product.unit}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {product.currentStock} {product.unit}
                                  </TableCell>
                                  <TableCell className={`text-right font-semibold ${
                                    product.balance < 0 ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {product.balance} {product.unit}
                                  </TableCell>
                                  <TableCell>
                                    {getStatusBadge(product.status)}
                                  </TableCell>
                                </TableRow>
                              </CollapsibleTrigger>
                              <CollapsibleContent asChild>
                                <TableRow>
                                  <TableCell colSpan={6} className="bg-muted/30">
                                    <div className="p-4 space-y-2">
                                      <div className="text-sm font-medium mb-2">Detalhamento por Evento:</div>
                                      {product.eventBreakdown.map((event, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm pl-4">
                                          <span className="text-muted-foreground">📅</span>
                                          <span className="flex-1">{event.eventName}</span>
                                          <span className="text-muted-foreground">
                                            {new Date(event.eventDate).toLocaleDateString("pt-BR")}
                                          </span>
                                          <span className="font-semibold">
                                            {event.quantity} {product.unit}
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
                </CardContent>
              </Card>
            </>
          )}

          {!simulation && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Selecione os eventos e clique em "Simular Estoque"</p>
                <p className="text-sm mt-2">Os resultados aparecerão aqui</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
