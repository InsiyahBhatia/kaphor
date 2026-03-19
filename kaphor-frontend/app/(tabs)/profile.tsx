import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { userService } from '../../src/services/userService';
import * as ImagePicker from 'expo-image-picker';
import api from '../../src/services/api';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await userService.getMe();
      setProfile(data);
    } catch (err) {
      // Fallback to context user data
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  const displayName = profile?.displayName || user?.displayName || 'User';
  const email = profile?.email || user?.email || '';
  const tier = profile?.tier || 'MEMBER';
  const avatar = profile?.avatar || user?.avatarUrl;
  const impact = profile?.impactRecord;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarContainer} onPress={async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission needed'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
          if (result.canceled) return;
          try {
            const formData = new FormData();
            formData.append('avatar', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'avatar.jpg' } as any);
            await api.put('/users/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            fetchProfile();
            Alert.alert('Updated!', 'Avatar changed successfully.');
          } catch { Alert.alert('Error', 'Failed to update avatar.'); }
        }}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={40} color="#C9A84C" />
            </View>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{tier}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.userEmail}>{email}</Text>
      </View>

      {impact && (
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{impact.itemsCirculated || 0}</Text>
            <Text style={styles.statLabel}>CIRCULATED</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{(impact.carbonSavedKg || 0).toFixed(1)}</Text>
            <Text style={styles.statLabel}>KG CO₂</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{(impact.waterSavedL || 0).toFixed(0)}</Text>
            <Text style={styles.statLabel}>L WATER</Text>
          </View>
        </View>
      )}

      <View style={styles.menu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/notifications')}
        >
          <Ionicons name="notifications-outline" size={20} color="#C9A84C" />
          <Text style={styles.menuText}>NOTIFICATIONS</Text>
          <Ionicons name="chevron-forward" size={16} color="#6B5C52" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/shop')}
        >
          <Ionicons name="pricetag-outline" size={20} color="#C9A84C" />
          <Text style={styles.menuText}>MY LISTINGS</Text>
          <Ionicons name="chevron-forward" size={16} color="#6B5C52" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/shop')}
        >
          <Ionicons name="bag-check-outline" size={20} color="#C9A84C" />
          <Text style={styles.menuText}>MY PURCHASES</Text>
          <Ionicons name="chevron-forward" size={16} color="#6B5C52" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/impact')}
        >
          <Ionicons name="leaf-outline" size={20} color="#C9A84C" />
          <Text style={styles.menuText}>MY IMPACT</Text>
          <Ionicons name="chevron-forward" size={16} color="#6B5C52" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/circular')}
        >
          <Ionicons name="infinite-outline" size={20} color="#C9A84C" />
          <Text style={styles.menuText}>CIRCULAR HUB</Text>
          <Ionicons name="chevron-forward" size={16} color="#6B5C52" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/studio')}
        >
          <Ionicons name="brush-outline" size={20} color="#C9A84C" />
          <Text style={styles.menuText}>UPCYCLE STUDIO</Text>
          <Ionicons name="chevron-forward" size={16} color="#6B5C52" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/rental')}
        >
          <Ionicons name="time-outline" size={20} color="#C9A84C" />
          <Text style={styles.menuText}>HERITAGE RENTAL</Text>
          <Ionicons name="chevron-forward" size={16} color="#6B5C52" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/swap')}
        >
          <Ionicons name="swap-horizontal-outline" size={20} color="#C9A84C" />
          <Text style={styles.menuText}>SWAP & TRADE</Text>
          <Ionicons name="chevron-forward" size={16} color="#6B5C52" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="settings-outline" size={20} color="#C9A84C" />
          <Text style={styles.menuText}>ACCOUNT SETTINGS</Text>
          <Ionicons name="chevron-forward" size={16} color="#6B5C52" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.logoutItem]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#9B1B30" />
          <Text style={[styles.menuText, styles.logoutText]}>LOG OUT</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0C10',
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#C9A84C',
  },
  avatarPlaceholder: {
    backgroundColor: '#2A1C20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#C9A84C',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#1A0C10',
    fontSize: 10,
    fontWeight: '700',
  },
  userName: {
    fontSize: 24,
    fontFamily: 'CormorantGaramond_700Bold',
    color: '#C9A84C',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B5C52',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#2A1C20',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.15)',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#C9A84C',
  },
  statLabel: {
    fontSize: 10,
    color: '#6B5C52',
    letterSpacing: 1,
    marginTop: 4,
  },
  menu: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2A1C20',
    borderRadius: 8,
    gap: 16,
  },
  menuText: {
    color: 'white',
    fontSize: 14,
    letterSpacing: 1,
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
  logoutItem: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(155, 27, 48, 0.3)',
  },
  logoutText: {
    color: '#9B1B30',
    fontWeight: '700',
  },
});
