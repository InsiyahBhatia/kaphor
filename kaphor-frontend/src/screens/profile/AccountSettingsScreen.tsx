import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SolarIcon } from '../../components/common/SolarIcon';
import * as ImagePicker from 'expo-image-picker';
import { promptPhotoSelection } from '../../utils/imagePicker';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import api from '../../services/api';
import { colors, typography, radius, textStyles } from '../../theme';
import { safeBack, useBackHandler } from '../../utils/navigation';
import { Loader, Spinner } from '../../components/common/Loader';
import { Image } from 'expo-image';
import { getErrorMessage } from '../../utils/errors';

export function AccountSettingsScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  useBackHandler('/(tabs)/profile');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  const handleTestPush = async () => {
    setTestingPush(true);
    try {
      const res = await api.post('/users/me/test-push');
      if (res.data?.success) {
        Alert.alert(
          'Notification Sent',
          res.data?.message || 'Test notification sent to your phone!'
        );
      } else {
        Alert.alert(
          'Notification Not Delivered',
          res.data?.message || 'Push could not be delivered to this device.'
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Notification Failed',
        getErrorMessage(err, 'Could not run the push test. Make sure the server is reachable.')
      );
    } finally {
      setTestingPush(false);
    }
  };

  // Form state
  const [avatar, setAvatar] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [styleAesthetic, setStyleAesthetic] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await userService.getMe();
        setAvatar(profile.avatar || null);
        setDisplayName(profile.displayName || '');
        setUsername(profile.username ? profile.username.replace(/^user_[0-9a-f]{6,10}$/i, '') : '');
        setBio(profile.bio || '');
        setLocation(profile.location || '');
        setStyleAesthetic(profile.styleAesthetic || '');
      } catch (err) {
        console.error('Failed to load profile for settings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const uploadAvatarUri = async (uri: string) => {
    try {
      setUploadingAvatar(true);
      const res = await userService.updateAvatar(uri);
      if (res?.avatar) {
        setAvatar(res.avatar);
        if (setUser) {
          setUser((prev: any) => ({ ...prev, avatar: res.avatar }));
        }
        Alert.alert('Success', 'Profile photo updated!');
      }
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to update photo.'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const executeAvatarPick = async (useCamera = false) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is needed to take a profile photo.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
        if (!result.canceled && result.assets[0]?.uri) {
          uploadAvatarUri(result.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access photos is needed.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
        if (!result.canceled && result.assets[0]?.uri) {
          uploadAvatarUri(result.assets[0].uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to pick photo.'));
    }
  };

  const handlePickAvatar = () => {
    Alert.alert('Update Profile Photo', 'Take a new photo with your camera or choose one from your gallery:', [
      { text: 'Take Photo', onPress: () => executeAvatarPick(true) },
      { text: 'Choose from Gallery', onPress: () => executeAvatarPick(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanUser = username.trim().toLowerCase().replace(/^@/, '');
      if (cleanUser && !/^[a-z0-9_]{3,30}$/.test(cleanUser)) {
        Alert.alert('Invalid Handle', 'Username must be 3-30 characters with lowercase letters, numbers, or underscores.');
        setSaving(false);
        return;
      }

      const updated = await userService.updateMe({
        username: cleanUser || undefined,
        displayName,
        bio,
        location,
        styleAesthetic: styleAesthetic || undefined,
      });

      if (setUser && updated) {
        setUser((prev: any) => ({ ...prev, ...updated, username: cleanUser || updated.username }));
      }

      Alert.alert('Success', 'Profile updated successfully.');
      safeBack('/(tabs)/profile');
    } catch (err: any) {
      console.error('Failed to save settings', err);
      const msg = getErrorMessage(err, 'Failed to update profile.');
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Loader variant="default" layout="form" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back"
            onPress={() => safeBack('/(tabs)/profile')}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SolarIcon name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>ACCOUNT SETTINGS</Text>
          <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
            {saving ? (
              <Spinner size="small" color={colors.cream} />
            ) : (
              <Text style={styles.saveText}>SAVE</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="on-drag"
        >
        {/* Compact Avatar Row */}
        <View style={styles.avatarRow}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} contentFit="cover" cachePolicy="memory-disk" transition={150} />
            ) : (
              <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                <SolarIcon name="person" size={26} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.cameraIconBadge}>
              {uploadingAvatar ? (
                <Spinner size="small" color={colors.white} />
              ) : (
                <SolarIcon name="camera" size={11} color={colors.cream} />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.avatarInfoCol}>
            <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar}>
              <Text style={styles.changePhotoText}>
                {uploadingAvatar ? 'UPLOADING...' : 'CHANGE PROFILE PHOTO'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.avatarSubText}>
              {user?.email || 'Member'}
            </Text>
          </View>
        </View>

        {/* 2-Column: Display Name & Username Handle */}
        <View style={styles.formRow}>
          <View style={styles.halfCol}>
            <Text style={styles.label}>DISPLAY NAME</Text>
            <TextInput accessibilityLabel="Your name"
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.halfCol}>
            <Text style={styles.label}>USERNAME HANDLE</Text>
            <View style={styles.usernameInputWrap}>
              <Text style={styles.usernameAt}>@</Text>
              <TextInput accessibilityLabel="handle"
                style={styles.usernameInput}
                value={username}
                onChangeText={(val) => setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="handle"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        </View>

        {/* 2-Column: Location & Style Aesthetic */}
        <View style={styles.formRow}>
          <View style={styles.halfCol}>
            <Text style={styles.label}>LOCATION</Text>
            <TextInput accessibilityLabel="Mumbai, IN"
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Mumbai, IN"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.halfCol}>
            <Text style={styles.label}>AESTHETIC</Text>
            <TextInput accessibilityLabel="Minimal"
              style={styles.input}
              value={styleAesthetic}
              onChangeText={setStyleAesthetic}
              placeholder="e.g. Minimal"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Bio */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>ABOUT YOU & YOUR TASTE</Text>
          <TextInput accessibilityLabel="Tell us about your style"
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about your style..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Payment & Operations (Compact 2-Tile Row) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>PAYMENT & SELLER OPERATIONS</Text>
        </View>

        <View style={styles.actionCardsRow}>
          <Pressable
            style={styles.compactActionCard}
            onPress={() => router.push('/profile/payout' as any)}
          >
            <View style={styles.compactActionIcon}>
              <SolarIcon name="wallet-outline" size={18} color={colors.charcoal} />
            </View>
            <View style={styles.compactActionBody}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.compactActionTitle}>PAYOUT ACCOUNTS</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.compactActionSub}>Bank & UPI IDs</Text>
            </View>
            <SolarIcon name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={styles.compactActionCard}
            onPress={() => router.push('/(tabs)/shop/payment-history' as any)}
          >
            <View style={styles.compactActionIcon}>
              <SolarIcon name="receipt-outline" size={18} color={colors.charcoal} />
            </View>
            <View style={styles.compactActionBody}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.compactActionTitle}>PAYMENT HISTORY</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.compactActionSub}>Payments & orders</Text>
            </View>
            <SolarIcon name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Alerts & Push Notifications */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>PHONE NOTIFICATIONS</Text>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <Pressable
            style={[styles.compactActionCard, { width: '100%' }]}
            onPress={handleTestPush}
            disabled={testingPush}
          >
            <View style={[styles.compactActionIcon, { backgroundColor: colors.emeraldLight }]}>
              {testingPush ? (
                <Spinner size="small" color={colors.forest} />
              ) : (
                <SolarIcon name="notifications-outline" size={18} color={colors.forest} />
              )}
            </View>
            <View style={styles.compactActionBody}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.compactActionTitle}>TEST PHONE NOTIFICATION</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.compactActionSub}>Trigger instant out-of-app heads-up alert</Text>
            </View>
            <SolarIcon name="paper-plane-outline" size={16} color={colors.charcoal} />
          </Pressable>
        </View>

        {/* Legal, Privacy & Compliance */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>LEGAL, PRIVACY & COMPLIANCE</Text>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <Pressable
            style={[styles.compactActionCard, { width: '100%' }]}
            onPress={() => router.push('/legal' as any)}
          >
            <View style={[styles.compactActionIcon, { backgroundColor: colors.paperDark }]}>
              <SolarIcon name="shield-checkmark-outline" size={18} color={colors.ink} />
            </View>
            <View style={styles.compactActionBody}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.compactActionTitle}>LEGAL & COMPLIANCE CENTER</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.compactActionSub}>Terms of Use, DPDP Privacy, Grievance Officer & Swapping</Text>
            </View>
            <SolarIcon name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.creditsText}>
          Icons: Solar Icon Set by 480 Design (CC BY 4.0)
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  creditsText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
    backgroundColor: colors.white,
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  headerTitle: {
    ...textStyles.screenTitle,
    color: colors.ink,
  },
  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.ink,
    borderRadius: 2,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: colors.cream,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },

  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 160,
    gap: 12,
  },

  // Compact Avatar Row
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    padding: 10,
    borderRadius: 3,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  avatarPlaceholder: {
    backgroundColor: colors.bgMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.ink,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInfoCol: {
    flex: 1,
    gap: 2,
  },
  changePhotoText: {
    color: colors.ink,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  avatarSubText: {
    color: colors.textMuted,
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
  },

  // Form Rows & Fields
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCol: {
    flex: 1,
  },
  fieldBlock: {
    width: '100%',
  },
  label: {
    color: colors.ink,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 12,
  },
  usernameInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    paddingHorizontal: 8,
  },
  usernameAt: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.ink,
    fontWeight: '900',
    marginRight: 2,
  },
  usernameInput: {
    flex: 1,
    paddingVertical: 7,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 12,
  },
  textArea: {
    height: 56,
    textAlignVertical: 'top',
    lineHeight: 16,
  },

  // Operations Header & Cards
  sectionHeaderRow: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
    paddingTop: 8,
  },
  sectionHeader: {
    color: colors.ink,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },
  actionCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 0,
    elevation: 2,
  },
  compactActionIcon: {
    width: 28,
    height: 28,
    borderRadius: 2,
    backgroundColor: colors.bgMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactActionBody: {
    flex: 1,
  },
  compactActionTitle: {
    color: colors.ink,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
  },
  compactActionSub: {
    color: colors.textMuted,
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 14,
    marginTop: 1,
  },
});
