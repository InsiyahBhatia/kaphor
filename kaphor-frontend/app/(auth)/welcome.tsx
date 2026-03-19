import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=2080&auto=format&fit=crop' }} 
        style={styles.background}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.logo}>KAPHOR</Text>
            <Text style={styles.subtitle}>CIRCULAR LUXURY HERITAGE</Text>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.buttonText}>GET STARTED</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => router.push('/login')}
            >
              <Text style={styles.secondaryButtonText}>I ALREADY HAVE AN ACCOUNT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 12, 16, 0.6)',
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 80,
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontFamily: 'CormorantGaramond_700Bold',
    color: '#C9A84C',
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B5C52',
    letterSpacing: 4,
    marginTop: 8,
  },
  footer: {
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#9B1B30',
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
  },
  secondaryButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 14,
    letterSpacing: 1,
    opacity: 0.8,
  },
});
