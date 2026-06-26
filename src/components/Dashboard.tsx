import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { 
  Users, 
  Activity, 
  Briefcase, 
  FolderLock, 
  Bell, 
  TrendingUp, 
  Clock, 
  Building2, 
  UserCheck, 
  ChevronRight,
  Sparkles,
  Layers,
  LayoutDashboard
} from 'lucide-react';
import { Employee, UserProfile, LoginLog, CorporateNotification } from '../types';

interface DashboardProps {
  currentUid: string;
  theme: 'dark' | 'light';
  language: 'ru' | 'en';
}

export default function Dashboard({ currentUid, theme, language }: DashboardProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [notifs, setNotifs] = useState<CorporateNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const unsubscribeEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Employee);
      });
      setEmployees(list);
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data() } as UserProfile);
      });
      setUsers(list);
    });

    const unsubscribeLogs = onSnapshot(
      query(collection(db, 'login_logs'), orderBy('timestamp', 'desc'), limit(5)),
      (snapshot) => {
        const list: LoginLog[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as LoginLog);
        });
        setLogs(list);
      }
    );

    const unsubscribeNotifs = onSnapshot(
      query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(10)),
      (snapshot) => {
        const list: CorporateNotification[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as CorporateNotification);
        });
        setNotifs(list);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeEmployees();
      unsubscribeUsers();
      unsubscribeLogs();
      unsubscribeNotifs();
    };
  }, []);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        readBy: arrayUnion(currentUid)
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Group employee counts by department
  const deptStats = employees.reduce((acc: { [key: string]: number }, emp) => {
    const dept = emp.department || 'Other';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});

  // Group employee counts by role
  const roleStats = employees.reduce((acc: { [key: string]: number }, emp) => {
    const role = emp.role || 'employee';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  const totalEmployees = employees.length;
  const activeOnline = users.filter(u => u.status === 'online').length;

  const t = {
    title: language === 'ru' ? 'Главная Панель' : 'Analytical Control Center',
    subtitle: language === 'ru' ? 'Сводка состояния, оперативная активность и метрики QazaqGaz' : 'Real-time overview, system logins, audit metrics, and departments analytics',
    statTotal: language === 'ru' ? 'Штат сотрудников' : 'Total Employees',
    statActive: language === 'ru' ? 'Онлайн в системе' : 'Active Sessions',
    statDepts: language === 'ru' ? 'Всего департаментов' : 'Departments Count',
    deptDist: language === 'ru' ? 'Распределение по департаментам' : 'Headcount by Departments',
    roleDist: language === 'ru' ? 'Состав ролей сотрудников' : 'Roles Composition',
    recentActivity: language === 'ru' ? 'Последние логи входов' : 'Recent Auth Logs',
    corporateNotif: language === 'ru' ? 'Уведомления и События' : 'System Bulletins & Event Logs',
    markRead: language === 'ru' ? 'Прочитано' : 'Dismiss'
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div>
        <h2 className="text-xl font-display font-semibold flex items-center gap-2">
          <LayoutDashboard className="w-5.5 h-5.5 text-cyan-500" />
          <span>{t.title}</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
      </div>

      {/* Corporate Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total headcount */}
        <div className={`p-5 rounded-3xl border flex items-center justify-between transition-all ${
          theme === 'dark' ? 'bg-[#121620] border-white/5 shadow-md shadow-black/10' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider">{t.statTotal}</span>
            <span className="text-3xl font-display font-bold text-cyan-400 mt-1 block">{totalEmployees}</span>
            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">registered staff profiles</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Active Session counters */}
        <div className={`p-5 rounded-3xl border flex items-center justify-between transition-all ${
          theme === 'dark' ? 'bg-[#121620] border-white/5 shadow-md shadow-black/10' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider">{t.statActive}</span>
            <span className="text-3xl font-display font-bold text-emerald-400 mt-1 block">{activeOnline}</span>
            <span className="text-[10px] font-mono text-emerald-500/80 block mt-0.5 animate-pulse">● System online logs active</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Total Departments */}
        <div className={`p-5 rounded-3xl border flex items-center justify-between transition-all ${
          theme === 'dark' ? 'bg-[#121620] border-white/5 shadow-md shadow-black/10' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider">{t.statDepts}</span>
            <span className="text-3xl font-display font-bold text-purple-400 mt-1 block">
              {Object.keys(deptStats).length || 7}
            </span>
            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">active operational nodes</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Charts & Graphs Row (SVG dashboards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Headcount distribution card */}
        <div className={`p-5 rounded-3xl border flex flex-col justify-between ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <h3 className="font-display font-semibold text-sm tracking-wide mb-4 flex items-center gap-2">
            <Building2 className="w-4.5 h-4.5 text-cyan-400" />
            <span>{t.deptDist}</span>
          </h3>

          {totalEmployees === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-slate-500">No headcount files loaded</div>
          ) : (
            <div className="space-y-3 font-mono text-xs">
              {Object.entries(deptStats).map(([dept, count]) => {
                const percentage = Math.round((Number(count) / totalEmployees) * 100);
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>{dept}</span>
                      <span className="text-cyan-400">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-500/10 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Roles Composition (Pie style mockup or simplified metric cards) */}
        <div className={`p-5 rounded-3xl border flex flex-col justify-between ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <h3 className="font-display font-semibold text-sm tracking-wide mb-4 flex items-center gap-2">
            <Layers className="w-4.5 h-4.5 text-purple-400" />
            <span>{t.roleDist}</span>
          </h3>

          {totalEmployees === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-slate-500">No corporate users logged</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 font-mono text-center">
              {['admin', 'manager', 'employee'].map((role) => {
                const count = roleStats[role] || 0;
                const percentage = Math.round((count / totalEmployees) * 100) || 0;

                const getColors = (r: string) => {
                  if (r === 'admin') return 'text-red-400 bg-red-500/5 border-red-500/10';
                  if (r === 'manager') return 'text-amber-400 bg-amber-500/5 border-amber-500/10';
                  return 'text-cyan-400 bg-cyan-500/5 border-cyan-500/10';
                };

                return (
                  <div key={role} className={`p-3.5 rounded-2xl border ${getColors(role)}`}>
                    <span className="block text-[10px] font-bold uppercase tracking-wider">{role}</span>
                    <span className="text-2xl font-bold block mt-1.5">{count}</span>
                    <span className="block text-[9px] text-slate-400 mt-1">{percentage}% weight</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Notifications and recent logins panel split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Real-time system notifications log */}
        <div className={`xl:col-span-7 p-5 rounded-3xl border flex flex-col ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <h3 className="font-display font-semibold text-sm tracking-wide mb-4 flex items-center gap-2">
            <Bell className="w-4.5 h-4.5 text-yellow-400" />
            <span>{t.corporateNotif}</span>
          </h3>

          <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
            {notifs.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-slate-500">
                No active events logged in notification feed
              </div>
            ) : (
              notifs.map((item) => {
                const isRead = item.readBy?.includes(currentUid);
                return (
                  <div 
                    key={item.id} 
                    className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3.5 ${
                      isRead 
                        ? 'opacity-60 bg-black/5 border-white/5' 
                        : theme === 'dark' 
                          ? 'bg-cyan-500/[0.02] border-cyan-500/10 hover:border-cyan-500/20' 
                          : 'bg-cyan-50/30 border-cyan-100 hover:border-cyan-200 shadow-sm'
                    }`}
                  >
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <h4 className="font-semibold text-xs leading-none text-white">{item.title}</h4>
                      </div>
                      <p className="text-xs text-slate-300 font-sans">{item.message}</p>
                      <span className="block text-[9px] font-mono text-slate-500">
                        {new Date(item.timestamp).toLocaleString()} • {item.createdByEmail}
                      </span>
                    </div>

                    {!isRead && (
                      <button
                        onClick={() => handleMarkAsRead(item.id)}
                        className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1.5 rounded-xl border border-cyan-500/20 cursor-pointer transition-all active:scale-95"
                      >
                        {t.markRead}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Latest registered logins logs */}
        <div className={`xl:col-span-5 p-5 rounded-3xl border flex flex-col ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <h3 className="font-display font-semibold text-sm tracking-wide mb-4 flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 text-cyan-400" />
            <span>{t.recentActivity}</span>
          </h3>

          <div className="space-y-3.5 font-mono text-[11px]">
            {logs.length === 0 ? (
              <div className="py-12 text-center text-slate-500">No active login logs collected</div>
            ) : (
              logs.map((log) => (
                <div 
                  key={log.id} 
                  className={`p-3 rounded-2xl border ${
                    theme === 'dark' ? 'bg-black/25 border-white/5' : 'bg-slate-50 border-slate-100'
                  } flex items-center justify-between`}
                >
                  <div>
                    <span className="font-bold text-slate-300 block leading-tight">{log.name}</span>
                    <span className="text-[10px] text-slate-500 block">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    log.type === 'register' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  }`}>
                    {log.type}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
