const bcrypt = require('bcrypt');

async function verifyPassword(password, hash) {
  try {
    const match = await bcrypt.compare(password, hash);
    console.log(`¿La contraseña "${password}" coincide con el hash? ${match}`);
  } catch (error) {
    console.error('Error al verificar la contraseña:', error.message);
    process.exit(1);
  }
}

const password = process.argv[2];
const hash = process.argv[3];

if (!password || !hash) {
  console.error('Error: Debes proporcionar una contraseña y un hash como argumentos');
  console.log('Uso: node verifyHash.js <contraseña> <hash>');
  process.exit(1);
}

verifyPassword(password, hash);