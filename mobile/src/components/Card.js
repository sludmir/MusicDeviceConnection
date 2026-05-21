import React, { useRef } from 'react';
import { Pressable, View, Animated, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

/**
 * Card — the standard surface for the app.
 *
 * surface.1 background, hairline border, 12px radius. When `onPress` is
 * provided the card is interactive: scale to 0.98 with an accent-soft glow
 * on press. Pass `padded={false}` to render an edge-to-edge card (e.g. a
 * card whose top is a thumbnail).
 */
export default function Card({
  children,
  onPress,
  onLongPress,
  style,
  padded = true,
  borderless = false,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  // All press animations stay on the JS driver. Mixing native + JS on the
  // same parallel can cause RN to promote a shared Animated.Value to native
  // and then crash when a JS-driven animation tries to mutate it.
  const animateIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.98, useNativeDriver: false, speed: 30, bounciness: 0 }),
      Animated.timing(glow, { toValue: 1, duration: 160, useNativeDriver: false }),
    ]).start();
  };
  const animateOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 30, bounciness: 0 }),
      Animated.timing(glow, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start();
  };

  const baseStyle = [
    styles.card,
    !borderless && styles.bordered,
    padded && styles.padded,
    style,
  ];

  if (!onPress) {
    return <View style={baseStyle}>{children}</View>;
  }

  const bgColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surface1, colors.surface2],
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={animateIn}
      onPressOut={animateOut}
      android_disableSound
    >
      <Animated.View
        style={[
          baseStyle,
          { transform: [{ scale }], backgroundColor: bgColor },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.glow,
            { opacity: glow },
          ]}
        />
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  padded: {
    padding: spacing.lg,
  },
  glow: {
    backgroundColor: colors.accentGlow,
    borderRadius: radius.md,
  },
});
