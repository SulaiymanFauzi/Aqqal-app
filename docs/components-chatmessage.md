# Chat Message Rendering (`components/chat/ChatMessage.tsx`)

Renders a single chat bubble with lightweight markdown-like parsing, link detection, grey-highlight emphasis, and tap-to-define behavior.

- **Location**: `components/chat/ChatMessage.tsx`
- **Prop**: `msg: Message` from `components/chat/types.ts`
- **Related**: `utils/api.defineTerm()`

## What It Does

- Converts simple markdown bullets/quotes to readable prefixes.
- Parses content into segments and renders them with styles:
  - `bold`: `**text**` or `__text__`
  - `mark` (grey highlight + tap for definition): `*text*` or `_text_`
  - `italic`: `<translation> ...` (treated as an inline translation note)
  - `link`: `[label](url)` and bare URLs
  - `text`: plain text
- Tapping a highlighted `mark` term fetches a concise definition from the backend and shows it in a popup.

## Pipeline Overview

1. `massageContent(input: string)`
   - Normalizes CRLF to `\n`.
   - Converts leading `*`/`-` bullets to `• `.
   - Converts leading `>` blockquotes to `▎ `.
2. `parseContent(prepared: string) → Segment[]`
   - Tokenizes into segments using regexes for md links, bold, italic, translation tag, and URLs.
   - Emphasis markers `*text*` or `_text_` become `type: 'mark'` to render grey highlights.
   - Bare URLs are detected and normalized (see below).
   - Safety guard ensures we never lose content if a regex fails to advance.
3. Render loop maps each `Segment` to a styled `<RNText/>` child within a themed bubble.

## Interaction: Tap-to-Define

- `onPressMark(term)` guards concurrent requests using a ref (`inFlightRef`).
- Calls `defineTerm(term)` from `utils/api.ts`.
- Shows the result via `Alert.alert(term, definition)`. If it fails, shows a fallback message.
- Accessibility: `accessibilityRole="button"` on highlighted terms.

## Links & URL Handling

- Markdown links: `[label](url)`.
- Bare URLs: detected by regex. Trailing punctuation like `).,!?;:"'` is trimmed.
- `normalizeUrl(url)`: adds `https://` if the string doesn’t start with `http(s)://`.
- Accessibility: `accessibilityRole="link"` on links; opening uses `Linking.openURL()`.

## Theming & Styles

- Theme via `Colors` and `useColorScheme()`.
- Bubbles:
  - User messages: tinted background, white text.
  - Assistant messages: neutral surface background.
- Emphasis highlight (`mark`):
  - Default: `backgroundColor: 'rgba(0,0,0,0.06)'` with rounded corners and light padding.
  - On tinted (user) bubble: `rgba(255,255,255,0.25)` to retain contrast.
- Bold uses heavier weight; italic uses `fontStyle: 'italic'` (primarily for `<translation>` content).

## Content Authoring Guide

- **Bold**: `**important**` or `__important__`.
- **Highlight (tap for definition)**: `*term*` or `_term_`.
- **Translation note**: `<translation> This is a note...` (applies to the rest of the line).
- **Links**: `[Aqqal](https://aqqal.com)` or just `aqqal.com/resources`.
- **Bullets**: Start lines with `- ` or `* ` to show as `•`.
- **Blockquotes**: Start lines with `>` to show a leading bar.

## Limitations

- Not a full Markdown renderer; nested/complex syntax (code blocks, tables, images) is not supported.
- Inline emphasis cannot contain newlines.
- URL normalization is minimal; non-HTTP schemes aren’t handled.

## Example

```text
**Hadith** research involves *isnad* and *matn*.
> See _tafsir_ sources at [quran.com](https://quran.com).
<translation> Note: terms are simplified.
```

- `**Hadith**` → bold
- `*isnad*`, `_matn_`, `_tafsir_` → grey highlights; tapping shows definitions from the backend
- `> ...` → blockquote marker rendered as `▎ `
- Link opens in the device browser
