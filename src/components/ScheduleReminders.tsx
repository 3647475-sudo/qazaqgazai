import React, { useState, useEffect } from 'react';
import { Calendar, Bell, Plus, Trash, CheckCircle, Clock, Zap, Volume2, ShieldAlert } from 'lucide-react';
import { Reminder, Alarm } from '../types';

interface ScheduleRemindersProps {
  reminders: Reminder[];
  alarms: Alarm[];
  language: string;
  onAddReminder: (text: string, time?: string) => void;
  onToggleReminder: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onAddAlarm: (time: string, label: string) => void;
  onToggleAlarm: (id: string) => void;
  onDeleteAlarm: (id: string) => void;
}

export default function ScheduleReminders({
  reminders,
  alarms,
  language,
  onAddReminder,
  onToggleReminder,
  onDeleteReminder,
  onAddAlarm,
  onToggleAlarm,
  onDeleteAlarm
}: ScheduleRemindersProps) {
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('');
  
  const [newAlarmTime, setNewAlarmTime] = useState('08:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');

  const [activeTab, setActiveTab] = useState<'reminders' | 'alarms'>('reminders');

  // Alarm ringing checker state
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  const [audioOscillator, setAudioOscillator] = useState<any[]>([]);

  // Check clocks every 5 seconds for ringing alarms
  useEffect(() => {
    const timer = setInterval(() => {
      if (ringingAlarm) return; // Already ringing

      const now = new Date();
      const currentHhMm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      alarms.forEach((alarm) => {
        if (alarm.active && alarm.time === currentHhMm) {
          // Alarm matches! Ring it
          setRingingAlarm(alarm);
          triggerAlarmSound();
        }
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [alarms, ringingAlarm]);

  // Synthesis alert bells
  const triggerAlarmSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      const oscList: any[] = [];
      // Repeatedly sound synthesized alert sweeps
      const soundLoop = setInterval(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }, 800);

      setAudioOscillator([ctx, soundLoop]);
    } catch (e) {
      console.log("Audio alert synthesizer blocked or failed:", e);
    }
  };

  const stopAlarmSound = () => {
    if (audioOscillator.length > 0) {
      const [ctx, intervalId] = audioOscillator;
      clearInterval(intervalId);
      if (ctx && ctx.state !== 'closed') ctx.close();
      setAudioOscillator([]);
    }
    setRingingAlarm(null);
  };

  // Triggers
  const handleAddRem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;
    onAddReminder(newReminderText, newReminderTime || undefined);
    setNewReminderText('');
    setNewReminderTime('');
  };

  const handleAddAl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlarmTime) return;
    onAddAlarm(newAlarmTime, newAlarmLabel || 'Alarm');
    setNewAlarmLabel('');
  };

  return (
    <div className="bg-[#121417] p-6 rounded-2xl border border-[#00f2ff]/20 shadow-[0_0_20px_rgba(0,242,255,0.04)] relative">
      
      {/* Absolute Full Screen Holographic Ringing Modal overlay */}
      {ringingAlarm && (
        <div className="fixed inset-0 bg-[#0a0b0d]/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="absolute top-0 left-0 w-full h-full bg-radial-gradient from-red-950/20 to-transparent pointer-events-none animate-pulse"></div>
          
          <div className="w-24 h-24 rounded-full bg-red-950 border border-red-500/50 flex items-center justify-center mb-6 animate-ping duration-2000">
            <Bell className="w-12 h-12 text-red-500 animate-bounce" />
          </div>

          <span className="text-red-500 font-mono text-xs tracking-widest uppercase animate-pulse mb-1 font-bold">
            🚨 JARVIS SYSTEM ALERT: ACTIVE ALARM TRIGGERED 🚨
          </span>
          <h2 className="text-white text-3xl font-bold font-mono tracking-tight mb-2">
            ⏰ {ringingAlarm.time}
          </h2>
          <p className="text-gray-350 text-xs font-mono mb-8 max-w-sm">
            {ringingAlarm.label === 'Alarm' 
              ? (language === 'kk-KZ' ? 'Будильник уақыты келді!' : language === 'ru-RU' ? 'Время будильника наступило!' : 'Time is up!') 
              : ringingAlarm.label}
          </p>

          <button
            onClick={stopAlarmSound}
            className="px-8 py-3 bg-red-700 hover:bg-red-650 text-white font-mono rounded border border-red-500 text-xs tracking-widest uppercase font-bold transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] cursor-pointer active:scale-95"
          >
            {language === 'kk-KZ' ? 'СӨНДІРУ // STOP_SIGNAL' : language === 'ru-RU' ? 'ОТКЛЮЧИТЬ // STOP_SIGNAL' : 'DISMISS NEURAL SIGNAL'}
          </button>
        </div>
      )}

      <div className="flex border-b border-white/5 mb-5 select-none gap-2">
        <button
          onClick={() => setActiveTab('reminders')}
          className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-mono tracking-widest uppercase cursor-pointer border-b-2 transition-colors ${
            activeTab === 'reminders' ? 'border-[#00f2ff] text-[#00f2ff] font-semibold' : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          {language === 'kk-KZ' ? 'Тапсырмалар' : language === 'ru-RU' ? 'Задачи' : 'Tasks'}
        </button>
        <button
          onClick={() => setActiveTab('alarms')}
          className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-mono tracking-widest uppercase cursor-pointer border-b-2 transition-colors ${
            activeTab === 'alarms' ? 'border-[#00f2ff] text-[#00f2ff] font-semibold' : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Bell className="w-4 h-4" />
          {language === 'kk-KZ' ? 'Будильниктер' : language === 'ru-RU' ? 'Будильники' : 'Alarms'}
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === 'reminders' ? (
          <div>
            {/* Quick reminder scheduler form */}
            <form onSubmit={handleAddRem} className="flex flex-col sm:flex-row gap-2.5 mb-4">
              <input
                type="text"
                placeholder={language === 'kk-KZ' ? 'Тапсырма мәтінін енгізіңіз...' : language === 'ru-RU' ? 'Введите текст задачи...' : 'Add reminder target e.g. Daily habit check...'}
                value={newReminderText}
                onChange={(e) => setNewReminderText(e.target.value)}
                className="flex-1 bg-[#0a0b0d] border border-white/10 focus:border-[#00f2ff] p-2 text-xs rounded font-mono text-white placeholder:text-gray-600 focus:outline-none transition-colors"
              />
              <input
                type="time"
                value={newReminderTime}
                onChange={(e) => setNewReminderTime(e.target.value)}
                className="bg-[#0a0b0d] border border-white/10 focus:border-[#00f2ff] p-2 text-xs rounded font-mono text-white focus:outline-none transition-colors w-full sm:w-auto"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#00f2ff] hover:bg-[#00f2ff]/80 text-black font-mono text-xs font-semibold rounded uppercase tracking-widest flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                {language === 'kk-KZ' ? 'Қосу' : language === 'ru-RU' ? 'Добавить' : 'Schedule'}
              </button>
            </form>

            <div className="space-y-2 overflow-y-auto max-h-[190px] pr-1">
              {reminders.length === 0 ? (
                <div className="text-gray-600 font-mono text-xs text-center py-10 italic">
                  {language === 'kk-KZ' ? '[Жиын ескертулері жоқ // NO_ACTIVE_REMINDERS]' : language === 'ru-RU' ? '[Нет активных задач // NO_ACTIVE_REMINDERS]' : '[No active reminders // NO_ACTIVE_REMINDERS]'}
                </div>
              ) : (
                reminders.map((rem) => (
                  <div key={rem.id} className="flex items-center justify-between p-3 bg-black/20 rounded border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onToggleReminder(rem.id)}
                        className={`w-4 h-4 rounded-sm border flex items-center justify-center cursor-pointer transition-all ${
                          rem.completed ? 'bg-[#00f2ff]/20 border-[#00f2ff] text-[#00f2ff]' : 'border-gray-750 hover:border-[#00f2ff]'
                        }`}
                      >
                        {rem.completed && <CheckCircle className="w-3 h-3" />}
                      </button>
                      <div>
                        <p className={`text-xs font-mono mb-0.5 ${rem.completed ? 'text-gray-600 line-through' : 'text-gray-200'}`}>{rem.text}</p>
                        {rem.time && (
                          <span className="text-[10px] text-[#00f2ff]/80 font-mono flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {rem.time}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteReminder(rem.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Quick alarm creation form */}
            <form onSubmit={handleAddAl} className="flex flex-col sm:flex-row gap-2.5 mb-4">
              <input
                type="text"
                placeholder={language === 'kk-KZ' ? 'Оятқыш белгісі...' : language === 'ru-RU' ? 'Название будильника (например, кофе)...' : 'Label (e.g. coffee routine)'}
                value={newAlarmLabel}
                onChange={(e) => setNewAlarmLabel(e.target.value)}
                className="flex-1 bg-[#0a0b0d] border border-white/10 focus:border-[#00f2ff] p-2 text-xs rounded font-mono text-white placeholder:text-gray-600 focus:outline-none transition-colors"
              />
              <input
                type="time"
                value={newAlarmTime}
                onChange={(e) => setNewAlarmTime(e.target.value)}
                className="bg-[#0a0b0d] border border-white/10 focus:border-[#00f2ff] p-2 text-xs rounded font-mono text-white focus:outline-none transition-colors w-full sm:w-auto"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#00f2ff] hover:bg-[#00f2ff]/80 text-black font-mono text-xs font-semibold rounded uppercase tracking-widest flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                {language === 'kk-KZ' ? 'Қосу' : language === 'ru-RU' ? 'Поставить' : 'Set'}
              </button>
            </form>

            <div className="space-y-2 overflow-y-auto max-h-[190px] pr-1">
              {alarms.length === 0 ? (
                <div className="text-gray-650 font-mono text-xs text-center py-10 italic">
                  {language === 'kk-KZ' ? '[Оятқыштар орнатылмаған // NO_ACTIVE_ALARMCLOCK]' : language === 'ru-RU' ? '[Будильники не установлены // NO_ACTIVE_ALARMCLOCK]' : '[No active alarms // NO_ACTIVE_ALARMCLOCK]'}
                </div>
              ) : (
                alarms.map((al) => (
                  <div key={al.id} className="flex items-center justify-between p-3 bg-black/20 rounded border border-white/5 shadow-sm relative overflow-hidden">
                    {/* Ringing match state indicators */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded flex items-center justify-center ${al.active ? 'bg-[#00f2ff]/10 border border-[#00f2ff]/40 text-[#00f2ff] shadow-[0_0_10px_rgba(0,242,255,0.1)]' : 'bg-[#0a0b0d] text-gray-700'}`}>
                        <Bell className={`w-4 h-4 ${al.active ? 'animate-wiggle' : ''}`} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold font-mono text-white tracking-widest">{al.time}</h4>
                        <span className="text-[10px] text-gray-500 font-mono">{al.label}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5">
                      {/* Interactive switch button */}
                      <button
                        onClick={() => onToggleAlarm(al.id)}
                        className={`w-9 h-5 rounded-full p-0.5 cursor-pointer transition-colors duration-300 ${al.active ? 'bg-[#00f2ff]' : 'bg-gray-800'}`}
                      >
                        <div className={`bg-black w-4 h-4 rounded-full shadow-md transform duration-300 ${al.active ? 'translate-x-4 bg-black/90' : 'translate-x-0'}`}></div>
                      </button>
                      <button
                        onClick={() => onDeleteAlarm(al.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
