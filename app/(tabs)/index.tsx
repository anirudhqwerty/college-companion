import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  Modal,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';

type Action =
  | 'ATTENDED'
  | 'MISSED'
  | 'ATTENDED_LAB'
  | 'MISSED_LAB';

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

  const triggerHaptic = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

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

  const addSubject = async () => {
    if (!subjectName.trim() || !userId) return;
    
    triggerHaptic();

    const newSubjectPayload = {
      user_id: userId,
      name: subjectName,
      attended: 0,
      missed: 0,
      history: [],
    };

    const { data, error } = await supabase
      .from('attendance_subjects')
      .insert(newSubjectPayload)
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (data) {
      setSubjects(prev => [...prev, data]);
      setSubjectName('');
    }
  };

  const removeSubject = (id: string) => {
    setMenuFor(null);
    
    Alert.alert('Delete Subject?', 'This is permanent.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          triggerHaptic();
          const previousSubjects = [...subjects];
          setSubjects(prev => prev.filter(s => s.id !== id));

          const { error } = await supabase
            .from('attendance_subjects')
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

  const updateSubject = async (id: string, fn: (s: Subject) => Subject) => {
    triggerHaptic();
    
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;

    const newSubject = fn(subject);

    setSubjects(prev => prev.map(s => (s.id === id ? newSubject : s)));

    const { error } = await supabase
      .from('attendance_subjects')
      .update({
        attended: newSubject.attended,
        missed: newSubject.missed,
        history: newSubject.history,
      })
      .eq('id', id);

    if (error) {
      console.error('sync failed:', error);
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

  const percent = (s: Subject) => {
    const total = s.attended + s.missed;
    if (total === 0) return 100;
    return Math.round((s.attended / total) * 100);
  };

  const getBunkable = (attended: number, missed: number, target: number) => {
    const total = attended + missed;
    if (total === 0) return 10; 
    
    const maxTotal = (attended * 100) / target;
    const bunkable = Math.floor(maxTotal - total);
    
    return Math.max(0, bunkable);
  };

  if (loading) {
     return (
       <View style={styles.loadingContainer}>
         <ActivityIndicator size="large" color="#000" />
       </View>
     );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* RESTORED HEADER SECTION */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
        <Text style={styles.headerSubtitle}>Track your classes efficiently</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Enter subject name..."
          placeholderTextColor="#999"
          value={subjectName}
          onChangeText={setSubjectName}
          style={styles.input}
        />
        <Pressable 
          onPress={addSubject} 
          style={({pressed}) => [styles.addButton, pressed && {opacity: 0.8}]}
        >
          <Image 
            source={{uri: 'https://img.icons8.com/ios-glyphs/30/ffffff/plus-math.png'}} 
            style={{width: 20, height: 20}} 
          />
        </Pressable>
      </View>

      <FlatList
        data={subjects}
        keyExtractor={i => i.id}
        contentContainerStyle={{paddingBottom: 40}}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const p = percent(item);
          const bunk75 = getBunkable(item.attended, item.missed, 75);
          const bunk50 = getBunkable(item.attended, item.missed, 50);
          
          let color = '#22c55e';
          if (p < 75) color = '#f59e0b';
          if (p < 50) color = '#ef4444';

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.subjectName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Pressable 
                  onPress={() => {
                    triggerHaptic();
                    setMenuFor(item.id);
                  }}
                  style={{padding: 4}}
                >
                  <Image 
                    source={{uri: 'https://img.icons8.com/ios-glyphs/30/999999/menu-2.png'}} 
                    style={{width: 20, height: 20}} 
                  />
                </Pressable>
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.percentageRow}>
                  <Text style={[styles.percentageText, { color }]}>{p}%</Text>
                  
                  <View style={{marginLeft: 16}}>
                     <Text style={styles.counterText}>
                       Present: <Text style={{fontWeight: '700', color: '#000'}}>{item.attended}</Text>
                     </Text>
                     <Text style={styles.counterText}>
                       Absent: <Text style={{fontWeight: '700', color: '#000'}}>{item.missed}</Text>
                     </Text>
                  </View>
                </View>
                
                <View style={styles.progressBarBackground}>
                  <View style={[
                    styles.progressBarFill, 
                    { width: `${Math.max(5, p)}%`, backgroundColor: color }
                  ]} />
                </View>
                
                <View style={styles.bunkContainer}>
                  <Text style={styles.bunkText}>
                    You can bunk <Text style={styles.bunkValue}>{bunk75}</Text> for 75%
                  </Text>
                  <Text style={styles.bunkText}>
                    You can bunk <Text style={styles.bunkValue}>{bunk50}</Text> for 50%
                  </Text>
                </View>
              </View>

              <View style={styles.quickActions}>
                <Pressable 
                  style={[styles.quickBtn, {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'}]}
                  onPress={() => updateSubject(item.id, s => push(s, 'ATTENDED', 1))}
                >
                   <Image 
                     source={{uri: 'https://img.icons8.com/ios-filled/50/16a34a/checked-checkbox.png'}} 
                     style={{width: 20, height: 20, marginRight: 6}} 
                   />
                   <Text style={{color: '#16a34a', fontWeight: '600'}}>Present</Text>
                </Pressable>

                <Pressable 
                  style={[styles.quickBtn, {backgroundColor: '#fef2f2', borderColor: '#fecaca'}]}
                  onPress={() => updateSubject(item.id, s => push(s, 'MISSED', 0, 1))}
                >
                   <Image 
                     source={{uri: 'https://img.icons8.com/ios-filled/50/dc2626/multiply.png'}} 
                     style={{width: 20, height: 20, marginRight: 6}} 
                   />
                   <Text style={{color: '#dc2626', fontWeight: '600'}}>Absent</Text>
                </Pressable>
              </View>

              <Modal
                transparent
                visible={menuFor === item.id}
                animationType="fade"
              >
                <Pressable
                  style={styles.modalOverlay}
                  onPress={() => setMenuFor(null)}
                >
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{item.name} Options</Text>
                    
                    <Text style={styles.modalSectionTitle}>Labs (+2 hours)</Text>
                    <View style={styles.modalRow}>
                      <MenuButton 
                         label="Lab Present" 
                         icon="https://img.icons8.com/ios/50/000000/test-tube.png"
                         onPress={() => updateSubject(item.id, s => push(s, 'ATTENDED_LAB', 2))}
                      />
                      <MenuButton 
                         label="Lab Absent" 
                         icon="https://img.icons8.com/ios/50/000000/empty-test-tube.png"
                         onPress={() => updateSubject(item.id, s => push(s, 'MISSED_LAB', 0, 2))}
                      />
                    </View>

                    <View style={styles.divider} />

                    <MenuRowItem 
                      label="Undo last action"
                      icon="https://img.icons8.com/ios/50/000000/undo.png"
                      disabled={item.history.length === 0}
                      onPress={() => updateSubject(item.id, s => pop(s))}
                    />
                    
                    <MenuRowItem 
                      label="Delete Subject"
                      icon="https://img.icons8.com/ios/50/dc2626/trash.png"
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
    </KeyboardAvoidingView>
  );
}

const MenuButton = ({ label, icon, onPress }: any) => (
  <Pressable style={styles.menuGridItem} onPress={onPress}>
    <View style={styles.menuGridIconBox}>
      <Image source={{uri: icon}} style={{width: 24, height: 24}} />
    </View>
    <Text style={styles.menuGridText}>{label}</Text>
  </Pressable>
);

const MenuRowItem = ({ label, icon, onPress, danger, disabled }: any) => (
  <Pressable 
    style={[styles.menuRowItem, disabled && {opacity: 0.5}]} 
    onPress={onPress}
    disabled={disabled}
  >
    <Image source={{uri: icon}} style={{width: 20, height: 20, marginRight: 12}} />
    <Text style={[styles.menuRowText, danger && {color: '#dc2626'}]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
  
  // Header is back!
  header: { marginBottom: 24, marginTop: 40 }, 
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#111' },
  headerSubtitle: { fontSize: 16, color: '#666', marginTop: 4 },

  inputContainer: { flexDirection: 'row', marginBottom: 24, alignItems: 'center' },
  input: { 
    flex: 1, 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 16, 
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  addButton: {
    backgroundColor: '#000',
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4
  },

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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  subjectName: { fontSize: 20, fontWeight: '700', color: '#1f2937', flex: 1 },
  
  statsContainer: { marginBottom: 20 },
  percentageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  percentageText: { fontSize: 36, fontWeight: '800', marginRight: 0 },
  
  progressBarBackground: { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, marginBottom: 16, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  
  countersRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  counterText: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  
  bunkContainer: { gap: 4 },
  bunkText: { fontSize: 14, color: '#4b5563' },
  bunkValue: { fontWeight: '700', color: '#000' },

  quickActions: { flexDirection: 'row', gap: 12 },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  modalSectionTitle: { fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', marginBottom: 12 },
  
  modalRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  menuGridItem: { flex: 1, alignItems: 'center', padding: 16, backgroundColor: '#f8f9fa', borderRadius: 16 },
  menuGridIconBox: { marginBottom: 8 },
  menuGridText: { fontSize: 13, fontWeight: '600', color: '#333' },
  
  divider: { height: 1, backgroundColor: '#eee', marginBottom: 16 },
  
  menuRowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  menuRowText: { fontSize: 16, fontWeight: '500', color: '#333' }
});