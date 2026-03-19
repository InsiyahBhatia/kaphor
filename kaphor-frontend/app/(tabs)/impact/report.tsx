import { View, Text, StyleSheet } from 'react-native';

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
    backgroundColor: '#1A0C10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#C9A84C',
    fontFamily: 'CormorantGaramond_700Bold',
    fontSize: 24,
  },
});
