import React, { useState } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BIRDS_TOTAL = 6;
const yellowBird = require('../assets/ElementsGame2/yellowbird.png');
const orangeBird = require('../assets/ElementsGame2/orangebird.png');
const yellowFly = require('../assets/ElementsGame2/yellowfly.png');
const orangeFly = require('../assets/ElementsGame2/orange fly.png');
const bg2 = require('../assets/ElementsGame2/bg2.png');

interface Game2Props {
  onComplete: (result: { correct: boolean }) => void;
}

export default function Game2({ onComplete }: Game2Props) {
  type BirdType = 'yellow' | 'orange';
  interface Bird {
    type: BirdType;
    flying: boolean;
    gone: boolean;
    anim: Animated.Value;
  }
  const [birds, setBirds] = useState<Bird[]>(
    Array.from({ length: BIRDS_TOTAL }, (_, i) => ({
      type: i % 2 === 0 ? 'yellow' as BirdType : 'orange' as BirdType,
      flying: false,
      gone: false,
      anim: new Animated.Value(0),
    }))
  );
  const [birdsGone, setBirdsGone] = useState<number>(0);
  const [showBirdsQuestion, setShowBirdsQuestion] = useState<boolean>(false);
  const [birdsGameCompleted, setBirdsGameCompleted] = useState<boolean>(false);
  const [flashColor, setFlashColor] = useState<'red' | 'green' | null>(null);
  const [birdsScore, setBirdsScore] = useState<number>(0);

  // Birds game: handle tap to fly
  const handleBirdTap = (idx: number) => {
    if (birds[idx].gone || birds[idx].flying || showBirdsQuestion) return;
    // Animate bird flying away
    const newBirds = birds.slice();
    newBirds[idx].flying = true;
    setBirdsGone(birdsGone + 1);
    setBirds(newBirds);
    Animated.timing(newBirds[idx].anim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start(() => {
      newBirds[idx].gone = true;
      setBirds([...newBirds]);
      if (birdsGone + 1 === BIRDS_TOTAL) {
        setTimeout(() => setShowBirdsQuestion(true), 600);
      }
    });
  };

  // Birds game: handle answer
  const handleBirdsAnswer = (ans: number) => {
    if (ans === 0) {
      setFlashColor('green');
      setBirdsScore(1);
      setTimeout(() => {
        setFlashColor(null);
        setBirdsGameCompleted(true);
        onComplete({ correct: true });
      }, 1000);
    } else {
      setFlashColor('red');
      setBirdsScore(0);
      setTimeout(() => {
        setFlashColor(null);
        setBirdsGameCompleted(true);
        onComplete({ correct: false });
      }, 1000);
    }
  };

  // --- Birds Game UI ---
  const birdSize = 140;
  const birdsAreaWidth = SCREEN_WIDTH * 0.97;
  const birdsAreaX = (SCREEN_WIDTH - birdsAreaWidth) / 2;
  const birdsY = SCREEN_HEIGHT / 2 + 30;
  const birdSpacing = birdsAreaWidth / (BIRDS_TOTAL + 1);

  return (
    <View style={styles.container}>
      <Image source={bg2} style={styles.backgroundImage} resizeMode="cover" />
      <View style={styles.gameUI}>
        <Text style={styles.gameTitle}>Birds on a Branch</Text>
        <Text style={styles.gameInstruction}>Tap all 6 birds to make them fly away!</Text>
        <Text style={styles.gameStory}>6 birds are on a branch.</Text>
        <Text style={styles.progressText}>Flown: {birdsGone} / {BIRDS_TOTAL}</Text>
      </View>
      {birds.map((bird, i) => {
        if (bird.gone) return null;
        const birdImg = bird.flying ? (bird.type === 'yellow' ? yellowFly : orangeFly) : (bird.type === 'yellow' ? yellowBird : orangeBird);
        const flyAnim = bird.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -SCREEN_HEIGHT * 0.4] });
        const flyX = bird.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 80 + i * 10] });
        const opacity = bird.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View key={i} style={{ position: 'absolute', left: birdsAreaX + birdSpacing * (i + 1) - birdSize / 2, top: birdsY - birdSize / 2, zIndex: 20, width: birdSize, height: birdSize, opacity, transform: [ { translateY: flyAnim }, { translateX: flyX }, { scale: bird.flying ? 1.1 : 1 }, ], }}>
            <TouchableOpacity style={{ width: '100%', height: '100%' }} onPress={() => handleBirdTap(i)} activeOpacity={0.8} disabled={bird.flying || showBirdsQuestion}>
              <Image source={birdImg} style={{ width: birdSize, height: birdSize }} resizeMode="contain" />
            </TouchableOpacity>
          </Animated.View>
        );
      })}
      {showBirdsQuestion && !birdsGameCompleted && (
        <View style={styles.questionCard}>
          <Text style={styles.questionTitle}>How many birds stayed?</Text>
          <Text style={styles.vocabularyText}>6 - 6 = ?</Text>
          <View style={styles.answerOptions}>
            {[0, 2, 6].map((opt) => (
              <TouchableOpacity key={opt} style={styles.answerButton} onPress={() => handleBirdsAnswer(opt)} disabled={birdsGameCompleted}>
                <Text style={styles.answerButtonText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {birdsGameCompleted && (
        <View style={styles.completionCard}>
          {birdsScore > 0 ? (
            <>
              <Text style={styles.completionTitle}>🎉 Congratulations!</Text>
              <Text style={styles.completionText}>All the birds have flown away!</Text>
            </>
          ) : (
            <>
              <Text style={styles.completionTitle}>Good Try!</Text>
              <Text style={styles.completionText}>The correct answer was 0 birds remaining.</Text>
            </>
          )}
          <TouchableOpacity style={styles.finishButton} onPress={() => onComplete({ correct: birdsScore > 0 })}>
            <Text style={styles.finishButtonText}>Back to Map</Text>
          </TouchableOpacity>
        </View>
      )}
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
    height: '123%',
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