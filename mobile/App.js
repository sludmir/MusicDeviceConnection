import React from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from './src/hooks/useAuth';
import AuthScreen from './src/screens/AuthScreen';
import RootStack from './src/navigation/RootStack';
import { colors } from './src/theme';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    border: colors.border,
    text: colors.text,
    primary: colors.accent,
  },
};

export default function App() {
  const { user, initializing, signingIn, setSigningIn, signInAsGuest, logout } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        {user ? (
          <NavigationContainer theme={navTheme}>
            <RootStack user={user} onLogout={logout} />
          </NavigationContainer>
        ) : (
          <AuthScreen
            signingIn={signingIn}
            setSigningIn={setSigningIn}
            onGuestSignIn={signInAsGuest}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
