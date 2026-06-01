import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, MapPin, Users, Activity, Search, Calendar, Filter, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type GroupBy = 'product' | 'location' | 'owner' | 'status' | 'category';

interface InventoryFilters {
  search: string;
  periodPreset: 'week' | 'month' | 'quarter' | 'year' | '';
  location: string;
  category: string;
  ownerType: string;
  status: string;
  groupBy: GroupBy;
}

export default function InventoryViews() {
  const [activeTab, setActiveTab] = useState<'physical' | 'ownership' | 'status'>('physical');
  const [showFilters, setShowFilters] = useState(true);
  
  const [filters, setFilters] = useState<InventoryFilters>({
    search: '',
    periodPreset: 'month',
    location: '',
    category: '',
    ownerType: '',
    status: '',
    groupBy: 'product'
  });

  // Auto-update groupBy based on active tab
  const effectiveFilters = {
    ...filters,
    groupBy: activeTab === 'physical' ? 'location' as GroupBy :
             activeTab === 'ownership' ? 'owner' as GroupBy :
             'status' as GroupBy
  };

  const { data: overview, isLoading } = useQuery({
    queryKey: ['/api/inventory/overview', effectiveFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveFilters.search) params.append('search', effectiveFilters.search);
      if (effectiveFilters.periodPreset) params.append('periodPreset', effectiveFilters.periodPreset);
      if (effectiveFilters.location) params.append('location', effectiveFilters.location);
      if (effectiveFilters.category) params.append('category', effectiveFilters.category);
      if (effectiveFilters.ownerType) params.append('ownerType', effectiveFilters.ownerType);
      if (effectiveFilters.status) params.append('status', effectiveFilters.status);
      params.append('groupBy', effectiveFilters.groupBy);
      
      const response = await fetch(`/api/inventory/overview?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch inventory overview');
      }
      return response.json();
    },
    enabled: true
  });

  const handleFilterChange = (key: keyof InventoryFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      periodPreset: 'month',
      location: '',
      category: '',
      ownerType: '',
      status: '',
      groupBy: filters.groupBy
    });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Visões de Estoque"
        description="Análise de estoque por localização, proprietário e status"
      />

      <div className="flex-1 overflow-auto">
        <div className="space-y-6">
          {/* Filter Bar */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  <CardTitle className="text-lg">Filtros Avançados</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    data-testid="button-reset-filters"
                  >
                    Limpar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    data-testid="button-toggle-filters"
                  >
                    {showFilters ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {showFilters && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Search className="h-3 w-3" />
                      Busca
                    </label>
                    <Input
                      placeholder="SKU, nome, código de barras..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      data-testid="input-search"
                    />
                  </div>

                  {/* Period */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Período
                    </label>
                    <Select value={filters.periodPreset} onValueChange={(v) => handleFilterChange('periodPreset', v)}>
                      <SelectTrigger data-testid="select-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Última semana</SelectItem>
                        <SelectItem value="month">Último mês</SelectItem>
                        <SelectItem value="quarter">Último trimestre</SelectItem>
                        <SelectItem value="year">Último ano</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Categoria</label>
                    <Input
                      placeholder="Estrutura, Iluminação..."
                      value={filters.category}
                      onChange={(e) => handleFilterChange('category', e.target.value)}
                      data-testid="input-category"
                    />
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Localização
                    </label>
                    <Input
                      placeholder="Galpão A, Em trânsito..."
                      value={filters.location}
                      onChange={(e) => handleFilterChange('location', e.target.value)}
                      data-testid="input-location"
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Tabbed Views */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="physical" data-testid="tab-physical">
                <MapPin className="h-4 w-4 mr-2" />
                Estoque Físico
              </TabsTrigger>
              <TabsTrigger value="ownership" data-testid="tab-ownership">
                <Users className="h-4 w-4 mr-2" />
                Por Proprietário
              </TabsTrigger>
              <TabsTrigger value="status" data-testid="tab-status">
                <Activity className="h-4 w-4 mr-2" />
                Por Status
              </TabsTrigger>
            </TabsList>

            <TabsContent value="physical" className="space-y-4 mt-6">
              <InventoryView
                data={(overview as any[]) || []}
                isLoading={isLoading}
                dimension="physical"
              />
            </TabsContent>

            <TabsContent value="ownership" className="space-y-4 mt-6">
              <InventoryView
                data={(overview as any[]) || []}
                isLoading={isLoading}
                dimension="ownership"
              />
            </TabsContent>

            <TabsContent value="status" className="space-y-4 mt-6">
              <InventoryView
                data={(overview as any[]) || []}
                isLoading={isLoading}
                dimension="status"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

interface InventoryViewProps {
  data: any[];
  isLoading: boolean;
  dimension: 'physical' | 'ownership' | 'status';
}

function InventoryView({ data, isLoading, dimension }: InventoryViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border/60">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhuma movimentação encontrada para os filtros selecionados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((group) => (
        <InventoryGroupCard key={group.groupKey} group={group} dimension={dimension} />
      ))}
    </div>
  );
}

interface InventoryGroupCardProps {
  group: any;
  dimension: string;
}

function InventoryGroupCard({ group, dimension }: InventoryGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card className="border-border/60">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="p-0 h-auto font-semibold text-xl hover-elevate" data-testid={`group-${group.groupKey}`}>
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    {group.groupLabel}
                  </div>
                </Button>
              </CollapsibleTrigger>
              <p className="text-sm text-muted-foreground mt-1 ml-7">
                {group.products.length} produto{group.products.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-chart-4" />
                  <span>Entradas: <strong className="text-foreground">{group.totalInbound}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <span>Saídas: <strong className="text-foreground">{group.totalOutbound}</strong></span>
                </div>
              </div>
              <div className="text-right pl-4 border-l">
                <div className="text-2xl font-bold">{group.totalBalance}</div>
                <div className="text-sm text-muted-foreground">Saldo</div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {group.products.map((product: any) => (
                <ProductRow key={product.productId} product={product} />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface ProductRowProps {
  product: any;
}

function ProductRow({ product }: ProductRowProps) {
  const [showMovements, setShowMovements] = useState(false);

  return (
    <div className="border rounded-lg p-4 hover-elevate">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium">{product.name}</h4>
              {product.category && (
                <Badge variant="outline">{product.category}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center min-w-[80px]">
            <div className="text-sm text-muted-foreground">Entradas</div>
            <div className="text-lg font-semibold text-chart-4">{product.inbound}</div>
          </div>
          <div className="text-center min-w-[80px]">
            <div className="text-sm text-muted-foreground">Saídas</div>
            <div className="text-lg font-semibold text-destructive">{product.outbound}</div>
          </div>
          <div className="text-center min-w-[80px]">
            <div className="text-sm text-muted-foreground">Saldo</div>
            <div className="text-2xl font-bold">{product.balance}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMovements(!showMovements)}
            data-testid={`button-show-movements-${product.productId}`}
          >
            {showMovements ? 'Ocultar' : 'Ver'} Movimentações
          </Button>
        </div>
      </div>

      {showMovements && product.movements && product.movements.length > 0 && (
        <div className="mt-4 pt-4 border-t space-y-2">
          <h5 className="text-sm font-medium mb-2">Histórico de Movimentações</h5>
          {product.movements.slice(0, 10).map((movement: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Badge variant={movement.direction === 'in' ? 'default' : 'destructive'}>
                  {movement.direction === 'in' ? 'Entrada' : 'Saída'}
                </Badge>
                <span className="text-muted-foreground">
                  {movement.date ? format(new Date(movement.date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {movement.location && (
                  <span className="text-muted-foreground">{movement.location}</span>
                )}
                <span className="font-medium">{movement.quantity} un</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
