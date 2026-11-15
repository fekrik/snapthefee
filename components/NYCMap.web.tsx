import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { NYCMapProps } from '@/components/NYCMap.types';
import { getSeverityColor } from '@/utils/surchargeRules';

export function NYCMap({
  merchants,
  selectedMerchantId,
  onSelectMerchant,
  focusRegion,
}: NYCMapProps) {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SELECT_MERCHANT' && event.data.id) {
        const found = merchants.find((m) => m.id === event.data.id);
        if (found) onSelectMerchant(found);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [merchants, onSelectMerchant]);

  const centerLat = focusRegion?.latitude ?? 40.728;
  const centerLng = focusRegion?.longitude ?? -73.98;
  const zoom = focusRegion ? 14 : 12;

  const srcDoc = useMemo(() => {
    const pinsJson = JSON.stringify(
      merchants.map((m) => ({
        id: m.id,
        lat: m.latitude,
        lng: m.longitude,
        label: m.surchargePct > 0 ? `${m.surchargePct.toFixed(1)}%` : '0%',
        color: getSeverityColor(m.surchargePct).pin,
        selected: m.id === selectedMerchantId,
      }))
    );

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #f1f5f9; }
    .fee-pin {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      border-radius: 14px;
      color: #fff;
      font: 700 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      border: 2px solid #fff;
      box-shadow: 0 2px 6px rgba(15,23,42,0.25);
      cursor: pointer;
      white-space: nowrap;
    }
    .fee-pin.selected {
      border-color: #0f172a;
      transform: scale(1.15);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], ${zoom});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const pins = ${pinsJson};
    pins.forEach((p) => {
      const icon = L.divIcon({
        className: '',
        html: '<div class="fee-pin ' + (p.selected ? 'selected' : '') + '" style="background:' + p.color + '">' + p.label + '</div>',
        iconSize: [48, 24],
        iconAnchor: [24, 12]
      });
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
      marker.on('click', () => {
        window.parent.postMessage({ type: 'SELECT_MERCHANT', id: p.id }, '*');
      });
    });
  </script>
</body>
</html>`;
  }, [merchants, selectedMerchantId, centerLat, centerLng, zoom]);

  return (
    <View style={styles.container}>
      <iframe
        title="SnapTheFee NYC Map"
        srcDoc={srcDoc}
        style={styles.iframe as unknown as React.CSSProperties}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  iframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
});
