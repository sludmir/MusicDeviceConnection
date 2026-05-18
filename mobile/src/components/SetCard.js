import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Card from './Card';
import { colors, radius, spacing, type, setupTypeColors } from '../theme';

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRelative(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toLocaleDateString();
}

/**
 * SetCard — vertical-list browse card for full LiveSets.
 *
 * Tap card → SetDetail. Tap creator row → UserProfile (event propagation
 * stopped via separate Pressable).
 */
export default function SetCard({ set, maxLikes = 1 }) {
  const navigation = useNavigation();

  const open = () => {
    navigation.navigate('SetDetail', { setId: set.id });
  };
  const openCreator = () => {
    if (set.creatorId) {
      navigation.navigate('UserProfile', { userId: set.creatorId });
    }
  };

  const setupType = set.setupType || 'DJ';
  const badgeColor = setupTypeColors[setupType] || colors.accent;
  const likes = set.likes || 0;
  // Hotness is normalized to the page's max so the bar reads relative to
  // what's visible. Clamps to [0.05, 1] so even unloved sets get a sliver.
  const hotness = Math.max(0.05, Math.min(1, maxLikes > 0 ? likes / maxLikes : 0.05));

  return (
    <View style={styles.outer}>
      <Card onPress={open} padded={false}>
        <View style={styles.thumbWrap}>
          {set.thumbnailURL ? (
            <Image source={{ uri: set.thumbnailURL }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: badgeColor + '22' }]}>
              <Text style={styles.thumbPlaceholderGlyph}>♪</Text>
            </View>
          )}

          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>{setupType}</Text>
          </View>

          {set.durationSeconds ? (
            <View style={styles.durationPill}>
              <Text style={styles.durationText}>{formatDuration(set.durationSeconds)}</Text>
            </View>
          ) : null}
        </View>

        {/* Hotness bar */}
        <View style={styles.hotnessTrack}>
          <View style={[styles.hotnessFill, { width: `${hotness * 100}%` }]} />
        </View>

        <View style={styles.metaRow}>
          <Pressable onPress={openCreator} hitSlop={8} style={styles.avatarWrap}>
            {set.creatorPhotoURL ? (
              <Image source={{ uri: set.creatorPhotoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>
                  {(set.creatorName || '?')[0]?.toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>

          <View style={styles.metaText}>
            <Text style={styles.title} numberOfLines={1}>
              {set.title || 'Untitled set'}
            </Text>
            <Text style={styles.subMeta} numberOfLines={1}>
              <Text onPress={openCreator}>{set.creatorName || 'unknown'}</Text>
              {'  ·  '}
              {formatRelative(set.createdAt)}
              {'  ·  '}
              {likes} {likes === 1 ? 'like' : 'likes'}
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: spacing.lg,
    marginBottom: 20,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface2,
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderGlyph: { color: colors.textTertiary, fontSize: 48 },
  badge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  badgeText: { ...type.micro, color: '#fff' },
  durationPill: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  durationText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  hotnessTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    width: '100%',
  },
  hotnessFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  avatarWrap: {},
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: {
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  metaText: { flex: 1 },
  title: { ...type.subtitle, color: colors.textPrimary },
  subMeta: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
});
