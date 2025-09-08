const bcrypt = require('bcrypt');
const pool = require('./db');

const suppliers = [
    { name: 'ARG Import', email: 'reparolaptops@gmail.com', id_pro: 'ARG-C003' },
    { name: 'KarechoShop', email: 'karechocarlos@gmail.com', id_pro: 'Karecho-001' },
    { name: 'Kode Import', email: 'reinardo.globlal@gmail.com', id_pro: 'kod-Sc001' },
    { name: 'Mastro Import', email: 'mastroimport@gmail.com', id_pro: 'MAS-i002' },
    { name: 'MultiOcc', email: 'warlinklaptops@gmail.com', id_pro: 'Mcc-i004' }
];

async function createSupplierUsers() {
    for (const supplier of suppliers) {
        try {
            const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [supplier.email]);
            if (userCheck.rows.length > 0) {
                console.log(`Usuario ${supplier.email} ya existe, actualizando...`);
                await pool.query(
                    'UPDATE users SET proveedor_id = $1, role = $2 WHERE email = $3',
                    [supplier.id_pro, 'proveedor', supplier.email]
                );
                await pool.query(
                    'UPDATE suppliers SET user_id = $1 WHERE id_pro = $2',
                    [userCheck.rows[0].id, supplier.id_pro]
                );
                console.log(`Usuario ${supplier.email} vinculado a ${supplier.id_pro}`);
                continue;
            }

            const password = 'password123'; // Cambia por contraseñas seguras
            const hashedPassword = await bcrypt.hash(password, 10);

            const userResult = await pool.query(
                'INSERT INTO users (name, email, password, role, created_at, active, proveedor_id) VALUES ($1, $2, $3, $4, NOW(), TRUE, $5) RETURNING id',
                [supplier.name, supplier.email, hashedPassword, 'proveedor', supplier.id_pro]
            );
            const userId = userResult.rows[0].id;

            await pool.query(
                'UPDATE suppliers SET user_id = $1 WHERE id_pro = $2',
                [userId, supplier.id_pro]
            );

            console.log(`Usuario creado para ${supplier.name} (${supplier.email}) con id_pro ${supplier.id_pro}`);
        } catch (error) {
            console.error(`Error al crear usuario para ${supplier.email}: ${error.message}`);
        }
    }
    await pool.end();
}

createSupplierUsers();