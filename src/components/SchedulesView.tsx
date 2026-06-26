import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Trash2, 
  User, 
  Briefcase, 
  CheckCircle, 
  AlertCircle, 
  X,
  Palmtree,
  Activity,
  CalendarRange
} from 'lucide-react';
import { ScheduleEvent, Employee, UserRole } from '../types';

interface SchedulesViewProps {
  currentRole: UserRole;
  currentUserEmail: string;
  theme: 'dark' | 'light';
  language: 'ru' | 'en';
}

export default function SchedulesView({ currentRole, currentUserEmail, theme, language }: SchedulesViewProps) {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form Fields
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [eventType, setEventType] = useState<'shift' | 'weekend' | 'vacation' | 'sick_leave'>('shift');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setLoading(true);

    // Subscribe to schedules
    const unsubscribeSchedules = onSnapshot(
      query(collection(db, 'schedules'), orderBy('startDate', 'asc')),
      (snapshot) => {
        const list: ScheduleEvent[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as ScheduleEvent);
        });
        setEvents(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to schedules: ", error);
        setLoading(false);
      }
    );

    // Subscribe to employees for selection dropdown
    const unsubscribeEmployees = onSnapshot(
      query(collection(db, 'employees'), orderBy('fullName', 'asc')),
      (snapshot) => {
        const list: Employee[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Employee);
        });
        setEmployees(list);
      }
    );

    return () => {
      unsubscribeSchedules();
      unsubscribeEmployees();
    };
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedEmpId) {
      setErrorMsg(language === 'ru' ? 'Пожалуйста, выберите сотрудника' : 'Please select an employee');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg(language === 'ru' ? 'Выберите даты' : 'Please fill in both dates');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setErrorMsg(language === 'ru' ? 'Начальная дата не может быть больше конечной' : 'Start date must be before end date');
      return;
    }

    try {
      const matchedEmp = employees.find(emp => emp.id === selectedEmpId);
      const employeeName = matchedEmp ? matchedEmp.fullName : 'Unknown Employee';

      await addDoc(collection(db, 'schedules'), {
        employeeId: selectedEmpId,
        employeeName,
        type: eventType,
        startDate,
        endDate,
        description,
        approvedBy: currentUserEmail,
        createdAt: Date.now()
      });

      // Notify about schedule update
      await addDoc(collection(db, 'notifications'), {
        title: language === 'ru' ? 'График обновлен' : 'Schedule Assigned',
        message: language === 'ru' ? `Добавлен новый график (${eventType}) для ${employeeName}.` : `New scheduling log (${eventType}) assigned to ${employeeName}.`,
        type: 'profile_change',
        timestamp: Date.now(),
        createdBy: currentRole,
        createdByEmail: currentUserEmail,
        readBy: []
      });

      setIsModalOpen(false);
      setSelectedEmpId('');
      setDescription('');
      setStartDate('');
      setEndDate('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm(language === 'ru' ? 'Удалить эту запись из календаря?' : 'Remove this schedule record?')) return;
    try {
      await deleteDoc(doc(db, 'schedules', id));
    } catch (err) {
      console.error(err);
    }
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'shift': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      case 'weekend': return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      case 'vacation': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'sick_leave': return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'shift': return <Clock className="w-3.5 h-3.5" />;
      case 'weekend': return <CalendarIcon className="w-3.5 h-3.5" />;
      case 'vacation': return <Palmtree className="w-3.5 h-3.5" />;
      case 'sick_leave': return <Activity className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const canEdit = currentRole === 'admin' || currentRole === 'manager';

  const t = {
    title: language === 'ru' ? 'Планирование Графиков и Смен' : 'Operations Schedule & Calendars',
    subtitle: language === 'ru' ? 'Рабочие смены, плановые отпуска и больничные листы персонала' : 'Manage corporate working shifts, vacations, leaves, and emergency schedules',
    addBtn: language === 'ru' ? 'Запланировать смену' : 'Schedule Shift Event',
    colEmp: language === 'ru' ? 'Сотрудник' : 'Employee',
    colType: language === 'ru' ? 'Тип Смены' : 'Event Type',
    colDates: language === 'ru' ? 'Даты проведения' : 'Assigned Dates',
    colDesc: language === 'ru' ? 'Комментарии' : 'Shift Context',
    colApproved: language === 'ru' ? 'Кем утверждено' : 'Approved By',
    colActions: language === 'ru' ? 'Действия' : 'Actions',
    modalTitle: language === 'ru' ? 'Запланировать Событие' : 'Onboard Schedule Event',
    formEmp: language === 'ru' ? 'Сотрудник' : 'Employee selection',
    formType: language === 'ru' ? 'Тип События' : 'Event Type',
    formStart: language === 'ru' ? 'Дата начала' : 'Start Date',
    formEnd: language === 'ru' ? 'Дата окончания' : 'End Date',
    formDesc: language === 'ru' ? 'Описание / Комментарий' : 'Optional notes',
  };

  return (
    <div className="space-y-6">
      {/* Top action header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <CalendarRange className="w-5.5 h-5.5 text-cyan-500" />
            <span>{t.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        {canEdit && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-black font-semibold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] font-display uppercase tracking-wider cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addBtn}</span>
          </button>
        )}
      </div>

      {/* Shared schedule log table */}
      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-slate-500">
          <Clock className="w-6 h-6 animate-spin mx-auto mb-3 text-cyan-400" />
          Loading calendar shifts database...
        </div>
      ) : events.length === 0 ? (
        <div className="py-20 text-center text-slate-500 text-xs font-mono">
          No schedules or vacation events assigned yet.
        </div>
      ) : (
        <div className={`overflow-x-auto border rounded-2xl ${
          theme === 'dark' ? 'bg-[#121620]/80 border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 text-slate-400 font-mono">
                <th className="p-4 font-medium">{t.colEmp}</th>
                <th className="p-4 font-medium">{t.colType}</th>
                <th className="p-4 font-medium">{t.colDates}</th>
                <th className="p-4 font-medium">{t.colDesc}</th>
                <th className="p-4 font-medium">{t.colApproved}</th>
                {canEdit && <th className="p-4 font-medium text-right">{t.colActions}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-500/5 transition-colors">
                  <td className="p-4 font-sans font-semibold text-white">
                    {ev.employeeName}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase ${getEventBadgeClass(ev.type)}`}>
                      {getEventIcon(ev.type)}
                      <span>{ev.type.replace('_', ' ')}</span>
                    </span>
                  </td>
                  <td className="p-4 text-xs text-slate-300">
                    {new Date(ev.startDate).toLocaleDateString()} - {new Date(ev.endDate).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-slate-400 truncate max-w-xs font-sans">
                    {ev.description || '—'}
                  </td>
                  <td className="p-4 text-[10px] text-slate-400">
                    {ev.approvedBy || 'System'}
                  </td>
                  {canEdit && (
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                        title="Delete scheduling"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 relative ${
            theme === 'dark' ? 'bg-[#0f1219] border-cyan-500/20' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200/50 dark:border-white/5">
              <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                <CalendarIcon className="w-4.5 h-4.5 text-cyan-400" />
                <span>{t.modalTitle}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4">
              {/* Employee list */}
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1.5 pl-1">{t.formEmp}</label>
                <select
                  required
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none cursor-pointer ${
                    theme === 'dark' ? 'bg-[#0f1219] border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                  }`}
                >
                  <option value="">{language === 'ru' ? 'Выберите сотрудника' : '-- Select Employee --'}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.position})</option>
                  ))}
                </select>
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1.5 pl-1">{t.formType}</label>
                <select
                  required
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as any)}
                  className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none cursor-pointer ${
                    theme === 'dark' ? 'bg-[#0f1219] border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                  }`}
                >
                  <option value="shift">Shift / Рабочая смена</option>
                  <option value="weekend">Weekend / Выходной</option>
                  <option value="vacation">Vacation / Ежегодный Отпуск</option>
                  <option value="sick_leave">Sick Leave / Больничный</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1.5 pl-1">{t.formStart}</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none font-mono ${
                      theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1.5 pl-1">{t.formEnd}</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none font-mono ${
                      theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1.5 pl-1">{t.formDesc}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="E.g., Night shift shift log metadata..."
                  rows={3}
                  className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none ${
                    theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                  }`}
                />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3.5 pt-4 border-t border-slate-200/50 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {language === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-black font-semibold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] font-display uppercase tracking-wider cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{language === 'ru' ? 'Создать' : 'Submit Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
