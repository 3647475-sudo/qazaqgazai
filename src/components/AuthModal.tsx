import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  LogIn, 
  AlertCircle, 
  CloudLightning, 
  ShieldCheck, 
  CheckCircle,
  Building2
} from 'lucide-react';
import { auth, signInWithGoogle } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
  onSuccess: (accessToken: string | null) => void;
}

export default function AuthModal({ isOpen, onClose, language, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Localized texts
  const t = {
    title: language === 'kk-KZ' ? 'QazaqGaz қызметкерлер порталы' : language === 'ru-RU' ? 'Портал сотрудников QazaqGaz' : 'QazaqGaz Employee Portal',
    subtitle: language === 'kk-KZ' ? 'Бұлтты синхрондау және JARVIS басқару жүйесі' : language === 'ru-RU' ? 'Облачная синхронизация и панель JARVIS' : 'Cloud Synchronization & JARVIS Console',
    emailLabel: language === 'kk-KZ' ? 'Корпоративтік E-mail' : language === 'ru-RU' ? 'Корпоративный E-mail' : 'Corporate E-mail',
    emailPlaceholder: 'name@qazaqgaz.kz',
    passwordLabel: language === 'kk-KZ' ? 'Құпия сөз' : language === 'ru-RU' ? 'Пароль' : 'Password',
    passwordPlaceholder: '••••••••',
    nameLabel: language === 'kk-KZ' ? 'Толық аты-жөні' : language === 'ru-RU' ? 'Полное имя' : 'Full Name',
    namePlaceholder: 'Иван Иванов',
    loginBtn: language === 'kk-KZ' ? 'Кіру' : language === 'ru-RU' ? 'Войти' : 'Sign In',
    registerBtn: language === 'kk-KZ' ? 'Тіркелу' : language === 'ru-RU' ? 'Зарегистрироваться' : 'Register',
    googleBtn: language === 'kk-KZ' ? 'Google арқылы кіру' : language === 'ru-RU' ? 'Войти через Google' : 'Sign In with Google',
    noAccount: language === 'kk-KZ' ? 'Аккаунтыңыз жоқ па?' : language === 'ru-RU' ? 'Нет аккаунта?' : "Don't have an account?",
    haveAccount: language === 'kk-KZ' ? 'Аккаунтыңыз бар ма?' : language === 'ru-RU' ? 'Уже есть аккаунт?' : 'Already have an account?',
    switchRegister: language === 'kk-KZ' ? 'Тіркелу' : language === 'ru-RU' ? 'Зарегистрируйтесь' : 'Register here',
    switchLogin: language === 'kk-KZ' ? 'Кіріңіз' : language === 'ru-RU' ? 'Войдите' : 'Log in here',
    domainWarning: language === 'kk-KZ' ? 'Ресми @qazaqgaz.kz поштасы ұсынылады' : language === 'ru-RU' ? 'Рекомендуется корпоративная почта @qazaqgaz.kz' : 'Corporate @qazaqgaz.kz is recommended',
    verifiedEmployee: language === 'kk-KZ' ? 'Расталған QazaqGaz қызметкері' : language === 'ru-RU' ? 'Подтвержденный сотрудник QazaqGaz' : 'Verified QazaqGaz Employee',
    loadingText: language === 'kk-KZ' ? 'Орындалуда...' : language === 'ru-RU' ? 'Выполнение...' : 'Processing...',
  };

  const isQazaqGazEmail = email.toLowerCase().endsWith('@qazaqgaz.kz');

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          throw new Error(language === 'kk-KZ' ? 'Толық аты-жөніңізді енгізіңіз' : language === 'ru-RU' ? 'Пожалуйста, введите ваше полное имя' : 'Please enter your full name');
        }
        // Register user
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: fullName });
        setSuccessMsg(language === 'kk-KZ' ? 'Тіркелу сәтті аяқталды!' : language === 'ru-RU' ? 'Регистрация успешно завершена!' : 'Registration successful!');
        setTimeout(() => {
          onSuccess(null);
          onClose();
        }, 1200);
      } else {
        // Sign in user
        await signInWithEmailAndPassword(auth, email, password);
        setSuccessMsg(language === 'kk-KZ' ? 'Қош келдіңіз!' : language === 'ru-RU' ? 'Добро пожаловать!' : 'Welcome back!');
        setTimeout(() => {
          onSuccess(null);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error(err);
      let localizedError = err.message;
      if (err.code === 'auth/email-already-in-use') {
        localizedError = language === 'kk-KZ' ? 'Бұл e-mail бос емес' : language === 'ru-RU' ? 'Этот e-mail уже используется' : 'This email is already in use';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        localizedError = language === 'kk-KZ' ? 'Қате электрондық пошта немесе құпия сөз' : language === 'ru-RU' ? 'Неверный e-mail или пароль' : 'Invalid email or password';
      } else if (err.code === 'auth/weak-password') {
        localizedError = language === 'kk-KZ' ? 'Құпия сөз тым әлсіз (кемінде 6 таңба керек)' : language === 'ru-RU' ? 'Пароль слишком слабый (минимум 6 символов)' : 'Password should be at least 6 characters';
      } else if (err.code === 'auth/invalid-email') {
        localizedError = language === 'kk-KZ' ? 'Қате e-mail форматы' : language === 'ru-RU' ? 'Неверный формат e-mail' : 'Invalid email format';
      }
      setErrorMsg(localizedError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const { accessToken, user } = await signInWithGoogle();
      if (user) {
        setSuccessMsg(language === 'kk-KZ' ? 'Google арқылы сәтті кірдіңіз!' : language === 'ru-RU' ? 'Успешный вход через Google!' : 'Successful login via Google!');
        setTimeout(() => {
          onSuccess(accessToken || null);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Google Auth Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-[#0d0e12] border border-[#00f2ff]/30 shadow-[0_0_40px_rgba(0,242,255,0.15)] rounded-3xl overflow-hidden p-6 md:p-8"
      >
        {/* QazaqGaz Themed Gradient Accent Strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-[#00f2ff] to-cyan-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-950/50 to-cyan-950/50 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.1)] mb-3">
            <Building2 className="w-6 h-6 text-[#00f2ff]" />
          </div>
          <h2 className="text-white font-display font-semibold text-lg tracking-wide uppercase">
            {t.title}
          </h2>
          <p className="text-gray-400 text-xs font-mono mt-1">
            {t.subtitle}
          </p>
        </div>

        {/* Errors & Success Notifications */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-400"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-400 font-mono"
            >
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 animate-bounce" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5 pl-1">
                {t.nameLabel}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/60 border border-white/10 hover:border-[#00f2ff]/30 focus:border-[#00f2ff] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none transition-all font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5 pl-1 flex justify-between items-center">
              <span>{t.emailLabel}</span>
              {isQazaqGazEmail && (
                <span className="text-[9px] text-emerald-400 flex items-center gap-1 normal-case font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {t.verifiedEmployee}
                </span>
              )}
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 bg-black/60 border border-white/10 hover:border-[#00f2ff]/30 focus:border-[#00f2ff] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none transition-all font-mono"
              />
            </div>
            {!isQazaqGazEmail && email.includes('@') && (
              <p className="text-[9px] text-amber-500/80 font-mono mt-1.5 pl-1">
                ⚠️ {t.domainWarning}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5 pl-1">
              {t.passwordLabel}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 bg-black/60 border border-white/10 hover:border-[#00f2ff]/30 focus:border-[#00f2ff] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none transition-all font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-black font-semibold text-xs rounded-xl shadow-[0_0_15px_rgba(0,242,255,0.1)] hover:shadow-[0_0_25px_rgba(0,242,255,0.25)] active:scale-95 cursor-pointer disabled:opacity-50 transition-all font-display uppercase tracking-widest"
          >
            <LogIn className="w-4 h-4 text-black" />
            {loading ? t.loadingText : isSignUp ? t.registerBtn : t.loginBtn}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5" />
          </div>
          <div className="relative flex justify-center text-[10px] font-mono uppercase">
            <span className="bg-[#0d0e12] px-3 text-gray-500">or</span>
          </div>
        </div>

        {/* Google Authentication */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-black hover:bg-white/5 border border-white/10 hover:border-[#00f2ff]/40 rounded-xl text-xs font-mono text-gray-300 hover:text-white cursor-pointer active:scale-95 transition-all shadow-inner"
        >
          <CloudLightning className="w-4 h-4 text-[#00f2ff]" />
          {t.googleBtn}
        </button>

        {/* Toggle Form Action */}
        <div className="mt-6 text-center">
          <span className="text-[11px] text-gray-500 font-mono">
            {isSignUp ? t.haveAccount : t.noAccount}{' '}
          </span>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="text-[11px] text-[#00f2ff] hover:underline font-mono focus:outline-none cursor-pointer"
          >
            {isSignUp ? t.switchLogin : t.switchRegister}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
