import { neon } from '@neondatabase/serverless';

async function fixProductionDatabase() {
  // Use a connection string da produção
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL não encontrada!');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  console.log('🔧 Iniciando correção do banco de produção...\n');

  try {
    // Criar o enum para status de aprovação
    console.log('1️⃣ Criando enum user_approval_status...');
    await sql`
      DO $$ BEGIN
        CREATE TYPE user_approval_status AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('✅ Enum criado com sucesso!\n');

    // Adicionar as colunas de aprovação
    console.log('2️⃣ Adicionando colunas de aprovação...');
    await sql`
      ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS approval_status user_approval_status NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS approved_by varchar,
        ADD COLUMN IF NOT EXISTS approved_at timestamp,
        ADD COLUMN IF NOT EXISTS rejected_by varchar,
        ADD COLUMN IF NOT EXISTS rejected_at timestamp,
        ADD COLUMN IF NOT EXISTS rejection_reason text;
    `;
    console.log('✅ Colunas adicionadas com sucesso!\n');

    // Aprovar todos os usuários existentes
    console.log('3️⃣ Aprovando usuários existentes...');
    const result = await sql`
      UPDATE users 
      SET approval_status = 'approved', 
          approved_at = CURRENT_TIMESTAMP 
      WHERE approval_status = 'pending'
      RETURNING id, username, name;
    `;
    console.log(`✅ ${result.length} usuário(s) aprovado(s):\n`);
    result.forEach((user: any) => {
      console.log(`   - ${user.name} (${user.username})`);
    });

    console.log('\n🎉 Banco de dados de produção corrigido com sucesso!');
    console.log('👉 Agora você pode fazer login normalmente.\n');

  } catch (error) {
    console.error('❌ Erro ao corrigir banco de dados:', error);
    process.exit(1);
  }
}

fixProductionDatabase();
