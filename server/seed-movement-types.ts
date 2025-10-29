import { storage } from "./storage";
import type { InsertMovementGroup, InsertMovementTypeConfig } from "@shared/schema";

async function seedMovementTypes() {
  console.log("🌱 Starting Movement Types seed...");

  // Step 1: Create Movement Groups
  const groups: InsertMovementGroup[] = [
    {
      code: "OPERATIONAL",
      name: "Operações Logísticas",
      description: "Movimentações relacionadas a operações de eventos e logística",
      color: "#3b82f6", // blue-500
      icon: "🚚",
      purpose: "operational",
      displayOrder: 1,
      active: true,
    },
    {
      code: "QUALITY",
      name: "Controle de Qualidade",
      description: "Movimentações para controle de qualidade e inspeção",
      color: "#8b5cf6", // violet-500
      icon: "🔍",
      purpose: "quality_control",
      displayOrder: 2,
      active: true,
    },
    {
      code: "THIRD_PARTY",
      name: "Terceiros",
      description: "Movimentações envolvendo terceiros (aluguel, comodato, consignado)",
      color: "#f59e0b", // amber-500
      icon: "🤝",
      purpose: "third_party",
      displayOrder: 3,
      active: true,
    },
    {
      code: "ADJUSTMENTS",
      name: "Ajustes e Correções",
      description: "Ajustes de estoque, correções e inventário",
      color: "#ef4444", // red-500
      icon: "⚙️",
      purpose: "adjustments",
      displayOrder: 4,
      active: true,
    },
    {
      code: "TRANSFERS",
      name: "Transferências Internas",
      description: "Transferências entre locais, depósitos e status",
      color: "#10b981", // green-500
      icon: "↔️",
      purpose: "operational",
      displayOrder: 5,
      active: true,
    },
  ];

  console.log("Creating movement groups...");
  const createdGroups = await Promise.all(
    groups.map(group => storage.createMovementGroup(group))
  );
  
  const groupMap = new Map(createdGroups.map(g => [g.code, g.id]));
  console.log(`✅ Created ${createdGroups.length} movement groups`);

  // Step 2: Create Movement Types Config
  const types: InsertMovementTypeConfig[] = [
    // OPERATIONAL GROUP - Operações Logísticas
    {
      code: "EVENT_LOADING",
      name: "Carga para Evento",
      groupId: groupMap.get("OPERATIONAL")!,
      nature: "outbound",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: false,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "EVENT_UNLOADING",
      name: "Descarga de Evento",
      groupId: groupMap.get("OPERATIONAL")!,
      nature: "inbound",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: false,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "WAREHOUSE_ENTRY",
      name: "Entrada no Almoxarifado",
      groupId: groupMap.get("OPERATIONAL")!,
      nature: "inbound",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: false,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "WAREHOUSE_EXIT",
      name: "Saída do Almoxarifado",
      groupId: groupMap.get("OPERATIONAL")!,
      nature: "outbound",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: false,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "PRODUCTION_ENTRY",
      name: "Entrada de Produção",
      groupId: groupMap.get("OPERATIONAL")!,
      nature: "inbound",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: false,
      requiresDocument: false,
      allowsMixedBatch: true,
      active: true,
    },

    // QUALITY GROUP - Controle de Qualidade
    {
      code: "QUALITY_INSPECTION",
      name: "Inspeção de Qualidade",
      groupId: groupMap.get("QUALITY")!,
      nature: "transfer",
      affectsPhysicalInventory: false,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: false,
      requiresApproval: false,
      requiresDocument: false,
      allowsMixedBatch: false,
      active: true,
    },
    {
      code: "QUALITY_APPROVED",
      name: "Aprovado em Inspeção",
      groupId: groupMap.get("QUALITY")!,
      nature: "transfer",
      affectsPhysicalInventory: false,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: false,
      requiresApproval: false,
      requiresDocument: false,
      allowsMixedBatch: false,
      active: true,
    },
    {
      code: "QUALITY_REJECTED",
      name: "Reprovado em Inspeção",
      groupId: groupMap.get("QUALITY")!,
      nature: "transfer",
      affectsPhysicalInventory: false,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: false,
      requiresApproval: false,
      requiresDocument: true,
      allowsMixedBatch: false,
      active: true,
    },
    {
      code: "MAINTENANCE",
      name: "Envio para Manutenção",
      groupId: groupMap.get("QUALITY")!,
      nature: "transfer",
      affectsPhysicalInventory: false,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: false,
      requiresApproval: false,
      requiresDocument: false,
      allowsMixedBatch: true,
      active: true,
    },

    // THIRD_PARTY GROUP - Terceiros
    {
      code: "RENTAL_OUT",
      name: "Saída Aluguel",
      groupId: groupMap.get("THIRD_PARTY")!,
      nature: "outbound",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: true,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "RENTAL_IN",
      name: "Retorno Aluguel",
      groupId: groupMap.get("THIRD_PARTY")!,
      nature: "inbound",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: false,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "LOAN_OUT",
      name: "Saída Comodato",
      groupId: groupMap.get("THIRD_PARTY")!,
      nature: "outbound",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: true,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "LOAN_IN",
      name: "Retorno Comodato",
      groupId: groupMap.get("THIRD_PARTY")!,
      nature: "inbound",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: false,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "CONSIGNMENT_IN",
      name: "Entrada Consignado",
      groupId: groupMap.get("THIRD_PARTY")!,
      nature: "inbound",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: false,
      affectsPatrimonialInventory: false,
      requiresApproval: true,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },

    // ADJUSTMENTS GROUP - Ajustes e Correções
    {
      code: "INVENTORY_ADJUSTMENT_PLUS",
      name: "Ajuste Positivo",
      groupId: groupMap.get("ADJUSTMENTS")!,
      nature: "adjustment",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: true,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "INVENTORY_ADJUSTMENT_MINUS",
      name: "Ajuste Negativo",
      groupId: groupMap.get("ADJUSTMENTS")!,
      nature: "adjustment",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: true,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "DAMAGE_WRITE_OFF",
      name: "Baixa por Dano",
      groupId: groupMap.get("ADJUSTMENTS")!,
      nature: "adjustment",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: true,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "LOSS_WRITE_OFF",
      name: "Baixa por Perda",
      groupId: groupMap.get("ADJUSTMENTS")!,
      nature: "adjustment",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: true,
      requiresApproval: true,
      requiresDocument: true,
      allowsMixedBatch: true,
      active: true,
    },

    // TRANSFERS GROUP - Transferências Internas
    {
      code: "LOCATION_TRANSFER",
      name: "Transferência de Localização",
      groupId: groupMap.get("TRANSFERS")!,
      nature: "transfer",
      affectsPhysicalInventory: false,
      affectsOperationalInventory: false,
      affectsPatrimonialInventory: false,
      requiresApproval: false,
      requiresDocument: false,
      allowsMixedBatch: true,
      active: true,
    },
    {
      code: "STATUS_CHANGE",
      name: "Mudança de Status",
      groupId: groupMap.get("TRANSFERS")!,
      nature: "transfer",
      affectsPhysicalInventory: false,
      affectsOperationalInventory: true,
      affectsPatrimonialInventory: false,
      requiresApproval: false,
      requiresDocument: false,
      allowsMixedBatch: true,
      active: true,
    },
  ];

  console.log("Creating movement types config...");
  const createdTypes = await Promise.all(
    types.map(type => storage.createMovementTypeConfig(type))
  );
  console.log(`✅ Created ${createdTypes.length} movement type configs`);

  console.log("🎉 Movement Types seed completed successfully!");
  console.log(`   - ${createdGroups.length} groups created`);
  console.log(`   - ${createdTypes.length} types created`);
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMovementTypes()
    .then(() => {
      console.log("✅ Seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seed failed:", error);
      process.exit(1);
    });
}

export { seedMovementTypes };
