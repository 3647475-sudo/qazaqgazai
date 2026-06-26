import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Plus, 
  Check, 
  Layers, 
  Hourglass, 
  Activity, 
  Zap, 
  Bookmark,
  Trash2,
  Edit2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckSquare,
  BarChart2,
  CheckCircle,
  X,
  AlertCircle,
  Clock,
  ArrowRight,
  Settings
} from 'lucide-react';
import { Reminder, Alarm } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import EngineeringPlannerAgent from './EngineeringPlannerAgent';

// Core TypeScript interfaces matching our upgraded Microsoft Planner-like Board
interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface PlannerTask {
  id: string;
  title: string;
  description: string;
  bucketId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  checklist: ChecklistItem[];
  startDate?: string;
  dueDate?: string;
  progress: number; // calculated 0 to 100 based on checklist items
}

interface PlannerBucket {
  id: string;
  name: string;
}

interface GeneratedBoard {
  buckets: string[];
  tasks: Array<{
    title: string;
    description: string;
    bucketName: string;
    priority: string;
    checklist: string[];
    durationDays: number;
  }>;
  motivation: string;
  efficiencyScore: number;
}

interface PlannerAgentProps {
  language: string;
  onAddReminder: (text: string, time?: string) => void;
  onAddAlarm: (time: string, label: string) => void;
  reminders: Reminder[];
  alarms: Alarm[];
  onLogHabit: (action: string, category: 'alarm' | 'reminder' | 'cmd' | 'chat', meta?: string) => void;
  addSystemLogMessage: (content: string, type: 'info' | 'success' | 'danger') => void;
  speakText: (text: string) => void;
  currentUser?: any;
}

export default function PlannerAgent({
  language,
  onAddReminder,
  onAddAlarm,
  reminders,
  alarms,
  onLogHabit,
  addSystemLogMessage,
  speakText,
  currentUser
}: PlannerAgentProps) {
  // --- STATE FOR BOARD PERSISTENCE ---
  const [buckets, setBuckets] = useState<PlannerBucket[]>([]);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  
  // --- UI CONTROLS ---
  const [groupBy, setGroupBy] = useState<'bucket' | 'priority' | 'progress'>('bucket');
  const [isGenerating, setIsGenerating] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [aiPromptResponse, setAiPromptResponse] = useState<GeneratedBoard | null>(null);
  
  // Custom Inline Task Creator State
  const [inlineTaskInput, setInlineTaskInput] = useState<{[bucketId: string]: string}>({});
  
  // Modal / Detailed Task Editor State
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [newChecklistItemText, setNewChecklistItemText] = useState('');
  
  // Bucket Creator State
  const [newBucketName, setNewBucketName] = useState('');
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [showEngineeringPlanner, setShowEngineeringPlanner] = useState(false);

  const isKazakh = language === 'kk-KZ';
  const isRussian = language === 'ru-RU';

  // --- PRELOAD DEFAULT DATA IF NONE EXISTS IN LOCAL STORAGE OR FIRESTORE ---
  useEffect(() => {
    if (currentUser) return; // Managed by Firestore effect below

    const cachedBuckets = localStorage.getItem('jarvis_planner_buckets');
    const cachedTasks = localStorage.getItem('jarvis_planner_tasks');

    let initialBuckets: PlannerBucket[] = [];
    let initialTasks: PlannerTask[] = [];

    if (cachedBuckets) {
      try {
        initialBuckets = JSON.parse(cachedBuckets);
      } catch (_) {
        initialBuckets = [];
      }
    }

    if (cachedTasks) {
      try {
        initialTasks = JSON.parse(cachedTasks);
      } catch (_) {
        initialTasks = [];
      }
    }

    // Default Fallback Buckets (Microsoft Planner style tailored for JARVIS)
    if (initialBuckets.length === 0) {
      initialBuckets = [
        { id: 'bucket-research', name: isKazakh ? 'QAZAQGAS ЗЕРТТЕУІ' : isRussian ? 'АНАЛИТИКА QAZAQGAS' : 'QAZAQGAS SOURCING' },
        { id: 'bucket-dev', name: isKazakh ? 'БЕЛСЕНДІ ӘЗІРЛЕУ' : isRussian ? 'РАЗРАБОТКА И СБОРКА' : 'TACTICAL FABRICATION' },
        { id: 'bucket-calibration', name: isKazakh ? 'КАЛИБРЛЕУ ЖӘНЕ ДЕПЛОЙ' : isRussian ? 'КАЛИБРОВКА И ТЕСТ' : 'SYSTEM DEPLOYMENT' }
      ];
    }

    // Default Fallback Tasks
    if (initialTasks.length === 0) {
      initialTasks = [
        {
          id: 'task-1',
          title: isKazakh ? 'Доғалық реактордың қуатын оңтайландыру' : isRussian ? 'Синтез нового изотопа для реактора' : 'Palladium core isotope synthesis',
          description: isKazakh ? 'Оңтайлы тұрақтылық үшін изотоптарды калибрлеу' : isRussian ? 'Сбалансировать ячейки питания и провести тепловые замеры в доках' : 'Analyze palladium deterioration indices and run thermal diagnostic cycles.',
          bucketId: 'bucket-research',
          priority: 'critical',
          checklist: [
            { id: 'check-1-1', text: isKazakh ? 'Изотоптарды есептеу' : isRussian ? 'Вычислить деградацию изотопов' : 'Calculate half-life curve', completed: true },
            { id: 'check-1-2', text: isKazakh ? 'Суыту деңгейін тексеру' : isRussian ? 'Проверить контур охлаждения' : 'Check containment shield pressure', completed: false }
          ],
          startDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
          progress: 50
        },
        {
          id: 'task-2',
          title: isKazakh ? 'Марк 85 ұшу тұрақтандырғышы' : isRussian ? 'Полетная калибровка Марк-85' : 'Mark 85 thruster synchronization',
          description: isKazakh ? 'Импульстік қозғалтқыштарды теңестіру' : isRussian ? 'Настройка векторов тяги и синхронизация сервоприводов крыльев' : 'Optimize pitch & yaw response vectors. Run fluid dynamic simulations.',
          bucketId: 'bucket-dev',
          priority: 'high',
          checklist: [
            { id: 'check-2-1', text: isKazakh ? 'Сервоқозғалтқыштарды жүктеу' : isRussian ? 'Запустить сервоприводы' : 'Run micro-actuator sweep tests', completed: false },
            { id: 'check-2-2', text: isKazakh ? 'Резервтік қуатты орнату' : isRussian ? 'Подключить резервные батареи' : 'Verify secondary cell handover', completed: false }
          ],
          startDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
          progress: 0
        },
        {
          id: 'task-3',
          title: isKazakh ? 'Нейрондық интерфейсті сынау' : isRussian ? 'Тесты нейроинтерфейса' : 'Neural firewall deployment',
          description: isKazakh ? 'Қауіпсіздік брандмауэрін іске қосу' : isRussian ? 'Провести стресс-тестирование шлюзов JARVIS против вторжений' : 'Run penetration sandbox runs to stress-test J.A.R.V.I.S. security core.',
          bucketId: 'bucket-calibration',
          priority: 'medium',
          checklist: [
            { id: 'check-3-1', text: isKazakh ? 'Қауіпсіз порттарды ашу' : isRussian ? 'Активировать шлюзы шифрования' : 'Initialize cryptographic handshakes', completed: true },
            { id: 'check-3-2', text: isKazakh ? 'Сынақ хаттамаларын аяқтау' : isRussian ? 'Завершить симуляцию взлома' : 'Complete sandbox intrusion runs', completed: true }
          ],
          startDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
          progress: 100
        }
      ];
    }

    setBuckets(initialBuckets);
    setTasks(initialTasks);
  }, [language, currentUser]);

  // --- FIRESTORE REAL-TIME SYNCHRONIZATION ---
  useEffect(() => {
    if (!currentUser) return;
    const pathBuckets = `users/${currentUser.uid}/plannerBuckets`;
    const pathTasks = `users/${currentUser.uid}/plannerTasks`;

    const unsubscribeBuckets = onSnapshot(collection(db, pathBuckets), async (snapshot) => {
      const items: PlannerBucket[] = [];
      snapshot.forEach((doc) => {
        items.push(doc.data() as PlannerBucket);
      });
      if (items.length > 0) {
        setBuckets(items);
      } else {
        // Create default buckets if not present in Firestore
        const defaultBuckets = [
          { id: 'bucket-research', name: isKazakh ? 'QAZAQGAS ЗЕРТТЕУІ' : isRussian ? 'АНАЛИТИКА QAZAQGAS' : 'QAZAQGAS SOURCING' },
          { id: 'bucket-dev', name: isKazakh ? 'БЕЛСЕНДІ ӘЗІРЛЕУ' : isRussian ? 'РАЗРАБОТКА И СБОРКА' : 'TACTICAL FABRICATION' },
          { id: 'bucket-calibration', name: isKazakh ? 'КАЛИБРЛЕУ ЖӘНЕ ДЕПЛОЙ' : isRussian ? 'КАЛИБРОВКА И ТЕСТ' : 'SYSTEM DEPLOYMENT' }
        ];
        for (const b of defaultBuckets) {
          try {
            await setDoc(doc(db, pathBuckets, b.id), b);
          } catch (_) {}
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, pathBuckets);
    });

    const unsubscribeTasks = onSnapshot(collection(db, pathTasks), async (snapshot) => {
      const items: PlannerTask[] = [];
      snapshot.forEach((doc) => {
        items.push(doc.data() as PlannerTask);
      });
      if (items.length > 0) {
        setTasks(items);
      } else {
        // Create default tasks if not present in Firestore
        const defaultTasks = [
          {
            id: 'task-1',
            title: isKazakh ? 'Доғалық реактордың қуатын оңтайландыру' : isRussian ? 'Синтез нового изотопа для реактора' : 'Palladium core isotope synthesis',
            description: isKazakh ? 'Оңтайлы тұрақтылық үшін изотоптарды калибрлеу' : isRussian ? 'Сбалансировать ячейки питания и провести тепловые замеры в доках' : 'Analyze palladium deterioration indices and run thermal diagnostic cycles.',
            bucketId: 'bucket-research',
            priority: 'critical',
            checklist: [
              { id: 'check-1-1', text: isKazakh ? 'Изотоптарды есептеу' : isRussian ? 'Вычислить деградацию изотопов' : 'Calculate half-life curve', completed: true },
              { id: 'check-1-2', text: isKazakh ? 'Суыту деңгейін тексеру' : isRussian ? 'Проверить контур охлаждения' : 'Check containment shield pressure', completed: false }
            ],
            startDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
            progress: 50
          }
        ];
        for (const t of defaultTasks) {
          try {
            await setDoc(doc(db, pathTasks, t.id), t);
          } catch (_) {}
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, pathTasks);
    });

    return () => {
      unsubscribeBuckets();
      unsubscribeTasks();
    };
  }, [currentUser, language]);

  // Save changes to LocalStorage whenever buckets/tasks modify (offline fallback only)
  useEffect(() => {
    if (currentUser) return;
    if (buckets.length > 0) {
      localStorage.setItem('jarvis_planner_buckets', JSON.stringify(buckets));
    }
  }, [buckets, currentUser]);

  useEffect(() => {
    if (currentUser) return;
    if (tasks.length > 0) {
      localStorage.setItem('jarvis_planner_tasks', JSON.stringify(tasks));
    }
  }, [tasks, currentUser]);

  // Generic write helpers for dual local / Cloud synchronization
  const writeTask = async (task: PlannerTask) => {
    if (currentUser) {
      const path = `users/${currentUser.uid}/plannerTasks`;
      try {
        await setDoc(doc(db, path, task.id), task);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `${path}/${task.id}`);
      }
    } else {
      setTasks(prev => {
        const updated = prev.map(t => t.id === task.id ? task : t);
        if (!prev.some(t => t.id === task.id)) {
          updated.push(task);
        }
        localStorage.setItem('jarvis_planner_tasks', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const removeTask = async (taskId: string) => {
    if (currentUser) {
      const path = `users/${currentUser.uid}/plannerTasks`;
      try {
        await deleteDoc(doc(db, path, taskId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `${path}/${taskId}`);
      }
    } else {
      setTasks(prev => {
        const filtered = prev.filter(t => t.id !== taskId);
        localStorage.setItem('jarvis_planner_tasks', JSON.stringify(filtered));
        return filtered;
      });
    }
  };

  const writeBucket = async (bucket: PlannerBucket) => {
    if (currentUser) {
      const path = `users/${currentUser.uid}/plannerBuckets`;
      try {
        await setDoc(doc(db, path, bucket.id), bucket);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `${path}/${bucket.id}`);
      }
    } else {
      setBuckets(prev => {
        const updated = [...prev, bucket];
        localStorage.setItem('jarvis_planner_buckets', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const removeBucket = async (bucketId: string) => {
    if (currentUser) {
      const pathB = `users/${currentUser.uid}/plannerBuckets`;
      const pathT = `users/${currentUser.uid}/plannerTasks`;
      try {
        await deleteDoc(doc(db, pathB, bucketId));
        const associated = tasks.filter(t => t.bucketId === bucketId);
        for (const t of associated) {
          await deleteDoc(doc(db, pathT, t.id));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `${pathB}/${bucketId}`);
      }
    } else {
      setBuckets(prev => {
        const filtered = prev.filter(b => b.id !== bucketId);
        localStorage.setItem('jarvis_planner_buckets', JSON.stringify(filtered));
        return filtered;
      });
      setTasks(prev => {
        const filtered = prev.filter(t => t.bucketId !== bucketId);
        localStorage.setItem('jarvis_planner_tasks', JSON.stringify(filtered));
        return filtered;
      });
    }
  };

  // Helper to compute progress from checklist state
  const recalculateTaskProgress = (checklist: ChecklistItem[]): number => {
    if (checklist.length === 0) return 0;
    const completed = checklist.filter(item => item.completed).length;
    return Math.round((completed / checklist.length) * 100);
  };

  // --- CORE MUTATIONS ---

  // Adds a manual task to a specific bucket
  const handleAddManualTask = (bucketId: string) => {
    const text = inlineTaskInput[bucketId];
    if (!text || !text.trim()) return;

    const newTask: PlannerTask = {
      id: `task-${Date.now()}`,
      title: text.trim(),
      description: isKazakh ? 'Жаңадан құрылған стәрк тактикалық тапсырмасы.' : isRussian ? 'Создано вручную через тактическую панель.' : 'Custom tactical objective added via J.A.R.V.I.S. controller.',
      bucketId: bucketId,
      priority: 'medium',
      checklist: [],
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      progress: 0
    };

    writeTask(newTask);
    setInlineTaskInput(prev => ({ ...prev, [bucketId]: '' }));
    
    addSystemLogMessage(`Planner: Added task "${newTask.title}"`, 'success');
    onLogHabit(`Added custom task: ${newTask.title.substring(0, 15)}`, 'reminder');
  };

  // Delete task completely
  const handleDeleteTask = (taskId: string) => {
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;

    removeTask(taskId);
    addSystemLogMessage(`Planner: Removed task "${target.title}"`, 'info');
    onLogHabit(`Deleted task: ${target.title.substring(0, 15)}`, 'cmd');
    
    if (editingTask?.id === taskId) {
      setEditingTask(null);
    }
  };

  // Move task to another bucket
  const handleMoveTaskBucket = async (taskId: string, direction: 'left' | 'right' | string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let nextBucketId = task.bucketId;
    if (direction === 'left' || direction === 'right') {
      const currentIdx = buckets.findIndex(b => b.id === task.bucketId);
      if (direction === 'left' && currentIdx > 0) {
        nextBucketId = buckets[currentIdx - 1].id;
      } else if (direction === 'right' && currentIdx < buckets.length - 1) {
        nextBucketId = buckets[currentIdx + 1].id;
      }
    } else {
      nextBucketId = direction;
    }

    if (nextBucketId !== task.bucketId) {
      onLogHabit(`Moved task to bucket: ${nextBucketId}`, 'cmd');
      await writeTask({ ...task, bucketId: nextBucketId });
    }
  };

  // Toggle checklist item checkbox directly from card or editor
  const handleToggleChecklistItem = async (taskId: string, itemId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedChecklist = task.checklist.map(item => {
      if (item.id === itemId) return { ...item, completed: !item.completed };
      return item;
    });

    const updatedProgress = recalculateTaskProgress(updatedChecklist);

    // If a task is fully checked off, give system notifications
    if (updatedProgress === 100 && task.progress < 100) {
      speakText(isKazakh ? `Тапсырма орындалды сэр: ${task.title}` : isRussian ? `Задача полностью завершена, сэр: ${task.title}` : `Objective fully secured, sir: ${task.title}`);
      addSystemLogMessage(`Completed objective: ${task.title}`, 'success');
      onLogHabit(`Completed task checklist: ${task.title.substring(0, 15)}`, 'reminder');
    }

    const updatedTask = {
      ...task,
      checklist: updatedChecklist,
      progress: updatedProgress
    };

    await writeTask(updatedTask);

    // Update active editing modal state too
    if (editingTask && editingTask.id === taskId) {
      setEditingTask(updatedTask);
    }
  };

  // Add custom bucket manually
  const handleCreateBucket = () => {
    if (!newBucketName.trim()) return;
    const newId = `bucket-${Date.now()}`;
    const newB = { id: newId, name: newBucketName.toUpperCase().trim() };
    writeBucket(newB);
    setNewBucketName('');
    setShowAddBucket(false);
    addSystemLogMessage(`Planner: Created bucket "${newBucketName}"`, 'success');
  };

  // Delete a bucket and its contents
  const handleDeleteBucket = (bucketId: string) => {
    const bucketName = buckets.find(b => b.id === bucketId)?.name;
    removeBucket(bucketId);
    addSystemLogMessage(`Planner: Removed bucket "${bucketName || ''}" and its associated objectives.`, 'danger');
  };

  // --- SYSTEM LOGS & CALENDAR EXPORTS ---

  // Push planner task as reminder to primary J.A.R.V.I.S scheduler
  const handleExportTaskToScheduler = (task: PlannerTask) => {
    const dueTime = task.dueDate ? `${task.dueDate} 18:00` : undefined;
    onAddReminder(`${isKazakh ? 'ЖОСПАР' : isRussian ? 'ПЛАН' : 'PLAN'}: ${task.title}`, dueTime);
    addSystemLogMessage(`Exported objective "${task.title}" to active scheduler.`, 'success');
    onLogHabit(`Exported planner task to schedules: ${task.title.substring(0, 15)}`, 'reminder');
  };

  // --- AI GENERATION WITH GEMINI INTEGRATION ---
  const handleGenerateAiPlannerBoard = async () => {
    if (!goalInput.trim()) return;

    setIsGenerating(true);
    setAiPromptResponse(null);
    onLogHabit(`AI Planner Board dispatching: ${goalInput.substring(0, 30)}`, 'cmd');

    try {
      const res = await fetch('/api/gemini/generate-planner-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalInput,
          language: language
        })
      });

      if (!res.ok) throw new Error("Planner board generator endpoint failed");
      const data = await res.json();
      setAiPromptResponse(data);
      
      const welcomeSpeech = data.motivation || "Tactical roadmap computed, sir.";
      speakText(welcomeSpeech);
      addSystemLogMessage(`AI Copilot Planner: Constructed project structure with ${data.buckets?.length || 0} buckets and ${data.tasks?.length || 0} checklist items.`, 'success');
    } catch (e) {
      console.error(e);
      addSystemLogMessage("AI Planner board engine limits reached. Directing local tactical matrix fallback.", "info");
      
      // Fallback board mapping
      const fallback: GeneratedBoard = {
        buckets: isKazakh 
          ? ["Бастапқы талдау", "Орындау және кодтау", "Қабылдап сынау"]
          : isRussian 
            ? ["Анализ и Подготовка", "Кодинг и Сборка", "Тестирование шлюзов"] 
            : ["Phase 1: Blueprint Sourcing", "Phase 2: Fabrication", "Phase 3: Deep Systems Test"],
        tasks: [
          {
            title: isKazakh ? "Жоба деректерін зерттеу" : isRussian ? "Анализ векторов и сборка схемы" : "Assemble initial framework assets",
            description: isKazakh ? "Жобаның негізгі кілттерін зерттеу" : isRussian ? "Вычисление температур плавления, сборка и калибровка первичной шины данных." : "Check bandwidth buffers, review hardware interface hooks.",
            bucketName: isKazakh ? "Бастапқы талдау" : isRussian ? "Анализ и Подготовка" : "Phase 1: Blueprint Sourcing",
            priority: "high",
            checklist: ["Check dependencies", "Build initial schema definition"],
            durationDays: 2
          },
          {
            title: isKazakh ? "Тестілеу жұмыстары" : isRussian ? "Тестирование ядра безопасности" : "Stress test system ports",
            description: isKazakh ? "Соңғы тексеру жүйесі" : isRussian ? "Разгон брандмауэра и проведение защитных симуляций локального узла." : "Verify zero-leak data tunnels under high load triggers.",
            bucketName: isKazakh ? "Қабылдап сынау" : isRussian ? "Тестирование шлюзов" : "Phase 3: Deep Systems Test",
            priority: "critical",
            checklist: ["Validate encryption keys", "Confirm cold-storage backups"],
            durationDays: 4
          }
        ],
        motivation: isKazakh ? "Доғалы реактор дайын, сэр." : isRussian ? "Сетка тактической работы развернута локально для стабильности, сэр." : "The blueprint algorithms compiled natively. Deploying the task containers for your review.",
        efficiencyScore: 95
      };
      setAiPromptResponse(fallback);
      speakText(fallback.motivation);
    } finally {
      setIsGenerating(false);
    }
  };

  // Confirms the generated board and merges into local state
  const handleDeployGeneratedBoard = (replaceCurrent: boolean) => {
    if (!aiPromptResponse) return;

    // Convert buckets
    const generatedBuckets: PlannerBucket[] = aiPromptResponse.buckets.map((bName, i) => ({
      id: `ai-bucket-${i}-${Date.now()}`,
      name: bName.toUpperCase()
    }));

    // Convert tasks
    const generatedTasks: PlannerTask[] = aiPromptResponse.tasks.map((t, idx) => {
      // Find matching bucket id
      const matchedBucket = generatedBuckets.find(b => b.name === t.bucketName.toUpperCase()) || generatedBuckets[0];
      
      const convertedChecklist: ChecklistItem[] = t.checklist.map((itemStr, checkIdx) => ({
        id: `ai-check-${idx}-${checkIdx}-${Date.now()}`,
        text: itemStr,
        completed: false
      }));

      return {
        id: `ai-task-${idx}-${Date.now()}`,
        title: t.title,
        description: t.description,
        bucketId: matchedBucket ? matchedBucket.id : 'bucket-research',
        priority: (t.priority as any) || 'medium',
        checklist: convertedChecklist,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 86400000 * (t.durationDays || 3)).toISOString().split('T')[0],
        progress: 0
      };
    });

    if (replaceCurrent) {
      if (currentUser) {
        const pathB = `users/${currentUser.uid}/plannerBuckets`;
        const pathT = `users/${currentUser.uid}/plannerTasks`;
        for (const b of buckets) {
          deleteDoc(doc(db, pathB, b.id)).catch(() => {});
        }
        for (const t of tasks) {
          deleteDoc(doc(db, pathT, t.id)).catch(() => {});
        }
        for (const nb of generatedBuckets) {
          setDoc(doc(db, pathB, nb.id), nb).catch(() => {});
        }
        for (const nt of generatedTasks) {
          setDoc(doc(db, pathT, nt.id), nt).catch(() => {});
        }
      } else {
        setBuckets(generatedBuckets);
        setTasks(generatedTasks);
      }
      addSystemLogMessage("Declassified existing schedule. Replaced with AI QazaqGas Project Board.", "success");
    } else {
      if (currentUser) {
        const pathB = `users/${currentUser.uid}/plannerBuckets`;
        const pathT = `users/${currentUser.uid}/plannerTasks`;
        const existingNames = buckets.map(b => b.name.toUpperCase());
        const filteredNewBuckets = generatedBuckets.filter(nb => !existingNames.includes(nb.name));
        for (const nb of filteredNewBuckets) {
          setDoc(doc(db, pathB, nb.id), nb).catch(() => {});
        }
        for (const nt of generatedTasks) {
          setDoc(doc(db, pathT, nt.id), nt).catch(() => {});
        }
      } else {
        setBuckets(prev => {
          const existingNames = prev.map(b => b.name.toUpperCase());
          const filteredNewBuckets = generatedBuckets.filter(nb => !existingNames.includes(nb.name));
          return [...prev, ...filteredNewBuckets];
        });
        setTasks(prev => [...prev, ...generatedTasks]);
      }
      addSystemLogMessage("Merged AI QazaqGas Project Board into active planner.", "success");
    }

    setAiPromptResponse(null);
    setGoalInput('');
    speakText(isKazakh ? "Жобалық тақта сәтті іске қосылды, сэр." : isRussian ? "Новая тактическая сетка развернута на панели, сэр." : "All systems nominal, sir. The digital project board has been deployed to the holograph arrays.");
  };

  // --- SAVE TASK EDITOR MODAL ---
  const handleSaveDetailedTask = () => {
    if (!editingTask) return;

    const updatedTask = {
      ...editingTask,
      progress: recalculateTaskProgress(editingTask.checklist)
    };

    writeTask(updatedTask);
    addSystemLogMessage(`Saved changes for task "${editingTask.title}"`, 'success');
    setEditingTask(null);
  };

  // Add checklists item inside editor modal
  const handleAddChecklistItemInEditor = () => {
    if (!newChecklistItemText.trim() || !editingTask) return;

    const newItem: ChecklistItem = {
      id: `check-item-${Date.now()}`,
      text: newChecklistItemText.trim(),
      completed: false
    };

    const updatedChecklist = [...editingTask.checklist, newItem];
    setEditingTask({
      ...editingTask,
      checklist: updatedChecklist,
      progress: recalculateTaskProgress(updatedChecklist)
    });
    setNewChecklistItemText('');
  };

  // Delete checklist item inside editor modal
  const handleDeleteChecklistItemInEditor = (itemId: string) => {
    if (!editingTask) return;

    const updatedChecklist = editingTask.checklist.filter(item => item.id !== itemId);
    setEditingTask({
      ...editingTask,
      checklist: updatedChecklist,
      progress: recalculateTaskProgress(updatedChecklist)
    });
  };

  // --- DATA GROUPING ALGORITHMS ---
  const renderGroupByViews = () => {
    if (groupBy === 'priority') {
      // Group by Priorities: Critical, High, Medium, Low
      const priorities: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];
      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-2">
          {priorities.map(prio => {
            const prioTasks = tasks.filter(t => t.priority === prio);
            const prioColor = prio === 'critical' ? 'border-rose-500/20 text-rose-400' :
                             prio === 'high' ? 'border-amber-500/20 text-amber-400' :
                             prio === 'medium' ? 'border-[#00f2ff]/20 text-[#00f2ff]' :
                             'border-gray-500/20 text-gray-400';
            return (
              <div key={prio} className="bg-black/25 p-3.5 rounded-xl border border-white/5 flex flex-col gap-3 min-w-[260px]">
                <div className={`text-[10px] font-mono uppercase tracking-widest font-bold border-b pb-2 flex items-center justify-between ${prioColor}`}>
                  <span>{prio} {isKazakh ? 'ลำсыма' : isRussian ? 'приоритет' : 'priority'}</span>
                  <span className="bg-white/5 px-2 py-0.5 rounded text-[9px]">{prioTasks.length}</span>
                </div>
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[450px]">
                  {prioTasks.map(task => renderTaskCard(task))}
                  {prioTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-600 text-[11px] font-mono">
                      NO OBJECTIVES
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (groupBy === 'progress') {
      // Group by Progress columns: Not Started (0%), In Progress (1-99%), Completed (100%)
      const progressGroups = [
        { id: 'not-started', name: isKazakh ? 'Басталмады' : isRussian ? 'Не начато' : 'NOT STARTED', filter: (t: PlannerTask) => t.progress === 0 },
        { id: 'in-progress', name: isKazakh ? 'Орындалуда' : isRussian ? 'В процессе' : 'IN PROGRESS', filter: (t: PlannerTask) => t.progress > 0 && t.progress < 100 },
        { id: 'completed', name: isKazakh ? 'Аяқталды' : isRussian ? 'Завершено' : 'COMPLETED', filter: (t: PlannerTask) => t.progress === 100 }
      ];

      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-x-auto pb-2">
          {progressGroups.map(group => {
            const groupTasks = tasks.filter(group.filter);
            return (
              <div key={group.id} className="bg-black/25 p-3.5 rounded-xl border border-white/5 flex flex-col gap-3 min-w-[280px]">
                <div className="text-[10px] font-mono uppercase tracking-widest font-bold border-b border-white/5 pb-2 text-cyan-400 flex items-center justify-between">
                  <span>{group.name}</span>
                  <span className="bg-white/5 px-2 py-0.5 rounded text-[9px]">{groupTasks.length}</span>
                </div>
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[450px]">
                  {groupTasks.map(task => renderTaskCard(task))}
                  {groupTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-600 text-[11px] font-mono">
                      {isKazakh ? 'БОС' : isRussian ? 'ПУСТО' : 'EMPTY FIELD'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Default: Group by Bucket (Microsoft Planner standard Board view)
    return (
      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-white/5">
        {buckets.map(bucket => {
          const bucketTasks = tasks.filter(t => t.bucketId === bucket.id);
          return (
            <div key={bucket.id} className="bg-black/30 p-3.5 rounded-xl border border-white/5 flex flex-col gap-3 min-w-[300px] max-w-[320px] shrink-0" id={`bucket-col-${bucket.id}`}>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <div className="w-1.5 h-3 bg-[#00f2ff] rounded-sm shrink-0"></div>
                  <span className="text-xs font-bold font-mono text-gray-200 truncate">{bucket.name}</span>
                  <span className="text-[9px] font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded shrink-0">{bucketTasks.length}</span>
                </div>
                <button
                  onClick={() => handleDeleteBucket(bucket.id)}
                  title="Delete Bucket"
                  className="p-1 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Inline Add Task inside Bucket */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder={isKazakh ? 'Тапсырма қосу...' : isRussian ? 'Добавить задачу...' : 'Add objective...'}
                  value={inlineTaskInput[bucket.id] || ''}
                  onChange={(e) => setInlineTaskInput(prev => ({ ...prev, [bucket.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddManualTask(bucket.id);
                  }}
                  className="flex-1 bg-black/40 border border-white/5 focus:border-[#00f2ff]/50 rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none placeholder:text-gray-600"
                />
                <button
                  onClick={() => handleAddManualTask(bucket.id)}
                  className="p-1 bg-[#00f2ff]/10 hover:bg-[#00f2ff] hover:text-black border border-[#00f2ff]/20 hover:border-transparent text-[#00f2ff] rounded transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tasks List Container */}
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[480px] pr-1">
                {bucketTasks.map(task => renderTaskCard(task))}
                {bucketTasks.length === 0 && (
                  <div className="text-center py-10 border border-dashed border-white/5 rounded-xl text-gray-600 text-[10px] font-mono uppercase tracking-widest">
                    {isKazakh ? 'Тапсырмалар жоқ' : isRussian ? 'Задач нет' : 'No Objectives'}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Bucket Button card */}
        <div className="min-w-[200px] shrink-0">
          {showAddBucket ? (
            <div className="bg-black/30 p-3.5 rounded-xl border border-[#00f2ff]/20 flex flex-col gap-2.5">
              <span className="text-[9px] font-mono text-[#00f2ff] uppercase tracking-wider">NEW BUCKET GRID</span>
              <input
                type="text"
                placeholder={isKazakh ? 'Баған атауы...' : isRussian ? 'Имя колонки...' : 'Bucket name...'}
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                className="bg-black/60 border border-white/10 focus:border-[#00f2ff] rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowAddBucket(false)}
                  className="px-2 py-1 text-[10px] font-mono text-gray-400 hover:text-white"
                >
                  {isKazakh ? 'Доғару' : isRussian ? 'Отмена' : 'Cancel'}
                </button>
                <button
                  onClick={handleCreateBucket}
                  className="px-2.5 py-1 text-[10px] font-mono bg-[#00f2ff] text-black font-semibold rounded"
                >
                  {isKazakh ? 'Қосу' : isRussian ? 'Создать' : 'Create'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddBucket(true)}
              className="w-full flex items-center justify-center gap-2 p-3 bg-black/10 hover:bg-[#00f2ff]/5 border border-dashed border-white/5 hover:border-[#00f2ff]/20 rounded-xl text-gray-500 hover:text-[#00f2ff] text-xs font-mono transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {isKazakh ? 'ЖАҢА БАҒАН ҚОСУ' : isRussian ? 'ДОБАВИТЬ БАКЕТ' : 'NEW PLAN BUCKET'}
            </button>
          )}
        </div>
      </div>
    );
  };

  // --- RENDER A SINGLE TASK CARD ---
  const renderTaskCard = (task: PlannerTask) => {
    // Styling flags based on priority
    const prioStyles = {
      critical: { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_8px_rgba(239,68,68,0.1)]', dot: 'bg-rose-500' },
      high: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
      medium: { bg: 'bg-cyan-500/10 text-[#00f2ff] border-cyan-500/30', dot: 'bg-[#00f2ff]' },
      low: { bg: 'bg-gray-500/10 text-gray-400 border-white/10', dot: 'bg-gray-500' }
    }[task.priority] || { bg: 'bg-gray-500/10 text-gray-400 border-white/10', dot: 'bg-gray-500' };

    return (
      <div 
        key={task.id}
        className="bg-[#161a22] p-3 rounded-xl border border-white/5 hover:border-[#00f2ff]/20 transition-all flex flex-col gap-2.5 shadow-md relative group select-none"
        id={`task-card-${task.id}`}
      >
        {/* Top Header Row with Priority & Quick Move Arrow Actions */}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[8px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${prioStyles.bg} flex items-center gap-1`}>
            <span className={`w-1 h-1 rounded-full ${prioStyles.dot} animate-pulse`}></span>
            {task.priority}
          </span>

          <div className="flex items-center gap-1">
            {/* Direct bucket shifting layout - highly robust */}
            <button
              onClick={() => handleMoveTaskBucket(task.id, 'left')}
              title="Move Left"
              className="p-1 text-gray-500 hover:text-[#00f2ff] hover:bg-white/5 rounded transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleMoveTaskBucket(task.id, 'right')}
              title="Move Right"
              className="p-1 text-gray-500 hover:text-[#00f2ff] hover:bg-white/5 rounded transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Task Title & Description */}
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-gray-200 line-clamp-1 leading-snug group-hover:text-[#00f2ff] transition-colors">{task.title}</h4>
          <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{task.description}</p>
        </div>

        {/* Checklist Inline Preview with Expand / Directly Checkable items */}
        {task.checklist.length > 0 && (
          <div className="space-y-1.5 bg-black/15 p-1.5 rounded-lg border border-white/5">
            <div className="flex items-center justify-between text-[8px] font-mono text-gray-500">
              <span className="uppercase tracking-widest flex items-center gap-1">
                <CheckSquare className="w-2.5 h-2.5 text-[#00f2ff]" />
                {isKazakh ? 'Бақылау тізімі' : isRussian ? 'чек-лист' : 'checklist'}
              </span>
              <span>{task.checklist.filter(c => c.completed).length} / {task.checklist.length}</span>
            </div>

            {/* Render checklist sub-items in miniature with immediate action handlers */}
            <div className="flex flex-col gap-1">
              {task.checklist.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleToggleChecklistItem(task.id, item.id)}
                  className="flex items-center gap-2 text-left w-full group/check cursor-pointer"
                >
                  <span className={`w-3 h-3 rounded flex items-center justify-center border shrink-0 transition-all ${
                    item.completed 
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                      : 'bg-black/40 border-white/10 group-hover/check:border-[#00f2ff]/40 text-transparent'
                  }`}>
                    <Check className="w-2 h-2 stroke-[3]" />
                  </span>
                  <span className={`text-[10px] truncate leading-none transition-colors ${
                    item.completed ? 'text-gray-600 line-through' : 'text-gray-400 group-hover/check:text-white'
                  }`}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress gauge bar */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[8px] font-mono text-gray-500">
            <span>PROGRESS</span>
            <span className="text-[#00f2ff] font-bold">{task.progress}%</span>
          </div>
          <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                task.progress === 100 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                  : 'bg-gradient-to-r from-cyan-500 to-[#00f2ff]'
              }`}
              style={{ width: `${task.progress}%` }}
            ></div>
          </div>
        </div>

        {/* Date Row & Command Actions */}
        <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
          <div className="flex items-center gap-1 text-[9px] font-mono text-gray-500">
            <Calendar className="w-3 h-3" />
            <span className="truncate max-w-[90px]">
              {task.dueDate ? task.dueDate.split('-').slice(1).join('/') : 'no-due'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExportTaskToScheduler(task)}
              title={isKazakh ? 'Кестеге қосу' : isRussian ? 'Экспорт в календарь' : 'Export to JARVIS calendar'}
              className="p-1 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setEditingTask(task)}
              title="Edit Task Details"
              className="p-1 text-gray-500 hover:text-[#00f2ff] hover:bg-[#00f2ff]/10 rounded transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDeleteTask(task.id)}
              title="Delete Task"
              className="p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Compute stats for overview display
  const completedCount = tasks.filter(t => t.progress === 100).length;
  const criticalCount = tasks.filter(t => t.priority === 'critical' && t.progress < 100).length;
  const inProgressCount = tasks.filter(t => t.progress > 0 && t.progress < 100).length;

  return (
    <div className="bg-[#121417]/95 p-5 rounded-2xl border border-[#00f2ff]/10 backdrop-blur-xl shadow-[0_0_35px_rgba(0,0,0,0.75)] flex flex-col gap-5 select-none" id="jarvis-microsoft-planner-board">
      
      {/* Top Holographic Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/5 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#00f2ff]/20 to-cyan-500/10 border border-[#00f2ff]/30 shadow-[0_0_15px_rgba(0,242,255,0.15)]">
            <BarChart2 className="w-5 h-5 text-[#00f2ff] animate-pulse" />
          </div>
          <div>
            <h3 className="text-white font-display text-base font-extrabold tracking-widest uppercase flex items-center gap-2">
              {isKazakh ? 'STARK КӘСІБИ ТАКТИКАЛЫҚ ПЛАННЕР' : isRussian ? 'ТАКТИЧЕСКИЙ ПЛАНИРОВЩИК STARK' : 'STARK TACTICAL PLANNER'}
              <span className="text-[9px] font-mono bg-[#00f2ff]/10 text-[#00f2ff] px-2 py-0.5 rounded border border-[#00f2ff]/20 animate-pulse">PLANNER ENGINE ACTIVE</span>
            </h3>
            <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mt-0.5">
              {isKazakh ? 'Microsoft Planner үлгісіндегі интерактивті бағандық жоспарлау жүйесі' : isRussian ? 'Канбан-сетка векторов, списков задач и чек-листов на замену Microsoft Planner' : 'ULTRA-FIDELITY MICROSOFT PLANNER KANBAN REPLACEMENT FOR CRITICAL MISSIONS'}
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-black/40 p-1 rounded-lg border border-white/5 text-xs font-mono">
            <span className="px-2 text-gray-500 text-[9px] uppercase tracking-wider">{isKazakh ? 'ЖОСПАР СИПАТЫ:' : isRussian ? 'ГРУППИРОВКА:' : 'GROUP BY:'}</span>
            <button
              onClick={() => setGroupBy('bucket')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer text-[10px] uppercase font-bold ${groupBy === 'bucket' ? 'bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/20' : 'text-gray-400 hover:text-white'}`}
            >
              {isKazakh ? 'Баған' : isRussian ? 'Баскеты' : 'Buckets'}
            </button>
            <button
              onClick={() => setGroupBy('priority')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer text-[10px] uppercase font-bold ${groupBy === 'priority' ? 'bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/20' : 'text-gray-400 hover:text-white'}`}
            >
              {isKazakh ? 'Маңыздылық' : isRussian ? 'Приоритет' : 'Priority'}
            </button>
            <button
              onClick={() => setGroupBy('progress')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer text-[10px] uppercase font-bold ${groupBy === 'progress' ? 'bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/20' : 'text-gray-400 hover:text-white'}`}
            >
              {isKazakh ? 'Прогресс' : isRussian ? 'Статус' : 'Progress'}
            </button>
          </div>
        </div>
      </div>

      {/* Mini dashboard widgets / indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-black/25 p-3 rounded-xl border border-white/5">
        <div className="flex flex-col">
          <span className="text-[9px] font-mono text-gray-500 uppercase">{isKazakh ? 'БАРЛЫҚ ТАПСЫРМАЛАР' : isRussian ? 'ВСЕГО ТАКТИК' : 'TOTAL OBJECTIVES'}</span>
          <span className="text-xl font-bold font-mono text-white mt-0.5">{tasks.length}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-mono text-gray-500 uppercase">{isKazakh ? 'ОРЫНДАЛҒАНЫ' : isRussian ? 'ЗАКРЫТО ЦЕЛЕЙ' : 'COMPLETED'}</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 flex items-center gap-1.5">
            {completedCount}
            {tasks.length > 0 && (
              <span className="text-[10px] text-gray-500 font-normal">({Math.round((completedCount/tasks.length)*100)}%)</span>
            )}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-mono text-gray-500 uppercase">{isKazakh ? 'БЕЛСЕНДІ ЖҰМЫСТА' : isRussian ? 'В ПРОЦЕССЕ' : 'ACTIVE IN PROGRESS'}</span>
          <span className="text-xl font-bold font-mono text-cyan-400 mt-0.5">{inProgressCount}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-mono text-rose-400 uppercase tracking-wider">{isKazakh ? 'МАҢЫЗДЫ ЖОЛДАР' : isRussian ? 'КРИТИЧЕСКИХ СБОЕВ' : 'CRITICAL PENETRATIONS'}</span>
          <span className="text-xl font-bold font-mono text-rose-500 mt-0.5 flex items-center gap-1">
            {criticalCount}
            {criticalCount > 0 && (
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping ml-1"></span>
            )}
          </span>
        </div>
      </div>

      {/* AI Planner Prompt Generator section */}
      <div className="bg-gradient-to-r from-black/50 to-[#00f2ff]/5 p-4 rounded-xl border border-[#00f2ff]/10 space-y-3.5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#00f2ff] font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5 animate-spin-slow text-[#00f2ff]" />
            STARK PLANNER INTEL COGNITIVE ASSISTANCE
          </label>
          <span className="text-[10px] text-gray-500 leading-relaxed font-mono">
            {isKazakh ? 'Нейрондық алгоритм жобаның барлық логикалық бағандары мен бақылау тізімін автоматты түрде дайындайды.' : isRussian ? 'Нейросетевой конструктор разложит сложный проект на логические бакеты, задачи, подзадачи и расставит дедлайны.' : 'Formulate any high-level objective and JARVIS will compile the optimal column layout and detail checklists.'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            id="planner-ai-goal-input"
            placeholder={isKazakh ? 'Мәселен: Жаңа веб-қосымшаны әзірлеу спринті...' : isRussian ? 'Например: Подготовка к хакатону за 3 дня или Аудит серверов безопасности...' : 'For example: High-throughput microservice stress audit, or QazaqGas Expo demo prep...'}
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerateAiPlannerBoard();
            }}
            className="flex-1 bg-black/60 border border-[#00f2ff]/20 focus:border-[#00f2ff] rounded-lg px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none placeholder:text-gray-700 transition-all"
          />
          <button
            onClick={handleGenerateAiPlannerBoard}
            disabled={isGenerating || !goalInput.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-[#00f2ff] hover:from-cyan-400 hover:to-[#00f2ff] disabled:opacity-40 text-black font-extrabold text-xs font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(0,242,255,0.25)] hover:shadow-[0_0_22px_rgba(0,242,255,0.4)] flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            {isGenerating ? (
              <>
                <Hourglass className="w-4 h-4 animate-spin text-black" />
                {isKazakh ? 'ЕСЕПТЕЛУДЕ...' : isRussian ? 'РАСЧЕТ ВЕТОК...' : 'SYNTHESIZING...'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black animate-pulse" />
                {isKazakh ? 'ЖОСПАР ҚҰРУ' : isRussian ? 'СОСТАВИТЬ СЕТКУ' : 'GENERATE BOARD'}
              </>
            )}
          </button>
        </div>

        {/* Toggle Engineering Planner Agent */}
        <div className="mt-4">
          <button
            onClick={() => setShowEngineeringPlanner(!showEngineeringPlanner)}
            className="flex items-center gap-2 text-[10px] text-[#00f2ff] hover:text-white font-mono uppercase tracking-widest transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            {showEngineeringPlanner ? (isKazakh ? 'Жоспарлаушыны жабу' : isRussian ? 'Закрыть инженерный планировщик' : 'Close Engineering Planner') : (isKazakh ? 'Жоспарлаушыны ашу' : isRussian ? 'Открыть инженерный планировщик' : 'Open Engineering Planner')}
          </button>
          
          {showEngineeringPlanner && (
            <div className="mt-2">
              <EngineeringPlannerAgent addSystemLogMessage={addSystemLogMessage} language={language} />
            </div>
          )}
        </div>

        {/* Generated AI Board Preview modal/card block */}
        {aiPromptResponse && (
          <div className="mt-2 p-2 bg-[#141821] rounded-lg border border-[#00f2ff]/30 space-y-1 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-1 gap-1">
              <div className="space-y-0">
                <span className="text-[7px] font-mono text-cyan-400 uppercase tracking-widest block">JARVIS PROJECTION DISPATCHED</span>
                <span className="text-[10px] font-extrabold text-gray-100 font-mono">"{aiPromptResponse.motivation}"</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[8px] font-mono text-gray-500 uppercase">{isKazakh ? 'Тиімділік:' : isRussian ? 'Эффективность:' : 'EFFICIENCY:'}</span>
                <span className="text-[9px] font-mono text-[#00f2ff] font-bold bg-[#00f2ff]/10 px-1.5 py-0 rounded border border-[#00f2ff]/20">
                  {aiPromptResponse.efficiencyScore}%
                </span>
              </div>
            </div>

            {/* Micro layout preview */}
            <div className="space-y-1">
              <span className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">{isKazakh ? 'Жоспар:' : isRussian ? 'План:' : 'BLUEPRINT:'}</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                {aiPromptResponse.buckets.map((bName, idx) => {
                  const subTasks = aiPromptResponse.tasks.filter(t => t.bucketName.toUpperCase() === bName.toUpperCase());
                  return (
                    <div key={idx} className="bg-black/40 p-1 rounded border border-white/5 space-y-0">
                      <div className="text-[8px] font-mono font-bold text-gray-300 truncate border-b border-white/5 pb-0">{bName.toUpperCase()}</div>
                      <div className="space-y-0">
                        {subTasks.map((t, tIdx) => (
                          <div key={tIdx} className="bg-white/5 p-0.5 rounded text-[8px] font-mono space-y-0">
                            <div className="text-gray-200 font-bold truncate">{t.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirm Deployments Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-1 pt-1 border-t border-white/5">
              <button
                onClick={() => setAiPromptResponse(null)}
                className="px-2 py-0.5 text-[9px] font-mono text-gray-400 hover:text-white"
              >
                {isKazakh ? 'Жою' : isRussian ? 'Сбросить' : 'Discard'}
              </button>
              <button
                onClick={() => handleDeployGeneratedBoard(false)}
                className="px-2 py-0.5 text-[9px] font-mono bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[#00f2ff] rounded transition-all cursor-pointer"
              >
                {isKazakh ? 'Біріктіру' : isRussian ? 'Объединить' : 'Merge'}
              </button>
              <button
                onClick={() => handleDeployGeneratedBoard(true)}
                className="px-2 py-0.5 text-[9px] font-mono bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-bold rounded transition-all cursor-pointer shadow-[0_0_6px_rgba(16,185,129,0.2)]"
              >
                {isKazakh ? 'Ауыстыру' : isRussian ? 'Заменить' : 'Replace'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Board View Grid Area */}
      <div className="mt-2" id="planner-board-columns-scrollable-zone">
        {renderGroupByViews()}
      </div>

      {/* DETAILED TASK EDITING DIALOG MODAL */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 select-none">
          <div className="bg-[#12161f] border border-[#00f2ff]/30 rounded-2xl p-5 max-w-lg w-full shadow-[0_0_50px_rgba(0,242,255,0.25)] flex flex-col gap-4 animate-scaleUp">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#00f2ff]" />
                <span className="text-xs font-bold font-mono text-white tracking-widest uppercase">{isKazakh ? 'ТАПСЫРМАНЫ КАЛИБРЛЕУ' : isRussian ? 'РЕДАКТИРОВАНИЕ ТАКТИКИ' : 'STARK DIRECTIVE CALIBRATION'}</span>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                className="p-1 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              {/* Title */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono text-gray-500 uppercase">TITLE</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00f2ff]"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono text-gray-500 uppercase">DESCRIPTION</label>
                <textarea
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  rows={2}
                  className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00f2ff] resize-none"
                />
              </div>

              {/* Grid selectors: Priority & Buckets & Dates */}
              <div className="grid grid-cols-2 gap-3">
                {/* Priority */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-gray-500 uppercase">PRIORITY</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as any })}
                    className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#00f2ff]"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </div>

                {/* Bucket */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-gray-500 uppercase">PLAN BUCKET</label>
                  <select
                    value={editingTask.bucketId}
                    onChange={(e) => setEditingTask({ ...editingTask, bucketId: e.target.value })}
                    className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#00f2ff]"
                  >
                    {buckets.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-gray-500 uppercase">START DATE</label>
                  <input
                    type="date"
                    value={editingTask.startDate || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, startDate: e.target.value })}
                    className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#00f2ff]"
                  />
                </div>

                {/* Due Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-gray-500 uppercase">DUE DATE</label>
                  <input
                    type="date"
                    value={editingTask.dueDate || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                    className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#00f2ff]"
                  />
                </div>
              </div>

              {/* Sub-Checklist Editor */}
              <div className="space-y-2 border-t border-white/5 pt-3 mt-1">
                <label className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">CHECKLIST PROTOCOLS</label>
                
                {/* Checklist adder row */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={isKazakh ? 'Жаңа бақылау элементі...' : isRussian ? 'Новый элемент чек-листа...' : 'Add checklist sub-task...'}
                    value={newChecklistItemText}
                    onChange={(e) => setNewChecklistItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddChecklistItemInEditor();
                    }}
                    className="flex-1 bg-black/40 border border-white/10 focus:border-[#00f2ff]/60 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none placeholder:text-gray-600"
                  />
                  <button
                    onClick={handleAddChecklistItemInEditor}
                    className="px-3 py-1.5 bg-[#00f2ff]/10 hover:bg-[#00f2ff] hover:text-black border border-[#00f2ff]/30 hover:border-transparent text-[#00f2ff] text-xs font-mono rounded font-bold cursor-pointer transition-colors"
                  >
                    ADD
                  </button>
                </div>

                {/* Checklist scrolling items */}
                <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                  {editingTask.checklist.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3 bg-black/30 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                      <button
                        onClick={() => handleToggleChecklistItem(editingTask.id, item.id)}
                        className="flex items-center gap-2 text-left"
                      >
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                          item.completed 
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                            : 'bg-black/40 border-white/10 text-transparent'
                        }`}>
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                        <span className={`text-xs font-mono ${item.completed ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
                          {item.text}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteChecklistItemInEditor(item.id)}
                        className="text-gray-600 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {editingTask.checklist.length === 0 && (
                    <div className="text-center py-4 text-gray-600 text-[10px] font-mono">
                      NO PROTOCOLS ADDED
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
              <button
                onClick={() => setEditingTask(null)}
                className="px-3.5 py-2 text-xs font-mono text-gray-400 hover:text-white"
              >
                {isKazakh ? 'Жабу' : isRussian ? 'Закрыть' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveDetailedTask}
                className="px-5 py-2 bg-[#00f2ff] text-black font-extrabold text-xs font-mono rounded-lg shadow-[0_0_15px_rgba(0,242,255,0.2)] hover:bg-[#00f2ff]/80 cursor-pointer"
              >
                {isKazakh ? 'Сақтау' : isRussian ? 'Сохранить изменения' : 'Commit Changes'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
