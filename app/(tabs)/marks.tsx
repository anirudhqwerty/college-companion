import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

/* ---------- Types ---------- */

type MarkComponent = {
  id: string;
  title: string;
  obtained: number;
  total: number;
};

type Subject = {
  id: string;
  name: string;
  components: MarkComponent[];
};

const STORAGE_KEY = 'marks_subjects';

/* ---------- Screen ---------- */

export default function MarksScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showComponentModal, setShowComponentModal] = useState(false);

  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);

  const [subjectName, setSubjectName] = useState('');

  const [compTitle, setCompTitle] = useState('');
  const [obtained, setObtained] = useState('');
  const [total, setTotal] = useState('');

  /* ---------- Load / Save ---------- */

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setSubjects(JSON.parse(saved));
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
  }, [subjects]);

  /* ---------- Helpers ---------- */

  const totalStats = (s: Subject) => {
    const obtainedSum = s.components.reduce((a, c) => a + c.obtained, 0);
    const totalSum = s.components.reduce((a, c) => a + c.total, 0);
    const percent =
      totalSum === 0 ? 0 : Math.round((obtainedSum / totalSum) * 100);
    return { obtainedSum, totalSum, percent };
  };

  /* ---------- Subject Actions ---------- */

  const addSubject = () => {
    if (!subjectName.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSubjects(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: subjectName,
        components: [],
      },
    ]);

    setSubjectName('');
    setShowSubjectModal(false);
  };

  const deleteSubject = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    Alert.alert('Delete subject?', 'All marks will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          setSubjects(prev => prev.filter(s => s.id !== id)),
      },
    ]);
  };

  /* ---------- Component Actions ---------- */

  const addComponent = () => {
    if (!activeSubject || !compTitle.trim()) return;

    const o = Number(obtained);
    const t = Number(total);
    if (isNaN(o) || isNaN(t) || t <= 0 || o < 0 || o > t) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setSubjects(prev =>
      prev.map(s =>
        s.id === activeSubject.id
          ? {
              ...s,
              components: [
                ...s.components,
                {
                  id: Date.now().toString(),
                  title: compTitle,
                  obtained: o,
                  total: t,
                },
              ],
            }
          : s
      )
    );

    setCompTitle('');
    setObtained('');
    setTotal('');
    setShowComponentModal(false);
    setActiveSubject(null);
  };

  const deleteComponent = (sid: string, cid: string) => {
    Haptics.selectionAsync();
    setSubjects(prev =>
      prev.map(s =>
        s.id === sid
          ? {
              ...s,
              components: s.components.filter(c => c.id !== cid),
            }
          : s
      )
    );
  };

  /* ---------- UI ---------- */

  return (
    // FIXED: Added backgroundColor: '#fff' here
    <View style={styles.container}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 12 }}>
        Marks
      </Text>

      <Pressable
        onPress={() => setShowSubjectModal(true)}
        style={styles.addBtn}
      >
        <Text style={{ textAlign: 'center', fontWeight: '600' }}>
          + Add Subject
        </Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false}>
        {subjects.map(s => {
          const { obtainedSum, totalSum, percent } = totalStats(s);

          return (
            <View key={s.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={{ fontSize: 18, fontWeight: '600' }}>
                  {s.name}
                </Text>

                <Pressable onPress={() => deleteSubject(s.id)}>
                  <Text style={{ fontSize: 18 }}>🗑</Text>
                </Pressable>
              </View>

              <Text style={{ marginBottom: 6 }}>
                Total: {obtainedSum} / {totalSum} ({percent}%)
              </Text>

              {s.components.map(c => (
                <View key={c.id} style={styles.subRow}>
                  <Text>
                    {c.title}: {c.obtained}/{c.total}
                  </Text>
                  <Pressable
                    onPress={() => deleteComponent(s.id, c.id)}
                  >
                    <Text>✕</Text>
                  </Pressable>
                </View>
              ))}

              <Pressable
                onPress={() => {
                  setActiveSubject(s);
                  setShowComponentModal(true);
                }}
                style={styles.miniBtn}
              >
                <Text>+ Add Marks</Text>
              </Pressable>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Subject */}
      <Modal visible={showSubjectModal} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>
            Add Subject
          </Text>

          <TextInput
            placeholder="Subject name"
            value={subjectName}
            onChangeText={setSubjectName}
            style={styles.input}
            autoFocus
          />

          <Pressable onPress={addSubject} style={styles.primaryBtn}>
            <Text style={styles.btnText}>Save</Text>
          </Pressable>

          <Pressable
            onPress={() => setShowSubjectModal(false)}
            style={styles.secondaryBtn}
          >
            <Text style={{ textAlign: 'center' }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Add Component */}
      <Modal visible={showComponentModal} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>
            Add Marks
          </Text>

          <TextInput
            placeholder="Component name (CT / MST / Lab)"
            value={compTitle}
            onChangeText={setCompTitle}
            style={styles.input}
            autoFocus
          />

          <TextInput
            placeholder="Marks obtained"
            value={obtained}
            onChangeText={setObtained}
            keyboardType="numeric"
            style={styles.input}
          />

          <TextInput
            placeholder="Total marks"
            value={total}
            onChangeText={setTotal}
            keyboardType="numeric"
            style={styles.input}
          />

          <Pressable onPress={addComponent} style={styles.primaryBtn}>
            <Text style={styles.btnText}>Save</Text>
          </Pressable>

          <Pressable
            onPress={() => setShowComponentModal(false)}
            style={styles.secondaryBtn}
          >
            <Text style={{ textAlign: 'center' }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 60, // Added padding top for notches
    backgroundColor: '#fff', // <--- THIS FIXED THE BLACK SCREEN
  },
  modalContainer: {
    flex: 1,
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff', // Ensure modal is white too
  },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    fontSize: 16,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: '#000',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
  },
  miniBtn: {
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 6,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: '#000',
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  secondaryBtn: {
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
});