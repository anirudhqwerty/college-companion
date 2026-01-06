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
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';

/* ---------- Types ---------- */

type Deadline = {
  id: string;
  title: string;
  subject?: string;
  dueAt: number; // We keep this as number for frontend math
  is_completed?: boolean;
};

/* ---------- Screen ---------- */

export default function DeadlinesScreen() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [history, setHistory] = useState<Deadline[]>([]);
  
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ---------- Load Data ---------- */

  const fetchDeadlines = useCallback(async (uid: string) => {
    try {
      // 1. Fetch Active Deadlines
      const { data: activeData, error: activeError } = await supabase
        .from('deadlines')
        .select('*')
        .eq('is_completed', false)
        .order('due_at', { ascending: true });

      if (activeError) throw activeError;

      // 2. Fetch History (Last 5 completed)
      const { data: historyData, error: historyError } = await supabase
        .from('deadlines')
        .select('*')
        .eq('is_completed', true)
        .order('completed_at', { ascending: false })
        .limit(5);

      if (historyError) throw historyError;

      // Map DB fields to App types
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

  // Initial Load
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

  const onRefresh = () => {
    if (userId) {
      setRefreshing(true);
      fetchDeadlines(userId);
    }
  };

  /* ---------- Actions ---------- */

  const openAdd = () => {
    Haptics.selectionAsync(); 
    setEditing(null);
    setTitle('');
    setSubject('');
    setDueDate(null);
    setShowForm(true);
  };

  const openEdit = (d: Deadline) => {
    Haptics.selectionAsync();
    setEditing(d);
    setTitle(d.title);
    setSubject(d.subject ?? '');
    setDueDate(new Date(d.dueAt));
    setMenuFor(null);
    setShowForm(true);
  };

  const saveDeadline = async () => {
    if (!title.trim() || !dueDate || !userId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowForm(false); // Close immediately for speed

    const payload = {
      user_id: userId,
      title,
      subject: subject.trim() || null,
      due_at: dueDate.toISOString(),
      is_completed: false,
    };

    if (editing) {
      // Optimistic Update
      setDeadlines(prev =>
        prev.map(d =>
          d.id === editing.id
            ? { ...d, title, subject: subject.trim() || undefined, dueAt: dueDate.getTime() }
            : d
        )
      );

      // Supabase Update
      const { error } = await supabase
        .from('deadlines')
        .update(payload)
        .eq('id', editing.id);

      if (error) Alert.alert('Save Error', error.message);
    } else {
      // Supabase Insert (We wait for this one to get the real ID)
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

  const deleteDeadline = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert('Delete deadline?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // Optimistic UI
          setDeadlines(prev => prev.filter(d => d.id !== id));
          setHistory(prev => prev.filter(d => d.id !== id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // Supabase Delete
          const { error } = await supabase.from('deadlines').delete().eq('id', id);
          if (error) Alert.alert('Error', 'Could not delete item');
        },
      },
    ]);
    setMenuFor(null);
  };

  const completeDeadline = async (item: Deadline) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // 1. Optimistic UI Update
    setDeadlines(prev => prev.filter(d => d.id !== item.id));
    setHistory(prev => {
      const updated = [{ ...item, is_completed: true }, ...prev];
      return updated.slice(0, 5); // Keep local history small
    });
    setMenuFor(null);

    // 2. Supabase Update
    const { error } = await supabase
      .from('deadlines')
      .update({ 
        is_completed: true, 
        completed_at: new Date().toISOString() 
      })
      .eq('id', item.id);

    if (error) Alert.alert('Error', 'Could not mark complete');
  };

  /* ---------- Date Picker ---------- */

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
      setPickerMode('time');
      // Keep picker open for time selection if needed, or close and reopen
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

  /* ---------- Grouping ---------- */

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const endOfTomorrow = new Date(startOfTomorrow);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  // Sorting helper
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
  
  // Catch overdue items (optional: show them in Today or a separate section)
  const overdue = deadlines
    .filter(d => d.dueAt < startOfToday.getTime())
    .sort(sortByDate);

  /* ---------- UI ---------- */

  const DeadlineCard = ({ item, isHistory }: { item: Deadline, isHistory?: boolean }) => (
    <View
      key={item.id}
      style={{
        borderWidth: 1,
        borderColor: isHistory ? '#eee' : '#ddd',
        backgroundColor: isHistory ? '#f9f9f9' : '#fff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        opacity: isHistory ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ 
          fontSize: 16, 
          fontWeight: '600', 
          textDecorationLine: isHistory ? 'line-through' : 'none' 
        }}>
          {item.title}
        </Text>

        {!isHistory && (
          <Pressable onPress={() => {
             Haptics.selectionAsync();
             setMenuFor(item.id);
          }}>
            <Text style={{ fontSize: 22, paddingHorizontal: 4 }}>⋮</Text>
          </Pressable>
        )}
      </View>

      {item.subject && <Text style={{ color: '#555' }}>{item.subject}</Text>}

      <Text style={{ color: '#666', marginTop: 4, fontSize: 12 }}>
        {isHistory ? 'Completed' : `Due ${new Date(item.dueAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`}
      </Text>

      {/* 3-dot menu */}
      {!isHistory && (
        <Modal transparent visible={menuFor === item.id} animationType="fade">
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 32 }}
            onPress={() => setMenuFor(null)}
          >
            <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12 }}>
              <MenuItem label="✏️ Edit" onPress={() => openEdit(item)} />
              <MenuItem label="✅ Mark as completed" onPress={() => completeDeadline(item)} />
              <MenuItem label="🗑 Delete" danger onPress={() => deleteDeadline(item.id)} />
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );

  const Section = ({ title }: { title: string }) => (
    <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 6 }}>
      {title}
    </Text>
  );

  if (loading) return <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }} />;

  return (
    <View style={{ flex: 1, padding: 16, paddingTop: 60, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 12 }}>Deadlines</Text>

      <Pressable onPress={openAdd} style={addBtn}>
        <Text style={{ textAlign: 'center', fontWeight: '600' }}>+ Add Deadline</Text>
      </Pressable>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {overdue.length > 0 && (
          <>
            <Section title="⚠️ Overdue" />
            {overdue.map(d => <DeadlineCard key={d.id} item={d} />)}
          </>
        )}

        {today.length > 0 && (
          <>
            <Section title="🔥 Today" />
            {today.map(d => <DeadlineCard key={d.id} item={d} />)}
          </>
        )}

        {tomorrow.length > 0 && (
          <>
            <Section title="⏰ Tomorrow" />
            {tomorrow.map(d => <DeadlineCard key={d.id} item={d} />)}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <Section title="📅 Upcoming" />
            {upcoming.map(d => <DeadlineCard key={d.id} item={d} />)}
          </>
        )}
        
        {/* History Section */}
        {history.length > 0 && (
          <>
            <Section title="📜 History (Last 5)" />
            {history.map(d => <DeadlineCard key={d.id} item={d} isHistory />)}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={showForm} animationType="slide">
        <View style={{ flex: 1, padding: 16, paddingTop: 60 }}>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>{editing ? 'Edit Deadline' : 'Add Deadline'}</Text>
          
          <TextInput
            placeholder="Title"
            value={title}
            onChangeText={setTitle}
            style={input}
            autoFocus
          />
          <TextInput
            placeholder="Subject (optional)"
            value={subject}
            onChangeText={setSubject}
            style={input}
          />
          
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setPickerMode('date');
              setShowPicker(true);
            }}
            style={input}
          >
            <Text>{dueDate ? dueDate.toLocaleString() : 'Pick due date & time'}</Text>
          </Pressable>

          <Pressable onPress={saveDeadline} style={primaryBtn}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Save</Text>
          </Pressable>

          <Pressable onPress={() => setShowForm(false)} style={secondaryBtn}>
            <Text style={{ textAlign: 'center' }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {showPicker && (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onPick}
        />
      )}
    </View>
  );
}

/* ---------- Menu Item ---------- */

const MenuItem = ({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) => (
  <Pressable onPress={onPress} style={{ paddingVertical: 12 }}>
    <Text style={{ fontSize: 16, color: danger ? '#dc2626' : '#000' }}>{label}</Text>
  </Pressable>
);

/* ---------- Styles ---------- */

const input = {
  borderWidth: 1,
  borderColor: '#ccc',
  padding: 14,
  borderRadius: 8,
  marginTop: 12,
  fontSize: 16,
};

const addBtn = {
  borderWidth: 1,
  borderColor: '#000',
  padding: 14,
  borderRadius: 8,
  marginBottom: 10,
  backgroundColor: '#f5f5f5',
};

const primaryBtn = {
  backgroundColor: '#000',
  padding: 16,
  borderRadius: 8,
  marginTop: 24,
};

const secondaryBtn = {
  padding: 16,
  borderRadius: 8,
  marginTop: 8,
};