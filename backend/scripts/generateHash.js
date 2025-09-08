const bcrypt = require('bcrypt');

const password = process.argv[2];
if (!password) {
  console.error('Error: Debes proporcionar una contraseña como argumento');
  console.log('Uso: node generateHash.js <contraseña>');
  process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error al generar hash:', err);
    process.exit(1);
  }
  console.log('Hash:', hash);
});