import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';


const bgWelcome = require('../assets/images/bgWelcome.png');
const logo = require('../assets/images/logo.png');
const settings = require('../assets/images/settings.png');
const play = require('../assets/images/play.png');
const about = require('../assets/images/about.png');
const home = require('../assets/images/home.png');
const lock = require('../assets/images/lock.png');
const map1 = require('../assets/images/map1.png');
const map2 = require('../assets/images/map2.png');
const map3 = require('../assets/images/map3.png');
const map4 = require('../assets/images/map4.png');
const bgMusic = require('../assets/bgmusic/Grow a Garden - Standard Weather Music (Roblox).mp3');

const { width, height } = Dimensions.get('window');

export default function Homepage() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const playScale = useRef(new Animated.Value(1)).current;
  const logoBeat = useRef(new Animated.Value(1)).current;
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [sfxVolume, setSfxVolume] = useState(0.5);
  const [isEnglish, setIsEnglish] = useState(true);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Animated values for map pulsing
  const mapScales = [
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
  ];
  // Animated values for map 3D rotation
  const mapRotations = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  // Animated value for lock beating
  const lockBeat = useRef(new Animated.Value(1)).current;

  // Load SFX volume and language from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('sfxVolume');
        if (stored !== null) setSfxVolume(Number(stored));
        const lang = await AsyncStorage.getItem('isEnglish');
        if (lang !== null) setIsEnglish(JSON.parse(lang));
      } catch {}
    })();
  }, []);

  // Persist SFX volume when changed
  useEffect(() => {
    AsyncStorage.setItem('sfxVolume', String(sfxVolume));
  }, [sfxVolume]);

  // Play background music on mount, stop on unmount, update volume on sfxVolume change
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(bgMusic, { isLooping: true, volume: sfxVolume });
        soundRef.current = sound;
        await sound.playAsync();
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.stopAsync();
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  // Ensure music stops when navigating away (screen loses focus)
  useFocusEffect(
    React.useCallback(() => {
      // No-op on focus
      return () => {
        if (soundRef.current) {
          soundRef.current.stopAsync();
          soundRef.current.unloadAsync();
          soundRef.current = null;
        }
      };
    }, [])
  );

  // Update volume in real time if sfxVolume changes
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setVolumeAsync(sfxVolume);
    }
    AsyncStorage.setItem('sfxVolume', String(sfxVolume));
  }, [sfxVolume]);

  // Persist language setting
  useEffect(() => {
    AsyncStorage.setItem('isEnglish', JSON.stringify(isEnglish));
  }, [isEnglish]);

  // Home button handler
  const handleHome = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    // Retrieve last studentId and classId from AsyncStorage
    const studentId = await AsyncStorage.getItem('lastStudentId');
    const classId = await AsyncStorage.getItem('lastClassId');
    if (studentId) {
      router.replace({ pathname: '/PTWelcomePage', params: { studentId, classId } });
    } else {
      router.replace('/PTWelcomePage');
    }
  };

  // Play button handler (if needed)
  const handlePlay = async () => {
    router.push('/Map1');
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Pulse animation for play button
    Animated.loop(
      Animated.sequence([
        Animated.timing(playScale, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        Animated.timing(playScale, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Heartbeat animation for logo
    Animated.loop(
      Animated.sequence([
        // First beat (stronger)
        Animated.timing(logoBeat, { toValue: 1.15, duration: 200, useNativeDriver: true }),
        Animated.timing(logoBeat, { toValue: 1, duration: 200, useNativeDriver: true }),
        // Small pause
        Animated.delay(100),
        // Second beat (weaker)
        Animated.timing(logoBeat, { toValue: 1.08, duration: 200, useNativeDriver: true }),
        Animated.timing(logoBeat, { toValue: 1, duration: 200, useNativeDriver: true }),
        // Rest period
        Animated.delay(800),
      ])
    ).start();

    // Pulsing maps in succession
    const pulseMap = (idx: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(idx * 500), // stagger start (slower)
          Animated.timing(mapScales[idx], { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(mapScales[idx], { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.delay(2000 - idx * 500), // keep total cycle time consistent (slower)
        ])
      ).start();
    };
    mapScales.forEach((_, idx) => pulseMap(idx));

    // 3D rotation animation for maps
    const animateRotation = (idx: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(mapRotations[idx], {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(mapRotations[idx], {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    mapRotations.forEach((_, idx) => animateRotation(idx));

    // Beating animation for lock icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(lockBeat, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(lockBeat, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(lockBeat, { toValue: 1.10, duration: 400, useNativeDriver: true }),
        Animated.timing(lockBeat, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    ).start();
  }, []);

  // About modal state
  const [aboutVisible, setAboutVisible] = useState(false);
  // Add state for terms checkbox
  const [termsChecked, setTermsChecked] = useState(false);

  // Language-aware text
  const t = {
    welcome: isEnglish ? 'Welcome to Mathtatag!' : 'Maligayang pagdating sa Mathtatag!',
    play: isEnglish ? 'Play' : 'Maglaro',
    about: isEnglish ? 'About' : 'Tungkol',
    home: isEnglish ? 'Home' : 'Bahay',
    settings: isEnglish ? 'Settings' : 'Mga Setting',
    sfxVolume: isEnglish ? 'SFX Volume:' : 'Dami ng SFX:',
    language: isEnglish ? 'Language:' : 'Wika:',
    english: 'ENGLISH',
    tagalog: 'TAGALOG',
    close: isEnglish ? 'Close' : 'Isara',
    termsTitle: isEnglish ? 'Terms & Conditions' : 'Mga Tuntunin at Kundisyon',
    terms: isEnglish
      ? `Welcome to Mathtatag! By using this app, you agree to the following:\n\n1. Educational Use: This app is designed for students, parents, and teachers to support math learning and progress tracking.\n2. Data Privacy: Your personal information and progress data are stored securely and used only for educational purposes within the app.\n3. Parental Consent: Parents must supervise and consent to their child's use of the app.\n4. No Cheating: Users agree not to misuse the app or falsify test results.\n5. Content Ownership: All images, music, and content are property of Mathtatag or their respective owners.\n6. Updates: The app may update features or terms at any time.\n7. Support: For questions or issues, contact your teacher or app support.\n\nBy continuing to use Mathtatag, you accept these terms.`
      : `Maligayang pagdating sa Mathtatag! Sa paggamit ng app na ito, sumasang-ayon ka sa mga sumusunod:\n\n1. Para sa Edukasyon: Ang app na ito ay para sa mga mag-aaral, magulang, at guro upang suportahan ang pagkatuto sa matematika at pagsubaybay ng progreso.\n2. Privacy ng Data: Ang iyong impormasyon at datos ng progreso ay ligtas at ginagamit lamang para sa edukasyonal na layunin sa app.\n3. Pahintulot ng Magulang: Kailangang may gabay at pahintulot ng magulang ang paggamit ng app ng bata.\n4. Iwasan ang Pandaraya: Sumasang-ayon ang mga gumagamit na hindi gagamitin ang app sa maling paraan o magpepeke ng resulta.\n5. Karapatan sa Nilalaman: Lahat ng larawan, musika, at nilalaman ay pag-aari ng Mathtatag o ng may-ari nito.\n6. Update: Maaring magbago ang app ng mga tampok o tuntunin anumang oras.\n7. Suporta: Para sa tanong o isyu, kontakin ang iyong guro o app support.\n\nSa pagpapatuloy ng paggamit ng Mathtatag, tinatanggap mo ang mga tuntuning ito.`
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}> 
      {/* Background */}
      <Image source={bgWelcome} style={styles.bg} resizeMode="cover" />

      {/* Settings Button */}
      <TouchableOpacity style={styles.settingsBtn} onPress={() => setSettingsVisible(true)}>
        <Image source={settings} style={styles.settingsIcon} resizeMode="contain" />
      </TouchableOpacity>

      {/* Settings Panel Modal */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsPanel}>
            <Text style={styles.panelTitle}>{t.settings}</Text>
            {/* SFX Volume */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{t.sfxVolume}</Text>
              <Slider
                style={{ width: 150, height: 40 }}
                minimumValue={0}
                maximumValue={1}
                value={sfxVolume}
                onValueChange={setSfxVolume}
                minimumTrackTintColor="#1fb28a"
                maximumTrackTintColor="#d3d3d3"
                thumbTintColor="#1fb28a"
              />
              <Text style={styles.settingValue}>{Math.round(sfxVolume * 100)}%</Text>
            </View>
            {/* Language Selector */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{t.language}</Text>
              <View style={styles.languageToggle}>
                <Text style={[styles.langOption, isEnglish && styles.langSelected]}>{t.english}</Text>
                <Switch
                  value={!isEnglish}
                  onValueChange={() => setIsEnglish((prev) => !prev)}
                  thumbColor={isEnglish ? '#ccc' : '#1fb28a'}
                  trackColor={{ false: '#d3d3d3', true: '#1fb28a' }}
                />
                <Text style={[styles.langOption, !isEnglish && styles.langSelected]}>{t.tagalog}</Text>
              </View>
            </View>
            {/* Close Button */}
            <Pressable style={styles.closeBtn} onPress={() => setSettingsVisible(false)}>
              <Text style={styles.closeBtnText}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* About Modal (Terms & Conditions) */}
      <Modal
        visible={aboutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAboutVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.aboutPanel}>
            <Text style={styles.termsTitle}>{t.termsTitle}</Text>
            <ScrollView style={styles.termsScroll} contentContainerStyle={{ paddingHorizontal: 8 }}>
              {/* Render terms up to 7th condition, then add checkbox */}
              <Text style={styles.termsText}>
                {(() => {
                  // Split terms into lines for English and Tagalog
                  const lines = t.terms.split('\n');
                  // Find the line with '7. Support:'
                  const idx7 = lines.findIndex(l => l.trim().startsWith('7.'));
                  if (idx7 === -1) return t.terms;
                  // Render up to and including 7th condition
                  return [
                    ...lines.slice(0, idx7 + 1).map((l, i) => l + '\n'),
                  ];
                })()}
              </Text>
              {/* Checkbox for agreement */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
                <Switch
                  value={termsChecked}
                  onValueChange={setTermsChecked}
                  thumbColor={termsChecked ? '#1fb28a' : '#ccc'}
                  trackColor={{ false: '#d3d3d3', true: '#1fb28a' }}
                />
                <Text style={{ marginLeft: 10, fontSize: 14, color: '#333' }}>
                  {isEnglish ? 'I have read and agree to the Terms & Conditions' : 'Nabasa at sumasang-ayon ako sa Mga Tuntunin at Kundisyon'}
                </Text>
              </View>
              {/* Render the rest of the terms (if any) */}
              <Text style={styles.termsText}>
                {(() => {
                  const lines = t.terms.split('\n');
                  const idx7 = lines.findIndex(l => l.trim().startsWith('7.'));
                  if (idx7 === -1) return '';
                  return lines.slice(idx7 + 1).join('\n');
                })()}
              </Text>
            </ScrollView>
            <Pressable style={[styles.closeBtn, { opacity: termsChecked ? 1 : 0.5 }]} onPress={() => { if (termsChecked) { setAboutVisible(false); setTermsChecked(false); } }} disabled={!termsChecked}>
              <Text style={styles.closeBtnText}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Logo with heartbeat animation */}
      <Animated.Image 
        source={logo} 
        style={[
          styles.logo, 
          { 
            transform: [{ scale: logoBeat }] 
          }
        ]} 
        resizeMode="contain" 
      />

      {/* Maps Grid Centered */}
      <View style={styles.mapsGridContainer}>
        <View style={styles.mapsRow}>
          <TouchableOpacity style={styles.mapWrapper} onPress={() => router.push('/Map1')}>
            <Animated.View
              style={{
                transform: [
                  { scale: mapScales[0] },
                  {
                    rotateY: mapRotations[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-15deg', '15deg'],
                    }),
                  },
                ],
              }}
            >
              <Image source={map1} style={styles.mapImage} resizeMode="cover" />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapWrapper} onPress={() => Alert.alert('Maintenance', 'Sorry this map is unavailable.The game is under develope.')}> 
            <Animated.View
              style={{
                transform: [
                  { scale: mapScales[1] },
                  {
                    rotateY: mapRotations[1].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-15deg', '15deg'],
                    }),
                  },
                ],
              }}
            >
              <Image source={map2} style={styles.mapImage} resizeMode="cover" />
              <Animated.Image source={lock} style={[styles.lockIcon, { transform: [{ scale: lockBeat }] }]} resizeMode="contain" />
            </Animated.View>
          </TouchableOpacity>
        </View>
        <View style={styles.mapsRow}>
          <TouchableOpacity style={styles.mapWrapper} onPress={() => Alert.alert('Maintenance', 'Sorry this map is unavailable.The game is under develope.')}>
            <Animated.View
              style={{
                transform: [
                  { scale: mapScales[2] },
                  {
                    rotateY: mapRotations[2].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-15deg', '15deg'],
                    }),
                  },
                ],
              }}
            >
              <Image source={map3} style={styles.mapImage} resizeMode="cover" />
              <Animated.Image source={lock} style={[styles.lockIcon, { transform: [{ scale: lockBeat }] }]} resizeMode="contain" />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapWrapper} onPress={() => Alert.alert('Maintenance', 'Sorry this map is unavailable.The game is under develope.')}>
            <Animated.View
              style={{
                transform: [
                  { scale: mapScales[3] },
                  {
                    rotateY: mapRotations[3].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-15deg', '15deg'],
                    }),
                  },
                ],
              }}
            >
              <Image source={map4} style={styles.mapImage} resizeMode="cover" />
              <Animated.Image source={lock} style={[styles.lockIcon, { transform: [{ scale: lockBeat }] }]} resizeMode="contain" />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Play Button with pulse effect */}
      <TouchableOpacity style={styles.playBtn} onPress={handlePlay}>
        <Animated.Image source={play} style={[styles.playIcon, { transform: [{ scale: playScale }] }]} resizeMode="contain" />
      </TouchableOpacity>

      {/* Home Button (bottom left) */}
      <TouchableOpacity style={styles.homeBtn} onPress={handleHome}>
        <Image source={home} style={styles.homeIcon} resizeMode="contain" />
      </TouchableOpacity>

      {/* About Button (bottom right) */}
      <TouchableOpacity style={styles.aboutBtn} onPress={() => setAboutVisible(true)}>
        <Image source={about} style={styles.aboutIcon} resizeMode="contain" />
      </TouchableOpacity>
    </Animated.View>
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
  settingsBtn: {
    position: 'absolute',
    top: 30,
    right: 20,
    zIndex: 10,
    width: 23,
    height: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    width: 80,
    height: 250,
  },
  logo: {
    width: width * 0.6,
    height: 565,
    marginTop: -180,
    marginBottom: 0,
    zIndex: 2,
  },
  playBtn: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    zIndex: 10,
    width: 200,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    width: 150,
    height: 315,
  },
  homeBtn: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIcon: {
    width: 75,
    height: 300,
  },
  aboutBtn: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutIcon: {
    width: 75,
    height: 300,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  settingsPanel: {
    width: 350,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    elevation: 8,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 18,
    color: '#1fb28a',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: 16,
    flex: 1,
    color: '#333',
  },
  settingValue: {
    fontSize: 15,
    marginLeft: 8,
    color: '#1fb28a',
    width: 40,
    textAlign: 'right',
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  langOption: {
    fontSize: 13,
    color: '#888',
    fontWeight: 'bold',
    marginHorizontal: 5,
  },
  langSelected: {
    color: '#1fb28a',
    textDecorationLine: 'underline',
  },
  closeBtn: {
    marginTop: 20,
    backgroundColor: '#1fb28a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 25,
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  mapsGridContainer: {
    position: 'absolute',
    top: '32%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  mapsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  mapImage: {
    width: 170,
    height: 150,
    marginHorizontal: -3,
    borderRadius: 15,
    elevation: 4,
  },
  mapWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.20,
    shadowRadius: 9.0,
    elevation: 12,
  },
  lockIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 105,
    height: 105,
    marginLeft: -52.5,
    marginTop: -52.5,
    zIndex: 10,
    opacity: 0.95,
  },
  aboutPanel: {
    width: 340,
    maxWidth: 360,
    maxHeight: 480,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  termsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1fb28a',
    marginBottom: 12,
    textAlign: 'center',
  },
  termsScroll: {
    maxHeight: 320,
    marginBottom: 18,
  },
  termsText: {
    fontSize: 13,
    color: '#333',
    textAlign: 'left',
    lineHeight: 19,
    flexShrink: 1,
    flexGrow: 1,
  },
}); 