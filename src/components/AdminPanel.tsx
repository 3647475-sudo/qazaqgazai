import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  ShieldAlert, 
  UserX, 
  UserCheck, 
  Search, 
  RefreshCw, 
  Activity, 
  Clock, 
  Monitor, 
  Globe,
  Database
} from 'lucide-react';
import { UserProfile, LoginLog } from '../types';

interface AdminPanelProps {
  currentUserEmail: string;
  theme: 'dark' | 'light';
  language: 'ru' | 'en';
}

export default function AdminPanel({ currentUserEmail, theme, language }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserLogs, setSelectedUserLogs] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserEmail !== '3647475@gmail.com' && currentUserEmail !== 'admin@astgas.kz') return;

    setLoading(true);

    // Dynamic real-time snapshot of users
    const unsubscribeUsers = onSnapshot(
      query(collection(db, 'users'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data() } as UserProfile);
        });
        setUsers(list);
      },
      (error) => console.error("Error subscribing to users:", error)
    );

    // Real-time snapshot of login logs
    const unsubscribeLogs = onSnapshot(
      query(collection(db, 'login_logs'), orderBy('timestamp', 'desc')),
      (snapshot) => {
        const list: LoginLog[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as LoginLog);
        });
        setLogs(list);
        setLoading(false);
      },
      (error) => console.error("Error subscribing to logs:", error)
    );

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, [currentUserEmail]);

  const handleToggleBlock = async (userId: string, currentBlocked: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        blocked: !currentBlocked
      });
    } catch (error) {
      console.error("Error toggling block status: ", error);
      alert("Error changing status: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'admin' | 'manager' | 'employee') => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole
      });
    } catch (error) {
      console.error("Error updating user role: ", error);
      alert("Error changing role: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  if (currentUserEmail !== '3647475@gmail.com' && currentUserEmail !== 'admin@astgas.kz') {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-red-400">Access Denied / Доступ ограничен</h3>
        <p className="text-xs text-gray-500 mt-2 font-mono">
          Only authorized system administrators can access this log dashboard.
        </p>
      </div>
    );
  }

  // Filtered users
  const filteredUsers = users.filter(user => 
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.role || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Active (online) users count
  const activeCount = users.filter(u => u.status === 'online').length;

  const t = {
    title: language === 'ru' ? 'Панель Системного Администратора' : 'System Administration Console',
    searchPlaceholder: language === 'ru' ? 'Поиск по имени, email, роли...' : 'Search by name, email, role...',
    statsActive: language === 'ru' ? 'Активные сессии' : 'Active sessions',
    statsTotal: language === 'ru' ? 'Всего пользователей' : 'Total accounts',
    statsLogs: language === 'ru' ? 'Записи журнала входов' : 'Auth logs registered',
    tblName: language === 'ru' ? 'Сотрудник' : 'Employee',
    tblRole: language === 'ru' ? 'Роль' : 'Role',
    tblStatus: language === 'ru' ? 'Статус' : 'Status',
    tblBlocked: language === 'ru' ? 'Доступ' : 'Access',
    tblActions: language === 'ru' ? 'Действия' : 'Actions',
    blockBtn: language === 'ru' ? 'Блокировать' : 'Block',
    unblockBtn: language === 'ru' ? 'Разблокировать' : 'Unblock',
    historyTitle: language === 'ru' ? 'Журнал входов сотрудников (login_logs)' : 'Employee Sign-In Logs (login_logs)',
    viewAllLogs: language === 'ru' ? 'Показать все' : 'Show all',
    onlyThisUser: language === 'ru' ? 'Фильтр по пользователю' : 'User Filter Active'
  };

  return (
    <div className="space-y-6">
      {/* Admin Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5.5 h-5.5 text-red-500" />
            <span>{t.title}</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">ADMIN EMAIL: {currentUserEmail}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>REAL-TIME ENGINE LIVE</span>
        </div>
      </div>

      {/* Admin Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 rounded-2xl border transition-all ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider">{t.statsActive}</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-display text-emerald-500">{activeCount}</span>
            <span className="text-xs text-slate-400">/ {users.length} online</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider">{t.statsTotal}</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-display text-cyan-400">{users.length}</span>
            <span className="text-xs text-slate-400">registered employees</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider">{t.statsLogs}</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-display text-purple-400">{logs.length}</span>
            <span className="text-xs text-slate-400">entries in database</span>
          </div>
        </div>
      </div>

      {/* Users Control & Database logs split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* User Account Registry (7 cols) */}
        <div className={`xl:col-span-7 p-5 rounded-2xl border transition-all flex flex-col ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <h3 className="font-display font-semibold text-sm tracking-wide">
              {language === 'ru' ? 'Управление учетными записями' : 'User Account Accounts Registry'}
            </h3>

            {/* Search inputs */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.searchPlaceholder}
                className={`pl-8 pr-3 py-1.5 w-full md:w-60 text-xs border rounded-xl font-mono focus:outline-none transition-all ${
                  theme === 'dark' 
                    ? 'bg-black/30 border-white/10 text-white placeholder-gray-600 focus:border-cyan-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-cyan-500'
                }`}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/50 dark:border-white/5 text-slate-400 font-mono">
                  <th className="pb-2.5 font-medium">{t.tblName}</th>
                  <th className="pb-2.5 font-medium">{t.tblRole}</th>
                  <th className="pb-2.5 font-medium">{t.tblStatus}</th>
                  <th className="pb-2.5 font-medium">{t.tblBlocked}</th>
                  <th className="pb-2.5 font-medium text-right">{t.tblActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50 dark:divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-mono">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                      Loading Database Records...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 font-mono">
                      No Accounts Found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr 
                      key={u.uid} 
                      className={`hover:bg-slate-500/5 transition-colors cursor-pointer ${
                        selectedUserLogs === u.uid ? 'bg-cyan-500/5' : ''
                      }`}
                      onClick={() => setSelectedUserLogs(selectedUserLogs === u.uid ? null : u.uid)}
                    >
                      <td className="py-3">
                        <div className="font-semibold">{u.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 font-mono" onClick={(e) => e.stopPropagation()}>
                        {u.email === '3647475@gmail.com' || u.email === 'admin@astgas.kz' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                            {u.role}
                          </span>
                        ) : (
                          <select
                            value={u.role || 'employee'}
                            onChange={(e) => handleChangeRole(u.uid, e.target.value as any)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase cursor-pointer border focus:outline-none transition-all ${
                              u.role === 'admin' 
                                ? 'bg-red-500/10 text-red-400 border-red-500/20 focus:border-red-500' 
                                : u.role === 'manager' 
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 focus:border-amber-500' 
                                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 focus:border-cyan-500'
                            }`}
                          >
                            <option value="employee" className="bg-[#121620] text-cyan-400">{language === 'ru' ? 'СОТРУДНИК' : 'EMPLOYEE'}</option>
                            <option value="manager" className="bg-[#121620] text-amber-400">{language === 'ru' ? 'МЕНЕДЖЕР' : 'MANAGER'}</option>
                            <option value="admin" className="bg-[#121620] text-red-400">{language === 'ru' ? 'АДМИН' : 'ADMIN'}</option>
                          </select>
                        )}
                      </td>
                      <td className="py-3">
                        <span className="flex items-center gap-1.5 font-mono text-[10px]">
                          <span className={`w-2 h-2 rounded-full ${
                            u.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'
                          }`} />
                          <span className={u.status === 'online' ? 'text-emerald-500' : 'text-slate-400'}>
                            {u.status === 'online' ? 'online' : 'offline'}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[10px]">
                        {u.blocked ? (
                          <span className="text-red-400 font-semibold uppercase">Blocked</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold uppercase">Active</span>
                        )}
                      </td>
                      <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {u.email === '3647475@gmail.com' || u.email === 'admin@astgas.kz' ? (
                          <span className="text-[10px] text-slate-500 font-mono">System Superadmin</span>
                        ) : (
                          <button
                            onClick={() => handleToggleBlock(u.uid, u.blocked)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 ml-auto cursor-pointer transition-all ${
                              u.blocked 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' 
                                : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                            }`}
                          >
                            {u.blocked ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>{t.unblockBtn}</span>
                              </>
                            ) : (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>{t.blockBtn}</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Login Logs Tracker (5 cols) */}
        <div className={`xl:col-span-5 p-5 rounded-2xl border transition-all flex flex-col ${
          theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm tracking-wide flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-purple-400" />
              <span>{t.historyTitle}</span>
            </h3>

            {selectedUserLogs && (
              <button
                onClick={() => setSelectedUserLogs(null)}
                className="text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-md hover:bg-cyan-500/20 transition-all cursor-pointer"
              >
                {t.viewAllLogs}
              </button>
            )}
          </div>

          {/* User Filtering indicator */}
          {selectedUserLogs && (
            <div className="p-2 mb-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl text-[10px] font-mono text-cyan-400 flex items-center justify-between">
              <span>{t.onlyThisUser}: {users.find(u => u.uid === selectedUserLogs)?.fullName}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </div>
          )}

          <div className="overflow-y-auto max-h-[350px] space-y-3 pr-1">
            {logs.filter(log => !selectedUserLogs || log.uid === selectedUserLogs).length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-mono">
                No logs recorded for this view
              </div>
            ) : (
              logs
                .filter(log => !selectedUserLogs || log.uid === selectedUserLogs)
                .map((log) => (
                  <div 
                    key={log.id} 
                    className={`p-3 rounded-xl border flex flex-col gap-1 text-[11px] font-mono transition-all ${
                      theme === 'dark' 
                        ? 'bg-black/20 border-white/5 hover:border-white/10' 
                        : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-500">{log.name}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        log.type === 'register' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : log.type === 'logout'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      }`}>
                        {log.type.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-slate-400 text-[10px] mt-1 flex flex-col gap-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span>IP: {log.ipAddress}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Monitor className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span className="truncate">{log.browser} ({log.device})</span>
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
