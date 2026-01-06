import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  StyleSheet,
  Modal,
} from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

type UserProfile = {
  fullName: string;
  rollNumber: string;
  course: string;
  year: string;
  semester: string;
  isComplete: boolean;
};

const PROFILE_KEY = 'user_profile';

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    rollNumber: '',
    course: '',
    year: '',
    semester: '',
    isComplete: false,
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Temporary state for editing
  const [editForm, setEditForm] = useState<UserProfile>(profile);

  useEffect(() => {
    loadUserAndProfile();
  }, []);

  const loadUserAndProfile = async () => {
    // Get current user from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    // Load profile from AsyncStorage
    const saved = await AsyncStorage.getItem(PROFILE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setProfile(parsed);
      setEditForm(parsed);
      
      // Show onboarding if profile is incomplete
      if (!parsed.isComplete) {
        setShowOnboarding(true);
      }
    } else {
      // No profile exists, show onboarding
      setShowOnboarding(true);
    }

    setLoading(false);
  };

  const validateOnboarding = () => {
    if (
      !editForm.fullName.trim() ||
      !editForm.rollNumber.trim() ||
      !editForm.course.trim() ||
      !editForm.year.trim() ||
      !editForm.semester.trim()
    ) {
      Alert.alert('Incomplete', 'Please fill in all fields');
      return false;
    }
    return true;
  };

  const completeOnboarding = async () => {
    if (!validateOnboarding()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const completeProfile = { ...editForm, isComplete: true };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(completeProfile));
    setProfile(completeProfile);
    setShowOnboarding(false);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const saveProfile = async () => {
    if (!validateOnboarding()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const updatedProfile = { ...editForm, isComplete: true };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
    setProfile(updatedProfile);
    setEditing(false);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.auth.signOut();
            
            if (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } else {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              // Auth state change will be handled by _layout.tsx
            }
          } catch (err) {
            console.error('Sign out exception:', err);
            Alert.alert('Error', 'An error occurred while signing out.');
          }
        },
      },
    ]);
  };

  const clearAllData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Alert.alert(
      'Clear All Data',
      'This will delete all your attendance, marks, and deadlines. This cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove([
              'attendance_subjects',
              'marks_subjects',
              'deadlines',
              'deadlines_history',
            ]);

            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            Alert.alert('Success', 'All data has been cleared');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  // Onboarding Modal
  if (showOnboarding) {
    return (
      <Modal visible={true} animationType="slide">
        <ScrollView style={styles.onboardingContainer}>
          <Text style={styles.onboardingTitle}>Welcome! 👋</Text>
          <Text style={styles.onboardingSubtitle}>
            Let's set up your profile to get started
          </Text>

          <View style={styles.onboardingForm}>
            <InfoInput
              label="Full Name *"
              value={editForm.fullName}
              onChangeText={(text) =>
                setEditForm({ ...editForm, fullName: text })
              }
              placeholder="John Doe"
            />
            <InfoInput
              label="Roll Number *"
              value={editForm.rollNumber}
              onChangeText={(text) =>
                setEditForm({ ...editForm, rollNumber: text })
              }
              placeholder="21BCS001"
            />
            <InfoInput
              label="Course *"
              value={editForm.course}
              onChangeText={(text) =>
                setEditForm({ ...editForm, course: text })
              }
              placeholder="B.Tech CSE"
            />
            <InfoInput
              label="Year *"
              value={editForm.year}
              onChangeText={(text) =>
                setEditForm({ ...editForm, year: text })
              }
              placeholder="3rd Year"
            />
            <InfoInput
              label="Semester *"
              value={editForm.semester}
              onChangeText={(text) =>
                setEditForm({ ...editForm, semester: text })
              }
              placeholder="6th Semester"
            />

            <Pressable
              onPress={completeOnboarding}
              style={styles.onboardingBtn}
            >
              <Text style={styles.onboardingBtnText}>Complete Setup</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      {/* User Info Card */}
      <View style={styles.card}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.fullName
                ? profile.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : user?.email?.[0].toUpperCase() || '?'}
            </Text>
          </View>
        </View>

        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.provider}>
          Signed in with {user?.app_metadata?.provider || 'email'}
        </Text>
      </View>

      {/* Profile Details */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <Pressable
            onPress={() => {
              if (editing) {
                setEditForm(profile); // Reset form
              }
              setEditing(!editing);
              Haptics.selectionAsync();
            }}
          >
            <Text style={styles.editBtn}>{editing ? 'Cancel' : 'Edit'}</Text>
          </Pressable>
        </View>

        {editing ? (
          <>
            <InfoInput
              label="Full Name"
              value={editForm.fullName}
              onChangeText={(text) =>
                setEditForm({ ...editForm, fullName: text })
              }
              placeholder="John Doe"
            />
            <InfoInput
              label="Roll Number"
              value={editForm.rollNumber}
              onChangeText={(text) =>
                setEditForm({ ...editForm, rollNumber: text })
              }
              placeholder="21BCS001"
            />
            <InfoInput
              label="Course"
              value={editForm.course}
              onChangeText={(text) =>
                setEditForm({ ...editForm, course: text })
              }
              placeholder="B.Tech CSE"
            />
            <InfoInput
              label="Year"
              value={editForm.year}
              onChangeText={(text) =>
                setEditForm({ ...editForm, year: text })
              }
              placeholder="3rd Year"
            />
            <InfoInput
              label="Semester"
              value={editForm.semester}
              onChangeText={(text) =>
                setEditForm({ ...editForm, semester: text })
              }
              placeholder="6th Semester"
            />

            <Pressable onPress={saveProfile} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </Pressable>
          </>
        ) : (
          <>
            <InfoRow label="Full Name" value={profile.fullName} />
            <InfoRow label="Roll Number" value={profile.rollNumber} />
            <InfoRow label="Course" value={profile.course} />
            <InfoRow label="Year" value={profile.year} />
            <InfoRow label="Semester" value={profile.semester} />
          </>
        )}
      </View>

      {/* Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>

        <Pressable onPress={clearAllData} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>🗑️ Clear All Data</Text>
        </Pressable>

        <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* App Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>College Companion v1.0</Text>
        <Text style={styles.footerText}>Made with ❤️ for students</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* ---------- Components ---------- */

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const InfoInput = ({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      style={styles.input}
    />
  </View>
);

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  onboardingContainer: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
    backgroundColor: '#fff',
  },
  onboardingTitle: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  onboardingSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  onboardingForm: {
    marginTop: 16,
  },
  onboardingBtn: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  onboardingBtnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  provider: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  editBtn: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: '#000',
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#dc2626',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionBtnText: {
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  signOutBtn: {
    backgroundColor: '#000',
    padding: 14,
    borderRadius: 8,
  },
  signOutBtnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
});