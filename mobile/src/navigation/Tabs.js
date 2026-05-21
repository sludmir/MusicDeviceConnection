import React from 'react';
import { Text, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import FeedScreen from '../screens/FeedScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import PostScreen from '../screens/PostScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

const icon = (glyph) => ({ color }) => (
  <Text style={{ fontSize: 22, color }}>{glyph}</Text>
);

export default function Tabs({ user, onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const isFeed = route.name === 'Feed';
        return {
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isFeed ? 'rgba(0,0,0,0.55)' : colors.surface,
            borderTopColor: isFeed ? 'transparent' : colors.border,
            borderTopWidth: isFeed ? 0 : 0.5,
            elevation: 0,
          },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textDim,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarHideOnKeyboard: Platform.OS === 'android',
        };
      }}
    >
      <Tab.Screen
        name="Feed"
        options={{ tabBarIcon: icon('▶') }}
      >
        {() => <FeedScreen user={user} />}
      </Tab.Screen>
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ tabBarIcon: icon('⌕') }}
      />
      <Tab.Screen
        name="Post"
        component={PostScreen}
        options={{ tabBarIcon: icon('+') }}
      />
      <Tab.Screen
        name="Profile"
        options={{ tabBarIcon: icon('●') }}
      >
        {(props) => <UserProfileScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
