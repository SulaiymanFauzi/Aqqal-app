import React from 'react';
import { Platform, StyleSheet, View as RNView, Linking, Text as RNText, Alert, Animated, Easing, Image, ScrollView, TouchableOpacity, Modal, Pressable, Dimensions } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { Message } from './types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { defineTerm } from '@/utils/api';
import * as WebBrowser from 'expo-web-browser';
import { CitationBadge } from './CitationBadge';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedAnimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing as ReanimatedEasing, runOnJS } from 'react-native-reanimated';

const FONT_FAMILY = Platform.OS === 'web' ? 'Canva Sans, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans' : undefined;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Zoomable Image Component
function ZoomableImage({ 
  uri, 
  onClose, 
  initialLayout 
}: { 
  uri: string; 
  onClose: () => void; 
  initialLayout: { x: number; y: number; width: number; height: number } | null;
}) {
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Calculate initial position and scale
  const initialScale = initialLayout ? initialLayout.width / SCREEN_WIDTH : 0.3;
  const initialX = initialLayout ? initialLayout.x - (SCREEN_WIDTH - initialLayout.width) / 2 : 0;
  const initialY = initialLayout ? initialLayout.y - (SCREEN_HEIGHT - initialLayout.height) / 2 : 0;

  const scale = useSharedValue(initialScale);
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const opacity = useSharedValue(0);
  const backgroundOpacity = useSharedValue(0);

  // Animate in on mount
  React.useEffect(() => {
    const config = { 
      duration: 300, 
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic) 
    };
    scale.value = withTiming(1, config);
    translateX.value = withTiming(0, config);
    translateY.value = withTiming(0, config);
    opacity.value = withTiming(1, config);
    backgroundOpacity.value = withTiming(0.95, config);
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      // Clamp scale between 1 and 4
      scale.value = Math.max(1, Math.min(4, newScale));
    })
    .onEnd(() => {
      if (scale.value < 1.1) {
        // Reset to 1x if very close
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Save the current scale
        savedScale.value = scale.value;
        
        // Adjust translation to keep within bounds
        const maxTranslateX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
        const maxTranslateY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;
        
        if (Math.abs(translateX.value) > maxTranslateX) {
          translateX.value = withSpring(
            translateX.value > 0 ? maxTranslateX : -maxTranslateX
          );
          savedTranslateX.value = translateX.value;
        }
        if (Math.abs(translateY.value) > maxTranslateY) {
          translateY.value = withSpring(
            translateY.value > 0 ? maxTranslateY : -maxTranslateY
          );
          savedTranslateY.value = translateY.value;
        }
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        // Panning when zoomed in
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        // Swipe to dismiss when not zoomed
        translateY.value = e.translationY;
        // Fade out as user swipes down
        const progress = Math.min(Math.abs(e.translationY) / 200, 1);
        opacity.value = 1 - progress * 0.5;
        scale.value = 1 - progress * 0.2;
        backgroundOpacity.value = 0.95 * (1 - progress);
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        // Handle boundaries when zoomed
        const maxTranslateX = (SCREEN_WIDTH * (savedScale.value - 1)) / 2;
        const maxTranslateY = (SCREEN_HEIGHT * (savedScale.value - 1)) / 2;
        
        if (Math.abs(translateX.value) > maxTranslateX) {
          translateX.value = withSpring(
            translateX.value > 0 ? maxTranslateX : -maxTranslateX
          );
        }
        if (Math.abs(translateY.value) > maxTranslateY) {
          translateY.value = withSpring(
            translateY.value > 0 ? maxTranslateY : -maxTranslateY
          );
        }
        
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        // Dismiss if swiped down enough
        if (Math.abs(e.translationY) > 100 || Math.abs(e.velocityY) > 500) {
          // Animate back to original position
          const config = { 
            duration: 250, 
            easing: ReanimatedEasing.in(ReanimatedEasing.cubic) 
          };
          scale.value = withTiming(initialScale, config);
          translateX.value = withTiming(initialX, config);
          translateY.value = withTiming(initialY, config);
          opacity.value = withTiming(0, config);
          backgroundOpacity.value = withTiming(0, config, (finished) => {
            if (finished) {
              runOnJS(onClose)();
            }
          });
        } else {
          // Spring back
          translateY.value = withSpring(0);
          opacity.value = withSpring(1);
          scale.value = withSpring(1);
          backgroundOpacity.value = withSpring(0.95);
        }
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  const composed = Gesture.Simultaneous(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const animatedBackgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity.value})`,
  }));

  return (
    <>
      <ReanimatedAnimated.View style={[StyleSheet.absoluteFill, animatedBackgroundStyle]} />
      <GestureDetector gesture={composed}>
        <ReanimatedAnimated.Image
          source={{ uri }}
          style={[styles.imageViewerImage, animatedStyle]}
          resizeMode="contain"
        />
      </GestureDetector>
    </>
  );
}

// Open URL in in-app browser on mobile, external browser on web
async function openURL(url: string) {
  if (Platform.OS === 'web') {
    Linking.openURL(url);
  } else {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: '#0ea5e9',
      toolbarColor: '#ffffff',
    });
  }
}

type Props = { msg: Message; onLayout?: (id: string, layoutY: number) => void };

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
  const [viewingImage, setViewingImage] = React.useState<string | null>(null);
  const [imageLayout, setImageLayout] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const isUser = msg.role === 'user';
  const thoughtTitles = !isUser && Array.isArray(msg.thoughtTitles) ? msg.thoughtTitles.filter(Boolean) : [];
  const showThoughtSummary = thoughtTitles.length > 0;
  const showThoughtTitle = !isUser && !!msg.thoughtTitle;
  const isStreaming = !isUser && !!msg.isStreaming;
  const showThoughtSection = !isUser && (showThoughtSummary || showThoughtTitle || isStreaming || !!msg.thoughts);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const replacedOpacity = React.useRef(new Animated.Value(1)).current;
  const [displayedSummary, setDisplayedSummary] = React.useState<string | null>(null);
  const summaryRef = React.useRef<string | null>(null);
  
  // Morph-in animation for user messages
  const morphAnim = React.useRef(new Animated.Value(isUser ? 0 : 1)).current;
  const morphScale = React.useRef(new Animated.Value(isUser ? 0.7 : 1)).current;
  const morphOpacity = React.useRef(new Animated.Value(isUser ? 0 : 1)).current;
  const cleanedThoughtTitles = React.useMemo(() => {
    if (!thoughtTitles.length) return [] as string[];
    return thoughtTitles
      .map((title) => title.replace(/\*+/g, '').trim())
      .filter(Boolean);
  }, [thoughtTitles]);

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
            duration: 560,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start();
        }
      } else {
        const finishedText = 'Finished thinking';
        if (summaryRef.current !== finishedText) {
          summaryRef.current = finishedText;
          setDisplayedSummary(finishedText);
          fadeAnim.setValue(1);
        }
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
      duration: 660,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, upcomingSummary, isStreaming]);

  // Trigger morph animation for user messages
  React.useEffect(() => {
    if (isUser) {
      // Small delay to ensure the component is mounted before animating
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.spring(morphAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }),
          Animated.spring(morphScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }),
          Animated.timing(morphOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [isUser]);

  React.useEffect(() => {
    if (msg.shouldAnimateReplacement && msg.replacedContent) {
      replacedOpacity.setValue(1);
      Animated.timing(replacedOpacity, {
        toValue: 0,
        duration: 1200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [msg.shouldAnimateReplacement, msg.replacedContent, replacedOpacity]);


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

  // Detect if text is predominantly Arabic (not just contains Arabic characters)
  const isArabic = React.useCallback(
    (text: string) => {
      // Count Arabic characters vs total characters
      const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
      const totalChars = text.replace(/\s/g, '').length; // Exclude whitespace
      // Consider it Arabic if more than 50% of non-whitespace characters are Arabic
      return totalChars > 0 && (arabicChars / totalChars) > 0.5;
    },
    []
  );

  // Custom renderer for inline code (backticks) to make them clickable
  const renderCodeInline = React.useCallback(
    (node: any, children: any, parent: any, styles: any) => {
      // Use node.content which has the text
      const text = node.content || '';
      const hasArabic = isArabic(text);
      
      // Parse bold markdown (**text**) inside inline code
      const renderTextWithBold = (str: string) => {
        const parts = str.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            // Remove asterisks and render as bold
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
            hasArabic && markdownStyles.arabicText,
            isUser && { color: 'rgba(35,49,47,1)', borderBottomColor: 'rgba(35,49,47,0.3)' }
          ]}
          onPress={() => onPressMark(text)}
          accessibilityRole="button"
        >
          {renderTextWithBold(text)}
        </RNText>
      );
    },
    [isUser, onPressMark, isArabic]
  );

  // Arabic text style object (defined outside useMemo to avoid circular dependency)
  const arabicTextStyle = React.useMemo(() => ({
    fontFamily: Platform.OS === 'web'
      ? 'Scheherazade New, Amiri Quran, "Lateef", "Noto Naskh Arabic", "Qalam Majalla", serif'
      : 'ScheherazadeNew-Bold',
    fontSize: Platform.OS === 'web' ? 44 : 20,
    lineHeight: Platform.OS === 'web' ? 50 : 45,
    letterSpacing: 0,
    fontWeight: Platform.OS === 'web' ? ('400' as const) : undefined,
    color: cardTone.textColor,
    // Enable proper text shaping for Arabic
    ...(Platform.OS !== 'web' && {
      writingDirection: 'ltr' as const,
    }),
  }), [cardTone.textColor]);

  // Inline Arabic text style (for Arabic within paragraphs)
  const inlineArabicStyle = React.useMemo(() => ({
    fontFamily: Platform.OS === 'web'
      ? 'Scheherazade New, Amiri Quran, "Lateef", "Noto Naskh Arabic", "Qalam Majalla", serif'
      : 'ScheherazadeNew-Bold',
    fontSize: Platform.OS === 'web' ? 20 : 18,
    lineHeight: Platform.OS === 'web' ? 50 : 35, // Increase the bottom line height
    letterSpacing: 0,
    fontWeight: Platform.OS === 'web' ? ('400' as const) : undefined,
    color: cardTone.textColor,
    // Enable proper text shaping for Arabic
    ...(Platform.OS !== 'web' && {
      writingDirection: 'ltr' as const,
    }),
  }), [cardTone.textColor]);

  // Recursively apply Arabic style to text nodes
  const applyArabicStyle = React.useCallback((children: any, parentKey: string = ''): any => {
    if (typeof children === 'string') {
      const hasArabic = isArabic(children);
      // Apply Arabic font to all Arabic text, including honorifics
      if (hasArabic) {
        // Force Arabic text to start on a new line by adding line breaks
        return (
          <RNText key={`arabic-${parentKey}`}>
            {'\n'}
            <RNText style={inlineArabicStyle}>{children}</RNText>
            {'\n'}
          </RNText>
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
  }, [isArabic, inlineArabicStyle]);

  // Custom renderer for paragraphs to apply Arabic font
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

  // Markdown styles
  const markdownStyles = React.useMemo(() => StyleSheet.create({
    body: {
      color: isUser ? '#23312f' : cardTone.textColor,
      fontSize: 16,
      lineHeight: 23,
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
      marginTop: isUser ? 0 : 0,
      marginBottom: isUser ? 0 : 20,
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
      marginVertical: 20,
      width: '100%',
    },
    arabicText: {
      fontFamily:
        Platform.OS === 'web'
          ? 'Scheherazade New, Amiri Quran, "Lateef", "Noto Naskh Arabic", "Qalam Majalla", serif'
          : 'ScheherazadeNew-Bold',
      fontSize: Platform.OS === 'web' ? 32 : 25,
      lineHeight: Platform.OS === 'web' ? 100 : 104,
      letterSpacing: Platform.OS === 'web' ? 1.0 : 1.0,
      textAlign: 'left',
      fontWeight: Platform.OS === 'web' ? '400' : undefined,
    },
  }), [cardTone, isUser]);

  // Handle link presses
  const handleLinkPress = React.useCallback((url: string) => {
    openURL(url);
    return false; // Prevent default behavior
  }, []);

  // Content to display - preprocess LaTeX expressions
  const displayContent = React.useMemo(() => {
    let content = msg.content || '';
    
    // Convert LaTeX \textit{...} to markdown italics *...*
    content = content.replace(/\$\\textit\{([^}]+)\}\$/g, '*$1*');
    
    // Convert other common LaTeX text commands
    content = content.replace(/\$\\textbf\{([^}]+)\}\$/g, '**$1**');
    content = content.replace(/\$\\text\{([^}]+)\}\$/g, '$1');
    
    // Remove standalone $ symbols that aren't part of math
    content = content.replace(/\$([^$\\]+)\$/g, '$1');
    
    return content;
  }, [msg.content]);

  // Track citations to group consecutive ones - use useMemo for stable references
  const citationGroups = React.useMemo(() => new Map<string, any[]>(), [msg.content]);

  // Custom link renderer to handle citations
  const renderLink = React.useCallback(
    (node: any, children: any, parent: any, styles: any) => {
      const href = node.attributes?.href || '';
      const title = node.attributes?.title || '';
      
      // Extract text from node structure (not from React children)
      let linkText = '';
      if (node.children && node.children.length > 0 && node.children[0].content) {
        linkText = node.children[0].content;
      }
      
      // Check if this is a citation link: [1](url "title")
      // Backend generates [[1]] but markdown parser strips outer brackets
      const citationMatch = linkText.match(/^\[?(\d+)\]?$/);
      if (citationMatch && href.includes('vertexaisearch.cloud.google.com')) {
        const number = parseInt(citationMatch[1]);
        const citation = { number, url: href, title: title || 'Source' };
        
        // Check if previous sibling is also a citation to group them
        const parentKey = parent?.key || 'root';
        const nodeIndex = node.index || 0;
        const groupKey = `${parentKey}-${nodeIndex}`;
        
        // Check if this is consecutive with previous citation
        const prevGroupKey = `${parentKey}-${nodeIndex - 1}`;
        const prevGroup = citationGroups.get(prevGroupKey);
        
        if (prevGroup && nodeIndex > 0) {
          // Add to previous group
          prevGroup.push(citation);
          citationGroups.set(groupKey, prevGroup);
          // Return null to skip rendering (will be rendered with the group)
          return null;
        } else {
          // Start new group or get existing
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
      
      // Regular link
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
    [handleLinkPress]
  );

  const morphTranslateY = morphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [150, 0],
  });

  return (
    <RNView
      style={styles.row}
      onLayout={(event) => onLayout?.(msg.id, event.nativeEvent.layout.y)}
    >
      <Animated.View
        style={[
          styles.messageColumn,
          isUser ? styles.userColumn : styles.assistantColumn,
          isUser && {
            opacity: morphOpacity,
            transform: [
              { translateY: morphTranslateY },
              { scale: morphScale },
            ],
          },
        ]}
      >
        {/* Attachments - displayed above the message bubble */}
        {msg.attachments && msg.attachments.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[
              styles.attachmentsContainer,
              isUser && styles.attachmentsContainerUser,
            ]}
            contentContainerStyle={styles.attachmentsContent}
          >
            {msg.attachments.map((attachment) => (
              <TouchableOpacity 
                key={attachment.id} 
                style={styles.attachmentWrapper}
                onPress={(e) => {
                  e.currentTarget.measure((x, y, width, height, pageX, pageY) => {
                    setImageLayout({ x: pageX, y: pageY, width, height });
                    setViewingImage(attachment.uri);
                  });
                }}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: attachment.uri }}
                  style={[
                    styles.attachmentImage,
                    isUser && styles.userAttachmentImage,
                  ]}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
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
          {showThoughtSection && (!msg.content || !msg.content.trim()) && (
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
                <RNText style={[styles.thoughtTitle, { color: cardTone.metaColor }]}>
                  {msg.thoughtTitle}
                </RNText>
              )}
            </RNView>
          )}
          {!!msg.toolLogs?.length && (
            <RNView style={styles.toolLogsContainer}>
              {msg.toolLogs.map((entry, index) => {
                const isActive = index === msg.toolLogs!.length - 1 && msg.toolStatus === 'active' && msg.isStreaming;
                return (
                  <RNView key={index} style={styles.toolLogItem}>
                    {isActive ? (
                      <AnimatedDotsText
                        text={entry}
                        color={cardTone.metaColor}
                        isActive
                        style={styles.toolLogLine}
                      />
                    ) : (
                      <RNText style={[styles.toolLogLine, { color: cardTone.metaColor }]}>
                        {entry}
                      </RNText>
                    )}
                  </RNView>
                );
              })}
            </RNView>
          )}
          {msg.replacedContent && (
            <RNView style={{ marginBottom: 12 }}>
              <RNText style={[styles.toolLogLine, { color: cardTone.metaColor, fontStyle: 'italic' }]}>
                ✓ Answer refined for accuracy
              </RNText>
            </RNView>
          )}
          {displayContent && (
            <RNView style={{ width: '100%', flexShrink: 1 }}>
              {isUser ? (
                <RNText style={styles.userText}>
                  {displayContent}
                </RNText>
              ) : (
                <Markdown
                  style={markdownStyles}
                  onLinkPress={handleLinkPress}
                  rules={{
                    code_inline: renderCodeInline,
                    paragraph: renderParagraph,
                    link: renderLink,
                  }}
                >
                  {displayContent}
                </Markdown>
              )}
            </RNView>
          )}
        </RNView>
      </Animated.View>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <Modal
          visible={!!viewingImage}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setViewingImage(null)}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RNView style={styles.imageViewerOverlay}>
              <TouchableOpacity 
                style={styles.imageViewerCloseButton}
                onPress={() => setViewingImage(null)}
                activeOpacity={0.8}
              >
                <RNText style={styles.imageViewerCloseText}>✕</RNText>
              </TouchableOpacity>
              <RNView style={styles.imageViewerImageContainer}>
                <ZoomableImage 
                  uri={viewingImage} 
                  onClose={() => setViewingImage(null)} 
                  initialLayout={imageLayout}
                />
              </RNView>
            </RNView>
          </GestureHandlerRootView>
        </Modal>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    paddingVertical: 10,
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
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: '#051417',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === 'web' ? 0.05 : 0.12,
    shadowRadius: 16,
    elevation: 2,
    alignSelf: 'stretch',
  },
  userCard: {
    borderRadius: 25,
    paddingVertical: 8,
    alignSelf: 'flex-end',
    maxWidth: '75.0%',
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
  thoughtSummaryContainer: {
    marginTop: 6,
  },
  thoughtHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  toolLogsContainer: {
    marginTop: 6,
    gap: 4,
  },
  toolLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolLogLine: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '500',
  },
  attachmentsContainer: {
    marginBottom: 8,
    maxHeight: 220,
  },
  attachmentsContainerUser: {
    alignSelf: 'flex-end',
  },
  attachmentsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  attachmentWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  attachmentImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  userAttachmentImage: {
    width: 180,
    height: 180,
  },
  userText: {
    color: '#23312f',
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 25,
    letterSpacing: 0.15,
  },
  imageViewerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageViewerCloseText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
  },
  imageViewerImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  imageViewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
