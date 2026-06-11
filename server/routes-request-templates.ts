import { Express, Request, Response } from "express";
import { db } from "./db";
import { requireAuth } from "./ownership";
import { requireAdmin } from "./authz";
import { eq, asc, ilike, sql } from "drizzle-orm";
import {
  requestAreaTemplates,
  requestAreaTemplateItems,
  products,
  insertRequestAreaTemplateSchema,
  insertRequestAreaTemplateItemSchema,
} from "@shared/schema";

export function registerRequestTemplateRoutes(app: Express) {
  // List all templates with item count (any authenticated user)
  app.get("/api/request-templates", requireAuth, async (req: Request, res: Response) => {
    try {
      const templates = await db
        .select({
          id: requestAreaTemplates.id,
          name: requestAreaTemplates.name,
          area: requestAreaTemplates.area,
          description: requestAreaTemplates.description,
          isActive: requestAreaTemplates.isActive,
          internalNotes: requestAreaTemplates.internalNotes,
          createdBy: requestAreaTemplates.createdBy,
          createdAt: requestAreaTemplates.createdAt,
          updatedAt: requestAreaTemplates.updatedAt,
          itemCount: sql<number>`(SELECT COUNT(*) FROM request_area_template_items WHERE template_id = ${requestAreaTemplates.id})::int`,
        })
        .from(requestAreaTemplates)
        .orderBy(asc(requestAreaTemplates.name));
      res.json(templates);
    } catch {
      res.status(500).json({ error: "Erro ao buscar templates" });
    }
  });

  // Get template with items (any authenticated user)
  app.get("/api/request-templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const [template] = await db
        .select()
        .from(requestAreaTemplates)
        .where(eq(requestAreaTemplates.id, req.params.id));
      if (!template) return res.status(404).json({ error: "Template não encontrado" });

      const items = await db
        .select({
          id: requestAreaTemplateItems.id,
          templateId: requestAreaTemplateItems.templateId,
          productId: requestAreaTemplateItems.productId,
          itemNotes: requestAreaTemplateItems.itemNotes,
          sortOrder: requestAreaTemplateItems.sortOrder,
          productName: products.name,
          productSku: products.sku,
          productUnit: products.unit,
        })
        .from(requestAreaTemplateItems)
        .leftJoin(products, eq(requestAreaTemplateItems.productId, products.id))
        .where(eq(requestAreaTemplateItems.templateId, req.params.id))
        .orderBy(asc(requestAreaTemplateItems.sortOrder), asc(requestAreaTemplateItems.id));

      res.json({ ...template, items });
    } catch {
      res.status(500).json({ error: "Erro ao buscar template" });
    }
  });

  // Create template (admin only)
  app.post("/api/request-templates", requireAdmin(), async (req: Request, res: Response) => {
    try {
      const data = insertRequestAreaTemplateSchema.parse({
        ...req.body,
        createdBy: req.user!.id,
      });
      const [created] = await db.insert(requestAreaTemplates).values(data).returning();
      res.status(201).json(created);
    } catch (e) {
      res.status(400).json({ error: "Dados inválidos" });
    }
  });

  // Update template (admin only)
  app.patch("/api/request-templates/:id", requireAdmin(), async (req: Request, res: Response) => {
    try {
      const [existing] = await db
        .select()
        .from(requestAreaTemplates)
        .where(eq(requestAreaTemplates.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Template não encontrado" });

      const { name, area, description, isActive, internalNotes } = req.body;
      const [updated] = await db
        .update(requestAreaTemplates)
        .set({
          ...(name !== undefined && { name }),
          ...(area !== undefined && { area }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
          ...(internalNotes !== undefined && { internalNotes }),
          updatedAt: new Date(),
        })
        .where(eq(requestAreaTemplates.id, req.params.id))
        .returning();
      res.json(updated);
    } catch {
      res.status(400).json({ error: "Erro ao atualizar template" });
    }
  });

  // Duplicate template (admin only)
  app.post("/api/request-templates/:id/duplicate", requireAdmin(), async (req: Request, res: Response) => {
    try {
      const [original] = await db
        .select()
        .from(requestAreaTemplates)
        .where(eq(requestAreaTemplates.id, req.params.id));
      if (!original) return res.status(404).json({ error: "Template não encontrado" });

      const [clone] = await db.insert(requestAreaTemplates).values({
        name: `${original.name} (cópia)`,
        area: original.area,
        description: original.description,
        isActive: false,
        internalNotes: original.internalNotes,
        createdBy: req.user!.id,
      }).returning();

      const originalItems = await db
        .select()
        .from(requestAreaTemplateItems)
        .where(eq(requestAreaTemplateItems.templateId, req.params.id));

      if (originalItems.length > 0) {
        await db.insert(requestAreaTemplateItems).values(
          originalItems.map((i) => ({
            templateId: clone.id,
            productId: i.productId,
            itemNotes: i.itemNotes,
            sortOrder: i.sortOrder,
          }))
        );
      }

      res.status(201).json(clone);
    } catch {
      res.status(500).json({ error: "Erro ao duplicar template" });
    }
  });

  // Delete template (admin only)
  app.delete("/api/request-templates/:id", requireAdmin(), async (req: Request, res: Response) => {
    try {
      const [existing] = await db
        .select()
        .from(requestAreaTemplates)
        .where(eq(requestAreaTemplates.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Template não encontrado" });

      await db.delete(requestAreaTemplates).where(eq(requestAreaTemplates.id, req.params.id));
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Erro ao excluir template" });
    }
  });

  // Replace all items of a template (admin only) — used on save from sheet
  app.put("/api/request-templates/:id/items", requireAdmin(), async (req: Request, res: Response) => {
    try {
      const [template] = await db
        .select()
        .from(requestAreaTemplates)
        .where(eq(requestAreaTemplates.id, req.params.id));
      if (!template) return res.status(404).json({ error: "Template não encontrado" });

      // Delete all existing items
      await db.delete(requestAreaTemplateItems).where(eq(requestAreaTemplateItems.templateId, req.params.id));

      // Insert new items
      const newItems: Array<{ productId: string; itemNotes?: string; sortOrder?: number }> = req.body.items ?? [];
      let insertedItems: typeof requestAreaTemplateItems.$inferSelect[] = [];
      if (newItems.length > 0) {
        insertedItems = await db.insert(requestAreaTemplateItems).values(
          newItems.map((item, idx) => ({
            templateId: req.params.id,
            productId: item.productId,
            itemNotes: item.itemNotes ?? null,
            sortOrder: item.sortOrder ?? idx,
          }))
        ).returning();
      }

      // Return items with product info
      if (insertedItems.length === 0) return res.json([]);

      const full = await db
        .select({
          id: requestAreaTemplateItems.id,
          templateId: requestAreaTemplateItems.templateId,
          productId: requestAreaTemplateItems.productId,
          itemNotes: requestAreaTemplateItems.itemNotes,
          sortOrder: requestAreaTemplateItems.sortOrder,
          productName: products.name,
          productSku: products.sku,
          productUnit: products.unit,
        })
        .from(requestAreaTemplateItems)
        .leftJoin(products, eq(requestAreaTemplateItems.productId, products.id))
        .where(eq(requestAreaTemplateItems.templateId, req.params.id))
        .orderBy(asc(requestAreaTemplateItems.sortOrder));

      res.json(full);
    } catch {
      res.status(400).json({ error: "Erro ao salvar itens" });
    }
  });

  // Add single item to template (admin only)
  app.post("/api/request-templates/:id/items", requireAdmin(), async (req: Request, res: Response) => {
    try {
      const [template] = await db
        .select()
        .from(requestAreaTemplates)
        .where(eq(requestAreaTemplates.id, req.params.id));
      if (!template) return res.status(404).json({ error: "Template não encontrado" });

      const data = insertRequestAreaTemplateItemSchema.parse({
        productId: req.body.productId,
        itemNotes: req.body.itemNotes,
        sortOrder: req.body.sortOrder ?? 0,
        templateId: req.params.id,
      });
      const [item] = await db.insert(requestAreaTemplateItems).values(data).returning();

      const [full] = await db
        .select({
          id: requestAreaTemplateItems.id,
          templateId: requestAreaTemplateItems.templateId,
          productId: requestAreaTemplateItems.productId,
          itemNotes: requestAreaTemplateItems.itemNotes,
          sortOrder: requestAreaTemplateItems.sortOrder,
          productName: products.name,
          productSku: products.sku,
          productUnit: products.unit,
        })
        .from(requestAreaTemplateItems)
        .leftJoin(products, eq(requestAreaTemplateItems.productId, products.id))
        .where(eq(requestAreaTemplateItems.id, item.id));

      res.status(201).json(full);
    } catch {
      res.status(400).json({ error: "Dados inválidos" });
    }
  });

  // Update item notes (admin only)
  app.patch("/api/request-templates/:id/items/:itemId", requireAdmin(), async (req: Request, res: Response) => {
    try {
      const { itemNotes } = req.body;
      const [updated] = await db
        .update(requestAreaTemplateItems)
        .set({ itemNotes: itemNotes ?? null })
        .where(eq(requestAreaTemplateItems.id, req.params.itemId))
        .returning();
      if (!updated) return res.status(404).json({ error: "Item não encontrado" });
      res.json(updated);
    } catch {
      res.status(400).json({ error: "Erro ao atualizar item" });
    }
  });

  // Delete item from template (admin only)
  app.delete("/api/request-templates/:id/items/:itemId", requireAdmin(), async (req: Request, res: Response) => {
    try {
      await db
        .delete(requestAreaTemplateItems)
        .where(eq(requestAreaTemplateItems.id, req.params.itemId));
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Erro ao remover item" });
    }
  });
}
