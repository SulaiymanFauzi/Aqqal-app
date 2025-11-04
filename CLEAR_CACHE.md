# Clear Translation Cache

The translation cache is stored in memory. To clear it:

## Option 1: Restart with --clear
```bash
npx expo start --clear
```

This clears Metro bundler cache and forces a fresh load.

## Option 2: Add temporary code
Add this to your App.tsx or main entry point temporarily:

```typescript
import { quranLookup } from './utils/quran-lookup';

// Add this once at app startup
quranLookup.clearTranslationCache();
```

Then remove it after one run.

## Option 3: Console
If you have access to the console in the app:
```javascript
require('./utils/quran-lookup').quranLookup.clearTranslationCache();
```

---

**Note:** The cache is in-memory only, so a full app restart (kill and reopen) will also clear it naturally.
