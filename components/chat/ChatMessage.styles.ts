import { StyleSheet, Platform } from 'react-native';
import { FONT_FAMILY } from './constants';

export const styles = StyleSheet.create({
  row: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageColumn: {
    width: '100%',
  },
  assistantColumn: {
    alignItems: 'center',
  },
  userColumn: {
    alignItems: 'flex-end',
  },
  card: {
    maxWidth: 720,
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: '#051417',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === 'web' ? 0.05 : 0.12,
    shadowRadius: 16,
    elevation: 2,
    alignSelf: 'stretch',
  },
  userCard: {
    borderRadius: 25,
    paddingVertical: 8,
    alignSelf: 'flex-end',
    maxWidth: '75.0%',
    paddingHorizontal: 20,
    width: undefined,
    flexShrink: 1,
  },
  assistantCard: {
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    shadowOpacity: 0,
    elevation: 0,
    width: '100%',
  },
  thoughtTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  thoughtHeader: {
    marginBottom: 10,
  },
  thoughtSummaryContainer: {
    marginTop: 6,
  },
  thoughtHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  toolLogsContainer: {
    marginTop: 6,
    gap: 4,
  },
  toolLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolLogLine: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '500',
  },
  attachmentsContainer: {
    marginBottom: 8,
    maxHeight: 220,
  },
  attachmentsContainerUser: {
    alignSelf: 'flex-end',
  },
  attachmentsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  attachmentWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  attachmentImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  userAttachmentImage: {
    width: 180,
    height: 180,
  },
  userText: {
    color: '#23312f',
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 25,
    letterSpacing: 0.15,
  },
  imageViewerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageViewerCloseText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
  },
  imageViewerImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
});
