import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co';
const SUPABASE_KEY = 'sbp_500607f0d078e919aa24f179473291544003a035';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const csvData = `Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Aperol Spritz,8,Apéritifs
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Asahi,4.5,Bottled Beer & Ciders
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Avocado Sauce,1.5,Burger Extras
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Bajtra Spritz,8,Apéritifs`;

// Parse CSV
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const items = [];
  
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length >= 5) {
      const bar_name = parts[0];
      const bar_id = parts[1];
      const item_name = parts[2];
      const price = parseFloat(parts[3]);
      const category = parts.slice(4).join(','); // Handle categories with commas
      
      items.push({
        bar_name,
        bar_id,
        item_name,
        price,
        category
      });
    }
  }
  
  return items;
}

const menuItems = parseCSV(csvData);
console.log(`Parsed ${menuItems.length} items from CSV`);
console.log('Sample:', menuItems[0]);

