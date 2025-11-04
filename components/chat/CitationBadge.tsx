import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

type Citation = {
  number: number;
  url: string;
  title: string;
};

type Props = {
  citations: Citation[];
};

export function CitationBadge({ citations }: Props) {
  const primaryCitation = citations[0];
  const additionalCount = citations.length - 1;

  const handlePress = async () => {
    // Always open the first citation URL
    const url = primaryCitation.url;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: '#0ea5e9',
        toolbarColor: '#ffffff',
      });
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.badge}
      activeOpacity={0.7}
    >
      <Text style={styles.badgeText}>
        {primaryCitation.title}
        {additionalCount > 0 && ` +${additionalCount}`}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'black',
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 2,
    marginRight: 2,
    alignSelf: 'flex-start',
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
    transform: [{ translateY: 5 }],
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
});
