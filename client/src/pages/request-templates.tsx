import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, LayoutTemplate, Pencil, Trash2, Copy, ChevronDown, ChevronUp,
  Package, CheckCircle, XCircle, Search, X, Loader2, ChevronsUpDown,
  AlertCircle, Layers, ListChecks,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin } from "@/lib/authz";
import type { Product, RequestAreaTemplate } from "@shared/schema";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";

// ── types ─────────────────────────────────────────────────────────────────────

type TemplateWithCount = RequestAreaTemplate & { itemCount: number };

type TemplateItem = {
  id: string;
  templateId: string;
  productId: string;
  itemNotes: string | null;
  sortOrder: number;
  productName: string | null;
  productSku: string | null;
  productUnit: string | null;
};

type TemplateDetail = RequestAreaTemplate & { items: TemplateItem[] };

type LocalItem = {
  tempId: string;
  productId: string;
  productName: string;
  productSku: string;
  productUnit: string;
  itemNotes: string;
};

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── StatsCard ─────────────────────────────────────────────────────────────────

function StatsCard({
  icon: Icon,
  label,
  value,
  iconClass,
  bgClass,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  iconClass?: string;
  bgClass?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-md bg-primary/10", bgClass)}>
            <Icon className={cn("h-4 w-4 text-primary", iconClass)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── TemplateCard ──────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isExpanded,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  canAdmin,
}: {
  template: TemplateWithCount;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canAdmin: boolean;
}) {
  const { data: detail, isLoading: detailLoading } = useQuery<TemplateDetail>({
    queryKey: ["/api/request-templates", template.id],
    enabled: isExpanded,
  });

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardContent className="p-0">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex-1 flex items-center gap-3 text-left min-w-0"
            data-testid={`button-expand-template-${template.id}`}
          >
            <div className={cn(
              "p-2 rounded-md shrink-0",
              template.isActive ? "bg-primary/10" : "bg-muted"
            )}>
              <LayoutTemplate className={cn(
                "h-4 w-4",
                template.isActive ? "text-primary" : "text-muted-foreground"
              )} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-base">{template.name}</span>
                <Badge variant="secondary" className="text-xs shrink-0">{template.area}</Badge>
                {template.isActive ? (
                  <Badge className="text-xs shrink-0 bg-chart-4/15 text-chart-4 border-chart-4/30">
                    <CheckCircle className="h-3 w-3 mr-1" />Ativo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">
                    <XCircle className="h-3 w-3 mr-1" />Inativo
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {template.itemCount} {template.itemCount === 1 ? "item" : "itens"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {fmtDate(template.updatedAt ?? template.createdAt)}
                </span>
                {template.description && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {template.description}
                  </span>
                )}
              </div>
            </div>

            {isExpanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
          </button>

          {canAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={onEdit}
                title="Editar"
                data-testid={`button-edit-template-${template.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onDuplicate}
                title="Duplicar"
                data-testid={`button-duplicate-template-${template.id}`}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onDelete}
                className="text-destructive"
                title="Excluir"
                data-testid={`button-delete-template-${template.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Expanded items */}
        {isExpanded && (
          <div className="border-t border-border/40 bg-muted/10">
            {detailLoading ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando itens...
              </div>
            ) : !detail?.items?.length ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Nenhum item cadastrado neste template.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Produto</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2 w-36">SKU</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2 w-24">Unidade</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {detail.items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium">{item.productName ?? "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{item.productSku ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{item.productUnit ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{item.itemNotes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── ProductCombobox (inside Sheet) ────────────────────────────────────────────

function ProductCombobox({
  onSelect,
  excluded,
}: {
  onSelect: (p: Product) => void;
  excluded: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.toLowerCase();
    return products
      .filter((p) => !excluded.includes(p.id))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [products, search, excluded]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between h-9 font-normal"
          data-testid="combobox-add-product"
        >
          <span className="text-muted-foreground text-sm">Buscar produto para adicionar...</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Nome ou SKU..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-56">
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 px-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando produtos...
              </div>
            ) : filtered.length === 0 ? (
              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onSelect(p);
                      setSearch("");
                      setOpen(false);
                    }}
                    data-testid={`product-option-${p.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="truncate font-medium text-sm">{p.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 font-mono">{p.sku}</span>
                      {p.unit && (
                        <Badge variant="secondary" className="text-xs shrink-0">{p.unit}</Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── TemplateSheet ─────────────────────────────────────────────────────────────

function TemplateSheet({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template?: TemplateWithCount | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [internalNotes, setInternalNotes] = useState("");
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: detail } = useQuery<TemplateDetail>({
    queryKey: ["/api/request-templates", template?.id],
    enabled: open && !!template?.id,
  });

  // Reset / populate form on open
  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setArea(template.area);
      setDescription(template.description ?? "");
      setIsActive(template.isActive);
      setInternalNotes(template.internalNotes ?? "");
    } else {
      setName("");
      setArea("");
      setDescription("");
      setIsActive(true);
      setInternalNotes("");
      setLocalItems([]);
    }
  }, [open, template?.id]);

  // Populate items from fetched detail (edit mode)
  useEffect(() => {
    if (template && detail?.items) {
      setLocalItems(
        detail.items.map((i) => ({
          tempId: i.id,
          productId: i.productId,
          productName: i.productName ?? "",
          productSku: i.productSku ?? "",
          productUnit: i.productUnit ?? "",
          itemNotes: i.itemNotes ?? "",
        }))
      );
    }
  }, [detail]);

  const excludedIds = localItems.map((i) => i.productId);

  const handleAddProduct = (p: Product) => {
    if (excludedIds.includes(p.id)) {
      toast({ description: "Produto já está neste template.", variant: "destructive" });
      return;
    }
    setLocalItems((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}-${p.id}`,
        productId: p.id,
        productName: p.name,
        productSku: p.sku ?? "",
        productUnit: p.unit ?? "",
        itemNotes: "",
      },
    ]);
  };

  const handleRemoveItem = (tempId: string) => {
    setLocalItems((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const handleNoteChange = (tempId: string, notes: string) => {
    setLocalItems((prev) =>
      prev.map((i) => (i.tempId === tempId ? { ...i, itemNotes: notes } : i))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ description: "Nome do template é obrigatório.", variant: "destructive" });
      return;
    }
    if (!area.trim()) {
      toast({ description: "Área/departamento é obrigatória.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      let templateId: string;

      if (template) {
        await apiRequest("PATCH", `/api/request-templates/${template.id}`, {
          name: name.trim(),
          area: area.trim(),
          description: description.trim() || null,
          isActive,
          internalNotes: internalNotes.trim() || null,
        });
        templateId = template.id;
      } else {
        const res = await apiRequest("POST", "/api/request-templates", {
          name: name.trim(),
          area: area.trim(),
          description: description.trim() || null,
          isActive,
          internalNotes: internalNotes.trim() || null,
          createdBy: user?.id,
        });
        const created = await res.json();
        templateId = created.id;
      }

      await apiRequest("PUT", `/api/request-templates/${templateId}/items`, {
        items: localItems.map((i, idx) => ({
          productId: i.productId,
          itemNotes: i.itemNotes.trim() || null,
          sortOrder: idx,
        })),
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/request-templates"] });
      toast({
        description: template
          ? "Template atualizado com sucesso."
          : "Template criado com sucesso.",
      });
      onOpenChange(false);
    } catch {
      toast({ description: "Erro ao salvar template.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const isEditing = !!template;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 overflow-hidden"
        style={{ width: "min(600px, 95vw)", maxWidth: "min(600px, 95vw)" }}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle>
            {isEditing ? "Editar Template" : "Novo Template de Requisição"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Edite os dados e os produtos deste template."
              : "Defina o nome, área e os produtos padrão deste template."}
          </SheetDescription>
        </SheetHeader>

        <div
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
          style={{ scrollbarWidth: "thin" }}
        >
          {/* Metadata */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Informações do template
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-name">
                  Nome do template <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="s-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Percurso, Estrutura, Palco Principal"
                  data-testid="input-template-name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s-area">
                  Área / Departamento <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="s-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Ex: Percurso, Cenografia"
                  data-testid="input-template-area"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="flex items-center gap-3 h-10 px-3 rounded-md border border-input">
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    data-testid="switch-template-active"
                  />
                  <span className="text-sm">{isActive ? "Ativo" : "Inativo"}</span>
                </div>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-desc">Descrição</Label>
                <Input
                  id="s-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descrição (opcional)"
                  data-testid="input-template-description"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-notes">Observação interna</Label>
                <Textarea
                  id="s-notes"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Notas visíveis apenas para administradores (opcional)"
                  rows={2}
                  data-testid="input-template-internal-notes"
                />
              </div>
            </div>
          </div>

          {/* Items section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Itens do template</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Produtos carregados na requisição com quantidade zerada.
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {localItems.length} {localItems.length === 1 ? "item" : "itens"}
              </Badge>
            </div>

            <ProductCombobox onSelect={handleAddProduct} excluded={excludedIds} />

            {localItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 rounded-md border border-dashed border-border/60 text-muted-foreground">
                <Package className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhum item adicionado.</p>
                <p className="text-xs">Use a busca acima para adicionar produtos.</p>
              </div>
            ) : (
              <div className="rounded-md border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Produto</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-20">Unid.</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Observação</th>
                      <th className="w-8 px-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {localItems.map((item) => (
                      <tr key={item.tempId}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-sm leading-tight">{item.productName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.productSku}</p>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {item.productUnit || "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={item.itemNotes}
                            onChange={(e) => handleNoteChange(item.tempId, e.target.value)}
                            placeholder="Observação..."
                            className="h-7 text-xs bg-transparent border-transparent focus:border-input px-1"
                            data-testid={`input-item-notes-${item.productId}`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveItem(item.tempId)}
                            data-testid={`button-remove-item-${item.productId}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!isActive && (
              <p className="text-xs text-amber-500 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Template inativo não aparecerá na criação de requisições.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 shrink-0 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            data-testid="button-sheet-cancel"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || !area.trim()}
            data-testid="button-sheet-save"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : isEditing ? (
              "Salvar alterações"
            ) : (
              "Criar template"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RequestTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canAdmin = userIsAdmin(user);

  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithCount | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<TemplateWithCount | null>(null);

  const { data: templates, isLoading } = useQuery<TemplateWithCount[]>({
    queryKey: ["/api/request-templates"],
  });

  const areaOptions = useMemo(() => {
    if (!templates) return [];
    return Array.from(new Set(templates.map((t) => t.area))).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    if (!templates) return [];
    return templates.filter((t) => {
      if (statusFilter === "active" && !t.isActive) return false;
      if (statusFilter === "inactive" && t.isActive) return false;
      if (areaFilter !== "all" && t.area !== areaFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) || t.area.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [templates, search, areaFilter, statusFilter]);

  const stats = useMemo(() => {
    if (!templates) return { total: 0, active: 0, totalItems: 0, areas: 0 };
    return {
      total: templates.length,
      active: templates.filter((t) => t.isActive).length,
      totalItems: templates.reduce((s, t) => s + (t.itemCount ?? 0), 0),
      areas: Array.from(new Set(templates.map((t) => t.area))).length,
    };
  }, [templates]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/request-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/request-templates"] });
      toast({ description: "Template excluído." });
      setDeletingTemplate(null);
    },
    onError: () =>
      toast({ description: "Erro ao excluir template.", variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/request-templates/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/request-templates"] });
      toast({ description: "Template duplicado com sucesso." });
    },
    onError: () =>
      toast({ description: "Erro ao duplicar template.", variant: "destructive" }),
  });

  const hasFilters = search || areaFilter !== "all" || statusFilter !== "all";

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates de Requisição"
        description="Crie modelos padrão de materiais por área para agilizar novas requisições."
      >
        {canAdmin && (
          <Button
            onClick={() => {
              setEditingTemplate(null);
              setSheetOpen(true);
            }}
            data-testid="button-new-template"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        )}
      </PageHeader>

      {/* Stats */}
      {templates && templates.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard icon={LayoutTemplate} label="Total" value={stats.total} />
          <StatsCard
            icon={CheckCircle}
            label="Ativos"
            value={stats.active}
            iconClass="text-chart-4"
            bgClass="bg-chart-4/10"
          />
          <StatsCard icon={Package} label="Total de itens" value={stats.totalItems} />
          <StatsCard icon={Layers} label="Áreas" value={stats.areas} />
        </div>
      )}

      {/* Filters */}
      {templates && templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou área..."
              className="pl-9 h-9"
              data-testid="input-search-templates"
            />
          </div>

          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-40 h-9" data-testid="select-area-filter">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {areaOptions.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setAreaFilter("all");
                setStatusFilter("all");
              }}
              className="h-9"
              data-testid="button-clear-filters"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      {!templates || templates.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nenhum template cadastrado"
          description="Toda requisição começa mais rápido com um modelo. Crie o primeiro template agora."
          action={
            canAdmin
              ? {
                  label: "Criar primeiro template",
                  onClick: () => {
                    setEditingTemplate(null);
                    setSheetOpen(true);
                  },
                }
              : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Search className="h-8 w-8 opacity-30" />
          <p className="text-sm font-medium">Nenhum template encontrado</p>
          <p className="text-xs">Tente ajustar os filtros.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setAreaFilter("all");
              setStatusFilter("all");
            }}
            className="mt-2"
          >
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isExpanded={expandedId === t.id}
              onToggle={() => setExpandedId((prev) => (prev === t.id ? null : t.id))}
              onEdit={() => {
                setEditingTemplate(t);
                setSheetOpen(true);
              }}
              onDuplicate={() => duplicateMutation.mutate(t.id)}
              onDelete={() => setDeletingTemplate(t)}
              canAdmin={canAdmin}
            />
          ))}
        </div>
      )}

      {/* Sheet */}
      <TemplateSheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (!v) setEditingTemplate(null);
        }}
        template={editingTemplate}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deletingTemplate}
        onOpenChange={(v) => !v && setDeletingTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template <strong>{deletingTemplate?.name}</strong> e todos os seus itens
              serão excluídos permanentemente. Requisições já criadas com este template
              não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deletingTemplate && deleteMutation.mutate(deletingTemplate.id)
              }
              data-testid="button-confirm-delete-template"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
