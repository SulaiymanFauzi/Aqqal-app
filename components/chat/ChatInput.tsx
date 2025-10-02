import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View as RNView } from 'react-native';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <RNView style={styles.container}>
        <TextInput
          style={[styles.input, { borderColor: theme.separator }]}
          placeholder="Message Aqqal..."
          placeholderTextColor={theme.muted}
          value={text}
          onChangeText={setText}
          multiline
        />
        <Pressable onPress={handleSend} style={[styles.sendBtn, { backgroundColor: theme.tint }, disabled && styles.disabled]} disabled={disabled}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </RNView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 8,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#444',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 140,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  sendBtn: {
    marginLeft: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#2f95dc',
  },
  disabled: {
    opacity: 0.6,
  },
  sendText: {
    color: '#fff',
    fontWeight: '700',
  },
});
