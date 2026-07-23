import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Standard create/update/delete mutations for a REST collection.
 *
 * Every entity page (docks, drivers, suppliers, vehicles, locations, …) hand
 * wrote the same three mutations: POST/PATCH/DELETE against `/api/<thing>`,
 * each invalidating the same query key and firing a success or destructive
 * toast. Only the noun and the endpoint changed. This collapses that ~60-line
 * block into one call while keeping the exact same behavior — including the
 * `onSuccess` hook each page uses to close its dialog and reset its form.
 *
 * The labels are pt-BR because that is what every existing toast uses; pass
 * `labels` to override per entity ("Doca criada", etc.).
 */

export interface CrudLabels {
  /** Singular noun as it appears in toasts, e.g. "Doca". */
  entity: string;
  created?: string;
  updated?: string;
  deleted?: string;
}

export interface CrudCallbacks {
  onCreated?: () => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
}

export interface CrudMutations<TInput> {
  create: UseMutationResult<unknown, Error, TInput>;
  update: UseMutationResult<unknown, Error, { id: string; data: Partial<TInput> }>;
  remove: UseMutationResult<unknown, Error, string>;
}

export function useCrudMutations<TInput>(
  /** Collection endpoint and query key, e.g. "/api/docks". */
  resource: string,
  labels: CrudLabels,
  callbacks: CrudCallbacks = {}
): CrudMutations<TInput> {
  const { toast } = useToast();
  const entity = labels.entity;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [resource] });

  const fail = (verb: string) => (error: Error) =>
    toast({
      title: `Erro ao ${verb} ${entity.toLowerCase()}`,
      description: error.message,
      variant: "destructive",
    });

  const create = useMutation<unknown, Error, TInput>({
    mutationFn: (data) => apiRequest("POST", resource, data),
    onSuccess: () => {
      invalidate();
      toast({ title: labels.created ?? `${entity} criado(a)` });
      callbacks.onCreated?.();
    },
    onError: fail("criar"),
  });

  const update = useMutation<unknown, Error, { id: string; data: Partial<TInput> }>({
    mutationFn: ({ id, data }) => apiRequest("PATCH", `${resource}/${id}`, data),
    onSuccess: () => {
      invalidate();
      toast({ title: labels.updated ?? `${entity} atualizado(a)` });
      callbacks.onUpdated?.();
    },
    onError: fail("atualizar"),
  });

  const remove = useMutation<unknown, Error, string>({
    mutationFn: (id) => apiRequest("DELETE", `${resource}/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: labels.deleted ?? `${entity} excluído(a)` });
      callbacks.onDeleted?.();
    },
    onError: fail("excluir"),
  });

  return { create, update, remove };
}
