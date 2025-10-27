import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Download, AlertTriangle, Info, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  status: 'DISPONÍVEL' | 'PARCIAL' | 'TOTALMENTE_ALOCADO';
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

export default function StockPositionSimulation() {
  const [filters, setFilters] = useState<StockPositionFilters>({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    eventIds: [],
    orderStatus: []
  });

  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['approved', 'in_progress', 'ready']);

  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const { data: events } = useQuery({
    queryKey: ['/api/events'],
  });

  const handleGenerateSimulation = async () => {
    try {
      setIsGenerating(true);
      const payload = {
        startDate: filters.startDate,
        endDate: filters.endDate,
        eventIds: selectedEventIds,
        orderStatus: selectedStatuses
      };
      const response = await apiRequest("POST", "/api/reports/stock-position-simulation", payload);
      const result = await response.json() as SimulationResult;
      setSimulationResult(result);
    } catch (error) {
      console.error("Error generating simulation:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DISPONÍVEL':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Disponível</Badge>;
      case 'PARCIAL':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Parcial</Badge>;
      case 'TOTALMENTE_ALOCADO':
        return <Badge variant="default" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Totalmente Alocado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-title">Simulação de Posição de Estoque por Período</h1>
          <p className="text-muted-foreground">
            Visualize o saldo projetado considerando alocações temporais
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Filtros da Simulação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Data Início</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Fim</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                data-testid="input-end-date"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Eventos ({selectedEventIds.length} selecionados)</Label>
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                {events && Array.isArray(events) && events.length > 0 ? (
                  events.map((event: any) => (
                    <div key={event.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`event-${event.id}`}
                        checked={selectedEventIds.includes(event.id)}
                        onCheckedChange={() => toggleEvent(event.id)}
                        data-testid={`checkbox-event-${event.id}`}
                      />
                      <Label
                        htmlFor={`event-${event.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {event.name}
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum evento disponível</p>
                )}
              </div>
            </div>

            <div>
              <Label>Status das Ordens ({selectedStatuses.length} selecionados)</Label>
              <div className="mt-2 border rounded-md p-3 space-y-2">
                {[
                  { value: 'draft', label: 'Rascunho' },
                  { value: 'ready', label: 'Pronta' },
                  { value: 'approved', label: 'Aprovada' },
                  { value: 'in_progress', label: 'Em Andamento' },
                  { value: 'completed', label: 'Concluída' },
                  { value: 'cancelled', label: 'Cancelada' }
                ].map(({ value, label }) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${value}`}
                      checked={selectedStatuses.includes(value)}
                      onCheckedChange={() => toggleStatus(value)}
                      data-testid={`checkbox-status-${value}`}
                    />
                    <Label
                      htmlFor={`status-${value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerateSimulation}
              disabled={isGenerating}
              data-testid="button-generate"
            >
              {isGenerating ? "Gerando..." : "Gerar Simulação"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedEventIds([]);
                setSelectedStatuses([]);
                setFilters({
                  startDate: format(new Date(), 'yyyy-MM-dd'),
                  endDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                  eventIds: [],
                  orderStatus: []
                });
                setSimulationResult(null);
              }}
              data-testid="button-clear"
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Errors and Warnings */}
      {simulationResult && (simulationResult.errors.length > 0 || simulationResult.warnings.length > 0) && (
        <div className="space-y-3">
          {simulationResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Erros Encontrados:</div>
                <ul className="list-disc list-inside space-y-1">
                  {simulationResult.errors.map((error, idx) => (
                    <li key={idx} className="text-sm">
                      {error.orderNumber}: {error.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {simulationResult.warnings.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Avisos:</div>
                <ul className="list-disc list-inside space-y-1">
                  {simulationResult.warnings.map((warning, idx) => (
                    <li key={idx} className="text-sm">
                      {warning.orderNumber}: {warning.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Summary */}
      {simulationResult && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {simulationResult.summary.totalProducts}
                </div>
                <div className="text-sm text-muted-foreground">Total de Produtos</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {simulationResult.summary.availableProducts}
                </div>
                <div className="text-sm text-muted-foreground">Disponíveis</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {simulationResult.summary.partialProducts}
                </div>
                <div className="text-sm text-muted-foreground">Parcialmente Alocados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {simulationResult.summary.fullyAllocatedProducts}
                </div>
                <div className="text-sm text-muted-foreground">Totalmente Alocados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      {simulationResult && simulationResult.products.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Produto</th>
                    <th className="text-left p-4 font-medium">Estoque Atual</th>
                    <th className="text-left p-4 font-medium">Qtd Alocada</th>
                    <th className="text-left p-4 font-medium">Saldo Disponível</th>
                    <th className="text-left p-4 font-medium">% Utilização</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Período de Alocação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {simulationResult.products.map((product) => (
                    <>
                      <tr
                        key={product.productId}
                        className={`hover-elevate ${product.utilization >= 100 ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                        data-testid={`row-product-${product.productId}`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleProductExpansion(product.productId)}
                              className="text-muted-foreground hover:text-foreground"
                              data-testid={`button-expand-${product.productId}`}
                            >
                              {expandedProducts.has(product.productId) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <div>
                              <div className="font-medium">{product.productName}</div>
                              <div className="text-sm text-muted-foreground">{product.productSku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">{product.currentStock}</td>
                        <td className="p-4">{product.allocatedQuantity}</td>
                        <td className="p-4">
                          <span className={product.availableStock < 0 ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                            {product.availableStock}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  product.utilization >= 100
                                    ? 'bg-red-500'
                                    : product.utilization >= 80
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(product.utilization, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm">{product.utilization.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="p-4">{getStatusBadge(product.status)}</td>
                        <td className="p-4">
                          {product.allocationPeriod ? (
                            <div>
                              <div className="text-sm">
                                {format(new Date(product.allocationPeriod.start), 'dd/MM/yyyy')} até{' '}
                                {format(new Date(product.allocationPeriod.end), 'dd/MM/yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ({product.allocationPeriod.days} dias)
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Sem alocação</span>
                          )}
                        </td>
                      </tr>
                      
                      {/* Expanded Details */}
                      {expandedProducts.has(product.productId) && (
                        <tr className="bg-muted/30">
                          <td colSpan={7} className="p-4">
                            <div className="space-y-4">
                              {/* Timeline Visual */}
                              {product.allocationPeriod && (
                                <div>
                                  <h4 className="font-medium mb-3">Timeline de Alocação - {product.productName}</h4>
                                  <div className="relative bg-muted/50 rounded-lg p-4">
                                    {/* Timeline bar */}
                                    <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                                      {product.ordersDetails.map((order, idx) => {
                                        const filterStart = new Date(simulationResult.filters.startDate);
                                        const filterEnd = new Date(simulationResult.filters.endDate);
                                        const totalDays = Math.ceil((filterEnd.getTime() - filterStart.getTime()) / (1000 * 60 * 60 * 24));
                                        
                                        const orderStart = new Date(order.periodStart);
                                        const orderEnd = new Date(order.periodEnd);
                                        
                                        // Calculate position and width as percentage
                                        const daysFromStart = Math.ceil((orderStart.getTime() - filterStart.getTime()) / (1000 * 60 * 60 * 24));
                                        const orderDuration = Math.ceil((orderEnd.getTime() - orderStart.getTime()) / (1000 * 60 * 60 * 24));
                                        
                                        const leftPercent = Math.max(0, (daysFromStart / totalDays) * 100);
                                        const widthPercent = Math.min((orderDuration / totalDays) * 100, 100 - leftPercent);
                                        
                                        const colors = [
                                          'bg-blue-500',
                                          'bg-purple-500',
                                          'bg-pink-500',
                                          'bg-indigo-500',
                                          'bg-cyan-500',
                                        ];
                                        const color = colors[idx % colors.length];
                                        
                                        return (
                                          <div
                                            key={idx}
                                            className={`absolute h-8 ${color} opacity-75 flex items-center justify-center group`}
                                            style={{
                                              left: `${leftPercent}%`,
                                              width: `${widthPercent}%`,
                                            }}
                                            title={`${order.orderNumber} - ${format(orderStart, 'dd/MM/yyyy')} até ${format(orderEnd, 'dd/MM/yyyy')}`}
                                          >
                                            <span className="text-xs text-white font-medium px-1 truncate">
                                              {order.orderNumber}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    {/* Date markers */}
                                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                      <span>{format(new Date(simulationResult.filters.startDate), 'dd/MM/yyyy')}</span>
                                      <span>{format(new Date(simulationResult.filters.endDate), 'dd/MM/yyyy')}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Orders Details */}
                              <div>
                                <h4 className="font-medium mb-3">Ordens que Utilizam este Produto:</h4>
                                <div className="space-y-2">
                                  {product.ordersDetails.map((order, idx) => (
                                    <Card key={idx}>
                                      <CardContent className="p-3">
                                        <div className="flex justify-between items-start">
                                          <div className="space-y-1">
                                            <div className="font-medium">
                                              {order.orderNumber} - {order.eventName}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              Quantidade: {order.quantity}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              {order.periodDetail}:{' '}
                                              {format(new Date(order.periodStart), 'dd/MM/yyyy')} até{' '}
                                              {format(new Date(order.periodEnd), 'dd/MM/yyyy')} ({order.daysUnavailable} dias)
                                            </div>
                                            {order.hasMultipleTrips && (
                                              <div className="text-xs text-yellow-600 dark:text-yellow-400">
                                                ⚠️ Período consolidado de múltiplas viagens
                                              </div>
                                            )}
                                          </div>
                                          <Badge variant="outline">{order.status}</Badge>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {simulationResult && simulationResult.products.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhum produto encontrado para os filtros selecionados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
