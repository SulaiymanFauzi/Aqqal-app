# Quranic Corpus Data Analysis

## 📚 What You Have

You have two powerful linguistic resources from the **Quranic Arabic Corpus Project** by Kais Dukes:

---

## 1. **quranic-corpus-morphology-0.4.txt** (128,276 lines)

### What It Is
A **complete morphological analysis** of every word in the Quran. This is essentially a word-by-word grammatical breakdown.

### Data Structure
```
LOCATION    FORM        TAG     FEATURES
(1:1:1:1)   bi          P       PREFIX|bi+
(1:1:1:2)   somi        N       STEM|POS:N|LEM:{som|ROOT:smw|M|GEN
(1:1:2:1)   {ll~ahi     PN      STEM|POS:PN|LEM:{ll~ah|ROOT:Alh|GEN
```

### What Each Column Means

#### **LOCATION** `(Chapter:Verse:Word:Segment)`
- `(1:1:1:1)` = Chapter 1, Verse 1, Word 1, Segment 1
- Segments = morphological parts (prefix, stem, suffix)

#### **FORM** (Buckwalter Transliteration)
- Arabic text in ASCII encoding
- Example: `{ll~ahi` = ٱللَّهِ (Allah)
- `bi` = بِ (the prefix "bi")

#### **TAG** (Part of Speech)
- `N` = Noun
- `V` = Verb
- `P` = Preposition
- `PN` = Proper Noun
- `ADJ` = Adjective
- `PRON` = Pronoun
- `CONJ` = Conjunction
- `REL` = Relative pronoun
- `DET` = Determiner (Al-)
- `NEG` = Negation particle

#### **FEATURES** (Detailed Grammar)
- `PREFIX|bi+` = Prefix "bi" (with/by)
- `STEM|POS:N` = Stem, Part of Speech: Noun
- `LEM:{som` = Lemma (dictionary form): "ism" (name)
- `ROOT:smw` = Root letters: س-م-و
- `M` = Masculine, `F` = Feminine
- `GEN` = Genitive case, `NOM` = Nominative, `ACC` = Accusative
- `PERF` = Perfect tense, `IMPF` = Imperfect
- `3MS` = 3rd person masculine singular

### Example Breakdown: Bismillah (بِسْمِ ٱللَّهِ)

```
(1:1:1:1)  bi      P    PREFIX|bi+                    → بِ (with/by)
(1:1:1:2)  somi    N    STEM|POS:N|LEM:{som|ROOT:smw  → سْمِ (name)
(1:1:2:1)  {ll~ahi PN   STEM|POS:PN|LEM:{ll~ah        → ٱللَّهِ (Allah)
```

### What You Can Do With This

✅ **Word-by-word translation lookup**
- Get the root, lemma, and meaning of any word
- Example: User clicks "ٱللَّهِ" → Show "Allah (The God), Root: Alh"

✅ **Grammatical analysis**
- Show case, gender, number, tense
- Example: "Masculine noun in genitive case"

✅ **Root-based search**
- Find all words from the same root
- Example: All words from root "smw" (name/heaven)

✅ **Morphological breakdown**
- Show prefix + stem + suffix
- Example: "bi + ism + genitive marker"

---

## 2. **jqurantree-1.0.0-src** (Java Library)

### What It Is
A **Java library** for programmatic access to the Quranic text and morphology data. It's essentially a toolkit to parse and query the morphology file.

### Key Features

#### **Orthography Module**
- Buckwalter encoding/decoding
- Arabic text manipulation
- Location-based verse lookup

#### **Analysis Module**
- Token frequency counting
- Character frequency analysis
- Statistical analysis tools

#### **Search Module**
- Search by letter patterns
- Search by token/word
- Root-based searching

#### **Example Use Cases** (from test files)
```
Location: (27:30)
Text: إِنَّهُۥ مِن سُلَيْمَٰنَ وَإِنَّهُۥ بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
```

---

## 🎯 How This Helps Your App

### **Option A: Parse the Morphology File** (Recommended)
You can create a lightweight parser to extract what you need:

1. **Build a word lookup dictionary**
   ```json
   {
     "ٱللَّهِ": {
       "lemma": "Allah",
       "root": "Alh",
       "pos": "Proper Noun",
       "translation": "The God"
     }
   }
   ```

2. **Index by location**
   ```json
   {
     "1:1": {
       "arabic": "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
       "words": [...]
     }
   }
   ```

### **Option B: Use the Java Library** (If you want full features)
- Port key functions to JavaScript/TypeScript
- Or run a Java microservice for complex queries

---

## 💡 Practical Implementation for Your App

### **Immediate Use Case: Clickable Arabic Words**

**Step 1: Create a lightweight word dictionary**
```typescript
// Parse morphology file and extract:
{
  "ٱللَّهِ": {
    lemma: "Allah",
    root: "Alh", 
    meaning: "The God",
    pos: "Proper Noun"
  },
  "ٱلرَّحْمَٰنِ": {
    lemma: "Rahman",
    root: "rHm",
    meaning: "The Most Merciful",
    pos: "Adjective"
  }
}
```

**Step 2: On click, show popup**
```
User clicks: ٱللَّهِ
Popup shows:
━━━━━━━━━━━━━━━
Allah (ٱللَّهِ)
━━━━━━━━━━━━━━━
Meaning: The God
Root: Alh (أ-ل-ه)
Type: Proper Noun
Case: Genitive
━━━━━━━━━━━━━━━
```

---

## 📊 Data Statistics

### Morphology File
- **Total entries**: ~128,000 morphological segments
- **Unique words**: ~77,000 (entire Quran)
- **File size**: ~8MB (text file)
- **Compressed**: ~1-2MB (gzipped)

### Coverage
- ✅ **100% of Quranic text**
- ✅ Every word broken down morphologically
- ✅ Every root, lemma, and grammatical feature
- ✅ Licensed under GNU GPL (free to use with attribution)

---

## 🚀 Recommended Approach for Your App

### **Phase 1: Basic Word Lookup** (Quick Win)
1. Parse the morphology file
2. Extract: word → lemma, root, basic meaning
3. Create a JSON dictionary (~2MB)
4. Bundle with your app
5. On click → instant lookup from local dictionary

### **Phase 2: Enhanced with LLM** (Best UX)
1. Use local dictionary for instant display
2. Call Gemini Flash for:
   - Contextual translation
   - Grammatical explanation in simple terms
   - Related verses with same root
3. Cache LLM responses

### **Phase 3: Advanced Features** (Future)
- Root-based word exploration
- Morphological analysis visualization
- Cross-reference with tafsir

---

## 📝 License Notes

Both resources are **GNU GPL licensed**:
- ✅ Free to use
- ✅ Can be distributed
- ✅ Must attribute source (corpus.quran.com)
- ✅ Must keep copyright notices
- ⚠️ If you modify and distribute, must share modifications

---

## 🎓 What Makes This Special

This is **gold-standard linguistic data**:
- Created by academic researchers
- Peer-reviewed and verified
- Used by scholars worldwide
- Much more accurate than generic Arabic dictionaries
- Includes Quranic-specific meanings

**Bottom line**: You have access to the same data used by professional Quranic study tools like Quran.com and corpus.quran.com!
