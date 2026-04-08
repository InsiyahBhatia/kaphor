import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { colors, typography, spacing, radius } from '../../theme';

export function AccountSettingsScreen() {
    const router = useRouter();
    const { user, setUser } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Form state
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [location, setLocation] = useState('');
    const [styleAesthetic, setStyleAesthetic] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const profile = await userService.getMe();
                setDisplayName(profile.displayName || '');
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

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await userService.updateMe({
                displayName,
                bio,
                location,
                styleAesthetic: styleAesthetic || undefined
            });
            
            // Optionally update global auth context user if needed
            if (setUser && updated) {
                setUser((prev: any) => ({ ...prev, ...updated }));
            }
            
            Alert.alert('Success', 'Profile updated successfully.');
            router.back();
        } catch (err) {
            console.error('Failed to save settings', err);
            Alert.alert('Error', 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={colors.gold} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.headerTitle}>Account Settings</Text>
                <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.gold} />
                    ) : (
                        <Text style={styles.saveText}>SAVE</Text>
                    )}
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Display Name</Text>
                    <TextInput
                        style={styles.input}
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="e.g. Aria Varma"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Bio</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Tell us about your style..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={4}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Location</Text>
                    <TextInput
                        style={styles.input}
                        value={location}
                        onChangeText={setLocation}
                        placeholder="e.g. Mumbai, IN"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
                
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Style Aesthetic</Text>
                    <TextInput
                        style={styles.input}
                        value={styleAesthetic}
                        onChangeText={setStyleAesthetic}
                        placeholder="e.g. LUXURY or VINTAGE"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="characters"
                    />
                    <Text style={styles.helperText}>Valid: MINIMALIST, VINTAGE, BOLD, ETHNIC, STREETWEAR, LUXURY</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 20 },
    saveBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.bgCard, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
    saveText: { color: colors.gold, fontFamily: typography.mono, fontSize: 12, fontWeight: 'bold' },
    
    content: { padding: spacing.xl },
    
    inputGroup: { marginBottom: spacing.xl },
    label: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm },
    input: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, color: colors.textPrimary, fontFamily: typography.body, fontSize: 16 },
    textArea: { height: 100, textAlignVertical: 'top' },
    helperText: { color: colors.textMuted, fontFamily: typography.body, fontSize: 12, marginTop: spacing.xs }
});
