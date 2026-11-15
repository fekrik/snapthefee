import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable } from 'react-native';

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
          ...Platform.select({
            web: {
              height: 62,
              paddingBottom: 8,
              paddingTop: 6,
            },
            default: {
              paddingTop: 6,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: useClientOnlyValue(false, true),
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 17,
          color: '#0F172A',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Snap',
          headerTitle: 'SnapTheFee NYC',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'camera' : 'camera-outline'}
              size={24}
              color={typeof color === 'string' ? color : '#0F172A'}
            />
          ),
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable
                style={{ marginRight: 16 }}
                hitSlop={10}
                accessibilityLabel="NYC Card Fee Laws & Privacy"
              >
                <Ionicons
                  name="information-circle-outline"
                  size={24}
                  color="#0F172A"
                />
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'NYC Map',
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
        }}
      />
    </Tabs>
  );
}
