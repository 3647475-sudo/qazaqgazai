import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  ShieldAlert, 
  Lock, 
  History,
  CloudUpload
} from 'lucide-react';
import { Employee, UserRole } from '../types';

interface MyProfileProps {
  currentUserEmail: string;
  theme: 'dark' | 'light';
  language: 'ru' | 'en';
}

export default function MyProfile({ currentUserEmail, theme, language }: MyProfileProps) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable Form fields state
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!currentUserEmail) return;

    setLoading(true);
    // Find the employee doc matching this email address
    const q = query(collection(db, 'employees'), where('email', '==', currentUserEmail.toLowerCase()));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const emp = { id: docSnap.id, ...docSnap.data() } as Employee;
        setEmployee(emp);
        
        // Seed editable fields
        setPhone(emp.phone || '');
        setAddress(emp.address || '');
        setEmergencyName(emp.emergencyContact?.name || '');
        setEmergencyPhone(emp.emergencyContact?.phone || '');
        setEmergencyRelationship(emp.emergencyContact?.relationship || '');
      } else {
        setEmployee(null);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserEmail]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setUploading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      let finalPhotoUrl = employee.photoUrl;

      // Handle photo upload
      if (photoFile) {
        const storageRef = ref(storage, `employees/${employee.employeeId}_${Date.now()}_${photoFile.name}`);
        const uploadResult = await uploadBytes(storageRef, photoFile);
        finalPhotoUrl = await getDownloadURL(uploadResult.ref);
      }

      const updatedContact = {
        name: emergencyName,
        phone: emergencyPhone,
        relationship: emergencyRelationship
      };

      const changeDesc = language === 'ru' 
        ? 'Сотрудник самостоятельно обновил личные контактные данные' 
        : 'Employee self-updated personal contact information';

      const updatedHistory = [...(employee.changeHistory || [])];
      updatedHistory.push({
        id: `hist_${Date.now()}`,
        timestamp: Date.now(),
        updatedBy: 'employee',
        updatedByEmail: currentUserEmail,
        changes: changeDesc
      });

      await updateDoc(doc(db, 'employees', employee.id), {
        phone,
        address,
        photoUrl: finalPhotoUrl,
        emergencyContact: updatedContact,
        changeHistory: updatedHistory
      });

      setSuccessMsg(language === 'ru' ? 'Личные данные успешно обновлены!' : 'Personal profile updated successfully!');
      setPhotoFile(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setUploading(false);
    }
  };

  const t = {
    title: language === 'ru' ? 'Мой Профиль / Личное дело' : 'My Personal File & Profile',
    sub: language === 'ru' ? 'Просматривайте личное дело и обновляйте контактные данные' : 'Review employee file and self-update contact parameters',
    notOnboardedTitle: language === 'ru' ? 'Личное дело отсутствует' : 'Profile File Not Found',
    notOnboardedText: language === 'ru' ? 'Ваш e-mail еще не привязан к реестру сотрудников HR. Пожалуйста, обратитесь к системному администратору.' : 'Your corporate email is not linked to any active employee records. Contact HR admin.',
    saveBtn: language === 'ru' ? 'Обновить контакты' : 'Update My Profile',
    photoLabel: language === 'ru' ? 'Обновить аватар' : 'Update Avatar Photo'
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs font-mono text-slate-500">
        <History className="w-6 h-6 animate-spin mx-auto mb-3 text-cyan-400" />
        Synchronizing profile logs from security registry...
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-amber-400">{t.notOnboardedTitle}</h3>
        <p className="text-xs text-gray-400 mt-2 font-mono leading-relaxed">
          {t.notOnboardedText}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-display font-semibold flex items-center gap-2">
          <User className="w-5.5 h-5.5 text-cyan-400" />
          <span>{t.title}</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">{t.sub}</p>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-start gap-2.5">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Form container split */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Profile Card Sidebar */}
        <div className={`md:col-span-4 p-5 rounded-3xl border flex flex-col items-center text-center justify-between ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="w-full flex flex-col items-center">
            <img 
              src={employee.photoUrl} 
              alt={employee.fullName} 
              referrerPolicy="no-referrer"
              className="w-24 h-24 rounded-full object-cover border-4 border-cyan-500/25 mb-4"
            />
            <h3 className="font-semibold text-base text-white">{employee.fullName}</h3>
            <p className="text-xs text-cyan-400 font-mono mt-1">{employee.position}</p>
            <span className="block text-[10px] uppercase font-mono text-slate-500 tracking-wider mt-0.5">{employee.department}</span>

            <div className="mt-4 pt-4 border-t border-white/5 w-full space-y-1.5 font-mono text-[10px] text-left text-slate-400">
              <div>Employee ID: <span className="text-white">{employee.employeeId}</span></div>
              <div>System Role: <span className="text-white">{employee.role}</span></div>
              <div>Joined Date: <span className="text-white">{new Date(employee.hireDate).toLocaleDateString()}</span></div>
              <div>Date of Birth: <span className="text-white">{new Date(employee.dateOfBirth).toLocaleDateString()}</span></div>
            </div>
          </div>

          <div className="w-full mt-6 p-3 bg-red-500/[0.02] border border-red-500/15 rounded-2xl flex items-center gap-2 text-[10px] font-mono text-red-400 text-left">
            <Lock className="w-4 h-4 shrink-0 text-red-500" />
            <span>Role status and HR credentials can only be edited by system administrators.</span>
          </div>
        </div>

        {/* Profile self-editing form */}
        <form onSubmit={handleUpdateProfile} className={`md:col-span-8 p-6 rounded-3xl border space-y-5 ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 pl-1">Mobile Phone</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none ${
                  theme === 'dark' ? 'bg-black/45 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                }`}
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 pl-1">Residential Address</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none ${
                  theme === 'dark' ? 'bg-black/45 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                }`}
              />
            </div>
          </div>

          {/* Photo File upload */}
          <div className="p-4 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5 pl-1">
              {t.photoLabel}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setPhotoFile(e.target.files[0]);
                }
              }}
              className="text-xs font-mono text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/15 file:text-cyan-400 file:cursor-pointer"
            />
          </div>

          {/* Emergency Contacts section */}
          <div className="p-4 border border-slate-200/50 dark:border-white/5 rounded-2xl space-y-3">
            <h4 className="text-xs font-mono uppercase text-cyan-400 tracking-wider pl-1">
              Emergency Contact / Экстренный Контакт
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1 pl-1">Contact Name</label>
                <input
                  type="text"
                  required
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className={`w-full p-2 border rounded-xl text-xs transition-all focus:outline-none ${
                    theme === 'dark' ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1 pl-1">Relationship</label>
                <input
                  type="text"
                  required
                  value={emergencyRelationship}
                  onChange={(e) => setEmergencyRelationship(e.target.value)}
                  className={`w-full p-2 border rounded-xl text-xs transition-all focus:outline-none ${
                    theme === 'dark' ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1 pl-1">Contact Phone</label>
                <input
                  type="tel"
                  required
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className={`w-full p-2 border rounded-xl text-xs transition-all focus:outline-none ${
                    theme === 'dark' ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-black font-semibold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] font-display uppercase tracking-wider cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{uploading ? 'Updating...' : t.saveBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
