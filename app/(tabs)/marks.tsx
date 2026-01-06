import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';

// defining what a single mark looks like (e.g. midterm: 18/20)
type MarkComponent = {
  id: string;
  title: string;
  obtained: number;
  total: number;
};

// defining the subject which holds a list of marks
type Subject = {
  id: string;
  name: string;
  components: MarkComponent[];
};

export default function MarksScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // modal visibility states
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);

  // form inputs
  const [subjectName, setSubjectName] = useState('');
  const [compTitle, setCompTitle] = useState('');
  const [obtained, setObtained] = useState('');
  const [total, setTotal] = useState('');
  
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // little vibration helper
  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // getting the data when the screen loads
  useEffect(() => {
    const init = async () => {
      // getting the logged in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      // fetching their subjects
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

  // calculating the total grade for a subject
  const totalStats = (s: Subject) => {
    const obtainedSum = s.components.reduce((a, c) => a + c.obtained, 0);
    const totalSum = s.components.reduce((a, c) => a + c.total, 0);
    
    // avoid dividing by zero if no marks exist yet
    const percent = totalSum === 0 ? 0 : Math.round((obtainedSum / totalSum) * 100);
    return { obtainedSum, totalSum, percent };
  };

  // adding a brand new subject
  const addSubject = async () => {
    if (!subjectName.trim() || !userId) return;

    triggerHaptic();
    setShowSubjectModal(false);

    // saving to supabase
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

    // updating the ui immediately
    if (data) {
      setSubjects(prev => [...prev, data]);
      setSubjectName('');
    }
  };

  // deleting a subject and all its marks
  const deleteSubject = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    Alert.alert('Delete Subject?', 'All marks for this subject will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const previousSubjects = [...subjects];
          setSubjects(prev => prev.filter(s => s.id !== id));

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

  // adding a specific mark (like a quiz or lab)
  const addComponent = async () => {
    if (!activeSubject || !compTitle.trim()) return;

    const o = Number(obtained);
    const t = Number(total);
    
    // basic validation
    if (isNaN(o) || isNaN(t) || t <= 0 || o < 0) {
      Alert.alert('Invalid Input', 'Please enter valid positive numbers.');
      return;
    }
    if (o > t) {
      Alert.alert('Hold up', 'Obtained marks cannot be higher than total marks.');
      return;
    }

    triggerHaptic();
    setShowComponentModal(false);

    // creating the new mark object
    const newComponent: MarkComponent = {
      id: Date.now().toString(),
      title: compTitle,
      obtained: o,
      total: t,
    };

    const updatedComponents = [...activeSubject.components, newComponent];

    // optimistic ui update
    setSubjects(prev =>
      prev.map(s =>
        s.id === activeSubject.id
          ? { ...s, components: updatedComponents }
          : s
      )
    );

    // saving to db
    const { error } = await supabase
      .from('marks_subjects')
      .update({ components: updatedComponents })
      .eq('id', activeSubject.id);

    if (error) Alert.alert('Error', 'Could not save marks');

    // cleanup forms
    setCompTitle('');
    setObtained('');
    setTotal('');
    setActiveSubject(null);
  };

  // removing a specific mark
  const deleteComponent = async (sid: string, cid: string) => {
    triggerHaptic();

    const subject = subjects.find(s => s.id === sid);
    if(!subject) return;

    const updatedComponents = subject.components.filter(c => c.id !== cid);

    setSubjects(prev =>
      prev.map(s =>
        s.id === sid
          ? { ...s, components: updatedComponents }
          : s
      )
    );

    const { error } = await supabase
      .from('marks_subjects')
      .update({ components: updatedComponents })
      .eq('id', sid);

    if (error) Alert.alert('Error', 'Could not remove mark');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* custom header similar to attendance screen */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marks</Text>
        <Text style={styles.headerSubtitle}>Keep track of your grades</Text>
      </View>

      {/* add subject button block */}
      <Pressable
        onPress={() => {
          triggerHaptic();
          setShowSubjectModal(true);
        }}
        style={({pressed}) => [styles.addSubjectRow, pressed && {opacity: 0.7}]}
      >
        <Text style={styles.addSubjectText}>Add New Subject</Text>
        <View style={styles.plusIcon}>
           <Image 
             source={{uri: 'https://img.icons8.com/ios-glyphs/30/ffffff/plus-math.png'}} 
             style={{width: 16, height: 16}} 
           />
        </View>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 40}}>
        {subjects.map(s => {
          const { obtainedSum, totalSum, percent } = totalStats(s);

          // color logic similar to attendance
          let gradeColor = '#22c55e'; // green
          if (percent < 75) gradeColor = '#f59e0b';
          if (percent < 50) gradeColor = '#ef4444';
          if (totalSum === 0) gradeColor = '#9ca3af'; // gray if no marks

          return (
            <View key={s.id} style={styles.card}>
              {/* card header: name and delete */}
              <View style={styles.cardHeader}>
                <Text style={styles.subjectName}>{s.name}</Text>
                <Pressable onPress={() => deleteSubject(s.id)} style={{padding: 4}}>
                  <Image 
                    source={{uri: 'https://img.icons8.com/ios/50/999999/trash.png'}} 
                    style={{width: 20, height: 20}} 
                  />
                </Pressable>
              </View>

              {/* overall grade display */}
              <View style={styles.totalContainer}>
                <Text style={[styles.totalPercent, {color: gradeColor}]}>
                  {percent}%
                </Text>
                <Text style={styles.totalFraction}>
                  {obtainedSum} / {totalSum} Total
                </Text>
              </View>

              {/* list of individual marks */}
              <View style={styles.componentsList}>
                {s.components.map(c => {
                  const compPercent = Math.round((c.obtained / c.total) * 100);
                  return (
                    <View key={c.id} style={styles.componentRow}>
                      <View style={{flex: 1}}>
                        <View style={styles.compHeader}>
                          <Text style={styles.compTitle}>{c.title}</Text>
                          <Text style={styles.compScore}>{c.obtained}/{c.total}</Text>
                        </View>
                        {/* mini progress bar for each mark */}
                        <View style={styles.miniProgressBg}>
                          <View style={[
                            styles.miniProgressFill, 
                            {width: `${compPercent}%`, backgroundColor: gradeColor}
                          ]} />
                        </View>
                      </View>
                      
                      <Pressable
                        onPress={() => deleteComponent(s.id, c.id)}
                        style={styles.deleteCompBtn}
                      >
                         <Image 
                           source={{uri: 'https://img.icons8.com/ios-glyphs/30/cccccc/multiply.png'}} 
                           style={{width: 14, height: 14}} 
                         />
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              {/* add marks button inside the card */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setActiveSubject(s);
                  setShowComponentModal(true);
                }}
                style={styles.addMarkBtn}
              >
                <Text style={styles.addMarkText}>+ Add Mark</Text>
              </Pressable>
            </View>
          );
        })}
        {subjects.length === 0 && !loading && (
           <Text style={styles.emptyText}>No subjects added yet.</Text>
        )}
      </ScrollView>

      {/* modal for creating a subject */}
      <Modal visible={showSubjectModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Subject</Text>
            
            <TextInput
              placeholder="e.g. Mathematics"
              placeholderTextColor="#999"
              value={subjectName}
              onChangeText={setSubjectName}
              style={styles.input}
              autoFocus
            />

            <View style={styles.modalActions}>
              <Pressable 
                onPress={() => setShowSubjectModal(false)} 
                style={[styles.modalBtn, styles.cancelBtn]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                onPress={addSubject} 
                style={[styles.modalBtn, styles.saveBtn]}
              >
                <Text style={styles.saveText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* modal for adding a mark */}
      <Modal visible={showComponentModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Add Marks for <Text style={{color: '#666'}}>{activeSubject?.name}</Text>
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                placeholder="e.g. Mid Term"
                placeholderTextColor="#999"
                value={compTitle}
                onChangeText={setCompTitle}
                style={styles.input}
                autoFocus
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={{flex: 1, marginRight: 8}}>
                <Text style={styles.label}>Obtained</Text>
                <TextInput
                  placeholder="0"
                  value={obtained}
                  onChangeText={setObtained}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={{flex: 1, marginLeft: 8}}>
                <Text style={styles.label}>Total</Text>
                <TextInput
                  placeholder="100"
                  value={total}
                  onChangeText={setTotal}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable 
                onPress={() => setShowComponentModal(false)} 
                style={[styles.modalBtn, styles.cancelBtn]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                onPress={addComponent} 
                style={[styles.modalBtn, styles.saveBtn]}
              >
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#f8f9fa',
  },
  
  // header
  header: { marginBottom: 24, marginTop: 40 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#111' },
  headerSubtitle: { fontSize: 16, color: '#666', marginTop: 4 },

  // add subject row
  addSubjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  addSubjectText: { fontSize: 16, fontWeight: '600', color: '#333' },
  plusIcon: {
    backgroundColor: '#000',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },

  // cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectName: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  
  // total score section
  totalContainer: {
    marginTop: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  totalPercent: { fontSize: 42, fontWeight: '800', marginRight: 10 },
  totalFraction: { fontSize: 14, color: '#6b7280', fontWeight: '500' },

  // components list
  componentsList: { marginBottom: 16, gap: 12 },
  componentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  compTitle: { fontSize: 14, color: '#374151', fontWeight: '500' },
  compScore: { fontSize: 14, color: '#111', fontWeight: '700' },
  
  miniProgressBg: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  miniProgressFill: { height: '100%', borderRadius: 3 },
  
  deleteCompBtn: { padding: 8, marginLeft: 8 },

  // internal add button
  addMarkBtn: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed'
  },
  addMarkText: { color: '#666', fontWeight: '600', fontSize: 14 },

  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },

  // modals
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(0,0,0,0.4)' 
  },
  modalContent: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 24,
    paddingBottom: 40
  },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20, color: '#111' },
  
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, textTransform: 'uppercase' },
  inputGroup: { marginBottom: 16 },
  rowInputs: { flexDirection: 'row', marginBottom: 24 },
  
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#000'
  },

  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f3f4f6' },
  saveBtn: { backgroundColor: '#000' },
  cancelText: { color: '#666', fontWeight: '600', fontSize: 16 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});