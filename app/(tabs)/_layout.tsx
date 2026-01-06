import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: 'Attendance' }}
      />
      <Tabs.Screen
        name="marks"
        options={{ title: 'Marks' }}
      />
      <Tabs.Screen
        name="deadlines"
        options={{ title: 'Deadlines' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />
    </Tabs>
  );
}
