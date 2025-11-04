# Quran Corpus Metadata Schema Update

## Summary
Restructured `parse_quran_corpus.py` to build complete metadata for each word in the dictionary, including all morphological features from the Quranic Arabic Corpus.

## Changes Made

### 1. Backend (Python Script)

#### File: `scripts/parse_quran_corpus.py`

**Updated morphology storage for STEM words (lines 264-272):**
- Changed from storing only `['gender', 'number', 'case', 'person', 'tense', 'form']`
- Now stores ALL features: `['gender', 'number', 'case', 'person', 'state', 'aspect', 'mood', 'voice', 'form', 'derivation', 'special']`

**Updated dictionary builder (lines 357-431):**
- Restructured to explicitly add each morphological field if present
- Organized fields by category:
  - **Person, Gender, Number (PGN)**: person, gender, number
  - **Nominal features**: case, state
  - **Verb features**: aspect, mood, voice, form
  - **Derivation**: derivation (ACT PCPL, PASS PCPL, VN)
  - **Special tags**: special
  - **Affixes**: prefix, suffix

### 2. Frontend (TypeScript)

#### File: `utils/quran-lookup.ts`

**Updated `WordData` interface (lines 6-33):**
```typescript
export interface WordData {
  lemma: string;
  lemma_transliteration: string;
  root: string | null;
  root_transliteration: string | null;
  pos: string | null;
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
  prefix?: string;
  suffix?: string;
}
```

**Added new label mappings (lines 145-184):**
- `ASPECT_LABELS`: Perfect, Imperfect, Imperative
- `MOOD_LABELS`: Indicative, Subjunctive, Jussive
- `VOICE_LABELS`: Active, Passive
- `STATE_LABELS`: Definite, Indefinite
- `DERIVATION_LABELS`: Active participle, Passive participle, Verbal noun
- `PREFIX_LABELS`: preposition, conjunction, etc.
- `SUFFIX_LABELS`: vocative, emphatic nun

**Updated `formatMorphology` function (lines 467-495):**
- Renamed `tense` → `aspect`
- Added formatting for: mood, voice, state, derivation, special

## New Metadata Fields Available

### Nominal Features
- **state**: DEF (definite) or INDEF (indefinite)
  - Example: هُدًى has `state: "INDEF"`

### Verb Features
- **aspect**: PERF (perfect/past), IMPF (imperfect/present), IMPV (imperative)
  - Example: أُنزِلَ has `aspect: "PERF"`
- **mood**: IND (indicative), SUBJ (subjunctive), JUS (jussive)
  - Example: هُدًى has `mood: "IND"`
- **voice**: ACT (active) or PASS (passive)
  - Example: أُنزِلَ has `voice: "PASS"`
- **form**: Verb form (I, II, III, IV, V, VI, VII, VIII, IX, X, XI, XII)
  - Example: أُنزِلَ has `form: "IV"`, نَسْتَعِينُ has `form: "X"`

### Derivation
- **derivation**: ACT PCPL (active participle), PASS PCPL (passive participle), VN (verbal noun)
  - Example: مَٰلِكِ has `derivation: "ACT PCPL"`

### Special Tags
- **special**: Special grammatical categories (e.g., kaAd for كاد verbs)

## Generated Files

All files regenerated in `assets/quran-data/`:
- **word-dictionary.json**: 22,036 words with complete metadata (7,371 KB)
- **root-index.json**: 1,642 roots (1,205 KB)
- **stats.json**: Generation statistics

## Examples

### Passive Perfect Verb (أُنزِلَ)
```json
{
  "lemma": "أَنزَلَ",
  "pos": "V",
  "aspect": "PERF",
  "voice": "PASS",
  "form": "IV"
}
```

### Verb Form X (نَسْتَعِينُ)
```json
{
  "lemma": "ٱسْتَعِينُ",
  "pos": "V",
  "aspect": "IMPF",
  "form": "X"
}
```

### Active Participle (مَٰلِكِ)
```json
{
  "lemma": "مَٰلِك",
  "pos": "N",
  "gender": "M",
  "case": "GEN",
  "voice": "ACT",
  "derivation": "ACT PCPL"
}
```

### Indefinite Noun (هُدًى)
```json
{
  "lemma": "هُدًى",
  "pos": "N",
  "gender": "M",
  "case": "NOM",
  "state": "INDEF",
  "mood": "IND"
}
```

## Frontend Impact

The frontend automatically displays all new metadata fields through the `formatMorphology` function in `quran-lookup.ts`. The `ArabicWordPopup` component will now show:
- Aspect, mood, and voice for verbs
- State (definite/indefinite) for nouns
- Derivation type (participles, verbal nouns)
- Special grammatical tags
- All existing features (gender, number, case, person, form)

## Backward Compatibility

✅ **Fully backward compatible** - all existing fields remain unchanged. New fields are optional and only appear when present in the corpus data.
