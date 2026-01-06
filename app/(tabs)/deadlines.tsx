import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Platform,
  ScrollView,
  RefreshControl,
  StyleSheet,
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons'; // using Feather vectors
import { supabase } from '../../lib/supabase';

// standard deadline type
type Deadline = {
  id: string;
  title: string;
  subject?: string;
  dueAt: number; // storing as number makes sorting way easier
  is_completed?: boolean;
};

export default function DeadlinesScreen() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [history, setHistory] = useState<Deadline[]>([]);
  
  // modal and menu states
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // form inputs
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // helper for haptics
  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // getting data from supabase
  const fetchDeadlines = useCallback(async (uid: string) => {
    try {
      // 1. get active stuff
      const { data: activeData, error: activeError } = await supabase
        .from('deadlines')
        .select('*')
        .eq('is_completed', false)
        .order('due_at', { ascending: true });

      if (activeError) throw activeError;

      // 2. get recently completed stuff
      const { data: historyData, error: historyError } = await supabase
        .from('deadlines')
        .select('*')
        .eq('is_completed', true)
        .order('completed_at', { ascending: false })
        .limit(5);

      if (historyError) throw historyError;

      // transforming db snake_case to our camelCase
      if (activeData) {
        setDeadlines(
          activeData.map((d: any) => ({
            id: d.id,
            title: d.title,
            subject: d.subject,
            dueAt: new Date(d.due_at).getTime(),
          }))
        );
      }

      if (historyData) {
        setHistory(
          historyData.map((d: any) => ({
            id: d.id,
            title: d.title,
            subject: d.subject,
            dueAt: new Date(d.due_at).getTime(),
            is_completed: true,
          }))
        );
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not load deadlines');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // initial load
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchDeadlines(user.id);
      } else {
        setLoading(false);
      }
    });
  }, [fetchDeadlines]);

  // pull to refresh logic
  const onRefresh = () => {
    if (userId) {
      setRefreshing(true);
      fetchDeadlines(userId);
    }
  };

  // opening the add form
  const openAdd = () => {
    triggerHaptic(); 
    setEditing(null);
    setTitle('');
    setSubject('');
    setDueDate(null);
    setShowForm(true);
  };

  // opening the edit form
  const openEdit = (d: Deadline) => {
    triggerHaptic();
    setEditing(d);
    setTitle(d.title);
    setSubject(d.subject ?? '');
    setDueDate(new Date(d.dueAt));
    setMenuFor(null);
    setShowForm(true);
  };

  // saving (creates new or updates existing)
  const saveDeadline = async () => {
    if (!title.trim() || !dueDate || !userId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Missing Info', 'Please give it a title and a due date.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowForm(false);

    const payload = {
      user_id: userId,
      title,
      subject: subject.trim() || null,
      due_at: dueDate.toISOString(),
      is_completed: false,
    };

    if (editing) {
      // optimistic update
      setDeadlines(prev =>
        prev.map(d =>
          d.id === editing.id
            ? { ...d, title, subject: subject.trim() || undefined, dueAt: dueDate.getTime() }
            : d
        )
      );

      // db update
      const { error } = await supabase
        .from('deadlines')
        .update(payload)
        .eq('id', editing.id);

      if (error) Alert.alert('Save Error', error.message);
    } else {
      // db insert
      const { data, error } = await supabase
        .from('deadlines')
        .insert(payload)
        .select()
        .single();

      if (data) {
        setDeadlines(prev => [
          ...prev,
          {
            id: data.id,
            title: data.title,
            subject: data.subject,
            dueAt: new Date(data.due_at).getTime(),
          },
        ]);
      } else if (error) {
        Alert.alert('Save Error', error.message);
      }
    }
    setEditing(null);
  };

  // deleting an item forever
  const deleteDeadline = async (id: string) => {
    triggerHaptic();
    
    Alert.alert('Delete Task?', 'This is permanent.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeadlines(prev => prev.filter(d => d.id !== id));
          setHistory(prev => prev.filter(d => d.id !== id));
          
          const { error } = await supabase.from('deadlines').delete().eq('id', id);
          if (error) Alert.alert('Error', 'Could not delete item');
        },
      },
    ]);
    setMenuFor(null);
  };

  // New confirmation wrapper before marking complete
  const confirmCompletion = (item: Deadline) => {
    triggerHaptic();
    Alert.alert(
        "Complete Task",
        "Are you sure you want to mark this as completed?",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Yes, Complete", 
                onPress: () => completeDeadline(item) 
            }
        ]
    );
  };

  // marking as done
  const completeDeadline = async (item: Deadline) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // move from active list to history list locally
    setDeadlines(prev => prev.filter(d => d.id !== item.id));
    setHistory(prev => {
      const updated = [{ ...item, is_completed: true }, ...prev];
      return updated.slice(0, 5);
    });
    setMenuFor(null);

    // update db
    const { error } = await supabase
      .from('deadlines')
      .update({ 
        is_completed: true, 
        completed_at: new Date().toISOString() 
      })
      .eq('id', item.id);

    if (error) Alert.alert('Error', 'Could not mark complete');
  };

  // date picker handler
  // handles the flow: pick date -> pick time -> close
  const onPick = (_: any, selected?: Date) => {
    if (!selected) {
      setShowPicker(false);
      return;
    }

    Haptics.selectionAsync();

    if (pickerMode === 'date') {
      const base = dueDate ?? new Date();
      base.setFullYear(selected.getFullYear());
      base.setMonth(selected.getMonth());
      base.setDate(selected.getDate());
      
      setDueDate(new Date(base));
      // now switch to time picker
      setPickerMode('time');
      
      if (Platform.OS === 'android') {
         setShowPicker(false);
         setTimeout(() => setShowPicker(true), 100);
      }
    } else {
      const base = dueDate ?? new Date();
      base.setHours(selected.getHours());
      base.setMinutes(selected.getMinutes());
      
      setDueDate(new Date(base));
      setShowPicker(false);
    }
  };

  // logic for grouping deadlines
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const endOfTomorrow = new Date(startOfTomorrow);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  const sortByDate = (a: Deadline, b: Deadline) => a.dueAt - b.dueAt;

  const today = deadlines
    .filter(d => d.dueAt >= startOfToday.getTime() && d.dueAt < startOfTomorrow.getTime())
    .sort(sortByDate);
    
  const tomorrow = deadlines
    .filter(d => d.dueAt >= startOfTomorrow.getTime() && d.dueAt < endOfTomorrow.getTime())
    .sort(sortByDate);

  const upcoming = deadlines
    .filter(d => d.dueAt >= endOfTomorrow.getTime())
    .sort(sortByDate);
  
  const overdue = deadlines
    .filter(d => d.dueAt < startOfToday.getTime())
    .sort(sortByDate);

  // formatting the date nicely for the card
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
     return (
       <View style={styles.loadingContainer}>
         <ActivityIndicator size="large" color="#000" />
       </View>
     );
  }

  // card component for individual tasks
  const DeadlineCard = ({ item, isHistory, urgencyColor }: { item: Deadline, isHistory?: boolean, urgencyColor: string }) => (
    <View style={styles.card}>
      {/* Removed the urgencyStrip (sideline) as requested */}
      
      <View style={styles.cardContent}>
        <View style={styles.row}>
           <View style={{flex: 1}}>
              <Text style={[styles.cardTitle, isHistory && styles.strikethrough]}>
                {item.title}
              </Text>
              {item.subject && (
                 <View style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>{item.subject}</Text>
                 </View>
              )}
           </View>
           
           {/* quick complete button with confirmation */}
           {!isHistory && (
             <Pressable 
               style={({pressed}) => [styles.checkButton, pressed && {opacity: 0.5}]}
               onPress={() => confirmCompletion(item)}
             >
                {/* Replaced Image with Vector Icon */}
                <Feather name="circle" size={24} color="#ccc" />
             </Pressable>
           )}
           {isHistory && (
               <Feather name="check-circle" size={24} color="#d1d5db" />
           )}
        </View>
        
        <View style={styles.footerRow}>
           <View style={styles.dateContainer}>
              {/* Replaced Image with Vector Icon */}
              <Feather 
                name="clock" 
                size={14} 
                color={isHistory ? '#999' : urgencyColor} 
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.dateText, !isHistory && { color: urgencyColor }]}>
                 {isHistory ? 'Completed' : formatTime(item.dueAt)}
              </Text>
           </View>

           {!isHistory && (
             <Pressable 
                onPress={() => {
                  triggerHaptic();
                  setMenuFor(item.id);
                }}
                style={styles.menuTrigger}
             >
                {/* Replaced Image with Vector Icon */}
                <Feather name="more-horizontal" size={20} color="#999" />
             </Pressable>
           )}
        </View>
      </View>

      {/* 3-dot menu modal */}
      {!isHistory && (
        <Modal transparent visible={menuFor === item.id} animationType="fade">
          <Pressable
            style={styles.menuOverlay}
            onPress={() => setMenuFor(null)}
          >
            <View style={styles.menuContent}>
              <MenuItem 
                 label="Edit Task" 
                 iconName="edit-2"
                 onPress={() => openEdit(item)} 
              />
              <View style={styles.divider} />
              <MenuItem 
                 label="Delete Task" 
                 iconName="trash-2"
                 danger 
                 onPress={() => deleteDeadline(item.id)} 
              />
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );

  // New helper for section headers to replace emojis
  const SectionHeader = ({ title, iconName, color }: { title: string, iconName: keyof typeof Feather.glyphMap, color: string }) => (
      <View style={styles.sectionHeaderContainer}>
          <Feather name={iconName} size={18} color={color} style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>{title}</Text>
      </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deadlines</Text>
        <Text style={styles.headerSubtitle}>Stay on top of your work</Text>
      </View>

      <Pressable 
        onPress={openAdd} 
        style={({pressed}) => [styles.addBtn, pressed && {opacity: 0.7}]}
      >
        <Text style={styles.addBtnText}>Add New Task</Text>
        <View style={styles.plusIcon}>
           {/* Replaced Image with Vector Icon */}
           <Feather name="plus" size={20} color="#fff" />
        </View>
      </Pressable>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 40}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Replaced Emojis with Vectors in Sections */}
        {overdue.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Overdue" iconName="alert-circle" color="#ef4444" />
            {overdue.map(d => <DeadlineCard key={d.id} item={d} urgencyColor="#ef4444" />)}
          </View>
        )}

        {today.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Today" iconName="sun" color="#f59e0b" />
            {today.map(d => <DeadlineCard key={d.id} item={d} urgencyColor="#f59e0b" />)}
          </View>
        )}

        {tomorrow.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Tomorrow" iconName="coffee" color="#3b82f6" />
            {tomorrow.map(d => <DeadlineCard key={d.id} item={d} urgencyColor="#3b82f6" />)}
          </View>
        )}

        {upcoming.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Upcoming" iconName="calendar" color="#22c55e" />
            {upcoming.map(d => <DeadlineCard key={d.id} item={d} urgencyColor="#22c55e" />)}
          </View>
        )}
        
        {history.length > 0 && (
          <View style={styles.section}>
             <View style={styles.divider} />
             <View style={[styles.sectionHeaderContainer, { marginTop: 15 }]}>
                <Feather name="archive" size={16} color="#999" style={{ marginRight: 8 }} />
                <Text style={[styles.sectionTitle, {color: '#999', marginBottom: 0}]}>History</Text>
             </View>
             {history.map(d => <DeadlineCard key={d.id} item={d} isHistory urgencyColor="#d1d5db" />)}
          </View>
        )}

        {deadlines.length === 0 && history.length === 0 && !loading && (
           <View style={styles.emptyState}>
             {/* Replaced Emoji Text with Vector */}
             <Feather name="inbox" size={64} color="#e5e7eb" style={{ marginBottom: 16 }} />
             <Text style={styles.emptyText}>No deadlines pending.</Text>
             <Text style={styles.emptySubText}>Enjoy your free time!</Text>
           </View>
        )}
      </ScrollView>

      {/* Add / Edit Form Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Task' : 'New Task'}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>What needs to be done?</Text>
              <TextInput
                placeholder="e.g. Submit Lab Report"
                placeholderTextColor="#999"
                value={title}
                onChangeText={setTitle}
                style={styles.input}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Subject (Optional)</Text>
              <TextInput
                placeholder="e.g. Physics"
                placeholderTextColor="#999"
                value={subject}
                onChangeText={setSubject}
                style={styles.input}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Due Date</Text>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setPickerMode('date');
                  setShowPicker(true);
                }}
                style={styles.dateBtn}
              >
                {/* Replaced Image with Vector Icon */}
                <Feather name="calendar" size={20} color="#000" style={{ marginRight: 10 }} />
                <Text style={styles.dateBtnText}>
                   {dueDate ? formatTime(dueDate.getTime()) : 'Pick Date & Time'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable 
                 onPress={() => setShowForm(false)} 
                 style={[styles.modalBtn, styles.cancelBtn]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable onPress={saveDeadline} style={[styles.modalBtn, styles.saveBtn]}>
                <Text style={styles.saveText}>Save Task</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Date Picker Component */}
      {showPicker && (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onPick}
          accentColor="black"
        />
      )}
    </View>
  );
}

// simple menu item helper with Vectors
const MenuItem = ({ label, iconName, onPress, danger }: any) => (
  <Pressable onPress={onPress} style={styles.menuItem}>
    <Feather name={iconName} size={18} color={danger ? '#dc2626' : '#333'} style={{ marginRight: 12 }} />
    <Text style={[styles.menuText, danger && { color: '#dc2626' }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
  
  header: { marginBottom: 24, marginTop: 40 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#111' },
  headerSubtitle: { fontSize: 16, color: '#666', marginTop: 4 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    // Slightly reduced shadow for a cleaner look
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  addBtnText: { fontSize: 16, fontWeight: '600', color: '#333' },
  plusIcon: {
    backgroundColor: '#000',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },

  section: { marginBottom: 24 },
  sectionHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  
  // card styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    // Removed border width for a cleaner, floating look
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 3,
    paddingVertical: 4
  },
  // urgencyStrip removed entirely
  cardContent: { flex: 1, padding: 16, paddingLeft: 20 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#111', marginBottom: 6 },
  strikethrough: { textDecorationLine: 'line-through', color: '#d1d5db' },
  
  subjectBadge: { backgroundColor: '#f3f4f6', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  subjectText: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
  
  checkButton: { padding: 4 },
  
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  dateContainer: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 13, fontWeight: '600' }, // color is now dynamic
  menuTrigger: { padding: 4 },

  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptySubText: { fontSize: 14, color: '#9ca3af', marginTop: 4 },

  // modal styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20, color: '#111' },
  
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    borderRadius: 14,
    fontSize: 16,
    color: '#000'
  },
  dateBtn: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center'
  },
  dateBtnText: { fontSize: 16, color: '#000', fontWeight: '500' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  modalBtn: { flex: 1, padding: 18, borderRadius: 14, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f3f4f6' },
  saveBtn: { backgroundColor: '#000' },
  cancelText: { color: '#666', fontWeight: '700', fontSize: 16 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // menu modal
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', padding: 40 },
  menuContent: { backgroundColor: '#fff', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 30 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12 },
  menuText: { fontSize: 16, fontWeight: '600', color: '#333' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 2 },
});