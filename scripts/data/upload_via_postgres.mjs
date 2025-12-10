import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const CSV_DATA = `Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Aperol Spritz,8,Apéritifs
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Asahi,4.5,Bottled Beer & Ciders
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Avocado Sauce,1.5,Burger Extras`;

function parseCSV(csv) {
  return csv.trim().split('\n').map(line => {
    const match = line.match(/^([^,]+),([^,]+),([^,]+),([0-9.]+),(.+)$/);
    if (match) {
      return [match[2], match[1], match[3], parseFloat(match[4]), match[5]];
    }
    return null;
  }).filter(Boolean);
}

async function upload() {
  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    const items = parseCSV(CSV_DATA);
    console.log(`\nUploading ${items.length} menu items...\n`);
    
    for (const [bar_id, bar_name, item_name, price, category] of items) {
      const query = `
        INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (bar_id, item_name, category) 
        DO UPDATE SET 
          price = EXCLUDED.price,
          bar_name = EXCLUDED.bar_name,
          updated_at = timezone('utc', now())
        RETURNING id;
      `;
      
      const result = await client.query(query, [bar_id, bar_name, item_name, price, category]);
      console.log(`✓ ${item_name} - ${category}`);
    }
    
    console.log(`\n✅ Successfully uploaded ${items.length} items!`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

upload();
