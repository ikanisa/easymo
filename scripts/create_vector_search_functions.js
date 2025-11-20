const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.\n');
    
    // Create RPC function for property listings vector search
    console.log('Creating match_property_listings function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION match_property_listings(
        query_embedding vector(1536),
        match_threshold float DEFAULT 0.7,
        match_count int DEFAULT 5,
        filter jsonb DEFAULT '{}'::jsonb
      )
      RETURNS TABLE (
        id uuid,
        title text,
        description text,
        price decimal,
        location text,
        similarity float
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          pl.id,
          pl.title,
          pl.description,
          pl.price,
          pl.location,
          1 - (pl.embedding <=> query_embedding) as similarity
        FROM "PropertyListing" pl
        WHERE pl.embedding IS NOT NULL
          AND 1 - (pl.embedding <=> query_embedding) > match_threshold
        ORDER BY pl.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `);
    console.log('✓ match_property_listings created');
    
    // Create RPC function for job listings vector search
    console.log('Creating match_job_listings function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION match_job_listings(
        query_embedding vector(1536),
        match_threshold float DEFAULT 0.7,
        match_count int DEFAULT 5,
        filter jsonb DEFAULT '{}'::jsonb
      )
      RETURNS TABLE (
        id uuid,
        title text,
        description text,
        salary_min decimal,
        salary_max decimal,
        location text,
        similarity float
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          jl.id,
          jl.title,
          jl.description,
          jl."salaryMin",
          jl."salaryMax",
          jl.location,
          1 - (jl.embedding <=> query_embedding) as similarity
        FROM "JobListing" jl
        WHERE jl.embedding IS NOT NULL
          AND 1 - (jl.embedding <=> query_embedding) > match_threshold
        ORDER BY jl.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `);
    console.log('✓ match_job_listings created');
    
    console.log('\n✓ All vector search RPC functions created successfully!');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
