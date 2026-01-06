import 'react-native-url-polyfill/auto'; // Make sure you have this installed
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 1. Tell Supabase to use AsyncStorage to save the session
    storage: AsyncStorage,
    // 2. Automatically refresh the token if it expires
    autoRefreshToken: true,
    // 3. Keep the user logged in even after app close
    persistSession: true,
    // 4. Important for React Native: verify the URL handling
    detectSessionInUrl: false,
  },
});