import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as Notifications from 'expo-notifications'; // ❌ disabled for Expo Go

type Deadline = {
  id: string;
  title: string;
  subject?: string;
  dueAt: number;
};

const STORAGE_KEY = 'deadlines';

export default function DeadlinesScreen() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);

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

  /* ---------- Notifications (DISABLED) ---------- */
  /*
  const scheduleNotifications = async (d: Deadline) => {
    const oneDayBefore = d.dueAt - 24 * 60 * 60 * 1000;

    if (oneDayBefore > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Deadline tomorrow',
          body: d.title,
        },
        trigger: { date: new Date(oneDayBefore) } as any,
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Deadline today',
        body: d.title,
      },
      trigger: { date: new Date(d.dueAt) } as any,
    });
  };
  */

  /* ---------- Actions ---------- */

  const addDeadline = async () => {
    if (!title.trim() || !dueDate) return;

    const d: Deadline = {
      id: Date.now().toString(),
      title,
      subject: subject.trim() || undefined,
      dueAt: dueDate.getTime(),
    };

    setDeadlines(prev => [...prev, d]);

    // ❌ Notifications disabled for now
    // await scheduleNotifications(d);

    setTitle('');
    setSubject('');
    setDueDate(null);
    setShowAdd(false);
  };

  const removeDeadline = (id: string) => {
    Alert.alert('Delete deadline?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          setDeadlines(prev => prev.filter(d => d.id !== id)),
      },
    ]);
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

  const renderItem = (item: Deadline) => (
    <Pressable
      onLongPress={() => removeDeadline(item.id)}
      style={{
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '600' }}>
        {item.title}
      </Text>

      {item.subject && (
        <Text style={{ color: '#555' }}>{item.subject}</Text>
      )}

      <Text style={{ color: '#666', marginTop: 4 }}>
        Due {new Date(item.dueAt).toLocaleString()}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 12 }}>
        Deadlines
      </Text>

      <Pressable
        onPress={() => setShowAdd(true)}
        style={{
          borderWidth: 1,
          borderColor: '#000',
          padding: 10,
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        <Text style={{ textAlign: 'center', fontWeight: '600' }}>
          + Add Deadline
        </Text>
      </Pressable>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {today.length > 0 && (
              <>
                <Section title="🔥 Today" />
                {today.map(renderItem)}
              </>
            )}

            {tomorrow.length > 0 && (
              <>
                <Section title="⏰ Tomorrow" />
                {tomorrow.map(renderItem)}
              </>
            )}

            {upcoming.length > 0 && (
              <>
                <Section title="📅 Upcoming" />
                {upcoming.map(renderItem)}
              </>
            )}
          </>
        }
      />

      {/* Add modal */}
      <Modal visible={showAdd} animationType="slide">
        <View style={{ flex: 1, padding: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>
            Add Deadline
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
            onPress={() => setDueDate(new Date())}
            style={input}
          >
            <Text>
              {dueDate
                ? dueDate.toLocaleString()
                : 'Set due date (tap)'}
            </Text>
          </Pressable>

          <Pressable onPress={addDeadline} style={primaryBtn}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>
              Save
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowAdd(false)}
            style={secondaryBtn}
          >
            <Text style={{ textAlign: 'center' }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Small components ---------- */

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

const input = {
  borderWidth: 1,
  borderColor: '#000',
  padding: 10,
  borderRadius: 6,
  marginTop: 12,
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
