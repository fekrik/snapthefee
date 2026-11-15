import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { Link, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MerchantCard } from '@/components/MerchantCard';
import { NYCMap } from '@/components/NYCMap';
import { useReports } from '@/context/ReportsContext';
import { Merchant } from '@/types/surcharge';

type FilterMode = 'all' | 'illegal' | 'needs_receipt' | 'fair';

const FILTERS: { id: FilterMode; label: string }[] = [
  { id: 'all', label: 'All NYC' },
  { id: 'illegal', label: '4%+ / Illegal' },
  { id: 'needs_receipt', label: 'Needs Receipt' },
  { id: 'fair', label: '0% Fair' },
];

export default function MapScreen() {
  const { merchants, confirmMerchant } = useReports();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [focusRegion, setFocusRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);

  const filteredMerchants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merchants.filter((m) => {
      if (filter === 'illegal' && m.surchargePct < 3.5) return false;
      if (
        filter === 'needs_receipt' &&
        m.verificationTier === 'receipt_verified'
      ) {
        return false;
      }
      if (filter === 'fair' && m.surchargePct > 0) return false;

      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.neighborhood.toLowerCase().includes(q) ||
        m.address.toLowerCase().includes(q) ||
        m.borough.toLowerCase().includes(q)
      );
    });
  }, [merchants, query, filter]);

  const activeSelected = useMemo(() => {
    if (!selected) return null;
    return merchants.find((m) => m.id === selected.id) ?? selected;
  }, [merchants, selected]);

  const handleLocateMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      setFocusRegion({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      });
    } catch {
      // Ignore location failures gracefully
    }
  };

  return (
    <View style={styles.container}>
      <NYCMap
        merchants={filteredMerchants}
        selectedMerchantId={activeSelected?.id ?? null}
        onSelectMerchant={(m) => setSelected(m)}
        focusRegion={focusRegion}
      />

      <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search NYC spots or neighborhoods..."
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color="#94A3B8" />
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={handleLocateMe}
            style={styles.iconBtn}
            accessibilityLabel="Center on my location"
          >
            <Ionicons name="locate" size={20} color="#0F172A" />
          </Pressable>

          <Link href="/modal" asChild>
            <Pressable
              style={styles.iconBtn}
              accessibilityLabel="NYC surcharge law info"
            >
              <Ionicons
                name="information-circle-outline"
                size={21}
                color="#0F172A"
              />
            </Pressable>
          </Link>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setFilter(item.id)}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text
                  style={[
                    styles.filterText,
                    active && styles.filterTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      <SafeAreaView
        edges={['bottom']}
        style={styles.bottomOverlay}
        pointerEvents="box-none"
      >
        {activeSelected ? (
          <MerchantCard
            merchant={activeSelected}
            onConfirm={confirmMerchant}
            onClose={() => setSelected(null)}
          />
        ) : (
          <View style={styles.fabContainer} pointerEvents="box-none">
            <View style={styles.countPill}>
              <Text style={styles.countText}>
                {filteredMerchants.length} NYC spots
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)')}
              style={styles.snapFab}
            >
              <Ionicons name="camera" size={18} color="#FFFFFF" />
              <Text style={styles.snapFabText}>Snap a Receipt</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterRow: {
    gap: 8,
    paddingRight: 16,
  },
  filterPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  fabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countPill: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  snapFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  snapFabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
