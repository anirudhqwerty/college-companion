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
  Image
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';

// this line is needed so the browser window closes properly on web or after auth
WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  // just a helper to make the phone vibrate a bit when users tap buttons
  // makes it feel more responsive
  const triggerHaptic = async (style = 'medium') => {
    if (style === 'light') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // the big google login function
  // it opens a browser, user signs in, and we catch the tokens coming back
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      triggerHaptic('medium');

      // we are setting up where google should send the user back to
      // let expo handle the scheme automatically
      const redirectUrl = makeRedirectUri({
        scheme: 'exp',
      });

      console.log('redirect url is', redirectUrl);

      // start the oauth flow with supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) throw error;

      // if supabase gave us a url, we open it in the system browser
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url, 
          redirectUrl
        );

        // if the user actually signed in and didn't just close the window
        if (result.type === 'success' && result.url) {
          const url = result.url;
          let params;
          
          // sometimes tokens come in the hash, sometimes in the query string
          // so we check both just to be safe
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

          // if we got the goods, we save the session
          if (access_token && refresh_token) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (sessionError) throw sessionError;
            
            // success vibration
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // wait a tiny bit to make sure state updates happen
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            throw new Error('no tokens received from google');
          }
        }
      }
    } catch (error) {
      console.error('google sign in messed up:', error);
      
      // safe check to get the message string even if typescript is grumpy
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // ignore it if the user just cancelled the popup
      if (errorMessage !== 'User cancelled the auth session') {
        Alert.alert('Google Sign-In Error', errorMessage);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  // standard email and password stuff
  async function handleEmailAuth() {
    triggerHaptic('medium');
    
    // basic validation because empty fields are useless
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // trying to log them in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        if (data.session) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        // trying to sign them up
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Check your email to verify your account.');
        // switch them to login mode since they need to verify email anyway
        setIsLogin(true);
      }
    } catch (error) {
      console.error('email auth failed:', error);
      
      // safely extracting the error message again
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
          <Text style={styles.emojiIcon}>🎓</Text>
          <Text style={styles.title}>College Companion</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Welcome back! 👋' : 'Create an account'}
          </Text>
        </View>

        <View style={styles.form}>
          {/* email input section */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
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

          {/* password input section */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
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

          {/* main action button for sign in or sign up */}
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

          {/* google login button with the official png logo */}
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

          {/* simple text button to toggle between login and signup modes */}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  
  header: { marginBottom: 32, alignItems: 'center' },
  emojiIcon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#666', fontWeight: '500' },
  
  form: { width: '100%' },
  
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, color: '#444', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEE',
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
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
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
  dividerText: { marginHorizontal: 12, color: '#888', fontSize: 13, fontWeight: '600' },

  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  googleButtonPressed: { backgroundColor: '#F8F9FA' },
  googleIcon: { width: 24, height: 24 },
  googleButtonText: { color: '#1a1a1a', fontSize: 17, fontWeight: '600' },

  switchButton: { marginTop: 24, alignItems: 'center', padding: 10 },
  switchText: { color: '#666', fontSize: 15 },
  switchTextBold: { color: '#000', fontWeight: '700' },
});