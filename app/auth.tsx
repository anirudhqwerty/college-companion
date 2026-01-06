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
  ScrollView,
  Image,
  Linking 
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Ionicons, Feather } from '@expo/vector-icons'; 

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const triggerHaptic = async (style = 'medium') => {
    if (style === 'light') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleOpenLink = () => {
    triggerHaptic('light');
    Linking.openURL('https://linkedin.com/in/anirudhqwerty');
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      triggerHaptic('medium');

      const redirectUrl = makeRedirectUri({
        scheme: 'collegecompanion',
      });

      console.log('redirect url is', redirectUrl);

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

        if (result.type === 'success' && result.url) {
          const url = result.url;
          let params;
          
          if (url.includes('#')) {
            const hashFragment = url.split('#')[1];
            params = new URLSearchParams(hashFragment);
          } else if (url.includes('?')) {
            const queryString = url.split('?')[1];
            params = new URLSearchParams(queryString);
          } else {
            throw new Error('no authentication parameters found');
          }

          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (sessionError) throw sessionError;
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            throw new Error('no tokens received from google');
          }
        }
      }
    } catch (error) {
      console.error('google sign in messed up:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage !== 'User cancelled the auth session') {
        Alert.alert('Google Sign-In Error', errorMessage);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  async function handleEmailAuth() {
    triggerHaptic('medium');
    
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
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
    } catch (error) {
      console.error('email auth failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', errorMessage);
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {/* UPDATED: Using Image instead of Feather Vector */}
            {/* Adjust the path below (../ or ../../) depending on where this file is located */}
            <Image 
              source={require('../assets/images/icon.png')} 
              style={{ width: 48, height: 48, borderRadius: 10 }} 
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>College Companion</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Welcome back!' : 'Create an account to get started'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="student@college.edu"
                placeholderTextColor="#A0A0A0"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#A0A0A0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>
          </View>

          <Pressable 
            onPress={handleEmailAuth} 
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              pressed && !loading && styles.buttonPressed,
              loading && styles.buttonDisabled
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </Pressable>
          
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable 
            onPress={handleGoogleLogin} 
            disabled={loading}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && !loading && styles.googleButtonPressed,
              loading && styles.buttonDisabled
            ]}
          >
            <Image 
              source={{ uri: 'https://img.icons8.com/color/48/000000/google-logo.png' }} 
              style={styles.googleIcon} 
            />
            <Text style={styles.googleButtonText}>
              Google
            </Text>
          </Pressable>

          <Pressable 
            onPress={() => {
              if (!loading) {
                triggerHaptic('light');
                setIsLogin(!isLogin);
              }
            }} 
            style={styles.switchButton}
            disabled={loading}
          >
            <Text style={styles.switchText}>
              {isLogin ? "New here? " : "Already have an account? "}
              <Text style={styles.switchTextBold}>
                {isLogin ? "Sign Up" : "Sign In"}
              </Text>
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
           <Pressable onPress={handleOpenLink} style={styles.footerContent}>
              <Text style={styles.footerText}>Made by </Text>
              <Text style={styles.footerLink}>Anirudh</Text>
              <Feather name="external-link" size={12} color="#007AFF" style={{ marginLeft: 4 }} />
           </Pressable>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  
  header: { marginBottom: 40, alignItems: 'center', marginTop: 20 },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#666', fontWeight: '500', textAlign: 'center' },
  
  form: { width: '100%' },
  
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8, color: '#666', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#333', height: '100%' },
  
  button: {
    backgroundColor: '#000',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { marginHorizontal: 12, color: '#999', fontSize: 13, fontWeight: '600' },

  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  googleButtonPressed: { backgroundColor: '#F8F9FA' },
  googleIcon: { width: 24, height: 24 },
  googleButtonText: { color: '#1a1a1a', fontSize: 17, fontWeight: '600' },

  switchButton: { marginTop: 28, alignItems: 'center', padding: 10 },
  switchText: { color: '#666', fontSize: 15 },
  switchTextBold: { color: '#000', fontWeight: '700' },

  footer: { marginTop: 40, alignItems: 'center' },
  footerContent: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 13, color: '#999' },
  footerLink: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
});