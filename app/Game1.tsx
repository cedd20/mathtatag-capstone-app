import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game constants
const TOTAL_BALLOONS = 10;
const BALLOONS_TO_POP = 5;

// Boy positioning and size (bigger, centered, slightly up)
const boyImage = require('../assets/ElementsGame1/boy.png');
const BOY_WIDTH = 280;
const BOY_HEIGHT = 400;
const boyX = SCREEN_WIDTH / 2 - BOY_WIDTH / 2;
const boyY = SCREEN_HEIGHT - BOY_HEIGHT - 80;
// Hand anchor: visually at the right hand grip
const handAnchor = { x: SCREEN_WIDTH / 2 + 62, y: boyY + 160 };

// Balloon images (b1-b10.png)
const balloonPNGs = [
  require('../assets/ElementsGame1/b1.png'),
  require('../assets/ElementsGame1/b2.png'),
  require('../assets/ElementsGame1/b3.png'),
  require('../assets/ElementsGame1/b4.png'),
  require('../assets/ElementsGame1/b5.png'),
  require('../assets/ElementsGame1/b6.png'),
  require('../assets/ElementsGame1/b7.png'),
  require('../assets/ElementsGame1/b8.png'),
  require('../assets/ElementsGame1/b9.png'),
  require('../assets/ElementsGame1/b10.png'),
];

// Balloons: bigger and cluster above hand
const BALLOON_SIZE = 160;

// Cluster directly above boy's head, tightly grouped, clearly held
const balloonClusterPositions = [
  { x: 0, y: -210, scale: 1.18, z: 6 },
  { x: -38, y: -210, scale: 1.18, z: 5 },
  { x: 38, y: -210, scale: 1.18, z: 5 },
  { x: -60, y: -170, scale: 1.18, z: 4 },
  { x: 60, y: -170, scale: 1.18, z: 4 },
  { x: -30, y: -140, scale: 1.10, z: 4 },
  { x: 30, y: -140, scale: 1.18, z: 4 },
  { x: -38, y: -100, scale: 1.10, z: 3 },
  { x: 38, y: -100, scale: 1.18, z: 3 },
  { x: 0, y: -170, scale: 1.18, z: 7 },
];

interface Game1Props {
  onComplete: (result: { correct: boolean }) => void;
}

export default function Game1({ onComplete }: Game1Props) {
  const [poppedBalloons, setPoppedBalloons] = useState<number[]>([]);
  const [showQuestion, setShowQuestion] = useState(false);
  const [flashColor, setFlashColor] = useState<null | 'red' | 'green'>(null);
  const [boyFlying, setBoyFlying] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [isWrong, setIsWrong] = useState(false);

  // Animations
  const balloonAnims = useRef(Array.from({ length: TOTAL_BALLOONS }, () => new Animated.Value(1))).current;
  const floatAnims = useRef(Array.from({ length: TOTAL_BALLOONS }, () => new Animated.Value(0))).current;
  const boyAnim = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef(Array.from({ length: TOTAL_BALLOONS }, () => new Animated.Value(1))).current;

  // Start floating animations
  useEffect(() => {
    floatAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000 + i * 150,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 2000 + i * 150,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  // Handle balloon pop
  const handleBalloonPop = (balloonIndex: number) => {
    if (poppedBalloons.includes(balloonIndex) || boyFlying) return;

    // Animate balloon pop
    Animated.timing(balloonAnims[balloonIndex], {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();

    const newPopped = [...poppedBalloons, balloonIndex];
    setPoppedBalloons(newPopped);

    // Check if 5 balloons are popped
    if (newPopped.length === BALLOONS_TO_POP) {
      setShowQuestion(true); // Show question immediately
    }
  };

  // Handle answer selection
  const handleAnswer = (selectedAnswer: number) => {
    const correctAnswer = TOTAL_BALLOONS - BALLOONS_TO_POP; // 5

    if (selectedAnswer === correctAnswer) {
      // Correct answer
      setFlashColor('green');
      setScore(1);
      setTimeout(() => {
        setFlashColor(null);
        setShowQuestion(false);
        setGameCompleted(true);
        setIsWrong(false);
        onComplete({ correct: true }); // Call here
      }, 1000);
    } else {
      // Wrong answer
      setFlashColor('red');
      setScore(0);
      setIsWrong(true); // Mark as wrong
      makeBoyFlyAway();
      setTimeout(() => {
        setFlashColor(null);
        setShowQuestion(false);
        setGameCompleted(true); // Show Good Try panel
        onComplete({ correct: false }); // Call here
      }, 1000);
    }
  };

  // Make boy fly away animation
  const makeBoyFlyAway = () => {
    setBoyFlying(true);
    Animated.timing(boyAnim, {
      toValue: -SCREEN_HEIGHT,
      duration: 2000,
      useNativeDriver: true,
    }).start();
  };

  // Render balloon cluster
  const renderBalloons = () => (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {Array.from({ length: TOTAL_BALLOONS }).map((_, i: number) => {
        if (poppedBalloons.includes(i)) return null;
        const pos = balloonClusterPositions[i];
        const balloonWidth = BALLOON_SIZE * pos.scale;
        const balloonHeight = BALLOON_SIZE * pos.scale;
        const handlePressIn = () => {
          Animated.spring(scaleAnims[i], { toValue: 1.18, useNativeDriver: true }).start();
        };
        const handlePressOut = () => {
          Animated.spring(scaleAnims[i], { toValue: 1, useNativeDriver: true }).start();
        };
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: handAnchor.x + pos.x - balloonWidth / 2,
              top: handAnchor.y + pos.y - balloonHeight / 2,
              width: balloonWidth,
              height: balloonHeight,
              zIndex: pos.z + 10,
              opacity: balloonAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              transform: [
                { scale: Animated.multiply(balloonAnims[i], scaleAnims[i]) },
                { translateY: floatAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                { translateX: floatAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) },
                ...(boyFlying ? [{ translateY: boyAnim }] : []),
              ],
            }}
            pointerEvents={poppedBalloons.includes(i) ? 'none' : 'auto'}
          >
            <TouchableOpacity
              style={{ width: '100%', height: '100%' }}
              onPress={() => {
                handleBalloonPop(i);
                handlePressOut();
              }}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={0.7}
              disabled={boyFlying || showQuestion || poppedBalloons.includes(i) || poppedBalloons.length >= BALLOONS_TO_POP}
            >
              <Image
                source={balloonPNGs[i]}
                style={{ width: balloonWidth, height: balloonHeight }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );

  // Render a smooth, realistic curved string from each balloon to the boy's hand
  const renderBalloonStrings = () => {
    if (boyFlying) return null;
    if (poppedBalloons.length === TOTAL_BALLOONS) return null;
    return (
      <Svg style={StyleSheet.absoluteFill} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} pointerEvents="none">
        {Array.from({ length: TOTAL_BALLOONS }).map((_, i: number) => {
          if (poppedBalloons.includes(i)) return null;
          const pos = balloonClusterPositions[i];
          const balloonCenterX = handAnchor.x + pos.x;
          const balloonCenterY = handAnchor.y + pos.y;
          // Control point for Bezier curve: halfway, offset upward for a gentle curve
          const controlX = (balloonCenterX + handAnchor.x) / 2;
          const controlY = (balloonCenterY + handAnchor.y) / 2 - 20;
          return (
            <Path
              key={i}
              d={`M${balloonCenterX},${balloonCenterY} Q${controlX},${controlY} ${handAnchor.x},${handAnchor.y}`}
              stroke="#bbb"
              strokeWidth={2.2}
              opacity={0.8}
              fill="none"
            />
          );
        })}
      </Svg>
    );
  };

  // Render question UI
  const renderQuestion = () => (
    <View style={styles.questionCard}>
      <Text style={styles.questionTitle}>How many balloons are still there?</Text>
      <Text style={styles.vocabularyText}>
       10 - 5 = ?
      </Text>
      <View style={styles.answerOptions}>
        {[3, 5, 7].map((option: number) => (
          <TouchableOpacity
            key={option}
            style={styles.answerButton}
            onPress={() => handleAnswer(option)}
            disabled={boyFlying}
          >
            <Text style={styles.answerButtonText}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Render completion screen
  const renderCompletion = () => (
    <View style={styles.completionCard}>
      {score > 0 ? (
        <>
          <Text style={styles.completionTitle}>🎉 Congratulations!</Text>
          <Text style={styles.completionText}>You solved the subtraction problem correctly!</Text>
        </>
      ) : (
        <>
          <Text style={styles.completionTitle}>Good Try!</Text>
          <Text style={styles.completionText}>The correct answer was 5 balloons remaining.</Text>
        </>
      )}
      <TouchableOpacity style={styles.finishButton} onPress={() => onComplete({ correct: score > 0 })}>
        <Text style={styles.finishButtonText}>Back to Map</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Image source={require('../assets/ElementsGame1/bg1.png')} style={styles.backgroundImage} resizeMode="cover" />
      <View style={styles.gameUI}>
        <Text style={styles.gameTitle}>Balloons in the Sky</Text>
        <Text style={styles.gameInstruction}>Tap 5 balloons to pop them!</Text>
        <Text style={styles.gameStory}>A boy holds 10 balloons. 5 balloons popped.</Text>
        <Text style={styles.progressText}>Popped: {poppedBalloons.length} / {BALLOONS_TO_POP}</Text>
      </View>
      {renderBalloonStrings()}
      {renderBalloons()}
      <Animated.Image source={boyImage} style={[styles.boyImage, boyFlying && { transform: [{ translateY: boyAnim }] }]} resizeMode="contain" />
      {showQuestion && !gameCompleted && renderQuestion()}
      {gameCompleted && renderCompletion()}
      {flashColor && (
        <View style={[styles.flashOverlay, { backgroundColor: flashColor === 'red' ? 'rgba(255,0,0,0.4)' : 'rgba(0,255,0,0.4)' }]} pointerEvents="none" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  gameUI: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 20,
    zIndex: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  gameTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 8,
    textAlign: 'center',
  },
  gameInstruction: {
    fontSize: 18,
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  gameStory: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  boyImage: {
    position: 'absolute',
    left: boyX,
    top: boyY,
    width: BOY_WIDTH,
    height: BOY_HEIGHT,
    zIndex: 30,
  },
  questionCard: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.3,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 25,
    padding: 30,
    zIndex: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  vocabularyText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
  },
  answerOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  answerButton: {
    backgroundColor: '#3498db',
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 25,
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#3498db',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  answerButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  completionCard: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.25,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 25,
    padding: 30,
    zIndex: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 15,
    textAlign: 'center',
  },
  completionText: {
    fontSize: 18,
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 25,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 300,
  },
  finishButton: {
    backgroundColor: '#3498db',
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 30,
    marginTop: 18,
    shadowColor: '#3498db',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    alignSelf: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
}); 