import React from 'react';
import { StyleSheet, Platform, Text as RNText, View, Animated, TouchableOpacity } from 'react-native';
import { FONT_FAMILY, ARABIC_FONT_FAMILY } from './constants';
import { isArabicText, openURL } from './utils';
import { defineTerm } from '@/utils/api';
import { Alert } from 'react-native';
import { CitationBadge } from './CitationBadge';
import { QuranVerseBox } from './QuranVerseBox';
import { WordTooltip } from './WordTooltip';
import { parseVerseReference, getWordTranslation } from '@/utils/word-translations';

interface CardTone {
  textColor: string;
  metaColor: string;
  linkColor: string;
}

export function useMarkdownConfig(
  isUser: boolean, 
  cardTone: CardTone,
  onArabicWordPress?: (word: string) => void,
  showWordBoxes?: boolean
) {
  const inFlightRef = React.useRef(false);
  const underlineOpacity = React.useRef(new Animated.Value(0)).current;
  
  // Track current verse reference for word translations
  const currentVerseRef = React.useRef<{ chapter: number; verse: number } | null>(null);
  const [tooltipVisible, setTooltipVisible] = React.useState(false);
  const [tooltipData, setTooltipData] = React.useState<{ translation: string; arabicWord: string } | null>(null);

  // Animate underline opacity when showWordBoxes changes
  React.useEffect(() => {
    Animated.timing(underlineOpacity, {
      toValue: showWordBoxes ? 1 : 0,
      duration: 100,  
      useNativeDriver: false, // textDecorationColor doesn't support native driver
    }).start();
  }, [showWordBoxes, underlineOpacity]);

  // Interpolate box border and background opacity
  const boxBorderColor = underlineOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(20, 184, 166, 0)', 'rgba(20, 184, 166, 0.3)'],
  });

  const boxBackgroundColor = underlineOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(20, 184, 166, 0)', 'rgba(20, 184, 166, 0.08)'],
  });

  // Inline Arabic text style
  const inlineArabicStyle = {
    fontFamily: ARABIC_FONT_FAMILY,
    fontSize: Platform.OS === 'web' ? 20 : 18,
    lineHeight: Platform.OS === 'web' ? 50 : 38,
    fontWeight: Platform.OS === 'web' ? ('400' as const) : undefined,
    color: '#006f60', // Darker teal tint to signal interactivity
    ...(Platform.OS !== 'web' && {
      writingDirection: 'ltr' as const,
    }),
  };

  // Recursively apply Arabic style to text nodes
  const applyArabicStyle = React.useCallback((children: any, parentKey: string = ''): any => {
    if (typeof children === 'string') {
      const hasArabic = isArabicText(children);
      if (hasArabic) {
        // Split Arabic text into words for individual clicking
        const words = children.split(/(\s+)/);
        return (
          <View key={`arabic-${parentKey}`} style={{ flexDirection: 'row-reverse', flexWrap: 'wrap' }}>
            {words.map((word, idx) => {
              // Keep whitespace as-is - render as invisible spacer
              if (/^\s+$/.test(word)) {
                return <View key={`${parentKey}-space-${idx}`} style={{ width: 0 }} />;
              }
              
              // Helper function to check if a word is only waqf signs/diacritics
              const isOnlyWaqfOrDiacritics = (w: string) => {
                // Remove all waqf signs and diacritical marks (Unicode range U+06D6 to U+06ED)
                const stripped = w.replace(/[\u06D6-\u06ED]/g, '').trim();
                return stripped.length === 0;
              };
              
              // Calculate word index (excluding whitespace and waqf-only tokens)
              // This ensures the index matches the translation data
              const wordIndex = words.slice(0, idx).filter(w => 
                !/^\s+$/.test(w) && !isOnlyWaqfOrDiacritics(w)
              ).length;
              
              // Get translation if we have a verse reference
              let translation: string | null = null;
              if (currentVerseRef.current) {
                translation = getWordTranslation(
                  currentVerseRef.current.chapter,
                  currentVerseRef.current.verse,
                  wordIndex
                );
              }
              
              // Make Arabic words clickable with animated box and long-press tooltip
              return (
                <Animated.View
                  key={`${parentKey}-word-${idx}`}
                  style={{
                    borderRadius: 0,
                    borderWidth: 1,
                    borderColor: boxBorderColor,
                    backgroundColor: boxBackgroundColor,
                    paddingHorizontal: 0,
                    paddingVertical: 2,
                    marginHorizontal: 1,
                  }}
                >
                  <RNText
                    style={inlineArabicStyle}
                    onPress={() => onArabicWordPress?.(word.trim())}
                    onLongPress={() => {
                      if (translation) {
                        setTooltipData({ translation, arabicWord: word.trim() });
                        setTooltipVisible(true);
                      }
                    }}
                  >
                    {word}
                  </RNText>
                </Animated.View>
              );
            })}
          </View>
        );
      }
      return children;
    }
    
    if (Array.isArray(children)) {
      return children.map((child: any, idx: number) => {
        const childKey = `${parentKey}-${idx}`;
        if (React.isValidElement(child)) {
          const element = child as React.ReactElement<any>;
          return React.cloneElement(element, {
            key: childKey,
            children: applyArabicStyle(element.props?.children, childKey)
          });
        }
        if (typeof child === 'string') {
          return applyArabicStyle(child, childKey);
        }
        return child;
      });
    }
    
    if (React.isValidElement(children)) {
      const element = children as React.ReactElement<any>;
      return React.cloneElement(element, {
        children: applyArabicStyle(element.props?.children, parentKey)
      });
    }
    
    return children;
  }, [inlineArabicStyle, onArabicWordPress]);

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

  // Custom renderer for inline code
  const renderCodeInline = React.useCallback(
    (node: any, children: any, parent: any, styles: any) => {
      const text = node.content || '';
      const hasArabic = isArabicText(text);
      
      const renderTextWithBold = (str: string) => {
        const parts = str.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const boldText = part.slice(2, -2);
            return (
              <RNText key={index} style={{ fontWeight: '700' }}>
                {boldText}
              </RNText>
            );
          }
          return part;
        });
      };
      
      return (
        <RNText
          key={node.key}
          style={[
            styles.code_inline,
            hasArabic && { fontFamily: ARABIC_FONT_FAMILY },
            isUser && { color: 'rgba(35,49,47,1)', borderBottomColor: 'rgba(35,49,47,0.3)' }
          ]}
          onPress={() => onPressMark(text)}
          accessibilityRole="button"
        >
          {renderTextWithBold(text)}
        </RNText>
      );
    },
    [isUser, onPressMark]
  );

  // Custom renderer for paragraphs
  const renderParagraph = React.useCallback(
    (node: any, children: any, parent: any, styles: any) => {
      const styledChildren = applyArabicStyle(children);
      return (
        <RNText key={node.key} style={styles.paragraph}>
          {styledChildren}
        </RNText>
      );
    },
    [applyArabicStyle]
  );

  const handleLinkPress = React.useCallback((url: string) => {
    openURL(url);
    return false;
  }, []);

  // Track citations to group consecutive ones
  const citationGroups = React.useMemo(() => new Map<string, any[]>(), []);

  // Custom link renderer to handle citations and Quran verse links
  const renderLink = React.useCallback(
    (node: any, children: any, parent: any, styles: any) => {
      const href = node.attributes?.href || '';
      const title = node.attributes?.title || '';
      
      let linkText = '';
      if (node.children && node.children.length > 0 && node.children[0].content) {
        linkText = node.children[0].content;
      }
      
      // Check if this is a Quran verse link and update current verse reference
      const verseRef = parseVerseReference(linkText + ' ' + href);
      if (verseRef) {
        currentVerseRef.current = verseRef;
        
        // Render elegant inline header for Quran verse links
        return (
          <TouchableOpacity
            key={node.key}
            onPress={() => handleLinkPress(href)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 4,
              paddingHorizontal: 8,
              marginBottom: 8,
              marginTop: -12,
              alignSelf: 'flex-start',
              borderRadius: 6,
              backgroundColor: 'rgba(20, 184, 166, 0.08)',
            }}
          >
            <RNText
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: '#0d9488',
                letterSpacing: 0.2,
                marginRight: 4,
              }}
            >
              {linkText}
            </RNText>
            <RNText
              style={{
                fontSize: 11,
                color: '#0d9488',
                opacity: 0.7,
              }}
            >
              ↗
            </RNText>
          </TouchableOpacity>
        );
      }
      
      const citationMatch = linkText.match(/^\[?(\d+)\]?$/);
      if (citationMatch && href.includes('vertexaisearch.cloud.google.com')) {
        const number = parseInt(citationMatch[1]);
        const citation = { number, url: href, title: title || 'Source' };
        
        const parentKey = parent?.key || 'root';
        const nodeIndex = node.index || 0;
        const groupKey = `${parentKey}-${nodeIndex}`;
        
        const prevGroupKey = `${parentKey}-${nodeIndex - 1}`;
        const prevGroup = citationGroups.get(prevGroupKey);
        
        if (prevGroup && nodeIndex > 0) {
          prevGroup.push(citation);
          citationGroups.set(groupKey, prevGroup);
          return null;
        } else {
          let group = citationGroups.get(groupKey);
          if (!group) {
            group = [citation];
            citationGroups.set(groupKey, group);
          }
          return (
            <CitationBadge
              key={`citation-group-${groupKey}`}
              citations={group}
            />
          );
        }
      }
      
      return (
        <RNText
          key={node.key}
          style={styles.link}
          onPress={() => handleLinkPress(href)}
        >
          {children}
        </RNText>
      );
    },
    [handleLinkPress, citationGroups]
  );

  // Markdown styles
  const markdownStyles = React.useMemo(() => StyleSheet.create({
    body: {
      color: isUser ? '#23312f' : cardTone.textColor,
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: 0.1,
      fontFamily: FONT_FAMILY,
      flexWrap: 'wrap',
      flexShrink: 1,
      width: '100%',
      maxWidth: '100%',
    },
    heading1: {
      fontSize: 26,
      fontWeight: '700',
      lineHeight: 34,
      marginTop: 20,
      marginBottom: 12,
      color: cardTone.textColor,
    },
    heading2: {
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 30,
      marginTop: 18,
      marginBottom: 10,
      color: cardTone.textColor,
    },
    heading3: {
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 28,
      marginTop: 0,
      marginBottom: 0,
      paddingTop: 15,
      paddingBottom: 15,
      color: cardTone.textColor,
    },
    heading4: {
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 26,
      marginTop: 14,
      marginBottom: 8,
      color: cardTone.textColor,
    },
    heading5: {
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 24,
      marginTop: 12,
      marginBottom: 6,
      color: cardTone.textColor,
    },
    heading6: {
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
      marginTop: 10,
      marginBottom: 6,
      color: cardTone.textColor,
    },
    paragraph: {
      marginTop: isUser ? 0 : 10,
      marginBottom: isUser ? 0 : 26,
      color: isUser ? '#23312f' : cardTone.textColor,
      flexWrap: 'wrap',
      flexShrink: 1,
      width: '100%',
      maxWidth: '100%',
    },
    strong: {
      fontWeight: '700',
      color: cardTone.textColor,
      flexShrink: 0,
    },
    em: {
      fontStyle: 'italic',
      color: cardTone.metaColor,
    },
    link: {
      textDecorationLine: 'underline',
      fontWeight: '600',
      color: cardTone.linkColor,
    },
    code_inline: {
      color: 'rgba(2,117,104,1)',
      fontSize: 16,
      fontWeight: '500',
      fontFamily: FONT_FAMILY,
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(2,117,104,0.25)',
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: 2,
      borderRadius: 10,
      flexShrink: 0,
    },
    code_block: {
      backgroundColor: isUser ? 'rgba(35,49,47,0.08)' : 'rgba(2,117,104,0.08)',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      flexShrink: 0,
    },
    fence: {
      backgroundColor: isUser ? 'rgba(35,49,47,0.08)' : 'rgba(2,117,104,0.08)',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      flexShrink: 0,
    },
    blockquote: {
      backgroundColor: isUser ? 'rgba(35,49,47,0.05)' : 'rgba(0,0,0,0.03)',
      borderLeftWidth: 4,
      borderLeftColor: cardTone.linkColor,
      paddingLeft: 12,
      paddingVertical: 8,
      marginVertical: 8,
    },
    bullet_list: {
      marginVertical: 12,
      marginLeft: -10,
      flexShrink: 1,
      flexWrap: 'wrap',
      width: '100%',
      maxWidth: '100%',
    },
    ordered_list: {
      marginVertical: 12,
      marginLeft: -10,
      flexShrink: 1,
      flexWrap: 'wrap',
      width: '100%',
      maxWidth: '100%',
    },
    list_item: {
      marginBottom: 8,
      marginTop: 0,
      flexWrap: 'wrap',
      flexShrink: 1,
      width: '100%',
      maxWidth: '100%',
    },
    hr: {
      backgroundColor: '#14b8a6',
      height: 1,
      marginVertical: 0,
      marginTop: 0,
      marginBottom: 20,
      width: '100%',
    },
  }), [cardTone, isUser]);


  // Tooltip component to be rendered
  const tooltipComponent = tooltipData ? (
    <WordTooltip
      visible={tooltipVisible}
      translation={tooltipData.translation}
      arabicWord={tooltipData.arabicWord}
      onClose={() => {
        setTooltipVisible(false);
        setTooltipData(null);
      }}
    />
  ) : null;

  return {
    markdownStyles,
    renderCodeInline,
    renderParagraph,
    renderLink,
    handleLinkPress,
    tooltipComponent,
  };
}
