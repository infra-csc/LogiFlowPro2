import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Package,
  ChevronDown,
  ChevronUp,
  Check,
  ChevronsUpDown,
  LayoutTemplate,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/page-loading";
import type { RequestAreaTemplate, Product } from "@shared/schema";
import { cn } from "@/lib/utils";

type TemplateItem = {
  id: string;
  templateId: string;
  productId: string;
  defaultQuantity: number;
  sortOrder: number;
  productName: string | null;
  productSku: string | null;
  productUnit: string | null;
};

type TemplateWithItems = RequestAreaTemplate & { items: TemplateItem[] };

// ── Template Form Dialog ─────────────────────────────────────────────────────

function TemplateFormDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template?: RequestAreaTemplate;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");

  const mutation = useMutation({
    mutationFn: async () => {
      if (template) {
        return apiRequest("PATCH", `/api/request-templates/${template.id}`, { name, description });
      }
      return apiRequest("POST", "/api/request-templates", { name, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/request-templates"] });
      toast({ description: template ? "Template atualizado" : "Template criado" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao salvar template", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{template ? "Editar Template" : "Novo Template de Área"}</DialogTitle>
          <DialogDescription>
            {template
              ? "Atualize o nome ou descrição do template."
              : "Crie um template para pré-preencher itens ao criar uma requisição."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nome da área *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Percurso, Cenografia, Palco"
              data-testid="input-template-name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              rows={2}
              data-testid="input-template-description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || mutation.isPending} data-testid="button-save-template">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {template ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Item Dialog ──────────────────────────────────────────────────────────

function AddItemDialog({
  open,
  onOpenChange,
  templateId,
  existingProductIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string;
  existingProductIds: string[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [productOpen, setProductOpen] = useState(false);

  const { data: products } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const availableProducts = products?.filter((p) => !existingProductIds.includes(p.id)) || [];
  const selectedProduct = products?.find((p) => p.id === productId);

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/request-templates/${templateId}/items`, {
        productId,
        defaultQuantity: quantity,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/request-templates", templateId] });
      toast({ description: "Item adicionado ao template" });
      setProductId("");
      setQuantity(1);
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao adicionar item", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Item ao Template</DialogTitle>
          <DialogDescription>Escolha um produto e a quantidade padrão para pré-preencher na requisição.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Produto *</Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                  data-testid="combobox-product"
                >
                  {selectedProduct ? `${selectedProduct.sku} — ${selectedProduct.name}` : "Selecione o produto"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar produto..." />
                  <CommandList className="max-h-64">
                    <CommandEmpty>Nenhum produto disponível</CommandEmpty>
                    <CommandGroup>
                      {availableProducts.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.sku} ${p.name}`}
                          onSelect={() => {
                            setProductId(p.id);
                            setProductOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", productId === p.id ? "opacity-100" : "opacity-0")} />
                          <span className="font-medium text-sm">{p.sku}</span>
                          <span className="text-muted-foreground text-sm ml-2 truncate">{p.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Quantidade padrão *</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              data-testid="input-item-quantity"
            />
            {selectedProduct?.unit && (
              <p className="text-xs text-muted-foreground">Unidade: {selectedProduct.unit}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!productId || quantity < 1 || mutation.isPending}
              data-testid="button-add-item"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template }: { template: TemplateWithItems }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false);
  const [editingQty, setEditingQty] = useState<{ [id: string]: number }>({});

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiRequest("DELETE", `/api/request-templates/${template.id}/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/request-templates", template.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/request-templates"] });
      toast({ description: "Item removido" });
      setDeleteId(null);
    },
  });

  const updateQtyMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) =>
      apiRequest("PATCH", `/api/request-templates/${template.id}/items/${itemId}`, {
        defaultQuantity: qty,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/request-templates", template.id] });
      setEditingQty({});
      toast({ description: "Quantidade atualizada" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/request-templates/${template.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/request-templates"] });
      toast({ description: "Template excluído" });
    },
  });

  return (
    <>
      <Card className="border-border/60">
        <CardHeader className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base">{template.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {template.items.length} {template.items.length === 1 ? "item" : "itens"}
                </Badge>
              </div>
              {template.description && (
                <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditOpen(true)}
                data-testid={`button-edit-template-${template.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDeleteTemplateOpen(true)}
                data-testid={`button-delete-template-${template.id}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setExpanded(!expanded)}
                data-testid={`button-toggle-template-${template.id}`}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0 px-4 pb-4 space-y-3">
            <div className="border-t border-border/40 pt-3">
              {template.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">Nenhum item no template. Adicione abaixo.</p>
              ) : (
                <div className="space-y-2">
                  {template.items.map((item) => {
                    const editQty = editingQty[item.id];
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-md bg-muted/30 border border-border/40 flex-wrap"
                        data-testid={`template-item-${item.id}`}
                      >
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{item.productName}</span>
                          <span className="text-xs text-muted-foreground ml-2">{item.productSku}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {editQty !== undefined ? (
                            <>
                              <Input
                                type="number"
                                min={1}
                                value={editQty}
                                onChange={(e) => setEditingQty({ ...editingQty, [item.id]: Number(e.target.value) })}
                                className="w-20 h-8 text-sm"
                              />
                              <Button
                                size="sm"
                                onClick={() => updateQtyMutation.mutate({ itemId: item.id, qty: editQty })}
                                disabled={updateQtyMutation.isPending}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <button
                              className="text-sm font-medium px-2 py-0.5 rounded hover-elevate border border-border/40 bg-background"
                              onClick={() => setEditingQty({ ...editingQty, [item.id]: item.defaultQuantity })}
                              data-testid={`button-edit-qty-${item.id}`}
                            >
                              {item.defaultQuantity}
                              {item.productUnit ? ` ${item.productUnit}` : ""}
                            </button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteId(item.id)}
                            data-testid={`button-remove-item-${item.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setAddItemOpen(true)}
                data-testid={`button-add-item-to-${template.id}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar item
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <TemplateFormDialog open={editOpen} onOpenChange={setEditOpen} template={template} />
      <AddItemDialog
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        templateId={template.id}
        existingProductIds={template.items.map((i) => i.productId)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>O item será removido deste template. Requisições já criadas não são afetadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteItemMutation.mutate(deleteId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTemplateOpen} onOpenChange={setDeleteTemplateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template "{template.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              O template será excluído permanentemente. Requisições já criadas com este template não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function RequestTemplatesPage() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: templates, isLoading } = useQuery<RequestAreaTemplate[]>({
    queryKey: ["/api/request-templates"],
  });

  // Fetch full detail (with items) for each template
  const templateIds = templates?.map((t) => t.id) || [];
  const detailQueries = templateIds.map((id) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery<TemplateWithItems>({ queryKey: ["/api/request-templates", id] })
  );

  const allLoaded = detailQueries.every((q) => !q.isLoading);
  const templatesWithItems: TemplateWithItems[] = detailQueries
    .map((q) => q.data)
    .filter((d): d is TemplateWithItems => !!d);

  if (isLoading) return <PageLoading />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Templates de Requisição"
        description="Defina listas de itens padrão por área. Ao criar uma requisição, selecione um template e os itens serão pré-preenchidos automaticamente."
        actions={
          <Button onClick={() => setCreateOpen(true)} data-testid="button-new-template">
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        }
      />

      {!templates?.length ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Nenhum template cadastrado"
          description="Crie templates com itens padrão por área para agilizar a criação de requisições."
          action={
            <Button onClick={() => setCreateOpen(true)} data-testid="button-empty-new-template">
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro template
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {(allLoaded ? templatesWithItems : templates.map((t) => ({ ...t, items: [] }))).map((t) => (
            <TemplateCard key={t.id} template={t as TemplateWithItems} />
          ))}
        </div>
      )}

      <TemplateFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
