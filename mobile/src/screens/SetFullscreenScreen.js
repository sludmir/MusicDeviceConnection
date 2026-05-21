import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Animated,
  PanResponder,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { colors, spacing } from '../theme';
import Scrubber from '../components/Scrubber';

function fmtDuration(s) {
  if (!s || s < 0) return '0:00';
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function SetFullscreenScreen({ route, navigation }) {
  const { setId, videoURL } = route.params || {};
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [clipMarkers, setClipMarkers] = useState([]);
  const fade = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef(null);

  const player = useVideoPlayer(videoURL, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  // Lock landscape on mount, restore on unmount.
  useEffect(() => {
    let lockApplied = true;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {
      lockApplied = false;
    });
    StatusBar.setHidden(true, 'fade');
    return () => {
      if (lockApplied) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  // Load clip markers.
  useEffect(() => {
    if (!setId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'clips'), where('fullSetId', '==', setId)),
        );
        if (cancelled) return;
        setClipMarkers(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((c) => typeof c.clipStart === 'number' && typeof c.clipEnd === 'number')
            .map((c) => ({ id: c.id, start: c.clipStart, end: c.clipEnd, title: c.title || 'clip' })),
        );
      } catch (e) { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [setId]);

  // Track time + status.
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        setCurrentTime(player.currentTime || 0);
        if (player.duration && player.duration !== duration) setDuration(player.duration);
      } catch (e) {}
    }, 250);
    const sub = player.addListener('playingChange', ({ isPlaying: p }) => setIsPlaying(p));
    return () => { clearInterval(interval); sub.remove(); };
  }, [player, duration]);

  const showAndScheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => {
        setShowControls(false);
      });
    }, 3500);
  };

  useEffect(() => {
    showAndScheduleHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const onTapVideo = () => {
    if (showControls) {
      // hide immediately
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setShowControls(false);
      });
    } else {
      showAndScheduleHide();
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) player.pause(); else player.play();
    showAndScheduleHide();
  };

  const onSeek = (t) => {
    try { player.currentTime = t; } catch (e) {}
    showAndScheduleHide();
  };

  // Swipe-down to exit.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 20 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) navigation.goBack();
      },
    }),
  ).current;

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onTapVideo}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
        />
      </Pressable>

      {showControls && (
        <Animated.View style={[styles.controlsLayer, { opacity: fade }]} pointerEvents="box-none">
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={10}>
              <Text style={styles.iconBtnText}>✕</Text>
            </Pressable>
          </View>

          <Pressable style={styles.centerPlay} onPress={togglePlayPause}>
            <Text style={styles.centerPlayGlyph}>{isPlaying ? '❚❚' : '▶'}</Text>
          </Pressable>

          <View style={styles.bottomBar}>
            <Scrubber
              currentTime={currentTime}
              duration={duration}
              clipMarkers={clipMarkers}
              onSeek={onSeek}
            />
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{fmtDuration(currentTime)}</Text>
              <Text style={styles.timeText}>{fmtDuration(duration)}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  controlsLayer: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  centerPlay: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -32,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPlayGlyph: { color: '#fff', fontSize: 24 },
  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { color: '#fff', fontSize: 11, fontVariant: ['tabular-nums'] },
});
