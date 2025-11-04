/**
 * Test script to simulate the TypeScript lookup logic
 */

const fs = require('fs');

// Load dictionary
const wordDict = JSON.parse(fs.readFileSync('assets/quran-data/word-dictionary.json', 'utf-8'));

// Strip diacritics function (matching TypeScript)
function stripDiacritics(text) {
  const normalized = text.normalize('NFC');
  return normalized
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove diacritics
    .replace(/\u0671/g, '\u0627') // Normalize alif wasla
    .replace(/\u0649/g, '\u064A'); // Normalize alif maksura
}

// Build stripped index
console.log('Building stripped index...');
const strippedIndex = new Map();
for (const word of Object.keys(wordDict)) {
  const stripped = stripDiacritics(word);
  if (!strippedIndex.has(stripped)) {
    strippedIndex.set(stripped, word);
  }
}

console.log(`✓ Loaded ${Object.keys(wordDict).length} words`);
console.log(`✓ Built stripped index with ${strippedIndex.size} entries`);

// Test lookup
const testWord = 'ٱلسَّمَٰوَٰتِ';

console.log('\n' + '='.repeat(80));
console.log('TESTING LOOKUP');
console.log('='.repeat(80));

console.log(`\n1. Input word: "${testWord}"`);
console.log(`   Length: ${testWord.length}`);
console.log(`   Bytes: ${Buffer.from(testWord, 'utf-8').toString('hex')}`);
console.log(`   Chars: ${Array.from(testWord).map(c => `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')}`);

// Normalize
const cleanWord = testWord.trim().normalize('NFC');
console.log(`\n2. After normalize('NFC'): "${cleanWord}"`);
console.log(`   Same as input: ${cleanWord === testWord}`);

// Try exact match
const exactMatch = wordDict[cleanWord];
console.log(`\n3. Exact match in dictionary: ${exactMatch ? '✓ FOUND' : '✗ NOT FOUND'}`);

// Try stripped match
const strippedWord = stripDiacritics(cleanWord);
console.log(`\n4. Stripped word: "${strippedWord}"`);
console.log(`   Bytes: ${Buffer.from(strippedWord, 'utf-8').toString('hex')}`);

const originalWord = strippedIndex.get(strippedWord);
console.log(`\n5. Found in stripped index: ${originalWord ? '✓ FOUND' : '✗ NOT FOUND'}`);

if (originalWord) {
  console.log(`   Original word: "${originalWord}"`);
  console.log(`   Has data: ${wordDict[originalWord] ? '✓ YES' : '✗ NO'}`);
  
  if (wordDict[originalWord]) {
    console.log(`\n6. Word data:`);
    console.log(JSON.stringify(wordDict[originalWord], null, 2));
  }
} else {
  // Debug: find what we have
  console.log(`\n6. Searching for similar entries in stripped index...`);
  let count = 0;
  for (const [stripped, original] of strippedIndex.entries()) {
    if (stripped.includes('سموت')) {
      console.log(`   "${stripped}" → "${original}"`);
      count++;
      if (count >= 5) break;
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log('RESULT: ' + (originalWord ? '✓ LOOKUP SHOULD WORK' : '✗ LOOKUP WILL FAIL'));
console.log('='.repeat(80));
