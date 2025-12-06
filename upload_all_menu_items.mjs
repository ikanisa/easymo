import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sbp_500607f0d078e919aa24f179473291544003a035';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// All menu items from the CSV - parsed properly
const menuItems = [
  // Zion Reggae Bar
  { bar_id: "4d514423-222a-4b51-83ed-5202d3bf005b", bar_name: "Zion Reggae Bar", item_name: "Americano", price: 1.6, category: "Coffees & Teas" },
  { bar_id: "4d514423-222a-4b51-83ed-5202d3bf005b", bar_name: "Zion Reggae Bar", item_name: "Aperol Spritz", price: 8, category: "Apéritifs" },
  { bar_id: "4d514423-222a-4b51-83ed-5202d3bf005b", bar_name: "Zion Reggae Bar", item_name: "Asahi", price: 4.5, category: "Bottled Beer & Ciders" },
  { bar_id: "4d514423-222a-4b51-83ed-5202d3bf005b", bar_name: "Zion Reggae Bar", item_name: "Avocado Sauce", price: 1.5, category: "Burger Extras" },
  { bar_id: "4d514423-222a-4b51-83ed-5202d3bf005b", bar_name: "Zion Reggae Bar", item_name: "Bajtra Spritz", price: 8, category: "Apéritifs" },
];

async function uploadInBatches() {
  const BATCH_SIZE = 100;
  let totalUploaded = 0;
  let errors = [];
  
  console.log(`Starting upload of ${menuItems.length} menu items in batches of ${BATCH_SIZE}...`);
  
  for (let i = 0; i < menuItems.length; i += BATCH_SIZE) {
    const batch = menuItems.slice(i, i + BATCH_SIZE);
    console.log(`\nUploading batch ${Math.floor(i/BATCH_SIZE) + 1}: items ${i + 1} to ${Math.min(i + BATCH_SIZE, menuItems.length)}`);
    
    const { data, error } = await supabase
      .from('bar_menu_items')
      .insert(batch)
      .select('id, bar_name, item_name');
    
    if (error) {
      console.error(`Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error.message);
      errors.push({ batch: Math.floor(i/BATCH_SIZE) + 1, error: error.message });
    } else {
      totalUploaded += data.length;
      console.log(`✓ Successfully uploaded ${data.length} items`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n========================================`);
  console.log(`Upload Summary:`);
  console.log(`Total items: ${menuItems.length}`);
  console.log(`Successfully uploaded: ${totalUploaded}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nError details:', errors);
  }
  console.log(`========================================\n`);
}

uploadInBatches().catch(console.error);
