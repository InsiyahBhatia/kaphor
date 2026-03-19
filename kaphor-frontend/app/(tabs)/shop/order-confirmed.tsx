import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function OrderConfirmedScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>ORDER CONFIRMED</Text>
      <Text style={styles.subtext}>Your sustainable luxury item is on its way.</Text>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.buttonText}>BACK TO HOME</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0C10',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    color: '#C9A84C',
    fontFamily: 'CormorantGaramond_700Bold',
    fontSize: 32,
    textAlign: 'center',
  },
  subtext: {
    color: 'white',
    marginTop: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  button: {
    backgroundColor: '#9B1B30',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 40,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    letterSpacing: 2,
  },
});
