import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { googleConfigured } from '../hooks/useAuth';
import { colors, radius, spacing } from '../theme';

export default function AuthScreen({ signingIn, setSigningIn, onGuestSignIn }) {
  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Text style={styles.logo}>LiveSet</Text>
        <Text style={styles.tag}>Share your sets. Discover new artists.</Text>
      </View>

      {googleConfigured ? (
        <GoogleSignInButton signingIn={signingIn} setSigningIn={setSigningIn} />
      ) : (
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>Google Sign-In not configured yet</Text>
          <Text style={styles.pendingBody}>
            Add iOS/Android/Web client IDs to{' '}
            <Text style={styles.mono}>/mobile/.env</Text> when you're ready to wire real auth.
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.guestButton, signingIn && styles.buttonDisabled]}
        onPress={onGuestSignIn}
        disabled={signingIn}
      >
        {signingIn ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.guestText}>Continue as guest (dev)</Text>
        )}
      </Pressable>

      <Text style={styles.fineprint}>
        Guest mode uses Firebase anonymous auth — enable it in Firebase Console →{' '}
        Authentication → Sign-in method.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brand: { alignItems: 'center', marginBottom: spacing.xxl * 2 },
  logo: { color: colors.text, fontSize: 48, fontWeight: '800', letterSpacing: -1 },
  tag: { color: colors.textDim, marginTop: spacing.sm, fontSize: 15 },
  pending: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  pendingTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.xs, textAlign: 'center' },
  pendingBody: { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  mono: { fontFamily: 'Courier', color: colors.accent },
  guestButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 260,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  guestText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  fineprint: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.xl,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 16,
  },
});
