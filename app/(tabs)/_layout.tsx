import { Tabs } from 'expo-router';
import { Image, View } from 'react-native';

type TabIconProps = {
  iconUrl: string;
  color: string;
};

// little helper to render the icon and handle the color
const TabIcon = ({ iconUrl, color }: TabIconProps) => (
  <Image 
    source={{ uri: iconUrl }}
    style={{ 
      width: 24, 
      height: 24, 
      tintColor: color // colors the icon when active
    }} 
    resizeMode="contain"
  />
);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        // black for active, gray for inactive
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#999999',
        // clean up the tab bar border and spacing
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          paddingTop: 5,
          height: 60,
          paddingBottom: 5
        },
        headerShown: false
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color }) => (
            <TabIcon 
              // changed this to a more reliable calendar link
              iconUrl="https://img.icons8.com/ios-filled/50/000000/calendar.png" 
              color={color} 
            />
          ),
        }}
      />
      
      <Tabs.Screen
        name="marks"
        options={{
          title: 'Marks',
          tabBarIcon: ({ color }) => (
            <TabIcon 
              // exam paper icon
              iconUrl="https://img.icons8.com/ios-filled/50/000000/exam.png" 
              color={color} 
            />
          ),
        }}
      />
      
      <Tabs.Screen
        name="deadlines"
        options={{
          title: 'Deadlines',
          tabBarIcon: ({ color }) => (
            <TabIcon 
              // alarm clock icon
              iconUrl="https://img.icons8.com/ios-filled/50/000000/alarm.png" 
              color={color} 
            />
          ),
        }}
      />
      
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <TabIcon 
              // simple user icon
              iconUrl="https://img.icons8.com/ios-filled/50/000000/user-male-circle.png" 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}