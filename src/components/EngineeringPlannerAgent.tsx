import React, { useState } from 'react';
import { Upload, AlertCircle, Sparkles } from 'lucide-react';

interface EngineeringPlannerAgentProps {
  addSystemLogMessage: (content: string, type: 'info' | 'success' | 'danger') => void;
  language: string;
}

export default function EngineeringPlannerAgent({ addSystemLogMessage, language }: EngineeringPlannerAgentProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isKazakh = language === 'kk-KZ';
  const isRussian = language === 'ru-RU';

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      await analyzeSchedule(text);
    };
    reader.readAsText(file);
  };

  const analyzeSchedule = async (scheduleData: string) => {
    setIsLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch('/api/gemini/analyze-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleData, language })
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setAnalysis(data.analysis);
      addSystemLogMessage(
        isKazakh ? "Жоспарлаушыны талдау аяқталды" : isRussian ? "Анализ планировщика завершен" : "Planner Analysis complete", 
        "success"
      );
    } catch (e) {
      addSystemLogMessage(
        isKazakh ? "Жоспарлаушыны талдау сәтсіз аяқталды" : isRussian ? "Анализ планировщика не удался" : "Planner Analysis failed", 
        "danger"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-black/30 rounded-xl border border-white/5 space-y-4">
      <div className="flex items-center gap-2 text-[#00f2ff]">
        <Sparkles className="w-4 h-4" />
        <h3 className="font-mono text-xs uppercase tracking-wider">
          {isKazakh ? 'Жоспарлау жөніндегі инженер' : isRussian ? 'Инженер по планированию' : 'Engineering Planner Agent'}
        </h3>
      </div>
      
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-white/5 rounded-lg cursor-pointer hover:border-[#00f2ff]/30 transition-colors">
          <Upload className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-mono text-gray-400">
            {isKazakh ? 'Графикті жүктеу' : isRussian ? 'Загрузить график' : 'Upload Schedule'}
          </span>
          <input type="file" className="hidden" onChange={handleFileUpload} accept=".json" />
        </label>
      </div>

      {isLoading && (
        <div className="text-xs font-mono text-gray-500 animate-pulse">
          {isKazakh ? 'Талдауда...' : isRussian ? 'Анализирую...' : 'Analyzing...'}
        </div>
      )}
      
      {analysis && (
        <div className="p-3 bg-black/40 rounded-lg border border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">
              {isKazakh ? 'Талдау нәтижелері' : isRussian ? 'Результаты анализа' : 'Analysis Results'}
            </span>
          </div>
          <p className="text-xs text-gray-300 font-mono">{analysis}</p>
        </div>
      )}
    </div>
  );
}
