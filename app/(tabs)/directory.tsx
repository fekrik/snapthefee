import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MerchantCard } from '@/components/MerchantCard';
import { useReports } from '@/context/ReportsContext';
import { Borough } from '@/types/surcharge';

const BOROUGH_FILTERS: ('All' | Borough)[] = [
  'All',
  'Manhattan',
  'Brooklyn',
  'Queens',
  'Bronx',
  'Staten Island',
];

export default function DirectoryScreen() {
  const { merchants, confirmMerchant } = useReports();
  const [search, setSearch] = useState('');
  const [borough, setBorough] = useState<'All' | Borough>('All');
  const [sortBy, setSortBy] = useState<'highest' | 'fair'>('highest');

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return merchants
      .filter((m) => {
        if (borough !== 'All' && m.borough !== borough) return false;
        if (sortBy === 'fair' && m.surchargePct > 0) return false;
        if (sortBy === 'highest' && m.surchargePct === 0) return false;
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          m.neighborhood.toLowerCase().includes(q) ||
          m.address.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        sortBy === 'highest'
          ? b.surchargePct - a.surchargePct
          : b.confirmationsCount - a.confirmationsCount
      );
  }, [merchants, search, borough, sortBy]);

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search businesses or neighborhoods..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        <View style={styles.segmentWrap}>
          <Pressable
            onPress={() => setSortBy('highest')}
            style={[
              styles.segmentBtn,
              sortBy === 'highest' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                sortBy === 'highest' && styles.segmentTextActive,
              ]}
            >
              Surcharge Offenders
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSortBy('fair')}
            style={[
              styles.segmentBtn,
              sortBy === 'fair' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                sortBy === 'fair' && styles.segmentTextActive,
              ]}
            >
              0% Fair Spots
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.boroughRow}
        >
          {BOROUGH_FILTERS.map((b) => (
            <Pressable
              key={b}
              onPress={() => setBorough(b)}
              style={[styles.chip, borough === b && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, borough === b && styles.chipTextActive]}
              >
                {b}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MerchantCard merchant={item} onConfirm={confirmMerchant} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No matching NYC spots yet</Text>
            <Text style={styles.emptySub}>
              Snap a receipt on the Snap Fee tab to be the first to report one.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  controls: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#0F172A',
  },
  boroughRow: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  chipActive: {
    backgroundColor: '#0F172A',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  list: {
    padding: 16,
    gap: 12,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
});
