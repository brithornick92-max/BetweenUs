import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { SYSTEM_FONT } from '../utils/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function formatDate(iso) {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MediaLightbox({ item, onClose, showCloseButton = false }) {
  const insets = useSafeAreaInsets();

  const uri = item?.uri || item?.media?.uri || null;

  const isVideo = !!(
    item?.mime?.startsWith('video/')
    || item?.mimeType?.startsWith('video/')
    || item?.media?.kind === 'video'
    || item?.media?.mimeType?.startsWith('video/')
  );

  const player = useVideoPlayer(isVideo && uri ? uri : null, (videoPlayer) => {
    videoPlayer.loop = false;

    if (isVideo && uri) {
      videoPlayer.play();
    }
  });

  if (!item || !uri) return null;

  const caption = item?.caption || item?.body || item?.title;
  const dateStr = item?.date || item?.dateLabel;

  return (
    <View style={styles.lightboxBg}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        activeOpacity={1}
      />

      {isVideo ? (
        <VideoView
          style={styles.lightboxMedia}
          player={player}
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
          allowsPictureInPicture
        />
      ) : (
        <Image
          source={{ uri }}
          style={styles.lightboxMedia}
          resizeMode="contain"
        />
      )}

      {(caption || dateStr) && (
        <BlurView
          intensity={60}
          tint="dark"
          style={[
            styles.lightboxMeta,
            { paddingBottom: insets.bottom + 12 },
          ]}
        >
          {caption ? (
            <Text style={styles.lightboxCaption}>
              {caption}
            </Text>
          ) : null}

          {dateStr ? (
            <Text style={styles.lightboxDate}>
              {item.date ? formatDate(item.date) : dateStr}
            </Text>
          ) : null}
        </BlurView>
      )}

      {showCloseButton && (
        <View style={[styles.lightboxClose, { top: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close media preview"
          >
            <BlurView intensity={50} tint="dark" style={styles.closeBtn}>
              <Icon name="close-outline" size={22} color="#fff" />
            </BlurView>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lightboxBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
  },
  lightboxMedia: {
    width: SCREEN_W,
    height: SCREEN_H * 0.72,
    alignSelf: 'center',
  },
  lightboxMeta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 34,
  },
  lightboxCaption: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  lightboxDate: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    color: 'rgba(255,255,255,0.62)',
  },
  lightboxClose: {
    position: 'absolute',
    right: 18,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
