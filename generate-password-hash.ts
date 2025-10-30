import bcrypt from 'bcrypt';

async function generatePasswordHash() {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  
  console.log('\n🔐 Hash gerado com sucesso!\n');
  console.log('Senha:', password);
  console.log('\nCole este SQL no SQL Runner:\n');
  console.log('----------------------------------------');
  console.log(`UPDATE users SET password = '${hash}' WHERE username = 'DHenrique';`);
  console.log('----------------------------------------\n');
}

generatePasswordHash();
