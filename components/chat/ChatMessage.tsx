import React from 'react';
import { Platform, StyleSheet, View as RNView, Linking, Text as RNText, Alert } from 'react-native';
import { Text } from '@/components/Themed';
import type { Message } from './types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { defineTerm } from '@/utils/api';

type Props = { msg: Message };

type Segment = { type: 'text' | 'bold' | 'link' | 'italic' | 'mark'; text: string; url?: string };

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function massageContent(input: string): string {
  // Convert common markdown bullets and blockquotes to readable prefixes, preserve newlines.
  let s = input.replace(/\r\n/g, '\n');
  // Bullets starting with * or - at line starts
  s = s.replace(/(^|\n)\s*[\*\-]\s+/g, '$1• ');
  // Blockquotes starting with > at line starts (support no-space after >)
  s = s.replace(/(^|\n)\s*>\s*/g, '$1▎ ');
  return s;
}

function expandQuotedHighlights(segments: Segment[]): Segment[] {
  const singleQuotePattern = /(['‘])([^'‘’\s]{2,30}?)(['’])/g; // short single-word/phrase without spaces
  const expanded: Segment[] = [];

  for (const seg of segments) {
    if (seg.type !== 'text') {
      expanded.push(seg);
      continue;
    }

    const text = seg.text;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    singleQuotePattern.lastIndex = 0;
    let matchCount = 0;

    while ((match = singleQuotePattern.exec(text))) {
      matchCount += 1;
      const [full, openQuote, inner, closeQuote] = match;
      const start = match.index;
      const end = start + full.length;

      // Skip if term is empty or contains spaces (multi-word) to avoid wide highlights
      const trimmedInner = inner.trim();
      if (!trimmedInner || /\s/.test(trimmedInner)) {
        continue;
      }

      if (start > lastIndex) {
        expanded.push({ type: 'text', text: text.slice(lastIndex, start) });
      }

      if (openQuote) {
        expanded.push({ type: 'text', text: openQuote });
      }

      const term = trimmedInner;
      if (term) {
        expanded.push({ type: 'mark', text: term });
      }

      if (closeQuote) {
        expanded.push({ type: 'text', text: closeQuote });
      }

      lastIndex = end;
    }

    // If we didn't match any single-quoted term, keep text as-is
    if (matchCount === 0) {
      expanded.push(seg);
      continue;
    }

    if (lastIndex < text.length) {
      expanded.push({ type: 'text', text: text.slice(lastIndex) });
    }
  }

  return expanded;
}

function parseContent(content: string): Segment[] {
  const segments: Segment[] = [];
  const text = content.replace(/\r\n/g, '\n');
  // Patterns
  const mdLink = /\[([^\]]+)\]\(([^)\s]+)\)/g; // [label](url) where url may be bare domain
  const bold = /\*\*([\s\S]+?)\*\*/g; // **bold** (multi-line)
  const bold2 = /__([\s\S]+?)__/g; // __bold__ (multi-line)
  const htmlMark = /<(?:mark|em)\b[^>]*>([\s\S]*?)<\/(?:mark|em)>/gi; // HTML emphasis (with attrs) → grey highlight
  const translation = /<translation>\s*([\s\S]*?)(?=\n|$)/gi; // <translation>... to end of line
  const italic1 = /\*([^*\n]+?)\*/g; // *italic* (avoid matching **bold** and no newline inside)
  const italic2 = /_([^_\n]+?)_/g; // _italic_ (avoid matching __bold__ and no newline inside)
  const url = /(?:(?:https?:\/\/|www\.)[^\s<>()]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b(?:\/[^\s<>()]*)?)/gi; // bare links

  let i = 0;
  const n = text.length;
  while (i < n) {
    mdLink.lastIndex = i;
    bold.lastIndex = i;
    bold2.lastIndex = i;
    translation.lastIndex = i;
    italic1.lastIndex = i;
    italic2.lastIndex = i;
    htmlMark.lastIndex = i;
    url.lastIndex = i;

    const m1 = mdLink.exec(text);
    const m2 = bold.exec(text);
    const m3 = url.exec(text);
    const m4 = bold2.exec(text);
    const m5 = translation.exec(text);
    const m6 = italic1.exec(text);
    const m7 = italic2.exec(text);
    const m8 = htmlMark.exec(text);

    // Find the earliest next match among the three
    const candidates = [m1, m2, m3, m4, m5, m6, m7, m8].filter(Boolean) as RegExpExecArray[];
    if (candidates.length === 0) {
      segments.push({ type: 'text', text: text.slice(i) });
      break;
    }
    let next = candidates[0];
    for (const m of candidates) {
      if (m.index < next.index) next = m;
    }

    if (next.index > i) {
      segments.push({ type: 'text', text: text.slice(i, next.index) });
    }

    if (next === m1) {
      const label = next[1];
      const href = next[2];
      segments.push({ type: 'link', text: label, url: href });
      i = mdLink.lastIndex;
    } else if (next === m2 || next === m4) {
      const boldText = next[1];
      segments.push({ type: 'bold', text: boldText });
      // Advance index according to which matcher fired
      i = (next === m2 ? bold.lastIndex : bold2.lastIndex);
    } else if (next === m5) {
      // Extract translation content, stripping an optional closing tag on the same line
      let trText = next[1].trim().replace(/<\/?translation>/gi, '').trim();
      // Ensure translation starts on a new line if not already
      const needsNewline = next.index > 0 && text[next.index - 1] !== '\n';
      if (needsNewline) segments.push({ type: 'text', text: '\n' });
      segments.push({ type: 'italic', text: trText });
      i = translation.lastIndex;
    } else if (next === m6 || next === m7) {
      // Markdown emphasis marked as highlight: *text* or _text_
      const itText = next[1];
      segments.push({ type: 'mark', text: itText });
      i = (next === m6 ? italic1.lastIndex : italic2.lastIndex);
    } else if (next === m8) {
      const htmlText = next[1]?.trim() ?? '';
      if (htmlText) {
        segments.push({ type: 'mark', text: htmlText });
      }
      i = htmlMark.lastIndex;
    } else {
      // Plain URL: trim trailing punctuation like ).,!?;:
      let raw = next[0];
      let trailing = '';
      const trimmed = raw.replace(/[)\],.!?;:\"'“”»«،؛؟]+$/g, (t) => {
        trailing = t + trailing;
        return '';
      });
      segments.push({ type: 'link', text: trimmed, url: trimmed });
      if (trailing) segments.push({ type: 'text', text: trailing });
      i = (url.lastIndex = next.index + raw.length);
    }

    // Safety guard: if no progress was made, append the rest as text to avoid truncation
    if (i <= next.index) {
      segments.push({ type: 'text', text: text.slice(next.index) });
      break;
    }
  }
  return expandQuotedHighlights(segments);
}

export default function ChatMessage({ msg }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isUser = msg.role === 'user';
  const preparedContent = React.useMemo(() => massageContent(msg.content), [msg.content]);
  const segments = React.useMemo(() => parseContent(preparedContent), [preparedContent]);
  const inFlightRef = React.useRef(false);

  const onPressMark = React.useCallback(async (term: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const definition = await defineTerm(term);
      Alert.alert(term, definition || 'No definition found.');
    } catch (e: any) {
      Alert.alert(term, 'Failed to fetch definition.');
    } finally {
      inFlightRef.current = false;
    }
  }, []);
  const cardTone = React.useMemo(() => {
    if (isUser) {
      return {
        backgroundColor: theme.tint,
        borderColor: 'rgba(255,255,255,0.35)',
        textColor: '#f6fdfa',
        metaColor: 'rgba(255,255,255,0.75)',
        linkColor: theme.accent,
      };
    }
    return {
      backgroundColor: theme.surface,
      borderColor: theme.separator,
      textColor: theme.text,
      metaColor: theme.muted,
      linkColor: theme.tint,
    };
  }, [isUser, theme]);

  const timeLabel = React.useMemo(() => {
    if (!msg.createdAt) return '';
    try {
      return new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      return '';
    }
  }, [msg.createdAt]);

  return (
    <RNView style={styles.row}>
      <RNView style={styles.messageColumn}>
        <RNView
          style={[styles.card, { backgroundColor: cardTone.backgroundColor }]}
        >
          <RNView style={styles.cardHeader}>
            <RNText style={[styles.roleLabel, isUser ? styles.roleLabelUser : styles.roleLabelAssistant]}>
              {isUser ? 'You' : 'Aqqal'}
            </RNText>
            {!!timeLabel && (
              <RNText style={[styles.timestamp, { color: cardTone.metaColor, marginLeft: 8 }]}>{timeLabel}</RNText>
            )}
          </RNView>
          <Text style={[styles.content, { color: cardTone.textColor }, isUser && styles.userText]}>
            {segments.map((seg, idx) => {
              if (seg.type === 'bold') {
                return (
                  <RNText key={idx} style={[styles.bold, { color: cardTone.textColor }, isUser && styles.boldUser]}>
                    {seg.text}
                  </RNText>
                );
              }
              if (seg.type === 'italic') {
                return (
                  <RNText key={idx} style={[styles.italic, { color: cardTone.metaColor }]}>
                    {seg.text}
                  </RNText>
                );
              }
              if (seg.type === 'mark') {
                return (
                  <RNText
                    key={idx}
                    style={[styles.mark, isUser && styles.markOnTint]}
                    onPress={() => onPressMark(seg.text)}
                    accessibilityRole="button"
                  >
                    {seg.text}
                  </RNText>
                );
              }
              if (seg.type === 'link') {
                const href = normalizeUrl(seg.url!);
                return (
                  <RNText
                    key={idx}
                    style={[styles.link, { color: cardTone.linkColor }]}
                    onPress={() => Linking.openURL(href)}
                    accessibilityRole="link"
                  >
                    {seg.text}
                  </RNText>
                );
              }
              return (
                <RNText key={idx} style={{ color: cardTone.textColor }}>
                  {seg.text}
                </RNText>
              );
            })}
          </Text>
        </RNView>
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageColumn: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 720,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    shadowColor: '#051417',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === 'web' ? 0.05 : 0.12,
    shadowRadius: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  roleLabelAssistant: {
    color: '#027568',
  },
  roleLabelUser: {
    color: '#ffffff',
  },
  timestamp: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
    color: '#2f2e34',
  },
  userText: {
    color: '#fff',
  },
  bold: {
    fontWeight: '700',
  },
  boldUser: {
    // keep bold readable on tinted background
  },
  italic: {
    fontStyle: 'italic',
  },
  mark: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  markOnTint: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  link: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
