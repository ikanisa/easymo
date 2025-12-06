import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co';
const SUPABASE_KEY = 'sbp_500607f0d078e919aa24f179473291544003a035';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// CSV data parsed into JSON
const menuItems = [
  // Zion Reggae Bar items
  { bar_name: "Zion Reggae Bar", bar_id: "4d514423-222a-4b51-83ed-5202d3bf005b", item_name: "Americano", price: 1.6, category: "Coffees & Teas" },
  { bar_name: "Zion Reggae Bar", bar_id: "4d514423-222a-4b51-83ed-5202d3bf005b", item_name: "Aperol Spritz", price: 8, category: "Apéritifs" },
  { bar_name: "Zion Reggae Bar", bar_id: "4d514423-222a-4b51-83ed-5202d3bf005b", item_name: "Asahi", price: 4.5, category: "Bottled Beer & Ciders" },
  { bar_name: "Zion Reggae Bar", bar_id: "4d514423-222a-4b51-83ed-5202d3bf005b", item_name: "Avocado Sauce", price: 1.5, category: "Burger Extras" },
  { bar_name: "Zion Reggae Bar", bar_id: "4d514423-222a-4b51-83ed-5202d3bf005b", item_name: "Bajtra Spritz", price: 8, category: "Apéritifs" },
];

async function uploadMenuItems() {
  console.log('Checking if table exists and structure...');
  
  // First, let's check what tables exist
  const { data: tables, error: tablesError } = await supabase
    .from('bar_menu_items')
    .select('*')
    .limit(1);
  
  if (tablesError) {
    console.error('Error checking table:', tablesError);
    console.log('Table might not exist. Checking available tables...');
    
    // Try to list all accessible tables
    const { data: allData, error: allError } = await supabase.rpc('get_tables');
    console.log('Available tables check result:', { allData, allError });
  }
  
  console.log('Sample data to upload:', menuItems.slice(0, 2));
  
  // Try to insert the data
  const { data, error } = await supabase
    .from('bar_menu_items')
    .insert(menuItems)
    .select();
  
  if (error) {
    console.error('Error uploading:', error);
    process.exit(1);
  }
  
  console.log(`Successfully uploaded ${data?.length || 0} menu items`);
  console.log('Sample uploaded items:', data?.slice(0, 3));
}

uploadMenuItems();
