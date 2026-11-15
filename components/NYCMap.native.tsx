import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { NYCMapProps } from '@/components/NYCMap.types';
import { getSeverityColor } from '@/utils/surchargeRules';

const NYC_INITIAL_REGION = {
  latitude: 40.728,
  longitude: -73.98,
  latitudeDelta: 0.085,
  longitudeDelta: 0.085,
};

export function NYCMap({
  merchants,
  selectedMerchantId,
  onSelectMerchant,
  focusRegion,
}: NYCMapProps) {
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    if (focusRegion && mapRef.current) {
      mapRef.current.animateToRegion(focusRegion, 500);
    }
  }, [focusRegion]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={NYC_INITIAL_REGION}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
    >
      {merchants.map((merchant) => {
        const severity = getSeverityColor(merchant.surchargePct);
        const isSelected = merchant.id === selectedMerchantId;
        return (
          <Marker
            key={merchant.id}
            coordinate={{
              latitude: merchant.latitude,
              longitude: merchant.longitude,
            }}
            onPress={() => onSelectMerchant(merchant)}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.pin,
                { backgroundColor: severity.pin },
                isSelected && styles.pinSelected,
              ]}
            >
              <Text style={styles.pinText}>
                {merchant.surchargePct > 0
                  ? `${merchant.surchargePct.toFixed(1)}%`
                  : '0%'}
              </Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pinSelected: {
    transform: [{ scale: 1.18 }],
    borderColor: '#0F172A',
  },
  pinText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
