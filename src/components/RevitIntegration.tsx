import React, { useState } from 'react';
import { FileUp, Link, Cpu } from 'lucide-react';

interface RevitIntegrationProps {
  language: string;
}

export default function RevitIntegration({ language }: RevitIntegrationProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      // In a real implementation, you would upload the Revit file here to your backend
      // for processing or linking.
      setTimeout(() => {
        setIsUploading(false);
        alert(language === 'kk-KZ' ? 'Файл сәтті жүктелді және талдауға жіберілді.' : language === 'ru-RU' ? 'Файл успешно загружен и отправлен на анализ.' : 'File uploaded and sent for analysis.');
      }, 1500);
    }
  };

  return (
    <div className="bg-[#121417] p-6 rounded-2xl border border-[#00f2ff]/20 shadow-[0_0_20px_rgba(0,242,255,0.04)] relative">
      <h3 className="text-white font-display font-medium text-sm tracking-wider uppercase flex items-center gap-2 mb-4">
        <Cpu className="w-4 h-4 text-[#00f2ff]" />
        Revit BIM Integration
      </h3>
      <p className="text-xs text-gray-400 font-mono mb-4">
        {language === 'kk-KZ' 
          ? 'Revit жобалық файлдарын жүктеңіз немесе BIM интеграциясын орнатыңыз.' 
          : language === 'ru-RU' 
            ? 'Загрузите файлы проекта Revit или настройте интеграцию BIM.' 
            : 'Upload Revit project files or configure BIM integration.'}
      </p>
      
      <div className="flex gap-3">
        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0a0b0d] border border-[#00f2ff]/30 rounded-xl text-xs font-mono text-cyan-400 hover:bg-[#00f2ff]/10 cursor-pointer transition-all">
          <FileUp className="w-4 h-4" />
          {isUploading 
            ? (language === 'kk-KZ' ? 'Жүктелуде...' : language === 'ru-RU' ? 'Загрузка...' : 'Uploading...') 
            : (language === 'kk-KZ' ? 'Файл жүктеу' : language === 'ru-RU' ? 'Загрузить файл' : 'Upload File')}
          <input type="file" className="hidden" onChange={handleFileUpload} accept=".rvt" />
        </label>
        
        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#00f2ff]/10 border border-[#00f2ff]/30 rounded-xl text-xs font-mono text-cyan-400 hover:bg-[#00f2ff]/20 cursor-pointer transition-all">
          <Link className="w-4 h-4" />
          {language === 'kk-KZ' ? 'API-ді жалғау' : language === 'ru-RU' ? 'Подключить API' : 'Connect API'}
        </button>
      </div>
    </div>
  );
}
