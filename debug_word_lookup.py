#!/usr/bin/env python3
"""
Debug script to test word lookup and find encoding issues
"""

import json
import unicodedata

# Load dictionary
with open('assets/quran-data/word-dictionary.json', 'r') as f:
    d = json.load(f)

print("=" * 80)
print("WORD LOOKUP DEBUGGER")
print("=" * 80)

# The word from the user's screenshot
user_word = 'ٱلسَّمَٰوَٰتِ'

print(f"\n1. USER'S WORD:")
print(f"   Text: {user_word}")
print(f"   Length: {len(user_word)}")
print(f"   Bytes (hex): {user_word.encode('utf-8').hex()}")
print(f"   Unicode points: {[f'{c} (U+{ord(c):04X})' for c in user_word]}")

# Try to find it in dictionary
print(f"\n2. EXACT MATCH TEST:")
print(f"   user_word in d: {user_word in d}")

# Find similar words
print(f"\n3. SEARCHING FOR SIMILAR WORDS:")
matches = []
for k in d.keys():
    if 'سَّمَٰوَٰت' in k and k.startswith('ٱل'):
        matches.append(k)

print(f"   Found {len(matches)} matches")

for i, match in enumerate(matches, 1):
    print(f"\n   Match {i}:")
    print(f"   Text: {match}")
    print(f"   Length: {len(match)}")
    print(f"   Bytes (hex): {match.encode('utf-8').hex()}")
    print(f"   Unicode points: {[f'{c} (U+{ord(c):04X})' for c in match]}")
    print(f"   Equals user_word: {match == user_word}")
    print(f"   Bytes equal: {match.encode('utf-8') == user_word.encode('utf-8')}")
    
    # Character by character comparison
    print(f"\n   CHARACTER COMPARISON:")
    max_len = max(len(match), len(user_word))
    for j in range(max_len):
        dict_char = match[j] if j < len(match) else '(none)'
        user_char = user_word[j] if j < len(user_word) else '(none)'
        dict_code = f'U+{ord(match[j]):04X}' if j < len(match) else 'N/A'
        user_code = f'U+{ord(user_word[j]):04X}' if j < len(user_word) else 'N/A'
        status = '✓' if dict_char == user_char else '✗'
        print(f"   [{j}] Dict: {dict_char} ({dict_code}) | User: {user_char} ({user_code}) {status}")

# Test Unicode normalization
print(f"\n4. UNICODE NORMALIZATION TEST:")
for form in ['NFC', 'NFD', 'NFKC', 'NFKD']:
    normalized = unicodedata.normalize(form, user_word)
    print(f"   {form}: {normalized in d} | Bytes: {normalized.encode('utf-8').hex()}")

# Test stripping diacritics
print(f"\n5. STRIPPED MATCHING TEST:")
import re

def strip_diacritics(text):
    normalized = unicodedata.normalize('NFC', text)
    return re.sub(r'[\u064B-\u065F\u0670]', '', normalized).replace('\u0671', '\u0627').replace('\u0649', '\u064A')

user_stripped = strip_diacritics(user_word)
print(f"   User stripped: {user_stripped}")
print(f"   Bytes: {user_stripped.encode('utf-8').hex()}")

# Find matches in dictionary
stripped_matches = []
for k in d.keys():
    k_stripped = strip_diacritics(k)
    if k_stripped == user_stripped:
        stripped_matches.append(k)

print(f"   Found {len(stripped_matches)} matches after stripping")
for match in stripped_matches[:5]:
    print(f"   - {match}")

print("\n" + "=" * 80)
print("RECOMMENDATION:")
if user_word in d:
    print("✓ Word found! No issues.")
elif len(matches) > 0:
    print("✗ Word exists but encoding differs. Check Unicode normalization.")
elif len(stripped_matches) > 0:
    print("✓ Word found after stripping diacritics. Lookup should work.")
else:
    print("✗ Word not found at all. May need to regenerate dictionary.")
print("=" * 80)
