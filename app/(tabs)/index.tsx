import React, { useEffect, useMemo, useState, useLayoutEffect } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, Modal, Pressable, View as RNView, Platform, PanResponder } from 'react-native';
import { View } from '@/components/Themed';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';
import type { Conversation, Message, StreamEvent } from '@/components/chat/types';
import { loadConversations, saveConversations } from '@/utils/storage';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from 'expo-router';
import { chat as chatApi } from '@/utils/api';

export default function TabOneScreen() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768; // narrower threshold for showing persistent sidebar
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const navigation = useNavigation();
  const flatListRef = React.useRef<FlatList<Message>>(null);
  const [scrollSpacerActive, setScrollSpacerActive] = useState(false);
  const [scrollSpacerHeight, setScrollSpacerHeight] = useState(0);
  const [listViewportHeight, setListViewportHeight] = useState<number | null>(null);
  const [listContentHeight, setListContentHeight] = useState<number | null>(null);
  const [spacerReleaseArmed, setSpacerReleaseArmed] = useState(false);
  const [spacerBaselineHeight, setSpacerBaselineHeight] = useState<number | null>(null);

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
  const scrollToBottomWithSpacer = React.useCallback(() => {
    if (!flatListRef.current) return;
    const relativeHeight = listViewportHeight ?? Math.round(height * 0.9);
    const computedSpacer = Math.max(Math.round(relativeHeight * 0.68), 320);
    const baseline = listContentHeight ?? 0;
    setScrollSpacerHeight(computedSpacer);
    setScrollSpacerActive(true);
    setSpacerReleaseArmed(false);
    setSpacerBaselineHeight(baseline);
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, [height, listViewportHeight, listContentHeight]);

  useEffect(() => {
    if (!currentId) return;
    setScrollSpacerActive(false);
    setScrollSpacerHeight(0);
    setListContentHeight(null);
    setSpacerReleaseArmed(false);
    setSpacerBaselineHeight(null);
  }, [currentId]);

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
    const targetIndex = outgoing.length - 1;

    const assistantId = genId();
    const now = Date.now();
    const initialAssistant: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: now,
      thoughts: null,
      thoughtTitle: null,
      thoughtTitles: [],
      streamEvents: [],
      isStreaming: true,
      toolStatus: null,
      toolLogs: [],
    };

    updateConversation(convoId, (c) => ({
      ...c,
      messages: [...c.messages, initialAssistant],
      updatedAt: Date.now(),
    }));

    if (targetIndex >= 1) {
      scrollToBottomWithSpacer();
    }

    const patchAssistant = (mutator: (msg: Message) => Message) => {
      updateConversation(convoId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === assistantId ? mutator(m) : m)),
        updatedAt: Date.now(),
      }));
    };

    let accumulatedAnswer = '';
    let accumulatedThoughts = '';
    let thoughtTitle: string | null = null;
    const thoughtTitles: string[] = [];
    const collectedEvents: StreamEvent[] = [];

    const syncThoughtTitles = (text: string) => {
      if (!text) return;
      const matches = Array.from(text.matchAll(/\*\*([^*]+)\*\*/g));
      let updated = false;
      matches.forEach((match) => {
        const extracted = match[1]?.trim();
        if (!extracted) return;
        if (!thoughtTitles.includes(extracted)) {
          thoughtTitles.push(extracted);
          updated = true;
        }
      });
      if (!updated) {
        const trimmed = text.trim();
        if (trimmed) {
          const fallback = trimmed.split(/[\n\.]/)[0]?.trim();
          if (fallback && !thoughtTitles.includes(fallback)) {
            thoughtTitles.push(fallback);
            updated = true;
          }
        }
      }
      if (thoughtTitles.length > 0) {
        thoughtTitle = thoughtTitles[thoughtTitles.length - 1];
      }
    };

    try {
      await chatApi(outgoing, {
        max_output_tokens: 4096,
        stream: true,
        streamHandlers: {
          onEvent: (evt) => {
            collectedEvents.push(evt);
            if (!spacerReleaseArmed) {
              setSpacerReleaseArmed(true);
            }
            if (evt.kind === 'answer') {
              accumulatedAnswer += evt.text;
              patchAssistant((msg) => ({
                ...msg,
                content: accumulatedAnswer,
                streamEvents: [...collectedEvents],
                isStreaming: true,
              }));
            } else {
              accumulatedThoughts += evt.text;
              syncThoughtTitles(evt.text);
              const titlesSnapshot: string[] = thoughtTitles.length ? [...thoughtTitles] : [];
              const trimmedToolText = evt.text?.trim() ?? '';
              const sanitizedToolEntry = trimmedToolText
                .replace(/^\u0000+/g, '')
                .replace(/^\[tools\]\s*/i, '')
                .trim();
              const isToolLine = sanitizedToolEntry.length > 0 && trimmedToolText.replace(/^\u0000+/g, '').startsWith('[tools]');
              const toolResultLine = isToolLine && /^result\b/i.test(sanitizedToolEntry);
              patchAssistant((msg) => ({
                ...msg,
                thoughts: accumulatedThoughts,
                thoughtTitle,
                thoughtTitles: titlesSnapshot,
                streamEvents: [...collectedEvents],
                isStreaming: true,
                toolStatus: isToolLine ? (toolResultLine ? 'completed' : 'active') : msg.toolStatus,
                toolLogs:
                  isToolLine
                    ? (() => {
                        const prev = msg.toolLogs ?? [];
                        if (!sanitizedToolEntry || prev.includes(sanitizedToolEntry)) {
                          return prev;
                        }
                        return [...prev, sanitizedToolEntry];
                      })()
                    : msg.toolLogs,
              }));
            }
          },
          onFinal: (resp) => {
            const normalizedThoughts =
              resp.thoughts !== undefined && resp.thoughts !== null
                ? resp.thoughts
                : accumulatedThoughts
                ? accumulatedThoughts
                : null;
            if (scrollSpacerActive) {
              setScrollSpacerActive(false);
              setScrollSpacerHeight(0);
            }
            if (spacerReleaseArmed) {
              setSpacerReleaseArmed(false);
            }
            setSpacerBaselineHeight(null);
            if (normalizedThoughts) {
              syncThoughtTitles(normalizedThoughts);
            }
            const titlesSnapshot: string[] = thoughtTitles.length ? [...thoughtTitles] : [];
            patchAssistant((msg) => ({
              ...msg,
              content: resp.text,
              thoughts: normalizedThoughts,
              thoughtTitle,
              thoughtTitles: titlesSnapshot,
              streamEvents: resp.stream_events ?? [...collectedEvents],
              isStreaming: false,
              toolStatus: msg.toolLogs && msg.toolLogs.length > 0 ? 'completed' : null,
              toolLogs: msg.toolLogs && msg.toolLogs.length > 0 ? [...msg.toolLogs] : null,
            }));
          },
          onError: (errPayload) => {
            patchAssistant((msg) => ({
              ...msg,
              content: `Error (${errPayload.status}): ${errPayload.detail}`,
              thoughts: null,
              thoughtTitle: null,
              thoughtTitles: null,
              streamEvents: null,
              isStreaming: false,
              toolStatus: msg.toolLogs && msg.toolLogs.length > 0 ? 'completed' : null,
              toolLogs: msg.toolLogs && msg.toolLogs.length > 0 ? [...msg.toolLogs] : msg.toolLogs,
            }));
          },
        },
      });
    } catch (err: any) {
      const message = err?.message ?? 'Unknown error';
      const fallback = accumulatedAnswer.trim();
      if (scrollSpacerActive) {
        setScrollSpacerActive(false);
        setScrollSpacerHeight(0);
      }
      if (spacerReleaseArmed) {
        setSpacerReleaseArmed(false);
      }
      setSpacerBaselineHeight(null);
      if (fallback) {
        const normalizedThoughts = accumulatedThoughts.trim() ? accumulatedThoughts : null;
        if (normalizedThoughts) {
          syncThoughtTitles(normalizedThoughts);
        }
        const titlesSnapshot: string[] = thoughtTitles.length ? [...thoughtTitles] : [];
        patchAssistant((msg) => ({
          ...msg,
          content: fallback,
          thoughts: normalizedThoughts,
          thoughtTitle,
          thoughtTitles: titlesSnapshot,
          streamEvents: [...collectedEvents],
          isStreaming: false,
          toolStatus: msg.toolLogs && msg.toolLogs.length > 0 ? 'completed' : null,
          toolLogs: msg.toolLogs && msg.toolLogs.length > 0 ? [...msg.toolLogs] : msg.toolLogs,
        }));
      } else {
        patchAssistant((msg) => ({
          ...msg,
          content: `Error contacting server: ${message}`,
          thoughts: null,
          thoughtTitle: null,
          thoughtTitles: null,
          streamEvents: null,
          isStreaming: false,
          toolStatus: msg.toolLogs && msg.toolLogs.length > 0 ? 'completed' : null,
          toolLogs: msg.toolLogs && msg.toolLogs.length > 0 ? [...msg.toolLogs] : msg.toolLogs,
        }));
      }
    }
  };

  const sidebarWidth = Math.min(320, Math.max(280, Math.round(width * 0.84)));
  useEffect(() => {
    if (!scrollSpacerActive || !spacerReleaseArmed) return;
    if (listViewportHeight == null || listContentHeight == null || spacerBaselineHeight == null) return;
    const newContentDelta = listContentHeight - spacerBaselineHeight;
    const threshold = Math.max(listViewportHeight - 24, listViewportHeight * 0.85);
    if (newContentDelta > threshold) {
      setScrollSpacerActive(false);
      setScrollSpacerHeight(0);
      setSpacerReleaseArmed(false);
      setSpacerBaselineHeight(null);
    }
  }, [scrollSpacerActive, spacerReleaseArmed, listViewportHeight, listContentHeight, spacerBaselineHeight]);

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
          ref={flatListRef}
          style={styles.list}
          onLayout={(event) => {
            setListViewportHeight(event.nativeEvent.layout.height);
          }}
          data={current?.messages ?? []}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <ChatMessage msg={item} />}
          contentContainerStyle={styles.messages}
          onContentSizeChange={(_, heightValue) => {
            setListContentHeight(heightValue);
          }}
          ListFooterComponent={scrollSpacerActive ? <RNView style={{ height: scrollSpacerHeight }} /> : null}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
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
