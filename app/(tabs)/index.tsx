import React, { useEffect, useMemo, useState, useLayoutEffect } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, Modal, Pressable, View as RNView, Platform, PanResponder, Keyboard, Animated, KeyboardAvoidingView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { View } from '@/components/Themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';
import EmptyState from '@/components/chat/EmptyState';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import { ScrollProvider, useScrollContext } from '@/components/chat/ScrollContext';
import type { Conversation, Message, StreamEvent, Attachment } from '@/components/chat/types';
import { loadConversations, saveConversations, hasCompletedOnboarding, setOnboardingCompleted } from '@/utils/storage';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Entypo from '@expo/vector-icons/Entypo';
import AntDesign from '@expo/vector-icons/AntDesign';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from 'expo-router';
import { chat as chatApi } from '@/utils/api';

function ChatContent() {
  const { setScrollVelocity } = useScrollContext();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
  const keyboardHeight = React.useRef(new Animated.Value(0)).current;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarSlideAnim = React.useRef(new Animated.Value(0)).current;
  const chatFadeAnim = React.useRef(new Animated.Value(1)).current;
  const glowScale = React.useRef(new Animated.Value(0)).current;
  const glowOpacity = React.useRef(new Animated.Value(0)).current;
  const [showGlow, setShowGlow] = useState(false);
  const [glowPosition, setGlowPosition] = useState({ x: 0, y: 0 });
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const scrollButtonScale = React.useRef(new Animated.Value(0)).current;
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

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

  const handleNewChat = React.useCallback((buttonX?: number, buttonY?: number) => {
    // Haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Set glow position (top-right corner if not provided)
    const x = buttonX ?? width - 30;
    const y = buttonY ?? insets.top + 20;
    setGlowPosition({ x, y });
    setShowGlow(true);

    // Reset animation values
    glowScale.setValue(0);
    glowOpacity.setValue(1);

    // Calculate scale needed to cover the entire screen
    const maxDistance = Math.sqrt(width * width + height * height);
    const targetScale = (maxDistance * 2) / 100; // Base size is 100

    // Start glow animation
    Animated.parallel([
      Animated.timing(glowScale, {
        toValue: targetScale,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowGlow(false);
    });

    // Fade out chat content
    Animated.timing(chatFadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Create new chat
      const id = genId();
      const conv: Conversation = { id, title: 'New chat', messages: [], updatedAt: Date.now() };
      setConversations((prev) => [conv, ...prev]);
      setCurrentId(id);
      
      // Reset scroll button state for new chat
      setShowScrollButton(false);
      scrollButtonScale.setValue(0);
      
      // Fade in animation
      Animated.timing(chatFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  }, [chatFadeAnim, glowScale, glowOpacity, scrollButtonScale, width, height, insets.top]);

  useEffect(() => {
    (async () => {
      // Check onboarding status first
      const completed = await hasCompletedOnboarding();
      setShowOnboarding(!completed);
      setOnboardingChecked(true);
      
      // Load conversations
      const convs = await loadConversations();
      if (convs.length) {
        setConversations(convs);
        setCurrentId(convs[0].id);
      } else {
        const id = genId();
        const first: Conversation = { id, title: 'New chat', messages: [], updatedAt: Date.now() };
        setConversations([first]);
        setCurrentId(id);
      }
    })();
  }, []);
  
  const handleOnboardingComplete = async () => {
    await setOnboardingCompleted();
    setShowOnboarding(false);
  };

  // Smooth keyboard animation
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setIsKeyboardVisible(true);
        Animated.timing(keyboardHeight, {
          toValue: -(e.endCoordinates.height - insets.bottom),
          duration: Platform.OS === 'ios' ? 160 : 250,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        Animated.timing(keyboardHeight, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? 200 : 250,
          useNativeDriver: true,
        }).start(() => {
          setIsKeyboardVisible(false);
        });
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [keyboardHeight, insets.bottom]);

  const sidebarWidth = Math.min(320, Math.max(280, Math.round(width * 0.84)));

  // Animate sidebar slide (push animation)
  useEffect(() => {
    if (showSidebar) {
      // Opening: Show modal first, then push content to the right
      setSidebarVisible(true);
      Animated.timing(sidebarSlideAnim, {
        toValue: sidebarWidth,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      // Closing: Push content back to left, then hide modal
      Animated.timing(sidebarSlideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setSidebarVisible(false);
      });
    }
  }, [showSidebar, sidebarSlideAnim, sidebarWidth]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Provide a header menu button on mobile to open the conversation list
  useLayoutEffect(() => {
    if (!navigation) return;
    if (isWide) {
      // Remove menu button on wide layouts
      // @ts-ignore - setOptions exists at runtime
      navigation.setOptions({
        headerLeft: undefined,
        headerRight: () => (
          <Pressable 
            onPress={() => handleNewChat()} 
            style={{ 
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.06)',
              borderRadius: 20,
              marginRight: 12,
            }}
          >
            <Entypo name="new-message" size={20} color="#6b7280" />
          </Pressable>
        ),
      });
    } else {
      // @ts-ignore - setOptions exists at runtime
      navigation.setOptions({
        headerLeft: () => (
          <Pressable 
            onPress={() => setShowSidebar(true)} 
            style={{ 
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.06)',
              borderRadius: 20,
              marginLeft: 12,
            }}
          >
            <AntDesign name="align-left" size={20} color={theme.text} />
          </Pressable>
        ),
        headerRight: () => (
          <Pressable 
            onPress={() => handleNewChat()} 
            style={{ 
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.06)',
              borderRadius: 20,
              marginRight: 12,
            }}
          >
            <Entypo name="new-message" size={20} color="#6b7280" />
          </Pressable>
        ),
      });
    }
  }, [navigation, isWide, theme.text, handleNewChat]);

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

  const updateConversation = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  const handleSend = async (text: string, attachments?: Attachment[]) => {
    if (!current) return;

    const userMsg: Message = { 
      id: genId(), 
      role: 'user', 
      content: text, 
      createdAt: Date.now(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    };
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
        max_output_tokens: 65536,
        stream: true,
        use_search: true,
        streamHandlers: {
          onEvent: (evt) => {
            collectedEvents.push(evt);
            if (!spacerReleaseArmed) {
              setSpacerReleaseArmed(true);
            }
            if (evt.kind === 'answer') {
              accumulatedAnswer += evt.text;
              // Debug: check for problematic newlines
              if (evt.text.includes('\n\n')) {
                console.log('⚠️ [DOUBLE NEWLINE IN CHUNK]', JSON.stringify(evt.text));
              }
              if (evt.text.endsWith('\n')) {
                console.log('⚠️ [CHUNK ENDS WITH NEWLINE]', JSON.stringify(evt.text.slice(-20)));
              }
              // Don't trim during streaming - only trim in onFinal
              // Trimming during streaming can cause paragraph breaks to appear prematurely
              patchAssistant((msg) => ({
                ...msg,
                content: accumulatedAnswer,
                streamEvents: [...collectedEvents],
                isStreaming: true,
              }));
            } else {
              console.log('💭 [THOUGHT CHUNK]', evt.text);
              // Don't accumulate tool lines in thoughts display (they're shown separately)
              const isToolChunk = evt.text.trim().startsWith('[tools]') || evt.text.includes('[tools]');
              if (!isToolChunk) {
                accumulatedThoughts += evt.text;
                syncThoughtTitles(evt.text);
              }
              const titlesSnapshot: string[] = thoughtTitles.length ? [...thoughtTitles] : [];
              const trimmedToolText = evt.text?.trim() ?? '';
              const sanitizedToolEntry = trimmedToolText
                .replace(/^\u0000+/g, '')
                .replace(/^\[tools\]\s*/i, '')
                .trim();
              const isToolLine = sanitizedToolEntry.length > 0 && trimmedToolText.replace(/^\u0000+/g, '').startsWith('[tools]');
              const toolResultLine = isToolLine && /^result\b/i.test(sanitizedToolEntry);
              
              // If a tool is being called and we have accumulated answer, trigger replacement animation
              if (isToolLine && !toolResultLine && accumulatedAnswer.length > 50) {
                const contentToReplace = accumulatedAnswer;
                patchAssistant((msg) => ({
                  ...msg,
                  replacedContent: contentToReplace,
                  shouldAnimateReplacement: true,
                  content: '', // Clear content immediately so it fades out
                }));
                // Clear the accumulated answer so new content starts fresh
                accumulatedAnswer = '';
              }
              
              // Format tool activity for user-friendly display
              const formatToolActivity = (entry: string): string => {
                // "calling SearchAyah" -> "Searching Quranic verses..."
                // "result SearchAyah ok=True" -> "✓ Found verses"
                if (entry.startsWith('calling ')) {
                  const toolName = entry.replace('calling ', '').trim();
                  console.log('🔍 [TOOL NAME]', toolName);
                  const toolLabels: Record<string, string> = {
                    'SearchAyah': 'Searching Quranic verses',
                    'searchAyah': 'Searching Quranic verses',
                    'GetVerseKeyArabic': 'Retrieving Quranic text',
                    'getVerseKeyArabic': 'Retrieving Quranic text',
                    'SearchHadith': 'Searching hadith collections',
                    'searchHadith': 'Searching hadith collections',
                    'GetHadithByID': 'Retrieving hadith',
                    'getHadithByID': 'Retrieving hadith',
                    'SearchKeywords': 'Searching Islamic terminology',
                    'searchKeywords': 'Searching Islamic terminology',
                  };
                  return toolLabels[toolName] || `Accessing ${toolName}...`;
                } else if (entry.startsWith('result ')) {
                  const match = entry.match(/result (\w+) ok=(\w+)/);
                  if (match) {
                    const [, toolName, success] = match;
                    if (success === 'True') {
                      const successLabels: Record<string, string> = {
                        'SearchAyah': '✓ Verses found',
                        'searchAyah': '✓ Verses found',
                        'GetVerseKeyArabic': '✓ Text retrieved',
                        'getVerseKeyArabic': '✓ Text retrieved',
                        'SearchHadith': '✓ Hadith found',
                        'searchHadith': '✓ Hadith found',
                        'GetHadithByID': '✓ Retrieved',
                        'getHadithByID': '✓ Retrieved',
                        'SearchKeywords': '✓ Terms found',
                        'searchKeywords': '✓ Terms found',
                      };
                      return successLabels[toolName] || '✓ Complete';
                    } else {
                      return '⚠ Unable to retrieve';
                    }
                  }
                }
                return entry;
              };
              
              if (isToolLine) {
                console.log('🔧 [TOOL DETECTED]', { sanitizedToolEntry, toolResultLine });
              }
              
              patchAssistant((msg) => ({
                ...msg,
                thoughts: accumulatedThoughts,
                thoughtTitle,
                thoughtTitles: titlesSnapshot,
                streamEvents: [...collectedEvents],
                isStreaming: true,
                toolStatus: isToolLine ? (toolResultLine ? 'completed' : 'active') : msg.toolStatus,
                // Don't show tool logs - they're not needed
                toolLogs: undefined,
              }));
            }
          },
          onFinal: (resp) => {
            // Log grounding metadata if present
            if (resp.grounding_metadata) {
              console.log('🔍 [GROUNDING] Google Search was used!');
              if (resp.grounding_metadata.web_search_queries) {
                console.log('🔍 [GROUNDING] Queries:', resp.grounding_metadata.web_search_queries);
              }
              if (resp.grounding_metadata.grounding_chunks) {
                console.log('🔍 [GROUNDING] Sources:', resp.grounding_metadata.grounding_chunks.length, 'chunks');
                resp.grounding_metadata.grounding_chunks.forEach((chunk, idx) => {
                  console.log(`  [${idx + 1}] ${chunk.title || 'Untitled'}: ${chunk.uri}`);
                });
              }
            }
            
            // Filter out [tools] lines from thoughts
            const filterToolLines = (text: string | null | undefined): string | null => {
              if (!text) return null;
              const lines = text.split('\n');
              const filtered = lines.filter(line => {
                const trimmed = line.trim();
                return !trimmed.startsWith('[tools]') && !trimmed.includes('[tools]');
              });
              const result = filtered.join('\n').trim();
              return result || null;
            };
            
            const normalizedThoughts =
              resp.thoughts !== undefined && resp.thoughts !== null
                ? filterToolLines(resp.thoughts)
                : accumulatedThoughts
                ? filterToolLines(accumulatedThoughts)
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
              content: resp.text.trimEnd(),
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
      {/* Circular glow animation overlay */}
      {showGlow && (
        <Animated.View
          style={[
            styles.glowOverlay,
            {
              left: glowPosition.x - 50,
              top: glowPosition.y - 50,
              opacity: glowOpacity,
              transform: [
                { scale: glowScale },
              ],
            },
          ]}
        />
      )}
      {isWide && (
        <ChatSidebar
          conversations={conversations}
          currentId={currentId}
          onNewChat={handleNewChat}
          onSelectChat={setCurrentId}
          style={{ width: 300 }}
        />
      )}

      <Animated.View 
        style={[
          styles.chatArea,
          { 
            transform: [
              { translateX: !isWide ? sidebarSlideAnim : 0 },
            ],
            opacity: chatFadeAnim
          }
        ]}
      >
        {/* Edge swipe catcher on mobile */}
        {Platform.OS !== 'web' && !isWide && (
          <RNView {...openEdgePan.panHandlers} style={styles.edgeSwipe} />
        )}
        <Animated.View 
          style={[
            { flex: 1 },
            {
              transform: [{ translateY: keyboardHeight }]
            }
          ]}
        >
          <FlatList
            ref={flatListRef}
            style={styles.list}
            onLayout={(event) => {
              setListViewportHeight(event.nativeEvent.layout.height);
            }}
            data={current?.messages ?? []}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <ChatMessage msg={item} />}
            contentContainerStyle={[
              styles.messages,
              (current?.messages?.length ?? 0) === 0 && { flex: 1 }
            ]}
            onContentSizeChange={(_, heightValue) => {
              setListContentHeight(heightValue);
            }}
            onScroll={(event) => {
              const { velocity } = event.nativeEvent;
              if (velocity) {
                setScrollVelocity(velocity.y);
              }
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
              const nearBottom = distanceFromBottom < 100;
              const hasMessages = (current?.messages?.length ?? 0) > 0;
              const hasScrollableContent = contentSize.height > layoutMeasurement.height;
              const shouldShow = !nearBottom && hasMessages && hasScrollableContent;
              
              setIsNearBottom(nearBottom);
              
              if (shouldShow !== showScrollButton) {
                setShowScrollButton(shouldShow);
                Animated.spring(scrollButtonScale, {
                  toValue: shouldShow ? 1 : 0,
                  useNativeDriver: true,
                  tension: 100,
                  friction: 8,
                }).start();
              }
            }}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <EmptyState onPromptSelect={(prompt) => handleSend(prompt)} />
            }
            ListFooterComponent={scrollSpacerActive ? <RNView style={{ height: scrollSpacerHeight }} /> : null}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
        </Animated.View>
        <Animated.View
          style={{
            transform: [{ translateY: keyboardHeight }]
          }}
        >
          <Animated.View
            style={[
              styles.scrollToBottomBtn,
              {
                transform: [{ scale: scrollButtonScale }],
                opacity: scrollButtonScale,
              }
            ]}
            pointerEvents={showScrollButton ? 'auto' : 'none'}
          >
            <Pressable
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                flatListRef.current?.scrollToEnd({ animated: true });
              }}
              style={styles.scrollToBottomBtnInner}
            >
              <Ionicons name="arrow-down" size={24} color="#000000" />
            </Pressable>
          </Animated.View>
          <ChatInput onSend={handleSend} />
        </Animated.View>
      </Animated.View>

      {/* Mobile sidebar modal */}
      <Modal
        visible={!isWide && sidebarVisible}
        animationType="none"
        transparent
        onRequestClose={() => setShowSidebar(false)}
      >
        <RNView style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalSidebar, 
              { 
                backgroundColor: theme.background, 
                borderColor: theme.separator, 
                width: sidebarWidth,
                transform: [{ 
                  translateX: Animated.subtract(sidebarSlideAnim, sidebarWidth) 
                }]
              }
            ]}
          >            
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
          </Animated.View>
          {/* Tap outside to close */}
          <Pressable style={{ flex: 1 }} onPress={() => setShowSidebar(false)} />
        </RNView>
      </Modal>

      {/* Onboarding Modal */}
      {onboardingChecked && (
        <Modal
          visible={showOnboarding}
          animationType="fade"
          presentationStyle="fullScreen"
        >
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        </Modal>
      )}

    </View>
  );
}

export default function TabOneScreen() {
  return (
    <ScrollProvider>
      <ChatContent />
    </ScrollProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: 'row',
  },
  glowOverlay: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(4, 164, 149, 0.15)',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  scrollToBottomBtn: {
    position: 'absolute',
    bottom: 110,
    left: '50%',
    marginLeft: -20,
    zIndex: 100,
  },
  scrollToBottomBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  list: {
    flex: 1,
    backgroundColor: '#ffffff',
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
});
