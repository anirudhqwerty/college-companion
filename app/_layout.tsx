import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session ? 'Found' : 'None');
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('Auth state changed:', _event, session ? 'Session exists' : 'No session');
        setSession(session);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle navigation based on auth state
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      // User is not signed in and not on auth screen -> redirect to auth
      console.log('Redirecting to auth...');
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      // User is signed in but still on auth screen -> redirect to tabs
      console.log('Redirecting to tabs...');
      router.replace('/(tabs)');
    }
  }, [session, segments, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}