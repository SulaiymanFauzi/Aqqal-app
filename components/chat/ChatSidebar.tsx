import React, { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle, ScrollView, TextInput, Animated } from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Conversation } from './types';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  conversations: Conversation[];
  currentId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  style?: StyleProp<ViewStyle>;
};

export default function ChatSidebar({ conversations, currentId, onNewChat, onSelectChat, style }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const menuItems = [
    { id: 'ask', label: 'Ask', icon: 'chatbox' as const, active: true },
    { id: 'library', label: 'Browse', icon: 'library' as const, active: false },
    { id: 'quran', label: "Qur'an", icon: 'book' as const, active: false },
    { id: 'hadith', label: 'Hadith', icon: 'moon' as const, active: false },
  ];

  const filteredConversations = conversations.filter((conv) =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { borderRightColor: theme.separator }, isSearchExpanded && styles.expandedContainer, style]}> 
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#f1f4f6', marginTop: 35 }]}>
        <Ionicons name="search" size={18} color={theme.text} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search chats..."
          placeholderTextColor={theme.text + '80'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setIsSearchExpanded(true)}
        />
        {(searchQuery || isSearchExpanded) && (
          <Pressable onPress={() => {
            setSearchQuery('');
            setIsSearchExpanded(false);
          }}>
            <Ionicons name="close-circle" size={18} color={theme.text} style={{ opacity: 0.5 }} />
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Main Menu Section */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <Pressable
              key={item.id}
              style={[
                styles.menuItem,
                item.active && { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }
              ]}
              onPress={() => console.log(`${item.label} pressed`)}
            >
              <Ionicons 
                name={item.icon} 
                size={20} 
                color={item.active ? theme.tint : '#999'} 
                style={styles.menuIcon}
              />
              <Text style={[
                styles.menuText, 
                { color: item.active ? theme.tint : '#111' },
                item.active && { fontWeight: '600' }
              ]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Separator */}
        <View style={[styles.separator, { backgroundColor: theme.separator }]} />

        {/* History Section */}
        {!isSearchExpanded && <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: theme.text, opacity: 0.5 }]}>Recent</Text>
        </View>}
        
        {/* Search Results or Recent Chats */}
        <View style={styles.historySection}>
          {isSearchExpanded && searchQuery && (
            <Text style={[styles.sectionTitle, { color: theme.text, opacity: 0.5 }]}>
              {filteredConversations.length} Results
            </Text>
          )}
          {[...filteredConversations].sort((a, b) => b.updatedAt - a.updatedAt).map((item) => {
            const active = item.id === currentId;
            return (
              <Pressable 
                key={item.id}
                onPress={() => onSelectChat(item.id)} 
                style={[
                  styles.historyItem, 
                  active && { backgroundColor: colorScheme === 'dark' ? 'rgba(4,164,149,0.15)' : 'rgba(4,164,149,0.1)' }
                ]}
              >
                <Text 
                  numberOfLines={1} 
                  style={[
                    styles.historyText,
                    { color: theme.text },
                    active && { fontWeight: '600', color: theme.tint }
                  ]}
                >
                  {item.title || 'Untitled'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: 280,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#333',
    padding: 16,
  },
  expandedContainer: {
    width: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#04a495',
    marginBottom: 16,
  },
  newButtonIcon: {
    marginRight: 8,
  },
  newButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  scrollView: {
    flex: 1,
  },
  menuSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    fontSize: 15,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
    opacity: 0.3,
  },
  historySection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  historyIcon: {
    marginRight: 10,
  },
  historyText: {
    fontSize: 14,
    flex: 1,
  },
});
