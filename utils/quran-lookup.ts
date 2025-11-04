/**
 * Quran Word Lookup Utilities
 * Provides fast lookup for Arabic words from the Quranic corpus
 */

export interface WordData {
  lemma: string;
  lemma_transliteration: string;
  root: string | null;
  root_transliteration: string | null;
  pos: string | null;
  pos_description?: string; // Human-readable POS description
  count: number;
  locations: string[];
  // Morphology - Person, Gender, Number
  gender?: 'M' | 'F';
  number?: 'S' | 'P' | 'D';
  person?: '1' | '2' | '3';
  // Nominal features
  case?: 'NOM' | 'GEN' | 'ACC';
  state?: 'DEF' | 'INDEF';
  // Verb features
  aspect?: 'PERF' | 'IMPF' | 'IMPV';
  mood?: 'IND' | 'SUBJ' | 'JUS';
  voice?: 'ACT' | 'PASS';
  form?: string; // Verb form (I, II, III, IV, etc.)
  // Derivation
  derivation?: 'ACT PCPL' | 'PASS PCPL' | 'VN';
  // Special tags
  special?: string;
  // Affixes
  prefix?: string; // Prefixed particles (P, CONJ, etc.)
  suffix?: string; // Suffixed pronouns (PRON, etc.)
}

export interface RootData {
  root_transliteration: string;
  total_occurrences: number;
  unique_words: number;
  words: Array<{
    word: string;
    lemma: string;
    count: number;
  }>;
}

export interface WordLookupResult {
  word: string;
  lemma: string;
  lemma_transliteration?: string;
  root: string | null;
  root_transliteration?: string | null;
  meaning: string;
  pos: string;
  grammaticalInfo: string[];
  relatedWords?: Array<{
    word: string;
    lemma: string;
  }>;
  morphology?: {
    hasPrefix: boolean;
    hasSuffix: boolean;
  };
  // Raw morphological data for detailed display
  rawData?: {
    prefix?: string;
    suffix?: string;
    gender?: 'M' | 'F';
    number?: 'S' | 'P' | 'D';
    person?: '1' | '2' | '3';
    case?: 'NOM' | 'GEN' | 'ACC';
    state?: 'DEF' | 'INDEF';
    aspect?: 'PERF' | 'IMPF' | 'IMPV';
    mood?: 'IND' | 'SUBJ' | 'JUS';
    voice?: 'ACT' | 'PASS';
    form?: string;
    derivation?: 'ACT PCPL' | 'PASS PCPL' | 'VN';
    special?: string;
    count: number;
    locations: string[];
  };
}

// POS tag to readable name (based on Quranic Arabic Corpus tagset)
const POS_NAMES: Record<string, string> = {
  // Nouns
  'N': 'Noun',
  'PN': 'Proper Noun',
  // Derived nominals
  'ADJ': 'Adjective',
  'IMPN': 'Imperative Verbal Noun',
  // Pronouns
  'PRON': 'Pronoun',
  'DEM': 'Demonstrative Pronoun',
  'REL': 'Relative Pronoun',
  // Adverbs
  'T': 'Time Adverb',
  'LOC': 'Location Adverb',
  // Verbs
  'V': 'Verb',
  // Prepositions
  'P': 'Preposition',
  // lām Prefixes
  'EMPH': 'Emphatic Lām',
  'IMPV': 'Imperative Lām',
  'PRP': 'Purpose Lām',
  // Conjunctions
  'CONJ': 'Conjunction',
  'SUB': 'Subordinating Conjunction',
  // Particles
  'ACC': 'Accusative Particle',
  'AMD': 'Amendment Particle',
  'ANS': 'Answer Particle',
  'AVR': 'Aversion Particle',
  'CAUS': 'Particle of Cause',
  'CERT': 'Particle of Certainty',
  'CIRC': 'Circumstantial Particle',
  'COM': 'Comitative Particle',
  'COND': 'Conditional Particle',
  'EQ': 'Equalization Particle',
  'EXH': 'Exhortation Particle',
  'EXL': 'Explanation Particle',
  'EXP': 'Exceptive Particle',
  'FUT': 'Future Particle',
  'INC': 'Inceptive Particle',
  'INT': 'Particle of Interpretation',
  'INTG': 'Interrogative Particle',
  'NEG': 'Negative Particle',
  'PREV': 'Preventive Particle',
  'PRO': 'Prohibition Particle',
  'REM': 'Resumption Particle',
  'RES': 'Restriction Particle',
  'RET': 'Retraction Particle',
  'RSLT': 'Result Particle',
  'SUP': 'Supplemental Particle',
  'SUR': 'Surprise Particle',
  'VOC': 'Vocative Particle',
  // Disconnected Letters
  'INL': 'Quranic Initials',
};

// Morphology labels
const GENDER_LABELS: Record<string, string> = {
  'M': 'Masculine',
  'F': 'Feminine',
};

const NUMBER_LABELS: Record<string, string> = {
  'S': 'Singular',
  'P': 'Plural',
  'D': 'Dual',
};

const CASE_LABELS: Record<string, string> = {
  'NOM': 'Nominative',
  'GEN': 'Genitive',
  'ACC': 'Accusative',
};

const PERSON_LABELS: Record<string, string> = {
  '1': '1st person',
  '2': '2nd person',
  '3': '3rd person',
};

const ASPECT_LABELS: Record<string, string> = {
  'PERF': 'Perfect (past)',
  'IMPF': 'Imperfect (present/future)',
  'IMPV': 'Imperative (command)',
};

const MOOD_LABELS: Record<string, string> = {
  'IND': 'Indicative',
  'SUBJ': 'Subjunctive',
  'JUS': 'Jussive',
};

const VOICE_LABELS: Record<string, string> = {
  'ACT': 'Active voice',
  'PASS': 'Passive voice',
};

const STATE_LABELS: Record<string, string> = {
  'DEF': 'Definite',
  'INDEF': 'Indefinite',
};

const DERIVATION_LABELS: Record<string, string> = {
  'ACT PCPL': 'Active participle',
  'PASS PCPL': 'Passive participle',
  'VN': 'Verbal noun',
};

const PREFIX_LABELS: Record<string, string> = {
  // Simple prefixes
  'Al': 'definite article (al)',
  'bi': 'preposition (bi)',
  'ka': 'preposition (ka)',
  'ta': 'oath particle (ta)',
  'sa': 'future particle (sa)',
  'ya': 'vocative (ya)',
  'ha': 'vocative (ha)',
  // Alif particles
  'A:INTG': 'interrogative (alif)',
  'A:EQ': 'equalization (alif)',
  // Wāw particles
  'w:CONJ': 'conjunction (wa)',
  'w:REM': 'resumption (wa)',
  'w:CIRC': 'circumstantial (wa)',
  'w:SUP': 'supplemental (wa)',
  'w:P': 'oath (wa)',
  'w:COM': 'comitative (wa)',
  // Fa particles
  'f:REM': 'resumption (fa)',
  'f:CONJ': 'conjunction (fa)',
  'f:RSLT': 'result (fa)',
  'f:SUP': 'supplemental (fa)',
  'f:CAUS': 'cause (fa)',
  // Lām particles
  'l:P': 'preposition (lam)',
  'l:EMPH': 'emphatic (lam)',
  'l:PRP': 'purpose (lam)',
  'l:IMPV': 'imperative (lam)',
  // Generic fallbacks
  'P': 'preposition',
  'CONJ': 'conjunction',
};

const SUFFIX_LABELS: Record<string, string> = {
  'VOC': 'vocative',
  'n:EMPH': 'emphatic nun',
};

// Note: Prefix/suffix detection removed as we don't have morphological segmentation data
// The Quranic corpus has detailed segment-level POS tags, but our dictionary only has word-level data

/**
 * Remove Arabic diacritics (tashkeel) for matching
 * Also normalizes alif wasla, alif maksura, and alif variations
 */
function stripDiacritics(text: string): string {
  // Normalize Unicode first (NFC = Canonical Composition)
  let normalized = text.normalize('NFC');
  
  // First remove all diacritics (including superscript alif ٰ)
  normalized = normalized.replace(/[\u064B-\u065F\u0670]/g, '');
  
  // Normalize alif wasla (ٱ) to regular alif (ا)
  normalized = normalized.replace(/\u0671/g, '\u0627');
  
  // Normalize alif maksura (ى) to ya (ي)
  normalized = normalized.replace(/\u0649/g, '\u064A');
  
  // Remove alif when it's a long vowel (after consonants, not at start of word)
  // This handles both ماوات (with alif) and موت (without alif) matching
  normalized = normalized.replace(/([بتثجحخدذرزسشصضطظعغفقكلمنهوي])ا/g, '$1');
  
  return normalized;
}

class QuranLookup {
  private wordDictionary: Map<string, WordData> | null = null;
  private rootIndex: Map<string, RootData> | null = null;
  private strippedIndex: Map<string, string> | null = null; // stripped -> original word
  private translationCache: Map<string, string> = new Map(); // word -> English translation
  private loading: Promise<void> | null = null;

  /**
   * Clear the translation cache
   */
  clearTranslationCache(): void {
    this.translationCache.clear();
    console.log('🗑️ Translation cache cleared');
  }

  /**
   * Initialize the lookup system by loading the data
   */
  async initialize(): Promise<void> {
    if (this.loading) {
      return this.loading;
    }

    if (this.wordDictionary && this.rootIndex) {
      return;
    }

    this.loading = this.loadData();
    await this.loading;
    this.loading = null;
  }

  private async loadData(): Promise<void> {
    try {
      // Load word dictionary
      const wordDict = require('@/assets/quran-data/word-dictionary.json');
      this.wordDictionary = new Map(Object.entries(wordDict));

      // Load root index
      const rootIdx = require('@/assets/quran-data/root-index.json');
      this.rootIndex = new Map(Object.entries(rootIdx));

      // Build stripped index for diacritic-insensitive lookup
      this.strippedIndex = new Map();
      let debugCount = 0;
      for (const word of this.wordDictionary.keys()) {
        const stripped = stripDiacritics(word);
        // Store first occurrence (most common form usually)
        if (!this.strippedIndex.has(stripped)) {
          this.strippedIndex.set(stripped, word);
          
          // Debug: log first few entries with 'سموت'
          if (debugCount < 5 && stripped.includes('سموت')) {
            console.log(`📚 [INDEX] "${stripped}" → "${word}"`);
            debugCount++;
          }
        }
      }

      console.log(`✓ Loaded ${this.wordDictionary.size} words and ${this.rootIndex.size} roots`);
      console.log(`✓ Built stripped index with ${this.strippedIndex.size} entries`);
    } catch (error) {
      console.error('Failed to load Quran data:', error);
      throw error;
    }
  }

  /**
   * Look up a word and return detailed information
   */
  async lookup(word: string): Promise<WordLookupResult | null> {
    await this.initialize();

    if (!this.wordDictionary) {
      return null;
    }

    // Clean and normalize the word (handle Unicode variations)
    const cleanWord = word.trim().normalize('NFC');
    
    console.log(`🔍 [LOOKUP] Input: "${word}"`);
    console.log(`🔍 [LOOKUP] Cleaned: "${cleanWord}"`);
    console.log(`🔍 [LOOKUP] Bytes: ${Array.from(cleanWord).map(c => c.charCodeAt(0).toString(16)).join(' ')}`);
    
    // Try exact match first
    let wordData = this.wordDictionary.get(cleanWord);
    let matchedWord = cleanWord;
    
    console.log(`🔍 [LOOKUP] Exact match: ${wordData ? '✓' : '✗'}`);
    
    // If not found, try without diacritics using the stripped index
    if (!wordData && this.strippedIndex) {
      const strippedWord = stripDiacritics(cleanWord);
      console.log(`🔍 [LOOKUP] Stripped: "${strippedWord}"`);
      console.log(`🔍 [LOOKUP] Stripped bytes: ${Array.from(strippedWord).map(c => c.charCodeAt(0).toString(16)).join(' ')}`);
      
      const originalWord = this.strippedIndex.get(strippedWord);
      console.log(`🔍 [LOOKUP] Found in stripped index: ${originalWord ? '✓' : '✗'}`);
      
      if (originalWord) {
        console.log(`🔍 [LOOKUP] Original word: "${originalWord}"`);
        wordData = this.wordDictionary.get(originalWord);
        matchedWord = originalWord;
      }
    }

    if (!wordData) {
      console.log(`🔍 [LOOKUP] Final result: NOT FOUND`);
      return null;
    }
    
    console.log(`🔍 [LOOKUP] Final result: FOUND (${matchedWord})`)

    // Get meaning
    const meaning = this.getMeaning(wordData);

    // Get POS name - prefer pos_description from data, fallback to POS_NAMES mapping
    const pos = wordData.pos_description || 
                (wordData.pos ? POS_NAMES[wordData.pos] || wordData.pos : 'Word');

    // Build grammatical info
    const grammaticalInfo: string[] = [];
    
    // Add morphology
    const morphology = this.formatMorphology(wordData, word);
    if (morphology.length > 0) {
      grammaticalInfo.push(...morphology);
    }
    
    if (wordData.root) {
      grammaticalInfo.push(`Root: ${wordData.root} (${wordData.root_transliteration})`);
    }
    if (wordData.count > 1) {
      grammaticalInfo.push(`Appears ${wordData.count} times in the Quran`);
    }

    // Get related words from same root
    let relatedWords: Array<{ word: string; lemma: string }> | undefined;
    if (wordData.root && this.rootIndex) {
      const rootData = this.rootIndex.get(wordData.root);
      if (rootData && rootData.words.length > 1) {
        relatedWords = rootData.words
          .filter(w => w.word !== cleanWord)
          .slice(0, 5)
          .map(w => ({
            word: w.word,
            lemma: w.lemma,
          }));
      }
    }

    // Only use affix data if it exists in the dictionary
    // Don't try to detect automatically as it leads to false positives
    const hasPrefix = !!wordData.prefix;
    const hasSuffix = !!wordData.suffix;

    return {
      word,
      lemma: wordData.lemma,
      lemma_transliteration: wordData.lemma_transliteration,
      root: wordData.root,
      root_transliteration: wordData.root_transliteration,
      meaning,
      pos,
      grammaticalInfo,
      relatedWords,
      morphology: {
        hasPrefix,
        hasSuffix,
      },
      // Include raw morphological data for detailed display
      rawData: {
        prefix: wordData.prefix,
        suffix: wordData.suffix,
        gender: wordData.gender,
        number: wordData.number,
        person: wordData.person,
        case: wordData.case,
        state: wordData.state,
        aspect: wordData.aspect,
        mood: wordData.mood,
        voice: wordData.voice,
        form: wordData.form,
        derivation: wordData.derivation,
        special: wordData.special,
        count: wordData.count,
        locations: wordData.locations,
      },
    };
  }

  /**
   * Detect common prefixes and suffixes from the word itself
   */
  private detectAffixes(word: string): { prefix?: string; suffix?: string } {
    const affixes: { prefix?: string; suffix?: string } = {};
    
    // Strip diacritics to check word length
    const strippedWord = word.replace(/[\u064B-\u065F\u0670]/g, '');
    
    // Common prefixes (ل = lām, و = wāw, ف = fā, ب = bā)
    // Only detect if word is longer than 2 letters (to avoid standalone prepositions like فِي)
    if (strippedWord.length > 2) {
      if (word.startsWith('ل')) affixes.prefix = 'P'; // Preposition lām
      else if (word.startsWith('و')) affixes.prefix = 'CONJ'; // Conjunction wāw
      else if (word.startsWith('ف')) affixes.prefix = 'CONJ'; // Conjunction fā
      else if (word.startsWith('ب')) affixes.prefix = 'P'; // Preposition bā
    }
    
    // Common pronoun suffixes
    if (word.endsWith('هُمَا')) {
      affixes.suffix = 'PRON:3MD'; // 3rd person masculine dual
    } else if (word.endsWith('هُمَا')) {
      affixes.suffix = 'PRON:3FD'; // 3rd person feminine dual (same form)
    } else if (word.endsWith('هُم') || word.endsWith('هُمْ')) {
      affixes.suffix = 'PRON:3MP'; // 3rd person masculine plural
    } else if (word.endsWith('هُنَّ')) {
      affixes.suffix = 'PRON:3FP'; // 3rd person feminine plural
    } else if (word.endsWith('هُ') || word.endsWith('هُۥ') || word.endsWith('هِ')) {
      affixes.suffix = 'PRON:3MS'; // 3rd person masculine singular
    } else if (word.endsWith('هَا')) {
      affixes.suffix = 'PRON:3FS'; // 3rd person feminine singular
    } else if (word.endsWith('كُمَا')) {
      affixes.suffix = 'PRON:2MD'; // 2nd person masculine dual
    } else if (word.endsWith('كُم') || word.endsWith('كُمْ')) {
      affixes.suffix = 'PRON:2MP'; // 2nd person masculine plural
    } else if (word.endsWith('كُنَّ')) {
      affixes.suffix = 'PRON:2FP'; // 2nd person feminine plural
    } else if (word.endsWith('كَ')) {
      affixes.suffix = 'PRON:2MS'; // 2nd person masculine singular
    } else if (word.endsWith('كِ')) {
      affixes.suffix = 'PRON:2FS'; // 2nd person feminine singular
    }
    
    return affixes;
  }

  /**
   * Format morphology features into readable strings
   */
  private formatMorphology(wordData: WordData, word: string): string[] {
    const features: string[] = [];
    
    // Only use prefix/suffix if it exists in the dictionary data
    const prefix = wordData.prefix;
    const suffix = wordData.suffix;
    
    // Prefix (preposition, conjunction, etc.)
    if (prefix) {
      const prefixLabel = PREFIX_LABELS[prefix] || prefix;
      features.push(`Prefixed ${prefixLabel}`);
    }
    
    // Gender + Number
    const genderNumber: string[] = [];
    if (wordData.gender) {
      genderNumber.push(GENDER_LABELS[wordData.gender]);
    }
    if (wordData.number) {
      genderNumber.push(NUMBER_LABELS[wordData.number]);
    }
    if (genderNumber.length > 0) {
      features.push(genderNumber.join(' '));
    }
    
    // Case
    if (wordData.case) {
      features.push(CASE_LABELS[wordData.case]);
    }
    
    // Person (for verbs/pronouns)
    if (wordData.person) {
      features.push(PERSON_LABELS[wordData.person]);
    }
    
    // Aspect (for verbs)
    if (wordData.aspect) {
      features.push(ASPECT_LABELS[wordData.aspect]);
    }
    
    // Mood (for verbs)
    if (wordData.mood) {
      features.push(MOOD_LABELS[wordData.mood]);
    }
    
    // Voice (for verbs)
    if (wordData.voice) {
      features.push(VOICE_LABELS[wordData.voice]);
    }
    
    // State (for nominals)
    if (wordData.state) {
      features.push(STATE_LABELS[wordData.state]);
    }
    
    // Derivation
    if (wordData.derivation) {
      features.push(DERIVATION_LABELS[wordData.derivation] || wordData.derivation);
    }
    
    // Special tags
    if (wordData.special) {
      features.push(`Special: ${wordData.special}`);
    }
    
    // Verb form
    if (wordData.form) {
      features.push(`Form ${wordData.form}`);
    }
    
    // Suffix (pronoun, etc.)
    if (suffix) {
      if (suffix.startsWith('PRON:')) {
        // Parse pronoun details (e.g., "PRON:3MD" -> "3rd person masculine dual pronoun")
        const pronounDetails = suffix.split(':')[1];
        const person = pronounDetails[0]; // 1, 2, or 3
        const gender = pronounDetails[1]; // M or F
        const number = pronounDetails[2]; // S, D, or P
        
        const personLabel = PERSON_LABELS[person] || person;
        const genderLabel = gender === 'M' ? 'masculine' : gender === 'F' ? 'feminine' : '';
        const numberLabel = number === 'S' ? 'singular' : number === 'D' ? 'dual' : number === 'P' ? 'plural' : '';
        
        const parts = [personLabel, genderLabel, numberLabel, 'pronoun'].filter(Boolean);
        features.push(parts.join(' '));
      } else {
        const suffixLabel = SUFFIX_LABELS[suffix] || suffix;
        features.push(`Suffixed ${suffixLabel}`);
      }
    }
    
    return features;
  }

  /**
   * Get meaning for a word (from lemma)
   */
  private getMeaning(wordData: WordData): string {
    return wordData.lemma;
  }

  /**
   * Get English translation for a word using LLM (with caching)
   */
  async getEnglishMeaning(
    word: string,
    wordData: WordData
  ): Promise<string> {
    // Check cache first
    if (this.translationCache.has(word)) {
      return this.translationCache.get(word)!;
    }

    // Use LLM for translation
    try {
      const { translateArabicWord } = await import('@/utils/api');
      
      // Build morphology string
      const morphInfo: string[] = [];
      if (wordData.gender) morphInfo.push(wordData.gender === 'M' ? 'masculine' : 'feminine');
      if (wordData.number) {
        const numMap = { 'S': 'singular', 'P': 'plural', 'D': 'dual' };
        morphInfo.push(numMap[wordData.number] || wordData.number);
      }
      if (wordData.person) morphInfo.push(`${wordData.person}rd person`);
      
      const translation = await translateArabicWord(
        word,
        wordData.lemma,
        wordData.root || undefined,
        wordData.pos || undefined,
        morphInfo.length > 0 ? morphInfo.join(', ') : undefined
      );
      
      // Check if translation is valid (not empty and not just the Arabic word back)
      // Also check if it contains Arabic characters (indicates LLM returned Arabic instead of English)
      const hasArabic = /[\u0600-\u06FF]/.test(translation);
      const isValid = translation && 
                      translation.trim() && 
                      translation !== word && 
                      translation !== wordData.lemma &&
                      !hasArabic;
      
      if (isValid) {
        // Cache the valid result
        console.log(`✅ [Translation] Cached: ${word} -> ${translation.substring(0, 50)}...`);
        this.translationCache.set(word, translation);
        return translation;
      } else {
        // Translation was empty, invalid, or contains Arabic - don't cache it
        console.warn(`⚠️ [Translation] Invalid for ${word}: ${translation?.substring(0, 50) || 'empty'}`);
        const posDesc = wordData.pos_description || wordData.pos || 'Word';
        const fallback = `${posDesc} from root ${wordData.root || 'unknown'}`;
        // Don't cache the fallback - allow retry on next lookup
        return fallback;
      }
    } catch (error) {
      console.error('Translation error:', error);
      // Fall back to descriptive message
      const posDesc = wordData.pos_description || wordData.pos || 'Word';
      return `${posDesc} from root ${wordData.root || 'unknown'}`;
    }
  }

  /**
   * Search for words by root
   */
  async searchByRoot(root: string): Promise<RootData | null> {
    await this.initialize();

    if (!this.rootIndex) {
      return null;
    }

    return this.rootIndex.get(root) || null;
  }

  /**
   * Check if a word exists in the dictionary
   */
  async hasWord(word: string): Promise<boolean> {
    await this.initialize();
    return this.wordDictionary?.has(word.trim()) || false;
  }
}

// Singleton instance
export const quranLookup = new QuranLookup();

/**
 * Quick lookup function for use in components
 */
export async function lookupArabicWord(word: string): Promise<WordLookupResult | null> {
  return quranLookup.lookup(word);
}

/**
 * Clear the translation cache
 * Useful when translations are showing incorrect/stale data
 */
export function clearTranslationCache(): void {
  quranLookup.clearTranslationCache();
}
