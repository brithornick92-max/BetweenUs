// screens/ThinkingOfYouScreen.js
// One-tap "thinking of you" photo/video → partner send.
// Camera capture or library pick → optional caption → send with a micro-reaction.
// Apple Editorial · Velvet Glass palette

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';

import Icon from '../components/Icon';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import CloseScreenHeader, { CLOSE_HEADER_STYLES } from '../components/CloseScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { DataLayer } from '../services/localfirst';
import PartnerNotifications from '../services/PartnerNotifications';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';
import { getPartnerDisplayName } from '../utils/profileNames';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

// Curated micro-reactions — Ionicons outline only
const REACTIONS = [
  { id: 'missing',   icon: 'sad-outline',         label: 'Missing you' },
  { id: 'smiling',   icon: 'happy-outline',        label: 'This made me smile' },
  { id: 'obsessed',  icon: 'star-outline',         label: 'Obsessed' },
  { id: 'thinking',  icon: 'chatbubble-outline',   label: 'Thinking of you' },
  { id: 'fire',      icon: 'flame-outline',        label: 'Hot' },
  { id: 'love',      icon: 'heart-outline',        label: 'Love you' },
];

export default function ThinkingOfYouScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const { state } = useAppContext();

  const [media, setMedia] = useState(null); // { uri, type, mimeType }
  const [caption, setCaption] = useState('');
  const [reaction, setReaction] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const inputRef = useRef(null);
  const partnerName = getPartnerDisplayName(userProfile, state?.userProfile, 'your partner');
  
  const videoPlayer = useVideoPlayer(media?.uri || null, player => {
    player.loop = false;
  });

  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? 'rgba(28,28,30,0.45)' : 'rgba(255,255,255,0.65)',
    primary: colors.primary || '#D2121A',
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
  }), [colors, isDark]);

  const pickFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access in Settings to pick a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.92,
    });
    if (!result.canceled && result.assets?.[0]) {
      impact(ImpactFeedbackStyle.Light);
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        type: asset.type || 'image',
        mimeType: asset.mimeType || (asset.type === 'video' ? 'video/quicktime' : 'image/jpeg'),
        fileName: asset.fileName || `media_${Date.now()}`,
      });
    }
  }, []);

  const openCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access in Settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.92,
    });
    if (!result.canceled && result.assets?.[0]) {
      impact(ImpactFeedbackStyle.Light);
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        type: asset.type || 'image',
        mimeType: asset.mimeType || (asset.type === 'video' ? 'video/quicktime' : 'image/jpeg'),
        fileName: asset.fileName || `media_${Date.now()}`,
      });
    }
  }, []);

  const send = useCallback(async () => {
    if (!media) return;

    impact(ImpactFeedbackStyle.Heavy);
    setSending(true);

    try {
      const selectedReaction = reaction ? REACTIONS.find(r => r.id === reaction) : null;
      const fullCaption = [
        selectedReaction ? selectedReaction.label : '',
        caption.trim(),
      ].filter(Boolean).join(' · ');

      await DataLayer.saveMemory({
        content: fullCaption || 'Thinking of you',
        type: 'thinking_of_you',
        mediaUri: media.uri,
        mimeType: media.mimeType,
        fileName: media.fileName,
      });

      await PartnerNotifications.thinkingOfYouPhoto(null, selectedReaction?.label || null).catch(() => {});

      notification(NotificationFeedbackType.Success);
      setSent(true);

      setTimeout(() => {
        navigation.goBack();
      }, 1800);
    } catch (err) {
      notification(NotificationFeedbackType.Error);
      Alert.alert('Could not send', err?.message || 'Please try again.');
      setSending(false);
    }
  }, [media, caption, reaction, navigation]);

  if (sent) {
    return (
      <View style={[styles.root, { backgroundColor: t.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Animated.View entering={ZoomIn.duration(400)} style={styles.sentContainer}>
          <Icon name="camera-outline" size={64} color={t.primary} style={{ lineHeight: 64, textAlign: 'center' }} />
          <Text style={[styles.sentTitle, { color: t.text }]}>Sent to {partnerName}</Text>
          <Text style={[styles.sentBody, { color: t.subtext }]}>They'll feel it.</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <GlowOrb color={t.primary} top={-80} left={SCREEN_W - 120} opacity={0.3} />
      <FilmGrain opacity={0.03} />

      <SafeAreaView style={styles.safe}>
        <CloseScreenHeader
          title="Thinking of You"
          subtitle="QUICK SEND"
          titleColor={t.text}
          closeColor={t.text}
          onClose={() => navigation.goBack()}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Media picker / preview */}
            {media ? (
              <Animated.View entering={FadeIn.duration(300)} style={styles.previewWrapper}>
                {media.type === 'video' ? (
                  <VideoView
                    style={styles.preview}
                    player={videoPlayer}
                    fullscreenOptions={{ enable: true }}
                    allowsPictureInPicture
                  />
                ) : (
                  <Image source={{ uri: media.uri }} style={styles.preview} resizeMode="cover" />
                )}
                <TouchableOpacity
                  style={styles.changeMedia}
                  onPress={pickFromLibrary}
                >
                  <BlurView intensity={50} tint="dark" style={styles.changeMediaInner}>
                    <Text style={styles.changeMediaText}>Change</Text>
                  </BlurView>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.duration(400)} style={styles.pickWrapper}>
                <TouchableOpacity
                  style={[styles.pickBtn, { backgroundColor: t.surface, borderColor: t.border }]}
                  onPress={openCamera}
                >
                  <Icon name="camera-outline" size={32} color={t.primary} />
                  <Text style={[styles.pickBtnLabel, { color: t.text }]}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickBtn, { backgroundColor: t.surface, borderColor: t.border }]}
                  onPress={pickFromLibrary}
                >
                  <Icon name="images-outline" size={32} color={t.primary} />
                  <Text style={[styles.pickBtnLabel, { color: t.text }]}>Choose Photo</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Reaction row */}
            {media && (
              <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.reactionRow}>
                {REACTIONS.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => {
                      impact(ImpactFeedbackStyle.Light);
                      setReaction(prev => prev === r.id ? null : r.id);
                    }}
                    style={[
                      styles.reactionBtn,
                      reaction === r.id && { backgroundColor: withAlpha(t.primary, 0.15), borderColor: t.primary },
                      reaction !== r.id && { borderColor: t.border },
                    ]}
                  >
                    <Icon name={r.icon} size={22} color={reaction === r.id ? t.primary : t.subtext} style={{ lineHeight: 22, textAlign: 'center' }} />
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}

            {/* Caption input */}
            {media && (
              <Animated.View entering={FadeInDown.delay(140).duration(350)} style={[styles.inputCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                <TextInput
                  ref={inputRef}
                  value={caption}
                  onChangeText={setCaption}
                  placeholder={`Add a note to ${partnerName}…`}
                  placeholderTextColor={t.subtext}
                  style={[styles.input, { color: t.text }]}
                  multiline
                  maxLength={200}
                  returnKeyType="done"
                  blurOnSubmit
                />
              </Animated.View>
            )}

            {/* Send button */}
            {media && (
              <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.sendWrapper}>
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: t.primary }, sending && { opacity: 0.6 }]}
                  onPress={send}
                  disabled={sending}
                  activeOpacity={0.85}
                >
                  {sending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Icon name="paper-plane-outline" size={20} color="#fff" />
                      <Text style={styles.sendBtnText}>Send to {partnerName}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // GlowOrb uses top/left props directly — no glow style needed
  safe: { flex: 1 },
  header: CLOSE_HEADER_STYLES.header,
  headerTitle: CLOSE_HEADER_STYLES.title,
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 8,
    gap: 16,
  },
  // Media pickers
  pickWrapper: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  pickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
  },
  pickBtnLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '600',
  },
  // Preview
  previewWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    height: SCREEN_W * 0.65,
    backgroundColor: '#1c1c1e',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  changeMedia: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  changeMediaInner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeMediaText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  // Reactions
  reactionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  reactionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  reactionIcon: {},
  // Caption
  inputCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 80,
  },
  input: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
  },
  // Send
  sendWrapper: {
    marginTop: 4,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  sendBtnText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // Sent confirmation
  sentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  sentIcon: {},
  sentTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sentBody: {
    fontFamily: SERIF_FONT,
    fontSize: 16,
    fontStyle: 'italic',
  },
});
