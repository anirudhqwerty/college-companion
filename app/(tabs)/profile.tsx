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
  Linking, // added for the linkedin link
} from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons'; // using feather vectors

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

  const handleOpenLink = () => {
    Haptics.selectionAsync();
    Linking.openURL('https://linkedin.com/in/anirudhqwerty');
  };

  const clearAllData = () => {
    if (!user) return;

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
          <View style={styles.onboardingHeader}>
             <Feather name="smile" size={48} color="#000" style={{ marginBottom: 16 }} />
             <Text style={styles.onboardingTitle}>Welcome!</Text>
             <Text style={styles.onboardingSubtitle}>
                To give you the best experience, we need a few details. This is mandatory to proceed.
             </Text>
          </View>

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
              <Feather name="arrow-right" size={20} color="#fff" />
            </Pressable>
          </View>
        </ScrollView>
      </Modal>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.headerSpacer} />
      <Text style={styles.screenTitle}>Profile</Text>

      {/* Main Profile Card */}
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
          <View style={styles.profileTexts}>
             <Text style={styles.profileName}>{profile.fullName || 'User'}</Text>
             <Text style={styles.email}>{user?.email}</Text>
             <View style={styles.idBadge}>
                <Text style={styles.idText}>ID: {profile.rollNumber || 'Not Set'}</Text>
             </View>
          </View>
        </View>
      </View>

      {/* Academic Info Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Feather name="book-open" size={18} color="#000" style={{marginRight: 8}} />
             <Text style={styles.cardTitle}>Academic Details</Text>
          </View>
          <Pressable
            onPress={() => {
              if (editing) setEditForm(profile);
              setEditing(!editing);
              Haptics.selectionAsync();
            }}
            style={styles.editBtnContainer}
          >
            <Text style={styles.editBtn}>{editing ? 'Cancel' : 'Edit'}</Text>
          </Pressable>
        </View>

        {editing ? (
          <View style={{ gap: 12 }}>
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
          </View>
        ) : (
          <View>
            <InfoRow label="Course" value={profile.course} icon="bookmark" />
            <View style={styles.divider} />
            <InfoRow label="Year" value={profile.year} icon="calendar" />
            <View style={styles.divider} />
            <InfoRow label="Semester" value={profile.semester} icon="clock" />
          </View>
        )}
      </View>

      {/* Actions Section - Compact Style */}
      <View style={styles.sectionLabelContainer}>
         <Text style={styles.sectionLabel}>ACCOUNT ACTIONS</Text>
      </View>

      <View style={styles.actionGroup}>
        <ActionRow 
            label="Clear App Data" 
            icon="trash-2" 
            isDestructive 
            onPress={clearAllData} 
        />
        <View style={styles.divider} />
        <ActionRow 
            label="Sign Out" 
            icon="log-out" 
            onPress={handleSignOut} 
        />
      </View>

      {/* Footer with Anirudh Link */}
      <View style={styles.footer}>
        <Pressable onPress={handleOpenLink} style={styles.madeByContainer}>
           <Text style={styles.madeByText}>Made by </Text>
           <Text style={styles.madeByName}>Anirudh</Text>
           <Feather name="external-link" size={12} color="#007AFF" style={{ marginLeft: 4 }} />
        </Pressable>
        <Text style={styles.versionText}>v1.0.0</Text>
      </View>

    </ScrollView>
  );
}

// Compact Action Row Component
const ActionRow = ({ label, icon, onPress, isDestructive }: any) => (
  <Pressable 
    onPress={onPress} 
    style={({pressed}) => [styles.actionRow, pressed && { backgroundColor: '#f9f9f9' }]}
  >
    <View style={styles.actionRowLeft}>
       <View style={[styles.iconBox, isDestructive && { backgroundColor: '#fee2e2' }]}>
          <Feather name={icon} size={18} color={isDestructive ? '#dc2626' : '#333'} />
       </View>
       <Text style={[styles.actionLabel, isDestructive && { color: '#dc2626' }]}>{label}</Text>
    </View>
    <Feather name="chevron-right" size={18} color="#ccc" />
  </Pressable>
);

const InfoRow = ({ label, value, icon }: { label: string; value: string, icon: keyof typeof Feather.glyphMap }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoRowLeft}>
       <Feather name={icon} size={14} color="#999" style={{ marginRight: 8 }} />
       <Text style={styles.infoLabel}>{label}</Text>
    </View>
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
      placeholderTextColor="#ccc"
      style={styles.input}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa', // softer background
  },
  headerSpacer: { height: 40 },
  screenTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111',
    marginBottom: 24,
  },
  
  // Onboarding Styles
  onboardingContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  onboardingHeader: {
      marginTop: 60,
      alignItems: 'center',
  },
  onboardingTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    color: '#111'
  },
  onboardingSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    maxWidth: '80%'
  },
  onboardingForm: {
    paddingBottom: 40,
  },
  onboardingBtn: {
    backgroundColor: '#000',
    padding: 18,
    borderRadius: 16,
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  onboardingBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  
  // Profile Header Specifics
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  profileTexts: {
      flex: 1,
  },
  profileName: {
      fontSize: 20,
      fontWeight: '700',
      color: '#111',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  idBadge: {
      backgroundColor: '#f3f4f6',
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginTop: 8,
  },
  idText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#444',
  },

  editBtnContainer: {
      padding: 4,
  },
  editBtn: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Info Rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    alignItems: 'center',
  },
  infoRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  divider: {
      height: 1,
      backgroundColor: '#f3f4f6',
  },

  // Inputs
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    color: '#000',
  },
  saveBtn: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  // Compact Actions Group
  sectionLabelContainer: {
      paddingHorizontal: 12,
      marginBottom: 8,
  },
  sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#888',
      letterSpacing: 0.5,
  },
  actionGroup: {
      backgroundColor: '#fff',
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 30,
      borderWidth: 1,
      borderColor: '#f0f0f0',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  actionRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  iconBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#f3f4f6',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4
  },
  madeByContainer: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  madeByText: {
      fontSize: 14,
      color: '#999',
  },
  madeByName: {
      fontSize: 14,
      color: '#007AFF',
      fontWeight: '600',
  },
  versionText: {
    fontSize: 11,
    color: '#ccc',
  },
});