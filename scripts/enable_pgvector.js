const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.\n');
    
    console.log('Enabling pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✓ pgvector extension enabled successfully!');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
