const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.\n');
    
    // Check if specific tables exist
    const tablesToCheck = [
      'feature_flags',
      'feature_flag_evaluations',
      'analytics_events',
      'configurations',
      'configuration_history',
      'event_store'
    ];
    
    console.log('Checking for problematic tables...\n');
    
    for (const table of tablesToCheck) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      const exists = result.rows[0].exists;
      console.log(`  ${table}: ${exists ? '✗ EXISTS' : '✓ not found'}`);
      
      if (exists) {
        console.log(`    Dropping ${table}...`);
        await client.query(`DROP TABLE IF EXISTS public."${table}" CASCADE;`);
        console.log(`    ✓ Dropped`);
      }
    }
    
    console.log('\n✓ Check complete!');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
