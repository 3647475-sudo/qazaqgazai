import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  LayoutDashboard, 
  Users, 
  CalendarRange, 
  FolderLock, 
  ShieldAlert, 
  User, 
  LogOut, 
  Sun, 
  Moon, 
  Menu, 
  X,
  Lock,
  Globe,
  RefreshCw,
  Sparkles,
  Cpu,
  Laptop,
  Activity,
  Clock,
  Send,
  Terminal as TerminalIcon,
  Mic,
  MicOff,
  BellRing,
  Paperclip
} from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, deleteDoc, updateDoc } from 'firebase/firestore';

// Component imports
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import EmployeesList from './components/EmployeesList';
import SchedulesView from './components/SchedulesView';
import DocumentsView from './components/DocumentsView';
import AdminPanel from './components/AdminPanel';
import MyProfile from './components/MyProfile';

// Jarvis imports
import ArcReactor from './components/ArcReactor';
import JarvisTerminal from './components/JarvisTerminal';
import PlannerAgent from './components/PlannerAgent';
import HabitOptimizer from './components/HabitOptimizer';
import ScheduleReminders from './components/ScheduleReminders';
import GoogleTasks from './components/GoogleTasks';
import RevitIntegration from './components/RevitIntegration';

import { UserProfile, UserRole, Reminder, Alarm, HabitLog, BridgeLog, ChatMessage } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // App mode: 'hr' or 'jarvis'
  const [activeAppMode, setActiveAppMode] = useState<'hr' | 'jarvis'>('hr');
  
  // Active Tab within selected mode
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Customization
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<'ru' | 'en'>('ru');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Jarvis states
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [bridgeLogs, setBridgeLogs] = useState<BridgeLog[]>([]);
  const [isBridgeConnected, setIsBridgeConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'init_1',
      role: 'assistant',
      content: 'JARVIS core systems nominal. Awaiting directive, sir.',
      timestamp: Date.now()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isConversing, setIsConversing] = useState(false);
  const [aiAnalysisOutput, setAiAnalysisOutput] = useState<any>(null);
  const [isAnalyzingHabits, setIsAnalyzingHabits] = useState(false);

  // Read theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('qg_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
    }
    const savedLang = localStorage.getItem('qg_lang') as 'ru' | 'en';
    if (savedLang) {
      setLanguage(savedLang);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('qg_theme', nextTheme);
  };

  const handleSetLanguage = (lang: 'ru' | 'en') => {
    setLanguage(lang);
    localStorage.setItem('qg_lang', lang);
  };

  // Auth & Profile Listener
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubReminders: (() => void) | null = null;
    let unsubAlarms: (() => void) | null = null;
    let unsubHabits: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        setCurrentUser(user);

        // Define a real-time listener for the user profile document
        const userRef = doc(db, 'users', user.uid);
        unsubProfile = onSnapshot(userRef, async (profileSnap) => {
          if (profileSnap.exists()) {
            const data = profileSnap.data() as UserProfile;
            setUserProfile(data);

            // Handle online status reporting
            await setDoc(userRef, { status: 'online' }, { merge: true });
          } else {
            // Document might not be created yet (in registration flow, the AuthPage handles it)
            // Just seed basic profile
            const isSuperAdmin = user.email?.toLowerCase() === '3647475@gmail.com' || user.email?.toLowerCase() === 'admin@astgas.kz';
            const initialRole: UserRole = isSuperAdmin ? 'admin' : 'employee';

            const defaultProfile: UserProfile = {
              uid: user.uid,
              fullName: user.displayName || 'Corporate Employee',
              email: user.email || '',
              role: initialRole,
              status: 'online',
              blocked: false,
              createdAt: Date.now(),
              lastLogin: Date.now()
            };
            await setDoc(userRef, defaultProfile);
            setUserProfile(defaultProfile);
          }
          setAuthLoading(false);
        }, (err) => {
          console.error("Error fetching user profile snapshot:", err);
          setAuthLoading(false);
        });

        // Listen for Reminders subcollection
        unsubReminders = onSnapshot(collection(db, `users/${user.uid}/reminders`), (snap) => {
          const list: Reminder[] = [];
          snap.forEach(d => {
            list.push(d.data() as Reminder);
          });
          setReminders(list.sort((a, b) => b.createdAt - a.createdAt));
        });

        // Listen for Alarms subcollection
        unsubAlarms = onSnapshot(collection(db, `users/${user.uid}/alarms`), (snap) => {
          const list: Alarm[] = [];
          snap.forEach(d => {
            list.push(d.data() as Alarm);
          });
          setAlarms(list);
        });

        // Listen for Habits subcollection
        unsubHabits = onSnapshot(collection(db, `users/${user.uid}/habitLogs`), (snap) => {
          const list: HabitLog[] = [];
          snap.forEach(d => {
            list.push(d.data() as HabitLog);
          });
          setHabitLogs(list.sort((a, b) => b.timestamp - a.timestamp));
        });

        // Report offline status on unload
        const handleUnload = async () => {
          await setDoc(userRef, { status: 'offline' }, { merge: true });
        };
        window.addEventListener('beforeunload', handleUnload);

      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setAuthLoading(false);
        setReminders([]);
        setAlarms([]);
        setHabitLogs([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
      if (unsubReminders) unsubReminders();
      if (unsubAlarms) unsubAlarms();
      if (unsubHabits) unsubHabits();
    };
  }, []);

  const handleSignOut = async () => {
    if (currentUser) {
      try {
        // Mark user as offline in database first
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, { status: 'offline' }, { merge: true });
        await signOut(auth);
      } catch (err) {
        console.error("Logout error: ", err);
      }
    }
  };

  // JARVIS System Core Handlers
  const handleAddSystemLog = async (content: string, type: 'info' | 'success' | 'danger') => {
    if (!currentUser) return;
    const newLog = {
      id: 'sys_' + Math.random().toString(36).substr(2, 9),
      content,
      type,
      timestamp: Date.now(),
      email: currentUser.email || 'system'
    };
    try {
      await setDoc(doc(db, 'system_logs', newLog.id), newLog);
    } catch (err) {
      console.error("System log failed:", err);
    }
  };

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (language === 'ru') {
        utterance.lang = 'ru-RU';
      } else {
        utterance.lang = 'en-US';
      }
      utterance.onstart = () => setIsPlayingVoice(true);
      utterance.onend = () => setIsPlayingVoice(false);
      utterance.onerror = () => setIsPlayingVoice(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleToggleMic = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      alert("Speech Recognition not supported in this browser environment. Please use direct console typing, sir.");
      return;
    }
    try {
      const rec = new SpeechRecognitionClass();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = language === 'ru' ? 'ru-RU' : 'en-US';
      rec.onstart = () => {
        setIsListening(true);
        speakText(""); // Mute any speaking sound
      };
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        if (text) {
          handleSendJarvisMessage(text);
        }
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      rec.start();
    } catch (err) {
      console.error("Mic error:", err);
      setIsListening(false);
    }
  };

  const handleSendJarvisMessage = async (text: string) => {
    if (!text.trim() && !selectedFile) return;

    const displayPrompt = text.trim() || (language === 'ru' ? 'Проанализируй прикрепленный файл' : 'Analyze attached file');
    const displayMsg = text.trim() 
      ? (selectedFile ? `${text} [Файл: ${selectedFile.name}]` : text)
      : `[Файл: ${selectedFile.name}]`;

    const userMsg: ChatMessage = {
      id: 'msg_' + Math.random().toString(36).substr(2, 9),
      role: 'user',
      content: displayMsg,
      timestamp: Date.now()
    };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    const fileToSend = selectedFile;
    setSelectedFile(null);
    setIsConversing(true);
    handleAddSystemLog(`[USER DIRECTIVE]: ${displayPrompt}`, 'info');

    try {
      const formData = new FormData();
      formData.append('prompt', displayPrompt);
      formData.append('chatHistory', JSON.stringify(chatHistory.map(m => ({ role: m.role, content: m.content }))));
      formData.append('language', language === 'ru' ? 'ru-RU' : 'en-US');
      if (fileToSend) {
        formData.append('file', fileToSend);
      }

      const response = await fetch('/api/gemini/converse', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      const jarvisMsg: ChatMessage = {
        id: 'msg_' + Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: data.speechResponse || "Active and listening, sir.",
        explanation: data.explanation,
        timestamp: Date.now()
      };
      setChatHistory(prev => [...prev, jarvisMsg]);
      speakText(data.speechResponse);

      if (data.intentDetected) {
        handleAddSystemLog(`[NEURAL CORE CLASSIFIED]: ${data.intentType} - ${data.explanation}`, 'success');
        if (data.parameters?.commandLineSuggestion) {
          await fetch('/api/bridge/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: 'jarvis-laptop-client',
              type: data.intentType,
              commandLine: data.parameters.commandLineSuggestion,
              message: data.parameters.message || "Synthesized Command Pipeline"
            })
          });
        }
        if (data.intentType === 'create_reminder' && data.parameters?.message) {
          handleAddReminder(data.parameters.message, data.parameters.time);
        } else if (data.intentType === 'open_alarm' && data.parameters?.time) {
          handleAddAlarm(data.parameters.time, data.parameters.message || "JARVIS Remotely Configured Alarm");
        }
      }
    } catch (err) {
      console.error(err);
      handleAddSystemLog("Direct neural core uplink failed. Check background server status.", "danger");
    } finally {
      setIsConversing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAddReminder = async (text: string, time?: string) => {
    if (!currentUser) return;
    const newRem: Reminder = {
      id: 'rem_' + Math.random().toString(36).substr(2, 9),
      text,
      time: time || '',
      completed: false,
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, `users/${currentUser.uid}/reminders`, newRem.id), newRem);
      handleLogHabit(text, 'reminder');
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleReminder = async (id: string) => {
    if (!currentUser) return;
    const ref = doc(db, `users/${currentUser.uid}/reminders`, id);
    const item = reminders.find(r => r.id === id);
    if (item) {
      try {
        await updateDoc(ref, { completed: !item.completed });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!currentUser) return;
    const ref = doc(db, `users/${currentUser.uid}/reminders`, id);
    try {
      await deleteDoc(ref);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAlarm = async (time: string, label: string) => {
    if (!currentUser) return;
    const newAl: Alarm = {
      id: 'al_' + Math.random().toString(36).substr(2, 9),
      time,
      label: label || 'JARVIS System Alarm',
      active: true,
      ringDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    };
    try {
      await setDoc(doc(db, `users/${currentUser.uid}/alarms`, newAl.id), newAl);
      handleLogHabit(label, 'alarm');
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAlarm = async (id: string) => {
    if (!currentUser) return;
    const ref = doc(db, `users/${currentUser.uid}/alarms`, id);
    const item = alarms.find(a => a.id === id);
    if (item) {
      try {
        await updateDoc(ref, { active: !item.active });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteAlarm = async (id: string) => {
    if (!currentUser) return;
    const ref = doc(db, `users/${currentUser.uid}/alarms`, id);
    try {
      await deleteDoc(ref);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogHabit = async (action: string, category: 'alarm' | 'reminder' | 'cmd' | 'chat') => {
    if (!currentUser) return;
    const newLog: HabitLog = {
      id: 'hab_' + Math.random().toString(36).substr(2, 9),
      action,
      timestamp: Date.now(),
      category,
      meta: ''
    };
    try {
      await setDoc(doc(db, `users/${currentUser.uid}/habitLogs`, newLog.id), newLog);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshHabitAnalysis = async () => {
    if (habitLogs.length === 0) {
      alert(language === 'ru' ? "Сначала добавьте несколько привычек или выполните команды, чтобы накопить историю активности, сэр." : "Please perform some activities first to build routine history, sir.");
      return;
    }
    setIsAnalyzingHabits(true);
    try {
      const response = await fetch('/api/gemini/analyze-habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habitsLog: habitLogs.map(l => ({ action: l.action, category: l.category, timestamp: l.timestamp })),
          language: language === 'ru' ? 'ru-RU' : 'en-US'
        })
      });
      const data = await response.json();
      setAiAnalysisOutput(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzingHabits(false);
    }
  };

  // Bridge Polling Effect
  useEffect(() => {
    if (activeAppMode !== 'jarvis' || !currentUser) return;
    const pollBridge = async () => {
      try {
        const clientsRes = await fetch('/api/bridge/active-clients');
        const clientsData = await clientsRes.json();
        const active = clientsData.activeClients?.includes('jarvis-laptop-client') || false;
        setIsBridgeConnected(active);

        const logsRes = await fetch('/api/bridge/status-logs?clientId=jarvis-laptop-client');
        const logsData = await logsRes.json();
        setBridgeLogs(logsData.logs || []);
      } catch (err) {
        console.warn("Bridge connection telemetry reading failed:", err);
      }
    };
    pollBridge();
    const interval = setInterval(pollBridge, 4000);
    return () => clearInterval(interval);
  }, [activeAppMode, currentUser]);

  if (authLoading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[#090b0f] text-gray-100' : 'bg-slate-50 text-slate-800'
      }`}>
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500 mb-4" />
        <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
          QazaqGaz System Initializing...
        </p>
      </div>
    );
  }

  // Not authenticated
  if (!currentUser || !userProfile) {
    return (
      <AuthPage 
        onAuthSuccess={() => setActiveTab('dashboard')}
        language={language}
        setLanguage={handleSetLanguage}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  // Account suspended (blocked) page
  if (userProfile.blocked) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[#090b0f] text-gray-100' : 'bg-slate-50 text-slate-800'
      }`}>
        <div className={`w-full max-w-md p-8 border rounded-3xl text-center shadow-2xl transition-all ${
          theme === 'dark' ? 'bg-[#0f1219] border-red-500/20' : 'bg-white border-slate-200'
        }`}>
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500 mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-display font-semibold tracking-tight text-red-400">
            {language === 'ru' ? 'Учетная запись заблокирована' : 'Corporate Account Suspended'}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-3 leading-relaxed">
            {language === 'ru' 
              ? 'Ваш доступ к корпоративной системе QazaqGaz был приостановлен администратором безопасности.' 
              : 'Your access credentials to the company system have been locked. Contact system administration.'}
          </p>

          <button
            onClick={handleSignOut}
            className="w-full mt-8 flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-mono text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{language === 'ru' ? 'Выйти из системы' : 'Sign Out'}</span>
          </button>
        </div>
      </div>
    );
  }

  const roleLabels = {
    admin: language === 'ru' ? 'Администратор' : 'Superadmin',
    manager: language === 'ru' ? 'Менеджер' : 'Manager',
    employee: language === 'ru' ? 'Сотрудник' : 'Staff Employee'
  };

  const navItems = [
    { id: 'dashboard', label: language === 'ru' ? 'Главная' : 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'employees', label: language === 'ru' ? 'Сотрудники' : 'Registry', icon: <Users className="w-4 h-4" /> },
    { id: 'schedules', label: language === 'ru' ? 'Расписание' : 'Schedules', icon: <CalendarRange className="w-4 h-4" /> },
    { id: 'documents', label: language === 'ru' ? 'Документы' : 'Storage Vault', icon: <FolderLock className="w-4 h-4" /> },
    { id: 'profile', label: language === 'ru' ? 'Профиль' : 'Personal File', icon: <User className="w-4 h-4" /> },
  ];

  const jarvisNavItems = [
    { id: 'jarvis-assistant', label: language === 'ru' ? 'ИИ-Ассистент' : 'AI Assistant', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'jarvis-planner', label: language === 'ru' ? 'Тактический План' : 'Tactical Planner', icon: <CalendarRange className="w-4 h-4" /> },
    { id: 'jarvis-habits', label: language === 'ru' ? 'Привычки & Рутины' : 'Habit Optimizer', icon: <Activity className="w-4 h-4" /> },
    { id: 'jarvis-reminders', label: language === 'ru' ? 'Будильники и Напоминания' : 'Reminders & Alarms', icon: <Clock className="w-4 h-4" /> },
    { id: 'jarvis-integrations', label: language === 'ru' ? 'BIM и Google Tasks' : 'Engineering Integrations', icon: <Cpu className="w-4 h-4" /> },
  ];

  // System Superadmin email gets the log tab
  const isSuperAdmin = currentUser.email?.toLowerCase() === '3647475@gmail.com' || currentUser.email?.toLowerCase() === 'admin@astgas.kz';
  if (isSuperAdmin) {
    navItems.push({
      id: 'admin',
      label: language === 'ru' ? 'Админ логи' : 'Admin logs',
      icon: <ShieldAlert className="w-4 h-4" />
    });
  }

  return (
    <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-[#090b0f] text-gray-100 selection:bg-cyan-500/30' 
        : 'bg-slate-50 text-slate-800 selection:bg-cyan-100'
    }`}>
      
      {/* 1. Sidebar Navigation */}
      <aside className={`w-full md:w-64 border-r shrink-0 flex flex-col justify-between transition-colors duration-300 ${
        activeAppMode === 'jarvis' 
          ? 'bg-[#080a0f] border-cyan-500/10' 
          : theme === 'dark' ? 'bg-[#0c0f16] border-white/5' : 'bg-white border-slate-200'
      }`}>
        <div>
          {/* Sidebar Brand header */}
          <div className="p-6 flex items-center justify-between">
            {activeAppMode === 'hr' ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center text-white shadow-md">
                  <Building2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="font-display font-bold text-xs tracking-wider uppercase bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                    QazaqGaz HR
                  </span>
                  <span className={`block text-[9px] font-mono leading-none ${
                    theme === 'dark' ? 'text-gray-500' : 'text-slate-400'
                  }`}>
                    PORTAL_V3.1
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 rounded-xl bg-cyan-500/10 border border-[#00f2ff]/30 flex items-center justify-center text-white shadow-[0_0_15px_rgba(0,242,255,0.25)] animate-pulse">
                  <Sparkles className="w-4.5 h-4.5 text-[#00f2ff]" />
                </div>
                <div>
                  <span className="font-display font-bold text-xs tracking-wider uppercase bg-gradient-to-r from-[#00f2ff] to-cyan-500 bg-clip-text text-transparent">
                    JARVIS SYSTEM
                  </span>
                  <span className="block text-[8px] font-mono leading-none text-[#00f2ff]/65 tracking-widest uppercase">
                    Neural Core v1.4
                  </span>
                </div>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-slate-400 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

          {/* High-Tech Mode Switcher */}
          <div className="px-4 pb-4 border-b border-white/5">
            <div className="flex rounded-xl bg-black/40 p-1 border border-white/5">
              <button
                onClick={() => {
                  setActiveAppMode('hr');
                  setActiveTab('dashboard');
                  setMobileMenuOpen(false);
                }}
                className={`flex-1 py-1.5 text-[9px] font-mono rounded-lg cursor-pointer transition-all uppercase tracking-wider text-center ${
                  activeAppMode === 'hr'
                    ? 'bg-gradient-to-r from-cyan-600/30 to-emerald-600/30 border border-cyan-500/30 text-cyan-400 font-extrabold shadow-md'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {language === 'ru' ? 'HR ПОРТАЛ' : 'HR PORTAL'}
              </button>
              <button
                onClick={() => {
                  setActiveAppMode('jarvis');
                  setActiveTab('jarvis-assistant');
                  setMobileMenuOpen(false);
                }}
                className={`flex-1 py-1.5 text-[9px] font-mono rounded-lg cursor-pointer transition-all uppercase tracking-wider text-center flex items-center justify-center gap-1 ${
                  activeAppMode === 'jarvis'
                    ? 'bg-cyan-500/10 border border-[#00f2ff]/40 text-[#00f2ff] font-extrabold shadow-[0_0_10px_rgba(0,242,255,0.1)]'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Sparkles className="w-2.5 h-2.5 text-[#00f2ff] animate-pulse" />
                <span>JARVIS CORE</span>
              </button>
            </div>
          </div>

          {/* Nav Items (Desktop list) */}
          <nav className={`px-4 py-3 space-y-1.5 ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
            {activeAppMode === 'hr' ? (
              navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-cyan-500/15 to-emerald-500/5 border border-cyan-500/20 text-cyan-400 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))
            ) : (
              jarvisNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-[#00f2ff]/10 border border-[#00f2ff]/30 text-[#00f2ff] shadow-[0_0_10px_rgba(0,242,255,0.15)]'
                      : 'text-slate-400 hover:text-[#00f2ff] hover:bg-[#00f2ff]/5'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))
            )}
          </nav>
        </div>

        {/* User Card footer block */}
        <div className={`p-4 border-t ${
          theme === 'dark' ? 'border-white/5 bg-black/10' : 'border-slate-100 bg-slate-50/50'
        } ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <div className="flex items-center gap-3 mb-4 pl-1">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-inner">
              {userProfile.fullName.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <h4 className="font-semibold text-xs leading-none truncate text-white">{userProfile.fullName}</h4>
              <span className="text-[9px] font-mono text-slate-400 mt-1 block uppercase tracking-wider">
                {roleLabels[userProfile.role]}
              </span>
            </div>
          </div>

          {/* Quick controls row */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5">
              {/* Language switcher */}
              <button
                onClick={() => handleSetLanguage(language === 'ru' ? 'en' : 'ru')}
                className="text-[10px] font-mono px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                {language.toUpperCase()}
              </button>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-yellow-400" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Logout button */}
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg border border-red-500/10 bg-red-500/5 text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content container stage */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header Bar */}
        <header className={`md:hidden px-6 py-4 flex items-center justify-between border-b transition-colors duration-300 ${
          activeAppMode === 'jarvis'
            ? 'bg-[#080a0f] border-cyan-500/10'
            : theme === 'dark' ? 'bg-[#0c0f16] border-white/5' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            {activeAppMode === 'hr' ? (
              <>
                <Building2 className="w-5 h-5 text-cyan-500" />
                <span className="font-display font-semibold text-xs uppercase text-white tracking-widest">QazaqGaz HR</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-[#00f2ff] animate-pulse" />
                <span className="font-display font-semibold text-xs uppercase text-white tracking-widest">JARVIS SYSTEM</span>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-slate-400 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </header>

        {/* Dynamic Route/Switch Stage */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {/* --- HR PORTAL VIEWS --- */}
              {activeTab === 'dashboard' && activeAppMode === 'hr' && (
                <Dashboard 
                  currentUid={currentUser.uid}
                  theme={theme}
                  language={language}
                />
              )}
              {activeTab === 'employees' && activeAppMode === 'hr' && (
                <EmployeesList 
                  currentRole={userProfile.role}
                  currentUserEmail={currentUser.email || ''}
                  theme={theme}
                  language={language}
                />
              )}
              {activeTab === 'schedules' && activeAppMode === 'hr' && (
                <SchedulesView 
                  currentRole={userProfile.role}
                  currentUserEmail={currentUser.email || ''}
                  theme={theme}
                  language={language}
                />
              )}
              {activeTab === 'documents' && activeAppMode === 'hr' && (
                <DocumentsView 
                  currentRole={userProfile.role}
                  currentUserEmail={currentUser.email || ''}
                  theme={theme}
                  language={language}
                />
              )}
              {activeTab === 'profile' && activeAppMode === 'hr' && (
                <MyProfile 
                  currentUserEmail={currentUser.email || ''}
                  theme={theme}
                  language={language}
                />
              )}
              {activeTab === 'admin' && activeAppMode === 'hr' && isSuperAdmin && (
                <AdminPanel 
                  currentUserEmail={currentUser.email || ''}
                  theme={theme}
                  language={language}
                />
              )}

              {/* --- J.A.R.V.I.S. NEURAL CORE VIEWS --- */}
              {activeTab === 'jarvis-assistant' && activeAppMode === 'jarvis' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full items-stretch">
                  {/* Left: Holographic Reactor + Voice/Text Chat Panel */}
                  <div className="xl:col-span-7 flex flex-col gap-6">
                    {/* Standalone Interactive Arc Reactor Panel */}
                    <ArcReactor 
                      isListening={isListening}
                      isPlayingVoice={isPlayingVoice}
                      onToggleMic={handleToggleMic}
                      lang={language === 'ru' ? 'ru' : 'en'}
                    />

                    {/* Chat Terminal Header */}
                    <div className="bg-[#0c0f16] p-4 rounded-2xl border border-cyan-500/20 flex items-center justify-between shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBridgeConnected ? 'bg-[#00f2ff]' : 'bg-amber-400'}`}></span>
                          <span className={`relative inline-flex rounded-full h-3 w-3 ${isBridgeConnected ? 'bg-[#00f2ff]' : 'bg-amber-400'}`}></span>
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-xs uppercase tracking-widest text-white">
                            {language === 'ru' ? 'СВЯЗЬ С ИИ-ЯДРОМ' : 'NEURAL CORE UPLINK'}
                          </h3>
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mt-0.5">
                            {isBridgeConnected 
                              ? (language === 'ru' ? 'Локальный агент активен' : 'Local Host Bridge Active') 
                              : (language === 'ru' ? 'Агент офлайн • Ожидание хоста' : 'Agent Offline • Host Awaited')}
                          </span>
                        </div>
                      </div>

                      {/* Bridge Connection indicator */}
                      <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/5 font-mono text-[9px] text-slate-400">
                        <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                        <span>jarvis-laptop-client</span>
                      </div>
                    </div>

                    {/* Chat Logs viewport & input console */}
                    <div className="bg-[#0c0f16] flex-1 rounded-3xl border border-cyan-500/15 flex flex-col overflow-hidden relative min-h-[350px] shadow-lg">
                      {/* Grid background effect */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,242,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,242,255,0.015)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
                      
                      {/* Messages scroll box */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
                        {chatHistory.map((msg, index) => (
                          <div 
                            key={msg.id || index} 
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs font-mono border ${
                              msg.role === 'user'
                                ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-100 rounded-tr-none'
                                : 'bg-[#121620] border-white/5 text-slate-200 rounded-tl-none shadow-md'
                            }`}>
                              <div className="flex items-center justify-between gap-6 mb-1 opacity-45 text-[9px] uppercase tracking-wider">
                                <span>{msg.role === 'user' ? (language === 'ru' ? 'ДИРЕКТИВА' : 'USER') : 'JARVIS CORE'}</span>
                                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              {msg.explanation && (
                                <div className="mt-2 pt-2 border-t border-cyan-500/10 text-[9px] text-[#00f2ff]/75">
                                  <strong>[NEURAL THINK LOG]:</strong> {msg.explanation}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {isConversing && (
                          <div className="flex justify-start">
                            <div className="bg-[#121620] border border-cyan-500/20 text-cyan-400 rounded-2xl rounded-tl-none p-3 font-mono text-[10px] animate-pulse flex items-center gap-2">
                              <Cpu className="w-3.5 h-3.5 animate-spin text-[#00f2ff]" />
                              <span>{language === 'ru' ? 'Синтез ответа моделью Gemini...' : 'Synthesizing response via Gemini...'}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Interactive visualizer stage */}
                      <div className="border-t border-cyan-500/15 p-4 flex items-center gap-3 bg-[#0a0c12] relative z-10">
                        {/* Audio visualizer feedback reactor button */}
                        <div className="w-12 h-12 shrink-0 relative flex items-center justify-center">
                          <button
                            onClick={handleToggleMic}
                            className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                              isListening 
                                ? 'bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse' 
                                : isPlayingVoice
                                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 animate-bounce'
                                  : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                            }`}
                            title={isListening ? (language === 'ru' ? 'Выключить микрофон' : 'Mute Mic') : (language === 'ru' ? 'Включить микрофон' : 'Unmute Mic')}
                          >
                            {isListening ? (
                              <MicOff className="w-5 h-5 text-red-400 animate-bounce" />
                            ) : (
                              <Mic className="w-5 h-5 text-cyan-400 hover:scale-110 transition-transform" />
                            )}
                            <span className={`absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-60 ${isListening ? 'border-red-500/50' : isPlayingVoice ? 'border-amber-500/50' : ''}`}></span>
                          </button>
                        </div>

                        {/* Interactive Input form */}
                        <div className="flex-1 flex flex-col gap-2">
                          {selectedFile && (
                            <div className="flex items-center gap-2 bg-[#00f2ff]/5 border border-[#00f2ff]/20 px-3 py-1.5 rounded-xl max-w-xs self-start transition-all">
                              <Paperclip className="w-3.5 h-3.5 text-[#00f2ff] animate-pulse" />
                              <span className="text-[10px] font-mono text-cyan-300 truncate max-w-[150px]">{selectedFile.name}</span>
                              <button 
                                type="button" 
                                onClick={() => setSelectedFile(null)}
                                className="text-cyan-500 hover:text-red-400 transition-colors ml-1 p-0.5 rounded-full hover:bg-white/5"
                                title={language === 'ru' ? 'Удалить файл' : 'Remove file'}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <div className="flex gap-2 w-full">
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendJarvisMessage(chatInput)}
                              placeholder={language === 'ru' ? 'Введите директиву для JARVIS...' : 'Transmit system query to JARVIS...'}
                              disabled={isConversing}
                              className="flex-1 bg-black/55 border border-cyan-500/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-[#00f2ff]/60 focus:shadow-[0_0_12px_rgba(0,242,255,0.08)] transition-all"
                            />
                            
                            {/* File Attachment Button */}
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                                selectedFile 
                                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                              }`}
                              title={language === 'ru' ? 'Загрузить файл' : 'Attach File'}
                            >
                              <Paperclip className="w-4 h-4" />
                            </button>
                            <input 
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              className="hidden"
                            />

                            {/* Send action */}
                            <button
                              onClick={() => handleSendJarvisMessage(chatInput)}
                              disabled={(!chatInput.trim() && !selectedFile) || isConversing}
                              className="px-4 bg-[#00f2ff]/10 border border-[#00f2ff]/30 text-[#00f2ff] hover:bg-[#00f2ff]/20 font-mono text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-35"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Real-time Terminal Log for background task streams */}
                  <div className="xl:col-span-5 h-full flex flex-col">
                    <JarvisTerminal 
                      logs={bridgeLogs}
                      serverUrl={typeof window !== 'undefined' ? window.location.origin : ''}
                      isBridgeConnected={isBridgeConnected}
                      language={language === 'ru' ? 'ru-RU' : 'en-US'}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'jarvis-planner' && activeAppMode === 'jarvis' && (
                <PlannerAgent 
                  language={language === 'ru' ? 'ru-RU' : 'en-US'}
                  onAddReminder={handleAddReminder}
                  onAddAlarm={handleAddAlarm}
                  reminders={reminders}
                  alarms={alarms}
                  onLogHabit={handleLogHabit}
                  addSystemLogMessage={handleAddSystemLog}
                  speakText={speakText}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'jarvis-habits' && activeAppMode === 'jarvis' && (
                <HabitOptimizer 
                  habitLogs={habitLogs}
                  language={language === 'ru' ? 'ru-RU' : 'en-US'}
                  onRefreshAnalysis={handleRefreshHabitAnalysis}
                  aiAnalysisOutput={aiAnalysisOutput}
                  isLoading={isAnalyzingHabits}
                />
              )}

              {activeTab === 'jarvis-reminders' && activeAppMode === 'jarvis' && (
                <ScheduleReminders 
                  reminders={reminders}
                  alarms={alarms}
                  language={language === 'ru' ? 'ru-RU' : 'en-US'}
                  onAddReminder={handleAddReminder}
                  onToggleReminder={handleToggleReminder}
                  onDeleteReminder={handleDeleteReminder}
                  onAddAlarm={handleAddAlarm}
                  onToggleAlarm={handleToggleAlarm}
                  onDeleteAlarm={handleDeleteAlarm}
                />
              )}

              {activeTab === 'jarvis-integrations' && activeAppMode === 'jarvis' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <GoogleTasks 
                    accessToken=""
                    language={language === 'ru' ? 'ru-RU' : 'en-US'}
                  />
                  <RevitIntegration 
                    language={language === 'ru' ? 'ru-RU' : 'en-US'}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
