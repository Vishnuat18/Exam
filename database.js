import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  onValue, 
  off, 
  remove,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { 
  getAuth, 
  signInAnonymously,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// Firebase configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyA9lhhLwyp6f3ReDXaLPauIuvpuP3RyUQU",
  authDomain: "nitha-8f9f4.firebaseapp.com",
  databaseURL: "https://nitha-8f9f4-default-rtdb.firebaseio.com",
  projectId: "nitha-8f9f4",
  storageBucket: "nitha-8f9f4.firebasestorage.app",
  messagingSenderId: "332719594661",
  appId: "1:332719594661:web:8549577fc89327db38014c",
  measurementId: "G-3LD8LTW1YD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

/**
 * Scan database and local cache to get the next incremental register number
 */
async function getNextRegisterNumber() {
  let count = 0;
  
  // 1. Try querying remote database users
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const key = child.key; // e.g. "2026_TEST_001"
        if (key.startsWith('2026_TEST_')) {
          const suffix = key.substring(10);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > count) {
            count = num;
          }
        }
      });
    }
  } catch(e) {
    console.warn("Failed to check remote DB for counter. Querying local registry.", e);
  }
  
  // 2. Scan localStorage cache for local registrations
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('user_profile_2026_TEST_')) {
      const suffix = key.substring(23);
      const num = parseInt(suffix, 10);
      if (!isNaN(num) && num > count) {
        count = num;
      }
    }
  }
  
  const nextNum = count + 1;
  return `2026_TEST_` + String(nextNum).padStart(3, '0');
}

/**
 * Register a new student profile with an auto-incrementing Register Number
 */
export async function registerStudent(name, email, password) {
  if (!name || !email || !password) {
    throw new Error("All registration fields (Name, Email, Password) are required!");
  }
  
  // Check if email already exists
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (snapshot.exists()) {
      let emailExists = false;
      snapshot.forEach(child => {
        const val = child.val();
        if (val.email && val.email.toLowerCase() === email.toLowerCase()) {
          emailExists = true;
        }
      });
      if (emailExists) {
        throw new Error("This email is already registered! Please log in.");
      }
    }
  } catch(e) {
    if (e.message && e.message.includes("already registered")) {
      throw e;
    }
    console.warn("Database lookup failed during registration check. Proceeding.", e);
  }
  
  // Generate registration code
  const registerNumber = await getNextRegisterNumber();
  const regClean = registerNumber.replace(/[\.\#\$\[\]]/g, '_');
  const userRef = ref(db, `users/${regClean}`);
  
  let studentUid = "student_" + Math.floor(100000 + Math.random() * 900000);
  try {
    const userCredential = await signInAnonymously(auth);
    studentUid = userCredential.user.uid;
  } catch(e) {
    console.warn("Auth disabled. Proceeding with local UID registration.", e);
  }
  
  const studentProfile = {
    uid: studentUid,
    name,
    registerNumber,
    email,
    password,
    role: "student",
    loggedInAt: Date.now()
  };
  
  // Cache locally
  localStorage.setItem(`user_profile_${regClean}`, JSON.stringify(studentProfile));
  
  // Write to Firebase Realtime Database
  try {
    await set(userRef, studentProfile);
  } catch(e) {
    console.warn("Failed to register student to remote Firebase DB. Registered locally.", e);
  }
  
  return studentProfile;
}

/**
 * Log in an existing student profile using Email
 */
export async function loginStudent(email, password) {
  if (!email || !password) {
    throw new Error("Email and Password are required!");
  }
  
  let studentProfile = null;
  
  // Try fetching from database by searching email
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const val = child.val();
        if (val.email && val.email.toLowerCase() === email.toLowerCase()) {
          studentProfile = val;
        }
      });
    }
  } catch(e) {
    console.warn("Failed to fetch remote profile. Checking local storage cache.", e);
  }
  
  // Fallback to local storage profile if offline
  if (!studentProfile) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('user_profile_')) {
        try {
          const cached = JSON.parse(localStorage.getItem(key));
          if (cached && cached.email && cached.email.toLowerCase() === email.toLowerCase()) {
            studentProfile = cached;
            break;
          }
        } catch(e) {}
      }
    }
  }
  
  if (!studentProfile) {
    throw new Error("Email not found! Please register first.");
  }
  
  if (studentProfile.password !== password) {
    throw new Error("Incorrect password!");
  }
  
  studentProfile.loggedInAt = Date.now();
  
  const regClean = studentProfile.registerNumber.replace(/[\.\#\$\[\]]/g, '_');
  const userRef = ref(db, `users/${regClean}`);
  
  try {
    await signInAnonymously(auth);
    await set(userRef, studentProfile);
  } catch(e) {
    console.warn("Failed to update remote user login timestamp.", e);
  }
  
  return studentProfile;
}

/**
 * Get student's previous submission (if any)
 */
export async function getStudentSubmission(registerNumber) {
  if (!registerNumber) return null;
  
  const regClean = registerNumber.replace(/[\.\#\$\[\]]/g, '_');
  const subRef = ref(db, `submissions/${regClean}`);
  
  try {
    const snapshot = await get(subRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
  } catch(e) {
    console.warn("Failed to fetch remote submission: ", e);
  }
  
  // Check local cache
  const cached = localStorage.getItem(`submitted_${regClean}`);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch(e) {}
  }
  
  return null;
}

/**
 * Perform Admin login authentication
 */
export async function authenticateAdmin(username, password) {
  try {
    await signOut(auth);
  } catch(e) {}
  
  if (username === 'admin@2026' && password === 'password') {
    const adminProfile = {
      uid: "admin_local",
      name: "Administrator",
      role: "admin",
      username: "admin@2026"
    };
    
    try {
      const userCredential = await signInAnonymously(auth);
      adminProfile.uid = userCredential.user.uid;
      await set(ref(db, `users/${userCredential.user.uid}`), adminProfile);
    } catch (authErr) {
      console.warn("Firebase Auth disabled. Admin routing on local fallback mode.", authErr);
    }
    return adminProfile;
  } else {
    throw new Error("Invalid Admin username or password!");
  }
}

/**
 * Submit student test completion details with local storage caching
 */
export async function submitStudentExam(studentProfile, selectedAnswers, resultsSummary) {
  if (!studentProfile || studentProfile.role !== 'student') {
    throw new Error("Invalid student session.");
  }
  
  const regClean = studentProfile.registerNumber.replace(/[\.\#\$\[\]]/g, '_');
  const submissionRef = ref(db, `submissions/${regClean}`);
  
  const submissionData = {
    uid: studentProfile.uid,
    name: studentProfile.name,
    registerNumber: studentProfile.registerNumber,
    email: studentProfile.email,
    attemptedCount: resultsSummary.attemptedCount,
    correctCount: resultsSummary.correctCount,
    wrongCount: resultsSummary.wrongCount,
    marksObtained: resultsSummary.marksObtained,
    percentage: resultsSummary.percentage,
    timeTaken: resultsSummary.timeTaken,
    passStatus: resultsSummary.passStatus,
    warningsTriggered: resultsSummary.warningsTriggered,
    answers: selectedAnswers,
    submittedAt: Date.now()
  };
  
  // Cache locally
  localStorage.setItem(`submitted_${regClean}`, JSON.stringify(submissionData));
  let localSubs = JSON.parse(localStorage.getItem('quix_local_submissions') || '[]');
  localSubs.push(submissionData);
  localStorage.setItem('quix_local_submissions', JSON.stringify(localSubs));
  
  // Try remote Firebase update
  try {
    try {
      submissionData.submittedAt = serverTimestamp();
    } catch(e) {}
    await set(submissionRef, submissionData);
    
    const updatedLocalSubs = localSubs.filter(sub => sub.registerNumber !== studentProfile.registerNumber);
    localStorage.setItem('quix_local_submissions', JSON.stringify(updatedLocalSubs));
  } catch (dbErr) {
    console.warn("Failed to upload student response to Firebase Database. Saved locally in browser cache.", dbErr);
  }
  
  try {
    await signOut(auth);
  } catch (e) {}
}

/**
 * Listen to student exam submissions (combines remote Firebase list and local browser cache)
 */
export function listenToExamSubmissions(callback) {
  const submissionsRef = ref(db, 'submissions');
  
  const feedUpdatedList = (remoteList = []) => {
    const localList = JSON.parse(localStorage.getItem('quix_local_submissions') || '[]');
    const combined = [...remoteList];
    
    localList.forEach(ls => {
      if (!combined.some(cs => cs.registerNumber === ls.registerNumber)) {
        combined.push(ls);
      }
    });
    
    // Sort newest submissions first
    combined.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    callback(combined);
  };
  
  let isListening = true;
  let listenerRef = null;
  
  try {
    listenerRef = onValue(submissionsRef, (snapshot) => {
      if (!isListening) return;
      const list = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnap) => {
          list.push(childSnap.val());
        });
      }
      feedUpdatedList(list);
    }, (err) => {
      console.warn("Firebase Database listening denied. Listening to Local Storage submissions cache.", err);
      if (isListening) feedUpdatedList([]);
    });
  } catch(e) {
    console.warn("Firebase Database listener failure. Falling back to Local Caching Mode.", e);
    setTimeout(() => {
      if (isListening) feedUpdatedList([]);
    }, 100);
  }
  
  return () => {
    isListening = false;
    if (listenerRef) {
      try {
        off(submissionsRef, 'value', listenerRef);
      } catch(e) {}
    }
  };
}

/**
 * Clear submissions history database (both local cache and remote database)
 */
export async function clearAllSubmissions() {
  localStorage.removeItem('quix_local_submissions');
  
  // Clear submitted markers in localStorage as well
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('submitted_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  try {
    await remove(ref(db, 'submissions'));
  } catch (e) {
    console.warn("Failed to clear remote submissions database: ", e);
  }
}
