import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Opens a URL in the appropriate browser based on platform
 */
export async function openURL(url: string) {
  if (Platform.OS === 'web') {
    Linking.openURL(url);
  } else {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: '#0ea5e9',
      toolbarColor: '#ffffff',
    });
  }
}

/**
 * Detects if text is predominantly Arabic
 */
export function isArabicText(text: string): boolean {
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 && (arabicChars / totalChars) > 0.5;
}

/**
 * Preprocesses content to convert LaTeX expressions to markdown
 */
export function preprocessContent(content: string): string {
  let processed = content;
  
  // Convert LaTeX \textit{...} to markdown italics *...*
  processed = processed.replace(/\$\\textit\{([^}]+)\}\$/g, '*$1*');
  
  // Convert other common LaTeX text commands
  processed = processed.replace(/\$\\textbf\{([^}]+)\}\$/g, '**$1**');
  processed = processed.replace(/\$\\text\{([^}]+)\}\$/g, '$1');
  
  // Remove standalone $ symbols that aren't part of math
  processed = processed.replace(/\$([^$\\]+)\$/g, '$1');
  
  return processed;
}

/**
 * Extracts Quran verse blocks from content
 * Returns array of { type: 'text' | 'quran', content: string }
 */
export function extractQuranBlocks(content: string): Array<{ type: 'text' | 'quran'; content: string }> {
  const blocks: Array<{ type: 'text' | 'quran'; content: string }> = [];
  
  // Split by *** markers
  const parts = content.split(/\*\*\*/);
  
  // Every odd index (1, 3, 5...) is a Quran block
  parts.forEach((part, index) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    
    if (index % 2 === 1) {
      // Odd index = Quran verse block
      blocks.push({ type: 'quran', content: trimmed });
    } else {
      // Even index = regular text
      blocks.push({ type: 'text', content: trimmed });
    }
  });
  
  return blocks;
}

/**
 * Cleans thought titles by removing asterisks
 */
export function cleanThoughtTitles(titles: string[]): string[] {
  return titles
    .map((title) => title.replace(/\*+/g, '').trim())
    .filter(Boolean);
}
