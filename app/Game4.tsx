import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

interface Game4Props {
  onComplete: (result: { correct: boolean }) => void;
}

export default function Game4({ onComplete }: Game4Props) {
  const [completed, setCompleted] = useState(false);

  const handleComplete = () => {
    setCompleted(true);
    Alert.alert(
      'Level 4 Complete!',
      'Excellent work on Level 4!',
      [
        {
          text: 'Continue',
          onPress: () => onComplete({ correct: true })
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Level 4</Text>
      <Text style={styles.subtitle}>Coming Soon!</Text>
      <Text style={styles.description}>
        This level will feature challenging subtraction word problems.
      </Text>
      <Pressable style={styles.button} onPress={handleComplete}>
        <Text style={styles.buttonText}>Complete Level</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#98FB98',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 