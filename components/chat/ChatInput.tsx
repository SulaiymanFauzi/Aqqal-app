import React, { useState, useRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View as RNView, TextStyle, Keyboard, Image, Alert, ScrollView, ActionSheetIOS } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Attachment } from './types';

type Props = {
  onSend: (text: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
};

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const minHeight = 40;
  const maxHeight = 150;
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const t = text.trim();
    if (!t && attachments.length === 0) return;
    onSend(t || 'Sent a photo', attachments);
    setText('');
    setAttachments([]);
    // Dismiss keyboard after sending
    Keyboard.dismiss();
  };

  const takePhoto = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera access to take photos.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newAttachments: Attachment[] = result.assets.map((asset, index) => ({
          id: `${Date.now()}-${index}`,
          type: 'image',
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileName: asset.fileName || undefined,
        }));
        setAttachments([...attachments, ...newAttachments]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to attach images.');
        return;
      }

      // Launch image picker with multiple selection and compression
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.7, // Compress to 70% quality
        allowsEditing: false, // No aspect ratio restriction
        // Resize to max 1200px on longest side for reasonable file size
        exif: false, // Don't include EXIF data to reduce size
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newAttachments: Attachment[] = result.assets.map((asset, index) => ({
          id: `${Date.now()}-${index}`,
          type: 'image',
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileName: asset.fileName || undefined,
        }));
        setAttachments([...attachments, ...newAttachments]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleAttachPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhoto();
          } else if (buttonIndex === 2) {
            pickImage();
          }
        }
      );
    } else if (Platform.OS === 'android') {
      Alert.alert(
        'Add Photo',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: takePhoto },
          { text: 'Choose from Library', onPress: pickImage },
        ],
        { cancelable: true }
      );
    } else {
      // Web: just use image picker
      pickImage();
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(att => att.id !== id));
  };

  return (
    <RNView style={[styles.outer, { backgroundColor: theme.background }] }>
      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.attachmentPreviewContainer}
          contentContainerStyle={styles.attachmentPreviewContent}
        >
          {attachments.map((attachment) => (
            <RNView key={attachment.id} style={styles.attachmentPreview}>
              <Image
                source={{ uri: attachment.uri }}
                style={styles.attachmentImage}
                resizeMode="cover"
              />
              <Pressable
                onPress={() => removeAttachment(attachment.id)}
                style={styles.removeAttachmentBtn}
              >
                <Ionicons name="close-circle" size={20} color="#fff" />
              </Pressable>
            </RNView>
          ))}
        </ScrollView>
      )}
      <RNView style={styles.inputRow}>
        <Pressable
          onPress={handleAttachPress}
          style={({ pressed }) => [
            styles.attachBtn,
            {
              backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e5e9ec',
              opacity: pressed ? 0.7 : 1,
            },
          ]
          }
        >
          <Ionicons name="add" size={24} color={theme.text} />
        </Pressable>
        <RNView
          style={[
            styles.container,
            {
              backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f4f6',
            },
          ]}
        >
          <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              color: theme.text,
              minHeight: minHeight,
              maxHeight: maxHeight,
            },
            Platform.OS === 'web'
              ? ({ outlineWidth: 0, outlineColor: 'transparent' } as TextStyle)
              : undefined,
          ]}
          placeholder="Discuss anything..."
          placeholderTextColor={theme.muted}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          onContentSizeChange={(event) => {
            const { height } = event.nativeEvent.contentSize;
            console.log('Content size changed:', height);
          }}
        />
        <Pressable
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: disabled || (!text.trim() && attachments.length === 0) ? 'rgba(35,49,47,0.18)' : theme.tint,
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
          disabled={disabled || (!text.trim() && attachments.length === 0)}
        >
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </Pressable>
      </RNView>
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 42 : 26,
  },
  attachmentPreviewContainer: {
    marginBottom: 8,
    maxHeight: 100,
  },
  attachmentPreviewContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  attachmentPreview: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  removeAttachmentBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 25,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingRight: 12,
    paddingLeft: 14,
    paddingVertical: 8,
  },
  inputPlaceholderAlign: {
    textAlignVertical: 'center',
    paddingTop: 0,
    paddingLeft: 14,
  },
  inputActiveAlign: {
    textAlignVertical: 'top',
    paddingBottom: 8,
    paddingLeft: 14
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
