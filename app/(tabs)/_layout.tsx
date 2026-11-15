import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Tabs } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0F172A',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        headerShown: useClientOnlyValue(false, true),
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTitleStyle: {
          fontWeight: '700',
          color: '#0F172A',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={22}
              color={typeof color === 'string' ? color : '#0F172A'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="snap"
        options={{
          title: 'Snap Fee',
          headerTitle: 'Snap a Receipt',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'camera' : 'camera-outline'}
              size={24}
              color={typeof color === 'string' ? color : '#0F172A'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          title: 'Directory',
          headerTitle: 'NYC Directory',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'list' : 'list-outline'}
              size={22}
              color={typeof color === 'string' ? color : '#0F172A'}
            />
          ),
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable style={{ marginRight: 16 }}>
                <Ionicons
                  name="information-circle-outline"
                  size={23}
                  color="#0F172A"
                />
              </Pressable>
            </Link>
          ),
        }}
      />
    </Tabs>
  );
}
