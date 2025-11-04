#!/usr/bin/env python3
"""
Quran Corpus Parser - Fully Compliant with POS-tags.txt Guidelines
===================================================================

Extracts morphological data from quranic-corpus-morphology-0.4.txt
and generates optimized JSON files for mobile app usage.

FULL COMPLIANCE WITH POS-TAGS.TXT:
-----------------------------------

1. ALL POS TAGS (Lines 3-51 of POS-tags.txt):
   - Prepositions: P
   - lām Prefixes: EMPH, IMPV, PRP
   - Conjunctions: CONJ, SUB
   - Particles (28 types): ACC, AMD, ANS, AVR, CAUS, CERT, CIRC, COM, COND, 
     EQ, EXH, EXL, EXP, FUT, INC, INT, INTG, NEG, PREV, PRO, REM, RES, RET, 
     RSLT, SUP, SUR, VOC
   - Disconnected Letters: INL
   - Nouns: N, PN
   - Derived Nominals: ADJ, IMPN
   - Pronouns: PRON, DEM, REL
   - Adverbs: T, LOC
   - Verbs: V

2. ALL PREFIX FEATURES (Lines 56-93 of POS-tags.txt):
   - Simple prefixes (Fig 3): Al+, bi+, ka+, ta+, sa+, ya+, ha+
   - Alif particles (Fig 4): A:INTG+, A:EQ+
   - Wāw particles (Fig 5): w:CONJ+, w:REM+, w:CIRC+, w:SUP+, w:P+, w:COM+
   - Fa particles (Fig 6): f:REM+, f:CONJ+, f:RSLT+, f:SUP+, f:CAUS+
   - Lām particles (Fig 7): l:P+, l:EMPH+, l:PRP+, l:IMPV+

3. ALL SUFFIX FEATURES (Lines 157-159 of POS-tags.txt):
   - Attached pronouns: PRON:XXX (with person, gender, number)
   - Vocative suffix: +VOC
   - Emphatic nūn: +n:EMPH

4. ALL MORPHOLOGICAL FEATURES:
   - ROOT: and LEM: (Lines 95-96)
   - SP: special tags (Line 97)
   - Person, Gender, Number (Lines 101-103)
   - Verb Aspect: PERF, IMPF, IMPV (Lines 106-109)
   - Verb Mood: IND, SUBJ, JUS (Lines 112-115)
   - Verb Voice: ACT, PASS (Lines 118-120)
   - Verb Form: I-XII (Lines 123-135)
   - Derivation: ACT PCPL, PASS PCPL, VN (Lines 139-142)
   - State: DEF, INDEF (Lines 146-148)
   - Case: NOM, ACC, GEN (Lines 151-154)

Generated Files:
- word-dictionary.json: Complete word lookup with all morphological features
- root-index.json: Root-based word grouping
- stats.json: Corpus statistics
"""

import json
import re
from collections import defaultdict
from pathlib import Path

# ===== POS TAG DEFINITIONS (from POS-tags.txt) =====
POS_TAGS = {
    # Prepositions
    'P': 'Preposition',
    
    # lām Prefixes
    'EMPH': 'Emphatic lām prefix',
    'IMPV': 'Imperative lām prefix',
    'PRP': 'Purpose lām prefix',
    
    # Conjunctions
    'CONJ': 'Coordinating conjunction',
    'SUB': 'Subordinating conjunction',
    
    # Particles
    'ACC': 'Accusative particle',
    'AMD': 'Amendment particle',
    'ANS': 'Answer particle',
    'AVR': 'Aversion particle',
    'CAUS': 'Particle of cause',
    'CERT': 'Particle of certainty',
    'CIRC': 'Circumstantial particle',
    'COM': 'Comitative particle',
    'COND': 'Conditional particle',
    'EQ': 'Equalization particle',
    'EXH': 'Exhortation particle',
    'EXL': 'Explanation particle',
    'EXP': 'Exceptive particle',
    'FUT': 'Future particle',
    'INC': 'Inceptive particle',
    'INT': 'Particle of interpretation',
    'INTG': 'Interrogative particle',
    'NEG': 'Negative particle',
    'PREV': 'Preventive particle',
    'PRO': 'Prohibition particle',
    'REM': 'Resumption particle',
    'RES': 'Restriction particle',
    'RET': 'Retraction particle',
    'RSLT': 'Result particle',
    'SUP': 'Supplemental particle',
    'SUR': 'Surprise particle',
    'VOC': 'Vocative particle',
    
    # Disconnected Letters
    'INL': 'Quranic initials',
    
    # Nouns
    'N': 'Noun',
    'PN': 'Proper noun',
    
    # Derived nominals
    'ADJ': 'Adjective',
    'IMPN': 'Imperative verbal noun',
    
    # Pronouns
    'PRON': 'Personal pronoun',
    'DEM': 'Demonstrative pronoun',
    'REL': 'Relative pronoun',
    
    # Adverbs
    'T': 'Time adverb',
    'LOC': 'Location adverb',
    
    # Verbs
    'V': 'Verb',
    
    # Determiner (used in prefixes)
    'DET': 'Determiner',
}

# Buckwalter to Unicode mapping (complete)
BUCKWALTER_MAP = {
    "'": "ء", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
    "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث",
    "j": "ج", "H": "ح", "x": "خ", "d": "د", "*": "ذ",
    "r": "ر", "z": "ز", "s": "س", "$": "ش", "S": "ص",
    "D": "ض", "T": "ط", "Z": "ظ", "E": "ع", "g": "غ",
    "f": "ف", "q": "ق", "k": "ك", "l": "ل", "m": "م",
    "n": "ن", "h": "ه", "w": "و", "Y": "ى", "y": "ي",
    "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ",
    "i": "ِ", "~": "ّ", "o": "ْ", "`": "ٰ", "{": "ٱ",
    "^": "ء",  # Hamza (used after alif, waw, ya)
    "@": "ء",  # Hamza (alternative)
    "_": "",   # Underscore (used for special cases)
    "#": "",   # Hash (used for special cases)
    ",": "",   # Comma (pause marker, should be skipped)
    ".": "",   # Period (stop marker, should be skipped)
}

def buckwalter_to_arabic(text):
    """Convert Buckwalter transliteration to Arabic"""
    result = ""
    i = 0
    while i < len(text):
        char = text[i]
        
        # Handle special sequences
        if char == "_" and i + 1 < len(text) and text[i + 1] == "#":
            # _# represents hamza on ya (ئ)
            result += "ئ"
            i += 2  # Skip both characters
            continue
        elif char == "^" and i > 0:
            # Alif madda or hamza marker
            prev = result[-1] if result else ""
            if prev == "ا":  # After alif -> make it alif madda
                result = result[:-1] + "ا"  # Keep as regular alif (madda is just diacritic)
            else:
                # Just skip the ^, it's a diacritic marker
                pass
        elif char == "@":
            # Hamza on waw - but only if preceded by waw
            if result and result[-1] == "و":
                result = result[:-1] + "ؤ"
            else:
                # Otherwise it's just a marker, skip it
                pass
        elif char == "_":
            # Standalone underscore represents hamza on line (ء)
            result += "ء"
        elif char == "#":
            # Standalone # is typically skipped (used for special cases)
            pass
        else:
            result += BUCKWALTER_MAP.get(char, char)
        
        i += 1
    
    return result

def parse_location(loc):
    """Parse location string (Chapter:Verse:Word:Segment)"""
    match = re.match(r'\((\d+):(\d+):(\d+):(\d+)\)', loc)
    if match:
        return {
            'chapter': int(match.group(1)),
            'verse': int(match.group(2)),
            'word': int(match.group(3)),
            'segment': int(match.group(4))
        }
    return None

def parse_features(features):
    """
    Comprehensive parsing of all morphological features according to Quranic Arabic Corpus tagset.
    See POS-tags.txt for complete feature documentation.
    
    Handles:
    - All prefix features (Al+, bi+, ka+, ta+, sa+, ya+, ha+, A:INTG+, A:EQ+, w:*, f:*, l:*)
    - All suffix features (PRON:XXX, +VOC, +n:EMPH)
    - All POS tags (particles, nouns, pronouns, adverbs, verbs)
    - All morphological features (person, gender, number, case, state, aspect, mood, voice, form, derivation)
    """
    result = {}
    
    # ===== SEGMENT TYPE =====
    if 'PREFIX' in features:
        result['type'] = 'PREFIX'
        
        # Extract all prefix features (features ending with +)
        # Patterns: Al+, bi+, ka+, ta+, sa+, ya+, ha+, A:INTG+, A:EQ+, w:CONJ+, f:REM+, l:P+, etc.
        prefix_patterns = [
            # Simple prefixes (Fig 3)
            r'Al\+',           # determiner
            r'bi\+',           # preposition "by/with/in"
            r'ka\+',           # preposition "like/thus"
            r'ta\+',           # particle of oath "by Allah"
            r'sa\+',           # future particle
            r'ya\+',           # vocative "O"
            r'ha\+',           # vocative "Lo!"
            
            # Alif particles (Fig 4)
            r'A:INTG\+',       # interrogative alif
            r'A:EQ\+',         # equalization alif
            
            # Wāw particles (Fig 5)
            r'w:CONJ\+',       # conjunction "and"
            r'w:REM\+',        # resumption "then/so"
            r'w:CIRC\+',       # circumstantial "while"
            r'w:SUP\+',        # supplemental "then/so"
            r'w:P\+',          # particle of oath
            r'w:COM\+',        # comitative "with"
            
            # Fa particles (Fig 6)
            r'f:REM\+',        # resumption "then/so"
            r'f:CONJ\+',       # conjunction "and"
            r'f:RSLT\+',       # result "then"
            r'f:SUP\+',        # supplemental "then/so"
            r'f:CAUS\+',       # cause "then/so"
            
            # Lām particles (Fig 7)
            r'l:P\+',          # preposition lām
            r'l:EMPH\+',       # emphatic lām
            r'l:PRP\+',        # purpose lām
            r'l:IMPV\+',       # imperative lām
        ]
        
        # Try to match any prefix pattern
        for pattern in prefix_patterns:
            match = re.search(pattern, features)
            if match:
                result['prefix_feature'] = match.group(0).rstrip('+')
                break
        
        # Fallback: generic prefix extraction
        if 'prefix_feature' not in result:
            prefix_match = re.search(r'([a-zA-Z]+:[a-zA-Z]+|[a-zA-Z]+)\+', features)
            if prefix_match:
                result['prefix_feature'] = prefix_match.group(1)
    
    elif 'STEM' in features:
        result['type'] = 'STEM'
    
    elif 'SUFFIX' in features:
        result['type'] = 'SUFFIX'
        
        # Extract suffix features
        # Patterns: PRON:3MS, PRON:2D, +VOC, +n:EMPH
        if 'PRON:' in features:
            # Attached pronoun suffixes (person, gender, number)
            pron_match = re.search(r'PRON:([123])?([MF])?([SPD])?', features)
            if pron_match:
                pron_code = ''
                if pron_match.group(1):  # person
                    pron_code += pron_match.group(1)
                if pron_match.group(2):  # gender
                    pron_code += pron_match.group(2)
                if pron_match.group(3):  # number
                    pron_code += pron_match.group(3)
                result['suffix_feature'] = f'PRON:{pron_code}' if pron_code else 'PRON'
        
        # Vocative suffix (+VOC) - used with "allāh" to produce "allāhumma"
        elif '+VOC' in features:
            result['suffix_feature'] = 'VOC'
        
        # Emphatic nūn suffix (+n:EMPH)
        elif '+n:EMPH' in features or 'n:EMPH' in features:
            result['suffix_feature'] = 'n:EMPH'
        
        # Generic suffix extraction (fallback)
        else:
            suffix_match = re.search(r'\+([a-zA-Z:]+)', features)
            if suffix_match:
                result['suffix_feature'] = suffix_match.group(1)
    
    # ===== PART OF SPEECH =====
    # Extract POS tag (validates against POS_TAGS dictionary)
    pos_match = re.search(r'POS:(\w+)', features)
    if pos_match:
        pos_tag = pos_match.group(1)
        # Validate against known POS tags
        if pos_tag in POS_TAGS:
            result['pos'] = pos_tag
            result['pos_description'] = POS_TAGS[pos_tag]
        else:
            result['pos'] = pos_tag
    
    # ===== LEMMA & ROOT =====
    lem_match = re.search(r'LEM:([^|\s]+)', features)
    if lem_match:
        result['lemma'] = lem_match.group(1).strip()
    
    root_match = re.search(r'ROOT:([^|\s]+)', features)
    if root_match:
        result['root'] = root_match.group(1).strip()
    
    # ===== SPECIAL TAG =====
    sp_match = re.search(r'SP:([^|\s]+)', features)
    if sp_match:
        result['special'] = sp_match.group(1).strip()
    
    # ===== PERSON, GENDER, NUMBER (PGN) =====
    # Combined format: |1MS|, |2FP|, |3MD|, etc.
    pgn_match = re.search(r'\|([123])([MF])([SPD])\|', features)
    if pgn_match:
        result['person'] = pgn_match.group(1)
        result['gender'] = pgn_match.group(2)
        result['number'] = pgn_match.group(3)
    else:
        # Try to extract separately
        # Person (1, 2, 3)
        person_match = re.search(r'\|([123])\|', features)
        if person_match:
            result['person'] = person_match.group(1)
        
        # Gender (M, F)
        if '|M|' in features or features.endswith('|M'):
            result['gender'] = 'M'
        elif '|F|' in features or features.endswith('|F'):
            result['gender'] = 'F'
        
        # Number (S, D, P)
        if '|S|' in features or '|MS|' in features or '|FS|' in features:
            result['number'] = 'S'
        elif '|P|' in features or '|MP|' in features or '|FP|' in features:
            result['number'] = 'P'
        elif '|D|' in features or '|MD|' in features or '|FD|' in features:
            result['number'] = 'D'
    
    # ===== CASE (for nominals) =====
    if '|NOM' in features or features.endswith('NOM'):
        result['case'] = 'NOM'
    elif '|GEN' in features or features.endswith('GEN'):
        result['case'] = 'GEN'
    elif '|ACC' in features or features.endswith('ACC'):
        result['case'] = 'ACC'
    
    # ===== STATE (definite/indefinite) =====
    if '|DEF' in features:
        result['state'] = 'DEF'
    elif '|INDEF' in features:
        result['state'] = 'INDEF'
    
    # ===== VERB ASPECT =====
    if '|PERF' in features or 'PERF|' in features:
        result['aspect'] = 'PERF'
    elif '|IMPF' in features or 'IMPF|' in features:
        result['aspect'] = 'IMPF'
    elif '|IMPV' in features or 'IMPV|' in features:
        result['aspect'] = 'IMPV'
    
    # ===== VERB MOOD =====
    if '|IND' in features:
        result['mood'] = 'IND'
    elif '|SUBJ' in features:
        result['mood'] = 'SUBJ'
    elif '|JUS' in features:
        result['mood'] = 'JUS'
    
    # ===== VERB VOICE =====
    if '|ACT' in features:
        result['voice'] = 'ACT'
    elif '|PASS' in features:
        result['voice'] = 'PASS'
    
    # ===== VERB FORM (I-XII) =====
    form_match = re.search(r'\(([IVX]+)\)', features)
    if form_match:
        result['verb_form'] = form_match.group(1)
    
    # ===== DERIVATION (participles, verbal nouns) =====
    if 'ACT PCPL' in features or 'ACT|PCPL' in features:
        result['derivation'] = 'ACT PCPL'
    elif 'PASS PCPL' in features or 'PASS|PCPL' in features:
        result['derivation'] = 'PASS PCPL'
    elif '|VN' in features or features.endswith('VN'):
        result['derivation'] = 'VN'
    
    return result

def parse_morphology_file(filepath):
    """Parse the morphology file and extract structured data"""
    print(f"Parsing {filepath}...")
    
    words_by_location = defaultdict(list)
    word_dictionary = defaultdict(lambda: {
        'occurrences': [],
        'roots': set(),
        'lemmas': set(),
        'pos_tags': set(),
        'morphology': []
    })
    root_index = defaultdict(lambda: {
        'words': set(),
        'count': 0
    })
    
    with open(filepath, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            # Skip comments and headers
            if line.startswith('#') or line.startswith('LOCATION'):
                continue
            
            line = line.strip()
            if not line:
                continue
            
            # Parse line: LOCATION FORM TAG FEATURES
            parts = line.split('\t')
            if len(parts) < 4:
                continue
            
            location_str, form, tag, features = parts
            
            # Parse location
            loc = parse_location(location_str)
            if not loc:
                continue
            
            # Convert Buckwalter to Arabic
            arabic_form = buckwalter_to_arabic(form)
            
            # Parse features
            parsed_features = parse_features(features)
            
            # Build segment data
            segment = {
                'form': arabic_form,
                'buckwalter': form,
                'tag': tag,
                'location': location_str,
                **parsed_features
            }
            
            # Group by verse location
            verse_key = f"{loc['chapter']}:{loc['verse']}"
            word_key = f"{verse_key}:{loc['word']}"
            words_by_location[word_key].append(segment)
            
            # Build word dictionary (only for STEM segments)
            if parsed_features.get('type') == 'STEM':
                word_dictionary[arabic_form]['occurrences'].append(location_str)
                if 'root' in parsed_features:
                    word_dictionary[arabic_form]['roots'].add(parsed_features['root'])
                if 'lemma' in parsed_features:
                    word_dictionary[arabic_form]['lemmas'].add(parsed_features['lemma'])
                if 'pos' in parsed_features:
                    word_dictionary[arabic_form]['pos_tags'].add(parsed_features['pos'])
                
                # Store morphology for STEM words
                morph = {}
                morph_keys = ['gender', 'number', 'case', 'person', 'state', 
                             'aspect', 'mood', 'voice', 'form', 'derivation', 'special']
                for key in morph_keys:
                    if key in parsed_features:
                        morph[key] = parsed_features[key]
                if morph:
                    word_dictionary[arabic_form]['morphology'].append(morph)
            
            # Build root index
            if 'root' in parsed_features:
                root = parsed_features['root']
                root_index[root]['words'].add(arabic_form)
                root_index[root]['count'] += 1
            
            if line_num % 10000 == 0:
                print(f"  Processed {line_num} lines...")
    
    print(f"✓ Parsed {line_num} lines")
    print(f"✓ Found {len(word_dictionary)} unique STEM words")
    
    # Build complete words by combining segments
    print("\nBuilding complete words from segments...")
    complete_words = defaultdict(lambda: {
        'occurrences': [],
        'roots': set(),
        'lemmas': set(),
        'pos_tags': set(),
        'morphology': [],  # Store full morphology for each occurrence
        'prefix_tags': set(),  # Track prefix POS tags
        'suffix_tags': set(),  # Track suffix POS tags
    })
    
    for word_key, segments in words_by_location.items():
        # Combine all segments to form complete word
        complete_word = ''.join(seg['form'] for seg in segments)
        
        # Check for prefix and suffix segments
        prefix_segment = next((s for s in segments if s.get('type') == 'PREFIX'), None)
        suffix_segment = next((s for s in segments if s.get('type') == 'SUFFIX'), None)
        
        # Get data from STEM segment (has the linguistic info)
        stem_segment = next((s for s in segments if s.get('type') == 'STEM'), None)
        if stem_segment:
            complete_words[complete_word]['occurrences'].append(word_key)
            if 'root' in stem_segment:
                complete_words[complete_word]['roots'].add(stem_segment['root'])
            if 'lemma' in stem_segment:
                complete_words[complete_word]['lemmas'].add(stem_segment['lemma'])
            if 'pos' in stem_segment:
                complete_words[complete_word]['pos_tags'].add(stem_segment['pos'])
            
            # Track prefix/suffix features
            if prefix_segment:
                if 'prefix_feature' in prefix_segment:
                    complete_words[complete_word]['prefix_tags'].add(prefix_segment['prefix_feature'])
                elif 'pos' in prefix_segment:
                    complete_words[complete_word]['prefix_tags'].add(prefix_segment['pos'])
            if suffix_segment:
                if 'suffix_feature' in suffix_segment:
                    complete_words[complete_word]['suffix_tags'].add(suffix_segment['suffix_feature'])
                elif 'pos' in suffix_segment:
                    complete_words[complete_word]['suffix_tags'].add(suffix_segment['pos'])
            
            # Store ALL morphology features from STEM
            morph = {}
            morph_keys = ['gender', 'number', 'case', 'person', 'state', 
                         'aspect', 'mood', 'voice', 'verb_form', 'derivation', 'special']
            for key in morph_keys:
                if key in stem_segment:
                    morph[key] = stem_segment[key]
            if morph:
                complete_words[complete_word]['morphology'].append(morph)
    
    # Merge complete words into word_dictionary
    for word, data in complete_words.items():
        if word not in word_dictionary:  # Don't overwrite STEM entries
            word_dictionary[word] = data
        else:
            # Merge occurrences and morphology
            word_dictionary[word]['occurrences'].extend(data['occurrences'])
            word_dictionary[word]['roots'].update(data['roots'])
            word_dictionary[word]['lemmas'].update(data['lemmas'])
            word_dictionary[word]['pos_tags'].update(data['pos_tags'])
            # Add morphology if not present
            if 'morphology' not in word_dictionary[word]:
                word_dictionary[word]['morphology'] = []
            word_dictionary[word]['morphology'].extend(data['morphology'])
    
    print(f"✓ Found {len(word_dictionary)} total words (stems + complete)")
    print(f"✓ Found {len(root_index)} unique roots")
    
    return words_by_location, word_dictionary, root_index

def build_optimized_dictionary(word_dictionary, root_index):
    """Build optimized word dictionary for app usage with complete POS and morphological data"""
    print("\nBuilding optimized dictionary...")
    
    result = {}
    
    for word, data in word_dictionary.items():
        # Get most common root and lemma
        root = list(data['roots'])[0] if data['roots'] else None
        lemma = list(data['lemmas'])[0] if data['lemmas'] else None
        pos = list(data['pos_tags'])[0] if data['pos_tags'] else None
        
        # Get most common morphology (first occurrence)
        morph = data.get('morphology', [{}])[0] if data.get('morphology') else {}
        
        # Get prefix/suffix features if they exist
        prefix_feature = list(data.get('prefix_tags', set()))[0] if data.get('prefix_tags') else None
        suffix_feature = list(data.get('suffix_tags', set()))[0] if data.get('suffix_tags') else None
        
        # Build entry with complete metadata
        entry = {
            'lemma': buckwalter_to_arabic(lemma) if lemma else word,
            'lemma_transliteration': lemma,
            'root': buckwalter_to_arabic(root) if root else None,
            'root_transliteration': root,
            'pos': pos,
            'count': len(data['occurrences']),
            'locations': data['occurrences'][:10],  # First 10 occurrences for reference
        }
        
        # Add POS description if available
        if pos and pos in POS_TAGS:
            entry['pos_description'] = POS_TAGS[pos]
        
        # Add ALL morphology fields if they exist
        # Person, Gender, Number (PGN)
        if 'person' in morph:
            entry['person'] = morph['person']
        if 'gender' in morph:
            entry['gender'] = morph['gender']
        if 'number' in morph:
            entry['number'] = morph['number']
        
        # Case (for nominals)
        if 'case' in morph:
            entry['case'] = morph['case']
        
        # State (definite/indefinite)
        if 'state' in morph:
            entry['state'] = morph['state']
        
        # Verb features
        if 'aspect' in morph:
            entry['aspect'] = morph['aspect']
        if 'mood' in morph:
            entry['mood'] = morph['mood']
        if 'voice' in morph:
            entry['voice'] = morph['voice']
        if 'verb_form' in morph:
            entry['verb_form'] = morph['verb_form']
        
        # Derivation (participles, verbal nouns)
        if 'derivation' in morph:
            entry['derivation'] = morph['derivation']
        
        # Special tags
        if 'special' in morph:
            entry['special'] = morph['special']
        
        # Add prefix/suffix only if they exist
        if prefix_feature:
            entry['prefix'] = prefix_feature
        if suffix_feature:
            entry['suffix'] = suffix_feature
        
        result[word] = entry
    
    print(f"✓ Built dictionary with {len(result)} entries")
    return result

def build_root_index_optimized(root_index, word_dictionary):
    """Build optimized root index"""
    print("\nBuilding root index...")
    
    result = {}
    
    for root, data in root_index.items():
        arabic_root = buckwalter_to_arabic(root)
        
        # Get words with their lemmas
        words = []
        for word in data['words']:
            if word in word_dictionary:
                word_data = word_dictionary[word]
                lemma = list(word_data['lemmas'])[0] if word_data['lemmas'] else word
                words.append({
                    'word': word,
                    'lemma': buckwalter_to_arabic(lemma),
                    'count': len(word_data['occurrences'])
                })
        
        # Sort by frequency
        words.sort(key=lambda x: x['count'], reverse=True)
        
        result[arabic_root] = {
            'root_transliteration': root,
            'total_occurrences': data['count'],
            'unique_words': len(words),
            'words': words[:20]  # Top 20 most frequent words from this root
        }
    
    print(f"✓ Built root index with {len(result)} entries")
    return result

def main():
    # Paths
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    corpus_file = project_dir / 'quranic-corpus-morphology-0.4.txt'
    output_dir = project_dir / 'assets' / 'quran-data'
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Parse morphology file
    words_by_location, word_dictionary, root_index = parse_morphology_file(corpus_file)
    
    # Build optimized structures
    optimized_dict = build_optimized_dictionary(word_dictionary, root_index)
    optimized_roots = build_root_index_optimized(root_index, word_dictionary)
    
    # Save to JSON files
    print("\nSaving JSON files...")
    
    # Word dictionary (main lookup file)
    dict_file = output_dir / 'word-dictionary.json'
    with open(dict_file, 'w', encoding='utf-8') as f:
        json.dump(optimized_dict, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {dict_file} ({dict_file.stat().st_size / 1024:.1f} KB)")
    
    # Root index
    root_file = output_dir / 'root-index.json'
    with open(root_file, 'w', encoding='utf-8') as f:
        json.dump(optimized_roots, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {root_file} ({root_file.stat().st_size / 1024:.1f} KB)")
    
    # Statistics
    stats = {
        'total_words': len(optimized_dict),
        'total_roots': len(optimized_roots),
        'generated_at': '2025-10-20',
        'source': 'Quranic Arabic Corpus v0.4'
    }
    stats_file = output_dir / 'stats.json'
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {stats_file}")
    
    print("\n✅ Parsing complete!")
    print(f"\nGenerated files in: {output_dir}")
    print(f"  - word-dictionary.json ({len(optimized_dict)} words)")
    print(f"  - root-index.json ({len(optimized_roots)} roots)")
    print(f"  - stats.json")

if __name__ == '__main__':
    main()
