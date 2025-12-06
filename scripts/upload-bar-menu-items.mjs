#!/usr/bin/env node

/**
 * Upload Bar Menu Items from CSV
 * 
 * This script uploads menu items from CSV format to the bar_menu_items table
 * CSV Format: bar name,bar_id,item name,price,category
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CSV data from user
const CSV_DATA = `bar name,bar_id,item name,price,category
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Aperol Spritz,8,Apéritifs
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Asahi,4.5,Bottled Beer & Ciders
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Avocado Sauce,1.5,Burger Extras
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Bajtra Spritz,8,Apéritifs
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Barbera D'Alba Superiore   Italy,26.5,Red Wines
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beef Carpaccio,11.5,Starters to Share Crudités & Carpaccio
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beef Rib Eye,28.5,Mains
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beef Teriyaki,13.5,Salads
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beef Teriyaki Wrap,10,Wraps Served Until 6PM)
Victoria Gastro Pub,46105fa8-efc7-422a-afa8-a5188eb2f5ed,Aljotta,8.5,Soup
Victoria Gastro Pub,46105fa8-efc7-422a-afa8-a5188eb2f5ed,Bacon Jam Burger,14.5,Burgers
Victoria Gastro Pub,46105fa8-efc7-422a-afa8-a5188eb2f5ed,Baked Feta,10.5,Starters`;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Parse CSV data
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = line.split(',').map(v => v.trim());
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    
    data.push(row);
  }
  
  return data;
}

/**
 * Transform CSV row to database format
 */
function transformRow(row) {
  return {
    bar_id: row['bar_id'],
    bar_name: row['bar name'],
    item_name: row['item name'],
    price: parseFloat(row['price']),
    category: row['category'],
    is_available: true
  };
}

/**
 * Upload menu items in batches
 */
async function uploadMenuItems(menuItems) {
  console.log(`📤 Uploading ${menuItems.length} menu items...`);
  
  const BATCH_SIZE = 100;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < menuItems.length; i += BATCH_SIZE) {
    const batch = menuItems.slice(i, i + BATCH_SIZE);
    
    try {
      const { data, error } = await supabase
        .from('bar_menu_items')
        .upsert(batch, {
          onConflict: 'bar_id,item_name,category',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error(`❌ Error in batch ${i / BATCH_SIZE + 1}:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`✅ Uploaded batch ${i / BATCH_SIZE + 1} (${batch.length} items)`);
      }
    } catch (err) {
      console.error(`❌ Exception in batch ${i / BATCH_SIZE + 1}:`, err.message);
      errorCount += batch.length;
    }
  }
  
  return { successCount, errorCount };
}

/**
 * Get statistics about the upload
 */
async function getStatistics() {
  const { data: bars, error: barsError } = await supabase
    .from('bar_menu_items')
    .select('bar_id, bar_name')
    .select();
  
  if (barsError) {
    console.error('Error getting statistics:', barsError);
    return;
  }
  
  const uniqueBars = [...new Set(bars.map(b => b.bar_name))];
  
  console.log('\n📊 Upload Statistics:');
  console.log(`   Total unique bars: ${uniqueBars.length}`);
  console.log(`   Total menu items: ${bars.length}`);
  
  // Get category breakdown
  const { data: categories } = await supabase
    .from('bar_menu_items')
    .select('category')
    .select();
  
  const categoryCount = {};
  categories.forEach(c => {
    categoryCount[c.category] = (categoryCount[c.category] || 0) + 1;
  });
  
  console.log('\n📋 Items by Category:');
  Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Bar Menu Items Upload Script\n');
  
  // Check if we should use file or inline data
  const csvFilePath = process.argv[2];
  let csvData = CSV_DATA;
  
  if (csvFilePath && fs.existsSync(csvFilePath)) {
    console.log(`📁 Reading from file: ${csvFilePath}`);
    csvData = fs.readFileSync(csvFilePath, 'utf-8');
  } else {
    console.log('📝 Using inline CSV data (sample)');
  }
  
  // Parse CSV
  console.log('🔍 Parsing CSV data...');
  const rows = parseCSV(csvData);
  console.log(`   Found ${rows.length} rows`);
  
  // Transform data
  console.log('\n🔄 Transforming data...');
  const menuItems = rows.map(transformRow);
  
  // Validate data
  const invalidItems = menuItems.filter(item => 
    !item.bar_id || !item.item_name || !item.price || !item.category
  );
  
  if (invalidItems.length > 0) {
    console.warn(`⚠️  Found ${invalidItems.length} invalid items (missing required fields)`);
    console.log('   Sample invalid item:', invalidItems[0]);
  }
  
  const validItems = menuItems.filter(item =>
    item.bar_id && item.item_name && item.price && item.category
  );
  
  console.log(`   Valid items: ${validItems.length}`);
  console.log(`   Invalid items: ${invalidItems.length}`);
  
  // Upload
  const { successCount, errorCount } = await uploadMenuItems(validItems);
  
  console.log(`\n✨ Upload Complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  
  // Get statistics
  await getStatistics();
  
  console.log('\n✅ Done!');
}

main().catch(console.error);
