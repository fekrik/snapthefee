import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PrivacyScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>SnapTheFee NYC — Privacy Policy & Terms</Text>
        <Text style={styles.updated}>Effective Date: November 15, 2026</Text>

        <View style={styles.card}>
          <Text style={styles.heading}>1. Information We Collect</Text>
          <Text style={styles.body}>
            • Receipt Photos: When you choose to photograph or upload a receipt,
            the image is used solely to verify the merchant name, transaction
            date, subtotal, and credit card surcharge math. Do not include full
            credit card numbers or sensitive personal information in uploaded
            photos.{'\n'}• Location Data: With your permission, SnapTheFee uses
            your foreground location to center the NYC surcharge map on your
            neighborhood. We do not track your location in the background.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>2. How Information Is Used</Text>
          <Text style={styles.body}>
            Submitted merchant surcharge reports and public NYC 311 / Department
            of Consumer and Worker Protection (DCWP) records are displayed to
            help consumers identify credit card surcharge practices across New
            York City and to assist users in preparing NY General Business Law §
            518 complaints for NYC 311.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>3. Data Storage & Deletion</Text>
          <Text style={styles.body}>
            SnapTheFee does not sell personal data or use third-party advertising
            trackers. Reports stored on your device can be cleared at any time
            by clearing app storage or uninstalling the application.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>4. Disclaimer</Text>
          <Text style={styles.body}>
            SnapTheFee is an independent consumer transparency tool and is not
            affiliated with the City of New York or the NYC Department of
            Consumer and Worker Protection (DCWP). Information regarding NY GBL
            § 518 is provided for educational purposes and does not constitute
            legal advice.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  inner: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  updated: {
    fontSize: 13,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  body: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
});
