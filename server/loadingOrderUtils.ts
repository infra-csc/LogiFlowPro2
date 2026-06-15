import type { MaterialRequest, Kit, BomLine } from "@shared/schema";
import type { IStorage } from "./storage";

export interface ConsolidatedItem {
  productId: string;
  consolidatedQuantity: number;
  sourceRequests: Array<{
    requestId: string;
    area: string;
    quantity: number;
    fromKit?: {
      kitId: string;
      kitName: string;
      itemId: string;
    };
  }>;
}

export async function consolidateLoadingOrderItems(
  requestIds: string[],
  storage: IStorage
): Promise<ConsolidatedItem[]> {
  const consolidationMap = new Map<string, ConsolidatedItem>();

  for (const requestId of requestIds) {
    const request = await storage.getMaterialRequest(requestId);
    if (!request) continue;

    const items = await storage.getRequestItems(requestId);

    for (const item of items) {
      if (item.kitId) {
        await expandKit(
          item.kitId,
          item.quantity,
          request,
          (item.kitParameters as Record<string, number>) || {},
          consolidationMap,
          storage
        );
      } else if (item.productId) {
        addProductToConsolidation(
          item.productId,
          item.quantity,
          request,
          consolidationMap
        );
      }
    }
  }

  return Array.from(consolidationMap.values());
}

async function expandKit(
  kitId: string,
  kitQuantity: number,
  request: MaterialRequest,
  parameters: Record<string, number>,
  consolidationMap: Map<string, ConsolidatedItem>,
  storage: IStorage
): Promise<void> {
  const kit = await storage.getKit(kitId);
  if (!kit) return;

  const bomLines = await storage.getBomLinesByKit(kitId);

  for (const line of bomLines) {
    const effectiveQuantity = calculateEffectiveQuantity(
      line.quantityFormula,
      kitQuantity,
      parameters,
      line.productId
    );

    if (effectiveQuantity > 0) {
      addProductToConsolidation(
        line.productId,
        effectiveQuantity,
        request,
        consolidationMap,
        {
          kitId: kit.id,
          kitName: kit.name,
          itemId: line.id
        }
      );
    }
  }
}

function calculateEffectiveQuantity(
  quantityFormula: string,
  kitQuantity: number,
  parameters: Record<string, number>,
  productId?: string
): number {
  if (quantityFormula.trim() === '?') {
    const qty = parameters[productId ?? ''] ?? 0;
    return Math.round(qty * kitQuantity);
  }
  try {
    let formula = quantityFormula.trim();
    
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const regex = new RegExp(`\\b${paramName}\\b`, 'g');
      formula = formula.replace(regex, String(paramValue));
    }

    const result = evaluateExpression(formula);
    return Math.round(result * kitQuantity);
  } catch (error) {
    console.error(`Error evaluating formula "${quantityFormula}":`, error);
    return 0;
  }
}

function evaluateExpression(expr: string): number {
  const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '');
  
  if (sanitized !== expr) {
    throw new Error('Invalid characters in expression');
  }

  return Function(`"use strict"; return (${sanitized})`)();
}

function addProductToConsolidation(
  productId: string,
  quantity: number,
  request: MaterialRequest,
  consolidationMap: Map<string, ConsolidatedItem>,
  fromKit?: {
    kitId: string;
    kitName: string;
    itemId: string;
  }
): void {
  const existing = consolidationMap.get(productId);

  if (existing) {
    existing.consolidatedQuantity += quantity;
    existing.sourceRequests.push({
      requestId: request.id,
      area: request.area,
      quantity,
      fromKit
    });
  } else {
    consolidationMap.set(productId, {
      productId,
      consolidatedQuantity: quantity,
      sourceRequests: [
        {
          requestId: request.id,
          area: request.area,
          quantity,
          fromKit
        }
      ]
    });
  }
}
