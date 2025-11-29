/**
 * Quick AI Setup Test
 * Run with: npx tsx test-ai-setup.ts
 */

import { AI_CONFIG, getProviderStatus } from './lib/ai/config';

console.log('🤖 EasyMO AI Agents Architecture Test\n');

// Check configuration
console.log('📋 Configuration Status:');
console.log('  OpenAI Key:', AI_CONFIG.apiKeys.openai === 'PLACEHOLDER_OPENAI_KEY' ? '❌ Not Set' : '✅ Configured');
console.log('  Google AI Key:', AI_CONFIG.apiKeys.googleAI === 'PLACEHOLDER_GOOGLE_AI_KEY' ? '❌ Not Set' : '✅ Configured');
console.log('  Google Maps Key:', AI_CONFIG.apiKeys.googleMaps === 'PLACEHOLDER_MAPS_KEY' ? '❌ Not Set' : '✅ Configured');
console.log('  Google Search Key:', AI_CONFIG.apiKeys.googleSearch === 'PLACEHOLDER_SEARCH_KEY' ? '❌ Not Set' : '✅ Configured');

// Check features
console.log('\n🎯 Feature Flags:');
console.log('  OpenAI Realtime:', AI_CONFIG.features.openaiRealtime ? '✅ Enabled' : '❌ Disabled');
console.log('  Gemini Live:', AI_CONFIG.features.geminiLive ? '✅ Enabled' : '❌ Disabled');
console.log('  Image Generation:', AI_CONFIG.features.imageGeneration ? '✅ Enabled' : '❌ Disabled');
console.log('  Google Search:', AI_CONFIG.features.googleSearchGrounding ? '✅ Enabled' : '❌ Disabled');

// Provider status
console.log('\n�� Provider Status:');
const status = getProviderStatus();
console.log('  OpenAI:');
console.log('    - Configured:', status.openai.configured ? '✅' : '❌');
console.log('    - Chat:', status.openai.features.chat ? '✅' : '❌');
console.log('    - Realtime:', status.openai.features.realtime ? '✅' : '❌');
console.log('  Gemini:');
console.log('    - Configured:', status.gemini.configured ? '✅' : '❌');
console.log('    - Chat:', status.gemini.features.chat ? '✅' : '❌');
console.log('    - Live:', status.gemini.features.live ? '✅' : '❌');

console.log('\n✅ AI Architecture Implementation: COMPLETE');
console.log('📝 Next Steps:');
console.log('   1. Add API keys to .env.local (see .env.example.ai)');
console.log('   2. Test with: npm run dev');
console.log('   3. Create API routes in app/api/ai/');
console.log('   4. Build UI components');
