import React, { useRef, useState } from 'react';
import { Animated, Dimensions, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

const BG = require('../assets/ElementsGame4/bg4.png');
const GIRL = require('../assets/ElementsGame4/girl.png');
const FRUIT = require('../assets/ElementsGame4/fruit.png');
const HAND = require('../assets/ElementsGame4/hand.png');

const SCREEN = Dimensions.get('window');
const BASKET_X = 60;
const BASKET_Y = SCREEN.height * 0.55;
const HAND_X = SCREEN.width - 120;
const HAND_Y = SCREEN.height * 0.62;

interface Game4Props {
  onComplete: (result: { correct: boolean }) => void;
}

const TOTAL_GUAVAS = 12;
const TO_GIVE = 7;
const REMAINING = TOTAL_GUAVAS - TO_GIVE;
const CHOICES = [3, 5, 7];

export default function Game4({ onComplete }: Game4Props) {
  const [given, setGiven] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number|null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [flashColor, setFlashColor] = useState<'red' | 'green' | null>(null);
  const [guavaPositions, setGuavaPositions] = useState(
    Array(TOTAL_GUAVAS).fill(null).map(() => new Animated.ValueXY({ x: 0, y: 0 }))
  );
  const [guavaGiven, setGuavaGiven] = useState(Array(TOTAL_GUAVAS).fill(false));



  // PanResponders for each guava
  const panResponders = useRef(
    guavaPositions.map((pos, idx) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !guavaGiven[idx] && !completed,
        onPanResponderMove: Animated.event([
          null,
          { dx: pos.x, dy: pos.y },
        ], { useNativeDriver: false }),
        onPanResponderRelease: (e, gesture) => {
          // If dropped near Ned's hand
          if (
            gesture.moveX > HAND_X - 40 &&
            gesture.moveX < HAND_X + 80 &&
            gesture.moveY > HAND_Y - 40 &&
            gesture.moveY < HAND_Y + 80
          ) {
            // Mark as given
            setGuavaGiven(prev => {
              const next = [...prev];
              next[idx] = true;
              return next;
            });
            setGiven(g => g + 1);
            Animated.timing(pos, {
              toValue: { x: HAND_X - BASKET_X, y: HAND_Y - BASKET_Y },
              duration: 300,
              useNativeDriver: false,
            }).start();
          } else {
            // Snap back
            Animated.spring(pos, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }).start();
          }
        },
      })
    )
  ).current;

  React.useEffect(() => {
    if (given === TO_GIVE && !completed) {
      setTimeout(() => setShowQuestion(true), 600);
    }
  }, [given, completed]);

  // Layout guavas in a compact, centered pyramid on the basket (visually matching the reference)
  const guavaCoords = [
    // 1st row (top)
    { left: BASKET_X + 105, top: BASKET_Y + 18 },
    // 2nd row
    { left: BASKET_X + 90, top: BASKET_Y + 38 },
    { left: BASKET_X + 120, top: BASKET_Y + 38 },
    // 3rd row
    { left: BASKET_X + 75, top: BASKET_Y + 58 },
    { left: BASKET_X + 105, top: BASKET_Y + 58 },
    { left: BASKET_X + 135, top: BASKET_Y + 58 },
    // 4th row
    { left: BASKET_X + 60, top: BASKET_Y + 78 },
    { left: BASKET_X + 90, top: BASKET_Y + 78 },
    { left: BASKET_X + 120, top: BASKET_Y + 78 },
    { left: BASKET_X + 150, top: BASKET_Y + 78 },
    // 5th row (base, only 2 guavas, slightly wider apart)
    { left: BASKET_X + 85, top: BASKET_Y + 98 },
    { left: BASKET_X + 125, top: BASKET_Y + 98 },
  ];



  const handleAnswer = (ans: number) => {
    setSelectedAnswer(ans);
    const correct = ans === REMAINING;
    setIsCorrect(correct);
    
    if (correct) {
      setFlashColor('green');
    } else {
      setFlashColor('red');
    }
    
    setTimeout(() => {
      setFlashColor(null);
      setShowQuestion(false);
      setCompleted(true);
      onComplete({ correct });
    }, 800);
  };

  return (
    <View style={styles.flex}>
      <Image source={BG} style={styles.bg} resizeMode="cover" />
      {/* Number sentence and vocab */}
      <View style={styles.visualPanel}>
        <Text style={styles.visualTitle}>Fruit Drop: <Text style={{ color: '#b8860b' }}>Kat’s Guavas</Text></Text>
        <Text style={styles.visualSentence}>
          <Text style={{ color: '#222', fontWeight: 'bold' }}>Number Sentence: </Text>
          <Text style={{ color: '#1a237e', fontWeight: 'bold' }}>Kat has <Text style={{ color: '#e67e22' }}>12</Text> guavas. She gives <Text style={{ color: '#e67e22' }}>7</Text> to her friend Ned. How many does she have left?</Text>
        </Text>
      </View>
      {/* Ned's hand */}
      <Image source={HAND} style={styles.hand} />
      {/* Kat (girl) */}
      <Image source={GIRL} style={styles.girl} />
      {/* Guavas */}
      {guavaCoords.map(({ left, top }, idx) =>
        !guavaGiven[idx] ? (
          <Animated.View
            key={idx}
            style={[
              styles.guava,
              {
                left,
                top,
                zIndex: 10 + idx,
                transform: guavaPositions[idx].getTranslateTransform(),
              },
            ]}
            {...(!guavaGiven[idx] && !showQuestion ? panResponders[idx].panHandlers : {})}
          >
            <Image source={FRUIT} style={styles.guavaImg} />
          </Animated.View>
        ) : null
      )}
      {/* Question Card */}
      {showQuestion && (
        <View style={questionStyles.card}>
          <Text style={questionStyles.title}>How many guavas does Kat have left?</Text>
          <Text style={questionStyles.sentence}>12 - 7 = ?</Text>
          <View style={questionStyles.choicesRow}>
            {CHOICES.map(choice => (
              <Pressable
                key={choice}
                style={[questionStyles.choiceBtn, selectedAnswer === choice && questionStyles.choiceBtnSelected]}
                onPress={() => handleAnswer(choice)}
                disabled={selectedAnswer !== null}
              >
                <Text style={questionStyles.choiceText}>{choice}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Flash Overlay */}
      {flashColor && (
        <View style={[styles.flashOverlay, { backgroundColor: flashColor === 'red' ? 'rgba(255,0,0,0.4)' : 'rgba(0,255,0,0.4)' }]} pointerEvents="none" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bg: {
    position: 'absolute',
    width: SCREEN.width,
    height: SCREEN.height,
    top: 0,
    left: 0,
  },
  topPanel: {
    position: 'absolute',
    top: 30,
    left: 0,
    width: '100%',
    alignItems: 'center',
    zIndex: 100,
  },
  visualPanel: {
    position: 'absolute',
    top: 60,
    left: '7%',
    right: '7%',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    zIndex: 120,
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  visualTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#3a2d0c',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  visualSentence: {
    fontSize: 18,
    color: '#2d2d2d',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 2,
  },
  level: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3a2d0c',
    marginBottom: 2,
  },
  sentence: {
    fontSize: 18,
    color: '#2d2d2d',
    marginBottom: 2,
  },
  vocab: {
    fontSize: 14,
    color: '#4b4b4b',
    marginBottom: 2,
  },
  girl: {
    position: 'absolute',
    left: 10,
    bottom: -40,
    width: 285, // Increased size
    height: 600, // Increased size
    zIndex: 5,
  },
  hand: {
    position: 'absolute',
    right: -3,
    bottom: 300,
    width: 150,
    height: 60,
    zIndex: 5,
  },
  guava: {
    position: 'absolute',
    width: 60,
    height: 110,
  },
  guavaImg: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
  },
  answerBasket: {
    position: 'absolute',
    left: BASKET_X + 40,
    top: BASKET_Y + 90,
    backgroundColor: '#fffbe6cc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 100,
    borderColor: '#e2c16b',
    zIndex: 100,
  },
  answerText: {
    fontSize: 25,
    color: '#3a2d0c',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 300,
  },
});

const questionStyles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: '30%',
    left: '7%',
    right: '7%',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    zIndex: 200,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  sentence: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
  },
  choicesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 10,
    gap: 18,
  },
  choiceBtn: {
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
    marginHorizontal: 8,
  },
  choiceBtnSelected: {
    backgroundColor: '#27ae60',
  },
  choiceText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
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
  finishBtn: {
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
  finishBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
}); 