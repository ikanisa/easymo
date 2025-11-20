const { Client } = require('pg');

// require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    
    let res = await client.query("DROP TABLE IF EXISTS public.analytics_events CASCADE;");
    console.log('Dropped table public.analytics_events:', res);

    res = await client.query("DROP TABLE IF EXISTS public.configuration_history CASCADE;");
    console.log('Dropped table public.configuration_history:', res);

    res = await client.query("DROP TABLE IF EXISTS public.configurations CASCADE;");
    console.log('Dropped table public.configurations:', res);

    res = await client.query("DROP TABLE IF EXISTS public.event_store CASCADE;");
    console.log('Dropped table public.event_store:', res);

    // List all tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log('All public tables:', tables.rows.map(r => r.table_name));

    // Check for foreign keys to auth.users
    const conflicts = await client.query(`
      SELECT
        tc.table_schema, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND ccu.table_schema = 'auth' 
      AND ccu.table_name = 'users';
    `);
    
    console.log('Conflicts found:', conflicts.rows);

    if (conflicts.rows.length > 0) {
      for (const row of conflicts.rows) {
         if (row.table_schema === 'public') {
            console.log(`Dropping ${row.table_name}...`);
            await client.query(`DROP TABLE IF EXISTS public."${row.table_name}" CASCADE;`);
         }
      }
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
