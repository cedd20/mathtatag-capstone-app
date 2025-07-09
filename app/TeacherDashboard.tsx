import { AntDesign, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { get, onValue, ref, remove, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { G, Path, Svg } from 'react-native-svg';
import { auth, db } from '../constants/firebaseConfig';

const bgImage = require('../assets/images/bg.jpg');

const { width } = Dimensions.get('window');

interface Student {
  id: string;
  studentNumber: string;
  nickname: string;
  category?: string; // Optional, only used in frontend
  preScore?: { pattern: number; numbers: number };
  postScore?: { pattern: number; numbers: number };
  classId: string;
  parentId?: string;
}

interface ClassData {
  id: string;
  school: string;
  section: string;
  teacherId: string;
  studentIds: string[];
  students?: Student[]; // Optional for runtime compatibility
  tasks: { title: string; details: string; status: string }[];
  learnersPerformance: { label: string; color: string; percent: number }[];
}

type ModalType = 'addClass' | 'addStudent' | 'announce' | 'category' | 'taskInfo' | 'classList' | 'startTest' | 'editStudent' | 'showImprovement' | 'evaluateStudent' | 'studentInfo' | null;

export default function TeacherDashboard() {
  const router = useRouter();
  const [currentTeacher, setCurrentTeacher] = useState<any>(null);
  const [teacherName, setTeacherName] = useState('');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [classSection, setClassSection] = useState('');
  const [classSchool, setClassSchool] = useState('');
  const [className, setClassName] = useState('');
  const [studentNickname, setStudentNickname] = useState('');
  const [announceText, setAnnounceText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [testType, setTestType] = useState<'pre' | 'post' | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedPerformance, setSelectedPerformance] = useState<{ classId: string, idx: number } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [sortColumn, setSortColumn] = useState<'name' | 'status' | 'pre' | 'post'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingStudentName, setEditingStudentName] = useState('');
  const [improvementData, setImprovementData] = useState<{ student: Student, pre: number, post: number, preStatus: string, postStatus: string } | null>(null);
  const [evaluationData, setEvaluationData] = useState<{ student: Student, classId: string } | null>(null);
  const [evaluationText, setEvaluationText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [prePattern, setPrePattern] = useState('0');
  const [preNumbers, setPreNumbers] = useState('0');
  const [postPattern, setPostPattern] = useState('0');
  const [postNumbers, setPostNumbers] = useState('0');
  const [announceTitle, setAnnounceTitle] = useState('');
  const [parentAuthCode, setParentAuthCode] = useState<string | null>(null);

  // Safety net: Stop any background music when this screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          // Globally disable audio as a safety net
          await Audio.setIsEnabledAsync(false);
          await Audio.setIsEnabledAsync(true);
        } catch {}
      })();
      return () => {};
    }, [])
  );

  // Use theme-matching harmonious colors for the chart
  const defaultCategories = [
    { label: 'Intervention', color: '#ff5a5a' },      // red
    { label: 'Consolidation', color: '#ffb37b' },    // peach/orange
    { label: 'Enhancement', color: '#ffe066' },      // yellow
    { label: 'Proficient', color: '#7ed957' },       // light green
    { label: 'Highly Proficient', color: '#27ae60' },// main green
  ];

  // Load current teacher and their data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Get teacher info from database
          const teacherRef = ref(db, `Teachers/${user.uid}`);
          const teacherSnapshot = await get(teacherRef);
          
          if (teacherSnapshot.exists()) {
            const teacherData = teacherSnapshot.val();
            setCurrentTeacher(teacherData);
            setTeacherName(teacherData.name.split(' ')[0]); // Get first name
          }
        } catch (error) {
          console.error('Error loading teacher data:', error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load classes for current teacher
  useEffect(() => {
    if (!currentTeacher) return;

    const classesRef = ref(db, `Classes`);
    const unsubscribe = onValue(classesRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const teacherClasses = Object.values(data)
          .filter((cls: any) => cls.teacherId === currentTeacher.teacherId);

        // For each class, fetch up-to-date students from Students node
        const updatedClasses = await Promise.all(teacherClasses.map(async (cls: any) => {
          // If students is an array of student objects, get their IDs
          const studentIds = Array.isArray(cls.studentIds) ? cls.studentIds : [];
          // Fetch each student from Students node
          const students = await Promise.all(studentIds.map(async (id: string) => {
            const snap = await get(ref(db, `Students/${id}`));
            return snap.exists() ? snap.val() : null;
          }));
          // Filter for unique students by id
          const uniqueStudents = students.filter((s, idx, arr) => s && arr.findIndex(stu => stu.id === s.id) === idx);
          return {
            ...cls,
            students: uniqueStudents, // Only unique students
            school: cls.school || cls.className || 'Unknown School',
            section: cls.section || cls.className || 'Unknown Section'
          };
        }));

        setClasses(updatedClasses);
      } else {
        setClasses([]);
      }
    });

    return () => unsubscribe();
  }, [currentTeacher]);

  // Helper to get a class by id
  const getClassById = (id: string | null) => classes.find(cls => cls.id === id) || null;

  // Manual refresh function
  const refreshData = async () => {
    setRefreshing(true);
    try {
      if (currentTeacher) {
        const classesRef = ref(db, `Classes`);
        const snapshot = await get(classesRef);
        const data = snapshot.val();
        console.log('Manual refresh - Classes data:', data);
        if (data) {
          const teacherClasses = Object.values(data).filter((cls: any) => {
            console.log('Manual refresh - Checking class:', cls.id, 'teacherId:', cls.teacherId, 'currentTeacher:', currentTeacher.teacherId);
            return cls.teacherId === currentTeacher.teacherId;
          }).map((cls: any) => ({
            ...cls,
            students: cls.students || [],
            school: cls.school || cls.className || 'Unknown School',
            section: cls.section || cls.className || 'Unknown Section'
          })) as ClassData[];
          console.log('Manual refresh - Filtered teacher classes:', teacherClasses);
          setClasses(teacherClasses);
        } else {
          setClasses([]);
        }
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Analytics calculations
  const totalClasses = classes?.length || 0;
  const totalStudents = classes?.reduce((sum, c) => sum + (c.students?.length || 0), 0) || 0;
  const allPerformance = classes?.flatMap(c => c.learnersPerformance?.map(lp => lp.percent) || []) || [];
  const avgPerformance = allPerformance.length ? Math.round(allPerformance.reduce((a, b) => a + b, 0) / allPerformance.length) : 0;
  const mostImprovedGroup = (() => {
    // For demo, just pick the group with the highest percent in the first class
    if (!classes?.[0]?.learnersPerformance) return 'N/A';
    return classes[0].learnersPerformance.reduce((a, b) => (a.percent > b.percent ? a : b)).label;
  })();

  // Modal open/close helpers
  const openModal = (type: ModalType, extra: any = null) => {
    setModalType(type);
    if (type === 'category') {
      setSelectedCategory(extra?.category);
      setSelectedClassId(extra?.classId);
    }
    if (type === 'addStudent') {
      setSelectedClassId(extra?.classId);
    }
    if (type === 'classList') {
      setSelectedClassId(extra?.classId);
    }
    if (type === 'startTest') {
      if (extra?.student) {
        setSelectedStudent(extra.student);
        setTestType(extra.testType);
        setSelectedClassId(extra.classId);
      }
    }
    if (type === 'editStudent') {
      if (extra?.student) {
        setEditingStudent(extra.student);
        setEditingStudentName(extra.student.nickname);
        setSelectedClassId(extra.classId);
        // Initialize the form values
        setPrePattern(extra.student?.preScore?.pattern?.toString() ?? '0');
        setPreNumbers(extra.student?.preScore?.numbers?.toString() ?? '0');
        setPostPattern(extra.student?.postScore?.pattern?.toString() ?? '0');
        setPostNumbers(extra.student?.postScore?.numbers?.toString() ?? '0');
      }
    }
    if (type === 'showImprovement') {
      setImprovementData(extra);
    }
    if (type === 'evaluateStudent') {
      setEvaluationData(extra);
      setEvaluationText('');
    }
    if (type === 'studentInfo') {
      if (extra?.student) {
        setSelectedStudent(extra.student);
        // Fetch parent auth code
        setParentAuthCode(null); // reset first
        if (extra.student.parentId) {
          const parentRef = ref(db, `Parents/${extra.student.parentId}`);
          get(parentRef).then(snap => {
            if (snap.exists()) {
              const parentData = snap.val();
              setParentAuthCode(parentData.authCode || null);
            } else {
              setParentAuthCode(null);
            }
          }).catch(() => setParentAuthCode(null));
        }
      }
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalType(null);
    setClassSection('');
    setClassSchool('');
    setClassName('');
    setStudentNickname('');
    setAnnounceText('');
    setAnnounceTitle('');
    setSelectedCategory(null);
    setSelectedStudent(null);
    setTestType(null);
    setSelectedClassId(null);
    setEditingStudent(null);
    setEditingStudentName('');
    setImprovementData(null);
    setEvaluationData(null);
    setEvaluationText('');
  };

  // Add new class to database
  const addClass = async () => {
    if (!classSection.trim() || !currentTeacher) {
      Alert.alert('Error', 'Please enter a section name.');
      return;
    }

    try {
      // Generate school abbreviation for readable class ID
      const schoolName = classSchool.trim() || 'Unknown School';
      const schoolAbbreviation = schoolName.split(' ').map((word: string) => word.charAt(0)).join('') + 'ES';
      const currentYear = new Date().getFullYear();
      
      // Generate readable class ID: SCHOOLABBR-SECTION-YEAR
      const readableClassId = `${schoolAbbreviation.toUpperCase()}-${classSection.trim().toUpperCase()}-${currentYear}`;
      
      const newClass: ClassData = {
        id: readableClassId,
        school: schoolName,
        section: classSection.trim(),
        teacherId: currentTeacher.teacherId,
        studentIds: [],
        students: [],
        tasks: [
          { title: 'Intervention', details: 'Remedial activities for struggling students', status: 'pending' },
          { title: 'Consolidation', details: 'Group activities to reinforce learning', status: 'pending' },
          { title: 'Enhancement', details: 'Advanced activities for proficient students', status: 'pending' },
          { title: 'Proficient', details: 'Challenging tasks for high performers', status: 'pending' },
          { title: 'Highly Proficient', details: 'Excellence-focused activities', status: 'pending' },
        ],
        learnersPerformance: [
          { label: 'Intervention', color: '#ff5a5a', percent: 0 },
          { label: 'Consolidation', color: '#ffb37b', percent: 0 },
          { label: 'Enhancement', color: '#ffe066', percent: 0 },
          { label: 'Proficient', color: '#7ed957', percent: 0 },
          { label: 'Highly Proficient', color: '#27ae60', percent: 0 },
        ],
      };

      await set(ref(db, `Classes/${readableClassId}`), newClass);
      Alert.alert('Success', `Class created successfully!\n\nClass ID: ${readableClassId}`);
      closeModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to create class. Please try again.');
    }
  };

  // Add new student to a class
  const addStudent = async () => {
    if (!selectedClassId || !studentNickname.trim()) {
      Alert.alert('Error', 'Please enter a student nickname.');
      return;
    }

    try {
      // Get the class information
      const classRef = ref(db, `Classes/${selectedClassId}`);
      const classSnapshot = await get(classRef);
      if (!classSnapshot.exists()) {
        Alert.alert('Error', 'Class not found.');
        return;
      }
      const classData = classSnapshot.val();
      
      // Get current year
      const currentYear = new Date().getFullYear();
      
      // Get the next student number for this class and year
      const studentsRef = ref(db, 'Students');
      const studentsSnapshot = await get(studentsRef);
      let nextStudentNumber = 1;
      
      if (studentsSnapshot.exists()) {
        const students = studentsSnapshot.val();
        // Generate school abbreviation for filtering
        const schoolAbbreviation = classData.school.split(' ').map((word: string) => word.charAt(0)).join('') + 'ES';
        const classStudents = Object.values(students).filter((student: any) => 
          student.classId === selectedClassId
        );
        nextStudentNumber = classStudents.length + 1;
      }
      
      // Generate school abbreviation (first letter + ES)
      const schoolAbbreviation = classData.school.split(' ').map((word: string) => word.charAt(0)).join('') + 'ES';
      
      // Generate student ID in format: SCHOOLABBR-SECTION-YEAR-XXX
      const studentId = `${schoolAbbreviation.toUpperCase()}-${classData.section.toUpperCase()}-${currentYear}-${String(nextStudentNumber).padStart(3, '0')}`;
      
      // Generate a unique short auth code for the parent in the format AAA#### (3 uppercase letters + 4 digits)
      let authCode = '';
      let isUnique = false;
      const randomLetters = () => Array.from({length: 3}, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
      while (!isUnique) {
        const letters = randomLetters();
        const digits = Math.floor(1000 + Math.random() * 9000); // 4 digit random number
        authCode = `${letters}${digits}`;
        // Check uniqueness in Parents node
        const parentsRef = ref(db, 'Parents');
        const parentsSnapshot = await get(parentsRef);
        let exists = false;
        if (parentsSnapshot.exists()) {
          const parents = parentsSnapshot.val();
          exists = Object.values(parents).some((parent: any) => parent.authCode === authCode);
        }
        if (!exists) isUnique = true;
      }
      const parentId = `parent-${studentId}`;
      
      // Create parent data in database
      const parentData = {
        parentId,
        authCode,
        studentId: studentId,
        name: `${studentNickname.trim()}'s Parent`,
        contact: '',
        createdAt: new Date().toISOString(),
        householdIncome: '', // or default to first bracket if you prefer
      };
      await set(ref(db, `Parents/${parentId}`), parentData);
      
      // Create student data
      const newStudent: Student = {
        id: studentId,
        studentNumber: studentId,
        nickname: studentNickname.trim(),
        preScore: { pattern: 0, numbers: 0 },
        postScore: { pattern: 0, numbers: 0 },
        classId: selectedClassId,
        parentId: parentId, // Link to parent record
      };

      // Add student to Students node
      await set(ref(db, `Students/${studentId}`), newStudent);
      
      // Update the class's studentIds array, ensuring no duplicates
      const currentIds = Array.isArray(classData.studentIds) ? classData.studentIds : [];
      const updatedIds = currentIds.includes(studentId) ? currentIds : [...currentIds, studentId];
      const updatedClassData = {
        ...classData,
        studentIds: updatedIds
      };
      await set(ref(db, `Classes/${selectedClassId}`), updatedClassData);
      
      Alert.alert(
        'Success', 
        `Student added successfully!\n\nStudent ID: ${studentId}\nParent Auth Code: ${authCode}`
      );
      closeModal();
    } catch (error: any) {
      let errorMessage = 'Failed to add student. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      }
      Alert.alert('Error', errorMessage);
    }
  };

  // Delete class
  const deleteClass = async (classId: string) => {
    Alert.alert(
      'Delete Class',
      'Are you sure you want to delete this class? This will also delete all students in this class.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete class
              await remove(ref(db, `Classes/${classId}`));
              
              // Delete all students in this class
              const studentsRef = ref(db, 'Students');
              const studentsSnapshot = await get(studentsRef);
              if (studentsSnapshot.exists()) {
                const students = studentsSnapshot.val();
                const deletePromises = Object.keys(students)
                  .filter(studentId => students[studentId].classId === classId)
                  .map(studentId => remove(ref(db, `Students/${studentId}`)));
                
                await Promise.all(deletePromises);
              }
              
              Alert.alert('Success', 'Class deleted successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete class.');
            }
          }
        }
      ]
    );
  };

  // Delete student
  const deleteStudent = async (studentId: string) => {
    Alert.alert(
      'Delete Student',
      'Are you sure you want to delete this student?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove student from Students node
              await remove(ref(db, `Students/${studentId}`));
              
              // Find and remove student from all classes
              const classesRef = ref(db, 'Classes');
              const classesSnapshot = await get(classesRef);
              if (classesSnapshot.exists()) {
                const classes = classesSnapshot.val();
                const updatePromises = Object.keys(classes).map(async (classId) => {
                  const classData = classes[classId];
                  if (classData.students && classData.students.some((s: any) => s.id === studentId)) {
                    const updatedStudents = classData.students.filter((s: any) => s.id !== studentId);
                    await set(ref(db, `Classes/${classId}`), {
                      ...classData,
                      students: updatedStudents
                    });
                  }
                });
                await Promise.all(updatePromises);
              }
              
              Alert.alert('Success', 'Student deleted successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete student.');
            }
          }
        }
      ]
    );
  };

  const startTest = () => {
    // Navigate to loading screen with student and classId as params
    if (selectedStudent && selectedClassId && testType === 'pre') {
      router.push({
        pathname: '/LoadingScreen',
        params: {
          studentId: selectedStudent.id,
          classId: selectedClassId,
        },
      });
      closeModal();
    } else {
      Alert.alert('Error', 'Missing student or class information.');
    }
  };

  const editStudent = () => {
    // TODO: Implement edit student functionality
    Alert.alert('Edit Student', 'Edit functionality will be implemented soon.');
      closeModal();
  };

  // Modern, 3D/gradient, adaptive analytics cards
  function AnalyticsCards() {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2, gap: 4, flexWrap: 'wrap' }}>
        <LinearGradient colors={['#e0ffe6', '#c6f7e2']} style={styles.analyticsCard}>
          <AntDesign name="appstore1" size={32} color="#27ae60" style={styles.analyticsIcon} />
          <Text style={styles.analyticsValue}>{totalClasses}</Text>
          <Text style={styles.analyticsLabel}>Total{'\n'}Classes</Text>
        </LinearGradient>
        <LinearGradient colors={['#e0f7fa', '#b2ebf2']} style={styles.analyticsCard}>
          <MaterialCommunityIcons name="account-group" size={32} color="#0097a7" style={styles.analyticsIcon} />
          <Text style={styles.analyticsValue}>{totalStudents}</Text>
          <Text style={styles.analyticsLabel}>Total{'\n'}Students</Text>
        </LinearGradient>
        <LinearGradient colors={['#fffde4', '#ffe066']} style={styles.analyticsCard}>
          <AntDesign name="piechart" size={32} color="#ffb300" style={styles.analyticsIcon} />
          <Text style={styles.analyticsValue}>{avgPerformance}%</Text>
          <Text style={styles.analyticsLabel}>Average{'\n'}Performance</Text>
        </LinearGradient>
      </View>
    );
  }

  // Modern student count card with icon and number
  function StudentCountCard({ count, iconSize = 24, fontSize = 18 }: { count: number, iconSize?: number, fontSize?: number }) {
    return (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e0f7fa',
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginTop: 2,
        marginRight: 0,
        marginBottom: 4,
        minWidth: 40,
        justifyContent: 'center',
      }}>
        <MaterialCommunityIcons name="account-group" size={iconSize} color="#0097a7" style={{ marginRight: 4 }} />
        <Text style={{ fontSize, fontWeight: 'bold', color: '#0097a7' }}>{count}</Text>
      </View>
    );
  }

  // Helper: Compute performance distribution for pre/post test
  function getPerformanceDistribution(students: Student[] = [], type: 'pre' | 'post') {
    const categories = [
      { label: 'Intervention', color: '#ff5a5a' },
      { label: 'Consolidation', color: '#ffb37b' },
      { label: 'Enhancement', color: '#ffe066' },
      { label: 'Proficient', color: '#7ed957' },
      { label: 'Highly Proficient', color: '#27ae60' },
    ];
    // Only count students with a valid score
    const validScores = students.map(student => {
      const scoreObj = type === 'pre' ? student.preScore : student.postScore;
      if (!scoreObj) return null;
      const score = (scoreObj.pattern ?? 0) + (scoreObj.numbers ?? 0);
      if (typeof score !== 'number' || score < 0) return null;
      return score;
    }).filter(score => typeof score === 'number');
    if (validScores.length < 2) {
      // Not enough data: all gray
      return categories.map(cat => ({ ...cat, color: '#bbb', percent: 0 }));
    }
    const counts = [0, 0, 0, 0, 0];
    validScores.forEach(score => {
      const percent = (score! / 20) * 100;
      if (percent < 25) counts[0]++;
      else if (percent < 50) counts[1]++;
      else if (percent < 75) counts[2]++;
      else if (percent < 85) counts[3]++;
      else counts[4]++;
    });
    const sum = counts.reduce((a, b) => a + b, 0);
    if (sum < 2) {
      // Not enough valid scores
      return categories.map(cat => ({ ...cat, color: '#bbb', percent: 0 }));
    }
    return categories.map((cat, i) => ({
      ...cat,
      percent: Math.round((counts[i] / sum) * 100),
    }));
  }

  // Responsive pie chart with legend always side by side
  function AnalyticsPieChartWithLegend({ data, reverse = false, title = 'Pretest Performance' }: { data: { label: string; color: string; percent: number }[], reverse?: boolean, title?: string }) {
    const windowWidth = Dimensions.get('window').width;
    // Container width: full width minus 32px margin
    const containerWidth = Math.max(240, windowWidth - 60);
    // Pie chart size: 48% of container, min 100, max 180
    const size = Math.max(100, Math.min(containerWidth * 0.44, 180));
    const radius = size / 2 - 8;
    const center = size / 2;
    // Font and dot sizes
    const fontSizeTitle = windowWidth < 500 ? 18 : 22;
    const fontSizeLabel = windowWidth < 500 ? 13 : 15;
    const fontSizePercent = windowWidth < 500 ? 12 : 14;
    const dotSize = windowWidth < 500 ? 14 : 18;
    // Pie data
    const categories = defaultCategories.map(cat => {
      const found = data.find(d => d.label === cat.label);
      return found ? found : { ...cat, percent: 0 };
    });
    const total = categories.reduce((sum, d) => sum + d.percent, 0) || 1;
    let startAngle = 0;
    const arcs = categories.map((d, idx) => {
      const angle = (d.percent / total) * 2 * Math.PI;
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
      return { path, color: d.color, label: d.label, percent: d.percent, idx };
    });
    // Responsive layout: chart and legend in 2-column row
    return (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: containerWidth,
        marginBottom: 3,
        paddingHorizontal: 0,
        paddingVertical: 12,
        alignSelf: 'center',
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 18,
        gap: 0,
      }}>
        {reverse ? (
          <>
            <View style={{ flex: 1, minWidth: 120, alignItems: 'flex-end', justifyContent: 'center', marginRight: 0, paddingRight: 0, gap: 8 }}>
              {arcs.map((arc) => (
                <View key={arc.label + '-' + arc.percent + '-' + arc.idx} style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10, marginTop: 2 }}>
                  <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: arc.color, marginLeft: 8, borderWidth: 1, borderColor: '#eee' }} />
                  <Text style={{ fontSize: fontSizeLabel, color: '#222', fontWeight: '600', marginLeft: 4 }}>{arc.label}</Text>
                  <Text style={{ fontSize: fontSizePercent, color: '#888', fontWeight: '500' }}>({arc.percent}%)</Text> 
                </View>
              ))}
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: size, maxWidth: size, marginLeft: 4 }}>
              <Text style={{ fontSize: fontSizeTitle, fontWeight: 'bold', color: '#222', marginBottom: 0, textAlign: 'center' }}>{title}</Text>
              <Svg width={size} height={size} style={{ marginBottom: -6 }}>
                <G>
                  {arcs.map((arc) => (
                    <Path key={arc.label + '-' + arc.percent + '-' + arc.idx} d={arc.path} fill={arc.color} />
                  ))}
                </G>
              </Svg>
            </View>
          </>
        ) : (
          <>
            <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: size, maxWidth: size, marginRight: 4 }}>
              <Text style={{ fontSize: fontSizeTitle, fontWeight: 'bold', color: '#222', marginBottom: 0, textAlign: 'center' }}>{title}</Text>
              <Svg width={size} height={size} style={{ marginBottom: -6 }}>
                <G>
                  {arcs.map((arc) => (
                    <Path key={arc.label + '-' + arc.percent + '-' + arc.idx} d={arc.path} fill={arc.color} />
                  ))}
                </G>
              </Svg>
            </View>
            <View style={{ flex: 1, minWidth: 120, alignItems: 'flex-start', justifyContent: 'center', marginLeft: 0, paddingLeft: 0, gap: 8 }}>
              {arcs.map((arc) => (
                <View key={arc.label + '-' + arc.percent + '-' + arc.idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 2 }}>
                  <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: arc.color, marginRight: 8, borderWidth: 1, borderColor: '#eee' }} />
                  <Text style={{ fontSize: fontSizeLabel, color: '#222', fontWeight: '600', marginRight: 4 }}>{arc.label}</Text>
                  <Text style={{ fontSize: fontSizePercent, color: '#888', fontWeight: '500' }}>({arc.percent}%)</Text> 
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    );
  }

  const StudentItem = ({ item, classId }: { item: Student; classId: string }) => {
    const handleDeleteStudent = () => {
      deleteStudent(item.id);
    };

    return (
      <View style={styles.studentItem}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentNickname}>{item.nickname}</Text>
          <Text style={styles.studentNumber}>ID: {item.studentNumber}</Text>
        </View>
        <View style={styles.testButtons}>
          <TouchableOpacity 
            style={[styles.testButton, styles.preTestButton]} 
            onPress={() => openModal('startTest', { student: item, testType: 'pre', classId })}
          >
            <Text style={styles.testButtonText}>Pre: {item.preScore ? `${(item.preScore.pattern || 0) + (item.preScore.numbers || 0)}` : '0'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.testButton, styles.postTestButton]} 
            onPress={() => openModal('startTest', { student: item, testType: 'post', classId })}
          >
            <Text style={styles.testButtonText}>Post: {item.postScore ? `${(item.postScore.pattern || 0) + (item.postScore.numbers || 0)}` : '0'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const StudentItemRenderer = ({ item, classId }: { item: Student; classId: string }) => (
    <StudentItem item={item} classId={classId} />
  );

  const renderStudentItem = (classId: string) => ({ item }: { item: Student }) => (
    <StudentItemRenderer item={item} classId={classId} />
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 18, color: '#27ae60' }}>Loading...</Text>
      </View>
    );
  }

  if (!currentTeacher) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 18, color: '#ff5a5a' }}>Teacher not found. Please log in again.</Text>
      </View>
    );
  }

  // Add a style for the main dashboard card
  const dashboardCardStyle = {
    width: Dimensions.get('window').width,
    maxWidth: 600,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  };

  // Render each class panel
  const renderClassPanel = (cls: ClassData) => {
    // Group students by category
    const studentsByCategory: Record<string, Student[]> = {};
    (cls.students || []).forEach(student => {
      if (student.category) {
        if (!studentsByCategory[student.category]) studentsByCategory[student.category] = [];
        studentsByCategory[student.category].push(student);
      }
    });
    // Delete class handler
    const handleDeleteClass = () => {
      Alert.alert('Delete Class', `Are you sure you want to delete class ${cls.section}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          deleteClass(cls.id);
        } },
      ]);
    };
    const windowWidth = Dimensions.get('window').width;
    const isSmall = windowWidth < 400;
    // Compute class average improvement and post-test average for this class
    const studentsWithBoth = (cls.students ?? []).filter(s => {
      const hasPre = s.preScore && typeof s.preScore.pattern === 'number' && typeof s.preScore.numbers === 'number';
      const hasPost = s.postScore && typeof s.postScore.pattern === 'number' && typeof s.postScore.numbers === 'number';
      // Consider as 'taken' if at least one part is > 0, or both are zero (i.e., test was submitted)
      const preTaken = hasPre && s.preScore && (s.preScore.pattern > 0 || s.preScore.numbers > 0 || (s.preScore.pattern === 0 && s.preScore.numbers === 0));
      const postTaken = hasPost && s.postScore && (s.postScore.pattern > 0 || s.postScore.numbers > 0 || (s.postScore.pattern === 0 && s.postScore.numbers === 0));
      return preTaken && postTaken;
    });
    let avgImprovement = 0;
    let avgPost = 0;
    if (studentsWithBoth.length > 0) {
      const improvements = studentsWithBoth.map(s => {
        const pre = (s.preScore?.pattern ?? 0) + (s.preScore?.numbers ?? 0);
        const post = (s.postScore?.pattern ?? 0) + (s.postScore?.numbers ?? 0);
        return pre === 0 ? 100 : ((post - pre) / pre) * 100;
      });
      avgImprovement = Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
      avgPost = Math.round(studentsWithBoth.map(s => (s.postScore?.pattern ?? 0) + (s.postScore?.numbers ?? 0)).reduce((a, b) => a + b, 0) / studentsWithBoth.length);
    }
    let avgImprovementColor = '#ffe066';
    if (avgImprovement > 0) avgImprovementColor = '#27ae60';
    else if (avgImprovement < 0) avgImprovementColor = '#ff5a5a';
    return (
      <LinearGradient colors={['#f7fafc', '#e0f7fa']} style={[styles.classCard, { marginBottom: 15, padding: 2, borderRadius: 32, shadowColor: '#27ae60', shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10, width: '100%', maxWidth: 540, alignSelf: 'center' }]}> 
        <View style={{ padding: isSmall ? 16 : 24, paddingBottom: isSmall ? 0 : 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isSmall ? 9 : 8 }}>
                <View>
              <Text style={{ fontSize: 12, color: '#888', fontWeight: '700', marginBottom: -3 }}>{cls.school}</Text>
              <Text style={{ fontSize: 35, color: '#27ae60', fontWeight: 'bold', letterSpacing: 1 }}>{cls.section}</Text>
          </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: isSmall ? 10 : 18, gap: 6, flexWrap: 'wrap', alignSelf: 'flex-end' }}>
              <TouchableOpacity onPress={() => openModal('classList', { classId: cls.id })} activeOpacity={0.8} style={{ borderRadius: 20, overflow: 'hidden', maxWidth: 48, minWidth: 0, marginHorizontal: 1 }}>
                <StudentCountCard count={cls.students?.length || 0} iconSize={22} fontSize={16} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openModal('addStudent', { classId: cls.id })} style={{ backgroundColor: '#e0f7fa', borderRadius: 20, padding: 6, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#0097a7', shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, maxWidth: 48, minWidth: 0, marginHorizontal: 1 }}>
                <MaterialIcons name="person-add" size={22} color="#0097a7" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openModal('announce', { classId: cls.id })} style={{ backgroundColor: '#0097a7', borderRadius: 20, padding: 6, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#0097a7', shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, maxWidth: 48, minWidth: 0, marginHorizontal: 1 }}>
                <MaterialIcons name="campaign" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteClass} style={{ backgroundColor: '#ffeaea', borderRadius: 20, padding: 6, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#ff5a5a', shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, maxWidth: 48, minWidth: 0, marginHorizontal: 1 }}>
                <MaterialIcons name="delete" size={22} color="#ff5a5a" />
              </TouchableOpacity>
            </View>
        </View>
          <View style={{ marginTop: isSmall ? 8 : 16 }}>
            <AnalyticsPieChartWithLegend data={getPerformanceDistribution(cls.students || [], 'pre')} title="Pretest Performance" />
            <View style={{ height: 10 }} />
            <AnalyticsPieChartWithLegend data={getPerformanceDistribution(cls.students || [], 'post')} reverse title="Posttest Performance" />
            {/* Class averages below posttest chart */}
            <View style={styles.compactCardRow}>
              {/* Avg. Improvement */}
              <View style={styles.compactCardCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <MaterialIcons name="trending-up" size={20} color={avgImprovementColor} style={{ marginRight: 4 }} />
                  <Text style={styles.compactCardLabel}>Avg. Improvement</Text>
                  <Pressable onPress={() => Alert.alert('Average Improvement', 'This shows the average percentage improvement from pre-test to post-test for students who took both tests.')}
                    style={{ marginLeft: 2 }}>
                    <MaterialIcons name="info-outline" size={13} color="#888" />
                  </Pressable>
            </View>
                <Text style={[styles.compactCardValue, { color: avgImprovementColor }]}>{avgImprovement > 0 ? '+' : ''}{avgImprovement}%</Text>
              </View>
              {/* Divider */}
              <View style={styles.compactCardDivider} />
              {/* Avg. Post-test */}
              <View style={styles.compactCardCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <MaterialIcons name="bar-chart" size={20} color="#0097a7" style={{ marginRight: 4 }} />
                  <Text style={styles.compactCardLabel}>Avg. Post-test</Text>
                  <Pressable onPress={() => Alert.alert('Average Post-test', 'This shows the average post-test score (out of 20) for students who took both tests.')}
                    style={{ marginLeft: 2 }}>
                    <MaterialIcons name="info-outline" size={13} color="#888" />
                  </Pressable>
                </View>
                <Text style={[styles.compactCardValue, { color: '#0097a7' }]}>{avgPost}/20</Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  };

  // Modal content renderers (update to use selectedClassId)
  const renderModalContent = (): React.JSX.Element | null => {
    const cls = getClassById(selectedClassId);
    switch (modalType) {
      case 'addClass':
        return (
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Classroom</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Section (e.g. JDC)"
              value={classSection}
              onChangeText={setClassSection}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="School"
              value={classSchool}
              onChangeText={setClassSchool}
            />
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalBtn} onPress={closeModal}><Text style={styles.modalBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={addClass}><Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Add</Text></Pressable>
            </View>
          </View>
        );
      case 'addStudent':
        if (!cls) return null;
        // Generate school abbreviation for display
        const schoolAbbreviation = cls.school.split(' ').map((word: string) => word.charAt(0)).join('') + 'ES';
        const nextStudentNumber = `${schoolAbbreviation.toUpperCase()}-${cls.section.toUpperCase()}-2025-${String((cls.students?.length || 0) + 1).padStart(3, '0')}`;
        return (
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Student</Text>
            <TextInput
              style={[styles.modalInput, { color: '#888' }]}
              value={nextStudentNumber}
              editable={false}
              selectTextOnFocus={false}
            />
            <Text style={styles.modalNote}>
              Student number is generated automatically. This is NOT the official DepEd LRN.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Student Nickname"
              value={studentNickname}
              onChangeText={setStudentNickname}
            />
            <Text style={styles.modalNote}>
              Nickname can be the student&apos;s full name or any identifier you prefer.
            </Text>
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalBtn} onPress={closeModal}><Text style={styles.modalBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={addStudent}><Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Add</Text></Pressable>
            </View>
          </View>
        );
      case 'classList':
        if (!cls) return null;
        // Updated status order and color mapping
        const statusOrder = {
          'Not yet taken': 0,
          'Intervention': 1,
          'For Consolidation': 2,
          'For Enhancement': 3,
          'Proficient': 4,
          'Highly Proficient': 5
        };
        const statusColors: Record<string, string> = {
          'Not yet taken': '#888',
          'Intervention': '#ff5a5a',
          'For Consolidation': '#ffb37b',
          'For Enhancement': '#ffe066',
          'Proficient': '#7ed957',
          'Highly Proficient': '#27ae60',
        };
        // Helper to get status from score
        function getStatusFromScore(score: number, total: number) {
          if (typeof score !== 'number' || typeof total !== 'number' || total === 0 || score === -1) return 'Not yet taken';
          const percent = (score / total) * 100;
          if (percent < 25) return 'Intervention';
          if (percent < 50) return 'For Consolidation';
          if (percent < 75) return 'For Enhancement';
          if (percent < 85) return 'Proficient';
          return 'Highly Proficient';
        }
        // Realistic demo: some students have only pre, some both, none post without pre
        const getStudentTestStatus = (student: Student, type: 'pre' | 'post') => {
          if (type === 'pre') {
            const pre = (student.preScore?.pattern ?? 0) + (student.preScore?.numbers ?? 0);
            if (pre > 0) {
              return {
                taken: true,
                score: pre,
                total: 20,
                category: getStatusFromScore(pre, 20),
              };
            } else {
              return { taken: false, category: 'Not yet taken' };
            }
          } else {
            const pre = (student.preScore?.pattern ?? 0) + (student.preScore?.numbers ?? 0);
            const post = (student.postScore?.pattern ?? 0) + (student.postScore?.numbers ?? 0);
            if (pre > 0 && post > 0) {
              return {
                taken: true,
                score: post,
                total: 20,
                category: getStatusFromScore(post, 20),
              };
            } else {
              return { taken: false, category: 'Not yet taken' };
            }
          }
        };
        function getStudentStatusForSort(student: Student): string {
          const postStatus = getStudentTestStatus(student, 'post');
          if (!postStatus.taken || !postStatus.category || !(postStatus.category in statusOrder)) return 'Not yet taken';
          return postStatus.category;
        }
        let sortedStudents = [...(cls.students || [])];
        if (sortColumn === 'name') {
          sortedStudents.sort((a, b) => sortAsc ? a.nickname.localeCompare(b.nickname) : b.nickname.localeCompare(a.nickname));
        } else if (sortColumn === 'status') {
          sortedStudents.sort((a, b) => {
            const aOrder = statusOrder[getStudentStatusForSort(a) as keyof typeof statusOrder] ?? 0;
            const bOrder = statusOrder[getStudentStatusForSort(b) as keyof typeof statusOrder] ?? 0;
            return sortAsc ? aOrder - bOrder : bOrder - aOrder;
          });
        } else if (sortColumn === 'pre') {
          sortedStudents.sort((a, b) => {
            const aStatus = getStudentTestStatus(a, 'pre');
            const bStatus = getStudentTestStatus(b, 'pre');
            const aScore = aStatus.taken ? (aStatus.score || 0) : -1;
            const bScore = bStatus.taken ? (bStatus.score || 0) : -1;
            return sortAsc ? aScore - bScore : bScore - aScore;
          });
        } else if (sortColumn === 'post') {
          sortedStudents.sort((a, b) => {
            const aStatus = getStudentTestStatus(a, 'post');
            const bStatus = getStudentTestStatus(b, 'post');
            const aScore = aStatus.taken ? (aStatus.score || 0) : -1;
            const bScore = bStatus.taken ? (bStatus.score || 0) : -1;
            return sortAsc ? aScore - bScore : bScore - aScore;
          });
        }
        // Header click handler
        const handleSort = (col: 'name' | 'status' | 'pre' | 'post') => {
          if (sortColumn === col) {
            setSortAsc(!sortAsc);
          } else {
            setSortColumn(col);
            setSortAsc(true);
          }
        };
        // Compute class average improvement and post-test average
        const studentsWithBoth = (cls.students ?? []).filter(s => {
          const hasPre = s.preScore && typeof s.preScore.pattern === 'number' && typeof s.preScore.numbers === 'number';
          const hasPost = s.postScore && typeof s.postScore.pattern === 'number' && typeof s.postScore.numbers === 'number';
          // Consider as 'taken' if at least one part is > 0, or both are zero (i.e., test was submitted)
          const preTaken = hasPre && s.preScore && (s.preScore.pattern > 0 || s.preScore.numbers > 0 || (s.preScore.pattern === 0 && s.preScore.numbers === 0));
          const postTaken = hasPost && s.postScore && (s.postScore.pattern > 0 || s.postScore.numbers > 0 || (s.postScore.pattern === 0 && s.postScore.numbers === 0));
          return preTaken && postTaken;
        });
        let avgImprovement = 0;
        let avgPost = 0;
        if (studentsWithBoth.length > 0) {
          const improvements = studentsWithBoth.map(s => {
            const pre = (s.preScore?.pattern ?? 0) + (s.preScore?.numbers ?? 0);
            const post = (s.postScore?.pattern ?? 0) + (s.postScore?.numbers ?? 0);
            return pre === 0 ? 100 : ((post - pre) / pre) * 100;
          });
          avgImprovement = Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
          avgPost = Math.round(studentsWithBoth.map(s => (s.postScore?.pattern ?? 0) + (s.postScore?.numbers ?? 0)).reduce((a, b) => a + b, 0) / studentsWithBoth.length);
        }
        let avgImprovementColor = '#ffe066';
        if (avgImprovement > 0) avgImprovementColor = '#27ae60';
        else if (avgImprovement < 0) avgImprovementColor = '#ff5a5a';
        return (
          <View style={[styles.modalBox, { backgroundColor: 'rgba(255,255,255,0.98)' }]}> 
            <Text style={[styles.modalTitle, { marginBottom: 8 }]}>Class List</Text>
            {/* Class averages */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#222' }}>Avg. Improvement</Text>
                <Text style={{ fontWeight: 'bold', fontSize: 18, color: avgImprovementColor }}>{avgImprovement > 0 ? '+' : ''}{avgImprovement}%</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#222' }}>Avg. Post-test</Text>
                <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#0097a7' }}>{avgPost}/20</Text>
              </View>
            </View>
            {/* Column header row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, minWidth: 340 }}>
              <TouchableOpacity style={{ flex: 1, minWidth: 90 }} onPress={() => handleSort('name')}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', color: '#222', fontSize: 13 }}>Name</Text>
                  {sortColumn === 'name' ? (
                    <Text style={{ fontWeight: 'bold', color: '#222', fontSize: 13, marginLeft: 2 }}>{sortAsc ? '\u25B2' : '\u25BC'}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={{ minWidth: 90, alignItems: 'center' }} onPress={() => handleSort('pre')}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', color: '#222', fontSize: 13 }}>Pre-test</Text>
                  {sortColumn === 'pre' ? (
                    <Text style={{ fontWeight: 'bold', color: '#222', fontSize: 13, marginLeft: 2 }}>{sortAsc ? '\u25B2' : '\u25BC'}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={{ minWidth: 90, alignItems: 'center' }} onPress={() => handleSort('post')}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', color: '#222', fontSize: 13 }}>Post-test</Text>
                  {sortColumn === 'post' ? (
                    <Text style={{ fontWeight: 'bold', color: '#222', fontSize: 13, marginLeft: 2 }}>{sortAsc ? '\u25B2' : '\u25BC'}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <View style={{ width: 80 }} />
            </View>
            <ScrollView horizontal style={{ maxWidth: '100%' }} contentContainerStyle={{ minWidth: 340 }}>
            <FlatList
                data={sortedStudents}
              keyExtractor={item => item.id}
                style={{ marginVertical: 10, maxHeight: 400, minWidth: 340 }}
                renderItem={({ item }) => {
                  const preStatus = getStudentTestStatus(item, 'pre');
                  const postStatus = getStudentTestStatus(item, 'post');
                  const bothTaken = preStatus.taken && postStatus.taken;
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, marginBottom: 14, padding: 14, minWidth: 340, gap: 10, elevation: 2, shadowColor: '#27ae60', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
                      <View style={{ flex: 1, minWidth: 90 }}>
                        <TouchableOpacity onPress={() => openModal('studentInfo', { student: item, classId: cls.id })}>
                          <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 2 }}>
                            <Text style={{ color: '#222', fontWeight: 'bold' }}>{item.nickname} </Text>
                            <Text style={{ color: '#0097a7', fontWeight: 'bold' }}>{postStatus.score || 0}/20</Text>
                          </Text>
                          {/* Debug log for postScore */}
                          {/* {console.log('ClassListModal student:', item.nickname, 'postScore:', item.postScore)} */}
                          <Text style={{ fontSize: 12, color: '#444' }}>
                            Pattern: {typeof item.postScore?.pattern === 'number' ? item.postScore.pattern : 0}, Numbers: {typeof item.postScore?.numbers === 'number' ? item.postScore.numbers : 0}
                          </Text>
                          <View style={{ backgroundColor: statusColors[postStatus.category ?? ''] || '#888', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2, alignSelf: 'flex-start' }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{postStatus.category}</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                      {/* Pre-test button/status or improvement */}
                      {bothTaken ? (
                        (() => {
                          let btnColor = '#ffe066'; // yellow for 0
                          let percent = 0;
                          if (typeof preStatus.score === 'number' && typeof postStatus.score === 'number') {
                            percent = preStatus.score === 0 ? 100 : Math.round(((postStatus.score - preStatus.score) / preStatus.score) * 100);
                            if (percent > 0) btnColor = '#27ae60'; // green
                            else if (percent < 0) btnColor = '#ff5a5a'; // red
                          }
                          return (
                            <TouchableOpacity
                              style={{ backgroundColor: btnColor, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, minWidth: 90, alignItems: 'center', marginRight: 4 }}
                              onPress={() => {
                                setImprovementData({
                                  student: item,
                                  pre: typeof preStatus.score === 'number' ? preStatus.score : 0,
                                  post: typeof postStatus.score === 'number' ? postStatus.score : 0,
                                  preStatus: preStatus.category,
                                  postStatus: postStatus.category,
                                });
                                openModal('showImprovement', {
                                  student: item,
                                  pre: preStatus.score || 0,
                                  post: postStatus.score || 0,
                                  preStatus: preStatus.category,
                                  postStatus: postStatus.category,
                                });
                              }}
                            >
                              <Text style={{ color: btnColor === '#ffe066' ? '#222' : '#fff', fontWeight: 'bold', fontSize: 12 }}>{percent > 0 ? '+' : ''}{percent}%</Text>
                            </TouchableOpacity>
                          );
                        })()
                      ) : preStatus.taken ? (
                        <View style={{ alignItems: 'center', marginRight: 4, minWidth: 90 }}>
                          <TouchableOpacity
                            style={{ backgroundColor: '#e0f7fa', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, minWidth: 90, alignItems: 'center' }}
                          >
                            <Text style={{ color: '#0097a7', fontWeight: 'bold', fontSize: 12 }}>
                              Pre: {item.preScore ? ((item.preScore.pattern ?? 0) + (item.preScore.numbers ?? 0)).toString() : 'N/A'}/20
                            </Text>
                          </TouchableOpacity>
                          <Text style={{ fontSize: 10, color: statusColors[preStatus.category ?? ''] || '#888', marginTop: 2, fontWeight: '600' }}>{preStatus.category}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={{ backgroundColor: '#ff5a5a', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, minWidth: 90, alignItems: 'center', marginRight: 4 }}
                          onPress={() => openModal('startTest', { student: item, testType: 'pre', classId: cls.id })}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Pre-test</Text>
                        </TouchableOpacity>
                      )}
                      {/* Post-test button/status or evaluate */}
                      {bothTaken ? (
                        <TouchableOpacity
                          style={{ backgroundColor: '#6c63ff', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, minWidth: 90, alignItems: 'center', marginRight: 4 }}
                          onPress={() => {
                            openModal('evaluateStudent', { student: item, classId: cls.id });
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Evaluate</Text>
                        </TouchableOpacity>
                      ) : postStatus.taken ? (
                        <View style={{ alignItems: 'center', marginRight: 4, minWidth: 90 }}>
                          <TouchableOpacity
                            style={{ backgroundColor: '#e0f7fa', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, minWidth: 90, alignItems: 'center' }}
                          >
                            <Text style={{ color: '#0097a7', fontWeight: 'bold', fontSize: 12 }}>
                              Post: {item.postScore ? ((item.postScore.pattern ?? 0) + (item.postScore.numbers ?? 0)).toString() : 'N/A'}/20
                            </Text>
                          </TouchableOpacity>
                          <Text style={{ fontSize: 10, color: statusColors[postStatus.category ?? ''] || '#888', marginTop: 2, fontWeight: '600' }}>{postStatus.category}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={{ backgroundColor: '#ffb37b', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, minWidth: 90, alignItems: 'center', marginRight: 4 }}
                          onPress={() => openModal('startTest', { student: item, testType: 'post', classId: cls.id })}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Post-test</Text>
                        </TouchableOpacity>
                      )}
                      {/* Edit and Delete buttons remain unchanged */}
                      <TouchableOpacity style={{ backgroundColor: '#0a7ea4', borderRadius: 8, padding: 6, marginRight: 4 }} onPress={() => {
                        openModal('editStudent', { student: item, classId: cls.id });
                      }}>
                        <MaterialIcons name="edit" size={18} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={{ backgroundColor: '#ff5a5a', borderRadius: 8, padding: 6 }} onPress={() => {
                        Alert.alert('Delete Student', `Are you sure you want to delete ${item.nickname}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => {
                            deleteStudent(item.id);
                          } },
                        ]);
                      }}>
                        <MaterialIcons name="delete" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            </ScrollView>
            <Pressable style={[styles.modalBtn, { alignSelf: 'center', marginTop: 10 }]} onPress={closeModal}><Text style={styles.modalBtnText}>Close</Text></Pressable>
          </View>
        );
      case 'startTest':
        return (
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Start {testType === 'pre' ? 'Pre-test' : 'Post-test'}</Text>
            <Text style={styles.modalStat}>
              Student: <Text style={styles.modalStatNum}>{selectedStudent?.nickname}</Text>
                      </Text>
            <Text style={styles.modalStat}>
              Number: <Text style={styles.modalStatNum}>{selectedStudent?.studentNumber}</Text>
            </Text>
            <Text style={styles.modalNote}>
              This will start the {testType === 'pre' ? 'pre-test' : 'post-test'} for {selectedStudent?.nickname}. 
              The student can take this test without their parent present.
            </Text>
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalBtn} onPress={closeModal}><Text style={styles.modalBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={startTest}><Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Start Test</Text></Pressable>
            </View>
          </View>
        );
      case 'announce':
        // Debug log for canSend state
        console.log('ANNOUNCE DEBUG', { announceTitle, announceText, selectedClassId, teacherId: currentTeacher?.teacherId });
        // If no class is selected, show a dropdown to select class
        const canSend = !!announceTitle.trim() && !!announceText.trim() && !!selectedClassId && !!currentTeacher?.teacherId;
        const handleSendAnnouncement = async () => {
          if (!announceTitle.trim() || !announceText.trim() || !selectedClassId || !currentTeacher?.teacherId) {
            Alert.alert('Error', 'Please enter a title and message.');
            return;
          }
          try {
            const announcementId = `ANN-${Date.now()}`;
            const date = new Date().toISOString();
            const announcement = {
              announcementid: announcementId,
              classid: selectedClassId,
              title: announceTitle.trim(),
              message: announceText.trim(),
              date,
              teacherid: currentTeacher.teacherId,
            };
            await set(ref(db, `Announcements/${announcementId}`), announcement);
            Alert.alert('Success', 'Announcement sent!');
            setAnnounceTitle('');
            closeModal();
          } catch (err) {
            Alert.alert('Error', 'Failed to send announcement.');
          }
        };
        // Auto-select class if only one class exists and selectedClassId is not set
        if (modalType === 'announce' && classes.length === 1 && !selectedClassId) {
          setSelectedClassId(classes[0].id);
        }
        return (
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Send Announcement</Text>
            {!selectedClassId && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: 'bold', color: '#222', marginBottom: 4 }}>Select Class</Text>
                <View style={{ borderWidth: 1, borderColor: '#e0f7e2', borderRadius: 8, backgroundColor: '#f9f9f9' }}>
                  {classes.map(cls => (
                    <Pressable key={cls.id} style={{ padding: 10 }} onPress={() => setSelectedClassId(cls.id)}>
                      <Text style={{ color: '#27ae60', fontWeight: 'bold' }}>{cls.section} ({cls.school})</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: 'bold', color: '#222', marginBottom: 4 }}>Title</Text>
              <TextInput
                style={[styles.modalInput, { marginBottom: 0 }]}
                placeholder="Announcement Title"
                value={announceTitle}
                onChangeText={setAnnounceTitle}
              />
            </View>
            <Text style={{ fontWeight: 'bold', color: '#222', marginBottom: 4 }}>Message</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 130, textAlignVertical: 'top' }]}
              placeholder="Type your announcement here..."
              value={announceText}
              onChangeText={setAnnounceText}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalBtn} onPress={closeModal}><Text style={styles.modalBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnPrimary, { opacity: canSend ? 1 : 0.5 }]} onPress={canSend ? handleSendAnnouncement : undefined} disabled={!canSend}>
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Send</Text>
              </Pressable>
            </View>
          </View>
        );
      case 'editStudent':
        if (!editingStudent) return null;
        // Validation logic
        const editPreTotal = Number(prePattern) + Number(preNumbers);
        const editPostTotal = Number(postPattern) + Number(postNumbers);
        const preOver = editPreTotal > 20;
        const postOver = editPostTotal > 20;
        const handleSaveEditStudent = async () => {
          if (editingStudent && selectedClassId) {
            if (preOver || postOver) {
              Alert.alert('Invalid Score', 'Pre-test and Post-test totals must not exceed 20.');
              return;
            }
            // Build the updated student object first
            const updatedStudent: Student = {
              ...editingStudent,
              nickname: editingStudentName.trim(),
              preScore: { pattern: Number(prePattern), numbers: Number(preNumbers) },
              postScore: { pattern: Number(postPattern), numbers: Number(postNumbers) },
            };
            // Update local state
            setClasses(prev =>
              prev.map(cls =>
                cls.id !== selectedClassId
                  ? cls
                  : {
                      ...cls,
                      students: (cls.students ?? []).map(student =>
                        student.id === editingStudent.id ? updatedStudent : student
                      ),
                    }
              )
            );
            // Update in Firebase DB
            try {
              console.log("Attempting to update student in DB:", updatedStudent);
              await set(ref(db, `Students/${updatedStudent.id}`), updatedStudent);
              console.log("Student updated successfully in DB");
            } catch (err) {
              console.error("Failed to update student in DB:", err);
              Alert.alert("Error", "Failed to update student in the database.");
              return;
            }
            closeModal();
          }
        };
        return (
          <View style={[styles.modalBox, { paddingBottom: 18 }]}> 
            <Text style={[styles.modalTitle, { marginBottom: 8 }]}>Edit Student</Text>
            {/* Section: Student Info */}
            <Text style={{ fontWeight: 'bold', color: '#27ae60', fontSize: 15, marginBottom: 2 }}>Student Information</Text>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>Student Number</Text>
            <View style={{ backgroundColor: '#f3f3f3', borderRadius: 8, padding: 8, marginBottom: 2 }}>
              <Text selectable style={{ color: '#27ae60', fontWeight: 'bold', fontSize: 15 }}>{editingStudent?.studentNumber}</Text>
            </View>
            <Text style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>This is the system-generated student number.</Text>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>Student Name</Text>
            <TextInput
              style={[styles.modalInput, { marginBottom: 10 }]}
              placeholder="Enter new student name"
              value={editingStudentName}
              onChangeText={setEditingStudentName}
            />
            {/* Section: Test Scores */}
            <Text style={{ fontWeight: 'bold', color: '#27ae60', fontSize: 15, marginBottom: 2 }}>Test Scores</Text>
            {/* Pre-test */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Text style={{ fontSize: 14, color: '#222', fontWeight: 'bold', marginRight: 4 }}>📝 Pre-test (out of 20):</Text>
              {preOver && <Text style={{ color: '#ff5a5a', fontSize: 12, marginLeft: 4 }}>*Total exceeds 20!</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Pattern</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: '#f9f9f9' }]}
                  placeholder="Pattern"
                  keyboardType="numeric"
                  value={prePattern}
                  onChangeText={setPrePattern}
                  maxLength={2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Numbers</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: '#f9f9f9' }]}
                  placeholder="Numbers"
                  keyboardType="numeric"
                  value={preNumbers}
                  onChangeText={setPreNumbers}
                  maxLength={2}
                />
              </View>
            </View>
            <Text style={{ fontSize: 11, color: '#aaa', marginBottom: 8, marginTop: 0 }}>Enter the number of correct answers for each part.</Text>
            {/* Post-test */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Text style={{ fontSize: 14, color: '#222', fontWeight: 'bold', marginRight: 4 }}>✅ Post-test (out of 20):</Text>
              {postOver && <Text style={{ color: '#ff5a5a', fontSize: 12, marginLeft: 4 }}>*Total exceeds 20!</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Pattern</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: '#f9f9f9' }]}
                  placeholder="Pattern"
                  keyboardType="numeric"
                  value={postPattern}
                  onChangeText={setPostPattern}
                  maxLength={2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Numbers</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: '#f9f9f9' }]}
                  placeholder="Numbers"
                  keyboardType="numeric"
                  value={postNumbers}
                  onChangeText={setPostNumbers}
                  maxLength={2}
                />
              </View>
            </View>
            <Text style={{ fontSize: 11, color: '#aaa', marginBottom: 12, marginTop: 0 }}>Enter the number of correct answers for each part.</Text>
            {/* Buttons */}
            <View style={[styles.modalBtnRow, { marginTop: 10 }]}> 
              <Pressable style={styles.modalBtn} onPress={closeModal}><Text style={styles.modalBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnPrimary, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={handleSaveEditStudent}>
                <MaterialIcons name="save" size={18} color="#fff" style={{ marginRight: 4 }} />
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Save</Text>
              </Pressable>
            </View>
          </View>
        );
      case 'showImprovement':
        if (!improvementData) return null;
        const { student, pre, post, preStatus, postStatus } = improvementData;
        // Use the actual student object to get pattern/numbers breakdown
        const preScore = student.preScore || { pattern: 0, numbers: 0 };
        const postScore = student.postScore || { pattern: 0, numbers: 0 };
        const preTotal = (preScore.pattern ?? 0) + (preScore.numbers ?? 0);
        const postTotal = (postScore.pattern ?? 0) + (postScore.numbers ?? 0);
        const percent = preTotal === 0 ? 100 : Math.round(((postTotal - preTotal) / preTotal) * 100);
        let percentColor = '#ffe066'; // yellow by default
        if (percent > 0) percentColor = '#27ae60'; // green
        else if (percent < 0) percentColor = '#ff5a5a'; // red
        return (
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Improvement Details</Text>
            <Text style={styles.modalStat}>Student: <Text style={styles.modalStatNum}>{student.nickname}</Text></Text>
            <Text style={styles.modalStat}>Pre-test: <Text style={styles.modalStatNum}>{String(preTotal)}/20</Text> (Pattern: {String(preScore.pattern ?? 0)}, Numbers: {String(preScore.numbers ?? 0)})</Text>
            <Text style={styles.modalStat}>Post-test: <Text style={styles.modalStatNum}>{String(postTotal)}/20</Text> (Pattern: {String(postScore.pattern ?? 0)}, Numbers: {String(postScore.numbers ?? 0)})</Text>
            <Text style={styles.modalStat}>Improvement: <Text style={[styles.modalStatNum, { color: percentColor }]}>{percent > 0 ? '+' : ''}{percent}%</Text></Text>
            <Pressable style={[styles.modalBtn, { alignSelf: 'center', marginTop: 10 }]} onPress={closeModal}><Text style={styles.modalBtnText}>Close</Text></Pressable>
          </View>
        );
      case 'evaluateStudent':
        if (!evaluationData) return null;
        // Get the student object and breakdown
        const evalStudent = evaluationData.student;
        const evalPreScore = evalStudent.preScore || { pattern: 0, numbers: 0 };
        const evalPostScore = evalStudent.postScore || { pattern: 0, numbers: 0 };
        const evalPreTotal = (evalPreScore.pattern ?? 0) + (evalPreScore.numbers ?? 0);
        const evalPostTotal = (evalPostScore.pattern ?? 0) + (evalPostScore.numbers ?? 0);
        const evalPercent = evalPreTotal === 0 ? 100 : Math.round(((evalPostTotal - evalPreTotal) / evalPreTotal) * 100);
        let evalPercentColor = '#ffe066';
        if (evalPercent > 0) evalPercentColor = '#27ae60';
        else if (evalPercent < 0) evalPercentColor = '#ff5a5a';
        return (
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Send Evaluation to Parent</Text>
            <Text style={styles.modalStat}>Student: <Text style={styles.modalStatNum}>{evalStudent.nickname}</Text></Text>
            <Text style={styles.modalStat}>Pre-test: <Text style={styles.modalStatNum}>{String(evalPreTotal)}/20</Text> (Pattern: {String(evalPreScore.pattern ?? 0)}, Numbers: {String(evalPreScore.numbers ?? 0)})</Text>
            <Text style={styles.modalStat}>Post-test: <Text style={styles.modalStatNum}>{String(evalPostTotal)}/20</Text> (Pattern: {String(evalPostScore.pattern ?? 0)}, Numbers: {String(evalPostScore.numbers ?? 0)})</Text>
            <Text style={styles.modalStat}>Improvement: <Text style={[styles.modalStatNum, { color: evalPercentColor }]}>{evalPercent > 0 ? '+' : ''}{evalPercent}%</Text></Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Type your evaluation here..."
              value={evaluationText}
              onChangeText={setEvaluationText}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalBtn} onPress={closeModal}><Text style={styles.modalBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={() => {
                Alert.alert('Send Evaluation', 'Are you sure you want to send this evaluation to the parent?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Send', style: 'destructive', onPress: () => { setEvaluationText(''); closeModal(); } },
                ]);
              }}><Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Send Evaluation</Text></Pressable>
            </View>
          </View>
        );
      case 'studentInfo':
        return (
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Student Information</Text>
            <Text style={styles.modalStat}>Student: <Text style={styles.modalStatNum}>{selectedStudent?.nickname}</Text></Text>
            <Text style={styles.modalStat}>Number: <Text style={styles.modalStatNum}>{selectedStudent?.studentNumber}</Text></Text>
            <Text style={styles.modalStat}>Parent Auth Code: <Text style={styles.modalStatNum}>{parentAuthCode ?? 'Loading...'}</Text></Text>
            <Text style={styles.modalStat}>Pre-test: <Text style={styles.modalStatNum}>{selectedStudent?.preScore ? String((selectedStudent.preScore.pattern ?? 0) + (selectedStudent.preScore.numbers ?? 0)) : 'N/A'}/20</Text> (Pattern: {String(selectedStudent?.preScore?.pattern ?? 0)}, Numbers: {String(selectedStudent?.preScore?.numbers ?? 0)})</Text>
            <Text style={styles.modalStat}>Post-test: <Text style={styles.modalStatNum}>{selectedStudent?.postScore ? String((selectedStudent.postScore.pattern ?? 0) + (selectedStudent.postScore.numbers ?? 0)) : 'N/A'}/20</Text> (Pattern: {String(selectedStudent?.postScore?.pattern ?? 0)}, Numbers: {String(selectedStudent?.postScore?.numbers ?? 0)})</Text>
            <Pressable style={[styles.modalBtn, { alignSelf: 'center', marginTop: 10 }]} onPress={closeModal}><Text style={styles.modalBtnText}>Close</Text></Pressable>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground source={bgImage} style={styles.bg} imageStyle={{ opacity: 0.13, resizeMode: 'cover' }}>
        {/* Overlay for better blending (non-blocking) */}
        <View style={styles.bgOverlay} />
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.mainContainer}>
              <View style={styles.headerWrap}>
                <View style={styles.headerRow}>
                  <View>
                    <Text style={styles.welcome}>Welcome,</Text>
                    <Text style={styles.teacherName}>Teacher {teacherName}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity 
                      style={[styles.profileBtn, { backgroundColor: refreshing ? '#e0f7fa' : 'rgba(255,255,255,0.7)' }]} 
                      onPress={refreshData}
                      disabled={refreshing}
                    >
                      <MaterialIcons 
                        name="refresh" 
                        size={24} 
                        color={refreshing ? '#0097a7' : '#27ae60'} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.profileBtn}>
                      <MaterialCommunityIcons name="account-circle" size={38} color="#27ae60" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={dashboardCardStyle}>
                {/* Title and Add Class in a single row */}
                <View style={styles.dashboardHeaderRow}>
                  <Text style={styles.dashboardTitle}>Classrooms</Text>
                  <TouchableOpacity style={styles.addClassBtn} onPress={() => openModal('addClass')}>
                    <Text style={styles.addClassBtnText}>Add Class</Text>
                  </TouchableOpacity>
              </View>
                <View style={{ height: 8 }} />
                {classes.map(cls => (
                  <React.Fragment key={cls.id}>
                    {renderClassPanel(cls)}
                  </React.Fragment>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
        {/* Modal for all actions */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            {renderModalContent()}
          </View>
        </Modal>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#f7fafc',
    position: 'relative',
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    zIndex: 0,
    pointerEvents: 'none',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 16,
    width: '100%',
    minHeight: '100%',
    zIndex: 2,
  },
  mainContainer: {
    width: '100%',
    maxWidth: 600,
    marginTop: 0,
    zIndex: 2,
  },
  dashboardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 0,
    width: '100%',
    paddingHorizontal: 8,
  },
  dashboardTitle: {
    fontSize: Dimensions.get('window').width < 400 ? 20 : 26,
    fontWeight: 'bold',
    color: '#222',
    marginLeft: 0,
    letterSpacing: 1,
    textShadowColor: '#e0ffe6',
    textShadowRadius: 6,
  },
  addClassBtn: {
    backgroundColor: '#27ae60',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 18,
    shadowColor: '#27ae60',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    marginRight: 0,
  },
  addClassBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  headerWrap: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 18,
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
    paddingHorizontal: 24,
    marginTop: 0,
    marginBottom: 0,
  },
  welcome: {
    fontSize: 23,
    fontWeight: '600',
    color: '#222',
    letterSpacing: 0.5,
  },
  teacherName: {
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
  classCard: {
    width: '92%',
    backgroundColor: 'rgba(243,243,243,0.92)',
    borderRadius: 22,
    padding: 22,
    marginBottom: 18,
    elevation: 3,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  classCardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: '#27ae60',
    borderRadius: 18,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#27ae60',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  classInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  classSchool: {
    fontSize: 15,
    color: '#888',
    fontWeight: '600',
  },
  classSection: {
    fontSize: 23,
    color: '#27ae60',
    fontWeight: 'bold',
    marginTop: 2,
  },
  classTotal: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
    marginBottom: 4,
  },
  addStudentBtn: {
    backgroundColor: '#27ae60',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginTop: 2,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  addStudentBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  performanceCard: {
    width: '92%',
    backgroundColor: '#e5e5e5', // light gray to match the image
    borderRadius: 22,
    padding: 22,
    marginBottom: 18,
    elevation: 3,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  performanceTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#27ae60',
  },
  announceBtn: {
    backgroundColor: '#27ae60',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginLeft: 8,
    shadowColor: '#27ae60',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  announceBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  performanceLabel: {
    fontSize: 16,
    color: '#222',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 10,
  },
  tasksBox: {
    width: '92%',
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 22,
    elevation: 4,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  tasksTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    paddingRight: 0,
    paddingLeft: 0,
  },
  tasksTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#222',
    marginLeft: 4,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  generalProgressWrap: {
    height: 10,
    flex: 1,
    backgroundColor: '#e6e6e6',
    borderRadius: 5,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexShrink: 1,
  },
  generalProgressBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#27ae60',
  },
  generalProgressText: {
    fontSize: 14,
    color: '#888',
    minWidth: 40,
    textAlign: 'right',
    marginLeft: 0,
    fontWeight: '600',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(247,250,253,0.92)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    elevation: 2,
    shadowColor: '#27ae60',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  taskTitleSmall: {
    fontWeight: '700',
    color: '#222',
    fontSize: 15,
    flexShrink: 1,
    marginRight: 8,
  },
  taskDetails: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    lineHeight: 18,
    marginBottom: 2,
    fontWeight: '500',
  },
  taskArrowBtn: {
    backgroundColor: '#e6ffe6',
    borderRadius: 18,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
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
    padding: Dimensions.get('window').width < 400 ? 12 : 24,
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
  modalListItem: {
    fontSize: 15,
    color: '#222',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  modalStat: {
    fontSize: 16,
    color: '#444',
    marginBottom: 4,
    fontWeight: '600',
  },
  modalStatNum: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  modalNote: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
    marginTop: -6,
    textAlign: 'left',
  },
  classListIconBtn: {
    marginLeft: 8,
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(39,174,96,0.08)',
  },
  studentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(247,250,253,0.92)',
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#27ae60',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  studentInfo: {
    flex: 1,
  },
  studentNickname: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
  studentNumber: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  testButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  testButton: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  testButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  preTestButton: {
    backgroundColor: '#ff5a5a',
  },
  postTestButton: {
    backgroundColor: '#ff9f43',
  },
  analyticsCard: {
    flex: 1,
    minWidth: 120,
    maxWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 8,
    marginBottom: 16,
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  analyticsIcon: {
    marginBottom: 6,
  },
  analyticsValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
  },
  analyticsLabel: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
    textAlign: 'center',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 0,
    marginHorizontal: 4,
    minWidth: 90,
    maxWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#27ae60',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  compactCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0f7e2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 2,
    width: '99%',
    maxWidth: 370,
    alignSelf: 'center',
    shadowColor: 'transparent',
  },
  compactCardCol: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 80,
  },
  compactCardLabel: {
    fontWeight: '600',
    color: '#222',
    fontSize: 13,
    marginRight: 2,
  },
  compactCardValue: {
    fontWeight: 'bold',
    fontSize: 22,
    marginTop: 0,
    letterSpacing: 0.2,
  },
  compactCardDivider: {
    width: 1,
    height: 38,
    backgroundColor: '#e0f7e2',
    marginHorizontal: 12,
    borderRadius: 1,
  },
  modalLabel: {
    fontSize: 15,
    color: '#27ae60',
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 2,
  },
}); 