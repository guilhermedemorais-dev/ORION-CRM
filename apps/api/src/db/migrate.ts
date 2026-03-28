import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import bcrypt from 'bcrypt';

// Resolve migrations path relative to this file's compiled location
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
        console.error('❌ DATABASE_URL is required');
        process.exit(1);
    }

    const client = new pg.Client({ connectionString: databaseUrl });

    try {
        await client.connect();
        console.log('📦 Connected to database');

        // Create migrations tracking table
        await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

        // Get already executed migrations
        const { rows: executed } = await client.query<{ name: string }>(
            'SELECT name FROM _migrations ORDER BY name'
        );
        const executedNames = new Set(executed.map(r => r.name));

        // Get migration files
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        if (files.length === 0) {
            console.log('No migration files found.');
            return;
        }

        let applied = 0;

        for (const file of files) {
            if (executedNames.has(file)) {
                console.log(`  ✓ ${file} (already applied)`);
                continue;
            }

            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

            console.log(`  → Applying ${file}...`);

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(
                    'INSERT INTO _migrations (name) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');
                console.log(`  ✅ ${file} applied`);
                applied++;
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`  ❌ ${file} failed:`, err);
                process.exit(1);
            }
        }

        console.log(`\n✅ ${applied} migration(s) applied. ${executedNames.size} previously applied.`);

        // Auto-seed initial ROOT user if env vars are set and no users exist
        await seedAdminUser(client);
    } finally {
        await client.end();
    }
}

async function seedAdminUser(client: pg.Client): Promise<void> {
    const name = process.env['SEED_ADMIN_NAME'];
    const email = process.env['SEED_ADMIN_EMAIL'];
    const password = process.env['SEED_ADMIN_PASSWORD'];
    const companyName = process.env['SEED_COMPANY_NAME'] ?? 'Orion';

    if (!name || !email || !password) return;

    const { rows } = await client.query<{ count: string }>('SELECT COUNT(*) as count FROM users');
    if (parseInt(rows[0]!.count) > 0) {
        console.log('  ✓ Admin seed skipped (users already exist)');
        return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
        `INSERT INTO users (name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'ROOT', true)`,
        [name, email, passwordHash]
    );

    await client.query(
        `UPDATE settings SET
            company_name = $1,
            status = 'active',
            provisioned_at = NOW()
         WHERE id = (SELECT id FROM settings LIMIT 1)`,
        [companyName]
    );

    console.log(`  ✅ Admin ROOT criado: ${email}`);
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
