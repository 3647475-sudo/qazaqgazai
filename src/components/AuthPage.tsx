import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Mail, 
  Lock, 
  User as UserIcon, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  ShieldAlert,
  Moon,
  Sun
} from 'lucide-react';
import { 
  auth, 
  db,
  signInWithGoogle
} from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  addDoc, 
  collection 
} from 'firebase/firestore';

interface AuthPageProps {
  onAuthSuccess: () => void;
  language: 'ru' | 'en';
  setLanguage: (lang: 'ru' | 'en') => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export default function AuthPage({ onAuthSuccess, language, setLanguage, theme, toggleTheme }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [ip, setIp] = useState('Fetching...');

  // Fetch public IP address
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIp(data.ip))
      .catch(() => setIp('Local/Private'));
  }, []);

  const t = {
    title: language === 'ru' ? 'Корпоративный Портал Управления' : 'Corporate Management Portal',
    subtitle: language === 'ru' ? 'Панель администрирования, сотрудников и расписаний QazaqGaz' : 'QazaqGaz Administration, Employees & Schedule Panel',
    emailLabel: language === 'ru' ? 'Корпоративный E-mail' : 'Corporate E-mail',
    emailPlaceholder: 'name@company.com',
    passwordLabel: language === 'ru' ? 'Пароль' : 'Password',
    nameLabel: language === 'ru' ? 'Полное Имя сотрудника' : 'Employee Full Name',
    namePlaceholder: language === 'ru' ? 'Иван Петров' : 'John Doe',
    loginBtn: language === 'ru' ? 'Войти в Систему' : 'Sign In',
    registerBtn: language === 'ru' ? 'Зарегистрировать аккаунт' : 'Create Account',
    resetBtn: language === 'ru' ? 'Отправить ссылку для сброса' : 'Send Reset Link',
    noAccount: language === 'ru' ? 'Нет корпоративного аккаунта?' : "Don't have an account?",
    haveAccount: language === 'ru' ? 'Уже зарегистрированы?' : 'Already have an account?',
    forgotPass: language === 'ru' ? 'Забыли пароль?' : 'Forgot password?',
    backToLogin: language === 'ru' ? 'Вернуться к входу' : 'Back to Login',
    registerNow: language === 'ru' ? 'Зарегистрироваться' : 'Register here',
    resetSuccess: language === 'ru' ? 'Инструкции по сбросу отправлены на ваш e-mail' : 'Reset instructions sent to your email',
    regSuccess: language === 'ru' ? 'Аккаунт успешно создан! Идет вход...' : 'Account created successfully! Logging in...',
    welcome: language === 'ru' ? 'С возвращением! Выполняется вход...' : 'Welcome back! Logging in...'
  };

  const getClientSpecs = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown Browser';
    let device = 'Desktop';

    if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
    else if (ua.includes('SamsungBrowser')) browser = 'Samsung Browser';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
    else if (ua.includes('Trident')) browser = 'Internet Explorer';
    else if (ua.includes('Edge')) browser = 'Microsoft Edge';
    else if (ua.includes('Chrome')) browser = 'Google Chrome';
    else if (ua.includes('Safari')) browser = 'Apple Safari';

    if (/Mobi|Android|iPhone|iPad/i.test(ua)) {
      device = 'Mobile/Tablet';
    }
    return { browser, device };
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const { browser, device } = getClientSpecs();

      if (mode === 'register') {
        if (!fullName.trim()) {
          throw new Error(language === 'ru' ? 'Пожалуйста, введите ваше полное имя' : 'Please enter your full name');
        }
        // Create user in Auth
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: fullName });

        // Initial Role definition - first user ever or specific emails are Admin, others can be managers/employees
        // Default admin: your email
        const isAdminEmail = email.toLowerCase() === '3647475@gmail.com' || email.toLowerCase() === 'admin@astgas.kz';
        const assignedRole = isAdminEmail ? 'admin' : 'employee';

        // Write to users collection
        await setDoc(doc(db, 'users', userCred.user.uid), {
          uid: userCred.user.uid,
          fullName,
          email: email.toLowerCase(),
          role: assignedRole,
          status: 'online',
          blocked: false,
          createdAt: Date.now(),
          lastLogin: Date.now()
        });

        // Write to login_logs collection
        await addDoc(collection(db, 'login_logs'), {
          uid: userCred.user.uid,
          name: fullName,
          email: email.toLowerCase(),
          timestamp: Date.now(),
          ipAddress: ip,
          device,
          browser,
          type: 'register'
        });

        setSuccessMsg(t.regSuccess);
        setTimeout(() => {
          onAuthSuccess();
        }, 1500);

      } else if (mode === 'login') {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        
        // Fetch current user details or verify they aren't blocked
        // We'll update the users profile with online status and log the login
        const name = userCred.user.displayName || 'Employee';

        await setDoc(doc(db, 'users', userCred.user.uid), {
          uid: userCred.user.uid,
          fullName: name,
          email: email.toLowerCase(),
          status: 'online',
          lastLogin: Date.now()
        }, { merge: true });

        // Write to login_logs
        await addDoc(collection(db, 'login_logs'), {
          uid: userCred.user.uid,
          name,
          email: email.toLowerCase(),
          timestamp: Date.now(),
          ipAddress: ip,
          device,
          browser,
          type: 'login'
        });

        setSuccessMsg(t.welcome);
        setTimeout(() => {
          onAuthSuccess();
        }, 1500);

      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg(t.resetSuccess);
        setTimeout(() => {
          setMode('login');
          setSuccessMsg('');
        }, 3000);
      }
    } catch (err: any) {
      console.error(err);
      let errorText = err.message;
      if (err.code === 'auth/email-already-in-use') {
        errorText = language === 'ru' ? 'Этот e-mail уже зарегистрирован' : 'This email is already in use';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        errorText = language === 'ru' ? 'Неверный адрес электронной почты или пароль' : 'Invalid email or password';
      } else if (err.code === 'auth/weak-password') {
        errorText = language === 'ru' ? 'Пароль должен содержать минимум 6 символов' : 'Password must be at least 6 characters';
      } else if (err.code === 'auth/invalid-email') {
        errorText = language === 'ru' ? 'Неверный формат электронного адреса' : 'Invalid email address format';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorText = language === 'ru' 
          ? 'Вход по Email/паролю отключен в консоли Firebase. Поскольку у вас нет прав изменить настройки, пожалуйста, используйте кнопку "Войти через Google" ниже. Ваш e-mail (3647475@gmail.com) автоматически получит полные права Суперадминистратора!' 
          : 'Email/Password login is disabled in Firebase. Since you do not have permission to enable it, please use the "Sign in with Google" button below. Your email will automatically be granted Superadmin privileges!';
      }
      setErrorMsg(errorText);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const { user } = await signInWithGoogle();
      const { browser, device } = getClientSpecs();
      
      // Seed default profile if not exists
      const userRef = doc(db, 'users', user.uid);
      const isSuperAdmin = user.email?.toLowerCase() === '3647475@gmail.com' || user.email?.toLowerCase() === 'admin@astgas.kz';
      const assignedRole = isSuperAdmin ? 'admin' : 'employee';

      await setDoc(userRef, {
        uid: user.uid,
        fullName: user.displayName || 'Google User',
        email: user.email?.toLowerCase() || '',
        role: assignedRole,
        status: 'online',
        lastLogin: Date.now()
      }, { merge: true });

      // Write to login_logs
      await addDoc(collection(db, 'login_logs'), {
        uid: user.uid,
        name: user.displayName || 'Google User',
        email: user.email?.toLowerCase() || '',
        timestamp: Date.now(),
        ipAddress: ip,
        device,
        browser,
        type: 'login (Google)'
      });

      setSuccessMsg(t.welcome);
      setTimeout(() => {
        onAuthSuccess();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-[#090b0f] text-gray-100 selection:bg-[#00f2ff]/30 selection:text-white' 
        : 'bg-slate-50 text-slate-800 selection:bg-cyan-100'
    }`}>
      {/* Header Bar */}
      <header className={`px-6 py-4 flex items-center justify-between border-b transition-colors duration-300 ${
        theme === 'dark' ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white/50'
      } backdrop-blur-md`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center text-white shadow-md">
            <Building2 className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="font-display font-bold text-sm tracking-wider uppercase bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              QazaqGaz Portal
            </span>
            <span className={`block text-[10px] font-mono leading-none ${
              theme === 'dark' ? 'text-gray-500' : 'text-slate-400'
            }`}>
              SYSTEM_SECURE_V3
            </span>
          </div>
        </div>

        {/* Toolbar Settings */}
        <div className="flex items-center gap-3">
          {/* Language Selection */}
          <div className={`flex items-center rounded-lg p-0.5 border ${
            theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-100'
          }`}>
            <button
              onClick={() => setLanguage('ru')}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                language === 'ru' 
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              RU
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                language === 'en' 
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Theme Selector */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              theme === 'dark' 
                ? 'border-white/10 bg-white/5 text-yellow-400 hover:bg-white/10' 
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card Wrapper */}
          <div className={`rounded-3xl border shadow-xl overflow-hidden transition-all duration-300 ${
            theme === 'dark' 
              ? 'bg-[#0f1219] border-white/5 shadow-cyan-950/20' 
              : 'bg-white border-slate-200 shadow-slate-200/50'
          }`}>
            <div className="p-6 md:p-8">
              {/* Icon & Welcome Header */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${
                  theme === 'dark' 
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400' 
                    : 'bg-cyan-50 text-cyan-600 border border-cyan-200'
                }`}>
                  <Building2 className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-display font-semibold tracking-tight">
                  {t.title}
                </h2>
                <p className={`text-xs mt-1.5 max-w-[280px] leading-relaxed ${
                  theme === 'dark' ? 'text-gray-400' : 'text-slate-500'
                }`}>
                  {t.subtitle}
                </p>
              </div>

              {/* Status Alert Notification */}
              <AnimatePresence mode="wait">
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </motion.div>
                )}

                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{successMsg}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form elements */}
              <form onSubmit={handleAuth} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className={`block text-[10px] font-mono uppercase tracking-widest mb-1.5 pl-1 ${
                      theme === 'dark' ? 'text-cyan-400' : 'text-slate-500'
                    }`}>
                      {t.nameLabel}
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t.namePlaceholder}
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl text-xs transition-all focus:outline-none ${
                          theme === 'dark' 
                            ? 'bg-black/40 border-white/10 hover:border-cyan-500/30 focus:border-cyan-400 text-white placeholder-gray-600' 
                            : 'bg-slate-50 border-slate-200 hover:border-cyan-300 focus:border-cyan-500 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className={`block text-[10px] font-mono uppercase tracking-widest mb-1.5 pl-1 ${
                    theme === 'dark' ? 'text-cyan-400' : 'text-slate-500'
                  }`}>
                    {t.emailLabel}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className={`w-full pl-10 pr-4 py-3 border rounded-xl text-xs transition-all focus:outline-none ${
                        theme === 'dark' 
                          ? 'bg-black/40 border-white/10 hover:border-cyan-500/30 focus:border-cyan-400 text-white placeholder-gray-600' 
                          : 'bg-slate-50 border-slate-200 hover:border-cyan-300 focus:border-cyan-500 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <div className="flex justify-between items-center mb-1.5 pl-1">
                      <label className={`text-[10px] font-mono uppercase tracking-widest ${
                        theme === 'dark' ? 'text-cyan-400' : 'text-slate-500'
                      }`}>
                        {t.passwordLabel}
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => setMode('forgot')}
                          className="text-[10px] font-mono text-cyan-500 hover:underline cursor-pointer"
                        >
                          {t.forgotPass}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl text-xs transition-all focus:outline-none ${
                          theme === 'dark' 
                            ? 'bg-black/40 border-white/10 hover:border-cyan-500/30 focus:border-cyan-400 text-white placeholder-gray-600' 
                            : 'bg-slate-50 border-slate-200 hover:border-cyan-300 focus:border-cyan-500 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-cyan-600 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-black font-semibold text-xs rounded-xl shadow-lg active:scale-[0.98] transition-all cursor-pointer font-display uppercase tracking-widest disabled:opacity-50"
                >
                  {loading ? (
                    <span>...</span>
                  ) : (
                    <>
                      <span>{mode === 'login' ? t.loginBtn : mode === 'register' ? t.registerBtn : t.resetBtn}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Or separator */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/5 dark:border-white/5 border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  {language === 'ru' ? 'ИЛИ' : 'OR'}
                </span>
                <div className="flex-grow border-t border-white/5 dark:border-white/5 border-slate-200"></div>
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
                className={`w-full flex items-center justify-center gap-3 py-3 border rounded-xl text-xs font-semibold font-mono uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                }`}
              >
                {/* Custom Google Icon */}
                <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 15.02 1 12 1 7.24 1 3.2 3.74 1.25 7.74l3.87 3C6.11 7.6 8.84 5.04 12 5.04z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.97 3.7-8.62z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.12 14.74c-.25-.74-.38-1.53-.38-2.34s.13-1.6.38-2.34L1.25 7.74C.45 9.39 0 11.24 0 13.2s.45 3.81 1.25 5.46l3.87-2.92z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.1.74-2.52 1.18-4.23 1.18-3.16 0-5.89-2.56-6.88-5.7l-3.87 2.92C3.2 20.26 7.24 23 12 23z"
                  />
                </svg>
                <span>{language === 'ru' ? 'Войти через Google' : 'Sign in with Google'}</span>
              </button>

              {/* Quick Admin Access */}
              <div className={`mt-4 p-3 rounded-2xl border text-xs text-left transition-all ${
                theme === 'dark' ? 'bg-cyan-500/[0.03] border-cyan-500/10' : 'bg-cyan-50/30 border-cyan-100'
              }`}>
                <div className="font-semibold text-cyan-400 mb-1">
                  {language === 'ru' ? '🔑 Быстрый доступ для тестирования:' : '🔑 Quick Admin Access:'}
                </div>
                <div className="font-mono text-[10px] space-y-0.5 text-slate-400">
                  <div>Email: <span className="text-cyan-400 font-bold select-all">admin@astgas.kz</span></div>
                  <div>Pass: <span className="text-cyan-400 font-bold select-all">Abdullin1111</span></div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@astgas.kz');
                    setPassword('Abdullin1111');
                    if (mode === 'register') {
                      setFullName('System Admin');
                    }
                  }}
                  className="mt-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono hover:underline block cursor-pointer"
                >
                  {language === 'ru' ? 'Кликните для автозаполнения' : 'Click to prefill'}
                </button>
              </div>

              {/* Mode Toggle Switcher */}
              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <span className={`text-[11px] font-mono ${
                  theme === 'dark' ? 'text-gray-500' : 'text-slate-400'
                }`}>
                  {mode === 'login' ? t.noAccount : mode === 'register' ? t.haveAccount : ''}{' '}
                </span>
                {mode === 'forgot' ? (
                  <button
                    onClick={() => {
                      setMode('login');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] text-cyan-400 hover:underline font-mono focus:outline-none cursor-pointer font-semibold"
                  >
                    {t.backToLogin}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMode(mode === 'login' ? 'register' : 'login');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] text-cyan-400 hover:underline font-mono focus:outline-none cursor-pointer font-semibold"
                  >
                    {mode === 'login' ? t.registerNow : t.backToLogin}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer System Specs */}
      <footer className={`px-6 py-4 border-t text-center md:flex md:justify-between md:items-center transition-colors duration-300 ${
        theme === 'dark' ? 'border-white/5 bg-black/20 text-gray-500' : 'border-slate-200 bg-white/50 text-slate-400'
      }`}>
        <div className="flex items-center justify-center gap-2 text-[10px] font-mono">
          <ShieldAlert className="w-3.5 h-3.5 text-cyan-500" />
          <span>{language === 'ru' ? 'IP АДРЕС' : 'IP ADDR'}: <span className="text-gray-300">{ip}</span></span>
        </div>
        <div className="text-[10px] font-mono mt-2 md:mt-0">
          {language === 'ru' ? 'Технологическая лаборатория QazaqGaz. Все права защищены. © 2026' : 'QazaqGaz Tech Lab. All Rights Reserved. © 2026'}
        </div>
      </footer>
    </div>
  );
}
