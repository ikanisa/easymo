const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.\n');
    
    // Get ALL constraints pointing to auth schema
    const query = `
      SELECT 
        conrelid::regclass AS table_name,
        conname AS constraint_name
      FROM pg_constraint
      WHERE confrelid = 'auth.users'::regclass
        AND contype = 'f'
        AND connamespace = 'public'::regnamespace
      ORDER BY table_name;
    `;
    
    const result = await client.query(query);
    
    console.log(`Found ${result.rows.length} constraints pointing to auth.users:\n`);
    
    if (result.rows.length === 0) {
      console.log('No constraints found. Migration should work!');
      return;
    }
    
    // Extract unique table names
    const tables = [...new Set(result.rows.map(r => {
      const tableName = r.table_name.toString();
      // Remove schema prefix if present
      return tableName.includes('.') ? tableName.split('.')[1] : tableName;
    }))];
    
    console.log('Tables to drop:');
    tables.forEach(table => console.log(`  - ${table}`));
    console.log('');
    
    for (const table of tables) {
      console.log(`Dropping ${table}...`);
      await client.query(`DROP TABLE IF EXISTS public."${table}" CASCADE;`);
      console.log(`  ✓ Dropped`);
    }
    
    console.log(`\n✓ Successfully dropped ${tables.length} tables!`);
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
