import React from 'react';
import { Dimensions, ImageBackground, StyleSheet } from 'react-native';

const map1Bg = require('../assets/images/map1.1.png');
const { width, height } = Dimensions.get('window');

export default function Map1() {
  return (
    <ImageBackground source={map1Bg} style={styles.bg} resizeMode="cover">
      {/* Add your map content here */}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: width,
    height: height,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
}); 