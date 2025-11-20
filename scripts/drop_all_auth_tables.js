const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.\n');
    
    // Query to find ALL constraints pointing to auth.users
    const query = `
      SELECT DISTINCT
        tc.table_name,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_schema = 'auth'
        AND ccu.table_name = 'users'
      ORDER BY tc.table_name;
    `;
    
    const result = await client.query(query);
    
    console.log(`Found ${result.rows.length} tables with foreign keys to auth.users:\n`);
    
    if (result.rows.length === 0) {
      console.log('No tables found. Migration should work now!');
      return;
    }
    
    // Get unique table names
    const tables = [...new Set(result.rows.map(r => r.table_name))];
    
    tables.forEach(table => console.log(`  - ${table}`));
    console.log(`\nDropping ${tables.length} tables...\n`);
    
    for (const table of tables) {
      console.log(`Dropping ${table}...`);
      await client.query(`DROP TABLE IF EXISTS public."${table}" CASCADE;`);
      console.log(`  ✓ Dropped ${table}`);
    }
    
    console.log('\n✓ All tables with auth.users references dropped successfully!');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
