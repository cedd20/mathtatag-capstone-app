import { Feather, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, onValue, ref, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../constants/firebaseConfig';
const bgImage = require('../assets/images/bg.jpg');

const { width } = Dimensions.get('window');



// Helper to get status from score (copied from TeacherDashboard)
function getStatusFromScore(score: number, total: number, pattern: number, numbers: number) {
  if ((pattern ?? 0) === 0 && (numbers ?? 0) === 0) return 'Not yet taken';
  if (typeof score !== 'number' || typeof total !== 'number' || total === 0 || score === -1) return 'Not yet taken';
  const percent = (score / total) * 100;
  if (percent < 25) return 'Intervention';
  if (percent < 50) return 'For Consolidation';
  if (percent < 75) return 'For Enhancement';
  if (percent < 85) return 'Proficient';
  return 'Highly Proficient';
}
const statusColors: any = {
  'Intervention': '#ff5a5a',
  'For Consolidation': '#ffb37b',
  'For Enhancement': '#ffe066',
  'Proficient': '#7ed957',
  'Highly Proficient': '#27ae60',
  'Not yet taken': '#888',
};

const incomeBrackets = [
  '₱10,000 and below',
  '₱10,001–15,000',
  '₱15,001–20,000',
  '₱20,001–25,000',
  '₱25,001 and above',
];

// Task recommendation logic based on scores and income
const generateTaskRecommendations = (patternScore: number, numbersScore: number, incomeBracket: string) => {
  const totalScore = patternScore + numbersScore;
  const averageScore = totalScore / 2;
  
  // Map income bracket to numeric value for calculations
  const incomeMap: { [key: string]: number } = {
    '₱10,000 and below': 1,
    '₱10,001–15,000': 2,
    '₱15,001–20,000': 3,
    '₱20,001–25,000': 4,
    '₱25,001 and above': 5,
  };
  
  const incomeLevel = incomeMap[incomeBracket] || 1;
  
  const tasks = [];
  
  // Pattern-focused tasks
  if (patternScore < 5) {
    tasks.push({
      title: 'Basic Pattern Recognition',
      status: 'notdone',
      details: 'Practice identifying simple patterns in sequences. Start with basic shapes and colors.',
      priority: 'high',
      category: 'pattern'
    });
  } else if (patternScore < 8) {
    tasks.push({
      title: 'Intermediate Pattern Practice',
      status: 'notdone',
      details: 'Work on more complex patterns and sequences. Include number patterns.',
      priority: 'medium',
      category: 'pattern'
    });
  } else {
    tasks.push({
      title: 'Advanced Pattern Challenges',
      status: 'notdone',
      details: 'Tackle complex pattern recognition and prediction exercises.',
      priority: 'low',
      category: 'pattern'
    });
  }
  
  // Numbers-focused tasks
  if (numbersScore < 5) {
    tasks.push({
      title: 'Basic Number Operations',
      status: 'notdone',
      details: 'Practice basic addition and subtraction with visual aids.',
      priority: 'high',
      category: 'numbers'
    });
  } else if (numbersScore < 8) {
    tasks.push({
      title: 'Intermediate Number Work',
      status: 'notdone',
      details: 'Practice mental math and quick calculations.',
      priority: 'medium',
      category: 'numbers'
    });
  } else {
    tasks.push({
      title: 'Advanced Number Challenges',
      status: 'notdone',
      details: 'Complex problem-solving with numbers and word problems.',
      priority: 'low',
      category: 'numbers'
    });
  }
  
  // Income-based tasks (more resources for higher income)
  if (incomeLevel >= 4) {
    tasks.push({
      title: 'Technology-Enhanced Learning',
      status: 'notdone',
      details: 'Use educational apps and online resources for interactive learning.',
      priority: 'medium',
      category: 'technology'
    });
  } else {
    tasks.push({
      title: 'Low-Cost Learning Activities',
      status: 'notdone',
      details: 'Use household items and free resources for hands-on learning.',
      priority: 'high',
      category: 'practical'
    });
  }
  
  // Mixed practice for balanced improvement
  if (Math.abs(patternScore - numbersScore) > 3) {
    tasks.push({
      title: 'Balanced Skill Development',
      status: 'notdone',
      details: 'Focus on the weaker area while maintaining strength in the stronger area.',
      priority: 'high',
      category: 'mixed'
    });
  }
  
  // Remedial work for very low scores
  if (totalScore < 8) {
    tasks.push({
      title: 'Foundation Building',
      status: 'notdone',
      details: 'Build basic mathematical concepts and confidence through simple activities.',
      priority: 'high',
      category: 'remedial'
    });
  }
  
  // Sort by priority (high first)
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  tasks.sort((a, b) => priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder]);
  
  return tasks;
};

export default function ParentDashboard() {
  const router = useRouter();
  const { parentId, needsSetup } = useLocalSearchParams();
  const [parentData, setParentData] = useState<any>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupContact, setSetupContact] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [focusedAnnouncement, setFocusedAnnouncement] = useState<any | null>(null);
  const [changeModalVisible, setChangeModalVisible] = useState(false);
  const [changeTaskIdx, setChangeTaskIdx] = useState<number | null>(null);
  const [changeReason, setChangeReason] = useState<string>('');
  const [changeReasonOther, setChangeReasonOther] = useState<string>('');
  const [teachers, setTeachers] = useState<any>({});
  const [teachersById, setTeachersById] = useState<any>({});
  const [studentData, setStudentData] = useState<any>(null);
  const [setupIncome, setSetupIncome] = useState('');
  const [incomeDropdownVisible, setIncomeDropdownVisible] = useState(false);

  React.useEffect(() => {
    if (!parentId) return;
    const fetchParentAndAnnouncements = async () => {
      const parentRef = ref(db, `Parents/${parentId}`);
      const snap = await get(parentRef);
      if (snap.exists()) {
        const data = snap.val();
        setParentData(data);
        if (!data.name || !data.contact || needsSetup === '1') {
          setShowSetupModal(true);
          setSetupName(data.name || '');
          setSetupContact(data.contact || '');
          setSetupIncome(data.householdIncome || incomeBrackets[0]);
        }
        // Use studentId to get classid
        if (data.studentId) {
          const studentRef = ref(db, `Students/${data.studentId}`);
          const studentSnap = await get(studentRef);
          if (studentSnap.exists()) {
            const studentData = studentSnap.val();
            const classid = studentData.classId;
            if (classid) {
              const annRef = ref(db, 'Announcements');
              onValue(annRef, (snapshot) => {
                const all = snapshot.val() || {};
                const filtered = Object.values(all).filter((a: any) => a.classid === classid);
                filtered.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
                setAnnouncements(filtered);
              });
            }
          }
        }
      }
    };
    fetchParentAndAnnouncements();
  }, [parentId, needsSetup]);

  // Fetch teachers on mount
  useEffect(() => {
    const teachersRef = ref(db, 'Teachers');
    get(teachersRef).then(snap => {
      if (snap.exists()) {
        const all = snap.val();
        setTeachers(all);
        // Build a mapping from teacherId to teacher object
        const byId: any = {};
        Object.values(all).forEach((t: any) => {
          if (t.teacherId) byId[t.teacherId] = t;
        });
        setTeachersById(byId);
      }
    });
  }, []);

  // Fetch student data when parentData.studentId is available
  useEffect(() => {
    if (parentData?.studentId) {
      const fetchStudent = async () => {
        const snap = await get(ref(db, `Students/${parentData.studentId}`));
        if (snap.exists()) {
          const student = snap.val();
          setStudentData(student);
          
          // Generate task recommendations if pretest scores exist
          if (student?.preScore?.pattern !== undefined && student?.preScore?.numbers !== undefined) {
            const patternScore = student.preScore.pattern || 0;
            const numbersScore = student.preScore.numbers || 0;
            const incomeBracket = parentData?.householdIncome || incomeBrackets[0];
            
            // Only generate tasks if there are actual scores (not just zeros)
            if (patternScore > 0 || numbersScore > 0) {
              const recommendations = generateTaskRecommendations(patternScore, numbersScore, incomeBracket);
              console.log('Generated tasks:', recommendations.length, 'for scores:', patternScore, numbersScore, 'income:', incomeBracket);
              setTasks(recommendations);
            } else {
              console.log('No tasks generated - no scores available');
              setTasks([]); // No tasks if no scores
            }
          } else {
            setTasks([]); // No tasks if no scores
          }
        }
      };
      fetchStudent();
    }
  }, [parentData?.studentId, parentData?.householdIncome]);

  const handleSetupSubmit = async () => {
    if (!setupName.trim() || !setupContact.trim()) {
      Alert.alert('Please enter your name and contact number.');
      return;
    }
    setSetupLoading(true);
    try {
      const parentRef = ref(db, `Parents/${parentId}`);
      await set(parentRef, {
        ...parentData,
        name: setupName.trim(),
        contact: setupContact.trim(),
        householdIncome: setupIncome,
      });
      setParentData((prev: any) => ({ ...prev, name: setupName.trim(), contact: setupContact.trim(), householdIncome: setupIncome }));
      setShowSetupModal(false);
      Alert.alert('Profile updated!');
    } catch (err) {
      Alert.alert('Failed to update profile.');
    }
    setSetupLoading(false);
  };

  // Placeholder data
  const parentLRN = 'PARENT108756090030';
  const teacher = {
    name: 'Mrs. Loteriña',
    grade: 'Grade 1 Teacher',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    announcement: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam fermentum vestibulum lectus, eget eleifend tellus dignissim non. Praesent ultrices faucibus condimentum.'
  };
  const pretest = { percent: 35, score: 3, total: 10 };
  const posttest = { percent: 0, score: 0, total: 10 };
  const [tasks, setTasks] = useState<any[]>([]);

  // Calculate overall progress
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const progressPercent = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  // Task status label
  const statusLabel = (status: string) => {
    if (status === 'done') return 'Done';
    if (status === 'ongoing') return 'Ongoing';
    return 'Not Done';
  };

  // Handle task click
  const handleTaskPress = (idx: number) => {
    const task = tasks[idx];
    if (task.status === 'done') return;
    if (task.status === 'notdone') {
      Alert.alert(
        'Start Task',
        `Mark "${task.title}" as Ongoing?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              const newTasks = [...tasks];
              newTasks[idx] = { ...newTasks[idx], status: 'ongoing' };
              setTasks(newTasks);
            },
          },
        ]
      );
    } else if (task.status === 'ongoing') {
      Alert.alert(
        'Finish Task',
        `Mark "${task.title}" as Done?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              const newTasks = [...tasks];
              newTasks[idx] = { ...newTasks[idx], status: 'done' };
              setTasks(newTasks);
            },
          },
        ]
      );
    }
  };

  // Handle post-test click
  const handlePostTest = () => {
    if (doneCount !== tasks.length) {
      Alert.alert('Cannot Start Post-Test', 'You must finish all tasks before starting the post-test.');
      return;
    }
    // Proceed to post-test
  };

  // Add a placeholder user profile image
  const userProfile = {
    name: 'Parent User',
    avatar: 'https://randomuser.me/api/portraits/men/99.jpg',
  };

  // Handler for announcement click
  const handleAnnouncementPress = (announcement: any) => {
    setFocusedAnnouncement(announcement);
    setModalVisible(true);
  };

  // Handle change button click
  const handleChangePress = (idx: number) => {
    Alert.alert(
      'Request Change',
      `Are you sure you want to request a change for "${tasks[idx].title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            setChangeTaskIdx(idx);
            setChangeModalVisible(true);
          },
        },
      ]
    );
  };

  // Handle submit reason
  const handleSubmitChangeReason = () => {
    let reason = changeReason;
    if (changeReason === 'Other') {
      reason = changeReasonOther;
    }
    setChangeModalVisible(false);
    setChangeReason('');
    setChangeReasonOther('');
    setChangeTaskIdx(null);
    Alert.alert('Change Requested', `Reason: ${reason}`);
  };

  // In the announcement modal and list, format date and time
  function formatDateTime(iso: string) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // In the render, extract last name from parentData.name
  const parentLastName = parentData?.name ? parentData.name.trim().split(' ').slice(-1)[0] : '';

  // Prefill setup fields every time the modal opens (for edit)
  useEffect(() => {
    if (showSetupModal && parentData) {
      setSetupName(parentData.name || '');
      setSetupContact(parentData.contact || '');
      setSetupIncome(parentData.householdIncome || incomeBrackets[0]);
    }
  }, [showSetupModal, parentData]);

  // In Pretest and Post-test status badge:
  const prePattern = studentData?.preScore?.pattern ?? 0;
  const preNumbers = studentData?.preScore?.numbers ?? 0;
  const preScore = prePattern + preNumbers;
  const preStatus = getStatusFromScore(preScore, 20, prePattern, preNumbers);
  const postPattern = studentData?.postScore?.pattern ?? 0;
  const postNumbers = studentData?.postScore?.numbers ?? 0;
  const postScore = postPattern + postNumbers;
  const postStatus = getStatusFromScore(postScore, 20, postPattern, postNumbers);

  return (
    <ImageBackground source={bgImage} style={styles.bg} imageStyle={{ opacity: 0.13, resizeMode: 'cover' }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 32 }}>
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.welcome}>Mabuhay!</Text>
              <Text style={styles.lrn}>Mr/Mrs. {parentLastName || parentData?.name || ''}</Text>
            </View>
            <TouchableOpacity style={styles.profileBtn} onPress={() => setShowSetupModal(true)}>
              <MaterialIcons name="account-circle" size={48} color="#2ecc40" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Announcements</Text>
          <View style={styles.greenDot} />
        </View>
        {/* Horizontal scrollable announcements */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.announcementScroll}
          contentContainerStyle={{ paddingLeft: 8, paddingRight: 8 }}
        >
          {announcements.length === 0 ? (
            <View style={[styles.announcementBox, { justifyContent: 'center', alignItems: 'center' }]}> 
              <Text style={{ color: '#888', fontSize: 15 }}>No announcements yet.</Text>
            </View>
          ) : (
            announcements.map((a, idx) => (
              <TouchableOpacity
                key={a.announcementid}
                style={[styles.announcementBox, { marginRight: idx === announcements.length - 1 ? 0 : 16 }]}
                activeOpacity={0.85}
                onPress={() => handleAnnouncementPress(a)}
              >
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#27ae60', marginBottom: 4 }}>{a.title}</Text>
                <Text style={{ fontSize: 13, color: '#444', marginBottom: 2 }}>Mula kay Teacher {teachersById[a.teacherid]?.name || a.teacherid}</Text>
                <View style={styles.announcementTextScrollWrap}>
                  <ScrollView style={styles.announcementTextScroll} showsVerticalScrollIndicator={false}>
                    <Text style={styles.announcementText} numberOfLines={3} ellipsizeMode="tail">{a.message}</Text>
                  </ScrollView>
                </View>
                <Text style={styles.announcementDate}>{formatDateTime(a.date)}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Modal for focused announcement */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <BlurView intensity={60} tint="light" style={styles.modalBlur}>
            <View style={styles.modalCenterWrap}>
              <View style={styles.modalAnnouncementBox}>
                <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#27ae60', marginBottom: 8 }}>{focusedAnnouncement?.title}</Text>
                <Text style={{ fontSize: 15, color: '#444', marginBottom: 2 }}>Teacher {teachersById[focusedAnnouncement?.teacherid]?.name || focusedAnnouncement?.teacherid}</Text>
                <Text style={styles.modalAnnouncementText}>{focusedAnnouncement?.message}</Text>
                <Text style={styles.announcementDate}>{formatDateTime(focusedAnnouncement?.date)}</Text>
                <Pressable style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </Modal>

        <View style={styles.progressRowCardWrap}>
          <View style={styles.progressCardSingle}>
            <View style={styles.progressCol}>
              <View style={styles.circleWrap}>
                <View style={[styles.circle, { borderColor: '#2ecc40' }] }>
                  <Text style={[styles.circleText, { color: '#2ecc40', fontSize: 28, fontWeight: 'bold' }]}>{studentData ? Math.round(((studentData.preScore?.pattern ?? 0) + (studentData.preScore?.numbers ?? 0)) / 20 * 100) : 0}%</Text>
                </View>
              </View>
              <Text style={styles.progressLabel}>Pretest</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0097a7', marginTop: 2 }}>{studentData ? `${preScore}/20` : '0/20'}</Text>
              <Text style={{ fontSize: 13, color: '#777', marginTop: 2 }}>Pattern: {prePattern}/10</Text>
              <Text style={{ fontSize: 13, color: '#777', marginTop: 2 }}>Numbers: {preNumbers}/10</Text>
              {/* Status badge */}
              <View style={{ backgroundColor: statusColors[preStatus], borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4, alignSelf: 'flex-start' }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{preStatus}</Text>
              </View>
            </View>
          </View>
          <View style={styles.progressCardSingle}>
            <View style={styles.progressCol}>
              <View style={styles.circleWrap}>
                <View style={[styles.circle, { borderColor: '#2ecc40' }] }>
                  <Text style={[styles.circleText, { color: '#2ecc40', fontSize: 28, fontWeight: 'bold' }]}>{studentData ? Math.round(((studentData.postScore?.pattern ?? 0) + (studentData.postScore?.numbers ?? 0)) / 20 * 100) : 0}%</Text>
                </View>
              </View>
              <Text style={styles.progressLabel}>Post-test</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0097a7', marginTop: 2 }}>{studentData ? `${postScore}/20` : '0/20'}</Text>
              <Text style={{ fontSize: 13, color: '#777', marginTop: 2 }}>Pattern: {postPattern}/10</Text>
              <Text style={{ fontSize: 13, color: '#777', marginTop: 2 }}>Numbers: {postNumbers}/10</Text>
              {/* Status badge */}
              <View style={{ backgroundColor: statusColors[postStatus], borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4, alignSelf: 'flex-start' }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{postStatus}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.tasksBox}>
          <View style={styles.tasksTitleRow}>
            <Text style={styles.tasksTitle}>Tasks</Text>
            <View style={styles.generalProgressWrap}>
              <View style={[styles.generalProgressBar, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.generalProgressText}>{`${progressPercent}%`}</Text>
          </View>
          {/* Scrollable tasks list */}
          {tasks.length === 0 ? (
            <View style={[styles.taskRow, { justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }]}>
              <Text style={{ fontSize: 16, color: '#888', textAlign: 'center' }}>
                No tasks available yet.{'\n'}
                <Text style={{ fontSize: 14, color: '#aaa' }}>
                  Tasks will appear once your child completes the pretest.
                </Text>
              </Text>
            </View>
          ) : (
            tasks.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.taskRow}
              onPress={() => handleTaskPress(index)}
              activeOpacity={item.status === 'done' ? 1 : 0.8}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.taskTitleRow}>
                  <View style={[styles.taskNum, item.status === 'done' ? styles.taskNumDone : styles.taskNumGray]}>
                    <Text style={[styles.taskNumText, item.status === 'done' ? styles.taskNumTextDone : styles.taskNumTextGray]}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskTitleSmall}>{item.title}</Text>
                    {item.category && (
                      <View style={{ 
                        backgroundColor: item.category === 'pattern' ? '#e3f2fd' : 
                                     item.category === 'numbers' ? '#f3e5f5' : 
                                     item.category === 'technology' ? '#e8f5e8' : 
                                     item.category === 'practical' ? '#fff3e0' : 
                                     item.category === 'mixed' ? '#fce4ec' : '#f1f1f1',
                        borderRadius: 4, 
                        paddingHorizontal: 6, 
                        paddingVertical: 2, 
                        marginTop: 2, 
                        alignSelf: 'flex-start' 
                      }}>
                        <Text style={{ 
                          fontSize: 10, 
                          color: item.category === 'pattern' ? '#1976d2' : 
                                 item.category === 'numbers' ? '#7b1fa2' : 
                                 item.category === 'technology' ? '#388e3c' : 
                                 item.category === 'practical' ? '#f57c00' : 
                                 item.category === 'mixed' ? '#c2185b' : '#666',
                          fontWeight: 'bold' 
                        }}>
                          {item.category.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                {!!item.details && (
                  <Text style={styles.taskDetails}>{item.details}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.taskStatus, item.status === 'done' ? styles.statusDone : item.status === 'ongoing' ? styles.statusOngoing : styles.statusNotDone]}>
                  {item.status === 'done' && <MaterialIcons name="check-circle" size={16} color="#2ecc40" style={{ marginRight: 4 }} />}
                  {item.status === 'ongoing' && <MaterialIcons name="access-time" size={16} color="#f1c40f" style={{ marginRight: 4 }} />}
                  {item.status === 'notdone' && <MaterialIcons name="radio-button-unchecked" size={16} color="#bbb" style={{ marginRight: 4 }} />}
                  <Text style={{ fontWeight: 'bold', fontSize: 13 }}>{statusLabel(item.status)}</Text>
                </View>
                {/* Change button */}
                {item.status === 'notdone' && (
                  <TouchableOpacity
                    style={styles.changeBtn}
                    onPress={() => handleChangePress(index)}
                  >
                    <Feather name="refresh-cw" size={20} color="#2ecc40" />
                  </TouchableOpacity>
                )}
                              </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Change Reason Modal */}
        <Modal
          visible={changeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setChangeModalVisible(false)}
        >
          <BlurView intensity={60} tint="light" style={styles.modalBlur}>
            <View style={styles.modalCenterWrap}>
              <View style={styles.modalAnnouncementBox}>
                <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 10 }}>Reason for Change</Text>
                <TouchableOpacity
                  style={[styles.reasonOption, changeReason === 'Time' && styles.reasonOptionSelected]}
                  onPress={() => setChangeReason('Time')}
                >
                  <Text style={styles.reasonOptionText}>Time</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reasonOption, changeReason === 'Resources' && styles.reasonOptionSelected]}
                  onPress={() => setChangeReason('Resources')}
                >
                  <Text style={styles.reasonOptionText}>Resources</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reasonOption, changeReason === 'Other' && styles.reasonOptionSelected]}
                  onPress={() => setChangeReason('Other')}
                >
                  <Text style={styles.reasonOptionText}>Other</Text>
                </TouchableOpacity>
                {changeReason === 'Other' && (
                  <View style={{ marginTop: 10, width: '100%' }}>
                    <Text style={{ fontSize: 14, color: '#222', marginBottom: 4 }}>Please specify:</Text>
                    <View style={{ backgroundColor: '#f3f3f3', borderRadius: 8, padding: 6 }}>
                      <Text
                        style={{ minHeight: 32, fontSize: 15, color: '#222' }}
                        numberOfLines={3}
                        ellipsizeMode="tail"
                      >
                        {/* This is a placeholder for a TextInput, but since TextInput is not imported, use Alert for now. */}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ marginTop: 6, alignSelf: 'flex-end' }}
                      onPress={async () => {
                        const input = prompt('Please specify your reason:');
                        if (input) setChangeReasonOther(input);
                      }}
                    >
                      <Text style={{ color: '#2ecc40', fontWeight: 'bold' }}>Enter Reason</Text>
                    </TouchableOpacity>
                    {changeReasonOther ? (
                      <Text style={{ color: '#888', marginTop: 2 }}>Entered: {changeReasonOther}</Text>
                    ) : null}
                  </View>
                )}
                <Pressable
                  style={[styles.modalCloseBtn, { marginTop: 18, backgroundColor: '#2ecc40', opacity: changeReason ? 1 : 0.5 }]}
                  onPress={handleSubmitChangeReason}
                  disabled={!changeReason || (changeReason === 'Other' && !changeReasonOther)}
                >
                  <Text style={styles.modalCloseBtnText}>Submit</Text>
                </Pressable>
                <Pressable style={[styles.modalCloseBtn, { marginTop: 8, backgroundColor: '#bbb' }]} onPress={() => setChangeModalVisible(false)}>
                  <Text style={styles.modalCloseBtnText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </Modal>
      </ScrollView>
      <Modal
        visible={showSetupModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <BlurView intensity={60} tint="light" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 24, width: 320, alignItems: 'center' }}>
            {/* X icon for closing if not first setup */}
            {(!!parentData?.name && !!parentData?.contact) && (
              <TouchableOpacity
                style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}
                onPress={() => setShowSetupModal(false)}
              >
                <MaterialIcons name="close" size={28} color="#888" />
              </TouchableOpacity>
            )}
            <Text style={{ fontWeight: 'bold', fontSize: 20, color: '#27ae60', marginBottom: 12 }}>Set Up Your Profile</Text>
            <View style={{ width: '100%', marginBottom: 8 }}>
              <Text style={{ fontSize: 15, color: '#222', marginBottom: 4, fontWeight: '600' }}>Full Name</Text>
              <TextInput
                style={{ width: '100%', borderRadius: 10, borderWidth: 1, borderColor: '#e0f7e2', padding: 10, marginBottom: 8, fontSize: 16 }}
                placeholder="Your Name"
                value={setupName}
                onChangeText={setSetupName}
              />
            </View>
            <View style={{ width: '100%', marginBottom: 8 }}>
              <Text style={{ fontSize: 15, color: '#222', marginBottom: 4, fontWeight: '600' }}>Contact Number</Text>
              <TextInput
                style={{ width: '100%', borderRadius: 10, borderWidth: 1, borderColor: '#e0f7e2', padding: 10, marginBottom: 8, fontSize: 16 }}
                placeholder="Contact Number"
                value={setupContact}
                onChangeText={setSetupContact}
                keyboardType="phone-pad"
              />
            </View>
            <View style={{ width: '100%', marginBottom: 8 }}>
              <Text style={{ fontSize: 15, color: '#222', marginBottom: 4, fontWeight: '600' }}>Household Monthly Income</Text>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: '#e0f7e2', borderRadius: 10, backgroundColor: '#f9f9f9', padding: 12, minHeight: 44, justifyContent: 'center' }}
                onPress={() => setIncomeDropdownVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 15, color: setupIncome ? '#222' : '#aaa' }}>{setupIncome || 'Select income bracket'}</Text>
              </TouchableOpacity>
              <Modal
                visible={incomeDropdownVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIncomeDropdownVisible(false)}
              >
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setIncomeDropdownVisible(false)}>
                  <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, minWidth: 260 }}>
                    {incomeBrackets.map((bracket) => (
                      <TouchableOpacity
                        key={bracket}
                        style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                        onPress={() => { setSetupIncome(bracket); setIncomeDropdownVisible(false); }}
                      >
                        <Text style={{ fontSize: 16, color: '#222' }}>{bracket}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Pressable>
              </Modal>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: '#27ae60', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 30, marginTop: 6 }}
              onPress={handleSetupSubmit}
              disabled={setupLoading}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{setupLoading ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </ImageBackground>
  );
}

const CIRCLE_SIZE = 80;
const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#f7fafd',
  },
  headerWrap: {
    width: '100%',
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    borderBottomWidth: 0.5,
    borderColor: '#e6e6e6',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 0,
    marginBottom: 0,
  },
  welcome: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    letterSpacing: 0.5,
  },
  lrn: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2ecc40',
    marginTop: 0,
    letterSpacing: 0.5,
  },
  profileBtn: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#2ecc40',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '92%',
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginRight: 8,
    letterSpacing: 0.2,
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2ecc40',
  },
  announcementScroll: {
    width: '100%',
    marginBottom: 18,
    minHeight: 120,
  },
  announcementBox: {
    width: width * 0.8,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 0,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  teacherAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2ecc40',
  },
  teacherName: {
    fontWeight: 'bold',
    fontSize: 17,
    color: '#222',
  },
  teacherGrade: {
    fontSize: 14,
    color: '#666',
    marginTop: 1,
  },
  announcementTextScrollWrap: {
    maxHeight: 70,
    marginBottom: 2,
  },
  announcementTextScroll: {
    maxHeight: 70,
  },
  announcementText: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
    lineHeight: 20,
    paddingRight: 2,
  },
  announcementDate: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  announcementTime: {
    fontSize: 12,
    color: '#aaa',
    marginLeft: 8,
    alignSelf: 'flex-end',
  },
  progressRowCardWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '92%',
    marginBottom: 16,
    gap: 12,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  progressCardSingle: {
    flex: 1,
    minWidth: 0,
    maxWidth: '48%',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginHorizontal: 0,
    marginBottom: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    alignItems: 'center',
  },
  progressCol: {
    alignItems: 'center',
    flex: 1,
  },
  circleWrap: {
    alignItems: 'center',
    marginBottom: 2,
    shadowColor: '#2ecc40',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 8,
    borderColor: '#2ecc40',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7fafd',
    marginBottom: 2,
    shadowColor: '#2ecc40',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  circleText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  progressLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    marginTop: 2,
  },
  progressScore: {
    fontSize: 13,
    color: '#888',
    marginTop: 1,
    marginBottom: 4,
  },
  tasksBox: {
    width: '92%',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginTop: 14,
    marginBottom: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  tasksTitle: {
    fontSize: 25,
    fontWeight: '700',
    color: '#222',
    marginLeft: 4,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(247,250,253,0.82)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  taskNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
  },
  taskNumGray: {
    backgroundColor: '#e6e6e6',
    borderColor: '#bbb',
  },
  taskNumDone: {
    backgroundColor: '#e6ffe6',
    borderColor: '#2ecc40',
  },
  taskNumText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  taskNumTextGray: {
    color: '#bbb',
  },
  taskNumTextDone: {
    color: '#2ecc40',
  },
  taskStatus: {
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDone: {
    color: '#2ecc40',
    backgroundColor: '#e6ffe6',
  },
  statusOngoing: {
    color: '#f1c40f',
    backgroundColor: '#fffbe6',
  },
  statusNotDone: {
    color: '#bbb',
    backgroundColor: '#f3f3f3',
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
    paddingRight: 0,
    paddingLeft: 0,
  },
  taskTitleSmall: {
    fontWeight: '600',
    color: '#222',
    fontSize: 14,
    flexShrink: 1,
    marginRight: 8,
  },
  taskDetails: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    lineHeight: 18,
    marginBottom: 2,
  },
  tasksTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
    paddingRight: 0,
    paddingLeft: 0,
  },
  generalProgressWrap: {
    height: 8,
    flex: 1,
    backgroundColor: '#e6e6e6',
    borderRadius: 4,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexShrink: 1,
  },
  generalProgressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ecc40',
  },
  generalProgressText: {
    fontSize: 13,
    color: '#888',
    minWidth: 40,
    textAlign: 'right',
    marginLeft: 0,
  },
  modalBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCenterWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalAnnouncementBox: {
    width: '85%',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    alignItems: 'flex-start',
  },
  modalAnnouncementText: {
    fontSize: 16,
    color: '#222',
    marginTop: 10,
    lineHeight: 22,
    marginBottom: 8,
  },
  modalCloseBtn: {
    alignSelf: 'center',
    marginTop: 16,
    backgroundColor: '#2ecc40',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  modalCloseBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  changeBtn: {
    marginLeft: 10,
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(46,204,64,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonOption: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f3f3f3',
    marginBottom: 8,
  },
  reasonOptionSelected: {
    backgroundColor: '#e6ffe6',
    borderColor: '#2ecc40',
    borderWidth: 1.5,
  },
  reasonOptionText: {
    fontSize: 16,
    color: '#222',
  },
}); 