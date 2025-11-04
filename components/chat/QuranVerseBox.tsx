import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Clipboard, Modal, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/components/useColorScheme';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import { useMarkdownConfig } from './useMarkdownConfig';
import { useScrollContext } from './ScrollContext';
import { openURL } from './utils';

interface QuranVerseBoxProps {
  content: string;
  markdownStyles: any;
  onLinkPress: (url: string) => boolean;
  renderCodeInline?: any;
  renderParagraph?: any;
  renderLink?: any;
  onArabicWordPress?: (word: string) => void;
  cardTone: any;
}

export function QuranVerseBox({ 
  content, 
  markdownStyles, 
  onLinkPress,
  renderCodeInline,
  renderParagraph,
  renderLink,
  onArabicWordPress,
  cardTone,
}: QuranVerseBoxProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [copied, setCopied] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [arabicFontSize, setArabicFontSize] = React.useState(18);
  const [hasBeenSeen, setHasBeenSeen] = React.useState(false);

  // Extract verse reference from content
  const verseRefMatch = content.match(/\[Quran (\d+:\d+)\]\(https:\/\/quran\.com\/\d+\/\d+\)/);
  const verseReference = verseRefMatch ? verseRefMatch[1] : null;
  const verseUrl = verseRefMatch ? content.match(/\(https:\/\/quran\.com\/\d+\/\d+\)/)?.[0].slice(1, -1) : null;
  
  // Remove the link from content for rendering
  const cleanContent = verseRefMatch ? content.replace(/\[Quran \d+:\d+\]\(https:\/\/quran\.com\/\d+\/\d+\)\n?/, '') : content;

  // Show boxes when component first appears in viewport
  const handleLayout = () => {
    if (!hasBeenSeen) {
      setHasBeenSeen(true);
      // Hide boxes after 3 seconds
      setTimeout(() => {
        setHasBeenSeen(false);
      }, 1000);
    }
  };

  // Create configs: compact shows boxes on first view, modal always hidden
  const compactConfig = useMarkdownConfig(false, cardTone, onArabicWordPress, hasBeenSeen);
  const modalConfig = useMarkdownConfig(false, cardTone, onArabicWordPress, false);
  
  // Extract tooltip component from compact config
  const { tooltipComponent } = compactConfig;

  const handleCopy = () => {
    try {
      Clipboard.setString(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Silent fail
    }
  };

  const handleExpand = () => {
    setExpanded(true);
  };

  const handleClose = () => {
    setExpanded(false);
  };

  const increaseFontSize = () => {
    setArabicFontSize(prev => Math.min(prev + 2, 32));
  };

  const decreaseFontSize = () => {
    setArabicFontSize(prev => Math.max(prev - 2, 14));
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={
          isDark
            ? ['rgba(20, 184, 166, 0.08)', 'rgba(13, 148, 136, 0.06)']
            : ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.gradient,
          {
            borderColor: isDark
              ? 'rgba(20, 184, 166, 0.25)'
              : 'rgba(20, 184, 166, 0.2)',
          },
        ]}
        onLayout={handleLayout}
      >
        {/* Subtle top highlight */}
        <View style={[styles.topHighlight, {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.6)',
        }]} />
        
        {/* Header with verse reference and action buttons */}
        <View style={styles.header}>
          {verseReference && verseUrl && (
            <TouchableOpacity 
              onPress={() => openURL(verseUrl)}
              style={styles.verseReference}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.verseText, { color: isDark ? 'rgba(20, 184, 166, 0.9)' : 'rgba(13, 148, 136, 1)' }]}>
                Quran {verseReference}
              </Text>
              <Text style={[styles.externalIcon, { color: isDark ? 'rgba(20, 184, 166, 0.6)' : 'rgba(13, 148, 136, 0.7)' }]}>
                ↗
              </Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.actionButtons}>
          {/* Copy button */}
          <TouchableOpacity 
            onPress={handleCopy}
            style={styles.actionButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name={copied ? "checkmark" : "copy-outline"} 
              size={18} 
              color={isDark ? 'rgba(20, 184, 166, 0.7)' : 'rgba(13, 148, 136, 0.8)'} 
            />
          </TouchableOpacity>
          
          {/* Expand button */}
          <TouchableOpacity 
            onPress={handleExpand}
            style={styles.actionButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name="expand-outline" 
              size={18} 
              color={isDark ? 'rgba(20, 184, 166, 0.7)' : 'rgba(13, 148, 136, 0.8)'} 
            />
          </TouchableOpacity>
          </View>
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          <Markdown
            style={{
              ...markdownStyles,
              em: {
                ...markdownStyles.em,
                fontSize: 14,
              },
            }}
            onLinkPress={compactConfig.handleLinkPress}
            rules={{
              code_inline: compactConfig.renderCodeInline,
              paragraph: compactConfig.renderParagraph,
              link: compactConfig.renderLink,
            }}
          >
            {cleanContent}
          </Markdown>
        </View>
      </LinearGradient>

      {/* Fullscreen Modal */}
      <Modal
        visible={expanded}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        <View style={[styles.modalContainer, { backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5' }]}>
          {/* Header with controls */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={isDark ? '#14b8a6' : '#0d9488'} />
            </TouchableOpacity>
            
            <View style={styles.fontControls}>
              <Text style={[styles.fontLabel, { color: isDark ? '#14b8a6' : '#0d9488' }]}>
                Arabic Size
              </Text>
              <View style={styles.fontButtons}>
                <TouchableOpacity onPress={decreaseFontSize} style={styles.fontButton}>
                  <Ionicons name="remove" size={20} color={isDark ? '#14b8a6' : '#0d9488'} />
                </TouchableOpacity>
                <Text style={[styles.fontSize, { color: isDark ? '#fff' : '#000' }]}>
                  {arabicFontSize}
                </Text>
                <TouchableOpacity onPress={increaseFontSize} style={styles.fontButton}>
                  <Ionicons name="add" size={20} color={isDark ? '#14b8a6' : '#0d9488'} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.modalContent} 
            contentContainerStyle={styles.modalContentContainer}
          >
            <Markdown
              style={{
                ...markdownStyles,
                body: {
                  ...markdownStyles.body,
                  fontSize: arabicFontSize,
                  lineHeight: arabicFontSize * 2,
                },
                em: {
                  ...markdownStyles.em,
                  fontSize: 14,
                },
              }}
              onLinkPress={modalConfig.handleLinkPress}
              rules={{
                code_inline: modalConfig.renderCodeInline,
                paragraph: modalConfig.renderParagraph,
                link: modalConfig.renderLink,
              }}
            >
              {cleanContent}
            </Markdown>
          </ScrollView>
        </View>
      </Modal>

      {/* Word Translation Tooltip */}
      {tooltipComponent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
    marginBottom: 16,
    marginHorizontal: 0,
  },
  gradient: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#14b8a6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 32px rgba(20, 184, 166, 0.15)',
      },
    }),
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verseReference: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
    borderRadius: 6,
    gap: 4,
  },
  verseText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  externalIcon: {
    fontSize: 11,
    opacity: 0.8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    marginTop: 16,
    position: 'relative',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20, 184, 166, 0.2)',
  },
  closeButton: {
    padding: 8,
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fontLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  fontButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fontButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
  },
  fontSize: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 24,
    minHeight: 1000, // Ensure content is scrollable
  },
});
