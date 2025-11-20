const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    
    // Drop known problematic tables
    const tablesToDrop = [
      'analytics_events',
      'configuration_history',
      'configurations',
      'event_store',
      'feature_flag_evaluations'
    ];
    
    console.log(`Dropping ${tablesToDrop.length} known problematic tables...`);
    for (const table of tablesToDrop) {
      console.log(`Dropping ${table}...`);
      await client.query(`DROP TABLE IF EXISTS public."${table}" CASCADE;`);
      console.log(`  ✓ Dropped ${table}`);
    }
    
    console.log('\n✓ All known problematic tables dropped!');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
