import React, { useState } from 'react';
import { Cpu, Sparkles, RefreshCw, Activity, CheckCircle, Zap, ShieldAlert, Award } from 'lucide-react';
import { HabitLog } from '../types';

interface HabitOptimizerProps {
  habitLogs: HabitLog[];
  language: string;
  onRefreshAnalysis: () => Promise<void>;
  aiAnalysisOutput: {
    patterns: string[];
    recommendations: { time: string; trigger: string; suggestedCommand?: string }[];
    efficiencyIndex: number;
    aiSummary: string;
  } | null;
  isLoading: boolean;
}

export default function HabitOptimizer({
  habitLogs,
  language,
  onRefreshAnalysis,
  aiAnalysisOutput,
  isLoading
}: HabitOptimizerProps) {
  const [activeTab, setActiveTab] = useState<'patterns' | 'logs'>('patterns');

  // Simple static days of week tracking grid for visual design
  const weekKeys = language === 'kk-KZ' 
    ? ['Дүй', 'Сей', 'Сәр', 'Бей', 'Жұм', 'Сен', 'Жек']
    : language === 'ru-RU' 
      ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Map log messages
  const getLogIcon = (cat: string) => {
    switch (cat) {
      case 'alarm': return <span className="w-2 h-2 rounded-full bg-[#00f2ff] shadow-[0_0_8px_#00f2ff]"></span>;
      case 'reminder': return <span className="w-2 h-2 rounded-full bg-indigo-400"></span>;
      case 'cmd': return <span className="w-2 h-2 rounded-full bg-[#00f2ff]"></span>;
      default: return <span className="w-2 h-2 rounded-full bg-emerald-400"></span>;
    }
  };

  return (
    <div id="habit-optimizer" className="bg-[#121417] p-3 rounded-2xl border border-[#00f2ff]/20 shadow-[0_0_10px_rgba(0,242,255,0.04)] relative overflow-hidden text-[11px]">
      {/* Absolute visual neural connections background canvas */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f2ff]/5 blur-[60px] pointer-events-none rounded-full"></div>
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-3 border-b border-[#00f2ff]/15 pb-2">
        <div>
          <h3 className="text-white font-display font-medium text-sm tracking-wider uppercase flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-[#00f2ff] animate-pulse" />
            {language === 'kk-KZ' 
              ? 'Әдеттерді талдау' 
              : language === 'ru-RU' 
                ? 'Анализ привычек' 
                : 'Habit Optimizer'}
          </h3>
        </div>

        <button
          onClick={onRefreshAnalysis}
          disabled={isLoading}
          className={`px-2 py-1 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-mono text-[9px] rounded border border-[#00f2ff]/30 uppercase tracking-widest cursor-pointer transition-all active:scale-95 disabled:opacity-50 ${isLoading ? 'animate-pulse' : ''}`}
        >
          <RefreshCw className={`w-3 h-3 inline mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          {language === 'kk-KZ' ? 'Нейроталдау' : language === 'ru-RU' ? 'Нейроанализ' : 'Re-Analyze'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        
        {/* Left Side: Dynamic Progress Ring / efficiency Index & AI Advice */}
        <div className="xl:col-span-3 flex flex-row xl:flex-col items-center justify-between xl:justify-center bg-black/40 p-2 rounded-xl border border-white/5">
          <div className="relative w-20 h-20 flex items-center justify-center">
            {/* SVG circle meter */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="rgba(255, 255, 255, 0.03)"
                strokeWidth="6"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="url(#neonCyanGrad)"
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - (aiAnalysisOutput?.efficiencyIndex || 85) / 100)}`}
                strokeLinecap="round"
                fill="transparent"
              />
              <defs>
                <linearGradient id="neonCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f2ff" />
                  <stop offset="100%" stopColor="#00a2ff" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute text-center">
              <span className="text-xl font-extrabold text-white font-mono tracking-tighter">{aiAnalysisOutput?.efficiencyIndex || 85}%</span>
            </div>
          </div>
          
          <div className="text-center xl:mt-2">
            <span className="text-[9px] text-[#00f2ff] tracking-widest font-mono uppercase">Efficiency</span>
          </div>
        </div>

        {/* Right Side: Tab switcher for AI-discovered Patterns OR Raw triggers checklist */}
        <div className="xl:col-span-9 flex flex-col">
          <div className="flex border-b border-white/5 mb-2 select-none">
            <button
              onClick={() => setActiveTab('patterns')}
              className={`pb-1 px-2 text-[10px] font-mono tracking-widest uppercase cursor-pointer border-b transition-colors ${
                activeTab === 'patterns' ? 'border-[#00f2ff] text-[#00f2ff] font-semibold' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {language === 'kk-KZ' ? 'Заңдылықтар' : language === 'ru-RU' ? 'Закономерности' : 'Patterns'}
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`pb-1 px-2 text-[10px] font-mono tracking-widest uppercase cursor-pointer border-b transition-colors ${
                activeTab === 'logs' ? 'border-[#00f2ff] text-[#00f2ff] font-semibold' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {language === 'kk-KZ' ? 'Тарих' : language === 'ru-RU' ? 'История' : 'History'} ({habitLogs.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[140px] pr-1 space-y-2">
            {activeTab === 'patterns' ? (
              isLoading ? (
                <div className="flex flex-col items-center justify-center py-5 space-y-2">
                  <Activity className="w-6 h-6 text-[#00f2ff] animate-bounce" />
                  <span className="text-[10px] font-mono text-gray-500">
                    {language === 'kk-KZ' ? 'Талдауда...' : language === 'ru-RU' ? 'Анализирую...' : 'Analyzing...'}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* AI Summary Block */}
                  {aiAnalysisOutput?.aiSummary && (
                    <div className="bg-[#00f2ff]/5 border border-[#00f2ff]/20 p-2 rounded text-[10px] text-gray-300 leading-snug font-light">
                      <div className="flex items-center gap-1 text-[#00f2ff] font-bold mb-0.5 font-mono text-[9px] uppercase tracking-widest">
                        <Sparkles className="w-3 h-3 text-[#00f2ff]" />
                        {language === 'kk-KZ' ? 'ҚОРЫТЫНДЫ:' : language === 'ru-RU' ? 'СВОДКА:' : 'SUMMARY:'}
                      </div>
                      {aiAnalysisOutput.aiSummary}
                    </div>
                  )}

                  {/* Discovered habit patterns list */}
                  <div>
                    <h5 className="text-white text-[10px] font-mono mb-1 uppercase tracking-wider text-gray-400">
                      {language === 'kk-KZ' ? 'Заңдылықтар' : language === 'ru-RU' ? 'Привычки' : 'Patterns'}
                    </h5>
                    <ul className="space-y-1">
                      {aiAnalysisOutput?.patterns && aiAnalysisOutput.patterns.length > 0 ? (
                        aiAnalysisOutput.patterns.map((p, idx) => (
                          <li key={idx} className="flex items-start gap-1 text-[10px] text-gray-300">
                            <span className="mt-0.5 text-[#00f2ff] text-[8px]">[•]</span>
                            {p}
                          </li>
                        ))
                      ) : (
                        <li className="text-[10px] text-gray-500 italic pb-1">
                          {language === 'kk-KZ' 
                            ? 'Сөйлесуді бастаңыз.'
                            : language === 'ru-RU'
                              ? 'Начните диалог.'
                              : 'Log data first.'}
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )
            ) : (
              /* Event log telemetry logs list */
              <div className="space-y-1">
                {habitLogs.length === 0 ? (
                  <div className="text-center text-gray-600 text-[10px] py-5 font-mono">
                    [No events]
                  </div>
                ) : (
                  [...habitLogs].reverse().slice(0, 8).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-1.5 bg-black/20 rounded border border-white/5 text-[9px] font-mono">
                      <div className="flex items-center gap-1.5">
                        {getLogIcon(log.category)}
                        <span className="text-gray-350">{log.action}</span>
                      </div>
                      <span className="text-gray-500 text-[8px]">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
