import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { colors, radius, spacing } from '../theme';

export default function UserProfileScreen({ route, navigation, onLogout }) {
  // When rendered from a stack push, userId is in route params. When rendered as
  // the Profile tab's root (own profile), there's no route param — fall back to auth uid.
  const myUid = auth.currentUser?.uid;
  const userId = route?.params?.userId || myUid;
  const isOwn = userId === myUid;

  const [profile, setProfile] = useState(null);
  const [sets, setSets] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [profileSnap, setsSnap, followersSnap, mySnap] = await Promise.all([
        getDoc(doc(db, 'users', userId)),
        getDocs(
          query(
            collection(db, 'sets'),
            where('creatorId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(24)
          )
        ),
        getDocs(collection(db, 'users', userId, 'followers')),
        myUid ? getDoc(doc(db, 'users', myUid)) : Promise.resolve(null),
      ]);
      setProfile(profileSnap.data());
      setSets(setsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFollowerCount(followersSnap.size);
      const myFollowing = mySnap?.data()?.following || [];
      setIsFollowing(myFollowing.includes(userId));
    } catch (err) {
      console.warn('profile load failed', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, myUid]);

  useEffect(() => {
    load();
  }, [load]);

  // Sync title on pushed views.
  useEffect(() => {
    if (!navigation || !profile || isOwn) return;
    navigation.setOptions({ title: profile.displayName || 'Profile' });
  }, [navigation, profile, isOwn]);

  const toggleFollow = async () => {
    if (!myUid || isOwn || busy) return;
    setBusy(true);
    const wasFollowing = isFollowing;
    // Optimistic
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => c + (wasFollowing ? -1 : 1));
    try {
      const myRef = doc(db, 'users', myUid);
      const targetFollowerRef = doc(db, 'users', userId, 'followers', myUid);
      if (wasFollowing) {
        await updateDoc(myRef, { following: arrayRemove(userId) });
        await deleteDoc(targetFollowerRef);
      } else {
        await updateDoc(myRef, { following: arrayUnion(userId) });
        await setDoc(targetFollowerRef, { createdAt: serverTimestamp() });
        // Best-effort notification
        try {
          const mySnap = await getDoc(myRef);
          await addDoc(collection(db, 'users', userId, 'notifications'), {
            type: 'follow',
            fromUserId: myUid,
            fromUserName: mySnap.data()?.displayName || 'Someone',
            createdAt: serverTimestamp(),
            read: false,
          });
        } catch (_) {
          /* non-fatal */
        }
      }
    } catch (err) {
      console.warn('follow toggle failed', err);
      // Revert optimistic
      setIsFollowing(wasFollowing);
      setFollowerCount((c) => c + (wasFollowing ? 1 : -1));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const displayName =
    profile?.displayName ||
    (isOwn ? auth.currentUser?.displayName || 'You' : 'Unknown user');
  const featuredSet = sets[0] || null;
  const moreSets = sets.slice(1);
  const joinedDate = profile?.createdAt?.toDate
    ? profile.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.text}
        />
      }
    >
      <View style={[styles.ribbonCard, styles.header]}>
        {profile?.photoURL ? (
          <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>
              {displayName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{displayName}</Text>
        {profile?.email ? <Text style={styles.email}>{profile.email}</Text> : null}

        <View style={styles.stats}>
          <Stat label="Followers" value={followerCount} />
          <Stat label="Following" value={(profile?.following || []).length} />
          <Stat label="Sets" value={sets.length} />
        </View>

        {!isOwn && (
          <Pressable
            onPress={toggleFollow}
            disabled={busy}
            style={[
              styles.followBtn,
              isFollowing ? styles.followBtnActive : styles.followBtnIdle,
              busy && styles.buttonDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text
                style={[
                  styles.followBtnText,
                  isFollowing && styles.followBtnTextActive,
                ]}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      <View style={[styles.ribbonCard, styles.setsSection]}>
        <View style={styles.ribbonBar} />
        <Text style={styles.sectionTitle}>Recent live sets</Text>
        {sets.length === 0 ? (
          <Text style={styles.emptyNote}>
            {isOwn
              ? 'No sets yet — post one from the Post tab.'
              : 'No sets posted yet.'}
          </Text>
        ) : (
          <>
            {featuredSet && (
              <View style={styles.featuredSetTile}>
                <Text style={styles.featuredLabel}>Latest upload</Text>
                <Text style={styles.featuredSetTitle} numberOfLines={2}>
                  {featuredSet.title || 'Untitled set'}
                </Text>
                <View style={styles.featuredMetaRow}>
                  {featuredSet.durationSeconds ? (
                    <Text style={styles.setMeta}>
                      {Math.round(featuredSet.durationSeconds / 60)} min
                    </Text>
                  ) : null}
                  {featuredSet.createdAt?.toDate ? (
                    <Text style={styles.setMeta}>
                      {featuredSet.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}
            {moreSets.length > 0 ? (
              <View style={styles.grid}>
                {moreSets.map((s) => (
                  <View key={s.id} style={styles.setTile}>
                    <Text style={styles.setTitle} numberOfLines={2}>
                      {s.title || 'Untitled set'}
                    </Text>
                    {s.durationSeconds ? (
                      <Text style={styles.setMeta}>
                        {Math.round(s.durationSeconds / 60)} min
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.ribbonCard}>
        <View style={styles.ribbonBar} />
        <Text style={styles.sectionTitle}>Fav product</Text>
        <Text style={styles.emptyNote}>
          {profile?.faveProductName || 'No fav product set'}
        </Text>
      </View>

      <View style={styles.ribbonCard}>
        <View style={styles.ribbonBar} />
        <Text style={styles.sectionTitle}>Profile info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member since</Text>
          <Text style={styles.infoValue}>{joinedDate || 'Unknown'}</Text>
        </View>
      </View>

      {isOwn && onLogout && (
        <Pressable onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.xl, paddingTop: spacing.xxl * 1.4, gap: spacing.lg },
  ribbonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  ribbonBar: {
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
    backgroundColor: colors.accent,
    opacity: 0.95,
  },
  header: { alignItems: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.text, fontSize: 32, fontWeight: '700' },
  name: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: spacing.md },
  email: { color: colors.textDim, fontSize: 13, marginTop: spacing.xs },
  stats: { flexDirection: 'row', gap: spacing.xxl, marginTop: spacing.lg },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  followBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    minWidth: 160,
    alignItems: 'center',
  },
  followBtnIdle: { backgroundColor: colors.accent },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  followBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  followBtnTextActive: { color: colors.textDim },
  buttonDisabled: { opacity: 0.6 },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md * 0.9,
  },
  emptyNote: { color: colors.textDim, fontSize: 13 },
  setsSection: { paddingBottom: spacing.xl },
  featuredSetTile: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  featuredLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  featuredSetTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  featuredMetaRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  setTile: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  setTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  setMeta: { color: colors.textDim, fontSize: 12, marginTop: spacing.xs },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoLabel: { color: colors.textDim, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  logoutBtn: {
    marginTop: spacing.sm,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
});
