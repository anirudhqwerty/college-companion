import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

/* ---------- Types ---------- */

type Deadline = {
  id: string;
  title: string;
  subject?: string;
  dueAt: number;
};

const STORAGE_KEY = 'deadlines';

/* ---------- Screen ---------- */

export default function DeadlinesScreen() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);

  const [menuFor, setMenuFor] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  /* ---------- Load / Save ---------- */

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setDeadlines(JSON.parse(saved));
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(deadlines));
  }, [deadlines]);

  /* ---------- Actions ---------- */

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setSubject('');
    setDueDate(null);
    setShowForm(true);
  };

  const openEdit = (d: Deadline) => {
    setEditing(d);
    setTitle(d.title);
    setSubject(d.subject ?? '');
    setDueDate(new Date(d.dueAt));
    setMenuFor(null);
    setShowForm(true);
  };

  const saveDeadline = () => {
    if (!title.trim() || !dueDate) return;

    if (editing) {
      setDeadlines(prev =>
        prev.map(d =>
          d.id === editing.id
            ? {
                ...d,
                title,
                subject: subject.trim() || undefined,
                dueAt: dueDate.getTime(),
              }
            : d
        )
      );
    } else {
      setDeadlines(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          title,
          subject: subject.trim() || undefined,
          dueAt: dueDate.getTime(),
        },
      ]);
    }

    setShowForm(false);
    setEditing(null);
  };

  const deleteDeadline = (id: string) => {
    Alert.alert('Delete deadline?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          setDeadlines(prev => prev.filter(d => d.id !== id)),
      },
    ]);
    setMenuFor(null);
  };

  const completeDeadline = (id: string) => {
    setDeadlines(prev => prev.filter(d => d.id !== id));
    setMenuFor(null);
  };

  /* ---------- Date Picker ---------- */

  const onPick = (_: any, selected?: Date) => {
    if (!selected) {
      setShowPicker(false);
      return;
    }

    if (pickerMode === 'date') {
      const base = dueDate ?? new Date();
      base.setFullYear(selected.getFullYear());
      base.setMonth(selected.getMonth());
      base.setDate(selected.getDate());
      setDueDate(new Date(base));
      setPickerMode('time');
      setShowPicker(true);
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

  const today = deadlines.filter(
    d => d.dueAt >= startOfToday.getTime() &&
         d.dueAt < startOfTomorrow.getTime()
  );

  const tomorrow = deadlines.filter(
    d => d.dueAt >= startOfTomorrow.getTime() &&
         d.dueAt < endOfTomorrow.getTime()
  );

  const upcoming = deadlines.filter(
    d => d.dueAt >= endOfTomorrow.getTime()
  );

  /* ---------- UI ---------- */

  const DeadlineCard = ({ item }: { item: Deadline }) => (
    <View
      key={item.id}
      style={{
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600' }}>
          {item.title}
        </Text>

        <Pressable onPress={() => setMenuFor(item.id)}>
          <Text style={{ fontSize: 22 }}>⋮</Text>
        </Pressable>
      </View>

      {item.subject && (
        <Text style={{ color: '#555' }}>{item.subject}</Text>
      )}

      <Text style={{ color: '#666', marginTop: 4 }}>
        Due {new Date(item.dueAt).toLocaleString()}
      </Text>

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
            <MenuItem label="✏️ Edit" onPress={() => openEdit(item)} />
            <MenuItem
              label="✅ Mark as completed"
              onPress={() => completeDeadline(item.id)}
            />
            <MenuItem
              label="🗑 Delete"
              danger
              onPress={() => deleteDeadline(item.id)}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );

  const Section = ({ title }: { title: string }) => (
    <Text
      style={{
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 6,
      }}
    >
      {title}
    </Text>
  );

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 12 }}>
        Deadlines
      </Text>

      <Pressable onPress={openAdd} style={addBtn}>
        <Text style={{ textAlign: 'center', fontWeight: '600' }}>
          + Add Deadline
        </Text>
      </Pressable>

      <ScrollView>
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
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={showForm} animationType="slide">
        <View style={{ flex: 1, padding: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>
            {editing ? 'Edit Deadline' : 'Add Deadline'}
          </Text>

          <TextInput
            placeholder="Title"
            value={title}
            onChangeText={setTitle}
            style={input}
          />

          <TextInput
            placeholder="Subject (optional)"
            value={subject}
            onChangeText={setSubject}
            style={input}
          />

          <Pressable
            onPress={() => {
              setPickerMode('date');
              setShowPicker(true);
            }}
            style={input}
          >
            <Text>
              {dueDate
                ? dueDate.toLocaleString()
                : 'Pick due date & time'}
            </Text>
          </Pressable>

          <Pressable onPress={saveDeadline} style={primaryBtn}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>
              Save
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowForm(false)}
            style={secondaryBtn}
          >
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

const MenuItem = ({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    style={{ paddingVertical: 10 }}
  >
    <Text style={{ fontSize: 16, color: danger ? '#dc2626' : '#000' }}>
      {label}
    </Text>
  </Pressable>
);

/* ---------- Styles ---------- */

const input = {
  borderWidth: 1,
  borderColor: '#000',
  padding: 10,
  borderRadius: 6,
  marginTop: 12,
};

const addBtn = {
  borderWidth: 1,
  borderColor: '#000',
  padding: 10,
  borderRadius: 6,
  marginBottom: 16,
};

const primaryBtn = {
  backgroundColor: '#000',
  padding: 12,
  borderRadius: 6,
  marginTop: 16,
};

const secondaryBtn = {
  padding: 12,
  borderRadius: 6,
  marginTop: 8,
};
