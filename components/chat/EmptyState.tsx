import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ARABIC_FONT_FAMILY } from './constants';

type StarterPrompt = {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap | keyof typeof Ionicons.glyphMap;
  iconSet: 'material' | 'ionicons';
  title: string;
  prompt: string;
  category: string;
};

const starterPrompts: StarterPrompt[] = [
  {
    id: '1',
    icon: 'heart',
    iconSet: 'ionicons',
    title: 'Purify the Heart',
    prompt: 'How can I purify my heart and strengthen my connection with Allah?',
    category: 'Tasawwuf',
  },
  {
    id: '2',
    icon: 'book-open-variant',
    iconSet: 'material',
    title: 'Contemplate the Quran',
    prompt: 'What are the spiritual lessons in Surah Al-Fatiha?',
    category: 'Quran',
  },
  {
    id: '3',
    icon: 'lightbulb-on',
    iconSet: 'material',
    title: 'Understand Tawhid',
    prompt: 'Explain the concept of Tawhid and its impact on daily life',
    category: 'Aqeedah',
  },
  {
    id: '4',
    icon: 'flower',
    iconSet: 'ionicons',
    title: 'Cultivate Ihsan',
    prompt: 'What does it mean to worship Allah as if you see Him?',
    category: 'Spirituality',
  },
  {
    id: '5',
    icon: 'book-alphabet',
    iconSet: 'material',
    title: 'Prophetic Wisdom',
    prompt: 'Share hadiths about sincerity and intention in worship',
    category: 'Hadith',
  },
  {
    id: '6',
    icon: 'scale-balance',
    iconSet: 'material',
    title: 'Sacred Law',
    prompt: 'What are the inner dimensions of performing salah?',
    category: 'Fiqh',
  },
];

type Props = {
  onPromptSelect: (prompt: string) => void;
};

export default function EmptyState({ onPromptSelect }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const renderIcon = (prompt: StarterPrompt) => {
    if (prompt.iconSet === 'material') {
      return (
        <MaterialCommunityIcons
          name={prompt.icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={24}
          color={theme.tint}
        />
      );
    }
    return (
      <Ionicons
        name={prompt.icon as keyof typeof Ionicons.glyphMap}
        size={24}
        color={theme.tint}
      />
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.mainContent}>
        {/* Welcome Section */}
        <View style={[styles.welcomeSection, { alignItems: 'center' }]}>
          <Text style={[styles.spiritualQuote, { color: theme.muted, textAlign: 'center' }]}>
            "Knowledge is a light which Allah casts into the heart."
          </Text>
          <Text style={[styles.quoteAttribution, { color: theme.muted, textAlign: 'center' }]}>
            — Imam al-Shafi'i
          </Text>
        </View>

        {/* Starter Prompts */}
        <View style={[styles.promptsSection, { marginTop: 'auto' }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promptScrollContent}
            style={styles.promptScroll}
          >
            {starterPrompts.map((prompt) => (
              <Pressable
                key={prompt.id}
                style={({ pressed }) => [
                  styles.promptCard,
                  {
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8f9fa',
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e9ecef',
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
                onPress={() => onPromptSelect(prompt.prompt)}
              >
                <View style={styles.promptHeader}>
                  <View style={[styles.promptIconContainer, { backgroundColor: `${theme.tint}15` }]}>
                    {renderIcon(prompt)}
                  </View>
                  <Text style={[styles.promptCategory, { color: theme.tint }]}>
                    {prompt.category}
                  </Text>
                </View>
                
                <Text style={[styles.promptTitle, { color: theme.text }]}>
                  {prompt.title}
                </Text>
                
                <Text style={[styles.promptText, { color: theme.muted }]} numberOfLines={3}>
                  {prompt.prompt}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  mainContent: {
    flex: 1,
  },
  
  // Welcome Section
  welcomeSection: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 1,
    fontFamily: ARABIC_FONT_FAMILY,
  },
  spiritualQuote: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    maxWidth: 300,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  quoteAttribution: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.65,
  },
  
  // Prompts Section
  promptsSection: {
    marginTop: 'auto',
    marginBottom: -40,
  },
  promptScroll: {
    marginHorizontal: -20,
  },
  promptScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  promptCard: {
    width: 280,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  promptIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptCategory: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  promptText: {
    fontSize: 14,
    lineHeight: 20,
  },
  
});
