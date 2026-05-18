import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { colors, radius, spacing } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const COLUMN_GAP = 4;
const COLS = 2;
const TILE_W = (SCREEN_W - COLUMN_GAP * (COLS + 1)) / COLS;
const TILE_H = TILE_W * 1.5;

function DiscoverTile({ clip, onPress }) {
  const player = useVideoPlayer(clip.videoURL, (p) => {
    p.muted = true;
    p.loop = true;
  });

  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={styles.tileShade} pointerEvents="none" />
      <View style={styles.tileMeta} pointerEvents="none">
        <Text style={styles.tileCreator} numberOfLines={1}>
          @{clip.creatorName || 'anonymous'}
        </Text>
        <Text style={styles.tileLikes}>♥ {clip.likes || 0}</Text>
      </View>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const q = query(collection(db, 'clips'), orderBy('likes', 'desc'), limit(60));
      const snap = await getDocs(q);
      setClips(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn('Discover load failed', err);
      try {
        const fallback = await getDocs(
          query(collection(db, 'clips'), orderBy('createdAt', 'desc'), limit(60)),
        );
        setClips(fallback.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (_) {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return clips;
    return clips.filter((c) =>
      [c.creatorName, c.title, c.setupName]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(s)),
    );
  }, [clips, search]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const openClipCreator = (clip) => {
    if (!clip.creatorId) return;
    navigation.navigate('UserProfile', { userId: clip.creatorId });
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search creators, sets, gear"
          placeholderTextColor={colors.textDim}
          style={styles.search}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        contentContainerStyle={{
          paddingHorizontal: COLUMN_GAP,
          paddingTop: COLUMN_GAP,
          paddingBottom: insets.bottom + 80,
        }}
        columnWrapperStyle={{ gap: COLUMN_GAP }}
        ItemSeparatorComponent={() => <View style={{ height: COLUMN_GAP }} />}
        renderItem={({ item }) => (
          <DiscoverTile clip={item} onPress={() => openClipCreator(item)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
        removeClippedSubviews
        windowSize={7}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing to discover yet</Text>
            <Text style={styles.emptyBody}>Pull down to refresh.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  tileShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  tileMeta: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileCreator: { color: colors.text, fontSize: 12, fontWeight: '700', flex: 1 },
  tileLikes: { color: colors.text, fontSize: 12, fontWeight: '600', marginLeft: spacing.sm },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, marginTop: spacing.xxl },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyBody: { color: colors.textDim, marginTop: spacing.sm },
});
