import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../../src/theme';
import { DossierLoading } from '../../../src/components/common/DossierLoading';

/**
 * Deprecated Certificate screen.
 * Automatically forwards to the unified Circular Impact Dossier.
 */
export default function DeprecatedImpactReportScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/impact');
  }, [router]);

  return (
    <View style={styles.container}>
      <DossierLoading variant="impact" compact />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
