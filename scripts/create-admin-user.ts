import { hashPassword } from "../server/auth";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function createAdminUser() {
  const username = "admin";
  const password = process.env.ADMIN_PASSWORD;
  const name = "Administrador";
  const email = "admin@sistema.com";

  if (!password) {
    console.error("Defina ADMIN_PASSWORD no ambiente antes de rodar este script.");
    process.exit(1);
  }

  // Check if user already exists
  const existingUser = await db.select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser.length > 0) {
    console.log("Usuário admin já existe. Atualizando senha...");
    const hashedPassword = await hashPassword(password);
    await db.update(users)
      .set({ 
        password: hashedPassword,
        active: true 
      })
      .where(eq(users.username, username));
    console.log("Senha atualizada com sucesso!");
  } else {
    console.log("Criando novo usuário admin...");
    const hashedPassword = await hashPassword(password);
    await db.insert(users).values({
      username,
      password: hashedPassword,
      name,
      email,
      active: true
    });
    console.log("Usuário criado com sucesso!");
  }

  console.log("\nUsuário 'admin' pronto, com a senha definida em ADMIN_PASSWORD.");
  console.log("IMPORTANTE: Altere esta senha após o primeiro acesso!");
  
  process.exit(0);
}

createAdminUser().catch((error) => {
  console.error("Erro ao criar usuário:", error);
  process.exit(1);
});
