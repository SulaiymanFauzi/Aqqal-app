import React from 'react';
import { Tabs } from 'expo-router';
import { Image } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarShowLabel: false,
        tabBarStyle: { display: 'none' },
        headerTitleAlign: 'center',
        headerTransparent: false,
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
          height: 100,
        },
        headerShadowVisible: false,
        headerTitle: () => (
          <Image
            source={require('../../assets/images/logo.png')}
            style={{ width: 156, height: 40, resizeMode: 'contain' }}
            accessibilityLabel="Aqqal logo"
          />
        ),
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarButton: () => null,
        }}
      />
    </Tabs>
  );
}
