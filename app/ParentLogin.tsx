import { AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import { get, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Dimensions, ImageBackground, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../constants/firebaseConfig';

const { width, height } = Dimensions.get('window');

export default function ParentLogin() {
  const router = useRouter();
  const [parentKey, setParentKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fontsLoaded] = useFonts({
    'LeagueSpartan-Bold': require('../assets/fonts/LeagueSpartan-Bold.ttf'),
  });

  useEffect(() => {
    // Load last used parent key
    AsyncStorage.getItem('lastParentKey').then(key => {
      if (key) setParentKey(key);
    });
  }, []);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Search Parents node for matching authCode
      const parentsRef = ref(db, 'Parents');
      const snapshot = await get(parentsRef);
      if (!snapshot.exists()) {
        setError('No parent accounts found.');
        setLoading(false);
        return;
      }
      const parents = snapshot.val();
      let foundParent = null;
      for (const key in parents) {
        if (parents[key].authCode === parentKey.trim()) {
          foundParent = { ...parents[key], dbKey: key };
          break;
        }
      }
      if (!foundParent) {
        setError('Invalid Parent Key. Please try again.');
        setLoading(false);
        return;
      }
      // Save last used key
      await AsyncStorage.setItem('lastParentKey', parentKey.trim());
      // Check if name or contact is missing/empty
      const needsSetup = !foundParent.name || !foundParent.contact;
      // Pass parentId and setup flag to dashboard
      router.replace({
        pathname: '/ParentDashboard',
        params: { parentId: foundParent.dbKey, needsSetup: needsSetup ? '1' : '0' },
      });
    } catch (err) {
      setError('Login failed. Please try again.');
    }
    setLoading(false);
  };

  if (!fontsLoaded) return null;

  return (
    <ImageBackground
      source={require('../assets/images/bg.jpg')}
      style={styles.background}
      resizeMode="cover"
      imageStyle={{ opacity: 0.13 }}
    >
      {/* Gradient overlay for depth */}
      <View style={styles.gradientOverlay} pointerEvents="none" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          {/* Parent icon */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="account-group" size={38} color="#27ae60" />
          </View>
          <View style={styles.logoBox}>
            <Text style={[styles.logoMath, { fontFamily: 'LeagueSpartan-Bold' }]}>MATH</Text>
            <Text style={[styles.logoTatag, { fontFamily: 'LeagueSpartan-Bold' }]}>TATAG</Text>
          </View>
          <Text style={styles.title}>Parent Login</Text>
          <View style={styles.inputWrap}>
            <AntDesign name="idcard" size={22} color="#27ae60" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter Parent Key"
              placeholderTextColor="#888"
              value={parentKey}
              onChangeText={setParentKey}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          {error ? <Text style={{ color: '#ff5a5a', marginBottom: 8 }}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={handleLogin} activeOpacity={0.85} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const LOGO_WIDTH = width * 0.55;

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    backgroundColor: '#e0ffe6',
    opacity: 0.18,
  },
  card: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#27ae60',
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(39,174,96,0.09)',
    marginBottom: 18,
    backdropFilter: 'blur(12px)',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0ffe6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#e0f7e2',
    marginBottom: 16,
    shadowColor: '#27ae60',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  inputIcon: {
    marginLeft: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 17,
    color: '#222',
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  button: {
    width: '100%',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    backgroundColor: '#27ae60',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  logoBox: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoMath: {
    fontSize: LOGO_WIDTH / 7,
    fontWeight: '900',
    color: '#2ecc40',
    letterSpacing: 2,
    width: LOGO_WIDTH,
    textAlign: 'center',
    textShadowColor: 'rgba(40,40,40,0.32)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
    marginBottom: -8,
  },
  logoTatag: {
    fontSize: LOGO_WIDTH / 8,
    fontWeight: '900',
    color: '#111',
    letterSpacing: 2,
    width: LOGO_WIDTH,
    textAlign: 'center',
    textShadowColor: 'rgba(40,40,40,0.32)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
    marginTop: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginBottom: 24,
    textAlign: 'center',
  },
}); 