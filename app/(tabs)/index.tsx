import React, { useEffect, useMemo, useState, useLayoutEffect } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, Modal, Pressable, View as RNView, Platform, PanResponder } from 'react-native';
import { View } from '@/components/Themed';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';
import type { Conversation, Message } from '@/components/chat/types';
import { loadConversations, saveConversations } from '@/utils/storage';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from 'expo-router';
import { chat as chatApi } from '@/utils/api';

export default function TabOneScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768; // narrower threshold for showing persistent sidebar
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const navigation = useNavigation();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);

  // Edge-swipe to open sidebar on mobile
  const openEdgePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dy) < 20,
        onPanResponderRelease: (_, g) => {
          if (g.dx > 28) setShowSidebar(true);
        },
      }),
    []
  );

  const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  useEffect(() => {
    (async () => {
      const convs = await loadConversations();
      if (convs.length) {
        setConversations(convs);
        setCurrentId(convs[0].id);
      } else {
        const id = genId();
        const welcome: Message = {
          id: genId(),
          role: 'assistant',
          content: 'Welcome to Aqqal Chat. Start typing below.',
          createdAt: Date.now(),
        };
        const first: Conversation = { id, title: 'New chat', messages: [welcome], updatedAt: Date.now() };
        setConversations([first]);
        setCurrentId(id);
      }
    })();
  }, []);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Provide a header menu button on mobile to open the conversation list
  useLayoutEffect(() => {
    if (!navigation) return;
    if (isWide) {
      // Remove menu button on wide layouts
      // @ts-ignore - setOptions exists at runtime
      navigation.setOptions({ headerLeft: undefined });
    } else {
      // @ts-ignore - setOptions exists at runtime
      navigation.setOptions({
        headerLeft: () => (
          <Pressable onPress={() => setShowSidebar(true)} style={{ paddingHorizontal: 12 }}>
            <FontAwesome name="bars" size={24} color={theme.text} />
          </Pressable>
        ),
      });
    }
  }, [navigation, isWide, theme.text]);

  const current = useMemo(
    () => conversations.find((c) => c.id === currentId) ?? null,
    [conversations, currentId]
  );

  const handleNewChat = () => {
    const id = genId();
    const conv: Conversation = { id, title: 'New chat', messages: [], updatedAt: Date.now() };
    setConversations((prev) => [conv, ...prev]);
    setCurrentId(id);
  };

  const updateConversation = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  const handleSend = async (text: string) => {
    if (!current) return;

    const userMsg: Message = { id: genId(), role: 'user', content: text, createdAt: Date.now() };
    const convoId = current.id;

    // Optimistically add user message
    updateConversation(convoId, (c) => {
      const title = !c.title || c.title === 'New chat' || c.title === 'Untitled' ? text.slice(0, 30) : c.title;
      return { ...c, title, messages: [...c.messages, userMsg], updatedAt: Date.now() };
    });

    // Prepare messages to send (include the new user message)
    const outgoing = [...(current?.messages ?? []), userMsg];

    try {
      const res = await chatApi(outgoing, {
        // Toggle search grounding here if desired
        // use_search: true,
        max_output_tokens: 4096, // reduce chance of truncation for long answers
      });
      const reply: Message = {
        id: genId(),
        role: 'assistant',
        content: res.text,
        createdAt: Date.now(),
      };
      updateConversation(convoId, (c) => ({ ...c, messages: [...c.messages, reply], updatedAt: Date.now() }));
    } catch (err: any) {
      const reply: Message = {
        id: genId(),
        role: 'assistant',
        content: `Error contacting server: ${err?.message ?? 'Unknown error'}`,
        createdAt: Date.now(),
      };
      updateConversation(convoId, (c) => ({ ...c, messages: [...c.messages, reply], updatedAt: Date.now() }));
    }
  };

  const sidebarWidth = Math.min(320, Math.max(280, Math.round(width * 0.84)));

  return (
    <View style={styles.page}>
      {isWide && (
        <ChatSidebar
          conversations={conversations}
          currentId={currentId}
          onNewChat={handleNewChat}
          onSelectChat={setCurrentId}
          style={{ width: 300 }}
        />
      )}

      <View style={styles.chatArea}>
        {/* Edge swipe catcher on mobile */}
        {Platform.OS !== 'web' && !isWide && (
          <RNView {...openEdgePan.panHandlers} style={styles.edgeSwipe} />
        )}
        <FlatList
          style={styles.list}
          data={current?.messages ?? []}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => (
            <ChatMessage msg={item} order={index + 1} isLast={index === (current?.messages.length ?? 0) - 1} />
          )}
          contentContainerStyle={styles.messages}
        />
        <ChatInput onSend={handleSend} />
      </View>

      {/* Mobile sidebar modal */}
      <Modal
        visible={!isWide && showSidebar}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSidebar(false)}
      >
        <RNView style={styles.modalOverlay}>
          <RNView style={[styles.modalSidebar, { backgroundColor: theme.background, borderColor: theme.separator, width: sidebarWidth }]}>            
            <RNView style={styles.modalHeader}>
              <Pressable onPress={() => setShowSidebar(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="chevron-left" size={20} color={theme.text} />
              </Pressable>
            </RNView>
            <ChatSidebar
              conversations={conversations}
              currentId={currentId}
              onNewChat={() => {
                handleNewChat();
                setShowSidebar(false);
              }}
              onSelectChat={(id) => {
                setCurrentId(id);
                setShowSidebar(false);
              }}
              style={{ width: sidebarWidth }}
            />
          </RNView>
          {/* Tap outside to close */}
          <Pressable style={{ flex: 1 }} onPress={() => setShowSidebar(false)} />
        </RNView>
      </Modal>

      {/* Mobile web FAB to open conversations (header is hidden on web) */}
      {Platform.OS === 'web' && !isWide && (
        <Pressable
          onPress={() => setShowSidebar(true)}
          style={[styles.fab, { backgroundColor: theme.tint }]}
          aria-label="Open conversations"
        >
          <FontAwesome name="bars" size={20} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: 'row',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#f3f5f7',
  },
  list: {
    flex: 1,
  },
  messages: {
    paddingVertical: 8,
    alignItems: 'stretch',
  },
  edgeSwipe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 24,
    height: '100%',
    zIndex: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
  },
  modalSidebar: {
    height: '100%',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  modalHeader: {
    height: 44,
    alignItems: 'center',
    flexDirection: 'row',
  },
  modalCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
});
