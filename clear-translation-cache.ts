/**
 * One-time script to clear translation cache
 * Run this in the app console or import and call it once
 */

import { quranLookup } from './utils/quran-lookup';

// Clear the translation cache
quranLookup.clearTranslationCache();

console.log('✅ Translation cache cleared! Restart the app to get fresh translations.');
