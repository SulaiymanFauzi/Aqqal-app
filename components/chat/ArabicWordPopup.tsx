import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { WordLookupResult } from '@/utils/quran-lookup';
import { lookupArabicWord, quranLookup } from '@/utils/quran-lookup';

interface ArabicWordPopupProps {
  word: string | null;
  onClose: () => void;
  onWordClick?: (word: string) => void;
}

// Helper function to get POS-specific colors
const getPOSColor = (pos: string) => {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    // Verbs
    'Verb': { bg: '#3b82f618', border: '#3b82f6', text: '#2563eb' },
    
    // Nouns
    'Noun': { bg: '#10b98118', border: '#10b981', text: '#059669' },
    'Proper noun': { bg: '#8b5cf618', border: '#8b5cf6', text: '#7c3aed' },
    'Proper Noun': { bg: '#8b5cf618', border: '#8b5cf6', text: '#7c3aed' },
    'Adjective': { bg: '#14b8a618', border: '#14b8a6', text: '#0d9488' },
    'Imperative verbal noun': { bg: '#10b98118', border: '#10b981', text: '#059669' },
    
    // Pronouns
    'Pronoun': { bg: '#f59e0b18', border: '#f59e0b', text: '#d97706' },
    'Personal pronoun': { bg: '#f59e0b18', border: '#f59e0b', text: '#d97706' },
    'Demonstrative pronoun': { bg: '#f59e0b18', border: '#f59e0b', text: '#d97706' },
    'Demonstrative Pronoun': { bg: '#f59e0b18', border: '#f59e0b', text: '#d97706' },
    'Relative pronoun': { bg: '#f59e0b18', border: '#f59e0b', text: '#d97706' },
    'Relative Pronoun': { bg: '#f59e0b18', border: '#f59e0b', text: '#d97706' },
    
    // Adverbs
    'Time adverb': { bg: '#a855f718', border: '#a855f7', text: '#9333ea' },
    'Location adverb': { bg: '#a855f718', border: '#a855f7', text: '#9333ea' },
    
    // Prepositions & Conjunctions
    'Preposition': { bg: '#ec489918', border: '#ec4899', text: '#db2777' },
    'Conjunction': { bg: '#06b6d418', border: '#06b6d4', text: '#0891b2' },
    'Coordinating conjunction': { bg: '#06b6d418', border: '#06b6d4', text: '#0891b2' },
    'Subordinating conjunction': { bg: '#06b6d418', border: '#06b6d4', text: '#0891b2' },
    
    // Particles (all types)
    'Particle': { bg: '#84cc1618', border: '#84cc16', text: '#65a30d' },
    'particle': { bg: '#84cc1618', border: '#84cc16', text: '#65a30d' },
    
    // Lām prefixes
    'lām': { bg: '#ec489918', border: '#ec4899', text: '#db2777' },
    'Emphatic lām': { bg: '#ec489918', border: '#ec4899', text: '#db2777' },
    'Imperative lām': { bg: '#ec489918', border: '#ec4899', text: '#db2777' },
    'Purpose lām': { bg: '#ec489918', border: '#ec4899', text: '#db2777' },
    
    // Disconnected Letters
    'Quranic initials': { bg: '#6366f118', border: '#6366f1', text: '#4f46e5' },
  };
  
  // Check for exact match first
  if (colors[pos]) {
    return colors[pos];
  }
  
  // Check for partial matches (e.g., "Accusative Particle" matches "Particle")
  for (const [key, value] of Object.entries(colors)) {
    if (pos.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return { bg: '#6b728018', border: '#6b7280', text: '#52525b' };
};

export function ArabicWordPopup({ word, onClose, onWordClick }: ArabicWordPopupProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [wordData, setWordData] = React.useState<WordLookupResult | null>(null);
  const [englishMeaning, setEnglishMeaning] = React.useState<string | null>(null);
  const [loadingTranslation, setLoadingTranslation] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  // Pulsing animation for loading dots
  const pulse1 = React.useRef(new Animated.Value(0.3)).current;
  const pulse2 = React.useRef(new Animated.Value(0.3)).current;
  const pulse3 = React.useRef(new Animated.Value(0.3)).current;

  // Glass morphism transition animation
  const glassOpacity = React.useRef(new Animated.Value(1)).current;
  const glassScale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (loadingTranslation) {
      // Create staggered pulsing animation
      const createPulse = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const anim1 = createPulse(pulse1, 0);
      const anim2 = createPulse(pulse2, 200);
      const anim3 = createPulse(pulse3, 400);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
      };
    }
  }, [loadingTranslation, pulse1, pulse2, pulse3]);

  // Animate popup when word changes
  React.useEffect(() => {
    if (word) {
      // Reset and animate in
      glassOpacity.setValue(0);
      glassScale.setValue(0.95);
      
      Animated.parallel([
        Animated.spring(glassOpacity, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(glassScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [word, glassOpacity, glassScale]);

  React.useEffect(() => {
    if (!word) {
      setWordData(null);
      setEnglishMeaning(null);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);
    setEnglishMeaning(null);

    lookupArabicWord(word)
      .then(async (data) => {
        console.log('📊 [POPUP] Word data received:', JSON.stringify(data, null, 2));
        setWordData(data);
        if (!data) {
          setError(true);
          return;
        }

        // Fetch English translation
        setLoadingTranslation(true);
        try {
          // Get the word data from dictionary for translation
          await quranLookup.initialize();
          const wordDict = (quranLookup as any).wordDictionary;
          const wordInfo = wordDict?.get(data.word);
          
          if (wordInfo) {
            const translation = await quranLookup.getEnglishMeaning(data.word, wordInfo);
            setEnglishMeaning(translation);
          }
        } catch (err) {
          console.error('Translation error:', err);
          // Keep the Arabic lemma as fallback
        } finally {
          setLoadingTranslation(false);
        }
      })
      .catch((err) => {
        console.error('Lookup error:', err);
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [word]);

  // Helper to extract a character with its diacritics
  const getCharWithDiacritics = (text: string, startIdx: number): string => {
    let result = text[startIdx];
    let idx = startIdx + 1;
    // Diacritics range: \u064B-\u065F, \u0670
    while (idx < text.length && /[\u064B-\u065F\u0670]/.test(text[idx])) {
      result += text[idx];
      idx++;
    }
    return result;
  };

  // Segment the word into prefix, stem, and suffix for color coding
  const segmentWord = (arabicWord: string, morphology?: { hasPrefix: boolean; hasSuffix: boolean }) => {
    const segments: Array<{ text: string; type: 'prefix' | 'stem' | 'suffix' }> = [];
    let idx = 0;
    
    // Strip diacritics for analysis
    const strippedWord = arabicWord.replace(/[\u064B-\u065F\u0670]/g, '');
    
    // Detect prefix - common Arabic prefixes (particles, conjunctions, prepositions)
    if (morphology?.hasPrefix) {
      // Check for 2-char prefixes first (Al, wa, fa, etc.)
      if (strippedWord.length >= 2) {
        const first2 = strippedWord.substring(0, 2);
        if (['ال', 'وا', 'فا', 'با', 'كا', 'لل'].includes(first2)) {
          const prefixChar = getCharWithDiacritics(arabicWord, 0);
          const prefixChar2 = getCharWithDiacritics(arabicWord, prefixChar.length);
          segments.push({ text: prefixChar + prefixChar2, type: 'prefix' });
          idx = prefixChar.length + prefixChar2.length;
        }
      }
      
      // If no 2-char prefix found, check for single char prefixes
      if (idx === 0 && strippedWord.length >= 1) {
        const firstChar = strippedWord[0];
        if (['و', 'ف', 'ب', 'ك', 'ل', 'أ', 'س', 'ي', 'ت', 'ن'].includes(firstChar)) {
          const prefixChar = getCharWithDiacritics(arabicWord, 0);
          segments.push({ text: prefixChar, type: 'prefix' });
          idx = prefixChar.length;
        }
      }
    }
    
    // Find suffix from the end
    let suffixStart = arabicWord.length;
    
    // Check for pronoun suffixes only if morphology indicates there's a suffix
    if (morphology?.hasSuffix) {
      // Check for multi-character suffixes first
      if (strippedWord.endsWith('هما')) {
        const hIndex = arabicWord.lastIndexOf('ه');
        if (hIndex !== -1) suffixStart = hIndex;
      } else if (strippedWord.endsWith('كما')) {
        const kIndex = arabicWord.lastIndexOf('ك');
        if (kIndex !== -1) suffixStart = kIndex;
      } else if (strippedWord.endsWith('تما')) {
        const tIndex = arabicWord.lastIndexOf('ت');
        if (tIndex !== -1) suffixStart = tIndex;
      } else if (strippedWord.endsWith('هم')) {
        const hIndex = arabicWord.lastIndexOf('ه');
        if (hIndex !== -1) suffixStart = hIndex;
      } else if (strippedWord.endsWith('كم')) {
        const kIndex = arabicWord.lastIndexOf('ك');
        if (kIndex !== -1) suffixStart = kIndex;
      } else if (strippedWord.endsWith('تم')) {
        const tIndex = arabicWord.lastIndexOf('ت');
        if (tIndex !== -1) suffixStart = tIndex;
      } else if (strippedWord.endsWith('هن')) {
        const hIndex = arabicWord.lastIndexOf('ه');
        if (hIndex !== -1) suffixStart = hIndex;
      } else if (strippedWord.endsWith('كن')) {
        const kIndex = arabicWord.lastIndexOf('ك');
        if (kIndex !== -1) suffixStart = kIndex;
      } else if (strippedWord.endsWith('تن')) {
        const tIndex = arabicWord.lastIndexOf('ت');
        if (tIndex !== -1) suffixStart = tIndex;
      } else if (strippedWord.endsWith('نا')) {
        const nIndex = arabicWord.lastIndexOf('ن');
        if (nIndex !== -1) suffixStart = nIndex;
      } else if (strippedWord.endsWith('ها')) {
        const hIndex = arabicWord.lastIndexOf('ه');
        if (hIndex !== -1) suffixStart = hIndex;
      } else if (strippedWord.endsWith('ني')) {
        const nIndex = arabicWord.lastIndexOf('ن');
        if (nIndex !== -1) suffixStart = nIndex;
      } else if (strippedWord.endsWith('وا')) {
        const wIndex = arabicWord.lastIndexOf('و');
        if (wIndex !== -1 && wIndex > idx) suffixStart = wIndex;
      } else if (strippedWord.endsWith('ان')) {
        const aIndex = arabicWord.lastIndexOf('ا');
        if (aIndex !== -1 && aIndex > idx) suffixStart = aIndex;
      } else if (strippedWord.endsWith('ين')) {
        const yIndex = arabicWord.lastIndexOf('ي');
        if (yIndex !== -1 && yIndex > idx) suffixStart = yIndex;
      } else if (strippedWord.endsWith('ون')) {
        const wIndex = arabicWord.lastIndexOf('و');
        if (wIndex !== -1 && wIndex > idx) suffixStart = wIndex;
      } else if (strippedWord.endsWith('ات')) {
        const aIndex = arabicWord.lastIndexOf('ا');
        if (aIndex !== -1 && aIndex > idx) suffixStart = aIndex;
      } else if (strippedWord.endsWith('ه') || strippedWord.endsWith('ۥ')) {
        const hIndex = arabicWord.lastIndexOf('ه');
        if (hIndex !== -1 && hIndex > idx) suffixStart = hIndex;
      } else if (strippedWord.endsWith('ك')) {
        const kIndex = arabicWord.lastIndexOf('ك');
        if (kIndex !== -1 && kIndex > idx) suffixStart = kIndex;
      } else if (strippedWord.endsWith('ي')) {
        const yIndex = arabicWord.lastIndexOf('ي');
        if (yIndex !== -1 && yIndex > idx) suffixStart = yIndex;
      } else if (strippedWord.endsWith('ت')) {
        const tIndex = arabicWord.lastIndexOf('ت');
        if (tIndex !== -1 && tIndex > idx) suffixStart = tIndex;
      }
    }
    
    // Stem (everything between prefix and suffix)
    const stemText = arabicWord.substring(idx, suffixStart);
    if (stemText) {
      segments.push({ text: stemText, type: 'stem' });
    }
    
    // Suffix
    const suffixText = arabicWord.substring(suffixStart);
    if (suffixText) {
      segments.push({ text: suffixText, type: 'suffix' });
    }
    
    return segments;
  };

  if (!word) {
    return null;
  }

  const wordSegments = segmentWord(word, wordData?.morphology);

  return (
    <Modal
      visible={!!word}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.popup,
            {
              backgroundColor: theme.background,
              borderColor: theme.separator,
              opacity: glassOpacity,
              transform: [{ scale: glassScale }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                styles.wordTitle,
                {
                  fontFamily:
                    Platform.OS === 'web'
                      ? 'Scheherazade New, Amiri Quran, serif'
                      : 'ScheherazadeNew-Bold',
                },
              ]}
            >
              {wordSegments.map((segment, idx) => {
                const segmentColor = 
                  segment.type === 'prefix' ? '#14b8a6' : // Teal for prefix
                  segment.type === 'suffix' ? '#f59e0b' : // Amber for suffix
                  theme.text; // Default for stem
                
                return (
                  <Text
                    key={idx}
                    style={{ color: segmentColor }}
                  >
                    {segment.text}
                  </Text>
                );
              })}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={theme.muted} />
                <Text style={[styles.errorText, { color: theme.muted }]}>
                  Word not found in dictionary
                </Text>
                <Text style={[styles.errorSubtext, { color: theme.muted }]}>
                  This word may not be from the Quran or may use different diacritics
                </Text>
              </View>
            )}

            {!error && wordData && (
              <>
                {/* Meaning Section */}
                <View style={[styles.section, { borderTopWidth: 0, paddingTop: 0 }]}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="language" size={18} color={theme.tint} style={styles.sectionIcon} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Meaning</Text>
                  </View>
                  {loading || loadingTranslation ? (
                    <View style={styles.translationLoading}>
                      <View style={styles.pulsingDots}>
                        <Animated.View style={[styles.dot, { backgroundColor: theme.tint, opacity: pulse1 }]} />
                        <Animated.View style={[styles.dot, { backgroundColor: theme.tint, opacity: pulse2 }]} />
                        <Animated.View style={[styles.dot, { backgroundColor: theme.tint, opacity: pulse3 }]} />
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.meaningText, { color: theme.text }]}>
                      {englishMeaning || wordData.meaning}
                    </Text>
                  )}
                </View>

                {/* Grammar Section */}
                <View style={[styles.section, styles.grammarSection]}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="book" size={18} color={theme.tint} style={styles.sectionIcon} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Grammar</Text>
                  </View>
                  
                  {/* Part of Speech */}
                  <View style={styles.grammarRow}>
                    <Text style={[styles.grammarLabel, { color: theme.muted }]}>Type: </Text>
                    <Text style={[styles.posTextPlain, { color: getPOSColor(wordData.pos).text }]}>
                      {wordData.pos}
                    </Text>
                  </View>

                  {/* Lemma */}
                  <View style={styles.grammarRow}>
                    <Text style={[styles.grammarLabel, { color: theme.muted, marginTop: 0 }]}>Lemma: </Text>
                    <View style={styles.inlineContent}>
                      <Text
                        style={[
                          styles.lemmaText,
                          {
                            color: theme.text,
                            fontFamily:
                              Platform.OS === 'web'
                                ? 'Scheherazade New, Amiri Quran, serif'
                                : 'ScheherazadeNew-Bold',
                            marginTop: 5,
                          },
                        ]}
                      >
                        {wordData.lemma}
                      </Text>
                      {wordData.lemma_transliteration && (
                        <Text style={[styles.transliterationInline, { color: theme.muted }]}>
                          {' '}({wordData.lemma_transliteration})
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Root */}
                  {wordData.root && (
                    <View style={styles.grammarRow}>
                      <Text style={[styles.grammarLabel, { color: theme.muted}]}>Root: </Text>
                      <View style={styles.inlineContent}>
                        <Text
                          style={[
                            styles.rootText,
                            {
                              color: theme.text,
                              fontFamily:
                                Platform.OS === 'web'
                                  ? 'Scheherazade New, Amiri Quran, serif'
                                  : 'ScheherazadeNew-Bold',
                              marginTop:-30,
                            },
                          ]}
                        >
                          {wordData.root}
                        </Text>
                        {wordData.root_transliteration && (
                          <Text style={[styles.transliterationInline, { color: theme.muted }]}>
                            {' '}({wordData.root_transliteration})
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                {/* Affixes Section - Show detailed prefix/suffix info */}
                {(wordData.rawData?.prefix || wordData.rawData?.suffix) && (
                  <View style={[styles.section, { borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="layers" size={18} color={theme.tint} style={styles.sectionIcon} />
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>Affixes</Text>
                    </View>
                    <View style={styles.affixesContainer}>
                      {wordData.rawData.prefix && (
                        <View style={[styles.affixDetailCard, { backgroundColor: '#14b8a608', borderColor: '#14b8a620' }]}>
                          <View style={styles.affixDetailHeader}>
                            <Ionicons name="arrow-forward" size={14} color="#14b8a6" />
                            <Text style={[styles.affixDetailTitle, { color: '#14b8a6' }]}>Prefix</Text>
                          </View>
                          <Text style={[styles.affixDetailText, { color: theme.text }]}>
                            {wordData.grammaticalInfo.find(info => info.includes('Prefixed'))?.replace('Prefixed ', '') || wordData.rawData.prefix}
                          </Text>
                        </View>
                      )}
                      {wordData.rawData.suffix && (
                        <View style={[styles.affixDetailCard, { backgroundColor: '#f59e0b08', borderColor: '#f59e0b20' }]}>
                          <View style={styles.affixDetailHeader}>
                            <Ionicons name="arrow-back" size={14} color="#f59e0b" />
                            <Text style={[styles.affixDetailTitle, { color: '#f59e0b' }]}>Suffix</Text>
                          </View>
                          <Text style={[styles.affixDetailText, { color: theme.text }]}>
                            {wordData.grammaticalInfo.find(info => info.includes('pronoun') && !info.includes('Prefixed'))?.replace(/^\d+(st|nd|rd|th) person /, '') || wordData.rawData.suffix}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Morphology Section */}
                {wordData.grammaticalInfo.filter(info => !info.includes('Root:') && !info.includes('Appears')).length > 0 && (
                  <View style={[styles.section, { borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="git-branch" size={18} color={theme.tint} style={styles.sectionIcon} />
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>Morphology</Text>
                    </View>
                    <View style={styles.morphologyGrid}>
                      {wordData.grammaticalInfo
                        .filter(info => !info.includes('Root:') && !info.includes('Appears'))
                        .map((info, index) => (
                          <View
                            key={index}
                            style={[
                              styles.morphologyCard,
                              { 
                                backgroundColor: `${theme.tint}08`,
                                borderColor: `${theme.tint}20`,
                              },
                            ]}
                          >
                            <Text style={[styles.morphologyText, { color: theme.text }]}>
                              {info}
                            </Text>
                          </View>
                        ))}
                    </View>
                  </View>
                )}

                {/* Usage Section - Enhanced with locations */}
                {wordData.rawData && wordData.rawData.count > 0 && (
                  <View style={[styles.section, { borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="analytics" size={18} color={theme.tint} style={styles.sectionIcon} />
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>Usage</Text>
                    </View>
                    <View style={styles.usageRow}>
                      <Ionicons
                        name="stats-chart"
                        size={16}
                        color={theme.tint}
                        style={styles.usageIcon}
                      />
                      <Text style={[styles.usageText, { color: theme.text }]}>
                        Appears {wordData.rawData.count} {wordData.rawData.count === 1 ? 'time' : 'times'} in the Quran
                      </Text>
                    </View>
                    {wordData.rawData.locations && wordData.rawData.locations.length > 0 && (
                      <View style={styles.locationsContainer}>
                        <Text style={[styles.locationsLabel, { color: theme.muted }]}>
                          Locations (showing first {Math.min(10, wordData.rawData.locations.length)}):
                        </Text>
                        <View style={styles.locationChips}>
                          {wordData.rawData.locations.slice(0, 10).map((location, index) => {
                            // Parse location format: (Chapter:Verse:Word:Segment) or Chapter:Verse:Word
                            const cleanLoc = location.replace(/[()]/g, '');
                            const parts = cleanLoc.split(':');
                            const displayText = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : cleanLoc;
                            
                            return (
                              <View
                                key={index}
                                style={[
                                  styles.locationChip,
                                  {
                                    backgroundColor: `${theme.tint}08`,
                                    borderColor: `${theme.tint}20`,
                                  },
                                ]}
                              >
                                <Text style={[styles.locationChipText, { color: theme.text }]}>
                                  {displayText}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Related Words Section */}
                {wordData.relatedWords && wordData.relatedWords.length > 0 && (
                  <View style={[styles.section, { borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="link" size={18} color={theme.tint} style={styles.sectionIcon} />
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>Related Words</Text>
                    </View>
                    <Text style={[styles.relatedWordsSubtitle, { color: theme.muted }]}>
                      Words from the same root
                    </Text>
                    <View style={styles.relatedWordsContainer}>
                      {wordData.relatedWords.map((related, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.relatedWordChip,
                            {
                              backgroundColor: `${theme.tint}08`,
                              borderColor: `${theme.tint}20`,
                            },
                          ]}
                          onPress={() => onWordClick?.(related.word)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.relatedWordArabic,
                              {
                                color: theme.text,
                                fontFamily:
                                  Platform.OS === 'web'
                                    ? 'Scheherazade New, Amiri Quran, serif'
                                    : 'ScheherazadeNew-Bold',
                              },
                            ]}
                          >
                            {related.word}
                          </Text>
                          <Text style={[styles.relatedWordLemma, { color: theme.muted }]}>
                            {related.lemma}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popup: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
    borderRadius: 28,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 20,
    borderBottomWidth: 0,
  },
  wordTitle: {
    fontSize: 40,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
    borderRadius: 20,
  },
  scrollView: {
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 28,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  errorSubtext: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 21,
    letterSpacing: -0.1,
    opacity: 0.7,
  },
  section: {
    marginBottom: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    marginRight: 10,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  grammarSection: {
    marginBottom: 32,
  },
  grammarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  grammarLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    opacity: 0.6,
    marginRight: 8,
  },
  inlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  lemmaText: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  rootText: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  meaningText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  translationLoading: {
    paddingVertical: 8,
  },
  pulsingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  posBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0,
  },
  posText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  posTextPlain: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  morphologyTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  morphologyTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  morphologyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  morphologyCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 0,
    minWidth: '45%',
    flexGrow: 1,
  },
  morphologyText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  usageIcon: {
    marginRight: 8,
  },
  usageText: {
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
    letterSpacing: -0.1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  infoText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  relatedWordsSubtitle: {
    fontSize: 13,
    marginBottom: 14,
    letterSpacing: -0.1,
    opacity: 0.6,
  },
  relatedWordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relatedWordChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 0,
    alignItems: 'center',
  },
  relatedWordArabic: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  relatedWordLemma: {
    fontSize: 12,
    letterSpacing: -0.1,
    opacity: 0.6,
  },
  affixRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  affixBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  affixLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  transliterationText: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  transliterationInline: {
    fontSize: 13,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  affixesContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  affixDetailCard: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  affixDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  affixDetailTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  affixDetailText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  locationsContainer: {
    marginTop: 12,
  },
  locationsLabel: {
    fontSize: 12,
    marginBottom: 10,
    opacity: 0.7,
  },
  locationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  locationChipText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
