import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  ViewStyle,
} from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Action =
  | 'ATTENDED'
  | 'MISSED'
  | 'ATTENDED_LAB'
  | 'MISSED_LAB'
  | 'CLASS_CANCELLED'
  | 'LAB_CANCELLED';

type Subject = {
  id: string;
  name: string;
  attended: number;
  missed: number;
  history: Action[];
};

const STORAGE_KEY = 'attendance_subjects';

export default function AttendanceScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState('');

  /* ---------- Persistence ---------- */

  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setSubjects(JSON.parse(saved));
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
  }, [subjects]);

  /* ---------- Helpers ---------- */

  const updateSubject = (id: string, fn: (s: Subject) => Subject) => {
    setSubjects(prev => prev.map(s => (s.id === id ? fn(s) : s)));
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

    switch (last) {
      case 'ATTENDED':
        attended -= 1;
        break;
      case 'MISSED':
        missed -= 1;
        break;
      case 'ATTENDED_LAB':
        attended -= 2;
        break;
      case 'MISSED_LAB':
        missed -= 2;
        break;
      case 'CLASS_CANCELLED':
      case 'LAB_CANCELLED':
        break;
    }

    return {
      ...s,
      attended: Math.max(0, attended),
      missed: Math.max(0, missed),
      history: s.history.slice(0, -1),
    };
  };

  /* ---------- Actions ---------- */

  const addSubject = () => {
    if (!subjectName.trim()) return;

    setSubjects(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: subjectName,
        attended: 0,
        missed: 0,
        history: [],
      },
    ]);

    setSubjectName('');
  };

  const removeSubject = (id: string) => {
    Alert.alert('Delete subject?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          setSubjects(prev => prev.filter(s => s.id !== id)),
      },
    ]);
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
              <Text style={{ fontSize: 18, fontWeight: '600' }}>
                {item.name}
              </Text>

              <Text>
                Attended: {item.attended} | Missed: {item.missed}
              </Text>

              <Text style={{ fontWeight: '600', color }}>
                Attendance: {p}%
              </Text>

              <Text>Skip {skip75} classes (75%)</Text>
              <Text>Skip {skip50} classes (50%)</Text>

              {/* Buttons */}
              <View style={{ marginTop: 10 }}>
                <Row>
                  <Pressable
                    onPress={() =>
                      updateSubject(item.id, s => push(s, 'ATTENDED', 1))
                    }
                    style={btn('#16a34a')}
                  >
                    <Text style={{ color: '#16a34a' }}>+ Attended</Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      updateSubject(item.id, s => push(s, 'MISSED', 0, 1))
                    }
                    style={btn('#dc2626')}
                  >
                    <Text style={{ color: '#dc2626' }}>+ Missed</Text>
                  </Pressable>
                </Row>

                <Row>
                  <Pressable
                    onPress={() =>
                      updateSubject(item.id, s =>
                        push(s, 'ATTENDED_LAB', 2)
                      )
                    }
                    style={btn('#2563eb')}
                  >
                    <Text style={{ color: '#2563eb' }}>+ Attended Lab</Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      updateSubject(item.id, s =>
                        push(s, 'MISSED_LAB', 0, 2)
                      )
                    }
                    style={btn('#7c2d12')}
                  >
                    <Text style={{ color: '#7c2d12' }}>+ Missed Lab</Text>
                  </Pressable>
                </Row>

                <Row>
                  <Pressable
                    onPress={() =>
                      updateSubject(item.id, s =>
                        push(s, 'CLASS_CANCELLED')
                      )
                    }
                    style={btn('#6b7280')}
                  >
                    <Text>Class Cancelled</Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      updateSubject(item.id, s =>
                        push(s, 'LAB_CANCELLED')
                      )
                    }
                    style={btn('#6b7280')}
                  >
                    <Text>Lab Cancelled</Text>
                  </Pressable>
                </Row>

                <Row>
                  <Pressable
                    onPress={() =>
                      updateSubject(item.id, s => pop(s))
                    }
                    disabled={item.history.length === 0}
                    style={btn('#000')}
                  >
                    <Text>Undo</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => removeSubject(item.id)}
                    style={btn('#dc2626')}
                  >
                    <Text style={{ color: '#dc2626' }}>Delete</Text>
                  </Pressable>
                </Row>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

/* ---------- Small helpers ---------- */

const Row = ({ children }: { children: any }) => (
  <View style={{ flexDirection: 'row', marginBottom: 6 }}>{children}</View>
);

const btn = (color: string): ViewStyle => ({
  flex: 1,
  padding: 10,
  borderWidth: 1,
  borderColor: color,
  borderRadius: 6,
  marginRight: 6,
  alignItems: 'center',
});
