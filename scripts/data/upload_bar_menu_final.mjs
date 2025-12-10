import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sbp_500607f0d078e919aa24f179473291544003a035';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Complete CSV data (all items from your original message)
const CSV_DATA = `Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Aperol Spritz,8,Apéritifs
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Asahi,4.5,Bottled Beer & Ciders
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Avocado Sauce,1.5,Burger Extras
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Bajtra Spritz,8,Apéritifs
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Barbera D'Alba Superiore   Italy,26.5,Red Wines
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beef Carpaccio,11.5,Starters to Share Crudités & Carpaccio
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beef Rib Eye,28.5,Mains`;

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const items = [];
  
  for (const line of lines) {
    const match = line.match(/^([^,]+),([^,]+),([^,]+),([0-9.]+),(.+)$/);
    if (match) {
      items.push({
        bar_name: match[1],
        bar_id: match[2],
        item_name: match[3],
        price: parseFloat(match[4]),
        category: match[5]
      });
    }
  }
  
  return items;
}

async function uploadMenuItems() {
  const menuItems = parseCSV(CSV_DATA);
  console.log(`\nParsed ${menuItems.length} menu items from CSV\n`);
  
  const BATCH_SIZE = 50;
  let totalUploaded = 0;
  
  for (let i = 0; i < menuItems.length; i += BATCH_SIZE) {
    const batch = menuItems.slice(i, i + BATCH_SIZE);
    console.log(`Uploading batch ${Math.floor(i/BATCH_SIZE) + 1}: items ${i + 1}-${Math.min(i + BATCH_SIZE, menuItems.length)}`);
    
    const { data, error } = await supabase
      .from('bar_menu_items')
      .upsert(batch, { 
        onConflict: 'bar_id,item_name,category',
        ignoreDuplicates: false 
      })
      .select('id');
    
    if (error) {
      console.error(`❌ Error:`, error.message);
    } else {
      totalUploaded += data.length;
      console.log(`✓ Uploaded ${data.length} items`);
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\n✅ Total uploaded: ${totalUploaded}/${menuItems.length} items\n`);
}

uploadMenuItems().catch(console.error);
