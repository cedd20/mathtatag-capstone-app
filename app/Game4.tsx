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
  const [showCompletion, setShowCompletion] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
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

  // Animate remaining guavas into answer basket
  React.useEffect(() => {
    if (showCompletion && !isCorrect) {
      guavaGiven.forEach((given, idx) => {
        if (!given) {
          Animated.timing(guavaPositions[idx], {
            toValue: { x: 0, y: 60 },
            duration: 500,
            useNativeDriver: false,
          }).start();
        }
      });
    }
  }, [showCompletion, isCorrect]);

  const handleAnswer = (ans: number) => {
    setSelectedAnswer(ans);
    setIsCorrect(ans === REMAINING);
    setTimeout(() => {
      setShowQuestion(false);
      setShowCompletion(true);
      setCompleted(true);
    }, 800);
  };

  return (
    <View style={styles.flex}>
      <Image source={BG} style={styles.bg} resizeMode="cover" />
      {/* Number sentence and vocab */}
      <View style={styles.topPanel}>
        <Text style={styles.level}>Fruit Drop: Kat’s Guavas</Text>
        <Text style={styles.sentence}>Number Sentence: <Text style={{fontWeight:'bold'}}>12 – 7 = 5</Text></Text>
        <Text style={styles.vocab}>Minuend: 12   Subtrahend: 7   Difference: 5</Text>
      </View>
      {/* Ned's hand */}
      <Image source={HAND} style={styles.hand} />
      {/* Kat (girl) */}
      <Image source={GIRL} style={styles.girl} />
      {/* Guavas */}
      {guavaCoords.map(({ left, top }, idx) =>
        !guavaGiven[idx] || (showCompletion && !isCorrect) ? (
          <Animated.View
            key={idx}
            style={[
              styles.guava,
              {
                left,
                top,
                zIndex: 10 + idx,
                transform: guavaPositions[idx].getTranslateTransform(),
                opacity: showCompletion && guavaGiven[idx] && !isCorrect ? 0 : 1,
              },
            ]}
            {...(!guavaGiven[idx] && !showQuestion && !showCompletion ? panResponders[idx].panHandlers : {})}
          >
            <Image source={FRUIT} style={styles.guavaImg} />
          </Animated.View>
        ) : null
      )}
      {/* Question Card */}
      {showQuestion && !showCompletion && (
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
      {/* Completion Card */}
      {showCompletion && (
        <View style={questionStyles.card}>
          {isCorrect ? (
            <>
              <Text style={questionStyles.completionTitle}>🎉 Congratulations!</Text>
              <Text style={questionStyles.completionText}>Kat has <Text style={{fontWeight:'bold'}}>{REMAINING}</Text> guavas left!</Text>
              <Text style={questionStyles.sentence}>12 - 7 = 5</Text>
            </>
          ) : (
            <>
              <Text style={questionStyles.completionTitle}>Good Try!</Text>
              <Text style={questionStyles.completionText}>The correct answer was <Text style={{fontWeight:'bold'}}>{REMAINING}</Text> guavas left.</Text>
              <Text style={questionStyles.sentence}>12 - 7 = 5</Text>
            </>
          )}
          <Pressable style={questionStyles.finishBtn} onPress={() => onComplete({ correct: isCorrect })}>
            <Text style={questionStyles.finishBtnText}>Back to Map</Text>
          </Pressable>
        </View>
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
});

const questionStyles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: '30%',
    left: '7%',
    right: '7%',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    zIndex: 200,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 10,
    textAlign: 'center',
  },
  sentence: {
    fontSize: 18,
    color: '#222',
    marginBottom: 18,
    textAlign: 'center',
  },
  choicesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 18,
  },
  choiceBtn: {
    backgroundColor: '#e0f7fa',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginHorizontal: 8,
    marginBottom: 0,
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  choiceBtnSelected: {
    backgroundColor: '#27ae60',
  },
  choiceText: {
    fontSize: 20,
    color: '#222',
    fontWeight: 'bold',
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 8,
    textAlign: 'center',
  },
  completionText: {
    fontSize: 18,
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  finishBtn: {
    backgroundColor: '#27ae60',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 32,
    marginTop: 18,
  },
  finishBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 