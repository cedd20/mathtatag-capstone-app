import { AntDesign, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { get, onValue, ref, remove, set, update } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, ImageBackground, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { G, Path, Svg } from 'react-native-svg';
import { auth, db } from '../constants/firebaseConfig';

// Add types at the top:
type Teacher = {
  accountId: string;
  teacherId: string;
  name: string;
  email: string;
  school: string;
  contact: string;
  password?: string; // Only for registration, not stored in DB
  numClasses?: number;
  numStudents?: number;
  avgImprovement?: number;
};

type ChartData = { label: string; value: number; color: string };

const bgImage = require('../assets/images/bg.jpg');

export default function AdminDashboard() {
  const [modalVisible, setModalVisible] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const router = useRouter();
  const [newTeacher, setNewTeacher] = useState<Teacher>({ name: '', email: '', contact: '', school: '', password: '', accountId: '', teacherId: '' });
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherIdCounter, setTeacherIdCounter] = useState(0);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const windowWidth = Dimensions.get('window').width;
  const numColumns = windowWidth < 400 ? 1 : windowWidth < 600 ? 2 : 3;

  // Pie chart for effectiveness
  function EffectivenessPieChart({ data }: { data: ChartData[] }) {
    const size = 120;
    const radius = size / 2 - 8;
    const center = size / 2;
    const total = data.reduce((sum: number, d: ChartData) => sum + d.value, 0) || 1;
    let startAngle = 0;
    const arcs = data.map((d: ChartData, idx: number) => {
      const angle = (d.value / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const largeArc = angle > Math.PI ? 1 : 0;
      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);
      const path = [
        `M ${center} ${center}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ');
      startAngle = endAngle;
      return { path, color: d.color, label: d.label, value: d.value, idx };
    });
    return (
      <View style={{ alignItems: 'center', marginVertical: 10 }}>
        <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#222', marginBottom: 6 }}>App Effectiveness</Text>
        <Svg width={size} height={size}>
          <G>
            {arcs.map((arc: any) => (
              <Path key={arc.label + '-' + arc.idx} d={arc.path} fill={arc.color} />
            ))}
          </G>
        </Svg>
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 10 }}>
          {data.map((d: ChartData) => (
            <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
              <View style={{ width: 12, height: 12, backgroundColor: d.color, borderRadius: 6, marginRight: 4 }} />
              <Text style={{ fontSize: 13, color: '#222' }}>{d.label} ({d.value}%)</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Helper to generate next teacher ID
  async function generateNextTeacherId() {
    const snapshot = await get(ref(db, 'Teachers'));
    let maxNum = 0;
    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((t: any) => {
        if (t.teacherId && /^MTTG25-\d{3}$/.test(t.teacherId)) {
          const num = parseInt(t.teacherId.split('-')[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
    }
    return `MTTG25-${String(maxNum + 1).padStart(3, '0')}`;
  }

  // Register teacher handler (mock)
  async function handleRegisterTeacher() {
    if (!newTeacher.name || !newTeacher.email || !newTeacher.contact || !newTeacher.school || !newTeacher.password) {
      Alert.alert('All fields are required');
      return;
    }
    setModalVisible(false);
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, newTeacher.email, newTeacher.password!);
      const teacherUid = userCredential.user.uid;
      // 2. Generate system teacher ID
      const teacherId = await generateNextTeacherId();
      // 3. Save teacher details in Realtime DB
      const teacherData = {
        accountId: teacherUid,
        teacherId,
        name: newTeacher.name,
        email: newTeacher.email,
        contact: newTeacher.contact,
        school: newTeacher.school,
        // avgImprovement, numClasses, and numStudents removed for normalization
      };
      await set(ref(db, `Teachers/${teacherUid}`), teacherData);
      // 4. Add UID to Roles/Teacher
      await update(ref(db, 'Roles'), { [`Teacher/${teacherUid}`]: true });
      // 5. DO NOT update local state here! (Removed setTeachers to prevent duplicates)
      Alert.alert('Success', `${newTeacher.name} has been registered as a teacher.`);
      setNewTeacher({ name: '', email: '', contact: '', school: '', password: '', accountId: '', teacherId: '' });
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Could not register teacher.');
    }
  }

  // Delete teacher handler
  async function handleDeleteTeacher(teacher: Teacher) {
    Alert.alert(
      'Delete Teacher',
      `Are you sure you want to delete ${teacher.name}? This cannot be undone!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              // Remove only the selected teacher from DB
              await remove(ref(db, `Teachers/${teacher.accountId}`));
              await remove(ref(db, `Roles/Teacher/${teacher.accountId}`));
              // Remove only the selected teacher from local state
              setTeachers(prev => prev.filter(t => t.accountId !== teacher.accountId));
              setSelectedTeacher(null);
              setEditTeacher(null);
              setEditMode(false);
              Alert.alert('Deleted', `${teacher.name} has been deleted.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete teacher.');
            }
          }
        }
      ]
    );
  }

  // New Effectiveness Bar Chart component
  function EffectivenessBarChart({ data }: { data: ChartData[] }) {
    const windowWidth = Dimensions.get('window').width;
    const chartWidth = Math.min(windowWidth -90, 420);
    const barCount = data.length;
    const barSpacing = 14;
    const barWidth = Math.max(20, Math.floor((chartWidth - (barCount - 1) * barSpacing) / barCount));
    const maxValue = Math.max(...data.map((d: ChartData) => d.value), 1);
    const fontSizeLabel = windowWidth < 400 ? 10 : 14;
    const fontSizeValue = windowWidth < 400 ? 10 : 13;
    
    return (
      <View style={{ alignItems: 'center', width: '100%' }}>
        <View style={styles.chartHeader}>

          <Text style={styles.chartTitle}>App Effectiveness Overview</Text>
        </View>
        <View style={styles.chartContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, width: chartWidth, justifyContent: 'space-between', marginBottom: 16, marginTop: 8 }}>
            {data.map((d: ChartData, idx: number) => (
              <View key={d.label + '-' + idx} style={{ alignItems: 'center', flex: 1, marginHorizontal: barSpacing / 2 }}>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        height: (d.value / maxValue) * 75 + 20, 
                        width: barWidth, 
                        backgroundColor: d.color,
                        shadowColor: d.color,
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 3,
                      }
                    ]} 
                  />
                </View>
                <Text
                  style={[styles.barLabel, { fontSize: fontSizeLabel, minWidth: 48, textAlign: 'center' }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {d.label}
                </Text>
                <Text style={[styles.barValue, { fontSize: fontSizeValue }]}>{d.value}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.chartDescription}>Distribution of student improvement across all teachers</Text>
      </View>
    );
  }

  // Remove the static improvementDistribution and compute it from real data
  // Define green color palette for the bars
  const improvementBins = [
    { label: '0-10%', min: 0, max: 10, color: '#e6f4ea' },   // very light mint green
    { label: '11-25%', min: 11, max: 25, color: '#c2e8cd' }, // pale leafy green
    { label: '26-50%', min: 26, max: 50, color: '#a0d9b5' }, // soft balanced green
    { label: '51-75%', min: 51, max: 75, color: '#7ccc98' }, // mild mid-green
    { label: '76-100%', min: 76, max: 100, color: '#5bbd7d' } // muted emerald green
  ];
  

  // Compute improvement distribution from students
  const improvementDistribution: ChartData[] = (() => {
    // Calculate improvement for each student
    const improvements = students.map(stu => {
      const pre = typeof stu.preScore === 'number' ? stu.preScore : (stu.preScore?.pattern ?? 0) + (stu.preScore?.numbers ?? 0);
      const post = typeof stu.postScore === 'number' ? stu.postScore : (stu.postScore?.pattern ?? 0) + (stu.postScore?.numbers ?? 0);
      return pre > 0 ? Math.round(((post - pre) / pre) * 100) : 0;
    }).filter(impr => !isNaN(impr) && isFinite(impr) && impr >= 0);
    // Bin improvements
    return improvementBins.map(bin => ({
      label: bin.label,
      value: improvements.filter(impr => impr >= bin.min && impr <= bin.max).length,
      color: bin.color,
    }));
  })();

  // Load teachers from Realtime Database on mount
  useEffect(() => {
    const teachersRef = ref(db, 'Teachers');
    const unsubscribe = onValue(teachersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTeachers(Object.values(data));
      } else {
        setTeachers([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Add useEffect to fetch classes
  useEffect(() => {
    const classesRef = ref(db, 'Classes');
    const unsubscribe = onValue(classesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setClasses(Object.values(data));
      } else {
        setClasses([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Add useEffect to fetch students
  useEffect(() => {
    const studentsRef = ref(db, 'Students');
    const unsubscribe = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStudents(Object.values(data));
      } else {
        setStudents([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Replace the stats calculation with real aggregation:
  const teacherStats = teachers.map(teacher => {
    const teacherClasses = classes.filter(cls => cls.teacherId === teacher.teacherId);
    const teacherClassIds = teacherClasses.map(cls => cls.id);
    // Only students with a valid post test
    const teacherStudents = students.filter(
      stu => teacherClassIds.includes(stu.classId) &&
        stu.postScore && (
          (typeof stu.postScore === 'number' && !isNaN(stu.postScore))
          || (typeof stu.postScore === 'object' && (typeof stu.postScore.pattern === 'number' || typeof stu.postScore.numbers === 'number'))
        )
    );
    // Calculate average improvement for this teacher
    let avgImprovement = 0;
    let improvements: number[] = [];
    if (teacherStudents.length > 0) {
      improvements = teacherStudents.map(stu => {
        const pre = typeof stu.preScore === 'number' ? stu.preScore : (stu.preScore?.pattern ?? 0) + (stu.preScore?.numbers ?? 0);
        const post = typeof stu.postScore === 'number' ? stu.postScore : (stu.postScore?.pattern ?? 0) + (stu.postScore?.numbers ?? 0);
        return pre > 0 ? ((post - pre) / pre) * 100 : 0;
      });
      avgImprovement = Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
    }
    // Log for each teacher
    console.log(`Teacher: ${teacher.name}, Students with post test: ${teacherStudents.length}, Improvements: ${JSON.stringify(improvements)}, Avg: ${avgImprovement}`);
    return {
      ...teacher,
      numClasses: teacherClasses.length,
      numStudents: teacherStudents.length,
      avgImprovement,
      hasActiveStudents: teacherStudents.length > 0,
    };
  });

  // For dashboard stats, only include teachers with at least one student with a valid post test
  const activeTeacherStats = teacherStats.filter(t => t.hasActiveStudents);

  // Deduplicate teacherStats by accountId for rendering
  const uniqueTeacherStats = teacherStats.filter(
    (teacher, index, self) =>
      index === self.findIndex(t => t.accountId === teacher.accountId)
  );

  const stats = {
    totalTeachers: teachers.length,
    totalClasses: classes.length,
    totalStudents: students.length,
    avgImprovement: (() => {
      if (activeTeacherStats.length === 0) return 0;
      const avg = Math.round(
        activeTeacherStats.reduce((a, b) => a + (b.avgImprovement ?? 0), 0) / activeTeacherStats.length
      );
      // Log for dashboard
      console.log(
        'Dashboard avgImprovement computation:',
        activeTeacherStats.map(t => ({
          name: t.name,
          avgImprovement: t.avgImprovement
        })),
        'Dashboard avg:', avg
      );
      return avg;
    })(),
    avgPreTest: (() => {
      const preScores = students.map(stu => typeof stu.preScore === 'number' ? stu.preScore : (stu.preScore?.pattern ?? 0) + (stu.preScore?.numbers ?? 0));
      return preScores.length > 0 ? (preScores.reduce((a, b) => a + b, 0) / preScores.length).toFixed(1) : 0;
    })(),
    avgPostTest: (() => {
      const postScores = students.map(stu => typeof stu.postScore === 'number' ? stu.postScore : (stu.postScore?.pattern ?? 0) + (stu.postScore?.numbers ?? 0));
      return postScores.length > 0 ? (postScores.reduce((a, b) => a + b, 0) / postScores.length).toFixed(1) : 0;
    })(),
    passRate: (() => {
      // Example: pass if postScore >= 7
      const passed = students.filter(stu => {
        const post = typeof stu.postScore === 'number' ? stu.postScore : (stu.postScore?.pattern ?? 0) + (stu.postScore?.numbers ?? 0);
        return post >= 7;
      });
      return students.length > 0 ? Math.round((passed.length / students.length) * 100) : 0;
    })(),
    mostImprovedTeacher: activeTeacherStats.reduce((a, b) => ((a.avgImprovement ?? 0) > (b.avgImprovement ?? 0) ? a : b), activeTeacherStats[0] || {}),
    activeTeachers: activeTeacherStats.length,
    inactiveTeachers: teacherStats.length - activeTeacherStats.length,
  };

  return (
    <ImageBackground source={bgImage} style={{ flex: 1, backgroundColor: '#fff' }} imageStyle={{ opacity: 0.7, resizeMode: 'cover' }}>
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.92)' }} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={['left','right','bottom']}>
        <FlatList
          style={{ width: '100%' }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ width: '100%', paddingHorizontal: 12 }}>
              {/* Enhanced Header */}
              <BlurView intensity={80} tint="light" style={{ borderRadius: 0, marginBottom: 16, overflow: 'hidden' }}>
                <View style={[styles.headerWrap, { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 0, shadowColor: '#27ae60', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }]}> 
                  <View style={styles.headerRow}>
                    <View>
                      <Text style={{ fontSize: 24, fontWeight: '600', color: '#1a1a1a', letterSpacing: 0.5, marginTop:16, marginBottom:-6 }}>Welcome back,</Text>
                      <Text style={{ fontSize: 26, fontWeight: '800', color: '#27ae60', marginTop: 4, letterSpacing: 0.5 }}>Administrator</Text>
                      <Text style={{ fontSize: 14, color: '#666', marginTop: 4, fontWeight: '500' }}>Manage your educational platform</Text>
                    </View>
                    <TouchableOpacity style={styles.profileBtn} onPress={() => setShowProfileMenu(true)}>
                      <MaterialCommunityIcons name="account-cog" size={32} color="#27ae60" />
                    </TouchableOpacity>
                  </View>
                </View>
              </BlurView>
              
              {/* Modern 2x2 Stats Grid - Green Theme, White Card */}
              <View style={styles.statsModernCard}>
                <View style={styles.statsModernRow}>
                  <View style={styles.statsModernItem}>
                    <AntDesign name="user" size={32} color="#27ae60" style={styles.statsModernIcon} />
                    <Text style={styles.statsModernValue}>{stats.totalTeachers}</Text>
                    <Text style={styles.statsModernLabel}>Teachers</Text>
                  </View>
                  <View style={styles.statsModernItem}>
                    <MaterialCommunityIcons name="google-classroom" size={32} color="#27ae60" style={styles.statsModernIcon} />
                    <Text style={styles.statsModernValue}>{stats.totalClasses}</Text>
                    <Text style={styles.statsModernLabel}>Classes</Text>
                  </View>
                </View>
                <View style={styles.statsModernRow}>
                  <View style={styles.statsModernItem}>
                    <MaterialCommunityIcons name="account-group" size={32} color="#27ae60" style={styles.statsModernIcon} />
                    <Text style={styles.statsModernValue}>{stats.totalStudents}</Text>
                    <Text style={styles.statsModernLabel}>Students</Text>
                  </View>
                  <View style={styles.statsModernItem}>
                    <MaterialIcons name="trending-up" size={32} color="#27ae60" style={styles.statsModernIcon} />
                    <Text style={styles.statsModernValue}>+{stats.avgImprovement}%</Text>
                    <Text style={styles.statsModernLabel}>Avg. Impr.</Text>
                  </View>
                </View>
              </View>
              
              {/* Enhanced Chart Section */}
              <View style={styles.chartContainer}>
                <EffectivenessBarChart data={improvementDistribution} />
              </View>
              
              {/* Enhanced Section Header */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <Text style={styles.sectionTitle}>All Teachers</Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
                  <AntDesign name="adduser" size={20} color="#fff" />
                  <Text style={styles.addButtonText}>Add Teacher</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          data={uniqueTeacherStats}
          keyExtractor={(item, index) => item.accountId || item.teacherId || String(index)}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'flex-start' }}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => { setSelectedTeacher(item); setEditTeacher(item); setEditMode(false); }}
              activeOpacity={0.85}
              style={styles.teacherGridCard}
            >
              <View style={styles.teacherCardHeader}>
                <View style={styles.teacherAvatar}>
                  <Text style={styles.teacherAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.teacherCardInfo}>
                  <Text style={styles.teacherGridName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.teacherGridSchool} numberOfLines={1}>{item.school}</Text>
                  <Text style={styles.teacherGridId}>ID: {item.teacherId}</Text>
                </View>
              </View>
              <View style={styles.teacherCardStats}>
                <View style={styles.teacherStatItem}>
                  <MaterialCommunityIcons name="account-group" size={16} color="#27ae60" />
                  <Text style={styles.teacherStatValue}>{(item.numStudents).toString().padStart(1,'0')}</Text>
                  <Text
                    style={[styles.teacherStatLabel, { maxWidth: 90, textAlign: 'center' }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Students
                  </Text>
                </View>
                <View style={styles.teacherStatItem}>
                  <MaterialCommunityIcons name="google-classroom" size={16} color="#27ae60" />
                  <Text style={styles.teacherStatValue}>{(item.numClasses).toString().padStart(1,'0')}</Text>
                  <Text
                    style={[styles.teacherStatLabel, { maxWidth: 90, textAlign: 'center' }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Classes
                  </Text>
                </View>
                <View style={styles.teacherStatItem}>
                  <MaterialIcons
                    name={item.avgImprovement > 0 ? 'trending-up' : item.avgImprovement < 0 ? 'trending-down' : 'trending-flat'}
                    size={16}
                    color={item.avgImprovement > 0 ? '#27ae60' : item.avgImprovement < 0 ? '#ff5a5a' : '#ffe066'}
                  />
                  <Text
                    style={[
                      styles.teacherStatValue,
                      { color: item.avgImprovement > 0 ? '#27ae60' : item.avgImprovement < 0 ? '#ff5a5a' : '#ffe066' },
                    ]}
                  >
                    {(item.avgImprovement) > 0 ? '+' : ''}{item.avgImprovement}%
                  </Text>
                  <Text
                    style={[styles.teacherStatLabel, { maxWidth: 90, textAlign: 'center' }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Improvement
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
        {/* Register Teacher Modal */}
        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <MaterialCommunityIcons name="account-plus" size={28} color="#27ae60" style={{ marginRight: 12 }} />
                <Text style={styles.modalTitle}>Register New Teacher</Text>
              </View>
              <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                  <Text style={styles.modalLabel}>Full Name</Text>
                  <TextInput style={styles.modalInput} placeholder="Enter full name" value={newTeacher.name} onChangeText={v => setNewTeacher(t => ({ ...t, name: v }))} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.modalLabel}>Email</Text>
                  <TextInput style={styles.modalInput} placeholder="Enter email" value={newTeacher.email} onChangeText={v => setNewTeacher(t => ({ ...t, email: v }))} keyboardType="email-address" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.modalLabel}>Contact Number</Text>
                  <TextInput style={styles.modalInput} placeholder="Enter contact number" value={newTeacher.contact} onChangeText={v => setNewTeacher(t => ({ ...t, contact: v }))} keyboardType="phone-pad" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.modalLabel}>School</Text>
                  <TextInput style={styles.modalInput} placeholder="Enter school" value={newTeacher.school} onChangeText={v => setNewTeacher(t => ({ ...t, school: v }))} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.modalLabel}>Password</Text>
                  <TextInput style={styles.modalInput} placeholder="Enter password" value={newTeacher.password} onChangeText={v => setNewTeacher(t => ({ ...t, password: v }))} secureTextEntry />
                </View>
              </ScrollView>
              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleRegisterTeacher}>
                  <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Register</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* Teacher Details Modal */}
        <Modal visible={!!selectedTeacher} transparent animationType="fade" onRequestClose={() => setSelectedTeacher(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { padding: 0, overflow: 'hidden', shadowOpacity: 0.18, shadowRadius: 24, maxWidth: 370, width: '92%' }]}> 
              {/* Enhanced Header Bar */}
              <LinearGradient colors={['#27ae60', '#2ecc71']} style={{ paddingVertical: 20, alignItems: 'center', borderTopLeftRadius: 22, borderTopRightRadius: 22, flexDirection: 'row', justifyContent: 'center', position: 'relative' }}>
                <MaterialCommunityIcons name="account-tie" size={28} color="#fff" style={{ marginRight: 10 }} />
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 }}>Teacher Details</Text>
              </LinearGradient>
              <ScrollView style={{ maxHeight: 480, width: '100%' }} contentContainerStyle={{ padding: 24, backgroundColor: 'rgba(255,255,255,0.98)', borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }} showsVerticalScrollIndicator={false}>
              {editTeacher && (
                <>
                    <View style={styles.teacherIdSection}>
                      <Text style={styles.teacherIdLabel}>Teacher ID</Text>
                      <View style={styles.teacherIdContainer}>
                        <Text style={styles.teacherIdText}>{editTeacher.teacherId}</Text>
                      </View>
                      <Text style={styles.teacherIdLabel}>Account ID</Text>
                      <View style={styles.teacherIdContainer}>
                        <Text style={styles.accountIdText}>{editTeacher.accountId}</Text>
                      </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.inputGroup}>
                      <Text style={styles.modalLabel}>Full Name</Text>
                      <TextInput style={[styles.modalInput, editMode && styles.modalInputEditable]} editable={editMode} value={editTeacher.name} onChangeText={v => setEditTeacher(t => t ? { ...t, name: v } : null)} placeholder="Full Name" />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.modalLabel}>Email</Text>
                      <TextInput style={[styles.modalInput, editMode && styles.modalInputEditable]} editable={editMode} value={editTeacher.email} onChangeText={v => setEditTeacher(t => t ? { ...t, email: v } : null)} placeholder="Email" />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.modalLabel}>Contact Number</Text>
                      <TextInput style={[styles.modalInput, editMode && styles.modalInputEditable]} editable={editMode} value={editTeacher.contact} onChangeText={v => setEditTeacher(t => t ? { ...t, contact: v } : null)} placeholder="Contact Number" />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.modalLabel}>School</Text>
                      <TextInput style={[styles.modalInput, editMode && styles.modalInputEditable]} editable={editMode} value={editTeacher.school} onChangeText={v => setEditTeacher(t => t ? { ...t, school: v } : null)} placeholder="School" />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.teacherStatsGrid}>
                      {[
                        { label: 'Classes', value: editTeacher.numClasses ?? 0, icon: 'google-classroom', color: '#27ae60' },
                        { label: 'Students', value: editTeacher.numStudents ?? 0, icon: 'account-group', color: '#27ae60' },
                        { label: 'Avg. Improvement', value: (editTeacher.avgImprovement ?? 0) > 0
                          ? `+${editTeacher.avgImprovement ?? 0}%`
                          : (editTeacher.avgImprovement ?? 0) < 0
                            ? `${editTeacher.avgImprovement ?? 0}%`
                            : '0%', icon: 'trending-up', color: (editTeacher.avgImprovement ?? 0) > 0 ? '#27ae60' : (editTeacher.avgImprovement ?? 0) < 0 ? '#ff5a5a' : '#ffe066' }
                      ].map((stat, idx) => (
                        <View key={stat.label + '-' + idx} style={styles.teacherStatCard}>
                          <MaterialCommunityIcons name={stat.icon as any} size={20} color={stat.color} style={{ marginBottom: 4 }} />
                          <Text style={[styles.teacherStatValue, { color: stat.color }]}>{stat.value}</Text>
                          <Text style={[styles.teacherStatLabel, { maxWidth: 90, textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{stat.label}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.modalActionButtons}>
                      <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => { setSelectedTeacher(null); setEditMode(false); }}>
                        <Text style={[styles.modalBtnText, styles.modalBtnTextSecondary]}>Close</Text>
                      </TouchableOpacity>
                      {!editMode ? (
                        <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={() => setEditMode(true)}>
                          <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Edit</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={async () => {
                          try {
                            const current = teachers.find(t => t.accountId === editTeacher.accountId);
                            if (!current) throw new Error('Teacher not found');
                            const updated = {
                              ...current,
                              name: editTeacher.name,
                              email: editTeacher.email,
                              contact: editTeacher.contact,
                              school: editTeacher.school,
                            };
                            await set(ref(db, `Teachers/${editTeacher.accountId}`), updated);
                            setTeachers(prev => prev.map(t => t.accountId === editTeacher.accountId ? updated : t));
                            setSelectedTeacher(null);
                            setEditMode(false);
                          } catch (error) {
                            Alert.alert('Error', 'Failed to save changes.');
                          }
                        }}>
                          <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Save</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.modalBtn, styles.modalBtnDanger]} onPress={() => handleDeleteTeacher(editTeacher)}>
                        <Text style={[styles.modalBtnText, styles.modalBtnTextDanger]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                </>
              )}
              </ScrollView>
            </View>
          </View>
        </Modal>
        {/* Remove the Modal for profile menu. Instead, add this just before </SafeAreaView> at the end of the main return: */}
        {showProfileMenu && (
          <>
            {/* Overlay to close menu when clicking outside */}
            <TouchableOpacity
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
              activeOpacity={1}
              onPress={() => setShowProfileMenu(false)}
            />
            <View style={{
              position: 'absolute',
              top: 56, // adjust as needed to match the icon position
              right: 24, // adjust as needed to match the icon position
              backgroundColor: '#fff',
              borderRadius: 12,
              elevation: 20,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              minWidth: 140,
              zIndex: 10000
            }}>
              <TouchableOpacity
                onPress={async () => {
                  setShowProfileMenu(false);
                  try {
                    await auth.signOut();
                    router.replace('/RoleSelection');
                  } catch (e) {
                    Alert.alert('Logout Failed', 'Could not log out.');
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
              >
                <MaterialIcons name="logout" size={22} color="#ff5a5a" style={{ marginRight: 10 }} />
                <Text style={{ color: '#ff5a5a', fontWeight: 'bold', fontSize: 17 }}>Logout</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
    width: '100%',
    minHeight: '100%',
  },
  headerWrap: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 24,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    borderBottomWidth: 0.5,
    borderColor: '#e6e6e6',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 28,
    marginTop: 0,
    marginBottom: 0,
  },
  welcome: {
    fontSize: 23,
    fontWeight: '600',
    color: '#222',
    letterSpacing: 0.5,
  },
  adminName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#27ae60',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  profileBtn: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 24,
    padding: 8,
    elevation: 6,
    shadowColor: '#27ae60',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    gap: 12,
    alignSelf: 'center',
  },
  statsCard: {
    flex: 1,
    minWidth: 90,
    maxWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: 0,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  statsIcon: {
    marginBottom: 4,
  },
  statsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
  },
  statsLabel: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
    textAlign: 'center',
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27ae60',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 24,
    marginTop: 0,
    gap: 10,
    shadowColor: '#27ae60',
    shadowOpacity: 0.13,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  registerBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
    marginTop: 11,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  teacherGridCard: {
    width: '47.5%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginRight: 8,
    marginLeft: 4,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#27ae60',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  teacherCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teacherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#27ae60',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  teacherAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  teacherCardInfo: {
    flex: 1,
  },
  teacherCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teacherStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  teacherStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    marginTop: 2,
  },
  teacherStatLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
    marginTop: 2,
  },
  teacherGridName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#222',
    marginBottom: 0,
  },
  teacherGridSchool: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  teacherGridId: {
    color: '#888',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  teacherGridStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  teacherGridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  teacherGridStatNum: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#27ae60',
    marginLeft: 2,
  },
  teacherGridImprovementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  teacherGridImprovementText: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#27ae60',
    marginLeft: -3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: Dimensions.get('window').width < 400 ? '98%' : '85%',
    maxWidth: 420,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 22,
    padding: Dimensions.get('window').width < 400 ? 18 : 32,
    shadowColor: '#27ae60',
    shadowOpacity: 0.13,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    alignItems: 'stretch',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#27ae60',
    marginBottom: 0,
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalContent: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginTop: 4,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  modalBtn: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flex: 1,
    alignItems: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: '#27ae60',
    borderColor: '#27ae60',
  },
  modalBtnSecondary: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
  },
  modalBtnDanger: {
    backgroundColor: '#ff5a5a',
    borderColor: '#ff5a5a',
  },
  modalActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  modalBtnText: {
    color: '#444',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalBtnTextPrimary: {
    color: '#fff',
  },
  modalBtnTextSecondary: {
    color: '#666',
  },
  modalBtnTextDanger: {
    color: '#fff',
  },
  moreStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
    gap: 10,
    alignSelf: 'center',
  },
  moreStatsCard: {
    flex: 1,
    minWidth: 70,
    maxWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#f3f3f3',
    paddingVertical: 12,
    marginBottom: 0,
    marginHorizontal: 2,
    elevation: 1,
  },
  moreStatsLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginBottom: 2,
  },
  moreStatsValue: {
    fontSize: 16,
    color: '#27ae60',
    fontWeight: 'bold',
  },
  top3Card: {
    backgroundColor: '#e0ffe6',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    width: '100%',
    alignSelf: 'center',
    elevation: 2,
  },
  top3Title: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    marginBottom: 12,
  },
  top3List: {
    gap: 12,
  },
  top3Item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  top3First: {
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderRadius: 12,
    padding: 8,
    marginHorizontal: -8,
  },
  top3Rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  top3RankText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#222',
  },
  top3RankTextFirst: {
    backgroundColor: '#27ae60',
    color: '#fff',
  },
  top3Info: {
    flex: 1,
  },
  top3Name: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#222',
    marginBottom: 2,
  },
  top3NameFirst: {
    color: '#27ae60',
    fontSize: 18,
  },
  top3School: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  top3SchoolFirst: {
    color: '#27ae60',
  },
  top3Improvement: {
    fontSize: 14,
    color: '#222',
    fontWeight: '600',
  },
  top3ImprovementFirst: {
    color: '#27ae60',
  },
  teacherStat: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '600',
    marginBottom: 2,
  },
  modalLabel: {
    fontSize: 15,
    color: '#27ae60',
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 2,
  },
  teacherIdSection: {
    marginBottom: 16,
  },
  teacherIdLabel: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  teacherIdContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  teacherIdText: {
    color: '#27ae60',
    fontWeight: 'bold',
    fontSize: 15,
  },
  accountIdText: {
    color: '#666',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  divider: {
    borderBottomWidth: 1,
    borderColor: '#e6e6e6',
    marginBottom: 16,
  },
  modalInputEditable: {
    backgroundColor: '#f0f8f0',
    borderColor: '#27ae60',
  },
  teacherStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teacherStatCard: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
  },
  chartContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 8,
    marginTop: 18,
    marginVertical: 8,
    shadowColor: '#27ae60',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: -12,
    fontSize: 20,
    color: '#27ae60',
  },
  barContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 100,
  },
  bar: {
    borderRadius: 8,
    marginBottom: 8,
  },
  barLabel: {
    color: '#222',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
    fontSize: 12,
  },
  barValue: {
    color: '#888',
    textAlign: 'center',
    fontWeight: '500',
  },
  chartDescription: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27ae60',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#27ae60',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  statsModernCard: { backgroundColor: '#fff', marginTop: -22, borderRadius: 20, padding: 18, marginVertical: 0, shadowColor: '#27ae60', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, },
  statsModernRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, },
  statsModernItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, },
  statsModernIcon: { marginBottom: 2, },
  statsModernValue: { fontSize: 22, fontWeight: 'bold', color: '#27ae60', marginBottom: 2, },
  statsModernLabel: { fontSize: 13, color: '#666', fontWeight: '600', },
}); 