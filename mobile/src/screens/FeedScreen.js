import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Dimensions,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection, query, orderBy, limit, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import ClipCard from '../components/ClipCard';
import SetCard from '../components/SetCard';
import FeedModeToggle from '../components/FeedModeToggle';
import { MediaCoordinator } from '../utils/mediaCoordinator';
import { colors, spacing, type } from '../theme';

const { height: WINDOW_H } = Dimensions.get('window');
const SUB_TABS = ['For You', 'Following'];
const MODE_KEY = 'liveset.feedMode';

export default function FeedScreen({ user }) {
  const insets = useSafeAreaInsets();
  const clipHeight = WINDOW_H;

  const [mode, setMode] = useState('clips'); // 'clips' | 'sets'
  const [tab, setTab] = useState('For You');
  const [clips, setClips] = useState([]);
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingIds, setFollowingIds] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);
  const fade = useRef(new Animated.Value(1)).current;

  // Restore last-used mode.
  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((v) => {
      if (v === 'sets' || v === 'clips') setMode(v);
    });
  }, []);

  // Pause all media when this screen loses focus (tab change, push to detail).
  useFocusEffect(
    useCallback(() => {
      return () => {
        MediaCoordinator.stopAll();
      };
    }, []),
  );

  const loadFollowing = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      setFollowingIds(snap.data()?.following || []);
    } catch (err) {
      console.warn('Could not load following list', err);
    }
  }, [user]);

  const loadClips = useCallback(async () => {
    try {
      const q = query(collection(db, 'clips'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      setClips(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn('Could not load clips', err);
    }
  }, []);

  const loadSets = useCallback(async () => {
    try {
      const q = query(collection(db, 'sets'), orderBy('createdAt', 'desc'), limit(30));
      const snap = await getDocs(q);
      setSets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn('Could not load sets', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadFollowing(), loadClips(), loadSets()]).finally(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, [loadFollowing, loadClips, loadSets]);

  const rankedClips = useMemo(() => {
    if (tab === 'Following') {
      return clips.filter((c) => followingIds.includes(c.creatorId));
    }
    const followed = clips.filter((c) => followingIds.includes(c.creatorId));
    const others = clips
      .filter((c) => !followingIds.includes(c.creatorId))
      .sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return [...followed, ...others];
  }, [clips, followingIds, tab]);

  const rankedSets = useMemo(() => {
    if (tab === 'Following') {
      return sets.filter((s) => followingIds.includes(s.creatorId));
    }
    const followed = sets.filter((s) => followingIds.includes(s.creatorId));
    const others = sets
      .filter((s) => !followingIds.includes(s.creatorId))
      .sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return [...followed, ...others];
  }, [sets, followingIds, tab]);

  const maxLikes = useMemo(
    () => rankedSets.reduce((m, s) => Math.max(m, s.likes || 0), 1),
    [rankedSets],
  );

  // Reset scroll on tab/mode change.
  useEffect(() => {
    setActiveIndex(0);
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, [tab, mode]);

  // Cross-fade on mode change. Stop all media synchronously before swapping.
  const swapMode = useCallback((next) => {
    if (next === mode) return;
    MediaCoordinator.stopAll();
    Animated.timing(fade, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setMode(next);
      AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }, [mode, fade]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([loadFollowing(), loadClips(), loadSets()]).finally(() =>
      setRefreshing(false),
    );
  }, [loadFollowing, loadClips, loadSets]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 80,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActiveIndex(first.index);
  }).current;

  const getClipItemLayout = useCallback(
    (_, index) => ({ length: clipHeight, offset: clipHeight * index, index }),
    [clipHeight],
  );

  const renderClip = useCallback(
    ({ item, index }) => (
      <ClipCard clip={item} active={index === activeIndex} height={clipHeight} />
    ),
    [activeIndex, clipHeight],
  );

  const renderSet = useCallback(
    ({ item }) => <SetCard set={item} maxLikes={maxLikes} />,
    [maxLikes],
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const data = mode === 'clips' ? rankedClips : rankedSets;
  const isEmpty = data.length === 0;

  return (
    <View style={styles.container}>
      {/* Top bar: mode toggle + sub-tabs */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <FeedModeToggle mode={mode} onChange={swapMode} />
        <View style={styles.subTabs}>
          {SUB_TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={styles.subTabBtn} hitSlop={8}>
              <Text style={[styles.subTabText, tab === t && styles.subTabTextActive]}>{t}</Text>
              {tab === t && <View style={styles.subTabUnderline} />}
            </Pressable>
          ))}
        </View>
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, paddingTop: mode === 'sets' ? insets.top + 110 : 0 }]}>
        {isEmpty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {tab === 'Following'
                ? mode === 'sets'
                  ? 'No sets from people you follow'
                  : 'No clips from people you follow'
                : mode === 'sets'
                  ? 'No sets yet'
                  : 'No clips yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {tab === 'Following'
                ? 'Follow creators to see their work here.'
                : 'Be the first to post.'}
            </Text>
          </View>
        ) : mode === 'clips' ? (
          <FlatList
            key="clips-list"
            ref={listRef}
            data={rankedClips}
            keyExtractor={(item) => item.id}
            renderItem={renderClip}
            getItemLayout={getClipItemLayout}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={clipHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            overScrollMode="never"
            bounces={false}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.text}
                progressViewOffset={insets.top + 60}
              />
            }
          />
        ) : (
          <FlatList
            key="sets-list"
            ref={listRef}
            data={rankedSets}
            keyExtractor={(item) => item.id}
            renderItem={renderSet}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            // Match prop signature to the clips FlatList so RN doesn't
            // see "callback present" -> "callback absent" across renders.
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.text}
              />
            }
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface0 },
  loading: { flex: 1, backgroundColor: colors.surface0, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    gap: spacing.md,
  },
  subTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  subTabBtn: { alignItems: 'center' },
  subTabText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  subTabTextActive: { color: '#fff' },
  subTabUnderline: {
    height: 2,
    width: 20,
    backgroundColor: '#fff',
    borderRadius: 1,
    marginTop: 4,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { ...type.subtitle, color: colors.textPrimary },
  emptyBody: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
});
