import AsyncStorage from '@react-native-async-storage/async-storage';
import { get, ref } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { db } from '../constants/firebaseConfig';
import Game1 from './Game1';
import Game2 from './Game2';
import Game3 from './Game3';
import Game4 from './Game4';
import Game5 from './Game5';

const map1Bg = require('../assets/images/map1.1.png');
const stageImg = require('../assets/images/Stage.png');
const lockImg = require('../assets/images/stageLock.png');
const doneImg = require('../assets/images/correct.png');
const wrongImg = require('../assets/images/wrong.png');
const correctImg = require('../assets/images/correct.png');
const logo = require('../assets/images/logo.png');
const { width, height } = Dimensions.get('window');

const STAGES = [
  { label: 'Level 1', x: 0.15, y: 0.72},
  { label: 'Level 2', x: 0.56, y: 0.65},
  { label: 'Level 3', x: 0.30, y: 0.57 },
  { label: 'Level 4', x: 0.48, y: 0.52 },
  { label: 'Level 5', x: 0.37, y: 0.40},
];

export default function Map1() {
  // Change completed state to track status
  const [stageStatus, setStageStatus] = useState<Array<'pending' | 'correct' | 'wrong'>>([
    'pending', 'pending', 'pending', 'pending', 'pending',
  ]);
  const [currentGame, setCurrentGame] = useState<number | null>(null);
  const logoScale = useRef(new Animated.Value(1)).current;

  // Animation values for each stage
  const stageScales = useRef(STAGES.map(() => new Animated.Value(1))).current;
  // Removed doneGlows and wrong logic

  // Logo pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [logoScale]);

  // Animate unlocked (next available) stage: pulse
  useEffect(() => {
    stageStatus.forEach((status, idx) => {
      const isLocked = idx !== 0 && stageStatus[idx - 1] === 'pending';
      if (!isLocked && status === 'pending') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(stageScales[idx], { toValue: 1.13, duration: 700, useNativeDriver: true }),
            Animated.timing(stageScales[idx], { toValue: 1, duration: 700, useNativeDriver: true }),
          ])
        ).start();
      } else {
        stageScales[idx].setValue(1);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageStatus]);

  // Add a new Animated.Value array for result pop
  const resultPops = useRef(STAGES.map(() => new Animated.Value(0))).current;

  // Animate pop when a stage is marked correct or wrong
  useEffect(() => {
    stageStatus.forEach((status, idx) => {
      if (status === 'correct' || status === 'wrong') {
        Animated.sequence([
          Animated.timing(resultPops[idx], { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.spring(resultPops[idx], { toValue: 1.2, friction: 3, useNativeDriver: true }),
          Animated.spring(resultPops[idx], { toValue: 1, friction: 3, useNativeDriver: true }),
        ]).start();
      } else {
        resultPops[idx].setValue(0);
      }
    });
  }, [stageStatus]);

  // Fetch student name on mount
  useEffect(() => {
    const fetchStudentName = async () => {
      try {
        const studentId = await AsyncStorage.getItem('lastStudentId');
        if (studentId) {
          const snap = await get(ref(db, `Students/${studentId}`));
          if (snap.exists()) {
            const student = snap.val();
            const nickname = student.nickname;
          }
        }
      } catch (e) {
      }
    };
    fetchStudentName();
  }, []);

  const handleStagePress = (idx: number) => {
    // Only allow if unlocked and pending
    const isLocked = idx !== 0 && stageStatus[idx - 1] === 'pending';
    if (!isLocked && stageStatus[idx] === 'pending') {
      setCurrentGame(idx);
    }
  };

  const handleGameComplete = (result?: { correct?: boolean }) => {
    if (currentGame !== null) {
      setStageStatus(prev => {
        const updated = [...prev];
        updated[currentGame!] = result?.correct ? 'correct' : 'wrong';
        return updated;
      });
      setCurrentGame(null);
    }
  };

  // Render current game if one is active
  if (currentGame !== null) {
    const games = [
      (props: any) => <Game1 {...props} onComplete={(result?: { correct?: boolean }) => handleGameComplete(result)} />,
      (props: any) => <Game2 {...props} onComplete={(result?: { correct?: boolean }) => handleGameComplete(result)} />,
      (props: any) => <Game3 {...props} onComplete={(result?: { correct?: boolean }) => handleGameComplete(result)} />,
      (props: any) => <Game4 {...props} onComplete={(result?: { correct?: boolean }) => handleGameComplete(result)} />,
      (props: any) => <Game5 {...props} onComplete={(result?: { correct?: boolean }) => handleGameComplete(result)} />,
    ];
    const GameComponent = games[currentGame];
    return <GameComponent />;
  }

  return (
    <ImageBackground source={map1Bg} style={styles.bg} resizeMode="cover">
      <View style={styles.introContainer}>
        <Animated.Image
          source={logo}
          style={[styles.logo, { transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
        />
      </View>
      {STAGES.map((stage, idx) => {
        const isLocked = idx !== 0 && stageStatus[idx - 1] === 'pending';
        const status = stageStatus[idx];
        let icon = stageImg;
        let iconStyle = [styles.stageIcon, { transform: [{ scale: stageScales[idx] }] }];
        if (isLocked) icon = lockImg;
        // Badge logic
        let badge = null;
        if (status === 'correct' || status === 'wrong') {
          const badgeIcon = status === 'correct' ? correctImg : wrongImg;
          badge = (
            <Animated.Image
              source={badgeIcon}
              style={[
                styles.badgeIcon,
                { transform: [{ scale: resultPops[idx] }] },
              ]}
              resizeMode="contain"
            />
          );
        }
        return (
          <View
            key={stage.label}
            style={[
              styles.stageContainer,
              {
                left: width * stage.x,
                top: height * stage.y,
              },
            ]}
          >
            <Pressable
              disabled={isLocked || status !== 'pending'}
              onPress={() => handleStagePress(idx)}
              style={styles.stagePressable}
            >
              <View style={{ position: 'relative' }}>
                <Animated.Image source={icon} style={StyleSheet.flatten(iconStyle)} />
                {badge && (
                  <View style={styles.badgeWrapper}>{badge}</View>
                )}
              </View>
              <Text style={styles.stageLabel}>{stage.label}</Text>
            </Pressable>
          </View>
        );
      })}
    </ImageBackground>
  );
}

const STAGE_SIZE = 150;

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: width,
    height: height,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  stageContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  stagePressable: {
    alignItems: 'center',
  },
  stageIcon: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    marginBottom: -45,
  },
  stageLabel: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  introContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 40,
    minHeight: 90,
    zIndex: 10,
  },
  logo: {
    width: width * 0.6,
    height: 565,
    marginTop: -180,
    marginBottom: 0,
    zIndex: 2,
  },
  badgeWrapper: {
    position: 'absolute',
    top: -25,
    right: 35          ,
    zIndex: 10,
    // Optionally, you can use percentage for more dynamic placement:
    // top: '8%',
    // right: '8%',
  },
  badgeIcon: {
    width: 40,
    height: 150,
  },
}); 