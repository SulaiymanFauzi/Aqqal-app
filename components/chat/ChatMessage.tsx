import React from 'react';
import { Platform, StyleSheet, View as RNView, Linking, Text as RNText, Alert, Animated, Easing } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { Text } from '@/components/Themed';
import type { Message } from './types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { defineTerm } from '@/utils/api';

type Props = { msg: Message; onLayout?: (id: string, layoutY: number) => void };

type Segment = {
  type: 'text' | 'bold' | 'boldItalic' | 'link' | 'italic' | 'mark' | 'heading';
  text: string;
  url?: string;
  level?: number;
  children?: Segment[];
};

function segmentsToParagraphs(segmentList: Segment[]): Segment[][] {
  const result: Segment[][] = [];
  let current: Segment[] = [];

  const pushCurrent = () => {
    if (current.length > 0) {
      result.push(current);
      current = [];
    }
  };

  segmentList.forEach((seg) => {
    if (seg.type !== 'text') {
      current.push(seg);
      return;
    }

    const parts = seg.text.split(/\n{2,}/);
    const separators = seg.text.match(/\n{2,}/g) ?? [];

    parts.forEach((part, idx) => {
      if (part.length > 0) {
        current.push({ ...seg, text: part });
      }
      if (idx < parts.length - 1 || idx < separators.length) {
        pushCurrent();
      }
    });
  });

  pushCurrent();

  if (result.length > 0) return result;
  return segmentList.length > 0 ? [segmentList] : [];
}

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function massageContent(input: string): string {
  // Convert common markdown bullets and blockquotes to readable prefixes, preserve newlines.
  let s = input.replace(/\r\n/g, '\n');
  // Bullets starting with * or - at line starts
  s = s.replace(/(^|\n)(\s*)[\*\-]\s+/g, (_, prefix: string, indent: string) => `${prefix}${indent}• `);
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

function parseContent(content: string, options?: { allowHeadings?: boolean }): Segment[] {
  const segments: Segment[] = [];
  const text = content.replace(/\r\n/g, '\n');
  // Patterns
  const mdLink = /\[([^\]]+)\]\(([^)\s]+)\)/g; // [label](url) where url may be bare domain
  const allowHeadings = options?.allowHeadings !== false;
  const heading = allowHeadings ? /^(#{1,6})\s+(.+?)(?=\n|$)/gm : null;
  const boldItalicStar = /\*\*\*([\s\S]+?)\*\*\*/g; // ***bold+italic***
  const boldItalicUnderscore = /___([\s\S]+?)___/g; // ___bold+italic___
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
    if (heading) heading.lastIndex = i;
    boldItalicStar.lastIndex = i;
    boldItalicUnderscore.lastIndex = i;
    bold.lastIndex = i;
    bold2.lastIndex = i;
    translation.lastIndex = i;
    italic1.lastIndex = i;
    italic2.lastIndex = i;
    htmlMark.lastIndex = i;
    url.lastIndex = i;

    const m1 = mdLink.exec(text);
    const mHeading = heading ? heading.exec(text) : null;
    const m9 = boldItalicStar.exec(text);
    const m10 = boldItalicUnderscore.exec(text);
    const m2 = bold.exec(text);
    const m3 = url.exec(text);
    const m4 = bold2.exec(text);
    const m5 = translation.exec(text);
    const m6 = italic1.exec(text);
    const m7 = italic2.exec(text);
    const m8 = htmlMark.exec(text);

    // Find the earliest next match among the three
    const candidates = [m1, mHeading, m9, m10, m2, m3, m4, m5, m6, m7, m8]
      .filter(Boolean) as RegExpExecArray[];
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
    } else if (next === mHeading && heading) {
      const hashes = next[1] ?? '';
      const headingText = next[2]?.trim() ?? '';
      const inlineChildren = parseContent(headingText, { allowHeadings: false });
      segments.push({
        type: 'heading',
        text: headingText,
        level: Math.min(hashes.length, 6),
        children: inlineChildren,
      });
      i = heading.lastIndex;
    } else if (next === m9 || next === m10) {
      const tripleText = next[1] ?? '';
      segments.push({ type: 'boldItalic', text: tripleText });
      i = next === m9 ? boldItalicStar.lastIndex : boldItalicUnderscore.lastIndex;
    } else if (next === m2 || next === m4) {
      const boldText = next[1] ?? '';
      segments.push({ type: 'bold', text: boldText });
      // Advance index according to which matcher fired
      i = (next === m2 ? bold.lastIndex : bold2.lastIndex);
    } else if (next === m5) {
      // Extract translation content, stripping an optional closing tag on the same line
      let trText = next[1].trim().replace(/<\/ ?translation>/gi, '').trim();
      // Ensure translation starts on a new line if not already
      const needsNewline = next.index > 0 && text[next.index - 1] !== '\n';
      if (needsNewline) segments.push({ type: 'text', text: '\n' });
      segments.push({ type: 'italic', text: trText });
      i = translation.lastIndex;
    } else if (next === m6 || next === m7) {
      // Markdown emphasis marked as highlight: *text* or _text_
      const itText = next[1];
      segments.push({ type: 'italic', text: itText });
      i = (next === m6 ? italic1.lastIndex : italic2.lastIndex);
    } else if (next === m8) {
      const htmlText = next[1]?.trim() ?? '';
      if (htmlText) {
        const rawHtml = next[0] ?? '';
        const tagMatch = rawHtml.match(/^<\s*(\w+)/i);
        const tagName = tagMatch?.[1]?.toLowerCase();
        const segmentType = tagName === 'mark' ? 'mark' : 'italic';
        segments.push({ type: segmentType, text: htmlText });
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

const AnimatedDotsText = React.memo(function AnimatedDotsText({
  text,
  color,
  isActive,
  style,
}: {
  text: string;
  color?: string;
  isActive?: boolean;
  style?: TextStyle | TextStyle[];
}) {
  const [dotCount, setDotCount] = React.useState(0);

  React.useEffect(() => {
    if (!isActive) {
      setDotCount(0);
      return;
    }
    setDotCount(1);
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 420);
    return () => clearInterval(interval);
  }, [isActive]);

  const suffix = isActive && dotCount > 0 ? '.'.repeat(dotCount) : '';

  return (
    <RNText
      numberOfLines={1}
      ellipsizeMode="tail"
      style={[style, color ? { color } : null]}
    >
      {text}
      {suffix}
    </RNText>
  );
});

export default function ChatMessage({ msg, onLayout }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isUser = msg.role === 'user';
  const thoughtTitles = !isUser && Array.isArray(msg.thoughtTitles) ? msg.thoughtTitles.filter(Boolean) : [];
  const showThoughtSummary = thoughtTitles.length > 0;
  const showThoughtTitle = !isUser && !!msg.thoughtTitle;
  const hasThoughts = !isUser && !!msg.thoughts;
  const isStreaming = !isUser && !!msg.isStreaming;
  const showThoughtSection = !isUser && (showThoughtSummary || showThoughtTitle || isStreaming || hasThoughts);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const streamingOpacity = React.useRef(new Animated.Value(1)).current;
  const prevContentRef = React.useRef(msg.content);
  const prevLengthRef = React.useRef(msg.content?.length ?? 0);
  const [fadeSuffix, setFadeSuffix] = React.useState<string>('');
  const [stablePrefix, setStablePrefix] = React.useState<string>(msg.content ?? '');
  const [displayedSummary, setDisplayedSummary] = React.useState<string | null>(null);
  const summaryRef = React.useRef<string | null>(null);
  const cleanedThoughtTitles = React.useMemo(() => {
    if (!thoughtTitles.length) return [] as string[];
    return thoughtTitles
      .map((title) => title.replace(/\*+/g, '').trim())
      .filter(Boolean);
  }, [thoughtTitles]);

  const hasAnswerContent = !isUser && !!msg.content && msg.content.trim().length > 0;
  const upcomingSummary = React.useMemo(() => {
    if (thoughtTitles.length > 0) {
      const sanitized = cleanedThoughtTitles[cleanedThoughtTitles.length - 1];
      if (sanitized) return sanitized;
    }
    if (msg.thoughtTitle) return msg.thoughtTitle;
    return null;
  }, [cleanedThoughtTitles, thoughtTitles, msg.thoughtTitle]);

  React.useEffect(() => {
    if (!upcomingSummary) {
      if (isStreaming) {
        const placeholder = 'Thinking';
        if (summaryRef.current !== placeholder) {
          summaryRef.current = placeholder;
          setDisplayedSummary(placeholder);
          fadeAnim.setValue(0);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start();
        }
      } else {
        summaryRef.current = null;
        setDisplayedSummary(null);
        fadeAnim.setValue(0);
      }
      return;
    }
    if (summaryRef.current === upcomingSummary) {
      return;
    }
    summaryRef.current = upcomingSummary;
    setDisplayedSummary(upcomingSummary);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, upcomingSummary, isStreaming]);

  React.useEffect(() => {
    if (isUser) return;
    if (msg.content === prevContentRef.current) return;
    const previousLength = prevLengthRef.current;
    const currentLength = msg.content?.length ?? 0;
    if (!msg.content || currentLength <= previousLength) {
      prevContentRef.current = msg.content;
      prevLengthRef.current = currentLength;
      setStablePrefix(msg.content ?? '');
      setFadeSuffix('');
      return;
    }
    const newSuffix = msg.content.slice(previousLength);
    const newPrefix = msg.content.slice(0, previousLength);
    prevContentRef.current = msg.content;
    prevLengthRef.current = currentLength;
    setStablePrefix(newPrefix);
    setFadeSuffix(newSuffix);
    streamingOpacity.stopAnimation();
    streamingOpacity.setValue(0.1);
    Animated.timing(streamingOpacity, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isUser, msg.content, streamingOpacity]);

  const preparedContent = React.useMemo(() => massageContent(msg.content), [msg.content]);
  const segments = React.useMemo(() => parseContent(preparedContent), [preparedContent]);
  const cardTone = React.useMemo(() => {
    if (isUser) {
      return {
        backgroundColor: '#9ce4d6',
        borderColor: 'transparent',
        textColor: '#23312f',
        metaColor: 'rgba(35, 49, 47, 0.7)',
        linkColor: theme.accent,
        separator: 'rgba(35, 49, 47, 0.18)',
      };
    }
    return {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: theme.text,
      metaColor: theme.muted,
      linkColor: theme.tint,
      separator: theme.separator,
    };
  }, [isUser, theme]);

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

  const isArabic = React.useCallback(
    (value: string | null | undefined) =>
      typeof value === 'string' && /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(value),
    []
  );

  const renderTextWithArabic = React.useCallback(
    (value: string, key: string, baseStyle?: StyleProp<TextStyle>) => {
      const arabicRun = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const nodes: React.ReactNode[] = [];
      let runIndex = 0;

      while ((match = arabicRun.exec(value))) {
        if (match.index > lastIndex) {
          const latinChunk = value.slice(lastIndex, match.index);
          nodes.push(
            <React.Fragment key={`${key}-latin-${runIndex++}`}>{latinChunk}</React.Fragment>
          );
        }
        nodes.push(
          <RNText
            key={`${key}-arabic-${runIndex++}`}
            style={[baseStyle, styles.arabicText]}
          >
            {match[0]}
          </RNText>
        );
        lastIndex = arabicRun.lastIndex;
      }

      if (lastIndex < value.length) {
        nodes.push(
          <React.Fragment key={`${key}-latin-${runIndex++}`}>{value.slice(lastIndex)}</React.Fragment>
        );
      }

      if (nodes.length === 0) {
        return <React.Fragment key={key}>{value}</React.Fragment>;
      }

      if (nodes.length === 1 && typeof nodes[0] === 'string') {
        return nodes[0];
      }

      return <React.Fragment key={key}>{nodes}</React.Fragment>;
    },
    []
  );

  const renderInlineSegments = React.useCallback(
    (list: Segment[], keyPrefix: string, parentStyle?: StyleProp<TextStyle>): (string | React.ReactNode)[] =>
      list.map((seg, idx) => {
        const key = `${keyPrefix}-${idx}`;
        const isBullet = seg.type === 'text' && /^\s*[•]/.test(seg.text ?? '');
        const baseStyle: StyleProp<TextStyle> = [parentStyle, isBullet ? styles.bulletSpacing : null];
        if (seg.type === 'text') {
          if (isArabic(seg.text)) {
            return renderTextWithArabic(seg.text, key, baseStyle);
          }
          return (
            <RNText key={key} style={baseStyle}>
              {seg.text}
            </RNText>
          );
        }
        if (seg.type === 'bold') {
          const style: StyleProp<TextStyle> = [
            baseStyle,
            styles.bold,
            { color: cardTone.textColor },
            isUser ? styles.boldUser : null,
            isArabic(seg.text) ? styles.arabicText : null,
          ];
          return (
            <RNText key={key} style={style}>
              {seg.text}
            </RNText>
          );
        }
        if (seg.type === 'boldItalic') {
          const style: StyleProp<TextStyle> = [
            baseStyle,
            styles.boldItalic,
            { color: cardTone.textColor },
            isUser ? styles.boldUser : null,
            isArabic(seg.text) ? styles.arabicText : null,
          ];
          return (
            <RNText key={key} style={style}>
              {seg.text}
            </RNText>
          );
        }
        if (seg.type === 'italic') {
          const style: StyleProp<TextStyle> = [
            baseStyle,
            styles.italic,
            { color: cardTone.metaColor },
            isArabic(seg.text) ? styles.arabicText : null,
          ];
          return (
            <RNText key={key} style={style}>
              {seg.text}
            </RNText>
          );
        }
        if (seg.type === 'mark') {
          const style: StyleProp<TextStyle> = [
            baseStyle,
            styles.mark,
            isUser ? styles.markOnTint : null,
            isArabic(seg.text) ? styles.arabicText : null,
          ];
          return (
            <RNText
              key={key}
              style={style}
              onPress={() => onPressMark(seg.text)}
              accessibilityRole="button"
            >
              {seg.text}
            </RNText>
          );
        }
        if (seg.type === 'link') {
          const href = normalizeUrl(seg.url ?? seg.text);
          const style: StyleProp<TextStyle> = [
            baseStyle,
            styles.link,
            { color: cardTone.linkColor },
            isArabic(seg.text) ? styles.arabicText : null,
          ];
          return (
            <RNText
              key={key}
              style={style}
              onPress={() => Linking.openURL(href)}
              accessibilityRole="link"
            >
              {seg.text}
            </RNText>
          );
        }
        if (seg.type === 'heading') {
          const headingLevel = seg.level ?? 3;
          const headingStyle =
            headingLevel <= 1
              ? styles.heading1
              : headingLevel === 2
              ? styles.heading2
              : headingLevel === 3
              ? styles.heading3
              : styles.heading4;
          const headingHasArabic =
            (seg.children && seg.children.some((child) => isArabic(child.text))) || isArabic(seg.text);
          const headingStyles: StyleProp<TextStyle> = [
            headingStyle,
            { color: cardTone.textColor },
            headingHasArabic ? styles.arabicText : null,
          ];
          const childSegments = seg.children && seg.children.length > 0
            ? renderInlineSegments(seg.children, `${key}-child`, headingStyles)
            : seg.text;
          return (
            <RNText key={key} style={headingStyles}>
              {childSegments}
            </RNText>
          );
        }
        if (isArabic(seg.text)) {
          return renderTextWithArabic(seg.text, key, baseStyle);
        }
        return (
          <RNText key={key} style={baseStyle}>
            {seg.text}
          </RNText>
        );
      }),
    [cardTone.linkColor, cardTone.metaColor, cardTone.textColor, isArabic, isUser, onPressMark, renderTextWithArabic]
  );

  const paragraphs = React.useMemo(() => segmentsToParagraphs(segments), [segments]);

  const timeLabel = React.useMemo(() => {
    if (!msg.createdAt) return '';
    try {
      return new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      return '';
    }
  }, [msg.createdAt]);

  return (
    <RNView
      style={styles.row}
      onLayout={(event) => onLayout?.(msg.id, event.nativeEvent.layout.y)}
    >
      <RNView
        style={[
          styles.messageColumn,
          isUser ? styles.userColumn : styles.assistantColumn,
        ]}
      >
        <RNView
          style={[
            styles.card,
            isUser ? styles.userCard : styles.assistantCard,
            {
              backgroundColor: cardTone.backgroundColor,
              borderColor: cardTone.borderColor,
              borderWidth: cardTone.borderColor === 'transparent' ? 0 : StyleSheet.hairlineWidth,
            },
          ]}
        >
          {showThoughtSection && !hasAnswerContent && (
            <RNView style={styles.thoughtHeader}>
              {displayedSummary && (
                <Animated.View style={[styles.thoughtSummaryContainer, { opacity: fadeAnim }]}> 
                  <AnimatedDotsText
                    text={displayedSummary}
                    color={cardTone.metaColor}
                    isActive={!!isStreaming}
                    style={styles.thoughtHeaderText}
                  />
                </Animated.View>
              )}
              {showThoughtTitle && !showThoughtSummary && (
                <RNText style={[styles.thoughtTitle, { color: cardTone.metaColor }]
}
                >
                  {msg.thoughtTitle}
                </RNText>
              )}
            </RNView>
          )}
          {msg.toolStatus === 'active' && !!msg.isStreaming && (
            <RNView style={styles.toolStatusContainer}>
              <AnimatedDotsText
                text="Using tools"
                color={cardTone.metaColor}
                isActive
                style={styles.toolStatusText}
              />
            </RNView>
          )}
          {!!msg.toolLogs?.length && (
            <RNView
              style={[
                styles.toolLogsContainer,
                msg.toolStatus === 'active' && styles.toolLogsDuringStream,
              ]}
            >
              <RNText style={[styles.toolLogsTitle, { color: cardTone.metaColor }]}>Tool activity</RNText>
              {msg.toolLogs.map((entry, index) => (
                <RNText key={index} style={[styles.toolLogLine, { color: cardTone.metaColor }]}>
                  {entry}
                </RNText>
              ))}
            </RNView>
          )}
          {isUser ? (
            paragraphs.map((paragraphSegments, idx) => {
              const baseParagraphStyle: StyleProp<TextStyle> = [
                { color: cardTone.textColor },
                isUser ? styles.userText : null,
              ];
              return (
                <Text
                  key={`paragraph-${idx}`}
                  style={[
                    styles.content,
                    { color: cardTone.textColor },
                    isUser && styles.userText,
                    idx < paragraphs.length - 1 ? styles.paragraphSpacing : null,
                  ]}
                >
                  {renderInlineSegments(paragraphSegments, `paragraph-${idx}`, baseParagraphStyle)}
                </Text>
              );
            })
          ) : (
            (() => {
              const stableSegments = segmentsToParagraphs(parseContent(massageContent(stablePrefix)));
              const fadingSegments = segmentsToParagraphs(parseContent(massageContent(fadeSuffix)));
              return (
                <>
                  {stableSegments.map((paragraphSegments, idx) => {
                    const baseParagraphStyle: StyleProp<TextStyle> = [{ color: cardTone.textColor }];
                    const isLastStable = idx === stableSegments.length - 1;
                    const hasFade = fadingSegments.length > 0;
                    const applySpacing = idx < stableSegments.length - 1 || hasFade;
                    return (
                      <Text
                        key={`stable-paragraph-${idx}`}
                        style={[
                          styles.content,
                          { color: cardTone.textColor },
                          applySpacing ? styles.paragraphSpacing : null,
                        ]}
                      >
                        {renderInlineSegments(paragraphSegments, `stable-paragraph-${idx}`, baseParagraphStyle)}
                      </Text>
                    );
                  })}
                  {!!fadeSuffix && fadingSegments.length > 0 && (
                    <Animated.View style={{ opacity: streamingOpacity }}>
                      {fadingSegments.map((paragraphSegments, idx) => {
                        const baseParagraphStyle: StyleProp<TextStyle> = [{ color: cardTone.textColor }];
                        return (
                          <Text
                            key={`fade-paragraph-${idx}`}
                            style={[
                              styles.content,
                              { color: cardTone.textColor },
                              idx < fadingSegments.length - 1 ? styles.paragraphSpacing : null,
                            ]}
                          >
                            {renderInlineSegments(paragraphSegments, `fade-paragraph-${idx}`, baseParagraphStyle)}
                          </Text>
                        );
                      })}
                    </Animated.View>
                  )}
                </>
              );
            })()
          )}
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
  },
  assistantColumn: {
    alignItems: 'center',
  },
  userColumn: {
    alignItems: 'flex-end',
  },
  card: {
    maxWidth: 720,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    shadowColor: '#051417',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === 'web' ? 0.05 : 0.12,
    shadowRadius: 16,
    elevation: 2,
    alignSelf: 'stretch',
  },
  userCard: {
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 0,
    alignSelf: 'flex-end',
    maxWidth: '66.6667%',
    paddingHorizontal: 20,
    width: undefined,
    flexShrink: 1,
  },
  assistantCard: {
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    shadowOpacity: 0,
    elevation: 0,
    width: '100%',
  },
  thoughtTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  thoughtHeader: {
    marginBottom: 10,
  },
  thoughtToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  thoughtToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  thoughtToggleIcon: {
    fontSize: 14,
  },
  thoughtToggleText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  thoughtToggleChevron: {
    marginLeft: 'auto',
    fontSize: 16,
  },
  thoughtList: {
    marginBottom: 12,
    gap: 6,
  },
  thoughtSummaryContainer: {
    marginTop: 6,
  },
  thoughtHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  toolStatusContainer: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: 'rgba(2,117,104,0.08)',
  },
  toolStatusText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  toolLogsContainer: {
    marginTop: 6,
    gap: 4,
  },
  toolLogsDuringStream: {
    opacity: 0.85,
  },
  toolLogsTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolLogLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  thoughtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thoughtItemActive: {
    opacity: 1,
  },
  thoughtBullet: {
    fontSize: 12,
  },
  thoughtItemText: {
    fontSize: 13,
    flex: 1,
  },
  content: {
    fontSize: 21,
    lineHeight: 33,
    letterSpacing: 0.15,
    marginBottom: 15,
    fontFamily: Platform.OS === 'web' ? 'Canva Sans, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans' : undefined,
  },
  userText: {
    color: '#23312f',
    fontFamily: Platform.OS === 'web' ? 'Canva Sans, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans' : undefined,
  },
  userContentWidth: {
    alignSelf: 'flex-end',
    maxWidth: '66.6667%',
  },
  paragraphSpacing: {
    marginBottom: 40,
  },
  bulletSpacing: {
    marginBottom: 10,
  },
  bold: {
    fontWeight: '700',
  },
  boldItalic: {
    fontWeight: '700',
    fontStyle: 'italic',
  },
  heading1: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  heading3: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  heading4: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  arabicText: {
    fontFamily:
      Platform.OS === 'web'
        ? 'Amiri Quran, Scheherazade New, "Lateef", "Noto Naskh Arabic", "Qalam Majalla", serif'
        : 'Geeza Pro',
    fontSize: Platform.OS === 'web' ? undefined : 18,
    letterSpacing: Platform.OS === 'web' ? 0.2 : 0.1,
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
