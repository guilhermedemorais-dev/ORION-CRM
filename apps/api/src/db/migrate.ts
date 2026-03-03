import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

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
    } finally {
        await client.end();
    }
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
