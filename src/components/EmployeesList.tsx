import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  Search, 
  Filter, 
  UserPlus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  User, 
  Plus, 
  Grid, 
  List, 
  Eye, 
  Briefcase, 
  ShieldCheck, 
  X,
  History,
  FileSpreadsheet
} from 'lucide-react';
import { Employee, UserRole } from '../types';

interface EmployeesListProps {
  currentRole: UserRole;
  currentUserEmail: string;
  theme: 'dark' | 'light';
  language: 'ru' | 'en';
}

const DEPARTMENTS = [
  'Management',
  'Engineering',
  'Human Resources',
  'Accounting & Finance',
  'Operations',
  'Logistics',
  'IT Support'
];

export default function EmployeesList({ currentRole, currentUserEmail, theme, language }: EmployeesListProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  
  // History Audit log state
  const [showHistory, setShowHistory] = useState<Employee | null>(null);

  // Form Fields State
  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [role, setRole] = useState<UserRole>('employee');
  const [salary, setSalary] = useState<number>(0);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'active' | 'vacation' | 'fired'>('active');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'employees'), orderBy('fullName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Employee);
      });
      setEmployees(list);
      setLoading(false);
    }, (err) => {
      console.error("Error subscribing to employees: ", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setSelectedEmployee(null);
    setEmployeeId(`EMP-${Math.floor(100 + Math.random() * 900)}`);
    setFullName('');
    setEmail('');
    setPhone('');
    setPosition('');
    setDepartment(DEPARTMENTS[0]);
    setRole('employee');
    setSalary(0);
    setDateOfBirth('');
    setHireDate(new Date().toISOString().split('T')[0]);
    setAddress('');
    setStatus('active');
    setEmergencyName('');
    setEmergencyPhone('');
    setEmergencyRelationship('');
    setPhotoFile(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsViewOnly(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee, viewOnly = false) => {
    setSelectedEmployee(emp);
    setEmployeeId(emp.employeeId || '');
    setFullName(emp.fullName || '');
    setEmail(emp.email || '');
    setPhone(emp.phone || '');
    setPosition(emp.position || '');
    setDepartment(emp.department || DEPARTMENTS[0]);
    setRole(emp.role || 'employee');
    setSalary(emp.salary || 0);
    setDateOfBirth(emp.dateOfBirth || '');
    setHireDate(emp.hireDate || '');
    setAddress(emp.address || '');
    setStatus(emp.status || 'active');
    setEmergencyName(emp.emergencyContact?.name || '');
    setEmergencyPhone(emp.emergencyContact?.phone || '');
    setEmergencyRelationship(emp.emergencyContact?.relationship || '');
    setPhotoFile(null);
    setIsViewOnly(viewOnly);
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm(language === 'ru' ? 'Вы уверены, что хотите удалить этого сотрудника?' : 'Are you sure you want to delete this employee?')) return;
    try {
      await deleteDoc(doc(db, 'employees', id));

      // Notification log
      await addDoc(collection(db, 'notifications'), {
        title: language === 'ru' ? 'Сотрудник удален' : 'Employee removed',
        message: language === 'ru' ? `Учетная запись сотрудника была удалена.` : `Employee record was removed.`,
        type: 'profile_change',
        timestamp: Date.now(),
        createdBy: currentRole,
        createdByEmail: currentUserEmail,
        readBy: []
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadProgress(true);

    try {
      let finalPhotoUrl = selectedEmployee ? selectedEmployee.photoUrl : '';

      // Upload photo to storage if exists
      if (photoFile) {
        const storageRef = ref(storage, `employees/${employeeId}_${Date.now()}_${photoFile.name}`);
        const uploadResult = await uploadBytes(storageRef, photoFile);
        finalPhotoUrl = await getDownloadURL(uploadResult.ref);
      }

      const emergencyContact = {
        name: emergencyName,
        phone: emergencyPhone,
        relationship: emergencyRelationship
      };

      const employeeData = {
        employeeId,
        fullName,
        photoUrl: finalPhotoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        email,
        phone,
        position,
        department,
        role,
        salary: Number(salary),
        dateOfBirth,
        hireDate,
        address,
        status,
        emergencyContact
      };

      if (selectedEmployee) {
        // Track change history
        const updatedHistory = [...(selectedEmployee.changeHistory || [])];
        const changesDesc = language === 'ru' 
          ? `Изменено пользователем ${currentUserEmail}` 
          : `Profile metadata modified by ${currentUserEmail}`;

        updatedHistory.push({
          id: `hist_${Date.now()}`,
          timestamp: Date.now(),
          updatedBy: currentRole,
          updatedByEmail: currentUserEmail,
          changes: changesDesc
        });

        await updateDoc(doc(db, 'employees', selectedEmployee.id), {
          ...employeeData,
          changeHistory: updatedHistory
        });

        // Add real-time notification
        await addDoc(collection(db, 'notifications'), {
          title: language === 'ru' ? 'Данные изменены' : 'Employee updated',
          message: language === 'ru' ? `Данные сотрудника ${fullName} обновлены.` : `Employee ${fullName}'s profile was updated.`,
          type: 'profile_change',
          timestamp: Date.now(),
          createdBy: currentRole,
          createdByEmail: currentUserEmail,
          readBy: []
        });

      } else {
        // Creating new employee
        const newHistory = [{
          id: `hist_${Date.now()}`,
          timestamp: Date.now(),
          updatedBy: currentRole,
          updatedByEmail: currentUserEmail,
          changes: language === 'ru' ? 'Сотрудник зарегистрирован в системе' : 'Initial system onboarding'
        }];

        await addDoc(collection(db, 'employees'), {
          ...employeeData,
          changeHistory: newHistory
        });

        // Add real-time notification
        await addDoc(collection(db, 'notifications'), {
          title: language === 'ru' ? 'Новый сотрудник' : 'New employee onboarded',
          message: language === 'ru' ? `В компанию зачислен новый сотрудник: ${fullName} (${position}).` : `New employee added: ${fullName} as ${position}.`,
          type: 'new_employee',
          timestamp: Date.now(),
          createdBy: currentRole,
          createdByEmail: currentUserEmail,
          readBy: []
        });
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      alert("Error saving: " + err.message);
    } finally {
      setUploadProgress(false);
    }
  };

  // Filters logic
  const filteredEmployees = employees.filter((emp) => {
    const matchSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        emp.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = deptFilter === 'All' || emp.department === deptFilter;
    const matchStatus = statusFilter === 'All' || emp.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const t = {
    title: language === 'ru' ? 'Реестр Сотрудников' : 'Corporate Employee Registry',
    searchPlaceholder: language === 'ru' ? 'Поиск сотрудников по имени, email, должности...' : 'Search by name, email, position...',
    addBtn: language === 'ru' ? 'Добавить сотрудника' : 'Add Employee',
    colId: language === 'ru' ? 'ID' : 'ID',
    colName: language === 'ru' ? 'ФИО / Контакты' : 'Name / Contact',
    colPos: language === 'ru' ? 'Должность / Отдел' : 'Position / Dept',
    colSalary: language === 'ru' ? 'Оклад (Admin)' : 'Salary (Admin)',
    colStatus: language === 'ru' ? 'Статус' : 'Status',
    colActions: language === 'ru' ? 'Действия' : 'Actions',
    active: language === 'ru' ? 'Активен' : 'Active',
    vacation: language === 'ru' ? 'В отпуске' : 'On Vacation',
    fired: language === 'ru' ? 'Уволен' : 'Fired',
    modalTitleCreate: language === 'ru' ? 'Оформление Нового Сотрудника' : 'Onboard New Employee',
    modalTitleEdit: language === 'ru' ? 'Редактирование профиля' : 'Edit Employee Profile',
    modalTitleView: language === 'ru' ? 'Личное дело сотрудника' : 'Employee Folder'
  };

  // Helper check for role restrictions
  const canEdit = currentRole === 'admin' || currentRole === 'manager';

  return (
    <div className="space-y-6">
      {/* Top action header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <Briefcase className="w-5.5 h-5.5 text-cyan-500" />
            <span>{t.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {language === 'ru' ? 'Управляйте данными персонала, ролями и окладами в один клик' : 'Manage corporate HR database, roles, schedules, and salaries.'}
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-black font-semibold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] font-display uppercase tracking-wider cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.addBtn}</span>
          </button>
        )}
      </div>

      {/* Filter and View toggles bar */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchPlaceholder}
            className={`pl-10 pr-4 py-2 w-full text-xs border rounded-xl font-mono focus:outline-none transition-all ${
              theme === 'dark' 
                ? 'bg-black/35 border-white/10 text-white placeholder-gray-600 focus:border-cyan-500' 
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-cyan-500'
            }`}
          />
        </div>

        {/* Filter Selection Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className={`p-1.5 text-xs font-mono border rounded-xl focus:outline-none cursor-pointer ${
                theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="All">{language === 'ru' ? 'Все отделы' : 'All Departments'}</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`p-1.5 text-xs font-mono border rounded-xl focus:outline-none cursor-pointer ${
              theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <option value="All">{language === 'ru' ? 'Все статусы' : 'All Statuses'}</option>
            <option value="active">{language === 'ru' ? 'Активен' : 'Active'}</option>
            <option value="vacation">{language === 'ru' ? 'В отпуске' : 'On Vacation'}</option>
            <option value="fired">{language === 'ru' ? 'Уволен' : 'Fired'}</option>
          </select>

          {/* Grid/Table togglers */}
          <div className={`flex items-center rounded-xl p-0.5 border ${
            theme === 'dark' ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-100'
          }`}>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' 
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-sm' 
                  : 'text-gray-400'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid' 
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-sm' 
                  : 'text-gray-400'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Employee List Layout */}
      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-slate-500">
          <History className="w-6 h-6 animate-spin mx-auto mb-3 text-cyan-400" />
          Synchronizing HR Registry Records...
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="py-20 text-center text-slate-500 text-xs font-mono">
          No employee documents found matching the filters.
        </div>
      ) : viewMode === 'table' ? (
        /* Table Mode */
        <div className={`overflow-x-auto border rounded-2xl ${
          theme === 'dark' ? 'bg-[#121620]/80 border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 text-slate-400 font-mono">
                <th className="p-4 font-medium">{t.colId}</th>
                <th className="p-4 font-medium">{t.colName}</th>
                <th className="p-4 font-medium">{t.colPos}</th>
                <th className="p-4 font-medium">{t.colSalary}</th>
                <th className="p-4 font-medium">{t.colStatus}</th>
                <th className="p-4 font-medium text-right">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-500/5 transition-colors">
                  <td className="p-4 font-mono font-semibold text-cyan-500">
                    {emp.employeeId}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={emp.photoUrl} 
                        alt={emp.fullName} 
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-white/15"
                      />
                      <div>
                        <div className="font-semibold text-sm">{emp.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{emp.email} • {emp.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold">{emp.position}</div>
                    <div className="text-[10px] text-slate-400 font-mono uppercase">{emp.department}</div>
                  </td>
                  <td className="p-4 font-mono font-semibold text-emerald-500">
                    {currentRole === 'admin' ? (
                      <span>${Number(emp.salary || 0).toLocaleString()}</span>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">🔐 Restricted</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                      emp.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : emp.status === 'vacation' 
                          ? 'bg-amber-500/10 text-amber-400' 
                          : 'bg-red-500/10 text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        emp.status === 'active' ? 'bg-emerald-400' : emp.status === 'vacation' ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                      {emp.status === 'active' ? t.active : emp.status === 'vacation' ? t.vacation : t.fired}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(emp, true)}
                        className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="View profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowHistory(emp)}
                        className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:text-white transition-all cursor-pointer"
                        title="View history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(emp, false)}
                            className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:text-white transition-all cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {currentRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => (
            <div 
              key={emp.id}
              className={`p-5 rounded-2xl border relative overflow-hidden flex flex-col justify-between transition-all group ${
                theme === 'dark' ? 'bg-[#121620] border-white/5 hover:border-cyan-500/35' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              <div>
                {/* Employee badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-md">
                    {emp.employeeId}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                    emp.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : emp.status === 'vacation' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {emp.status}
                  </span>
                </div>

                {/* Core Person Details */}
                <div className="flex items-center gap-3.5 mb-4">
                  <img 
                    src={emp.photoUrl} 
                    alt={emp.fullName} 
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-white/10 shrink-0"
                  />
                  <div className="overflow-hidden">
                    <h4 className="font-semibold text-sm truncate">{emp.fullName}</h4>
                    <p className="text-xs text-slate-400 truncate">{emp.position}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{emp.department}</p>
                  </div>
                </div>

                {/* Contact data list */}
                <div className="space-y-1 py-3 border-t border-b border-slate-200/40 dark:border-white/5 text-[11px] font-mono text-slate-400">
                  <div className="truncate">Email: <span className="text-gray-200">{emp.email}</span></div>
                  <div>Phone: <span className="text-gray-200">{emp.phone}</span></div>
                  {currentRole === 'admin' && (
                    <div className="text-emerald-500 font-semibold">
                      Salary: <span>${Number(emp.salary || 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Interaction Buttons row */}
              <div className="flex items-center justify-between gap-1.5 mt-4 pt-1">
                <button
                  onClick={() => setShowHistory(emp)}
                  className="text-[10px] font-mono text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>History</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEditModal(emp, true)}
                    className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => handleOpenEditModal(emp, false)}
                        className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:text-white transition-all cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {currentRole === 'admin' && (
                        <button
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit History Log Modal popup */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border p-6 overflow-hidden ${
            theme === 'dark' ? 'bg-[#0f1219] border-white/10' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 dark:border-white/5 mb-4">
              <h3 className="font-display font-semibold text-sm flex items-center gap-2 text-purple-400">
                <History className="w-4.5 h-4.5" />
                <span>Change History: {showHistory.fullName}</span>
              </h3>
              <button 
                onClick={() => setShowHistory(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 max-h-96 overflow-y-auto font-mono text-[11px] pr-1">
              {!showHistory.changeHistory || showHistory.changeHistory.length === 0 ? (
                <div className="text-center py-6 text-slate-500">No profile alterations recorded</div>
              ) : (
                showHistory.changeHistory.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border border-white/5 bg-black/10 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-cyan-400">By: {item.updatedByEmail} ({item.updatedBy})</span>
                      <span className="text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-300 text-xs font-sans mt-1">{item.changes}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Employee Drawer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className={`w-full max-w-2xl rounded-3xl border shadow-2xl p-6 md:p-8 relative ${
            theme === 'dark' ? 'bg-[#0f1219] border-cyan-500/20' : 'bg-white border-slate-200'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/50 dark:border-white/5">
              <h3 className="font-display font-semibold text-base flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                <span>
                  {isViewOnly ? t.modalTitleView : selectedEmployee ? t.modalTitleEdit : t.modalTitleCreate}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Employee ID */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Employee ID</label>
                  <input
                    type="text"
                    required
                    disabled
                    value={employeeId}
                    className={`w-full p-2.5 border rounded-xl text-xs font-mono bg-black/30 text-slate-400 border-white/5 focus:outline-none`}
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Full Name</label>
                  <input
                    type="text"
                    required
                    disabled={isViewOnly}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none ${
                      theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">E-mail</label>
                  <input
                    type="email"
                    required
                    disabled={isViewOnly}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@qazaqgaz.kz"
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none ${
                      theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Phone</label>
                  <input
                    type="tel"
                    required
                    disabled={isViewOnly}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 777 123 45 67"
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none ${
                      theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Position / Должность</label>
                  <input
                    type="text"
                    required
                    disabled={isViewOnly}
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Lead System Architect"
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none ${
                      theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                </div>

                {/* Department Select */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Department</label>
                  <select
                    disabled={isViewOnly}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none cursor-pointer ${
                      theme === 'dark' ? 'bg-[#0f1219] border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Corporate System Role assignment */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Corporate App Role</label>
                  <select
                    disabled={isViewOnly || currentRole !== 'admin'}
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none cursor-pointer ${
                      theme === 'dark' ? 'bg-[#0f1219] border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  >
                    <option value="employee">Employee (View only self)</option>
                    <option value="manager">Manager (Manage dept)</option>
                    <option value="admin">System Admin (Full rights)</option>
                  </select>
                </div>

                {/* Sensitive Salary input (Restricted visibility) */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Salary / Оклад (USD)</label>
                  {currentRole === 'admin' ? (
                    <input
                      type="number"
                      required
                      disabled={isViewOnly}
                      value={salary}
                      onChange={(e) => setSalary(Number(e.target.value))}
                      className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none font-mono ${
                        theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                      }`}
                    />
                  ) : (
                    <div className="w-full p-2.5 rounded-xl text-xs border border-white/5 bg-black/20 text-slate-500 italic font-mono flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>🔒 Restricted field (Admin-Only)</span>
                    </div>
                  )}
                </div>

                {/* Date of birth */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    disabled={isViewOnly}
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none font-mono ${
                      theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                </div>

                {/* Hire date */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Hire Date</label>
                  <input
                    type="date"
                    required
                    disabled={isViewOnly}
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none font-mono ${
                      theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                </div>

                {/* Status Selection */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Work Status</label>
                  <select
                    disabled={isViewOnly}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none cursor-pointer ${
                      theme === 'dark' ? 'bg-[#0f1219] border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  >
                    <option value="active">Active (Активен)</option>
                    <option value="vacation">On Vacation (В отпуске)</option>
                    <option value="fired">Fired (Уволен)</option>
                  </select>
                </div>

                {/* Home Address */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 pl-1">Residential Address</label>
                  <input
                    type="text"
                    required
                    disabled={isViewOnly}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Astana, Kazakhstan"
                    className={`w-full p-2.5 border rounded-xl text-xs transition-all focus:outline-none ${
                      theme === 'dark' ? 'bg-black/40 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                </div>
              </div>

              {/* Photo Upload section */}
              {!isViewOnly && (
                <div className="p-4 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 pl-1">
                    Upload Employee Avatar Photo (Optional)
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
              )}

              {/* Emergency Contact fields section */}
              <div className="p-4 border border-slate-200/50 dark:border-white/5 rounded-2xl space-y-3">
                <h4 className="text-xs font-mono uppercase text-cyan-400 tracking-wider pl-1">
                  Emergency Contact Details / Экстренный Контакт
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1 pl-1">Contact Name</label>
                    <input
                      type="text"
                      required
                      disabled={isViewOnly}
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Name"
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
                      disabled={isViewOnly}
                      value={emergencyRelationship}
                      onChange={(e) => setEmergencyRelationship(e.target.value)}
                      placeholder="Spouse / Parent / Sibling"
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
                      disabled={isViewOnly}
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="+7 777..."
                      className={`w-full p-2 border rounded-xl text-xs transition-all focus:outline-none ${
                        theme === 'dark' ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isViewOnly ? (language === 'ru' ? 'Закрыть' : 'Close') : (language === 'ru' ? 'Отмена' : 'Cancel')}
                </button>

                {!isViewOnly && (
                  <button
                    type="submit"
                    disabled={uploadProgress}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-black font-semibold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] font-display uppercase tracking-wider cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{uploadProgress ? 'Saving...' : (language === 'ru' ? 'Сохранить' : 'Save Details')}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
