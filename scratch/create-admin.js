/**
 * Script de Recovery - Cria/Reseta usuário ROOT
 * Uso: node scripts/create-admin.js
 */

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function createAdmin() {
    const client = await pool.connect();
    
    try {
        const email = 'admin@orion.local';
        const password = 'Orion2026@Admin';
        const name = 'Administrator';
        
        const passwordHash = await bcrypt.hash(password, 12);
        
        // Verifica se existe
        const existing = await client.query(
            'SELECT id, email FROM users WHERE email = $1',
            [email]
        );
        
        if (existing.rows.length > 0) {
            // Atualiza senha existente
            await client.query(
                'UPDATE users SET password_hash = $1, role = $2, status = $3 WHERE email = $4',
                [passwordHash, 'ROOT', 'active', email]
            );
            console.log('✅ Admin atualizado!');
        } else {
            // Cria novo
            await client.query(
                `INSERT INTO users (name, email, password_hash, role, status)
                 VALUES ($1, $2, $3, 'ROOT', 'active')`,
                [name, email, passwordHash]
            );
            console.log('✅ Admin criado!');
        }
        
        console.log(`
╔════════════════════════════════════════╗
║  LOGIN DE RECOVERY CRIADO              ║
╠════════════════════════════════════════╣
║  Email:    ${email.padEnd(28)}║
║  Senha:    ${password.padEnd(28)}║
╚════════════════════════════════════════╝
⚠️  DELETE ESTE ARQUIVO APÓS USO!
        `);
        
    } finally {
        client.release();
        await pool.end();
    }
}

createAdmin().catch(console.error);