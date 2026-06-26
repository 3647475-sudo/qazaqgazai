import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
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
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  FileText, 
  CloudUpload, 
  Trash2, 
  Search, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  FolderLock,
  Plus,
  Layers,
  FileCode,
  Image as ImageIcon
} from 'lucide-react';
import { DocumentFile, UserRole } from '../types';

interface DocumentsViewProps {
  currentRole: UserRole;
  currentUserEmail: string;
  theme: 'dark' | 'light';
  language: 'ru' | 'en';
}

export default function DocumentsView({ currentRole, currentUserEmail, theme, language }: DocumentsViewProps) {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  // File Upload states
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'documents'), orderBy('uploadedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DocumentFile[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as DocumentFile);
      });
      setDocuments(list);
      setLoading(false);
    }, (err) => {
      console.error("Error subscribing to documents: ", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setUploadSuccess('');
    setUploadError('');

    try {
      const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(uploadResult.ref);

      // Determine file kind
      let ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';

      const docData = {
        name: file.name,
        url: fileUrl,
        type: ext,
        uploadedAt: Date.now(),
        uploadedBy: currentRole,
        uploadedByEmail: currentUserEmail,
        size: file.size
      };

      await addDoc(collection(db, 'documents'), docData);

      // Create corporate-level notification
      await addDoc(collection(db, 'notifications'), {
        title: language === 'ru' ? 'Добавлен документ' : 'Document Uploaded',
        message: language === 'ru' ? `В хранилище загружен документ: ${file.name}` : `New document uploaded: ${file.name}`,
        type: 'document_upload',
        timestamp: Date.now(),
        createdBy: currentRole,
        createdByEmail: currentUserEmail,
        readBy: []
      });

      setUploadSuccess(language === 'ru' ? 'Файл успешно загружен!' : 'Document uploaded successfully!');
      setTimeout(() => setUploadSuccess(''), 3000);
    } catch (err: any) {
      console.error("Upload error: ", err);
      setUploadError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleDeleteDoc = async (docObj: DocumentFile) => {
    if (!window.confirm(language === 'ru' ? 'Вы уверены, что хотите удалить этот документ?' : 'Delete this document permanently?')) return;
    try {
      await deleteDoc(doc(db, 'documents', docObj.id));
    } catch (err) {
      console.error(err);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    const ext = type.toLowerCase();
    if (['pdf'].includes(ext)) return <FileText className="w-5 h-5 text-red-400" />;
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileText className="w-5 h-5 text-green-400" />;
    return <FileText className="w-5 h-5 text-cyan-400" />;
  };

  const filteredDocs = documents.filter((docObj) => {
    const matchSearch = docObj.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === 'All' || docObj.type === typeFilter;
    return matchSearch && matchType;
  });

  const uniqueTypes = Array.from(new Set(documents.map(d => d.type))) as string[];

  const t = {
    title: language === 'ru' ? 'Корпоративный Сейф / Документы' : 'Corporate Storage Vault',
    subtitle: language === 'ru' ? 'Загружайте и просматривайте контракты, справки и файлы сотрудников' : 'Upload and retrieve employee files, legal contracts, certificates and PDFs',
    searchPlaceholder: language === 'ru' ? 'Поиск документов по названию...' : 'Search files by title...',
    colTitle: language === 'ru' ? 'Название файла' : 'Filename',
    colSize: language === 'ru' ? 'Размер' : 'Size',
    colUploaded: language === 'ru' ? 'Дата загрузки' : 'Upload details',
    colActions: language === 'ru' ? 'Действия' : 'Actions',
    dragText: language === 'ru' ? 'Перетащите файл сюда или нажмите для выбора' : 'Drag & drop your document here, or click to browse files',
    uploadingText: language === 'ru' ? 'Загрузка файла в облако...' : 'Uploading file to cloud storage...'
  };

  return (
    <div className="space-y-6">
      {/* Top action header bar */}
      <div>
        <h2 className="text-xl font-display font-semibold flex items-center gap-2">
          <FolderLock className="w-5.5 h-5.5 text-cyan-500" />
          <span>{t.title}</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
      </div>

      {/* Upload Drag & Drop Area */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all ${
          dragActive 
            ? 'border-cyan-400 bg-cyan-500/5' 
            : theme === 'dark' 
              ? 'border-white/10 bg-white/[0.02] hover:border-white/15' 
              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
        }`}
      >
        <input 
          type="file" 
          id="file-upload-input" 
          multiple={false} 
          onChange={handleFileInputChange} 
          className="hidden" 
        />
        
        <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
            uploading ? 'bg-amber-500/10 text-amber-400' : 'bg-cyan-500/10 text-cyan-400'
          }`}>
            <CloudUpload className={`w-6.5 h-6.5 ${uploading ? 'animate-bounce' : ''}`} />
          </div>

          <div>
            <p className="text-xs font-semibold">{uploading ? t.uploadingText : t.dragText}</p>
            <p className="text-[10px] text-slate-500 font-mono mt-1">PDF, DOCX, XLSX, JPEG, PNG, ZIP (max 10MB)</p>
          </div>
        </label>

        {/* Success / Error overlays */}
        {uploadSuccess && (
          <div className="absolute inset-x-0 bottom-3 mx-auto max-w-xs p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-mono flex items-center justify-center gap-1.5 animate-fade-in">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{uploadSuccess}</span>
          </div>
        )}
        {uploadError && (
          <div className="absolute inset-x-0 bottom-3 mx-auto max-w-xs p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 font-mono flex items-center justify-center gap-1.5 animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Filter and search controllers */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        theme === 'dark' ? 'bg-[#121620] border-white/5' : 'bg-white border-slate-200 shadow-sm'
      }`}>
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

        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={`p-1.5 text-xs font-mono border rounded-xl focus:outline-none cursor-pointer ${
              theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <option value="All">{language === 'ru' ? 'Все форматы' : 'All file formats'}</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>{type.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Grid Table */}
      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-slate-500">
          <FileText className="w-6 h-6 animate-spin mx-auto mb-3 text-cyan-400" />
          Retrieving secure file vault metadata...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="py-20 text-center text-slate-500 text-xs font-mono">
          No files uploaded to this storage module yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocs.map((docObj) => (
            <div 
              key={docObj.id}
              className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all hover:-translate-y-0.5 ${
                theme === 'dark' 
                  ? 'bg-[#121620] border-white/5 hover:border-cyan-500/25' 
                  : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  theme === 'dark' ? 'bg-black/40' : 'bg-slate-100'
                }`}>
                  {getFileIcon(docObj.type)}
                </div>
                <div className="overflow-hidden">
                  <h4 className="font-semibold text-xs leading-snug text-white truncate" title={docObj.name}>
                    {docObj.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatBytes(docObj.size)} • {docObj.type.toUpperCase()}</p>
                </div>
              </div>

              {/* Upload footer metadata details */}
              <div className="pt-3.5 border-t border-slate-200/40 dark:border-white/5 flex items-center justify-between">
                <div className="text-[9px] font-mono text-slate-400">
                  <span className="block truncate max-w-[120px]">Uploader: {docObj.uploadedByEmail}</span>
                  <span>{new Date(docObj.uploadedAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <a 
                    href={docObj.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:text-white transition-all cursor-pointer"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  {(currentRole === 'admin' || docObj.uploadedByEmail === currentUserEmail) && (
                    <button
                      onClick={() => handleDeleteDoc(docObj)}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
