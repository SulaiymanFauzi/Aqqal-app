#!/usr/bin/env ts-node
/**
 * Clear the translation cache
 * Run this script when translations are showing stale/incorrect data
 * 
 * Usage: npx ts-node scripts/clear-translation-cache.ts
 */

import { clearTranslationCache } from '../utils/quran-lookup';

console.log('🗑️  Clearing translation cache...');
clearTranslationCache();
console.log('✅ Translation cache cleared successfully!');
console.log('');
console.log('The next time you look up a word, it will fetch a fresh translation from the LLM.');
