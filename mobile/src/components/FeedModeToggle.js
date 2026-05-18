import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { colors, radius, spacing } from '../theme';

const MODES = [
  { id: 'clips', label: 'Clips' },
  { id: 'sets', label: 'Sets' },
];

/**
 * Pill toggle for the Feed screen — switches between Clips and Sets modes.
 * The highlight pill animates between positions for a "physical" toggle feel.
 */
export default function FeedModeToggle({ mode, onChange }) {
  const indicator = useRef(new Animated.Value(mode === 'sets' ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(indicator, {
      toValue: mode === 'sets' ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [mode, indicator]);

  const left = indicator.interpolate({
    inputRange: [0, 1],
    outputRange: ['2%', '50%'],
  });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.indicator, { left }]} pointerEvents="none" />
      {MODES.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => onChange(m.id)}
          style={styles.btn}
          hitSlop={8}
          android_disableSound
        >
          <Text style={[styles.label, mode === m.id && styles.labelActive]}>
            {m.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 3,
    width: 200,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '48%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: '700',
  },
  labelActive: {
    color: '#fff',
  },
});
