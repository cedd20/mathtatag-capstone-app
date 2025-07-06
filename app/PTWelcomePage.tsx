import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, ref } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../constants/firebaseConfig';

const bgWelcome = require('../assets/images/bgWelcome.png');
const logo = require('../assets/images/logo.png');
const startBtn = require('../assets/images/start.png');
const backBtn = require('../assets/images/back.png');
const { width, height } = Dimensions.get('window');

const LoadingScreen = ({ progress }: { progress: Animated.Value }) => {
  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '60%'],
  });
  return (
    <View style={styles.loadingContainer}>
      <Image source={bgWelcome} style={styles.bg} resizeMode="cover" />
      <View style={styles.loadingTextWrap}>
        <Animated.Text style={[styles.cartoonLoadingText, { fontFamily: 'LuckiestGuy-Regular' }]}>LOADING</Animated.Text>
      </View>
      <View style={styles.cartoonProgressBarWrap}>
        <Animated.View style={[styles.cartoonProgressBar, { width: barWidth }]}> 
          <View style={styles.cartoonProgressBarFill} />
        </Animated.View>
      </View>
    </View>
  );
};

export default function Welcome() {
  const router = useRouter();
  const { classId, studentId } = useLocalSearchParams();

  // Pulse animation for logo and start button
  const logoScale = useRef(new Animated.Value(1)).current;
  const startScale = useRef(new Animated.Value(1)).current;

  const [fontLoaded, setFontLoaded] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [studentLoading, setStudentLoading] = useState(true);

  useEffect(() => {
    // Load custom fonts
    Font.loadAsync({
      'LeagueSpartan-Bold': require('../assets/fonts/LeagueSpartan-Bold.ttf'),
      'LuckiestGuy-Regular': require('../assets/fonts/LuckiestGuy-Regular.ttf'),
    }).then(() => setFontLoaded(true));

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(startScale, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        Animated.timing(startScale, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Save studentId and classId to AsyncStorage for homepage navigation
    if (studentId) {
      AsyncStorage.setItem('lastStudentId', String(studentId));
    }
    if (classId) {
      AsyncStorage.setItem('lastClassId', String(classId));
    }

    if (studentId) {
      setStudentLoading(true);
      get(ref(db, `Students/${studentId}`)).then(snap => {
        if (snap.exists()) {
          setStudent(snap.val());
        }
        setStudentLoading(false);
      });
    }
  }, [studentId, classId]);

  const handleStart = async () => {
    router.replace('/homepage');
  };

  const handleBack = async () => {
    router.replace('/TeacherDashboard');
  };

  return (
    <View style={styles.container}>
      <Image source={bgWelcome} style={styles.bg} resizeMode="cover" />
      {/* Only the logo, no white background */}
      <Animated.Image source={logo} style={[styles.logo, { transform: [{ scale: logoScale }] }]} resizeMode="contain" />
      {/* Show student info if available */}
      {studentLoading ? (
        <Text style={{ marginTop: 20, fontSize: 18, color: '#0097a7', fontWeight: 'bold', textAlign: 'center', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}>Loading student...</Text>
      ) : student ? (
        <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', fontFamily: 'LuckiestGuy-Regular', textShadowColor: '#1a237e', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4, textAlign: 'center', letterSpacing: 1 }}>
            Student: {student.nickname}
          </Text>
          <Text style={{ fontSize: 15, color: '#ffe066', fontWeight: 'bold', fontFamily: 'LeagueSpartan-Bold', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, marginTop: 2, textAlign: 'center', letterSpacing: 0.5 }}>
            ID: {student.studentNumber}
          </Text>
        </View>
      ) : (
        <Text style={{ marginTop: 20, fontSize: 18, color: '#ff5a5a', fontWeight: 'bold', textAlign: 'center', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}>Student not found.</Text>
      )}
      <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
        <Animated.Image source={startBtn} style={[styles.startIcon, { transform: [{ scale: startScale }] }]} resizeMode="contain" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
        <Image source={backBtn} style={styles.backIcon} resizeMode="contain" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#e3f2fd',
  },
  bg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: 0,
    resizeMode: 'cover',
  },
  logo: {
    width: width * .7,
    height: 700,
    marginTop: -200,
    marginBottom: 0,
    zIndex: 2,
  },
  startBtn: {
    position: 'absolute',
    bottom: -50,
    alignSelf: 'center',
    zIndex: 3,
  },
  startIcon: {
    width: 500,
    height: 500,
  },
  backBtn: {
    position: 'absolute',
    bottom: -30,
    right: 30,
    zIndex: 5,
    backgroundColor: 'transparent',
    padding: 0,
  },
  backIcon: {
    width: 50,
    height: 200,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    paddingBottom: 0,
  },
  loadingTextWrap: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 1,
    marginTop: 250,
  },
  cartoonLoadingText: {
    fontSize: 50,
    fontWeight: 'bold',
    color: '#2196f3',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: '#000000',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 6,
    elevation: 6,
  },
  cartoonProgressBarWrap: {
    width: '60%',
    height: 30,
    backgroundColor: '#ffe082',
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: '#ff9800',
    justifyContent: 'flex-start',
    zIndex: 3,
    marginTop: 5,
  },
  cartoonProgressBar: {
    height: '100%',
    backgroundColor: 'transparent',
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cartoonProgressBarFill: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#ffb300',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 10,
  },
  logoBg: {
    position: 'absolute',
    top: -35, // match logo's vertical alignment
    alignSelf: 'center',
    width: width * 0.9,
    height: 650,
    zIndex: 2,
    opacity: 0.95,
    borderRadius: 1, // makes corners rounded
  },
}); 