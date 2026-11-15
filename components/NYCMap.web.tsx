import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NYCMapProps } from '@/components/NYCMap.types';
import { getSeverityColor } from '@/utils/surchargeRules';

export function NYCMap({
  merchants,
  selectedMerchantId,
  onSelectMerchant,
}: NYCMapProps) {
  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>NYC Surcharge Map (Web Preview)</Text>
        <Text style={styles.bannerSub}>
          Native Apple Maps & Google Maps render on iOS/Android. Tap any pin
          below to inspect.
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {merchants.map((merchant) => {
          const severity = getSeverityColor(merchant.surchargePct);
          const isSelected = merchant.id === selectedMerchantId;
          return (
            <Pressable
              key={merchant.id}
              onPress={() => onSelectMerchant(merchant)}
              style={[styles.pinCard, isSelected && styles.pinCardSelected]}
            >
              <View style={[styles.dot, { backgroundColor: severity.pin }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{merchant.name}</Text>
                <Text style={styles.addr}>
                  {merchant.neighborhood} • {merchant.borough}
                </Text>
              </View>
              <Text style={[styles.pct, { color: severity.text }]}>
                {merchant.surchargePct > 0
                  ? `${merchant.surchargePct.toFixed(1)}%`
                  : '0%'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingTop: 120,
    paddingHorizontal: 16,
  },
  banner: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  bannerSub: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  grid: {
    gap: 8,
    paddingBottom: 240,
  },
  pinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pinCardSelected: {
    borderColor: '#0F172A',
    borderWidth: 2,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  addr: {
    fontSize: 12,
    color: '#64748B',
  },
  pct: {
    fontSize: 15,
    fontWeight: '800',
  },
});
