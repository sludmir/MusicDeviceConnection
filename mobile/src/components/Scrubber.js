import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder } from 'react-native';
import { colors, radius } from '../theme';

const TRACK_HEIGHT = 4;
const MARKER_HEIGHT = 6;
const HANDLE_SIZE = 14;

/**
 * Scrubber — custom video timeline with optional clip markers.
 *
 * Props:
 *   currentTime, duration   — drive the playhead
 *   clipMarkers             — [{ id, start, end, title }] in seconds
 *   onSeek(seconds)         — called on scrub-end
 *   onMarkerTap(marker)     — called when a marker is tapped (snaps to start)
 */
export default function Scrubber({
  currentTime = 0,
  duration = 0,
  clipMarkers = [],
  onSeek,
  onMarkerTap,
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [scrubbingTime, setScrubbingTime] = useState(null);
  const scrubbing = useRef(false);
  const chipFade = useRef(new Animated.Value(0)).current;
  const [chipText, setChipText] = useState('');
  const chipTimer = useRef(null);

  const displayTime = scrubbingTime != null ? scrubbingTime : currentTime;
  const progress = duration > 0 ? Math.max(0, Math.min(1, displayTime / duration)) : 0;

  const showChip = (text) => {
    setChipText(text);
    Animated.timing(chipFade, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    if (chipTimer.current) clearTimeout(chipTimer.current);
    chipTimer.current = setTimeout(() => {
      Animated.timing(chipFade, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 1800);
  };

  useEffect(() => () => {
    if (chipTimer.current) clearTimeout(chipTimer.current);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        scrubbing.current = true;
        const x = e.nativeEvent.locationX;
        const t = trackWidth > 0 ? (x / trackWidth) * duration : 0;
        setScrubbingTime(Math.max(0, Math.min(duration, t)));
      },
      onPanResponderMove: (e) => {
        if (trackWidth <= 0) return;
        const lx = Math.max(0, Math.min(trackWidth, e.nativeEvent.locationX));
        const t = (lx / trackWidth) * duration;
        setScrubbingTime(Math.max(0, Math.min(duration, t)));
      },
      onPanResponderRelease: () => {
        if (scrubbingTime != null && onSeek) onSeek(scrubbingTime);
        scrubbing.current = false;
        setScrubbingTime(null);
      },
      onPanResponderTerminate: () => {
        scrubbing.current = false;
        setScrubbingTime(null);
      },
    }),
  ).current;

  const handleMarkerPress = (m) => {
    if (onMarkerTap) onMarkerTap(m);
    else if (onSeek) onSeek(m.start);
    showChip(`From clip: ${m.title || 'untitled'}`);
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.chip, { opacity: chipFade, transform: [{ translateY: chipFade.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}
        pointerEvents="none"
      >
        <Text style={styles.chipText}>{chipText}</Text>
      </Animated.View>

      <View
        style={styles.touchArea}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={styles.track} />

        {duration > 0 && clipMarkers.map((m) => {
          const left = (m.start / duration) * 100;
          const width = Math.max(0.5, ((m.end - m.start) / duration) * 100);
          return (
            <View
              key={m.id}
              style={[
                styles.marker,
                { left: `${left}%`, width: `${width}%` },
              ]}
              onStartShouldSetResponder={() => true}
              onResponderRelease={() => handleMarkerPress(m)}
            />
          );
        })}

        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        <View style={[styles.handle, { left: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 12,
    justifyContent: 'center',
  },
  touchArea: {
    height: 24,
    justifyContent: 'center',
    width: '100%',
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: TRACK_HEIGHT / 2,
    width: '100%',
  },
  marker: {
    position: 'absolute',
    height: MARKER_HEIGHT,
    backgroundColor: colors.accentSoft,
    borderRadius: MARKER_HEIGHT / 2,
    top: (24 - MARKER_HEIGHT) / 2,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: TRACK_HEIGHT,
    backgroundColor: colors.accent,
    borderRadius: TRACK_HEIGHT / 2,
    top: (24 - TRACK_HEIGHT) / 2,
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: '#fff',
    marginLeft: -HANDLE_SIZE / 2,
    top: (24 - HANDLE_SIZE) / 2,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  chip: {
    position: 'absolute',
    bottom: '100%',
    alignSelf: 'center',
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: 6,
  },
  chipText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
});
