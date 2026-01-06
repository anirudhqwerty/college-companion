import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';

type UserProfile = {
  fullName: string;
  rollNumber: string;
  course: string;
  year: string;
  semester: string;
};

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    rollNumber: '',
    course: '',
    year: '',
    semester: '',
  });
  
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Buffer for edits
  const [editForm, setEditForm] = useState<UserProfile>(profile);

  useEffect(() => {
    loadUserAndProfile();
  }, []);

  const loadUserAndProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
         setLoading(false);
         return;
      }
      setUser(user);

      // Fetch Profile from Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        // Profile exists
        const loadedProfile = {
          fullName: data.full_name || '',
          rollNumber: data.roll_number || '',
          course: data.course || '',
          year: data.year || '',
          semester: data.semester || '',
        };
        setProfile(loadedProfile);
        setEditForm(loadedProfile);
      } else {
        // No profile found -> Trigger Onboarding
        setShowOnboarding(true);
      }

    } catch (e) {
      console.error('Load profile error:', e);
    } finally {
      setLoading(false);
    }
  };

  const validateOnboarding = () => {
    if (
      !editForm.fullName.trim() ||
      !editForm.rollNumber.trim() ||
      !editForm.course.trim() ||
      !editForm.year.trim() ||
      !editForm.semester.trim()
    ) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Missing Fields', 'Please fill in all details to continue.');
      return false;
    }
    return true;
  };

  const saveToSupabase = async (newProfile: UserProfile) => {
    if (!user) return;

    const payload = {
      id: user.id, // Primary Key matches User ID
      full_name: newProfile.fullName,
      roll_number: newProfile.rollNumber,
      course: newProfile.course,
      year: newProfile.year,
      semester: newProfile.semester,
      updated_at: new Date(),
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(payload);

    if (error) throw error;
  };

  const completeOnboarding = async () => {
    if (!validateOnboarding()) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await saveToSupabase(editForm);
      
      setProfile(editForm);
      setShowOnboarding(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const saveProfile = async () => {
    if (!validateOnboarding()) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await saveToSupabase(editForm);

      setProfile(editForm);
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Error', error.message);
        },
      },
    ]);
  };

  const clearAllData = () => {
    if (!user) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Clear All Data',
      'This will delete all your attendance, marks, and deadlines from the database. This cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Delete from all tables for this user
              await Promise.all([
                supabase.from('attendance_subjects').delete().eq('user_id', user.id),
                supabase.from('marks_subjects').delete().eq('user_id', user.id),
                supabase.from('deadlines').delete().eq('user_id', user.id),
                supabase.from('profiles').delete().eq('id', user.id),
              ]);
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              // Reset State
              setProfile({
                  fullName: '',
                  rollNumber: '',
                  course: '',
                  year: '',
                  semester: '',
              });
              setEditForm({
                  fullName: '',
                  rollNumber: '',
                  course: '',
                  year: '',
                  semester: '',
              });
              setShowOnboarding(true);
            } catch (error: any) {
              Alert.alert('Error', 'Could not clear data: ' + error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <Modal 
        visible={true} 
        animationType="slide"
        onRequestClose={() => {}} 
      >
        <ScrollView style={styles.onboardingContainer}>
          <Text style={styles.onboardingTitle}>Welcome! 👋</Text>
          <Text style={styles.onboardingSubtitle}>
            To give you the best experience, we need a few details. This is mandatory to proceed.
          </Text>

          <View style={styles.onboardingForm}>
            <InfoInput
              label="Full Name *"
              value={editForm.fullName}
              onChangeText={(text) => setEditForm({ ...editForm, fullName: text })}
              placeholder="John Doe"
            />
            <InfoInput
              label="Roll Number *"
              value={editForm.rollNumber}
              onChangeText={(text) => setEditForm({ ...editForm, rollNumber: text })}
              placeholder="21BCS001"
            />
            <InfoInput
              label="Course *"
              value={editForm.course}
              onChangeText={(text) => setEditForm({ ...editForm, course: text })}
              placeholder="B.Tech CSE"
            />
            <InfoInput
              label="Year *"
              value={editForm.year}
              onChangeText={(text) => setEditForm({ ...editForm, year: text })}
              placeholder="3rd Year"
            />
            <InfoInput
              label="Semester *"
              value={editForm.semester}
              onChangeText={(text) => setEditForm({ ...editForm, semester: text })}
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
                : user?.email?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        </View>

        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.provider}>
          Student ID: {profile.rollNumber || 'Not Set'}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <Pressable
            onPress={() => {
              if (editing) setEditForm(profile);
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
              onChangeText={(text) => setEditForm({ ...editForm, fullName: text })}
              placeholder="John Doe"
            />
            <InfoInput
              label="Roll Number"
              value={editForm.rollNumber}
              onChangeText={(text) => setEditForm({ ...editForm, rollNumber: text })}
              placeholder="21BCS001"
            />
            <InfoInput
              label="Course"
              value={editForm.course}
              onChangeText={(text) => setEditForm({ ...editForm, course: text })}
              placeholder="B.Tech CSE"
            />
            <InfoInput
              label="Year"
              value={editForm.year}
              onChangeText={(text) => setEditForm({ ...editForm, year: text })}
              placeholder="3rd Year"
            />
            <InfoInput
              label="Semester"
              value={editForm.semester}
              onChangeText={(text) => setEditForm({ ...editForm, semester: text })}
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>

        <Pressable onPress={clearAllData} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>🗑️ Clear App Data</Text>
        </Pressable>

        <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>College Companion v1.0</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || '-'}</Text>
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
    lineHeight: 22,
  },
  onboardingForm: {
    marginTop: 16,
    paddingBottom: 40,
  },
  onboardingBtn: {
    backgroundColor: '#000',
    padding: 18,
    borderRadius: 12,
    marginTop: 24,
    elevation: 2,
  },
  onboardingBtnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
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
    borderColor: '#eee',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  saveBtn: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 10,
    marginTop: 12,
  },
  saveBtnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  actionBtnText: {
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  signOutBtn: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 10,
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
  },
});