import { Platform } from 'react-native';

export const FONT_FAMILY = Platform.OS === 'web' 
  ? 'Canva Sans, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans' 
  : undefined;

export const ARABIC_FONT_FAMILY = Platform.OS === 'web'
  ? 'Scheherazade New, Amiri Quran, "Lateef", "Noto Naskh Arabic", "Qalam Majalla", serif'
  : 'ScheherazadeNew-Bold';

export const USER_CARD_COLORS = {
  backgroundColor: '#9ce4d6',
  borderColor: 'transparent',
  textColor: '#23312f',
  metaColor: 'rgba(35, 49, 47, 0.7)',
  separator: 'rgba(35, 49, 47, 0.18)',
};
