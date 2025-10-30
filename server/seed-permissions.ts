import { neon } from '@neondatabase/serverless';

// Todas as permissões do sistema organizadas por categoria
const allPermissions = [
  // Operações
  { page: 'dashboard', displayName: 'Dashboard', category: 'Operações' },
  { page: 'events', displayName: 'Eventos', category: 'Operações' },
  { page: 'requests', displayName: 'Requisições de Materiais', category: 'Operações' },
  { page: 'request-details', displayName: 'Detalhes de Requisição', category: 'Operações' },
  { page: 'loading-orders', displayName: 'Ordens de Carregamento', category: 'Operações' },
  { page: 'loading-order-details', displayName: 'Detalhes de Ordem', category: 'Operações' },
  { page: 'movements', displayName: 'Movimentações', category: 'Operações' },
  { page: 'movement-details', displayName: 'Detalhes de Movimentação', category: 'Operações' },
  { page: 'trips', displayName: 'Viagens', category: 'Operações' },
  
  // Estoque
  { page: 'inventory', displayName: 'Posição de Estoque', category: 'Estoque' },
  { page: 'inventory-views', displayName: 'Visões de Estoque', category: 'Estoque' },
  { page: 'products', displayName: 'Produtos', category: 'Estoque' },
  { page: 'kits', displayName: 'Kits', category: 'Estoque' },
  { page: 'product-variants', displayName: 'Variantes de Produtos', category: 'Estoque' },
  { page: 'suppliers', displayName: 'Fornecedores', category: 'Estoque' },
  
  // Aprovações
  { page: 'approvals', displayName: 'Aprovações de Requisições', category: 'Aprovações' },
  { page: 'approval-detail', displayName: 'Detalhes de Aprovação', category: 'Aprovações' },
  { page: 'movement-approvals', displayName: 'Aprovações de Movimentações', category: 'Aprovações' },
  
  // Relatórios
  { page: 'stock-simulation', displayName: 'Simulação de Estoque', category: 'Relatórios' },
  { page: 'stock-position-simulation', displayName: 'Simulação de Posição', category: 'Relatórios' },
  { page: 'returns', displayName: 'Devoluções e Avarias', category: 'Relatórios' },
  
  // Uploads e Importações
  { page: 'event-upload', displayName: 'Upload de Eventos', category: 'Importações' },
  { page: 'product-upload', displayName: 'Upload de Produtos', category: 'Importações' },
  { page: 'trip-upload', displayName: 'Upload de Viagens', category: 'Importações' },
  
  // Configurações
  { page: 'config', displayName: 'Configurações Gerais', category: 'Configurações' },
  { page: 'users', displayName: 'Usuários', category: 'Configurações' },
  { page: 'roles', displayName: 'Papéis e Permissões', category: 'Configurações' },
  { page: 'docks', displayName: 'Docas', category: 'Configurações' },
  { page: 'drivers', displayName: 'Motoristas', category: 'Configurações' },
  { page: 'vehicle-types', displayName: 'Tipos de Veículos', category: 'Configurações' },
  { page: 'movement-groups', displayName: 'Grupos de Movimentação', category: 'Configurações' },
  { page: 'movement-types-config', displayName: 'Tipos de Movimentação', category: 'Configurações' },
  { page: 'product-statuses', displayName: 'Status de Produtos', category: 'Configurações' },
  { page: 'locations', displayName: 'Localizações', category: 'Configurações' },
  
  // Notificações
  { page: 'notification-settings', displayName: 'Configurações de Notificações', category: 'Notificações' },
  
  // Autenticação (páginas públicas - não exigem permissão, mas listadas para completude)
  { page: 'auth-page', displayName: 'Login/Registro', category: 'Autenticação' },
  { page: 'forgot-password', displayName: 'Esqueci Senha', category: 'Autenticação' },
  { page: 'reset-password', displayName: 'Redefinir Senha', category: 'Autenticação' },
];

async function seedPermissions() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL não encontrada!');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  console.log('🌱 Populando permissões do sistema...\n');

  try {
    let createdCount = 0;
    let updatedCount = 0;

    for (const permission of allPermissions) {
      // Verificar se já existe
      const existing = await sql`
        SELECT id FROM permissions WHERE page = ${permission.page}
      `;

      if (existing.length > 0) {
        // Atualizar
        await sql`
          UPDATE permissions 
          SET display_name = ${permission.displayName}
          WHERE page = ${permission.page}
        `;
        updatedCount++;
        console.log(`✏️  Atualizado: ${permission.displayName} (${permission.page})`);
      } else {
        // Criar
        await sql`
          INSERT INTO permissions (page, display_name, can_view, can_create, can_edit, can_delete)
          VALUES (${permission.page}, ${permission.displayName}, false, false, false, false)
        `;
        createdCount++;
        console.log(`✅ Criado: ${permission.displayName} (${permission.page})`);
      }
    }

    console.log(`\n🎉 Concluído!`);
    console.log(`   📝 ${createdCount} permissões criadas`);
    console.log(`   ✏️  ${updatedCount} permissões atualizadas`);
    console.log(`   📊 Total: ${allPermissions.length} permissões no sistema\n`);

    // Mostrar agrupamento por categoria
    const byCategory = allPermissions.reduce((acc, p) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p.displayName);
      return acc;
    }, {} as Record<string, string[]>);

    console.log('📋 Permissões por categoria:\n');
    Object.entries(byCategory).forEach(([category, perms]) => {
      console.log(`   ${category}: ${perms.length} páginas`);
    });
    console.log();

  } catch (error) {
    console.error('❌ Erro ao popular permissões:', error);
    process.exit(1);
  }
}

seedPermissions();
