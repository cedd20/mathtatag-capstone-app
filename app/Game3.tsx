import React, { useEffect, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const bg3 = require('../assets/ElementsGame3/bg3.png');

interface Game3Props {
  onComplete: (result: { correct: boolean }) => void;
}

export default function Game3({ onComplete }: Game3Props) {
  interface Card {
    id: number;
    value: number;
    isFlipped: boolean;
    isMatched: boolean;
  }
  const [matchingPairs, setMatchingPairs] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [matchingScore, setMatchingScore] = useState<number>(0);
  const [showMatchingQuestion, setShowMatchingQuestion] = useState<boolean>(false);
  const [matchingGameCompleted, setMatchingGameCompleted] = useState<boolean>(false);
  const [flashColor, setFlashColor] = useState<'red' | 'green' | null>(null);
  const [previewing, setPreviewing] = useState<boolean>(true);

  // Auto-return to map when game is completed
  useEffect(() => {
    if (matchingGameCompleted) {
      const timer = setTimeout(() => {
        onComplete({ correct: matchingScore > 0 });
      }, 2000); // Wait 2 seconds after completion before returning
      return () => clearTimeout(timer);
    }
  }, [matchingGameCompleted, matchingScore, onComplete]);

  // Initialize matching game
  useEffect(() => {
    if (matchingPairs.length === 0) {
      const pairs: Card[] = [];
      for (let i = 1; i <= 6; i++) {
        pairs.push({ id: i * 2 - 1, value: i, isFlipped: false, isMatched: false });
        pairs.push({ id: i * 2, value: i, isFlipped: false, isMatched: false });
      }
      const shuffled = pairs.sort(() => Math.random() - 0.5);
      setMatchingPairs(shuffled);
    }
    // Show preview for 2 seconds
    setPreviewing(true);
    const timer = setTimeout(() => setPreviewing(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleCardPress = (cardId: number) => {
    if (selectedCards.length === 2 || matchingPairs.find((card: Card) => card.id === cardId)?.isMatched) return;
    
    // If this is the first card being selected
    if (selectedCards.length === 0) {
      setSelectedCards([cardId]);
      return;
    }
    
    // If this is the second card being selected
    const newSelected = [...selectedCards, cardId];
    setSelectedCards(newSelected);
    
    const [firstId, secondId] = newSelected;
    const firstCard = matchingPairs.find((card: Card) => card.id === firstId);
    const secondCard = matchingPairs.find((card: Card) => card.id === secondId);
    
    if (firstCard && secondCard && firstCard.value === secondCard.value) {
      // Match found - keep both cards visible and mark as matched
      setMatchingPairs((prev: Card[]) => prev.map((card: Card) =>
        card.id === firstId || card.id === secondId
          ? { ...card, isMatched: true }
          : card
      ));
      setMatchingScore((prev: number) => prev + 1);
      setSelectedCards([]);
      const matchedCount = matchingPairs.filter((card: Card) => card.isMatched).length + 2;
      if (matchedCount === matchingPairs.length) {
        setTimeout(() => setShowMatchingQuestion(true), 1000);
      }
    } else {
      // No match - hide the second card after a delay, but keep the first card visible
      setTimeout(() => {
        setSelectedCards([firstId]); // Keep only the first card selected
      }, 1500);
    }
  };

  const handleMatchingAnswer = (ans: number) => {
    if (ans === 6) {
      setFlashColor('green');
      setMatchingScore(1);
      setTimeout(() => {
        setFlashColor(null);
        setMatchingGameCompleted(true);
        // Return to map immediately after flash ends
        setTimeout(() => {
          onComplete({ correct: true });
        }, 100);
      }, 1000);
    } else {
      setFlashColor('red');
      setMatchingScore(0);
      setTimeout(() => {
        setFlashColor(null);
        setMatchingGameCompleted(true);
        // Return to map immediately after flash ends
        setTimeout(() => {
          onComplete({ correct: false });
        }, 100);
      }, 1000);
    }
  };

  const cardSize = 80;
  const cardsPerRow = 4;
  const rows = 3;
  const cardSpacing = 10;
  const totalWidth = cardsPerRow * cardSize + (cardsPerRow - 1) * cardSpacing;
  const startX = (SCREEN_WIDTH - totalWidth) / 2;
  const startY = SCREEN_HEIGHT * 0.4;

  return (
    <View style={styles.container}>
      <Image source={bg3} style={styles.backgroundImage} resizeMode="cover" />
      {previewing && (
        <View style={styles.rememberMeContainer}>
          <Text style={styles.rememberMeText}>Remember Me!</Text>
        </View>
      )}
      <View style={styles.gameUI}>
        <Text style={styles.gameTitle}>Number Matching</Text>
        <Text style={styles.gameInstruction}>Find matching number pairs!</Text>
        <Text style={styles.gameStory}>Match all the numbers to complete the game.</Text>
        <Text style={styles.progressText}>Matches: {matchingScore} / 6</Text>
      </View>
      <View style={styles.matchingGrid}>
        {matchingPairs.map((card: Card, index: number) => {
          const row = Math.floor(index / cardsPerRow);
          const col = index % cardsPerRow;
          const x = startX + col * (cardSize + cardSpacing);
          const y = startY + row * (cardSize + cardSpacing);
          const isSelected = selectedCards.includes(card.id);
          const isMatched = card.isMatched;
          const showNumber = isSelected || isMatched || previewing;
          return (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.matchingCard,
                {
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: cardSize,
                  height: cardSize,
                  backgroundColor: isMatched ? '#27ae60' : (showNumber ? '#3498db' : '#95a5a6'),
                }
              ]}
              onPress={() => handleCardPress(card.id)}
              disabled={isMatched}
            >
              {showNumber && (
                <Text style={styles.cardNumber}>{card.value}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {showMatchingQuestion && !matchingGameCompleted && (
        <View style={styles.questionCard}>
          <Text style={styles.questionTitle}>How many pairs did you match?</Text>
          <Text style={styles.vocabularyText}>6 pairs = ?</Text>
          <View style={styles.answerOptions}>
            {[4, 6, 8].map((opt) => (
              <TouchableOpacity key={opt} style={styles.answerButton} onPress={() => handleMatchingAnswer(opt)} disabled={matchingGameCompleted}>
                <Text style={styles.answerButtonText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  matchingGrid: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 50,
  },
  matchingCard: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
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
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 300,
  },
  rememberMeContainer: {
    position: 'absolute',
    top: 290,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 200,
  },
  rememberMeText: {
    backgroundColor: '#fff',
    color: '#3498db',
    fontWeight: 'bold',
    fontSize: 28,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#3498db',
    shadowColor: '#3498db',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    textAlign: 'center',
    letterSpacing: 1,
  },
}); 