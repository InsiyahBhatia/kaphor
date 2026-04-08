import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../../src/theme';

export default function ImpactReportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>DETAILED IMPACT REPORT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.textPrimary,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 24,
  },
});
