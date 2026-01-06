import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  Modal,
  ViewStyle,
} from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; 

type Action =
  | 'ATTENDED'
  | 'MISSED'
  | 'ATTENDED_LAB'
  | 'MISSED_LAB';

// Matches your SQL Table structure
type Subject = {
  id: string;
  user_id?: string;
  name: string;
  attended: number;
  missed: number;
  history: Action[];
};

export default function AttendanceScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---------- Initialization ---------- */

  useEffect(() => {
    const init = async () => {
      // 1. Get User
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      // 2. Fetch Data from Supabase
      const { data, error } = await supabase
        .from('attendance_subjects')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        Alert.alert('Error fetching data', error.message);
      } else if (data) {
        setSubjects(data);
      }
      setLoading(false);
    };

    init();
  }, []);

  /* ---------- Database Actions ---------- */

  const addSubject = async () => {
    if (!subjectName.trim() || !userId) return;

    // Create temporary object for Optimistic UI (optional) or just wait for DB
    const newSubjectPayload = {
      user_id: userId,
      name: subjectName,
      attended: 0,
      missed: 0,
      history: [],
    };

    // 1. Insert into Supabase
    const { data, error } = await supabase
      .from('attendance_subjects')
      .insert(newSubjectPayload)
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    // 2. Update Local State with the real data (including the new UUID)
    if (data) {
      setSubjects(prev => [...prev, data]);
      setSubjectName('');
    }
  };

  const removeSubject = (id: string) => {
    Alert.alert('Delete subject?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // 1. Update UI immediately
          const previousSubjects = [...subjects];
          setSubjects(prev => prev.filter(s => s.id !== id));

          // 2. Delete from Supabase
          const { error } = await supabase
            .from('attendance_subjects')
            .delete()
            .eq('id', id);

          // 3. Revert if error
          if (error) {
            Alert.alert('Error', 'Could not delete subject');
            setSubjects(previousSubjects);
          }
        },
      },
    ]);
  };

  /* ---------- Helpers & Logic ---------- */

  // Refactored to handle Async DB updates
  const updateSubject = async (id: string, fn: (s: Subject) => Subject) => {
    // Find the specific subject
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;

    // Calculate new state
    const newSubject = fn(subject);

    // 1. Optimistic Update (Update UI Immediately)
    setSubjects(prev => prev.map(s => (s.id === id ? newSubject : s)));

    // 2. Sync to Supabase
    // We only update the changing fields to save bandwidth
    const { error } = await supabase
      .from('attendance_subjects')
      .update({
        attended: newSubject.attended,
        missed: newSubject.missed,
        history: newSubject.history,
      })
      .eq('id', id);

    if (error) {
      console.error('Sync failed:', error);
      Alert.alert('Sync Error', 'Your last change was not saved.');
      // Optionally revert UI here if needed
    }
  };

  const push = (s: Subject, action: Action, a = 0, m = 0): Subject => ({
    ...s,
    attended: s.attended + a,
    missed: s.missed + m,
    history: [...s.history, action],
  });

  const pop = (s: Subject): Subject => {
    if (s.history.length === 0) return s;

    const last = s.history[s.history.length - 1];
    let attended = s.attended;
    let missed = s.missed;

    if (last === 'ATTENDED') attended -= 1;
    if (last === 'MISSED') missed -= 1;
    if (last === 'ATTENDED_LAB') attended -= 2;
    if (last === 'MISSED_LAB') missed -= 2;

    return {
      ...s,
      attended: Math.max(0, attended),
      missed: Math.max(0, missed),
      history: s.history.slice(0, -1),
    };
  };

  /* ---------- Math ---------- */

  const percent = (s: Subject) => {
    const total = s.attended + s.missed;
    if (total === 0) return 100;
    return Math.round((s.attended / total) * 100);
  };

  const canSkip = (s: Subject, min: number) => {
    let a = s.attended;
    let m = s.missed;

    while (true) {
      const total = a + m + 1;
      if ((a / total) * 100 < min) break;
      m++;
    }
    return m - s.missed;
  };

  /* ---------- UI ---------- */

  if (loading) {
     return <View style={{flex:1, backgroundColor:'#fff'}} />;
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 12 }}>
        Attendance
      </Text>

      {/* Add subject */}
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <TextInput
          placeholder="Subject name"
          value={subjectName}
          onChangeText={setSubjectName}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#000',
            padding: 10,
            marginRight: 8,
            borderRadius: 6,
          }}
        />
        <Pressable onPress={addSubject} style={btn('#000')}>
          <Text>Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={subjects}
        keyExtractor={i => i.id}
        renderItem={({ item }) => {
          const p = percent(item);
          const skip75 = canSkip(item, 75);
          const skip50 = canSkip(item, 50);

          let color = '#16a34a';
          if (p < 75) color = '#f59e0b';
          if (p < 50) color = '#dc2626';

          return (
            <View
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                padding: 14,
                marginBottom: 12,
                borderRadius: 8,
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '600' }}>
                  {item.name}
                </Text>

                <Pressable onPress={() => setMenuFor(item.id)}>
                  <Text style={{ fontSize: 22 }}>⋮</Text>
                </Pressable>
              </View>

              <Text>
                Attended: {item.attended} | Missed: {item.missed}
              </Text>

              <Text style={{ fontWeight: '600', color }}>
                Attendance: {p}%
              </Text>

              <Text>Skip {skip75} classes (75%)</Text>
              <Text>Skip {skip50} classes (50%)</Text>

              {/* 3-dot menu */}
              <Modal
                transparent
                visible={menuFor === item.id}
                animationType="fade"
              >
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    justifyContent: 'center',
                    padding: 32,
                  }}
                  onPress={() => setMenuFor(null)}
                >
                  <View
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <MenuItem
                      label="Attended class"
                      onPress={() =>
                        updateSubject(item.id, s =>
                          push(s, 'ATTENDED', 1)
                        )
                      }
                    />
                    <MenuItem
                      label="Missed class"
                      onPress={() =>
                        updateSubject(item.id, s =>
                          push(s, 'MISSED', 0, 1)
                        )
                      }
                    />
                    <MenuItem
                      label="Attended lab"
                      onPress={() =>
                        updateSubject(item.id, s =>
                          push(s, 'ATTENDED_LAB', 2)
                        )
                      }
                    />
                    <MenuItem
                      label="Missed lab"
                      onPress={() =>
                        updateSubject(item.id, s =>
                          push(s, 'MISSED_LAB', 0, 2)
                        )
                      }
                    />
                    <MenuItem
                      label="Undo"
                      disabled={item.history.length === 0}
                      onPress={() =>
                        updateSubject(item.id, s => pop(s))
                      }
                    />
                    <MenuItem
                      label="Delete subject"
                      danger
                      onPress={() => removeSubject(item.id)}
                    />
                  </View>
                </Pressable>
              </Modal>
            </View>
          );
        }}
      />
    </View>
  );
}

const MenuItem = ({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={{
      paddingVertical: 10,
      opacity: disabled ? 0.4 : 1,
    }}
  >
    <Text
      style={{
        fontSize: 16,
        color: danger ? '#dc2626' : '#000',
      }}
    >
      {label}
    </Text>
  </Pressable>
);

const btn = (color: string): ViewStyle => ({
  paddingHorizontal: 16,
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: color,
  borderRadius: 6,
});