import { View, Text, Pressable, FlatList, TextInput } from 'react-native';
import { useState } from 'react';

type Action =
  | 'ATTENDED'
  | 'MISSED'
  | 'ATTENDED_LAB'
  | 'MISSED_LAB';

type Subject = {
  id: string;
  name: string;
  attended: number;
  missed: number;
  lastAction?: Action;
};

export default function AttendanceScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState('');

  const addSubject = () => {
    if (!subjectName.trim()) return;

    setSubjects(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: subjectName,
        attended: 0,
        missed: 0,
      },
    ]);

    setSubjectName('');
  };

  const updateSubject = (id: string, updater: (s: Subject) => Subject) => {
    setSubjects(prev =>
      prev.map(sub => (sub.id === id ? updater(sub) : sub))
    );
  };

  const attended = (id: string) =>
    updateSubject(id, s => ({
      ...s,
      attended: s.attended + 1,
      lastAction: 'ATTENDED',
    }));

  const missed = (id: string) =>
    updateSubject(id, s => ({
      ...s,
      missed: s.missed + 1,
      lastAction: 'MISSED',
    }));

  const attendedLab = (id: string) =>
    updateSubject(id, s => ({
      ...s,
      attended: s.attended + 2,
      lastAction: 'ATTENDED_LAB',
    }));

  const missedLab = (id: string) =>
    updateSubject(id, s => ({
      ...s,
      missed: s.missed + 2,
      lastAction: 'MISSED_LAB',
    }));

  const undo = (id: string) =>
    updateSubject(id, s => {
      switch (s.lastAction) {
        case 'ATTENDED':
          return { ...s, attended: Math.max(0, s.attended - 1), lastAction: undefined };
        case 'MISSED':
          return { ...s, missed: Math.max(0, s.missed - 1), lastAction: undefined };
        case 'ATTENDED_LAB':
          return { ...s, attended: Math.max(0, s.attended - 2), lastAction: undefined };
        case 'MISSED_LAB':
          return { ...s, missed: Math.max(0, s.missed - 2), lastAction: undefined };
        default:
          return s;
      }
    });

  const getAttendancePercent = (s: Subject) => {
    const total = s.attended + s.missed;
    if (total === 0) return 100;
    return Math.round((s.attended / total) * 100);
  };

  const classesCanSkip = (s: Subject, minPercent: number) => {
    let attended = s.attended;
    let missed = s.missed;

    while (true) {
      const total = attended + missed + 1;
      const percent = (attended / total) * 100;
      if (percent < minPercent) break;
      missed++;
    }
    return missed - s.missed;
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 12 }}>
        Attendance
      </Text>

      {/* Add Subject */}
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
        <Pressable
          onPress={addSubject}
          style={{
            paddingHorizontal: 16,
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#000',
            borderRadius: 6,
          }}
        >
          <Text style={{ fontWeight: '600' }}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={subjects}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const percent = getAttendancePercent(item);
          const skip75 = classesCanSkip(item, 75);
          const skip50 = classesCanSkip(item, 50);

          let color = '#16a34a';
          if (percent < 75) color = '#f59e0b';
          if (percent < 50) color = '#dc2626';

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

              <Text style={{ marginTop: 4 }}>
                Attended: {item.attended} | Missed: {item.missed}
              </Text>

              <Text style={{ marginTop: 6, fontWeight: '600', color }}>
                Attendance: {percent}%
              </Text>

              <Text style={{ marginTop: 6 }}>
                Can skip <Text style={{ fontWeight: '600' }}>{skip75}</Text> classes (75%)
              </Text>

              <Text>
                Can skip <Text style={{ fontWeight: '600' }}>{skip50}</Text> classes (50%)
              </Text>

              {/* Buttons */}
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                  <Pressable
                    onPress={() => attended(item.id)}
                    style={btn('#16a34a')}
                  >
                    <Text style={{ color: '#16a34a' }}>+ Attended</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => missed(item.id)}
                    style={btn('#dc2626')}
                  >
                    <Text style={{ color: '#dc2626' }}>+ Missed</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                  <Pressable
                    onPress={() => attendedLab(item.id)}
                    style={btn('#2563eb')}
                  >
                    <Text style={{ color: '#2563eb' }}>+ Attended Lab</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => missedLab(item.id)}
                    style={btn('#7c2d12')}
                  >
                    <Text style={{ color: '#7c2d12' }}>+ Missed Lab</Text>
                  </Pressable>
                </View>

                {item.lastAction && (
                  <Pressable
                    onPress={() => undo(item.id)}
                    style={{
                      padding: 10,
                      borderWidth: 1,
                      borderColor: '#000',
                      borderRadius: 6,
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ textAlign: 'center', fontWeight: '600' }}>
                      Undo last action
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const btn = (color: string) => ({
  flex: 1,
  padding: 10,
  borderWidth: 1,
  borderColor: color,
  borderRadius: 6,
  marginRight: 6,
  alignItems: 'center',
});
