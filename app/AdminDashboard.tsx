import { AntDesign, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
  const [newTeacher, setNewTeacher] = useState<Teacher>({ name: '', email: '', contact: '', school: '', password: '', accountId: '', teacherId: '' });
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherIdCounter, setTeacherIdCounter] = useState(0);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);

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
    if (!newTeacher.name || !newTeacher.email || !newTeacher.contact || !newTeacher.school) {
      Alert.alert('All fields are required');
      return;
    }
    setModalVisible(false);
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, newTeacher.email, newTeacher.password);
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
        numClasses: newTeacher.numClasses ?? 0,
        numStudents: newTeacher.numStudents ?? 0,
        avgImprovement: newTeacher.avgImprovement ?? 0,
      };
      await set(ref(db, `Teachers/${teacherUid}`), teacherData);
      // 4. Add UID to Roles/Teacher
      await update(ref(db, 'Roles'), { [`Teacher/${teacherUid}`]: true });
      // 5. Update local state
      setTeachers(prev => [...prev, teacherData]);
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
    const chartWidth = Math.min(windowWidth - 48, 420); // 24px padding each side, max 420
    const barCount = data.length;
    const barSpacing = 12;
    const barWidth = Math.max(18, Math.floor((chartWidth - (barCount - 1) * barSpacing) / barCount));
    const maxValue = Math.max(...data.map((d: ChartData) => d.value), 1);
    const fontSizeLabel = windowWidth < 400 ? 11 : 13;
    const fontSizeValue = windowWidth < 400 ? 10 : 12;
    return (
      <View style={{ alignItems: 'center', marginVertical: 18, width: '100%' }}>
        <Text style={{ fontWeight: 'bold', fontSize: 20, color: '#27ae60', marginBottom: 8 }}>App Effectiveness Overview</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, width: chartWidth, justifyContent: 'space-between', marginBottom: 8, marginTop: 24 }}>
          {data.map((d: ChartData, idx: number) => (
            <View key={d.label + '-' + idx} style={{ alignItems: 'center', flex: 1, marginHorizontal: barSpacing / 2 }}>
              <View style={{ height: (d.value / maxValue) * 100 + 10, width: barWidth, backgroundColor: d.color, borderRadius: 8, marginBottom: 4 }} />
              <Text style={{ fontSize: fontSizeLabel, color: '#222', fontWeight: '600', textAlign: 'center' }}>{d.label}</Text>
              <Text style={{ fontSize: fontSizeValue, color: '#888', textAlign: 'center' }}>{d.value}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 13, color: '#444', marginTop: 2, textAlign: 'center' }}>Distribution of student improvement across all teachers</Text>
      </View>
    );
  }

  // New improvement distribution data
  const improvementDistribution = [
    { label: '0-10%', value: 2, color: '#ffb37b' },
    { label: '11-25%', value: 5, color: '#ffe066' },
    { label: '26-50%', value: 8, color: '#7ed957' },
    { label: '51-75%', value: 4, color: '#27ae60' },
    { label: '76-100%', value: 1, color: '#0097a7' },
  ];

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

  // Remove all references to mockStats and use derived values from teachers
  const stats = {
    totalTeachers: teachers.length,
    totalClasses: teachers.reduce((sum, t) => sum + (t.numClasses ?? 0), 0),
    totalStudents: teachers.reduce((sum, t) => sum + (t.numStudents ?? 0), 0),
    avgPreTest: 5.2, // placeholder, update if you have real data
    avgPostTest: 7.1, // placeholder, update if you have real data
    passRate: 82, // placeholder, update if you have real data
    mostImprovedTeacher: teachers.reduce((a, b) => ((a.avgImprovement ?? 0) > (b.avgImprovement ?? 0) ? a : b), teachers[0] || {}),
    activeTeachers: teachers.length - 1, // placeholder
    inactiveTeachers: 1, // placeholder
  };

  return (
    <ImageBackground source={bgImage} style={{ flex: 1, backgroundColor: '#fff' }} imageStyle={{ opacity: 0.5, resizeMode: 'cover' }}>
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.45)' }} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }}>
        <FlatList
          style={{ width: '100%' }}
          ListHeaderComponent={
            <View style={{ width: '100%', paddingHorizontal: 16 }}>
              <BlurView intensity={60} tint="light" style={{ borderRadius: 28, marginBottom: 18, overflow: 'hidden' }}>
                <View style={[styles.headerWrap, { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 28, shadowColor: '#27ae60', shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }]}> 
                  <View style={styles.headerRow}>
                    <View>
                      <Text style={{ fontSize: 23, fontWeight: '600', color: '#222', letterSpacing: 0.5 }}>Welcome,</Text>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: '#27ae60', marginTop: 2, letterSpacing: 0.5 }}>Admin</Text>
                    </View>
                    <TouchableOpacity style={styles.profileBtn}>
                      <MaterialCommunityIcons name="account-cog" size={38} color="#27ae60" />
                    </TouchableOpacity>
                  </View>
                </View>
              </BlurView>
              {/* Stats Row */}
              <View style={styles.statsRow}>
                <LinearGradient colors={['#e0ffe6', '#c6f7e2']} style={styles.statsCard}>
                  <AntDesign name="user" size={28} color="#27ae60" style={styles.statsIcon} />
                  <Text style={styles.statsValue}>{stats.totalTeachers}</Text>
                  <Text style={styles.statsLabel}>Teachers</Text>
                </LinearGradient>
                <LinearGradient colors={['#e0f7fa', '#b2ebf2']} style={styles.statsCard}>
                  <MaterialCommunityIcons name="google-classroom" size={28} color="#0097a7" style={styles.statsIcon} />
                  <Text style={styles.statsValue}>{stats.totalClasses}</Text>
                  <Text style={styles.statsLabel}>Classes</Text>
                </LinearGradient>
                <LinearGradient colors={['#fffde4', '#ffe066']} style={styles.statsCard}>
                  <MaterialCommunityIcons name="account-group" size={28} color="#ffb300" style={styles.statsIcon} />
                  <Text style={styles.statsValue}>{stats.totalStudents}</Text>
                  <Text style={styles.statsLabel}>Students</Text>
                </LinearGradient>
                <LinearGradient colors={['#e0ffe6', '#fff']} style={styles.statsCard}>
                  <MaterialIcons name="trending-up" size={28} color="#27ae60" style={styles.statsIcon} />
                  <Text style={[styles.statsValue, { color: '#27ae60' }]}>+{stats.avgImprovement}%</Text>
                  <Text style={styles.statsLabel}>Avg. Improvement</Text>
                </LinearGradient>
              </View>
              {/* More statistical cards */}
              <View style={styles.moreStatsRow}>
                <View style={styles.moreStatsCard}>
                  <Text style={styles.moreStatsLabel}>Pass Rate</Text>
                  <Text style={styles.moreStatsValue}>{stats.passRate}%</Text>
                </View>
                <View style={styles.moreStatsCard}>
                  <Text style={styles.moreStatsLabel}>Avg. Pre-test</Text>
                  <Text style={styles.moreStatsValue}>{stats.avgPreTest}</Text>
                </View>
                <View style={styles.moreStatsCard}>
                  <Text style={styles.moreStatsLabel}>Avg. Post-test</Text>
                  <Text style={styles.moreStatsValue}>{stats.avgPostTest}</Text>
                </View>
                <View style={styles.moreStatsCard}>
                  <Text style={styles.moreStatsLabel}>Active</Text>
                  <Text style={styles.moreStatsValue}>{stats.activeTeachers}</Text>
                </View>
                <View style={styles.moreStatsCard}>
                  <Text style={styles.moreStatsLabel}>Inactive</Text>
                  <Text style={styles.moreStatsValue}>{stats.inactiveTeachers}</Text>
                </View>
              </View>
              <EffectivenessBarChart data={improvementDistribution} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop:2, marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>All Teachers</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={{ padding: 6, borderRadius: 20 }}>
                  <AntDesign name="adduser" size={24} color="#27ae60" />
                </TouchableOpacity>
              </View>
            </View>
          }
          data={teachers}
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
              <View style={{ flex: 1, marginLeft: 0, minWidth: 0 }}>
                <Text style={styles.teacherGridName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.teacherGridSchool} numberOfLines={1}>{item.school}</Text>
                <Text style={styles.teacherGridId}>ID: {item.teacherId}</Text>
                <View style={styles.teacherGridStatsRow}>
                  <View style={styles.teacherGridStat}><MaterialCommunityIcons name="account-group" size={18} color="#27ae60" /><Text style={styles.teacherGridStatNum}> {(item.numStudents ?? 0).toString().padStart(2,'0')}</Text></View>
                  <View style={styles.teacherGridStat}><MaterialCommunityIcons name="google-classroom" size={18} color="#3a3a3a" /><Text style={styles.teacherGridStatNum}> {(item.numClasses ?? 0).toString().padStart(2,'0')}</Text></View>
                  <View style={styles.teacherGridImprovementRow}>
                    <MaterialIcons
                      name={item.avgImprovement > 0 ? 'trending-up' : item.avgImprovement < 0 ? 'trending-down' : 'trending-flat'}
                      size={16}
                      color={item.avgImprovement > 0 ? '#27ae60' : item.avgImprovement < 0 ? '#ff5a5a' : '#ffe066'}
                    />
                    <Text
                      style={[
                        styles.teacherGridImprovementText,
                        { color: item.avgImprovement > 0 ? '#27ae60' : item.avgImprovement < 0 ? '#ff5a5a' : '#ffe066', marginLeft: -3 },
                      ]}
                    >
                      {(item.avgImprovement ?? 0) > 0 ? '+' : ''}{item.avgImprovement ?? 0}%
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
        {/* Register Teacher Modal */}
        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Register New Teacher</Text>
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.modalLabel}>Full Name</Text>
                <TextInput style={styles.modalInput} placeholder="Enter full name" value={newTeacher.name} onChangeText={v => setNewTeacher(t => ({ ...t, name: v }))} />
              </View>
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.modalLabel}>Email</Text>
                <TextInput style={styles.modalInput} placeholder="Enter email" value={newTeacher.email} onChangeText={v => setNewTeacher(t => ({ ...t, email: v }))} keyboardType="email-address" />
              </View>
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.modalLabel}>Contact Number</Text>
                <TextInput style={styles.modalInput} placeholder="Enter contact number" value={newTeacher.contact} onChangeText={v => setNewTeacher(t => ({ ...t, contact: v }))} keyboardType="phone-pad" />
              </View>
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.modalLabel}>School</Text>
                <TextInput style={styles.modalInput} placeholder="Enter school" value={newTeacher.school} onChangeText={v => setNewTeacher(t => ({ ...t, school: v }))} />
              </View>
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.modalLabel}>Password</Text>
                <TextInput style={styles.modalInput} placeholder="Enter password" value={newTeacher.password} onChangeText={v => setNewTeacher(t => ({ ...t, password: v }))} secureTextEntry />
              </View>
              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setModalVisible(false)}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleRegisterTeacher}><Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Register</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* Teacher Details Modal */}
        <Modal visible={!!selectedTeacher} transparent animationType="fade" onRequestClose={() => setSelectedTeacher(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { padding: 0, overflow: 'hidden', shadowOpacity: 0.18, shadowRadius: 24, maxWidth: 370, width: '92%' }]}> 
              {/* Header Bar */}
              <View style={{ backgroundColor: '#27ae60', paddingVertical: 18, alignItems: 'center', borderTopLeftRadius: 22, borderTopRightRadius: 22, flexDirection: 'row', justifyContent: 'center', position: 'relative' }}>
                <MaterialCommunityIcons name="account-tie" size={32} color="#fff" style={{ marginRight: 10 }} />
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', letterSpacing: 0.5 }}>Teacher Details</Text>
              </View>
              <ScrollView style={{ maxHeight: 480, width: '100%' }} contentContainerStyle={{ padding: 20, backgroundColor: 'rgba(255,255,255,0.98)', borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }}>
              {editTeacher && (
                <>
                    <View style={{ marginBottom: 10 }}>
                      <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 2 }}>Teacher ID</Text>
                      <View style={{ backgroundColor: '#f3f3f3', borderRadius: 8, padding: 8, marginBottom: 4 }}>
                        <Text style={{ color: '#bbb', fontWeight: 'bold', fontSize: 15 }}>{editTeacher.teacherId}</Text>
                      </View>
                      <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 2 }}>Account ID</Text>
                      <View style={{ backgroundColor: '#f3f3f3', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                        <Text style={{ color: '#bbb', fontSize: 13 }}>{editTeacher.accountId}</Text>
                      </View>
                    </View>
                    <View style={{ borderBottomWidth: 1, borderColor: '#e6e6e6', marginBottom: 12 }} />
                    <View style={{ marginBottom: 10 }}>
                      <Text style={styles.modalLabel}>Full Name</Text>
                      <TextInput style={[styles.modalInput, { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e0f7e2' }]} editable={editMode} value={editTeacher.name} onChangeText={v => setEditTeacher(t => t ? { ...t, name: v } : null)} placeholder="Full Name" />
                    </View>
                    <View style={{ marginBottom: 10 }}>
                      <Text style={styles.modalLabel}>Email</Text>
                      <TextInput style={[styles.modalInput, { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e0f7e2' }]} editable={editMode} value={editTeacher.email} onChangeText={v => setEditTeacher(t => t ? { ...t, email: v } : null)} placeholder="Email" />
                    </View>
                    <View style={{ marginBottom: 10 }}>
                      <Text style={styles.modalLabel}>Contact Number</Text>
                      <TextInput style={[styles.modalInput, { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e0f7e2' }]} editable={editMode} value={editTeacher.contact} onChangeText={v => setEditTeacher(t => t ? { ...t, contact: v } : null)} placeholder="Contact Number" />
                    </View>
                    <View style={{ marginBottom: 18 }}>
                      <Text style={styles.modalLabel}>School</Text>
                      <TextInput style={[styles.modalInput, { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e0f7e2' }]} editable={editMode} value={editTeacher.school} onChangeText={v => setEditTeacher(t => t ? { ...t, school: v } : null)} placeholder="School" />
                    </View>
                    <View style={{ borderBottomWidth: 1, borderColor: '#e6e6e6', marginBottom: 12 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                      {[
                        { label: 'Classes', value: editTeacher.numClasses ?? 0, color: '#27ae60' },
                        { label: 'Students', value: editTeacher.numStudents ?? 0, color: '#27ae60' },
                        { label: 'Avg. Improvement', value: (editTeacher.avgImprovement ?? 0) > 0 ? '+' : '' + (editTeacher.avgImprovement ?? 0) + '%', color: (editTeacher.avgImprovement ?? 0) > 0 ? '#27ae60' : (editTeacher.avgImprovement ?? 0) < 0 ? '#ff5a5a' : '#ffe066' }
                      ].map((stat, idx) => (
                        <View key={stat.label + '-' + idx} style={{ alignItems: 'center', flex: 1 }}>
                          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600' }}>{stat.label}</Text>
                          <Text style={{ color: stat.color, fontWeight: 'bold', fontSize: 16 }}>{stat.value}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                      <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#e6e6e6', flex: 1 }]} onPress={() => { setSelectedTeacher(null); setEditMode(false); }}><Text style={[styles.modalBtnText, { color: '#444' }]}>Close</Text></TouchableOpacity>
                    {!editMode ? (
                        <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary, { flex: 1 }]} onPress={() => setEditMode(true)}><Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Edit</Text></TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary, { flex: 1 }]} onPress={async () => {
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
                      }}><Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Save</Text></TouchableOpacity>
                    )}
                      <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ff5a5a', flex: 1 }]} onPress={() => handleDeleteTeacher(editTeacher)}>
                        <Text style={[styles.modalBtnText, { color: '#fff' }]}>Delete</Text>
                      </TouchableOpacity>
                  </View>
                </>
              )}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
    paddingTop: 32,
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
    marginTop: 24,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  teacherGridCard: {
    width: '47.5%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginRight: 8,
    marginLeft: 4,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
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
    fontSize: 12,
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
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 14,
    color: '#222',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 6,
  },
  modalBtn: {
    backgroundColor: '#e6e6e6',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 22,
    marginLeft: 8,
  },
  modalBtnPrimary: {
    backgroundColor: '#27ae60',
  },
  modalBtnText: {
    color: '#444',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalBtnTextPrimary: {
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
}); 