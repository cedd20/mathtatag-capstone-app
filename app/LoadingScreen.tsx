import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, View } from 'react-native';

const bgWelcome = require('../assets/images/bgWelcome.png');
const bgMusic = require('../assets/bgmusic/Grow a Garden - Standard Weather Music (Roblox).mp3');
const { width } = Dimensions.get('window');

export default function LoadingScreen() {
  const router = useRouter();
  const { studentId, classId } = useLocalSearchParams();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        router.replace({ pathname: '/PTWelcomePage', params: { studentId, classId } });
      });
    });
  }, [studentId, classId]);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '60%'],
  });

  return (
    <Animated.View style={[styles.loadingOverlay, { opacity: fadeAnim }]}> 
      <Image source={bgWelcome} style={styles.bg} resizeMode="cover" />
      <View style={styles.loadingTextWrap}>
        <Text style={styles.cartoonLoadingText}>LOADING</Text>
      </View>
      <View style={styles.cartoonProgressBarWrap}>
        <Animated.View style={[styles.cartoonProgressBar, { width: barWidth }]}> 
          <View style={styles.cartoonProgressBarFill} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
}); 