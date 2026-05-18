import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Tabs from './Tabs';
import UserProfileScreen from '../screens/UserProfileScreen';
import SetupViewerScreen from '../screens/SetupViewerScreen';
import SetDetailScreen from '../screens/SetDetailScreen';
import SetFullscreenScreen from '../screens/SetFullscreenScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export default function RootStack({ user, onLogout }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Tabs" options={{ headerShown: false }}>
        {() => <Tabs user={user} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="SetupViewer"
        component={SetupViewerScreen}
        options={{ title: 'Setup' }}
      />
      <Stack.Screen
        name="SetDetail"
        component={SetDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SetFullscreen"
        component={SetFullscreenScreen}
        options={{ headerShown: false, animation: 'fade', orientation: 'landscape' }}
      />
    </Stack.Navigator>
  );
}
