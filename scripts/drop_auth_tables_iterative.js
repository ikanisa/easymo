const { Client } = require('pg');

async function findAndDropAuthTables(client) {
  // Find tables with foreign keys to auth.users
  const query = `
    SELECT DISTINCT tc.table_name
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
  const tables = result.rows.map(r => r.table_name);
  
  if (tables.length > 0) {
    console.log(`Found ${tables.length} tables with foreign keys to auth.users:`);
    tables.forEach(table => console.log(`  - ${table}`));
    console.log('');
    
    for (const table of tables) {
      console.log(`Dropping ${table}...`);
      await client.query(`DROP TABLE IF EXISTS public."${table}" CASCADE;`);
      console.log(`  ✓ Dropped`);
    }
    
    return tables.length;
  }
  
  return 0;
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.\n');
    
    let iteration = 1;
    let totalDropped = 0;
    
    while (true) {
      console.log(`=== Iteration ${iteration} ===\n`);
      const dropped = await findAndDropAuthTables(client);
      
      if (dropped === 0) {
        console.log('✓ No more tables with foreign keys to auth.users found!');
        break;
      }
      
      totalDropped += dropped;
      iteration++;
      console.log('');
      
      // Safety limit
      if (iteration > 20) {
        console.log('⚠ Reached iteration limit. Stopping.');
        break;
      }
    }
    
    console.log(`\n✓ Total tables dropped: ${totalDropped}`);
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
