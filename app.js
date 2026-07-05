import { EXAM_QUESTIONS, EXAM_SECTIONS } from "./quiz-data.js?v=2026_07_02_v2";
import {
  registerStudent,
  loginStudent,
  authenticateAdmin,
  submitStudentExam,
  listenToExamSubmissions,
  clearAllSubmissions,
  getStudentSubmission
} from "./database.js";

// ==========================================
// 1. SOUND SYNTHESIZER (WEB AUDIO API)
// ==========================================
class WebSoundSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, startTime, duration, startVol = 0.1) {
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(startVol, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      console.warn("AudioContext init blocked: ", e);
    }
  }

  playClick() {
    if (this.muted) return;
    this.playTone(550, 'sine', this.ctx ? this.ctx.currentTime : 0, 0.05, 0.06);
  }

  playWarning() {
    if (this.muted) return;
    try {
      this.init();
      const now = this.ctx.currentTime;
      this.playTone(600, 'sine', now, 0.12, 0.08);
      this.playTone(600, 'sine', now + 0.15, 0.2, 0.08);
    } catch(e) {}
  }

  playSuccess() {
    if (this.muted) return;
    try {
      this.init();
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'sine', now + idx * 0.08, 0.22, 0.06);
      });
    } catch(e) {}
  }
}

const synth = new WebSoundSynth();

// ==========================================
// 2. CANVAS GRAPHICS (BACKGROUND PARTICLES)
// ==========================================
class CanvasEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Spawn ambient background particles
    for (let i = 0; i < 35; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: Math.random() * 1.5 + 0.5,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: (Math.random() - 0.5) * 0.2,
        opacity: Math.random() * 0.4 + 0.1
      });
    }
    
    this.animate();
  }

  resize() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  animate() {
    if (!this.canvas) return;
    requestAnimationFrame(() => this.animate());
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;

      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 242, 254, ${p.opacity})`;
      this.ctx.fill();
    });
  }
}

// ==========================================
// 3. APPLICATION STATE MANAGEMENT
// ==========================================
const state = {
  userProfile: null,
  activeScreen: 'login-screen',
  loginRole: 'student', // 'student' | 'admin'
  
  // Exam parameters
  examQuestions: EXAM_QUESTIONS,
  currentQuestionIndex: 0,
  
  // selectedAnswers will store:
  // - MCQ: option index (Number)
  // - DragDrop: array of code strings (Array)
  // - HTMLDragDrop: { order: Array, selectedOutput: Number }
  selectedAnswers: Array(EXAM_QUESTIONS.length).fill(null),
  markedForReview: new Set(),
  visitedQuestions: new Set([0]),
  examTimer: null,
  examSecondsLeft: 45 * 60, // 45 minutes in seconds
  examStartTime: null,
  
  // Security infractions
  warningsCount: 0,
  isSecurityWarningActive: false,
  
  // Admin cache
  submissionsList: [],
  adminUnsub: null,
  
  // Student dashboard cache
  studentSubmission: null
};

let canvasEngine;

// Run initialization on load
window.addEventListener('DOMContentLoaded', () => {
  // Clear any cached student login or submission data for 2026IT001
  localStorage.removeItem('submitted_2026IT001');
  localStorage.removeItem('user_profile_2026IT001');

  canvasEngine = new CanvasEngine('particle-canvas');
  initGlobalEvents();
  switchScreen('login-screen');
});

// ==========================================
// 4. SCREEN NAVIGATION & NOTIFICATIONS
// ==========================================
function switchScreen(screenId) {
  // Hide current active screen
  const prevScreen = document.querySelector('.screen.active');
  if (prevScreen) {
    prevScreen.classList.remove('active');
    prevScreen.style.display = 'none';
  }
  
  // Show new screen
  const newScreen = document.getElementById(screenId);
  if (newScreen) {
    newScreen.style.display = 'flex';
    setTimeout(() => {
      newScreen.classList.add('active');
    }, 50);
    state.activeScreen = screenId;
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message) {
  const container = document.getElementById('toast-holder');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span></span> <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function updateHeaderWidget() {
  const widget = document.getElementById('header-profile-widget');
  if (!widget) return;
  
  if (state.userProfile) {
    widget.style.display = 'flex';
    const roleText = state.userProfile.role === 'admin' ? 'Admin Portal' : `Reg No: ${state.userProfile.registerNumber}`;
    widget.querySelector('.widget-name').textContent = state.userProfile.name;
    widget.querySelector('.widget-role').textContent = roleText;
  } else {
    widget.style.display = 'none';
  }
}

// ==========================================
// 5. SECURITY RULES LOGIC
// ==========================================
function enableSecurityMeters() {
  // Block Right-Click Context Menu
  document.addEventListener('contextmenu', blockEvent);
  
  // Block Copy, Paste, Cut
  document.addEventListener('copy', blockEvent);
  document.addEventListener('paste', blockEvent);
  document.addEventListener('cut', blockEvent);
  
  // Block Selection Start
  document.addEventListener('selectstart', blockEvent);
  
  // Prevent Page Refresh
  window.addEventListener('beforeunload', preventRefreshEvent);
  
  // Full-Screen change listener
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  
  // Tab/Window Switch listener
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function disableSecurityMeters() {
  document.removeEventListener('contextmenu', blockEvent);
  document.removeEventListener('copy', blockEvent);
  document.removeEventListener('paste', blockEvent);
  document.removeEventListener('cut', blockEvent);
  document.removeEventListener('selectstart', blockEvent);
  window.removeEventListener('beforeunload', preventRefreshEvent);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  // Exit Fullscreen if currently in fullscreen
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(err => console.log(err));
  }
}

function blockEvent(e) {
  e.preventDefault();
}

function preventRefreshEvent(e) {
  e.preventDefault();
  e.returnValue = 'Are you sure you want to exit the exam? Your progress will be lost.';
  return e.returnValue;
}

function handleFullscreenChange() {
  if (state.activeScreen !== 'exam-screen') return;
  
  // If the user has exited full-screen, trigger warning
  if (!document.fullscreenElement) {
    triggerSecurityInfractionWarning("Full Screen mode was exited. Full screen mode is mandatory during the assessment.");
  }
}

function handleVisibilityChange() {
  if (state.activeScreen !== 'exam-screen') return;
  
  // If visibility state changes to hidden, it means user switched tabs/windows
  if (document.visibilityState === 'hidden') {
    triggerSecurityInfractionWarning("Tab switching or window minimization was detected. Browser tab switches are prohibited.");
  }
}

function triggerSecurityInfractionWarning(reasonText) {
  if (state.isSecurityWarningActive) return;
  state.isSecurityWarningActive = true;
  synth.playWarning();
  
  state.warningsCount++;
  
  if (state.warningsCount >= 3) {
    // Force auto-submit immediately
    state.isSecurityWarningActive = false;
    document.getElementById('security-warning-modal').classList.remove('active');
    showToast("Exam auto-submitted due to maximum security violations!");
    completeStudentExamSubmit(true); // pass true for auto-submit
  } else {
    // Show Warning alert modal
    const modal = document.getElementById('security-warning-modal');
    document.getElementById('security-breach-reason').textContent = reasonText;
    document.getElementById('security-warning-stage').textContent = `Warning ${state.warningsCount} of 2`;
    
    modal.classList.add('active');
  }
}

// Request Fullscreen
function requestFullscreenLock() {
  const docEl = document.documentElement;
  if (docEl.requestFullscreen) {
    docEl.requestFullscreen().catch(err => {
      console.warn("Fullscreen request error: ", err);
    });
  }
}

// ==========================================
// 6. GLOBAL EVENT INITIALIZATION
// ==========================================
function initGlobalEvents() {
  // Login Tabs Toggle
  const studentTab = document.getElementById('tab-student');
  const adminTab = document.getElementById('tab-admin');
  
  studentTab.addEventListener('click', () => {
    synth.playClick();
    studentTab.classList.add('active');
    adminTab.classList.remove('active');
    state.loginRole = 'student';
    
    document.getElementById('group-student-fields').style.display = 'flex';
    document.getElementById('group-admin-fields').style.display = 'none';
  });

  adminTab.addEventListener('click', () => {
    synth.playClick();
    adminTab.classList.add('active');
    studentTab.classList.remove('active');
    state.loginRole = 'admin';
    
    document.getElementById('group-student-fields').style.display = 'none';
    document.getElementById('group-admin-fields').style.display = 'flex';
  });

  // Student Sub-Tabs Toggle (Register vs Login)
  const subTabRegister = document.getElementById('sub-tab-register');
  const subTabLogin = document.getElementById('sub-tab-login');
  
  state.studentAction = 'register'; // Default action
  
  subTabRegister.addEventListener('click', () => {
    synth.playClick();
    subTabRegister.classList.add('active');
    subTabLogin.classList.remove('active');
    
    subTabRegister.style.color = 'var(--primary-cyan)';
    subTabRegister.style.fontWeight = '600';
    subTabLogin.style.color = 'var(--text-muted)';
    subTabLogin.style.fontWeight = 'normal';
    
    document.getElementById('form-group-student-name').style.display = 'block';
    document.getElementById('form-group-student-email').style.display = 'block';
    document.getElementById('form-group-student-reg').style.display = 'none';
    document.getElementById('login-submit-btn').textContent = 'Register & Start Test';
    state.studentAction = 'register';
  });
  
  subTabLogin.addEventListener('click', () => {
    synth.playClick();
    subTabLogin.classList.add('active');
    subTabRegister.classList.remove('active');
    
    subTabLogin.style.color = 'var(--primary-cyan)';
    subTabLogin.style.fontWeight = '600';
    subTabRegister.style.color = 'var(--text-muted)';
    subTabRegister.style.fontWeight = 'normal';
    
    document.getElementById('form-group-student-name').style.display = 'none';
    document.getElementById('form-group-student-email').style.display = 'block';
    document.getElementById('form-group-student-reg').style.display = 'none';
    document.getElementById('login-submit-btn').textContent = 'Login & Start Test';
    state.studentAction = 'login';
  });

  // Login Form Submission
  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    synth.playClick();
    
    let name = "";
    let email = "";
    let password = "";
    
    if (state.loginRole === 'student') {
      email = document.getElementById('student-email').value.trim();
      password = document.getElementById('student-pass').value.trim();
      
      if (state.studentAction === 'register') {
        name = document.getElementById('student-name').value.trim();
        
        if (!name || !email || !password) {
          showToast("Please fill in all registration fields!");
          return;
        }
      } else {
        if (!email || !password) {
          showToast("Please enter your Email and Password!");
          return;
        }
      }
    } else {
      name = document.getElementById('admin-user').value.trim();
      password = document.getElementById('admin-pass').value.trim();
      
      if (!name || !password) {
        showToast("Please enter Admin credentials!");
        return;
      }
    }
    
    try {
      showToast("Accessing portal...");
      let profile;
      if (state.loginRole === 'admin') {
        profile = await authenticateAdmin(name, password);
      } else {
        if (state.studentAction === 'register') {
          profile = await registerStudent(name, email, password);
        } else {
          profile = await loginStudent(email, password);
        }
      }
      
      state.userProfile = profile;
      updateHeaderWidget();
      synth.playSuccess();
      
      if (profile.role === 'admin') {
        launchAdminPortal();
      } else {
        document.getElementById('exam-student-name').textContent = profile.name;
        document.getElementById('exam-student-reg').textContent = profile.registerNumber;
        launchStudentDashboard();
      }
    } catch(err) {
      showToast(err.message);
    }
  });

  // Dashboard buttons
  document.getElementById('dash-btn-view-test').addEventListener('click', () => {
    synth.playClick();
    launchStudentInstructions();
  });

  document.getElementById('dash-btn-download-pdf').addEventListener('click', () => {
    synth.playClick();
    exportResultPDF(state.studentSubmission);
  });

  document.getElementById('btn-instruction-back').addEventListener('click', () => {
    synth.playClick();
    launchStudentDashboard();
  });

  // Instructions screen checkbox & Start Test triggers
  const consentCheckbox = document.getElementById('consent-checkbox');
  const startExamBtn = document.getElementById('btn-start-exam');
  
  consentCheckbox.addEventListener('change', () => {
    startExamBtn.disabled = !consentCheckbox.checked;
  });

  startExamBtn.addEventListener('click', () => {
    synth.playClick();
    startStudentExam();
  });

  // Student exam navigation: Prev / Next / Mark for Review
  document.getElementById('exam-prev-btn').addEventListener('click', () => {
    synth.playClick();
    saveActiveQuestionState();
    if (state.currentQuestionIndex > 0) {
      loadQuestion(state.currentQuestionIndex - 1);
    }
  });

  document.getElementById('exam-next-btn').addEventListener('click', () => {
    synth.playClick();
    saveActiveQuestionState();
    if (state.currentQuestionIndex < state.examQuestions.length - 1) {
      loadQuestion(state.currentQuestionIndex + 1);
    }
  });

  document.getElementById('exam-review-btn').addEventListener('click', () => {
    synth.playClick();
    saveActiveQuestionState();
    toggleMarkForReview();
  });

  // Submit Test Button click
  document.getElementById('exam-submit-btn').addEventListener('click', () => {
    synth.playClick();
    saveActiveQuestionState();
    openSubmitConfirmModal();
  });

  // Submit Modal Hooks
  const confirmModal = document.getElementById('submit-confirm-modal');
  document.getElementById('close-submit-modal').addEventListener('click', () => {
    synth.playClick();
    confirmModal.classList.remove('active');
  });

  document.getElementById('btn-cancel-submit').addEventListener('click', () => {
    synth.playClick();
    confirmModal.classList.remove('active');
  });

  document.getElementById('btn-confirm-submit').addEventListener('click', () => {
    synth.playClick();
    confirmModal.classList.remove('active');
    completeStudentExamSubmit(false);
  });

  // Security warning return button click
  document.getElementById('btn-return-fullscreen').addEventListener('click', () => {
    synth.playClick();
    state.isSecurityWarningActive = false;
    document.getElementById('security-warning-modal').classList.remove('active');
    requestFullscreenLock();
  });

  // Result Exit Test click
  document.getElementById('btn-exit-test').addEventListener('click', () => {
    synth.playClick();
    logoutUser();
  });

  // Result PDF Download click
  document.getElementById('btn-download-pdf').addEventListener('click', () => {
    synth.playClick();
    exportResultPDF(null);
  });

  // Admin Submissions list Search Filter
  const adminSearch = document.getElementById('admin-search-input');
  if (adminSearch) {
    adminSearch.addEventListener('input', () => {
      filterAdminSubmissions(adminSearch.value.trim());
    });
  }

  // Admin clear submissions db action
  const resetBtn = document.getElementById('admin-reset-db-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      synth.playClick();
      openAdminResetConfirmModal();
    });
  }

  // Admin Signout hooks
  document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', () => {
      synth.playClick();
      logoutUser();
    });
  });
}

// ==========================================
// 7. STUDENT PORTAL ENGINE
// ==========================================
function launchStudentInstructions() {
  switchScreen('instruction-screen');
  document.getElementById('consent-checkbox').checked = false;
  document.getElementById('btn-start-exam').disabled = true;
}

async function launchStudentDashboard() {
  switchScreen('dashboard-screen');
  
  if (!state.userProfile) return;
  
  const startBtn = document.getElementById('dash-btn-view-test');
  const completedMsg = document.getElementById('dash-test-completed-msg');
  const noHistory = document.getElementById('dash-no-history');
  const historyDetails = document.getElementById('dash-history-details');
  const historyActions = document.getElementById('dash-history-actions');
  
  try {
    const submission = await getStudentSubmission(state.userProfile.registerNumber);
    state.studentSubmission = submission;
    
    if (submission) {
      startBtn.style.display = 'none';
      completedMsg.style.display = 'block';
      
      noHistory.style.display = 'none';
      historyDetails.style.display = 'flex';
      historyActions.style.display = 'block';
      
      const totalMaxMarks = state.examQuestions.reduce((sum, q) => sum + q.marks, 0);
      document.getElementById('dash-hist-marks').textContent = `${submission.marksObtained} / ${totalMaxMarks}`;
      document.getElementById('dash-hist-percent').textContent = `${submission.percentage}%`;
      document.getElementById('dash-hist-duration').textContent = submission.timeTaken;
      document.getElementById('dash-hist-status').textContent = submission.passStatus;
      document.getElementById('dash-hist-status').className = submission.passStatus === 'PASSED' ? 'score-badge pass' : 'score-badge fail';
      
      let dateStr = "N/A";
      if (submission.submittedAt) {
        const d = new Date(submission.submittedAt);
        dateStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " - " + d.toLocaleDateString();
      }
      document.getElementById('dash-hist-date').textContent = dateStr;
    } else {
      startBtn.style.display = 'block';
      completedMsg.style.display = 'none';
      
      noHistory.style.display = 'block';
      historyDetails.style.display = 'none';
      historyActions.style.display = 'none';
    }
  } catch(e) {
    console.error("Dashboard launch error: ", e);
  }
}

function shuffleMCQOptions(questions) {
  return questions.map(q => {
    if (q.type === 'mcq') {
      const originalOptions = [...q.options];
      const correctAnswerText = originalOptions[q.answer];
      
      // Fisher-Yates shuffle
      const shuffledOptions = [...originalOptions];
      for (let i = shuffledOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
      }
      
      const newAnswerIndex = shuffledOptions.indexOf(correctAnswerText);
      
      return {
        ...q,
        options: shuffledOptions,
        answer: newAnswerIndex
      };
    }
    return q;
  });
}

function startStudentExam() {
  state.examQuestions = shuffleMCQOptions(EXAM_QUESTIONS);
  
  state.examSecondsLeft = 45 * 60; // 45 Minutes (2700s)
  state.currentQuestionIndex = 0;
  state.selectedAnswers = Array(state.examQuestions.length).fill(null);
  state.markedForReview.clear();
  state.visitedQuestions = new Set([0]);
  state.examStartTime = new Date();
  state.warningsCount = 0;
  state.isSecurityWarningActive = false;
  
  // Set up security monitors (fullscreen, block copy/paste, tab switch)
  enableSecurityMeters();
  requestFullscreenLock();
  
  // Render Sidebar Question palette
  renderQuestionGridPalette();
  
  switchScreen('exam-screen');
  loadQuestion(0);
  
  // Start sticky timer loop
  startExamTimer();
}

function renderQuestionGridPalette() {
  const container = document.getElementById('sidebar-sections-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  EXAM_SECTIONS.forEach(section => {
    const secGroup = document.createElement('div');
    secGroup.className = 'sidebar-section-group';
    
    secGroup.innerHTML = `
      <div class="sidebar-section-header">Section ${section.id} - ${section.name}</div>
      <div class="question-number-grid"></div>
    `;
    
    const grid = secGroup.querySelector('.question-number-grid');
    for (let idx = section.startIdx; idx <= section.endIdx; idx++) {
      const btn = document.createElement('button');
      btn.className = 'grid-num-btn';
      btn.textContent = idx + 1;
      btn.id = `palette-btn-${idx}`;
      
      btn.addEventListener('click', () => {
        synth.playClick();
        saveActiveQuestionState();
        loadQuestion(idx);
      });
      grid.appendChild(btn);
    }
    
    container.appendChild(secGroup);
  });
}

function loadQuestion(index) {
  state.currentQuestionIndex = index;
  state.visitedQuestions.add(index);
  
  const question = state.examQuestions[index];
  
  // Render current Section Badge
  const sectionObj = EXAM_SECTIONS.find(sec => index >= sec.startIdx && index <= sec.endIdx);
  document.getElementById('exam-section-badge').textContent = `SECTION ${sectionObj.id} – ${sectionObj.name} (${question.marks} Mark${question.marks > 1 ? 's' : ''})`;
  
  document.getElementById('exam-q-idx').textContent = index + 1;
  
  // Render Question Details based on Type
  const qContainer = document.getElementById('exam-question-details');
  qContainer.innerHTML = '';
  
  // Render question image if exists
  let imageHtml = "";
  if (question.image) {
    imageHtml = `
      <div class="question-image-container" style="text-align: center; margin-bottom: 20px;">
        <img src="${question.image}" alt="Browser Output" style="max-width: 100%; max-height: 230px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
      </div>
    `;
  }
  
  if (question.type === 'mcq') {
    qContainer.innerHTML = `
      ${imageHtml}
      <div class="exam-q-text">${question.question}</div>
      <div class="exam-options-grid" id="exam-options-list"></div>
    `;
    
    const list = qContainer.querySelector('#exam-options-list');
    question.options.forEach((optText, optIdx) => {
      const btn = document.createElement('button');
      btn.className = 'exam-opt-btn';
      if (state.selectedAnswers[index] === optIdx) {
        btn.classList.add('selected');
      }
      
      const prefix = String.fromCharCode(65 + optIdx);
      
      const prefixSpan = document.createElement('span');
      prefixSpan.className = 'exam-opt-prefix';
      prefixSpan.textContent = prefix;
      
      const textSpan = document.createElement('span');
      textSpan.className = 'exam-opt-text';
      textSpan.textContent = optText;
      
      btn.appendChild(prefixSpan);
      btn.appendChild(textSpan);
      
      btn.addEventListener('click', () => {
        selectMCQOption(optIdx);
      });
      list.appendChild(btn);
    });
    
  } else if (question.type === 'dragdrop') {
    qContainer.innerHTML = `
      ${imageHtml}
      <div class="exam-q-text">${question.question}</div>
      <div class="drag-instruction-text">Drag and drop blocks to arrange the lines of code in the correct logical sequence:</div>
      <div class="drag-list-container" id="python-drag-list"></div>
    `;
    
    const list = qContainer.querySelector('#python-drag-list');
    
    let order = state.selectedAnswers[index];
    if (!order) {
      order = [...question.shuffledOrder];
    }
    
    renderDragDropItems(list, order);
    
  } else if (question.type === 'fillblanks') {
    let codeHtml = question.codeTemplate;
    question.blanks.forEach(blank => {
      const selectHtml = `<select class="fill-blank-select" data-blank-id="${blank.id}" style="background: rgba(26, 26, 50, 0.95); border: 1px solid var(--primary-cyan); color: #fff; padding: 4px 10px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.9rem; margin: 0 4px; cursor: pointer; outline: none; transition: border-color 0.2s;"><option value="">-- select --</option>${blank.options.map((opt, oIdx) => `<option value="${oIdx}">${opt}</option>`).join('')}</select>`;
      codeHtml = codeHtml.replace(`[${blank.id}]`, selectHtml);
    });
    
    qContainer.innerHTML = `
      <div class="exam-q-text">${question.question}</div>
      <pre class="fillblanks-code-block" style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; font-family: var(--font-mono); font-size: 1rem; line-height: 1.8; color: #fff; margin-bottom: 20px; white-space: pre-wrap; word-break: break-all;">${codeHtml}</pre>
    `;
    
    const savedAns = state.selectedAnswers[index] || {};
    qContainer.querySelectorAll('.fill-blank-select').forEach(select => {
      const blankId = select.dataset.blankId;
      if (savedAns[blankId] !== undefined && savedAns[blankId] !== null) {
        select.value = savedAns[blankId];
      }
      
      select.addEventListener('change', () => {
        synth.playClick();
        if (!state.selectedAnswers[index]) {
          state.selectedAnswers[index] = {};
        }
        state.selectedAnswers[index][blankId] = select.value === "" ? null : parseInt(select.value, 10);
        updateGridPaletteStatus();
        updateProgressBar();
      });
    });
    
  } else if (question.type === 'html_code_input') {
    qContainer.innerHTML = `
      ${imageHtml}
      <div class="exam-q-text">${question.question}</div>
      <div style="margin-top: 15px;">
        <label for="html-editor-textarea" style="display:block; font-size:0.9rem; color:var(--text-muted); margin-bottom:8px; font-family:var(--font-title);">WRITE HTML CODE BELOW:</label>
        <textarea id="html-editor-textarea" class="form-input" style="width:100%; height:200px; font-family:var(--font-mono); font-size:0.95rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); color:#fff; padding:15px; border-radius:10px; resize:vertical; outline:none; transition:border-color 0.2s;" placeholder="Type your HTML code here..."></textarea>
      </div>
    `;
    
    const textarea = qContainer.querySelector('#html-editor-textarea');
    if (state.selectedAnswers[index] !== null) {
      textarea.value = state.selectedAnswers[index];
    }
    
    textarea.addEventListener('input', () => {
      state.selectedAnswers[index] = textarea.value.trim() === "" ? null : textarea.value;
      updateGridPaletteStatus();
      updateProgressBar();
    });
    
  } else if (question.type === 'htmldragdrop') {
    qContainer.innerHTML = `
      <div class="exam-q-text">${question.question}</div>
      
      <div class="drag-instruction-text">1. Arrange the HTML elements in correct sequence:</div>
      <div class="drag-list-container" id="html-drag-list"></div>
      
      <div class="drag-instruction-text" style="margin-top:20px;">2. Select the correct visual rendering card output of the HTML code:</div>
      <div class="html-output-options-grid" id="html-outputs-list"></div>
    `;
    
    const list = qContainer.querySelector('#html-drag-list');
    const outputsList = qContainer.querySelector('#html-outputs-list');
    
    let stateVal = state.selectedAnswers[index];
    if (!stateVal) {
      stateVal = {
        order: [...question.shuffledOrder],
        selectedOutput: null
      };
    }
    
    renderDragDropItems(list, stateVal.order);
    
    question.options.forEach((optText, optIdx) => {
      const card = document.createElement('div');
      card.className = 'html-output-card';
      if (stateVal.selectedOutput === optIdx) {
        card.classList.add('selected');
      }
      
      const prefix = String.fromCharCode(65 + optIdx);
      
      let previewHtml = "";
      if (optIdx === 0) {
        previewHtml = `<div style="font-family:var(--font-mono); font-size:0.75rem;">&lt;title&gt;My Page&lt;/title&gt;<br>Hello World</div>`;
      } else if (optIdx === 1) {
        previewHtml = `<h2 style="margin:0; font-size:1.1rem; font-weight:800;">Hello World</h2><p style="margin:5px 0 0; font-size:0.8rem;">Welcome to my website.</p>`;
      } else if (optIdx === 2) {
        previewHtml = `<div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted);">&lt;!DOCTYPE html&gt;&lt;html&gt;&lt;head&gt;...</div>`;
      } else {
        previewHtml = `<div style="font-style:italic; font-size:0.8rem; color:#888;">[Blank white webpage]</div>`;
      }
      
      card.innerHTML = `
        <div class="html-output-card-header">Option ${prefix}</div>
        <div class="html-output-preview-box">${previewHtml}</div>
        <p style="font-size:0.8rem; line-height:1.4; margin:0;">${optText}</p>
      `;
      
      card.addEventListener('click', () => {
        selectHTMLOutputOption(optIdx);
      });
      
      outputsList.appendChild(card);
    });
  }
  
  // Set Prev / Next button states
  document.getElementById('exam-prev-btn').disabled = (index === 0);
  document.getElementById('exam-next-btn').disabled = (index === state.examQuestions.length - 1);
  
  // Mark review button highlight
  const reviewBtn = document.getElementById('exam-review-btn');
  if (state.markedForReview.has(index)) {
    reviewBtn.classList.add('btn-magenta');
    reviewBtn.classList.remove('btn-glass');
    reviewBtn.textContent = '★ Marked';
  } else {
    reviewBtn.classList.add('btn-glass');
    reviewBtn.classList.remove('btn-magenta');
    reviewBtn.textContent = '☆ Mark for Review';
  }
  
  // Update palette states
  updateGridPaletteStatus();
}

function selectMCQOption(optIndex) {
  state.selectedAnswers[state.currentQuestionIndex] = optIndex;
  synth.playClick();
  
  // Re-highlight
  const optionButtons = document.querySelectorAll('.exam-opt-btn');
  optionButtons.forEach((btn, idx) => {
    if (idx === optIndex) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
  
  updateGridPaletteStatus();
  updateProgressBar();
}

function selectHTMLOutputOption(optIdx) {
  synth.playClick();
  
  if (!state.selectedAnswers[state.currentQuestionIndex]) {
    state.selectedAnswers[state.currentQuestionIndex] = {
      order: [...state.examQuestions[state.currentQuestionIndex].shuffledOrder],
      selectedOutput: optIdx
    };
  } else {
    state.selectedAnswers[state.currentQuestionIndex].selectedOutput = optIdx;
  }
  
  // Re-highlight cards
  const cards = document.querySelectorAll('.html-output-card');
  cards.forEach((card, idx) => {
    if (idx === optIdx) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
  
  updateGridPaletteStatus();
  updateProgressBar();
}

// Drag & Drop reorder layout renderer
function renderDragDropItems(container, itemsArray) {
  container.innerHTML = '';
  
  itemsArray.forEach((text, index) => {
    const el = document.createElement('div');
    el.className = 'drag-block-item';
    el.draggable = true;
    el.dataset.idx = index;
    
    el.innerHTML = `
      <span class="drag-block-handle">☰</span>
      <span class="drag-block-number">${index + 1}</span>
    `;
    
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    el.appendChild(textSpan);
    
    // HTML5 drag start / dragover / drop bindings
    el.addEventListener('dragstart', (e) => {
      el.classList.add('dragging');
      e.dataTransfer.setData('text/plain', index);
    });
    
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      saveActiveQuestionState();
    });
    
    // Touch support for Mobile
    el.addEventListener('touchstart', (e) => {
      el.classList.add('dragging');
    });
    el.addEventListener('touchend', () => {
      el.classList.remove('dragging');
      saveActiveQuestionState();
    });
    
    container.appendChild(el);
  });
  
  // Container dragover inserts
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragged = container.querySelector('.drag-block-item.dragging');
    if (!dragged) return;
    
    const afterElement = getDragAfterElement(container, e.clientY);
    if (afterElement == null) {
      container.appendChild(dragged);
    } else {
      container.insertBefore(dragged, afterElement);
    }
    
    // Reindex line numbers live
    reindexDragBlockLines(container);
  });
  
  // Mobile Touchmove support
  container.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const dragged = container.querySelector('.drag-block-item.dragging');
    if (!dragged) return;
    
    const touch = e.touches[0];
    const afterElement = getDragAfterElement(container, touch.clientY);
    if (afterElement == null) {
      container.appendChild(dragged);
    } else {
      container.insertBefore(dragged, afterElement);
    }
    reindexDragBlockLines(container);
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.drag-block-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function reindexDragBlockLines(container) {
  const blocks = container.querySelectorAll('.drag-block-item');
  blocks.forEach((block, index) => {
    block.querySelector('.drag-block-number').textContent = index + 1;
  });
}

// Saves currently open drag and drop items arrangement into selectedAnswers
function saveActiveQuestionState() {
  const currentIdx = state.currentQuestionIndex;
  const question = state.examQuestions[currentIdx];
  
  if (question.type === 'dragdrop') {
    const container = document.getElementById('python-drag-list');
    if (!container) return;
    
    const listItems = [...container.querySelectorAll('.drag-block-item')];
    // Gather text code lines
    const orderedLines = listItems.map(item => {
      return item.querySelector('span:last-child').textContent;
    });
    
    state.selectedAnswers[currentIdx] = orderedLines;
    
  } else if (question.type === 'htmldragdrop') {
    const container = document.getElementById('html-drag-list');
    if (!container) return;
    
    const listItems = [...container.querySelectorAll('.drag-block-item')];
    const orderedLines = listItems.map(item => {
      return item.querySelector('span:last-child').textContent;
    });
    
    if (!state.selectedAnswers[currentIdx]) {
      state.selectedAnswers[currentIdx] = { order: orderedLines, selectedOutput: null };
    } else {
      state.selectedAnswers[currentIdx].order = orderedLines;
    }
  }
  
  updateGridPaletteStatus();
  updateProgressBar();
}

function toggleMarkForReview() {
  const currentIdx = state.currentQuestionIndex;
  if (state.markedForReview.has(currentIdx)) {
    state.markedForReview.delete(currentIdx);
    showToast("Unmarked from review");
  } else {
    state.markedForReview.add(currentIdx);
    showToast("Marked for review");
  }
  loadQuestion(currentIdx);
}

function updateGridPaletteStatus() {
  state.examQuestions.forEach((q, idx) => {
    const btn = document.getElementById(`palette-btn-${idx}`);
    if (!btn) return;
    
    btn.className = 'grid-num-btn';
    
    if (state.currentQuestionIndex === idx) {
      btn.classList.add('current');
    }
    
    // Check answer completeness
    let isAnswered = false;
    const answer = state.selectedAnswers[idx];
    
    if (q.type === 'mcq' && answer !== null) {
      isAnswered = true;
    } else if (q.type === 'dragdrop' && answer !== null) {
      isAnswered = true;
    } else if (q.type === 'html_code_input' && answer !== null) {
      isAnswered = true;
    } else if (q.type === 'fillblanks' && answer !== null) {
      const keys = Object.keys(answer);
      if (keys.length > 0 && keys.some(k => answer[k] !== null && answer[k] !== undefined)) {
        isAnswered = true;
      }
    } else if (q.type === 'htmldragdrop' && answer !== null) {
      if (answer.order && answer.selectedOutput !== null) {
        isAnswered = true;
      }
    }
    
    if (isAnswered) {
      btn.classList.add('answered');
    } else if (state.markedForReview.has(idx)) {
      btn.classList.add('marked');
    } else if (state.visitedQuestions.has(idx)) {
      btn.classList.add('visited');
    }
  });
}

function updateProgressBar() {
  let answeredCount = 0;
  state.examQuestions.forEach((q, idx) => {
    const ans = state.selectedAnswers[idx];
    if (q.type === 'mcq' && ans !== null) answeredCount++;
    else if (q.type === 'dragdrop' && ans !== null) answeredCount++;
    else if (q.type === 'html_code_input' && ans !== null) answeredCount++;
    else if (q.type === 'fillblanks' && ans !== null) {
      const keys = Object.keys(ans);
      if (keys.length > 0 && keys.some(k => ans[k] !== null && ans[k] !== undefined)) {
        answeredCount++;
      }
    }
    else if (q.type === 'htmldragdrop' && ans !== null && ans.selectedOutput !== null) answeredCount++;
  });
  
  const total = state.examQuestions.length;
  const pct = Math.round((answeredCount / total) * 100);
  
  document.getElementById('exam-header-progress').style.width = `${pct}%`;
  document.getElementById('exam-progress-num').textContent = answeredCount;
  document.getElementById('exam-progress-total').textContent = total;
}

// 45m Clock Count down loop
function startExamTimer() {
  if (state.examTimer) clearInterval(state.examTimer);
  updateStickyTimerUI();
  
  state.examTimer = setInterval(() => {
    state.examSecondsLeft--;
    updateStickyTimerUI();
    
    if (state.examSecondsLeft === 300) {
      synth.playWarning();
      showToast("5 Minutes remaining! Exits soon.");
    }
    
    if (state.examSecondsLeft <= 0) {
      clearInterval(state.examTimer);
      state.examTimer = null;
      showToast("Time is expired!");
      completeStudentExamSubmit(true); // auto-submit
    }
  }, 1000);
}

function updateStickyTimerUI() {
  const numberText = document.getElementById('exam-timer-num');
  if (!numberText) return;
  
  const min = Math.floor(state.examSecondsLeft / 60);
  const sec = state.examSecondsLeft % 60;
  
  numberText.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  
  const widget = numberText.closest('.exam-timer');
  if (state.examSecondsLeft <= 300) {
    widget.classList.add('warning');
  } else {
    widget.classList.remove('warning');
  }
}

function openSubmitConfirmModal() {
  let answeredCount = 0;
  state.examQuestions.forEach((q, idx) => {
    const ans = state.selectedAnswers[idx];
    if (q.type === 'mcq' && ans !== null) answeredCount++;
    else if (q.type === 'dragdrop' && ans !== null) answeredCount++;
    else if (q.type === 'html_code_input' && ans !== null) answeredCount++;
    else if (q.type === 'fillblanks' && ans !== null) {
      const keys = Object.keys(ans);
      if (keys.length > 0 && keys.some(k => ans[k] !== null && ans[k] !== undefined)) {
        answeredCount++;
      }
    }
    else if (q.type === 'htmldragdrop' && ans !== null && ans.selectedOutput !== null) answeredCount++;
  });
  
  const unansweredCount = state.examQuestions.length - answeredCount;
  
  document.getElementById('modal-answered-count').textContent = answeredCount;
  document.getElementById('modal-total-count').textContent = state.examQuestions.length;
  document.getElementById('modal-unanswered-count').textContent = unansweredCount;
  
  const warningText = document.getElementById('modal-unanswered-warning');
  if (unansweredCount > 0) {
    warningText.style.display = 'block';
  } else {
    warningText.style.display = 'none';
  }
  
  document.getElementById('submit-confirm-modal').classList.add('active');
}

// Scorecard Evaluation and Sync
async function completeStudentExamSubmit(isAutoSubmit = false) {
  if (state.examTimer) {
    clearInterval(state.examTimer);
    state.examTimer = null;
  }
  
  disableSecurityMeters();
  
  showToast("Compiling evaluation scores...");
  
  let correctCount = 0;
  let wrongCount = 0;
  let marksObtained = 0;
  let attemptedCount = 0;
  
  const totalMaxMarks = state.examQuestions.reduce((sum, q) => sum + q.marks, 0);
  
  state.examQuestions.forEach((q, idx) => {
    const ans = state.selectedAnswers[idx];
    
    if (q.type === 'mcq') {
      if (ans !== null) {
        attemptedCount++;
        if (ans === q.answer) {
          correctCount++;
          marksObtained += q.marks;
        } else {
          wrongCount++;
        }
      }
    } else if (q.type === 'dragdrop') {
      attemptedCount++;
      if (ans !== null) {
        const matches = q.correctOrder.every((line, lineIdx) => {
          return ans[lineIdx] && ans[lineIdx].trim() === line.trim();
        });
        if (matches) {
          correctCount++;
          marksObtained += q.marks;
        } else {
          wrongCount++;
        }
      } else {
        wrongCount++;
      }
    } else if (q.type === 'fillblanks') {
      if (ans !== null) {
        attemptedCount++;
        let allCorrect = true;
        let anyAnswered = false;
        
        q.blanks.forEach(blank => {
          const uAns = ans[blank.id];
          if (uAns !== undefined && uAns !== null) {
            anyAnswered = true;
            if (uAns !== blank.answer) {
              allCorrect = false;
            }
          } else {
            allCorrect = false;
          }
        });
        
        if (anyAnswered) {
          if (allCorrect) {
            correctCount++;
            marksObtained += q.marks;
          } else {
            wrongCount++;
          }
        } else {
          attemptedCount--;
          wrongCount++;
        }
      } else {
        wrongCount++;
      }
    } else if (q.type === 'html_code_input') {
      if (ans !== null) {
        attemptedCount++;
        const userCode = ans.trim().toLowerCase().replace(/\s+/g, '');
        const correctMatches = [
          /<h1>studentdetails<\/h1>|<h[2-6]>studentdetails<\/h[2-6]>/,
          /<p>name:john<\/p>|<div>name:john<\/div>|name:john/,
          /<ul>/,
          /<li>python<\/li>/,
          /<li>html<\/li>/,
          /<li>java<\/li>/,
          /<\/ul>/
        ];
        const isCorrect = correctMatches.every(rx => rx.test(userCode));
        
        if (isCorrect) {
          correctCount++;
          marksObtained += q.marks;
        } else {
          wrongCount++;
        }
      } else {
        wrongCount++;
      }
    } else if (q.type === 'htmldragdrop') {
      if (ans && ans.selectedOutput !== null) {
        attemptedCount++;
        const orderMatches = q.correctOrder.every((line, lineIdx) => {
          return ans.order[lineIdx] && ans.order[lineIdx].trim() === line.trim();
        });
        const outputMatches = (ans.selectedOutput === q.answer);
        
        if (orderMatches && outputMatches) {
          correctCount++;
          marksObtained += q.marks;
        } else {
          wrongCount++;
        }
      } else {
        wrongCount++;
      }
    }
  });
  
  const percentage = Math.round((marksObtained / totalMaxMarks) * 100);
  const totalTimeTakenSec = (45 * 60) - state.examSecondsLeft;
  const durationMin = Math.floor(totalTimeTakenSec / 60);
  const durationSec = totalTimeTakenSec % 60;
  const timeTakenFormatted = `${durationMin}m ${durationSec}s`;
  
  const passThreshold = totalMaxMarks * 0.6;
  const passStatus = marksObtained >= passThreshold ? "PASSED" : "FAILED";
  
  const summary = {
    attemptedCount,
    correctCount,
    wrongCount,
    marksObtained,
    percentage,
    timeTaken: timeTakenFormatted,
    passStatus,
    warningsTriggered: state.warningsCount
  };
  
  try {
    await submitStudentExam(state.userProfile, state.selectedAnswers, summary);
    synth.playSuccess();
    
    switchScreen('completed-screen');
    
    document.getElementById('completed-student-name').textContent = state.userProfile.name;
    document.getElementById('completed-student-reg').textContent = state.userProfile.registerNumber;
    document.getElementById('completed-student-email').textContent = state.userProfile.email;
    document.getElementById('completed-attempted').textContent = `${attemptedCount} / ${state.examQuestions.length}`;
    document.getElementById('completed-correct').textContent = correctCount;
    document.getElementById('completed-wrong').textContent = wrongCount;
    document.getElementById('completed-marks').textContent = `${marksObtained} / ${totalMaxMarks}`;
    document.getElementById('completed-percentage').textContent = `${percentage}%`;
    document.getElementById('completed-duration').textContent = timeTakenFormatted;
    
    const passBadge = document.getElementById('completed-status-badge');
    passBadge.textContent = passStatus;
    passBadge.className = `score-badge ${marksObtained >= passThreshold ? 'pass' : 'fail'}`;
    
    if (isAutoSubmit && state.warningsCount >= 3) {
      document.getElementById('exam-auto-sub-notice').style.display = 'block';
    } else {
      document.getElementById('exam-auto-sub-notice').style.display = 'none';
    }
    
  } catch(err) {
    showToast(`Submission sync failed: ${err.message}`);
  }
}

// jsPDF scorecard generator
function exportResultPDF(submission = null) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Clean, aesthetic layout styling
    // 1. Draw decorative double border outline
    doc.setDrawColor(142, 45, 226); // Purple primary
    doc.setLineWidth(1);
    doc.rect(5, 5, 200, 287);
    doc.rect(7, 7, 196, 283);
    
    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(7, 7, 16);
    doc.text("QUIX ASSESSMENT PORTAL", 105, 25, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(113, 128, 150);
    doc.text("OFFICIAL ACADEMIC EVALUATION SCORECARD", 105, 32, { align: "center" });
    
    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 38, 190, 38);
    
    // Student Info Panel
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(142, 45, 226);
    doc.text("STUDENT DETAILS", 25, 48);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(45, 55, 72);
    doc.text(`Full Name:  ${submission ? submission.name : state.userProfile.name}`, 25, 56);
    doc.text(`Register Number:  ${submission ? submission.registerNumber : state.userProfile.registerNumber}`, 25, 63);
    doc.text(`Email Address:  ${submission ? submission.email : state.userProfile.email}`, 25, 70);
    
    // Assessment Info Panel
    const totalMaxMarks = state.examQuestions.reduce((sum, q) => sum + q.marks, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(142, 45, 226);
    doc.text("ASSESSMENT SCHEME", 25, 85);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(45, 55, 72);
    doc.text("Exam Name: Aptitude & Programming Assessment", 25, 93);
    doc.text(`Total Questions: ${state.examQuestions.length} (MCQs, Python & HTML)`, 25, 100);
    doc.text(`Maximum Possible Marks: ${totalMaxMarks} Marks`, 25, 107);
    
    doc.line(20, 115, 190, 115);
    
    // Results Summary metrics table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 205, 172); // Greenish Accent
    doc.text("PERFORMANCE SUMMARY", 25, 125);
    
    let correct = submission ? submission.correctCount : document.getElementById('completed-correct').textContent;
    let wrong = submission ? submission.wrongCount : document.getElementById('completed-wrong').textContent;
    let marks = submission ? `${submission.marksObtained} / ${totalMaxMarks}` : document.getElementById('completed-marks').textContent;
    let percentage = submission ? `${submission.percentage}%` : document.getElementById('completed-percentage').textContent;
    let duration = submission ? submission.timeTaken : document.getElementById('completed-duration').textContent;
    let status = submission ? submission.passStatus : document.getElementById('completed-status-badge').textContent;
    let warnings = submission ? submission.warningsTriggered : state.warningsCount;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Attempted Questions:  ${submission ? `${submission.attemptedCount} / ${state.examQuestions.length}` : document.getElementById('completed-attempted').textContent}`, 25, 134);
    doc.text(`Correct Responses:  ${correct}`, 25, 141);
    doc.text(`Incorrect Responses:  ${wrong}`, 25, 148);
    doc.text(`Marks Obtained:  ${marks}`, 25, 155);
    doc.text(`Percentage Score:  ${percentage}`, 25, 162);
    doc.text(`Time Taken:  ${duration}`, 25, 169);
    
    // Performance Status Box
    doc.setFillColor(247, 250, 252);
    doc.rect(25, 180, 160, 25, "F");
    doc.rect(25, 180, 160, 25, "S");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(7, 7, 16);
    doc.text("EVALUATION RESULT STATUS:", 35, 195);
    
    if (status === "PASSED") {
      doc.setTextColor(0, 230, 118); // Pass green
    } else {
      doc.setTextColor(255, 23, 68); // Fail red
    }
    doc.setFontSize(14);
    doc.text(status, 115, 195);
    
    // Security logs section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(113, 128, 150);
    doc.text(`Security Warnings Triggered:  ${warnings} (Max 2)`, 25, 220);
    
    // Timestamps
    const timeStr = submission && submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : new Date().toLocaleString();
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(160, 174, 192);
    doc.text(`Date of Issue: ${timeStr}`, 25, 250);
    doc.text("Verify this document on Quix Administration Portal securely.", 25, 255);
    
    // Signature
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(7, 7, 16);
    doc.text("EXAMINATION CONTROLLER", 140, 250);
    doc.line(135, 246, 185, 246);
    
    const regNo = submission ? submission.registerNumber : state.userProfile.registerNumber;
    doc.save(`scorecard_${regNo}.pdf`);
    showToast("PDF downloaded successfully!");
  } catch(e) {
    showToast(`PDF generation error: ${e.message}`);
    console.error(e);
  }
}

// ==========================================
// 8. ADMIN PORTAL ENGINE
// ==========================================
function launchAdminPortal() {
  switchScreen('admin-dashboard');
  
  const searchInput = document.getElementById('admin-search-input');
  if (searchInput) searchInput.value = '';
  
  // Start real-time submissions sync
  state.adminUnsub = listenToExamSubmissions((submissions) => {
    state.submissionsList = submissions;
    renderAdminSubmissionsTable(submissions);
    calculateAdminSummaryStats(submissions);
  });
}

function renderAdminSubmissionsTable(list) {
  const tbody = document.getElementById('admin-table-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  const totalMaxMarks = state.examQuestions.reduce((sum, q) => sum + q.marks, 0);
  const passThreshold = totalMaxMarks * 0.6;
  
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); font-style:italic; padding: 25px;">Waiting for student completions...</td></tr>`;
    return;
  }
  
  list.forEach(sub => {
    const row = document.createElement('tr');
    
    const isPass = sub.marksObtained >= passThreshold;
    const badgeClass = isPass ? 'pass' : 'fail';
    
    let dateStr = "N/A";
    if (sub.submittedAt) {
      const d = new Date(sub.submittedAt);
      dateStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " - " + d.toLocaleDateString();
    }
    
    const rowStyle = sub.warningsTriggered >= 3 ? 'background: rgba(255, 23, 68, 0.04);' : '';
    
    row.innerHTML = `
      <td style="font-weight:600; color:var(--text-primary); ${rowStyle}">${sub.name}</td>
      <td style="font-family:monospace; color:var(--text-secondary);">${sub.registerNumber}</td>
      <td style="font-family:var(--font-title); font-weight:700;">${sub.marksObtained} / ${totalMaxMarks}</td>
      <td><span class="score-badge ${badgeClass}">${sub.percentage}% (${sub.passStatus})</span></td>
      <td style="color:var(--text-secondary);">${sub.timeTaken}</td>
      <td style="color:var(--text-muted); font-size:0.8rem; display:flex; justify-content:space-between; align-items:center;">
        <span>${dateStr}</span>
        ${sub.warningsTriggered > 0 ? `<span style="color:var(--incorrect-red); font-weight:700;" title="${sub.warningsTriggered} warning(s) triggered">! Warnings: ${sub.warningsTriggered}</span>` : ''}
      </td>
    `;
    tbody.appendChild(row);
  });
}

function calculateAdminSummaryStats(list) {
  const total = list.length;
  
  let avgMarks = 0;
  let highestMarks = 0;
  let passCount = 0;
  
  const totalMaxMarks = state.examQuestions.reduce((sum, q) => sum + q.marks, 0);
  const passThreshold = totalMaxMarks * 0.6;
  
  if (total > 0) {
    let sumMarks = 0;
    list.forEach(sub => {
      sumMarks += sub.marksObtained;
      if (sub.marksObtained > highestMarks) highestMarks = sub.marksObtained;
      if (sub.marksObtained >= passThreshold) passCount++;
    });
    
    avgMarks = (sumMarks / total).toFixed(1);
  }
  
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
  
  document.getElementById('stat-total-submissions').textContent = total;
  document.getElementById('stat-avg-score').textContent = `${avgMarks} / ${totalMaxMarks}`;
  document.getElementById('stat-highest-score').textContent = `${highestMarks} / ${totalMaxMarks}`;
  document.getElementById('stat-pass-rate').textContent = `${passRate}%`;
}

function filterAdminSubmissions(query) {
  const cleanQuery = query.toLowerCase();
  const filtered = state.submissionsList.filter(sub => {
    return sub.name.toLowerCase().includes(cleanQuery) || 
           sub.registerNumber.toLowerCase().includes(cleanQuery) ||
           sub.email.toLowerCase().includes(cleanQuery);
  });
  renderAdminSubmissionsTable(filtered);
}

function openAdminResetConfirmModal() {
  const container = document.createElement('div');
  container.className = 'modal-overlay active';
  container.id = 'reset-confirm-modal';
  
  container.innerHTML = `
    <div class="modal-content glass-card" style="text-align:center;">
      <h3 style="font-family:var(--font-title); color:var(--incorrect-red); margin-bottom:15px;">Clear Submissions?</h3>
      <p style="color:var(--text-secondary); margin-bottom:25px;">Are you sure you want to permanently delete all student assessment submissions from the database? This cannot be undone.</p>
      
      <div style="display:flex; justify-content:center; gap:15px;">
        <button class="btn btn-magenta btn-small" id="confirm-reset-btn">Reset Database</button>
        <button class="btn btn-glass btn-small" id="cancel-reset-btn">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);
  
  document.getElementById('cancel-reset-btn').addEventListener('click', () => {
    synth.playClick();
    container.remove();
  });
  
  document.getElementById('confirm-reset-btn').addEventListener('click', async () => {
    synth.playClick();
    container.remove();
    try {
      showToast("Resetting database...");
      await clearAllSubmissions();
      showToast("Database successfully cleared.");
    } catch(err) {
      showToast(`Reset failed: ${err.message}`);
    }
  });
}

function logoutUser() {
  state.userProfile = null;
  updateHeaderWidget();
  
  if (state.adminUnsub) {
    state.adminUnsub();
    state.adminUnsub = null;
  }
  
  document.getElementById('student-name').value = '';
  document.getElementById('student-reg').value = '';
  document.getElementById('student-email').value = '';
  document.getElementById('student-pass').value = '';
  document.getElementById('admin-user').value = '';
  document.getElementById('admin-pass').value = '';
  
  switchScreen('login-screen');
}
