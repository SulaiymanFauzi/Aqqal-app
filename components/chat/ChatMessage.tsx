import React from 'react';
import {
  View as RNView,
  Text as RNText,
  Animated,
  Easing,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Message } from './types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ZoomableImage } from './ZoomableImage';
import { AnimatedDotsText } from './AnimatedDotsText';
import { ArabicWordPopup } from './ArabicWordPopup';
import { QuranVerseBox } from './QuranVerseBox';
import { preprocessContent, cleanThoughtTitles, extractQuranBlocks } from './utils';
import { useMarkdownConfig } from './useMarkdownConfig';
import { styles } from './ChatMessage.styles';
import { USER_CARD_COLORS } from './constants';

type Props = { 
  msg: Message; 
  onLayout?: (id: string, layoutY: number) => void;
};

export default function ChatMessage({ msg, onLayout }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [viewingImage, setViewingImage] = React.useState<string | null>(null);
  const [imageLayout, setImageLayout] = React.useState<{ 
    x: number; 
    y: number; 
    width: number; 
    height: number;
  } | null>(null);
  const [selectedArabicWord, setSelectedArabicWord] = React.useState<string | null>(null);

  const isUser = msg.role === 'user';
  const thoughtTitles = !isUser && Array.isArray(msg.thoughtTitles) 
    ? msg.thoughtTitles.filter(Boolean) 
    : [];
  const showThoughtSummary = thoughtTitles.length > 0;
  const showThoughtTitle = !isUser && !!msg.thoughtTitle;
  const isStreaming = !isUser && !!msg.isStreaming;
  const showThoughtSection = !isUser && (showThoughtSummary || showThoughtTitle || isStreaming || !!msg.thoughts);

  // Animation refs
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const morphAnim = React.useRef(new Animated.Value(isUser ? 0 : 1)).current;
  const morphScale = React.useRef(new Animated.Value(isUser ? 0.7 : 1)).current;
  const morphOpacity = React.useRef(new Animated.Value(isUser ? 0 : 1)).current;

  const [displayedSummary, setDisplayedSummary] = React.useState<string | null>(null);
  const summaryRef = React.useRef<string | null>(null);

  const cleanedThoughtTitles = React.useMemo(
    () => cleanThoughtTitles(thoughtTitles),
    [thoughtTitles]
  );

  const upcomingSummary = React.useMemo(() => {
    if (thoughtTitles.length > 0) {
      const sanitized = cleanedThoughtTitles[cleanedThoughtTitles.length - 1];
      if (sanitized) return sanitized;
    }
    if (msg.thoughtTitle) return msg.thoughtTitle;
    return null;
  }, [cleanedThoughtTitles, thoughtTitles, msg.thoughtTitle]);

  // Card tone configuration
  const cardTone = React.useMemo(() => {
    if (isUser) {
      return {
        ...USER_CARD_COLORS,
        linkColor: theme.accent,
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

  // Handle Arabic word press
  const handleArabicWordPress = React.useCallback((word: string) => {
    setSelectedArabicWord(word);
  }, []);

  // Get markdown configuration
  const {
    markdownStyles,
    renderCodeInline,
    renderParagraph,
    renderLink,
    handleLinkPress,
    tooltipComponent,
  } = useMarkdownConfig(isUser, cardTone, handleArabicWordPress);

  // Update thought summary animation
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

  const displayContent = React.useMemo(
    () => msg.content ? preprocessContent(msg.content) : '',
    [msg.content]
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
        {/* Attachments */}
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

        {/* Message Card */}
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
          {/* Thought Section */}
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

          {/* Tool Logs */}
          {!!msg.toolLogs?.length && (
            <RNView style={styles.toolLogsContainer}>
              {msg.toolLogs.map((entry, index) => {
                const isActive = index === msg.toolLogs!.length - 1 && 
                  msg.toolStatus === 'active' && 
                  msg.isStreaming;
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

          {/* Replacement Notice */}
          {msg.replacedContent && (
            <RNView style={{ marginBottom: 12 }}>
              <RNText style={[styles.toolLogLine, { color: cardTone.metaColor, fontStyle: 'italic' }]}>
                ✓ Answer refined for accuracy
              </RNText>
            </RNView>
          )}

          {/* Message Content */}
          {displayContent && (
            <RNView style={{ width: '100%', flexShrink: 1 }}>
              {isUser ? (
                <RNText style={styles.userText}>
                  {displayContent}
                </RNText>
              ) : (
                <>
                  {extractQuranBlocks(displayContent).map((block, index) => (
                    block.type === 'quran' ? (
                      <QuranVerseBox
                        key={`quran-${index}`}
                        content={block.content}
                        markdownStyles={markdownStyles}
                        onLinkPress={handleLinkPress}
                        renderCodeInline={renderCodeInline}
                        renderParagraph={renderParagraph}
                        renderLink={renderLink}
                        onArabicWordPress={handleArabicWordPress}
                        cardTone={cardTone}
                      />
                    ) : (
                      <Markdown
                        key={`text-${index}`}
                        style={markdownStyles}
                        onLinkPress={handleLinkPress}
                        rules={{
                          code_inline: renderCodeInline,
                          paragraph: renderParagraph,
                          link: renderLink,
                        }}
                      >
                        {block.content}
                      </Markdown>
                    )
                  ))}
                </>
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

      {/* Arabic Word Popup */}
      <ArabicWordPopup
        word={selectedArabicWord}
        onClose={() => setSelectedArabicWord(null)}
        onWordClick={(word) => setSelectedArabicWord(word)}
      />

      {/* Word Translation Tooltip */}
      {tooltipComponent}
    </RNView>
  );
}
