/**
 * OfflineBanner — renders a sticky amber bar when the device is offline.
 * Import and place near the top of any screen that reads cached data.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export function OfflineBanner() {
  return (
    <View style={styles.banner}>
      <Feather name="wifi-off" size={14} color="#92400E" />
      <Text style={styles.text}>Offline — menampilkan data tersimpan</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  text: {
    fontSize: 12,
    color: '#92400E',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});
