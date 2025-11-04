/**
 * Quick test script to verify Quran lookup functionality
 * Run with: npx ts-node scripts/test_lookup.ts
 */

import { quranLookup } from '../utils/quran-lookup';

async function testLookup() {
  console.log('🧪 Testing Quran Lookup System\n');

  // Test words
  const testWords = [
    'ٱللَّهِ',      // Allah
    'ٱلرَّحْمَٰنِ',  // Ar-Rahman
    'ٱلرَّحِيمِ',   // Ar-Rahim
    'ٱلْحَمْدُ',    // Al-Hamdu
    'رَبِّ',       // Rabb
  ];

  for (const word of testWords) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Testing: ${word}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      const result = await quranLookup.lookup(word);

      if (result) {
        console.log(`✓ Word found!`);
        console.log(`  Lemma: ${result.lemma}`);
        console.log(`  Meaning: ${result.meaning}`);
        console.log(`  POS: ${result.pos}`);
        if (result.root) {
          console.log(`  Root: ${result.root}`);
        }
        console.log(`  Grammatical Info:`);
        result.grammaticalInfo.forEach(info => {
          console.log(`    • ${info}`);
        });
        if (result.relatedWords && result.relatedWords.length > 0) {
          console.log(`  Related Words:`);
          result.relatedWords.forEach(w => {
            console.log(`    • ${w.word} (${w.lemma})`);
          });
        }
      } else {
        console.log(`✗ Word not found`);
      }
    } catch (error) {
      console.error(`✗ Error:`, error);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Test complete!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

// Run test
testLookup().catch(console.error);
