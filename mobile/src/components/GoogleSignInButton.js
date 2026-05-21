// Isolated so Google.useAuthRequest is only ever called when client IDs exist.
import React, { useEffect } from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../firebase';
import { ensureUserDoc } from '../hooks/useAuth';
import { colors, radius, spacing } from '../theme';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignInButton({ signingIn, setSigningIn }) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.authentication?.idToken || response.params?.id_token;
    if (!idToken) return;
    const credential = GoogleAuthProvider.credential(idToken);
    signInWithCredential(auth, credential)
      .then(({ user }) => ensureUserDoc(user))
      .catch((err) => console.warn('Google sign-in failed', err))
      .finally(() => setSigningIn(false));
  }, [response, setSigningIn]);

  const onPress = async () => {
    if (!request) return;
    setSigningIn(true);
    try {
      await promptAsync();
    } catch (err) {
      console.warn('promptAsync failed', err);
      setSigningIn(false);
    }
  };

  return (
    <Pressable
      style={[styles.button, (!request || signingIn) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={!request || signingIn}
    >
      {signingIn ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={styles.buttonText}>Continue with Google</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    minWidth: 260,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
