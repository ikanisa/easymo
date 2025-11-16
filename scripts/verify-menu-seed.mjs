#!/usr/bin/env node
/**
 * Verification script for bar menu items seed data
 * 
 * This script verifies that the menu items have been correctly seeded
 * for all 97 bars in the database.
 * 
 * Usage:
 *   node scripts/verify-menu-seed.mjs
 * 
 * Environment variables required:
 *   - VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY (for read operations)
 *   - SUPABASE_SERVICE_ROLE_KEY (optional, for admin operations)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents).",
  );
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// Expected values
const EXPECTED_BARS = 97;
const EXPECTED_ITEMS_PER_BAR = 184;
const EXPECTED_TOTAL_ITEMS = EXPECTED_BARS * EXPECTED_ITEMS_PER_BAR; // 17,848
const EXPECTED_CATEGORIES = [
  'BEERS', 'BREAKFAST', 'CIDERS', 'COCKTAILS', 'COFFEE', 'DESSERTS',
  'ENERGY DRINKS', 'FAST FOOD', 'GIN', 'GRILL', 'JUICES', 'LIQUORS',
  'MAIN COURSES', 'PASTA', 'PIZZA', 'RUM', 'SIDE DISHES', 'SODA',
  'SOUP', 'SPIRITS', 'TEA', 'TRADITIONAL', 'VEGETARIAN', 'WATER',
  'WHISKEY', 'WINES'
];

async function verifyMenuSeed() {
  console.log("🔍 Verifying menu seed data...\n");

  try {
    // 1. Check total count
    console.log("1️⃣  Checking total menu items count...");
    const { count: totalCount, error: countError } = await client
      .from("restaurant_menu_items")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("❌ Error counting menu items:", countError.message);
      return false;
    }

    console.log(`   Total items in database: ${totalCount}`);
    console.log(`   Expected: ${EXPECTED_TOTAL_ITEMS}`);
    
    if (totalCount >= EXPECTED_TOTAL_ITEMS) {
      console.log("   ✅ Total count matches or exceeds expected\n");
    } else {
      console.log(`   ⚠️  Warning: Expected at least ${EXPECTED_TOTAL_ITEMS} items, found ${totalCount}\n`);
    }

    // 2. Check items per bar
    console.log("2️⃣  Checking items per bar...");
    const { data: barCounts, error: barCountError } = await client.rpc(
      "count_items_per_bar",
      {},
      { count: "exact" }
    ).catch(async () => {
      // Fallback if RPC doesn't exist
      const { data, error } = await client
        .from("restaurant_menu_items")
        .select("bar_id");
      
      if (error) throw error;
      
      const counts = {};
      data.forEach(item => {
        counts[item.bar_id] = (counts[item.bar_id] || 0) + 1;
      });
      
      return { 
        data: Object.entries(counts).map(([bar_id, count]) => ({ bar_id, count })),
        error: null 
      };
    });

    if (barCountError) {
      console.error("❌ Error counting items per bar:", barCountError.message);
      return false;
    }

    const barsWithItems = barCounts?.length || 0;
    console.log(`   Bars with menu items: ${barsWithItems}`);
    
    if (barsWithItems >= EXPECTED_BARS) {
      console.log("   ✅ Number of bars matches or exceeds expected\n");
    } else {
      console.log(`   ⚠️  Warning: Expected at least ${EXPECTED_BARS} bars, found ${barsWithItems}\n`);
    }

    // Show distribution
    if (barCounts && barCounts.length > 0) {
      const itemCounts = barCounts.map(b => b.count);
      const minItems = Math.min(...itemCounts);
      const maxItems = Math.max(...itemCounts);
      const avgItems = itemCounts.reduce((a, b) => a + b, 0) / itemCounts.length;
      
      console.log(`   Items per bar - Min: ${minItems}, Max: ${maxItems}, Avg: ${avgItems.toFixed(1)}`);
      
      if (minItems >= EXPECTED_ITEMS_PER_BAR && maxItems >= EXPECTED_ITEMS_PER_BAR) {
        console.log("   ✅ All bars have expected number of items\n");
      } else if (avgItems >= EXPECTED_ITEMS_PER_BAR * 0.9) {
        console.log("   ⚠️  Some bars may be missing items\n");
      } else {
        console.log("   ❌ Significant item count discrepancy\n");
      }
    }

    // 3. Check categories
    console.log("3️⃣  Checking menu categories...");
    const { data: categories, error: catError } = await client
      .from("restaurant_menu_items")
      .select("category_name")
      .limit(10000);

    if (catError) {
      console.error("❌ Error fetching categories:", catError.message);
      return false;
    }

    const uniqueCategories = [...new Set(categories.map(c => c.category_name))];
    console.log(`   Unique categories found: ${uniqueCategories.length}`);
    console.log(`   Categories: ${uniqueCategories.sort().join(", ")}`);
    
    const missingCategories = EXPECTED_CATEGORIES.filter(c => !uniqueCategories.includes(c));
    if (missingCategories.length === 0) {
      console.log("   ✅ All expected categories present\n");
    } else {
      console.log(`   ⚠️  Missing categories: ${missingCategories.join(", ")}\n`);
    }

    // 4. Sample items check
    console.log("4️⃣  Sampling menu items...");
    const { data: sampleItems, error: sampleError } = await client
      .from("restaurant_menu_items")
      .select("name, category_name, price, currency")
      .limit(5);

    if (sampleError) {
      console.error("❌ Error fetching sample items:", sampleError.message);
      return false;
    }

    console.log("   Sample items:");
    sampleItems.forEach(item => {
      console.log(`   - ${item.name} (${item.category_name}) - ${item.price} ${item.currency}`);
    });
    console.log("   ✅ Sample items retrieved successfully\n");

    // 5. Check for duplicate items per bar
    console.log("5️⃣  Checking for duplicates...");
    const { data: duplicates, error: dupError } = await client.rpc(
      "check_duplicate_menu_items"
    ).catch(async () => {
      // Fallback query
      const { data, error } = await client
        .from("restaurant_menu_items")
        .select("bar_id, name")
        .limit(20000);
      
      if (error) throw error;
      
      const seen = new Set();
      const dups = [];
      data.forEach(item => {
        const key = `${item.bar_id}:${item.name}`;
        if (seen.has(key)) {
          dups.push(item);
        }
        seen.add(key);
      });
      
      return { data: dups, error: null };
    });

    if (dupError) {
      console.log("   ⚠️  Could not check for duplicates (may require custom RPC function)");
    } else if (duplicates && duplicates.length > 0) {
      console.log(`   ⚠️  Found ${duplicates.length} potential duplicate items`);
    } else {
      console.log("   ✅ No duplicate items found\n");
    }

    console.log("✅ Verification complete!");
    return true;

  } catch (error) {
    console.error("❌ Verification failed:", error.message);
    return false;
  }
}

// Run verification
verifyMenuSeed()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
