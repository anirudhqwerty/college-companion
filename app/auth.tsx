import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  Alert, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  // FIXED: Google Login with correct redirect handling
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      Haptics.selectionAsync();

      // Use the base redirect without /auth/callback path
      const redirectUrl = makeRedirectUri({
        scheme: 'exp',
        // Don't specify a path - let Expo handle it
      });

      console.log('Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url, 
          redirectUrl
        );

        console.log('Browser result type:', result.type);

        if (result.type === 'success' && result.url) {
          // Extract tokens from URL
          const url = result.url;
          
          // Handle both hash (#) and query (?) parameters
          let params: URLSearchParams;
          
          if (url.includes('#')) {
            const hashFragment = url.split('#')[1];
            params = new URLSearchParams(hashFragment);
          } else if (url.includes('?')) {
            const queryString = url.split('?')[1];
            params = new URLSearchParams(queryString);
          } else {
            console.log('No parameters found in URL');
            throw new Error('No authentication parameters found');
          }

          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          console.log('Tokens found:', { 
            hasAccess: !!access_token, 
            hasRefresh: !!refresh_token 
          });

          if (access_token && refresh_token) {
            // Set the session in Supabase
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (sessionError) {
              console.error('Session error:', sessionError);
              throw sessionError;
            }

            console.log('Session set successfully:', !!sessionData.session);
            
            // Success haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Small delay to let the auth state propagate
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            throw new Error('No tokens received from Google');
          }
        } else if (result.type === 'cancel') {
          console.log('User cancelled login');
        } else if (result.type === 'dismiss') {
          console.log('Browser dismissed');
        }
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      if (error.message !== 'User cancelled the auth session') {
        Alert.alert('Google Sign-In Error', error.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  async function handleEmailAuth() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    Haptics.selectionAsync();

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        console.log('Email sign in successful:', !!data.session);
        
        if (data.session) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Check your email to verify your account.');
        setIsLogin(true);
      }
    } catch (error: any) {
      console.error('Email auth error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>College Companion</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Welcome back! 👋' : 'Create an account 🚀'}
          </Text>
        </View>

        <View style={styles.form}>
          {/* Email Inputs */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="student@college.edu"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {/* Email Button */}
          <Pressable 
            onPress={handleEmailAuth} 
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              pressed && !loading && { opacity: 0.9 },
              loading && { opacity: 0.7 }
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Sign In' : 'Sign Up'}
              </Text>
            )}
          </Pressable>
          
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Button */}
          <Pressable 
            onPress={handleGoogleLogin} 
            disabled={loading}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && !loading && { backgroundColor: '#f1f1f1' },
              loading && { opacity: 0.7 }
            ]}
          >
            <Text style={styles.googleButtonText}>
              {loading ? 'Signing in...' : 'Continue with Google'}
            </Text>
          </Pressable>

          <Pressable 
            onPress={() => {
              if (!loading) {
                Haptics.selectionAsync();
                setIsLogin(!isLogin);
              }
            }} 
            style={styles.switchButton}
            disabled={loading}
          >
            <Text style={[styles.switchText, loading && { opacity: 0.5 }]}>
              {isLogin 
                ? "Don't have an account? Sign Up" 
                : "Already have an account? Sign In"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { marginBottom: 40, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#000', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666' },
  form: { width: '100%' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    padding: 16, 
    fontSize: 16, 
    borderRadius: 12, 
    backgroundColor: '#f9f9f9' 
  },
  
  button: {
    backgroundColor: '#000',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },

  switchButton: { marginTop: 20, alignItems: 'center', padding: 10 },
  switchText: { color: '#007AFF', fontSize: 15, fontWeight: '500' },
});