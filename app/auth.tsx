import React, { useState, useEffect } from 'react';
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

// Handles the redirect back to the app after Google login
WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  // 1. Google Login Function
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      Haptics.selectionAsync();

      // Create the correct redirect URL for your device/app
      const redirectUrl = makeRedirectUri({
        path: 'auth', // ensure this matches your routing
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // We handle the redirect manually below
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Open the Google Login Page
        const result = await WebBrowser.openAuthSessionAsync(
            data.url, 
            redirectUrl
        );

        if (result.type === 'success' && result.url) {
          // Parse the session data from the URL fragment
          const { params, errorCode } = getQueryParams(result.url);
          
          if (errorCode) throw new Error(errorCode);
          
          // If we got access_token/refresh_token from the URL, set the session manually
          if (params.access_token && params.refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            });
            if (sessionError) throw sessionError;
          }
        }
      }
    } catch (error: any) {
      // Don't alert if user just cancelled the browser
      if (error.message !== 'User cancelled the auth session') {
        Alert.alert('Google Sign-In Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract tokens from the URL after Google redirects back
  const getQueryParams = (url: string) => {
    const params: { [key: string]: string } = {};
    const errorCode = null;
    
    // Supabase returns tokens in the hash (#) part of the URL
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      const hashParams = url.substring(hashIndex + 1).split('&');
      hashParams.forEach((param) => {
        const [key, value] = param.split('=');
        params[key] = decodeURIComponent(value);
      });
    }
    return { params, errorCode };
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
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        Alert.alert('Success', 'Check your email to verify your account.');
        setIsLogin(true);
      }
    } catch (error: any) {
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
      <ScrollView contentContainerStyle={styles.scrollContainer}>
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
            />
          </View>

          {/* Email Button */}
          <Pressable 
            onPress={handleEmailAuth} 
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.9 },
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
              pressed && { backgroundColor: '#f1f1f1' }
            ]}
          >
            {/* You can replace this Text with a Google Icon/Image if you have one */}
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </Pressable>

          <Pressable 
            onPress={() => {
              Haptics.selectionAsync();
              setIsLogin(!isLogin);
            }} 
            style={styles.switchButton}
          >
            <Text style={styles.switchText}>
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
  input: { borderWidth: 1, borderColor: '#ddd', padding: 16, fontSize: 16, borderRadius: 12, backgroundColor: '#f9f9f9' },
  
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

  /* Google Button Styles */
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