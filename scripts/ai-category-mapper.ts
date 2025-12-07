#!/usr/bin/env node
/**
 * AI-Powered Business Category Mapping
 * 
 * This script uses OpenAI and Google Gemini to intelligently map Google Maps
 * business categories to buy_sell_categories, then updates the businesses table
 * with proper categorization.
 * 
 * Strategy:
 * 1. Extract all unique GM categories from businesses table
 * 2. Get all buy_sell_categories
 * 3. Use AI to create intelligent mappings
 * 4. Add new columns: gm_category, buy_sell_category, buy_sell_category_id
 * 5. Migrate data with proper categorization
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.1.3';

// Configuration
const SUPABASE_URL = 'https://lhbowpbcpwoiparwnwgt.supabase.co';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

interface BuySellCategory {
  id: string;
  google_maps_category: string;
  name: string;
  icon: string;
  order_index: number;
  is_active: boolean;
}

interface GMCategory {
  category: string;
  count: number;
}

interface CategoryMapping {
  gm_category: string;
  buy_sell_category_id: string;
  buy_sell_category_name: string;
  confidence: number;
  reasoning: string;
}

/**
 * Get all buy_sell_categories from database
 */
async function getBuySellCategories(): Promise<BuySellCategory[]> {
  const { data, error } = await supabase
    .from('buy_sell_categories')
    .select('*')
    .eq('is_active', true)
    .order('order_index');
  
  if (error) throw error;
  return data || [];
}

/**
 * Get all unique Google Maps categories from businesses
 */
async function getGMCategories(): Promise<GMCategory[]> {
  const { data, error } = await supabase.rpc('get_unique_categories');
  
  if (error) {
    // Fallback: get directly
    const { data: businesses } = await supabase
      .from('businesses')
      .select('category')
      .not('category', 'is', null);
    
    const categoryCounts = new Map<string, number>();
    businesses?.forEach(b => {
      const cat = b.category.trim().toLowerCase();
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    });
    
    return Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }
  
  return data || [];
}

/**
 * Use OpenAI to create intelligent category mappings
 */
async function mapCategoriesWithOpenAI(
  gmCategories: GMCategory[],
  buySellCategories: BuySellCategory[]
): Promise<CategoryMapping[]> {
  console.log('🤖 Using OpenAI GPT-4 for category mapping...');
  
  const prompt = `You are a business categorization expert. Map Google Maps business categories to standardized buy/sell categories.

BUY/SELL CATEGORIES (target):
${buySellCategories.map(c => `- ${c.name} (${c.google_maps_category}) - ${c.icon}`).join('\n')}

GOOGLE MAPS CATEGORIES (source - ${gmCategories.length} categories):
${gmCategories.map(c => `- ${c.category} (${c.count} businesses)`).join('\n')}

TASK: For each Google Maps category, determine the BEST buy/sell category match.

RULES:
1. Match based on business type, not just name similarity
2. Consider: "bar", "cafe", "restaurant", "bakery" → "Bars & Restaurants"
3. Consider: "salon", "barbershop", "beauty salon", "spa", "nail salon" → "Salons & Barbers"
4. Consider: "pharmacy", "clinic", "hospital", "doctor", "dentist" → "Hospitals & Clinics" OR "Pharmacies"
5. Consider: "hotel", "lodge", "motel", "hostel", "resort", "guest house" → "Hotels & Lodging"
6. Consider: "school", "college", "university", "kindergarten", "tutoring" → "Schools & Education"
7. Consider: "electronics store", "phone shop", "computer store" → "Electronics"
8. Consider: "clothing store", "boutique", "fashion" → "Fashion & Clothing"
9. Consider: "supermarket", "grocery store", "convenience store", "market" → "Groceries & Supermarkets"
10. Be precise - don't force categories that don't fit

Return JSON array:
[
  {
    "gm_category": "original category name",
    "buy_sell_category_id": "uuid",
    "buy_sell_category_name": "category name",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation"
  }
]`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content || '{}';
  const result = JSON.parse(content);
  return result.mappings || [];
}

/**
 * Use Google Gemini to verify and improve mappings
 */
async function verifyWithGemini(
  mappings: CategoryMapping[],
  gmCategories: GMCategory[],
  buySellCategories: BuySellCategory[]
): Promise<CategoryMapping[]> {
  console.log('🔍 Verifying with Google Gemini...');
  
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  
  const prompt = `Review and improve these business category mappings. Ensure accuracy.

ORIGINAL MAPPINGS:
${JSON.stringify(mappings, null, 2)}

BUY/SELL CATEGORIES:
${buySellCategories.map(c => `${c.id}: ${c.name} (${c.google_maps_category})`).join('\n')}

Verify each mapping is correct. Fix any mistakes. Return improved JSON array with same structure.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  return mappings; // Return original if parsing fails
}

/**
 * Create database migration
 */
async function createMigration(mappings: CategoryMapping[]): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const filename = `${timestamp}_map_business_categories.sql`;
  
  const sql = `-- Migration: Map Google Maps categories to buy_sell_categories
-- Generated: ${new Date().toISOString()}
-- Mappings: ${mappings.length} categories

BEGIN;

-- Add new columns if they don't exist
ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS gm_category TEXT,
  ADD COLUMN IF NOT EXISTS buy_sell_category TEXT,
  ADD COLUMN IF NOT EXISTS buy_sell_category_id UUID REFERENCES buy_sell_categories(id);

-- Rename existing category to gm_category (preserve original)
UPDATE businesses 
SET gm_category = LOWER(TRIM(category))
WHERE gm_category IS NULL AND category IS NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_businesses_gm_category ON businesses(gm_category);
CREATE INDEX IF NOT EXISTS idx_businesses_buy_sell_category_id ON businesses(buy_sell_category_id);

-- Update mappings based on AI analysis
${mappings.map(m => `
-- ${m.gm_category} → ${m.buy_sell_category_name} (confidence: ${(m.confidence * 100).toFixed(0)}%)
-- Reasoning: ${m.reasoning}
UPDATE businesses
SET 
  buy_sell_category = '${m.buy_sell_category_name}',
  buy_sell_category_id = '${m.buy_sell_category_id}'::uuid
WHERE LOWER(TRIM(gm_category)) = '${m.gm_category.toLowerCase()}'
  AND buy_sell_category_id IS NULL;
`).join('\n')}

-- Verification query
SELECT 
  buy_sell_category,
  COUNT(*) as business_count,
  COUNT(DISTINCT gm_category) as gm_categories_mapped
FROM businesses
WHERE buy_sell_category IS NOT NULL
GROUP BY buy_sell_category
ORDER BY business_count DESC;

COMMIT;

-- Post-migration verification
SELECT 
  COUNT(*) as total_businesses,
  COUNT(buy_sell_category_id) as mapped_businesses,
  COUNT(*) - COUNT(buy_sell_category_id) as unmapped_businesses,
  ROUND(COUNT(buy_sell_category_id)::numeric / COUNT(*)::numeric * 100, 2) as mapping_percentage
FROM businesses;
`;

  return sql;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting AI-Powered Business Category Mapping\n');
  
  try {
    // Step 1: Get data
    console.log('📊 Step 1: Fetching data from database...');
    const [buySellCategories, gmCategories] = await Promise.all([
      getBuySellCategories(),
      getGMCategories()
    ]);
    
    console.log(`✓ Found ${buySellCategories.length} buy/sell categories`);
    console.log(`✓ Found ${gmCategories.length} Google Maps categories`);
    console.log(`✓ Total businesses: ${gmCategories.reduce((sum, c) => sum + c.count, 0)}\n`);
    
    // Step 2: AI Mapping with OpenAI
    console.log('📊 Step 2: Creating mappings with OpenAI...');
    let mappings = await mapCategoriesWithOpenAI(gmCategories, buySellCategories);
    console.log(`✓ Created ${mappings.length} mappings\n`);
    
    // Step 3: Verify with Gemini
    console.log('📊 Step 3: Verifying with Google Gemini...');
    mappings = await verifyWithGemini(mappings, gmCategories, buySellCategories);
    console.log(`✓ Verified ${mappings.length} mappings\n`);
    
    // Step 4: Filter high-confidence mappings
    const highConfidence = mappings.filter(m => m.confidence >= 0.7);
    const mediumConfidence = mappings.filter(m => m.confidence >= 0.5 && m.confidence < 0.7);
    const lowConfidence = mappings.filter(m => m.confidence < 0.5);
    
    console.log('📊 Confidence Distribution:');
    console.log(`  High (≥70%): ${highConfidence.length} mappings`);
    console.log(`  Medium (50-69%): ${mediumConfidence.length} mappings`);
    console.log(`  Low (<50%): ${lowConfidence.length} mappings\n`);
    
    // Step 5: Show sample mappings
    console.log('📋 Sample Mappings (High Confidence):');
    highConfidence.slice(0, 10).forEach(m => {
      console.log(`  ${m.gm_category} → ${m.buy_sell_category_name} (${(m.confidence * 100).toFixed(0)}%)`);
    });
    console.log('');
    
    // Step 6: Create migration
    console.log('📊 Step 4: Generating migration SQL...');
    const sql = await createMigration(highConfidence);
    
    // Save to file
    const filename = `category_mapping_${Date.now()}.sql`;
    await Deno.writeTextFile(filename, sql);
    console.log(`✓ Migration saved to: ${filename}\n`);
    
    // Step 7: Save mappings report
    const report = {
      generated_at: new Date().toISOString(),
      total_gm_categories: gmCategories.length,
      total_buy_sell_categories: buySellCategories.length,
      mappings: {
        high_confidence: highConfidence,
        medium_confidence: mediumConfidence,
        low_confidence: lowConfidence
      },
      statistics: {
        total_mappings: mappings.length,
        high_confidence_count: highConfidence.length,
        medium_confidence_count: mediumConfidence.length,
        low_confidence_count: lowConfidence.length,
        avg_confidence: mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length
      }
    };
    
    const reportFilename = `category_mapping_report_${Date.now()}.json`;
    await Deno.writeTextFile(reportFilename, JSON.stringify(report, null, 2));
    console.log(`✓ Report saved to: ${reportFilename}\n`);
    
    // Summary
    console.log('✅ AI-Powered Category Mapping Complete!\n');
    console.log('Next Steps:');
    console.log('1. Review the generated SQL migration file');
    console.log('2. Check the mapping report for accuracy');
    console.log('3. Run the migration: psql -f ' + filename);
    console.log('4. Verify results with post-migration queries\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    Deno.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}
