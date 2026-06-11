import { Express } from "express";
import { db } from "./db";
import { requireAuth, isAdmin } from "./ownership";
import { requireAdmin } from "./authz";
import { eq, asc } from "drizzle-orm";
import {
  requestAreaTemplates,
  requestAreaTemplateItems,
  products,
  insertRequestAreaTemplateSchema,
  insertRequestAreaTemplateItemSchema,
} from "@shared/schema";

export function registerRequestTemplateRoutes(app: Express) {
  // List all templates (any authenticated user)
  app.get("/api/request-templates", requireAuth, async (req, res) => {
    try {
      const templates = await db
        .select()
        .from(requestAreaTemplates)
        .orderBy(asc(requestAreaTemplates.name));
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar templates" });
    }
  });

  // Get template with items (any authenticated user)
  app.get("/api/request-templates/:id", requireAuth, async (req, res) => {
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
          defaultQuantity: requestAreaTemplateItems.defaultQuantity,
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
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar template" });
    }
  });

  // Create template (admin only)
  app.post("/api/request-templates", requireAdmin, async (req, res) => {
    try {
      const data = insertRequestAreaTemplateSchema.parse({
        ...req.body,
        createdBy: req.user!.id,
      });
      const [created] = await db.insert(requestAreaTemplates).values(data).returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Dados inválidos" });
    }
  });

  // Update template (admin only)
  app.patch("/api/request-templates/:id", requireAdmin, async (req, res) => {
    try {
      const [existing] = await db
        .select()
        .from(requestAreaTemplates)
        .where(eq(requestAreaTemplates.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Template não encontrado" });

      const { name, description } = req.body;
      const [updated] = await db
        .update(requestAreaTemplates)
        .set({ name, description })
        .where(eq(requestAreaTemplates.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Erro ao atualizar template" });
    }
  });

  // Delete template (admin only)
  app.delete("/api/request-templates/:id", requireAdmin, async (req, res) => {
    try {
      const [existing] = await db
        .select()
        .from(requestAreaTemplates)
        .where(eq(requestAreaTemplates.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Template não encontrado" });

      await db.delete(requestAreaTemplates).where(eq(requestAreaTemplates.id, req.params.id));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir template" });
    }
  });

  // Add item to template (admin only)
  app.post("/api/request-templates/:id/items", requireAdmin, async (req, res) => {
    try {
      const [template] = await db
        .select()
        .from(requestAreaTemplates)
        .where(eq(requestAreaTemplates.id, req.params.id));
      if (!template) return res.status(404).json({ error: "Template não encontrado" });

      const data = insertRequestAreaTemplateItemSchema.parse({
        ...req.body,
        templateId: req.params.id,
      });
      const [item] = await db.insert(requestAreaTemplateItems).values(data).returning();

      // Return item with product info
      const [full] = await db
        .select({
          id: requestAreaTemplateItems.id,
          templateId: requestAreaTemplateItems.templateId,
          productId: requestAreaTemplateItems.productId,
          defaultQuantity: requestAreaTemplateItems.defaultQuantity,
          sortOrder: requestAreaTemplateItems.sortOrder,
          productName: products.name,
          productSku: products.sku,
          productUnit: products.unit,
        })
        .from(requestAreaTemplateItems)
        .leftJoin(products, eq(requestAreaTemplateItems.productId, products.id))
        .where(eq(requestAreaTemplateItems.id, item.id));

      res.status(201).json(full);
    } catch (error) {
      res.status(400).json({ error: "Dados inválidos" });
    }
  });

  // Update item quantity (admin only)
  app.patch("/api/request-templates/:id/items/:itemId", requireAdmin, async (req, res) => {
    try {
      const { defaultQuantity } = req.body;
      const [updated] = await db
        .update(requestAreaTemplateItems)
        .set({ defaultQuantity: Number(defaultQuantity) })
        .where(eq(requestAreaTemplateItems.id, req.params.itemId))
        .returning();
      if (!updated) return res.status(404).json({ error: "Item não encontrado" });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Erro ao atualizar item" });
    }
  });

  // Delete item from template (admin only)
  app.delete("/api/request-templates/:id/items/:itemId", requireAdmin, async (req, res) => {
    try {
      await db
        .delete(requestAreaTemplateItems)
        .where(eq(requestAreaTemplateItems.id, req.params.itemId));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao remover item" });
    }
  });
}
