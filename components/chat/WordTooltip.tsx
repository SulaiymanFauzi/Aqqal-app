import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Platform } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';

interface WordTooltipProps {
  visible: boolean;
  translation: string;
  arabicWord: string;
  onClose: () => void;
}

export function WordTooltip({ visible, translation, arabicWord, onClose }: WordTooltipProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.tooltip,
            {
              backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
              borderColor: isDark ? 'rgba(20, 184, 166, 0.3)' : 'rgba(20, 184, 166, 0.2)',
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Arabic Word */}
          <Text
            style={[
              styles.arabicWord,
              {
                color: isDark ? '#14b8a6' : '#0d9488',
                fontFamily:
                  Platform.OS === 'web'
                    ? 'Scheherazade New, Amiri Quran, serif'
                    : 'ScheherazadeNew-Bold',
              },
            ]}
          >
            {arabicWord}
          </Text>

          {/* Translation */}
          <Text
            style={[
              styles.translation,
              {
                color: isDark ? '#e5e5e5' : '#1f2937',
              },
            ]}
          >
            {translation}
          </Text>

          {/* Hint */}
          <Text
            style={[
              styles.hint,
              {
                color: isDark ? '#737373' : '#9ca3af',
              },
            ]}
          >
            Tap anywhere to close
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltip: {
    minWidth: 200,
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  arabicWord: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  translation: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.7,
  },
});
