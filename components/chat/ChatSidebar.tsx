import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Conversation } from './types';

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

  return (
    <View style={[styles.container, { borderRightColor: theme.separator }, style]}> 
      <Image
        source={require('../../assets/images/logo.png')}
        style={styles.logo}
        accessibilityLabel="Aqqal logo"
      />
      <Pressable onPress={onNewChat} style={[styles.newButton, { backgroundColor: theme.tint }]}>
        <Text style={styles.newButtonText}>+ New chat</Text>
      </Pressable>
      <FlatList
        data={[...conversations].sort((a, b) => b.updatedAt - a.updatedAt)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const active = item.id === currentId;
          return (
            <Pressable onPress={() => onSelectChat(item.id)} style={[styles.item, active && styles.activeItem]}>
              <Text numberOfLines={1} style={[styles.itemText, active && styles.activeItemText]}>
                {item.title || 'Untitled'}
              </Text>
            </Pressable>
          );
        }}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#333',
    padding: 12,
  },
  logo: {
    width: 140,
    height: 28,
    resizeMode: 'contain',
    marginBottom: 12,
  },
  newButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#04a495',
    marginBottom: 12,
  },
  newButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(127,127,127,0.08)',
  },
  activeItem: {
    backgroundColor: 'rgba(4,164,149,0.18)',
  },
  itemText: {
    fontSize: 14,
  },
  activeItemText: {
    fontWeight: '700',
  },
});
