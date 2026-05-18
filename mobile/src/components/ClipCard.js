import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { colors, spacing, type } from '../theme';
import { MediaCoordinator } from '../utils/mediaCoordinator';
import useSyncedAudio from '../hooks/useSyncedAudio';
import { getSignedBunnyUrls } from '../utils/bunnyUrl';

const TAB_BAR_SPACE = 64;

export default function ClipCard({ clip, active, height }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const myUid = auth.currentUser?.uid;

  // Local state for optimistic like toggle. Note: Firestore rules currently
  // restrict clip updates to the creator, so the write below fails silently
  // for non-creators — local state still updates for the session.
  const initialLiked = !!(myUid && Array.isArray(clip.likedBy) && clip.likedBy.includes(myUid));
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(clip.likes || 0);
  const [buffering, setBuffering] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const fadeTimer = useRef(null);

  // Sign Bunny URLs (no-op for non-Bunny URLs). Lazily fetched per clip.
  const [signed, setSigned] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getSignedBunnyUrls('clip', clip.id)
      .then((urls) => { if (!cancelled) setSigned(urls); })
      .catch(() => {
        if (!cancelled) setSigned({ videoURL: clip.videoURL, audioTrackURL: clip.audioTrackURL });
      });
    return () => { cancelled = true; };
  }, [clip.id, clip.videoURL, clip.audioTrackURL]);

  const player = useVideoPlayer(signed?.videoURL || null, (p) => {
    p.loop = true;
    p.muted = false;
  });
  const lastActive = useRef(false);

  // External audio track (board recording) sync — when present, the video
  // is muted automatically and audio is driven by the hook.
  useSyncedAudio(player, signed?.audioTrackURL, clip.audioOffsetSeconds || 0, active && !userPaused);

  // Register with MediaCoordinator so feed mode swaps and tab changes can
  // pause us synchronously.
  useEffect(() => {
    const id = `clip:${clip.id}`;
    MediaCoordinator.register(id, () => {
      try { player.pause(); } catch (e) {}
    });
    return () => MediaCoordinator.unregister(id);
  }, [clip.id, player]);

  useEffect(() => {
    if (active && !lastActive.current) {
      setUserPaused(false);
      MediaCoordinator.play(`clip:${clip.id}`);
      player.play();
    } else if (!active && lastActive.current) {
      player.pause();
    }
    lastActive.current = active;
  }, [active, player, clip.id]);

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      setBuffering(status === 'loading');
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  const flashIndicator = useCallback(
    (hold) => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      Animated.timing(indicatorOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }).start();
      if (!hold) {
        fadeTimer.current = setTimeout(() => {
          Animated.timing(indicatorOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }).start();
        }, 400);
      }
    },
    [indicatorOpacity],
  );

  const togglePlayPause = useCallback(() => {
    if (userPaused) {
      player.play();
      setUserPaused(false);
      flashIndicator(false);
    } else {
      player.pause();
      setUserPaused(true);
      flashIndicator(true);
    }
  }, [player, userPaused, flashIndicator]);

  const toggleLike = useCallback(async () => {
    if (!myUid) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    try {
      await updateDoc(doc(db, 'clips', clip.id), {
        likedBy: wasLiked ? arrayRemove(myUid) : arrayUnion(myUid),
        likes: increment(wasLiked ? -1 : 1),
      });
    } catch (err) {
      if (__DEV__) console.log('like write blocked (expected):', err?.code || err?.message);
    }
  }, [clip.id, liked, myUid]);

  const openCreator = () => {
    if (!clip.creatorId) return;
    navigation.navigate('UserProfile', { userId: clip.creatorId });
  };

  const openSetup = () => {
    if (!clip.setupId) return;
    navigation.navigate('SetupViewer', {
      setupId: clip.setupId,
      setupName: clip.setupName,
    });
  };

  const openFullSet = () => {
    if (!clip.fullSetId) return;
    MediaCoordinator.stopAll();
    navigation.navigate('SetDetail', {
      setId: clip.fullSetId,
      seekTo: clip.clipStart,
    });
  };

  return (
    <View style={[styles.card, { height }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={togglePlayPause}
        android_disableSound
      />

      {buffering && !userPaused && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      )}

      <Animated.View
        style={[styles.indicator, { opacity: indicatorOpacity }]}
        pointerEvents="none"
      >
        <Text style={styles.indicatorGlyph}>{userPaused ? '▶' : '❚❚'}</Text>
      </Animated.View>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + TAB_BAR_SPACE + spacing.md }]}>
          <Pressable onPress={openCreator} hitSlop={8}>
            <Text style={styles.creator}>@{clip.creatorName || 'anonymous'}</Text>
          </Pressable>
          {clip.title ? <Text style={styles.title}>{clip.title}</Text> : null}
          {clip.setupName ? (
            <Pressable
              style={[styles.setupChip, !clip.setupId && styles.setupChipDisabled]}
              onPress={openSetup}
              disabled={!clip.setupId}
              hitSlop={8}
            >
              <Text style={styles.setupChipText}>🎛  {clip.setupName}</Text>
              {clip.setupId ? <Text style={styles.setupChipArrow}> ›</Text> : null}
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.actions, { paddingBottom: insets.bottom + TAB_BAR_SPACE + spacing.md }]}>
          <Pressable style={styles.actionBtn} onPress={toggleLike} hitSlop={8}>
            <Text style={[styles.actionIcon, liked && styles.actionIconActive]}>
              {liked ? '♥' : '♡'}
            </Text>
            <Text style={styles.actionLabel}>{likeCount}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} hitSlop={8}>
            <Text style={styles.actionIcon}>↗</Text>
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>
          {clip.fullSetId ? (
            <Pressable style={styles.actionBtn} onPress={openFullSet} hitSlop={8}>
              <View style={styles.fullSetGlyph}>
                <Text style={styles.fullSetGlyphText}>▶</Text>
              </View>
              <Text style={styles.actionLabel}>Full Set</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorGlyph: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 68,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    flexDirection: 'row',
  },
  bottomBar: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  creator: { ...type.subtitle, color: colors.textPrimary, fontSize: 16 },
  title: { color: colors.textPrimary, fontSize: 14, opacity: 0.9 },
  setupChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  setupChipDisabled: { opacity: 0.6 },
  setupChipText: { color: colors.textPrimary, fontSize: 13 },
  setupChipArrow: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  actions: {
    padding: spacing.lg,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xl,
  },
  actionBtn: { alignItems: 'center' },
  actionIcon: { color: colors.textPrimary, fontSize: 34 },
  actionIconActive: { color: colors.danger },
  actionLabel: { color: colors.textPrimary, fontSize: 11, marginTop: 2, fontWeight: '600' },
  fullSetGlyph: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  fullSetGlyphText: { color: '#fff', fontSize: 14, marginLeft: 2 },
});
