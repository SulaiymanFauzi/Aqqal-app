import wordTranslationsData from '@/assets/quran-data/word-translations-english.json';

// Type for the word translations data structure
type WordTranslationsData = {
  [chapter: string]: {
    [verse: string]: string[][];
  };
};

const translations = wordTranslationsData as WordTranslationsData;

/**
 * Get word-by-word translations for a specific verse
 * @param chapter - Chapter number (1-114)
 * @param verse - Verse number
 * @returns Array of word translations, or null if not found
 */
export function getVerseWordTranslations(chapter: number, verse: number): string[] | null {
  const chapterData = translations[chapter.toString()];
  if (!chapterData) {
    return null;
  }

  const verseData = chapterData[verse.toString()];
  if (!verseData || verseData.length === 0) {
    return null;
  }

  // Return the first array (there's usually only one)
  return verseData[0];
}

/**
 * Get translation for a specific word in a verse
 * @param chapter - Chapter number (1-114)
 * @param verse - Verse number
 * @param wordIndex - Word index (0-based)
 * @returns Translation string, or null if not found
 */
export function getWordTranslation(
  chapter: number,
  verse: number,
  wordIndex: number
): string | null {
  const words = getVerseWordTranslations(chapter, verse);
  if (!words || wordIndex < 0 || wordIndex >= words.length) {
    return null;
  }

  return words[wordIndex];
}

/**
 * Parse a Quran verse reference from a markdown link
 * Examples: "Quran 1:2", "[Quran 1:2](https://quran.com/1/2)"
 * @param text - Text containing verse reference
 * @returns Object with chapter and verse, or null if not found
 */
export function parseVerseReference(text: string): { chapter: number; verse: number } | null {
  // Try to match "Quran X:Y" or "X:Y" patterns
  const match = text.match(/(?:Quran\s+)?(\d+):(\d+)/i);
  if (match) {
    return {
      chapter: parseInt(match[1], 10),
      verse: parseInt(match[2], 10),
    };
  }

  // Try to match URL pattern like "quran.com/1/2"
  const urlMatch = text.match(/quran\.com\/(\d+)\/(\d+)/i);
  if (urlMatch) {
    return {
      chapter: parseInt(urlMatch[1], 10),
      verse: parseInt(urlMatch[2], 10),
    };
  }

  return null;
}
