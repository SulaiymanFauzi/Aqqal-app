# Frontend Layout Update - ArabicWordPopup Component

## Overview
Enhanced the ArabicWordPopup component to display all comprehensive morphological data from the updated schema.

## New Layout Structure

### 📖 **1. Meaning Section**
- English translation (with loading animation)
- Falls back to Arabic lemma if translation unavailable

### 📚 **2. Grammar Section**
**Enhanced with transliterations**
- **Type**: POS badge with color coding (45 different types supported)
- **Lemma**: 
  - Arabic text (large, styled)
  - Buckwalter transliteration (small, italic, below)
- **Root**: 
  - Arabic text (large, styled)
  - Buckwalter transliteration (small, italic, below)

### 🔤 **3. Affixes Section** *(NEW - shows only if prefix/suffix present)*
Detailed cards showing:
- **Prefix Card** (teal background):
  - Icon indicator
  - Full description (e.g., "preposition (bi)", "conjunction (wa)", "definite article (al)")
- **Suffix Card** (amber background):
  - Icon indicator
  - Full description (e.g., "3rd person masculine singular pronoun", "vocative", "emphatic nun")

### 🔍 **4. Morphology Section**
**Organized display of all morphological features**

Cards showing (context-dependent):

**For Verbs:**
- Aspect (Perfect/Imperfect/Imperative)
- Mood (Indicative/Subjunctive/Jussive)
- Voice (Active/Passive)
- Form (I-XII)
- Person (1st/2nd/3rd)
- Gender (Masculine/Feminine)
- Number (Singular/Dual/Plural)
- Derivation (Active participle, Passive participle, Verbal noun)

**For Nouns/Adjectives:**
- State (Definite/Indefinite)
- Case (Nominative/Genitive/Accusative)
- Gender (Masculine/Feminine)
- Number (Singular/Dual/Plural)

**For All:**
- Special tags (if present)

### 📊 **5. Usage Section** *(ENHANCED)*
- **Frequency**: "Appears X times in the Quran"
- **Locations** *(NEW)*:
  - Shows first 10 occurrences
  - Displayed as chips in Surah:Verse format
  - Monospace font for readability
  - Example: `1:1`, `2:17`, `3:45`

### 🔗 **6. Related Words Section**
- Words from the same root
- Shows Arabic word + lemma
- Clickable to explore related words
- Limited to top 5 most frequent

## Visual Enhancements

### Color Coding
**POS Type Colors** (45 types supported):
- **Verbs**: Blue (#3b82f6)
- **Nouns**: Green (#10b981)
- **Proper Nouns**: Purple (#8b5cf6)
- **Pronouns**: Amber (#f59e0b)
- **Adverbs**: Purple (#a855f7)
- **Prepositions**: Pink (#ec4899)
- **Conjunctions**: Cyan (#06b6d4)
- **Particles**: Lime (#84cc16)
- **Lām Prefixes**: Pink (#ec4899)
- **Quranic Initials**: Indigo (#6366f1)

### Word Segmentation
In the header, the word is color-coded by segments:
- **Prefix**: Teal (#14b8a6)
- **Stem**: Default theme color
- **Suffix**: Amber (#f59e0b)

### Typography
- **Arabic text**: Scheherazade New font (web) / ScheherazadeNew-Bold (native)
- **Transliterations**: Italic, smaller, muted
- **Location chips**: Monospace font
- **Section headers**: Uppercase, small, with icons

## Data Flow

```typescript
WordLookupResult {
  word: string;
  lemma: string;
  lemma_transliteration?: string;  // NEW
  root: string | null;
  root_transliteration?: string | null;  // NEW
  meaning: string;
  pos: string;
  grammaticalInfo: string[];
  relatedWords?: Array<{word, lemma}>;
  morphology?: {
    hasPrefix: boolean;
    hasSuffix: boolean;
  };
  rawData?: {  // NEW - Complete morphological data
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
```

## Example Display

### Sample Word: بِسْمِ (bismi - "in the name of")

```
📖 Meaning
   In the name of

📚 Grammar
   Type: [Noun] (green badge)
   Lemma: ٱسْم
          {som
   Root: سمو
         smw

🔤 Affixes
   [→ Prefix]
   preposition (bi)

🔍 Morphology
   [Masculine] [Genitive]

📊 Usage
   Appears 3 times in the Quran
   
   Locations (showing first 3):
   [1:1] [11:41] [27:30]

🔗 Related Words
   [ٱسْم] [أَسْمَاء] [سَمَّىٰ]
```

### Sample Word: نَسْتَعِينُ (nasta'īnu - "we seek help")

```
📖 Meaning
   We seek help

📚 Grammar
   Type: [Verb] (blue badge)
   Lemma: ٱسْتَعِينُ
          {sotaEiynu
   Root: عون
         Ewn

🔍 Morphology
   [Imperfect (present/future)] [Form X]
   [1st person] [Plural]

📊 Usage
   Appears 1 time in the Quran
   
   Locations (showing first 1):
   [1:5]

🔗 Related Words
   [عَوْن] [مُعِين] [مُسْتَعَان]
```

## Technical Implementation

### New Styles Added
- `transliterationText`: For Buckwalter transliterations
- `affixesContainer`: Container for prefix/suffix cards
- `affixDetailCard`: Individual affix card
- `affixDetailHeader`: Header with icon + title
- `affixDetailTitle`: "Prefix" / "Suffix" label
- `affixDetailText`: Affix description
- `locationsContainer`: Container for location chips
- `locationsLabel`: "Locations" label
- `locationChips`: Flex container for chips
- `locationChip`: Individual location chip
- `locationChipText`: Monospace location text

### Files Modified
1. ✅ `utils/quran-lookup.ts`:
   - Updated `WordLookupResult` interface with `rawData`, transliterations
   - Enhanced lookup function to populate all fields
   - Expanded label mappings for all prefix/suffix types

2. ✅ `components/chat/ArabicWordPopup.tsx`:
   - Added Affixes section with detailed cards
   - Enhanced Grammar section with transliterations
   - Completely rewrote Usage section with location chips
   - Added comprehensive POS color mapping (45 types)
   - Added 10 new style definitions

## Benefits

1. **Complete Data Display**: All morphological features now visible
2. **Better Organization**: Clear sections for different data types
3. **Enhanced Readability**: Transliterations help non-Arabic readers
4. **Contextual Information**: Locations show where words appear
5. **Visual Hierarchy**: Color coding and icons guide the eye
6. **Comprehensive Coverage**: Supports all 45 POS tags from POS-tags.txt
7. **Detailed Affixes**: Clear explanation of prefixes and suffixes
8. **Improved UX**: Organized, scannable layout with visual cues

## Comparison: Before vs After

### Before
- ❌ No transliterations
- ❌ Generic "Appears X times" with no locations
- ❌ Prefix/suffix shown as small badges only
- ❌ Limited POS color support
- ❌ Morphology mixed with other info

### After
- ✅ Transliterations for lemma and root
- ✅ Locations shown as clickable chips (Surah:Verse)
- ✅ Dedicated Affixes section with full descriptions
- ✅ 45 POS types with unique colors
- ✅ Organized morphology section
- ✅ All data from schema displayed
- ✅ Better visual hierarchy
- ✅ Enhanced typography and spacing
