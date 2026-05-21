import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { colors, spacing, radius, type, setupTypeColors } from '../theme';
import Card from '../components/Card';
import Scrubber from '../components/Scrubber';
import useSyncedAudio from '../hooks/useSyncedAudio';
import { MediaCoordinator } from '../utils/mediaCoordinator';
import { getSignedBunnyUrls } from '../utils/bunnyUrl';

function fmtDuration(s) {
  if (!s || s < 0) return '0:00';
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function SetDetailScreen({ route, navigation }) {
  const { setId, seekTo } = route.params || {};
  const insets = useSafeAreaInsets();
  const myUid = auth.currentUser?.uid;

  const [setDoc, setSetDoc] = useState(null);
  const [signed, setSigned] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState([]);
  const [moreFromCreator, setMoreFromCreator] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  const player = useVideoPlayer(signed?.videoURL || null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  // Audio track sync (if the set has an external audio recording).
  useSyncedAudio(player, signed?.audioTrackURL, setDoc?.audioOffsetSeconds || 0, isPlaying);

  // Load the set + related data.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'sets', setId));
        if (cancelled) return;
        if (!snap.exists()) {
          setSetDoc({ _missing: true });
          setLoading(false);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setSetDoc(data);
        setLikeCount(data.likes || 0);
        setLiked(!!(myUid && Array.isArray(data.likedBy) && data.likedBy.includes(myUid)));

        // Sign Bunny URLs (no-op for non-Bunny URLs).
        try {
          const urls = await getSignedBunnyUrls('set', setId);
          if (!cancelled) setSigned(urls);
        } catch (e) {
          console.warn('Failed to sign Bunny URL', e?.message);
          // Fall back to raw URL — will only work if hotlink protection is off.
          if (!cancelled) {
            setSigned({
              videoURL: data.videoURL,
              audioTrackURL: data.audioTrackURL,
            });
          }
        }

        // Clip markers for this set.
        const clipsSnap = await getDocs(
          query(collection(db, 'clips'), where('fullSetId', '==', setId)),
        );
        if (!cancelled) {
          setClips(clipsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }

        // Following status (for the follow button).
        if (myUid && data.creatorId && myUid !== data.creatorId) {
          const meSnap = await getDoc(doc(db, 'users', myUid));
          if (!cancelled) {
            setIsFollowing((meSnap.data()?.following || []).includes(data.creatorId));
          }
        }
      } catch (e) {
        console.warn('Could not load set', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setId, myUid]);

  // Lazy-load other sets from this creator after main load.
  useEffect(() => {
    if (!setDoc?.creatorId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'sets'),
            where('creatorId', '==', setDoc.creatorId),
            orderBy('createdAt', 'desc'),
            limit(7),
          ),
        );
        if (cancelled) return;
        setMoreFromCreator(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.id !== setId),
        );
      } catch (e) { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [setDoc?.creatorId, setId]);

  // Auto-play (and apply seekTo) once the signed source is ready.
  useEffect(() => {
    if (!player || !signed?.videoURL) return;
    let started = false;
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (__DEV__) console.log('[SetDetail] player status:', status, error || '');
      if (status === 'readyToPlay' && !started) {
        started = true;
        try {
          if (seekTo) player.currentTime = seekTo;
          player.play();
        } catch (e) {}
      }
    });
    return () => sub.remove();
  }, [seekTo, player, signed?.videoURL]);

  // Track current playback time + playing state.
  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      try { setCurrentTime(player.currentTime || 0); } catch (e) {}
    }, 250);
    const sub = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing);
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [player]);

  // Register with MediaCoordinator so feed/clip players pause when this opens.
  useEffect(() => {
    const id = `set:${setId}`;
    MediaCoordinator.register(id, () => {
      try { player?.pause(); } catch (e) {}
    });
    MediaCoordinator.play(id);
    return () => MediaCoordinator.unregister(id);
  }, [setId, player]);

  const onSeek = useCallback((t) => {
    try { player.currentTime = t; } catch (e) {}
  }, [player]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) player.pause(); else player.play();
  }, [player, isPlaying]);

  const toggleLike = useCallback(async () => {
    if (!myUid || !setDoc) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    try {
      await updateDoc(doc(db, 'sets', setId), {
        likedBy: wasLiked ? arrayRemove(myUid) : arrayUnion(myUid),
        likes: increment(wasLiked ? -1 : 1),
      });
    } catch (e) { /* same rules-blocked behavior as clips */ }
  }, [liked, myUid, setId, setDoc]);

  const toggleFollow = useCallback(async () => {
    if (!myUid || !setDoc?.creatorId) return;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    try {
      await updateDoc(doc(db, 'users', myUid), {
        following: wasFollowing ? arrayRemove(setDoc.creatorId) : arrayUnion(setDoc.creatorId),
      });
      await updateDoc(doc(db, 'users', setDoc.creatorId), {
        followers: wasFollowing ? arrayRemove(myUid) : arrayUnion(myUid),
      }).catch(() => {});
    } catch (e) {
      setIsFollowing(wasFollowing);
    }
  }, [myUid, setDoc, isFollowing]);

  const openCreator = () => {
    if (setDoc?.creatorId) {
      navigation.navigate('UserProfile', { userId: setDoc.creatorId });
    }
  };

  const openSetup = () => {
    if (setDoc?.setupId) {
      navigation.navigate('SetupViewer', {
        setupId: setDoc.setupId,
        setupName: setDoc.setupName,
      });
    }
  };

  const openFullscreen = () => {
    navigation.navigate('SetFullscreen', {
      setId,
      videoURL: setDoc?.videoURL,
    });
    // Pause this player so we don't double-play; SetFullscreen owns its own
    // player instance.
    try { player.pause(); } catch (e) {}
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (setDoc?._missing) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.missingTitle}>This set is no longer available</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const setupType = setDoc?.setupType || 'DJ';
  const badgeColor = setupTypeColors[setupType] || colors.accent;
  const isOwn = myUid === setDoc?.creatorId;
  const description = setDoc?.description || '';

  const clipMarkers = clips
    .filter((c) => typeof c.clipStart === 'number' && typeof c.clipEnd === 'number')
    .map((c) => ({
      id: c.id,
      start: c.clipStart,
      end: c.clipEnd,
      title: c.title || 'clip',
    }));

  return (
    <View style={styles.root}>
      {/* Player */}
      <View style={[styles.playerWrap, { paddingTop: insets.top }]}>
        <Pressable style={styles.video} onPress={togglePlayPause}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
          <View style={styles.videoTopBar} pointerEvents="box-none">
            <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={10}>
              <Text style={styles.iconBtnText}>‹</Text>
            </Pressable>
            <Pressable onPress={openFullscreen} style={styles.iconBtn} hitSlop={10}>
              <Text style={styles.iconBtnText}>⛶</Text>
            </Pressable>
          </View>
        </Pressable>

        <View style={styles.controls}>
          <Scrubber
            currentTime={currentTime}
            duration={setDoc?.durationSeconds || 0}
            clipMarkers={clipMarkers}
            onSeek={onSeek}
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{fmtDuration(currentTime)}</Text>
            <Text style={styles.timeText}>{fmtDuration(setDoc?.durationSeconds || 0)}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title row */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{setDoc?.title || 'Untitled set'}</Text>
          <View style={styles.creatorRow}>
            <Pressable onPress={openCreator} hitSlop={6} style={styles.creatorPress}>
              {setDoc?.creatorPhotoURL ? (
                <Image source={{ uri: setDoc.creatorPhotoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>
                    {(setDoc?.creatorName || '?')[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.creatorName}>{setDoc?.creatorName || 'unknown'}</Text>
            </Pressable>
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={styles.badgeText}>{setupType}</Text>
            </View>
          </View>
        </View>

        {/* Action bar */}
        <View style={styles.actionRow}>
          <Pressable style={styles.action} onPress={toggleLike} hitSlop={6}>
            <Text style={[styles.actionGlyph, liked && styles.actionGlyphActive]}>
              {liked ? '♥' : '♡'}
            </Text>
            <Text style={styles.actionLabel}>{likeCount}</Text>
          </Pressable>
          <Pressable style={styles.action} hitSlop={6}>
            <Text style={styles.actionGlyph}>↗</Text>
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>
          <Pressable style={styles.action} hitSlop={6}>
            <Text style={styles.actionGlyph}>🔖</Text>
            <Text style={styles.actionLabel}>Save</Text>
          </Pressable>
          {!isOwn && (
            <Pressable
              style={[styles.followBtn, isFollowing && styles.followBtnActive]}
              onPress={toggleFollow}
              hitSlop={6}
            >
              <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* View Setup card */}
        {setDoc?.setupId && (
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Card onPress={openSetup}>
              <View style={styles.setupCardRow}>
                <View style={styles.setupIconBubble}>
                  <Text style={styles.setupIcon}>🎛</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.setupCardTitle}>{setDoc.setupName || 'View setup'}</Text>
                  <Text style={styles.setupCardSub}>
                    {setupType}
                    {setDoc.deviceCount ? `  ·  ${setDoc.deviceCount} devices` : ''}
                  </Text>
                </View>
                <Text style={styles.setupCardChevron}>›</Text>
              </View>
            </Card>
          </View>
        )}

        {/* Description */}
        {description ? (
          <View style={styles.descBlock}>
            <Text
              style={styles.descText}
              numberOfLines={descExpanded ? undefined : 3}
            >
              {description}
            </Text>
            {description.length > 140 && (
              <Pressable onPress={() => setDescExpanded((v) => !v)} hitSlop={6}>
                <Text style={styles.descMore}>
                  {descExpanded ? 'less' : 'more'}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Clips from this set */}
        {clips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clips from this set</Text>
            <FlatList
              data={clips}
              keyExtractor={(c) => c.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.clipThumb}
                  onPress={() => onSeek(item.clipStart || 0)}
                >
                  {item.thumbnailURL ? (
                    <Image source={{ uri: item.thumbnailURL }} style={StyleSheet.absoluteFill} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.clipThumbFallback]}>
                      <Text style={styles.clipThumbGlyph}>▶</Text>
                    </View>
                  )}
                  <View style={styles.clipThumbOverlay}>
                    <Text style={styles.clipThumbTitle} numberOfLines={1}>
                      {item.title || 'Clip'}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* More from creator */}
        {moreFromCreator.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>More from {setDoc.creatorName || 'this creator'}</Text>
            <FlatList
              data={moreFromCreator}
              keyExtractor={(s) => s.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.moreThumb}
                  onPress={() => navigation.push('SetDetail', { setId: item.id })}
                >
                  {item.thumbnailURL ? (
                    <Image source={{ uri: item.thumbnailURL }} style={StyleSheet.absoluteFill} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.clipThumbFallback]} />
                  )}
                  <View style={styles.clipThumbOverlay}>
                    <Text style={styles.clipThumbTitle} numberOfLines={2}>
                      {item.title || 'Untitled'}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface0 },
  loading: {
    flex: 1,
    backgroundColor: colors.surface0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingTitle: { ...type.subtitle, color: colors.textPrimary, marginBottom: spacing.lg },
  backBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface1,
    borderRadius: radius.pill,
  },
  backBtnText: { color: colors.textPrimary, fontWeight: '600' },

  playerWrap: { backgroundColor: '#000' },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  videoTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  controls: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  timeText: { color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] },

  scroll: { flex: 1 },
  titleBlock: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { ...type.title, color: colors.textPrimary, marginBottom: spacing.sm },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creatorPress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  avatarFallback: {
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  creatorName: { ...type.caption, color: colors.textSecondary },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  badgeText: { ...type.micro, color: '#fff' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xl,
  },
  action: { alignItems: 'center', gap: 2 },
  actionGlyph: { color: colors.textPrimary, fontSize: 22 },
  actionGlyphActive: { color: colors.danger },
  actionLabel: { color: colors.textSecondary, fontSize: 11 },
  followBtn: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  followBtnActive: { backgroundColor: colors.surface2 },
  followText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  followTextActive: { color: colors.textPrimary },

  setupCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  setupIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupIcon: { fontSize: 18 },
  setupCardTitle: { ...type.subtitle, color: colors.textPrimary },
  setupCardSub: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
  setupCardChevron: { color: colors.textSecondary, fontSize: 22, fontWeight: '300' },

  descBlock: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  descText: { ...type.body, color: colors.textSecondary, lineHeight: 21 },
  descMore: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 4 },

  section: { marginTop: spacing.lg },
  sectionTitle: {
    ...type.subtitle,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  clipThumb: {
    width: 120,
    aspectRatio: 4 / 5,
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
    overflow: 'hidden',
  },
  moreThumb: {
    width: 200,
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
    overflow: 'hidden',
  },
  clipThumbFallback: {
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipThumbGlyph: { color: colors.textTertiary, fontSize: 28 },
  clipThumbOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  clipThumbTitle: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
