import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';

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
  
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---------- Load Data ---------- */
  
  useEffect(() => {
    const init = async () => {
      // 1. Get User
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      // 2. Fetch Data
      const { data, error } = await supabase
        .from('marks_subjects')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) Alert.alert('Error', error.message);
      if (data) setSubjects(data);
      
      setLoading(false);
    };
    init();
  }, []);

  /* ---------- Helpers ---------- */

  const totalStats = (s: Subject) => {
    const obtainedSum = s.components.reduce((a, c) => a + c.obtained, 0);
    const totalSum = s.components.reduce((a, c) => a + c.total, 0);
    const percent =
      totalSum === 0 ? 0 : Math.round((obtainedSum / totalSum) * 100);
    return { obtainedSum, totalSum, percent };
  };

  /* ---------- Subject Actions ---------- */

  const addSubject = async () => {
    if (!subjectName.trim() || !userId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSubjectModal(false); // Close immediately

    // 1. Supabase Insert
    const { data, error } = await supabase
      .from('marks_subjects')
      .insert({
        user_id: userId,
        name: subjectName,
        components: []
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    // 2. Update Local State
    if (data) {
      setSubjects(prev => [...prev, data]);
      setSubjectName('');
    }
  };

  const deleteSubject = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    Alert.alert('Delete subject?', 'All marks will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // Optimistic Delete
          const previousSubjects = [...subjects];
          setSubjects(prev => prev.filter(s => s.id !== id));

          // Supabase Delete
          const { error } = await supabase
            .from('marks_subjects')
            .delete()
            .eq('id', id);

          if (error) {
            Alert.alert('Error', 'Could not delete subject');
            setSubjects(previousSubjects);
          }
        },
      },
    ]);
  };

  /* ---------- Component Actions ---------- */

  const addComponent = async () => {
    if (!activeSubject || !compTitle.trim()) return;

    const o = Number(obtained);
    const t = Number(total);
    if (isNaN(o) || isNaN(t) || t <= 0 || o < 0 || o > t) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowComponentModal(false);

    // 1. Create new component object
    const newComponent: MarkComponent = {
      id: Date.now().toString(), // Local ID is fine inside JSON
      title: compTitle,
      obtained: o,
      total: t,
    };

    // 2. Calculate updated list of components for this subject
    const updatedComponents = [...activeSubject.components, newComponent];

    // 3. Optimistic Update (UI)
    setSubjects(prev =>
      prev.map(s =>
        s.id === activeSubject.id
          ? { ...s, components: updatedComponents }
          : s
      )
    );

    // 4. Supabase Update (Save the array)
    const { error } = await supabase
      .from('marks_subjects')
      .update({ components: updatedComponents })
      .eq('id', activeSubject.id);

    if (error) Alert.alert('Error', 'Could not save marks');

    // Reset Form
    setCompTitle('');
    setObtained('');
    setTotal('');
    setActiveSubject(null);
  };

  const deleteComponent = async (sid: string, cid: string) => {
    Haptics.selectionAsync();

    const subject = subjects.find(s => s.id === sid);
    if(!subject) return;

    // 1. Calculate new array
    const updatedComponents = subject.components.filter(c => c.id !== cid);

    // 2. Optimistic Update
    setSubjects(prev =>
      prev.map(s =>
        s.id === sid
          ? { ...s, components: updatedComponents }
          : s
      )
    );

    // 3. Supabase Update
    const { error } = await supabase
      .from('marks_subjects')
      .update({ components: updatedComponents })
      .eq('id', sid);

    if (error) Alert.alert('Error', 'Could not remove mark');
  };

  /* ---------- UI ---------- */

  if (loading) return <View style={styles.container} />;

  return (
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
    paddingTop: 60, 
    backgroundColor: '#fff', 
  },
  modalContainer: {
    flex: 1,
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
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