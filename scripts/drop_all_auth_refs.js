const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    
    // Find ALL tables with foreign keys to auth.users
    const conflicts = await client.query(`
      SELECT DISTINCT
        tc.table_schema, 
        tc.table_name
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND ccu.table_schema = 'auth' 
      AND ccu.table_name = 'users'
      AND tc.table_schema = 'public';
    `);
    
    console.log(`Found ${conflicts.rows.length} tables with foreign keys to auth.users:`);
    conflicts.rows.forEach(row => console.log(`  - ${row.table_name}`));

    if (conflicts.rows.length > 0) {
      console.log('\nDropping all conflicting tables...');
      for (const row of conflicts.rows) {
        console.log(`Dropping ${row.table_name}...`);
        await client.query(`DROP TABLE IF EXISTS public."${row.table_name}" CASCADE;`);
        console.log(`  ✓ Dropped ${row.table_name}`);
      }
      console.log('\n✓ All conflicting tables dropped successfully!');
    } else {
      console.log('No tables with foreign keys to auth.users found.');
    }
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
