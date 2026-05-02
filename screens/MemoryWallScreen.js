// screens/MemoryWallScreen.js
// Shared photo/video wall — newest-first masonry grid of all couple media.
// Apple Editorial aesthetic — Velvet Glass palette, full-bleed lightbox on tap.

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import Icon from '../components/Icon';
import CloseScreenHeader, { CLOSE_HEADER_STYLES } from '../components/CloseScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { useAppContext } from '../context/AppContext';
import { DataLayer } from '../services/localfirst';
import AttachmentCacheService from '../services/AttachmentCacheService';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';
import MediaLightbox from '../components/MediaLightbox';

const { width: SCREEN_W } = Dimensions.get('window');

const COL = 2;
const GAP = 2;
const THUMB_W = (SCREEN_W - GAP * (COL + 1)) / COL;

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

function getSortTime(value) {
  if (!value) return 0;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getMediaKind(mimeType) {
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType?.startsWith('image/')) return 'image';
  return 'image';
}

export async function buildMemoryWallMediaItem(memory) {
  try {
    const mediaRef = memory?.media_ref || memory?.mediaRef || null;
    const uri = memory?.mediaUri
      || memory?.media_uri
      || await AttachmentCacheService.getCachedUri(mediaRef);

    if (!uri) return null;

    const mimeType = memory.mime_type || memory.mimeType || 'image/jpeg';
    const kind = getMediaKind(mimeType);

    return {
      id: `memory-wall:${memory.id}`,
      sourceId: memory.id,
      uri,
      mime: mimeType,
      mimeType,
      caption: memory.content || '',
      date: memory.created_at || memory.date || null,
      type: memory.type || 'memory',
      media: {
        uri,
        mimeType,
        kind,
      },
    };
  } catch {
    return null;
  }
}

export default function MemoryWallScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { state } = useAppContext();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  const t = {
    bg: colors.background,
    surface: isDark ? 'rgba(28,28,30,0.9)' : 'rgba(255,255,255,0.9)',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [personal, shared] = await Promise.all([
        DataLayer.getMemories({ limit: 500 }),
        state?.isLinked ? DataLayer.getSharedMemories({ limit: 500 }) : Promise.resolve([]),
      ]);

      const all = [...(personal || []), ...(shared || [])];
      const seen = new Set();

      const withMedia = all.filter((memory) => {
        const hasMedia = memory?.media_ref || memory?.mediaRef || memory?.mediaUri || memory?.media_uri;
        if (!memory?.id || !hasMedia || seen.has(memory.id)) return false;
        seen.add(memory.id);
        return true;
      });

      withMedia.sort((a, b) => getSortTime(b.created_at) - getSortTime(a.created_at));

      const resolved = await Promise.all(
        withMedia.map((memory) => buildMemoryWallMediaItem(memory))
      );

      setItems(resolved.filter(Boolean));
    } catch (error) {
      if (__DEV__) console.warn('[MemoryWallScreen] load error:', error?.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [state?.isLinked]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openLightbox = useCallback((item) => {
    impact(ImpactFeedbackStyle.Medium);
    setLightbox(item);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  const renderThumb = useCallback(({ item, index }) => {
    const isVideo = item.media?.kind === 'video' || item.mimeType?.startsWith('video/');
    const height = index % 3 === 0 ? THUMB_W * 1.3 : THUMB_W;

    return (
      <Animated.View entering={FadeIn.delay(index * 30).duration(300)}>
        <TouchableOpacity
          onPress={() => openLightbox(item)}
          activeOpacity={0.88}
          style={[styles.thumb, { width: THUMB_W, height }]}
        >
          {isVideo ? (
            <View style={styles.videoPlaceholder}>
              <Icon name="play-circle-outline" size={36} color="#fff" />
              <Text style={styles.videoPlaceholderText}>Video</Text>
            </View>
          ) : (
            <Image
              source={{ uri: item.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          )}

          {isVideo && (
            <View style={styles.playBadge}>
              <Icon name="play-circle-outline" size={28} color="#fff" />
            </View>
          )}

          {item.caption ? (
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)']}
              style={styles.thumbGradient}
            >
              <Text style={styles.thumbCaption} numberOfLines={2}>
                {item.caption}
              </Text>
            </LinearGradient>
          ) : null}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [openLightbox]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: t.bg }}>
        <CloseScreenHeader
          title="Our Photos"
          subtitle="MEMORY WALL"
          titleColor={t.text}
          subtitleColor={t.primary}
          closeColor={t.text}
          closeIcon="close"
          onClose={() => navigation.goBack()}
          rightAccessory={(
            <TouchableOpacity
              onPress={() => {
                impact(ImpactFeedbackStyle.Light);
                navigation.navigate('ThinkingOfYou');
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.headerActionButton}
            >
              <Icon name="camera-outline" size={26} color={t.primary} />
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : items.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.empty}>
          <Icon name="images-outline" size={52} color={withAlpha(t.text, 0.25)} />

          <Text style={[styles.emptyTitle, { color: t.text }]}>
            No photos yet
          </Text>

          <Text style={[styles.emptyBody, { color: t.subtext }]}>
            Tap the camera icon to send your partner a photo right now.
          </Text>

          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: t.primary }]}
            onPress={() => navigation.navigate('ThinkingOfYou')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyBtnText}>Send a Photo</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <FlatList
          data={items}
          numColumns={COL}
          keyExtractor={keyExtractor}
          renderItem={renderThumb}
          contentContainerStyle={{ padding: GAP, paddingBottom: insets.bottom + 24 }}
          columnWrapperStyle={{ gap: GAP }}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {!loading && items.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: t.primary, bottom: insets.bottom + 24 }]}
          onPress={() => {
            impact(ImpactFeedbackStyle.Medium);
            navigation.navigate('ThinkingOfYou');
          }}
          activeOpacity={0.85}
        >
          <Icon name="camera-outline" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal
        visible={!!lightbox}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeLightbox}
      >
        <MediaLightbox
          item={lightbox}
          onClose={closeLightbox}
          showCloseButton
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: CLOSE_HEADER_STYLES.header,
  headerTitle: CLOSE_HEADER_STYLES.title,
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  headerActionButton: CLOSE_HEADER_STYLES.closeButton,
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1e',
    gap: 6,
  },
  videoPlaceholderText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#fff',
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  playBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  thumbCaption: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  emptyBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyBtnText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});
