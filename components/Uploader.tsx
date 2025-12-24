
import React, { useState, useRef, useEffect } from 'react';
import { extractFinancialData } from '../services/geminiService';
import { DocumentStatus, Transaction, DocumentRecord } from '../types';

interface QueueItem {
  id: string;
  file: File;
  status: 'pending' | 'analyzing' | 'saving' | 'completed' | 'failed';
  error?: string;
  progress: number;
}

interface UploaderProps {
  onProcessingComplete: (doc: DocumentRecord, trans: Transaction) => void;
  onAllDone?: () => void;
}

type BatchType = 'income' | 'expense' | 'auto';

const Uploader: React.FC<UploaderProps> = ({ onProcessingComplete, onAllDone }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [defaultType, setDefaultType] = useState<BatchType>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    if (files.length === 0) return;

    const newItems: QueueItem[] = files.map((file: File) => ({
      id: `q-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending' as const,
      progress: 0
    }));

    setQueue(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processNextInQueue = async () => {
    const nextItem = queue.find(item => item.status === 'pending');
    if (!nextItem) {
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    updateItemStatus(nextItem.id, 'analyzing', 20);

    try {
      // 1. Base64 Conversion
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(nextItem.file);
      });
      
      updateItemStatus(nextItem.id, 'analyzing', 40);

      // 2. AI Extraction
      const rawBase64 = base64String.split(',')[1];
      const result = await extractFinancialData(rawBase64, nextItem.file.type);
      
      if (!result) throw new Error("AI extraction failed");

      updateItemStatus(nextItem.id, 'saving', 80);

      // 3. Create Records
      const docId = `doc-${Date.now()}`;
      const transId = `tr-${Date.now()}`;

      const newDoc: DocumentRecord = {
        id: docId,
        name: nextItem.file.name,
        uploadDate: new Date().toISOString(),
        status: DocumentStatus.COMPLETED,
        fileSize: nextItem.file.size,
      };

      // Determine the transaction type
      let finalType: 'income' | 'expense' = 'expense';
      if (defaultType === 'auto') {
        finalType = result.type === 'income' ? 'income' : 'expense';
      } else {
        finalType = defaultType as 'income' | 'expense';
      }

      const newTrans: Transaction = {
        id: transId,
        date: result.date,
        vendor: result.vendor,
        amount: result.totalAmount,
        tax: result.taxAmount,
        category: result.category,
        currency: result.currency,
        type: finalType,
        documentId: docId,
        documentData: base64String,
        mimeType: nextItem.file.type
      };

      onProcessingComplete(newDoc, newTrans);
      updateItemStatus(nextItem.id, 'completed', 100);
    } catch (err) {
      console.error(err);
      updateItemStatus(nextItem.id, 'failed', 100, "Failed to process document");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateItemStatus = (id: string, status: QueueItem['status'], progress: number, error?: string) => {
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status, progress, error } : item
    ));
  };

  useEffect(() => {
    if (!isProcessing && queue.some(item => item.status === 'pending')) {
      processNextInQueue();
    }
  }, [queue, isProcessing]);

  const removeFinished = () => {
    setQueue(prev => prev.filter(item => item.status !== 'completed' && item.status !== 'failed'));
  };

  const removeItem = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const stats = {
    total: queue.length,
    completed: queue.filter(i => i.status === 'completed').length,
    failed: queue.filter(i => i.status === 'failed').length,
    pending: queue.filter(i => i.status === 'pending' || i.status === 'analyzing' || i.status === 'saving').length
  };

  const allFinished = stats.total > 0 && stats.pending === 0;

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Configuration Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Batch Processing Center</h2>
            <p className="text-sm text-slate-500">How should we categorize these documents?</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full md:w-80">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Batch Category</label>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setDefaultType('expense')}
              disabled={isProcessing}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${defaultType === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Expenses
            </button>
            <button 
              onClick={() => setDefaultType('income')}
              disabled={isProcessing}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${defaultType === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Income
            </button>
            <button 
              onClick={() => setDefaultType('auto')}
              disabled={isProcessing}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${defaultType === 'auto' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              AI Decide
            </button>
          </div>
        </div>
      </div>

      {/* Main Upload Zone */}
      <div 
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); !isProcessing && e.currentTarget.classList.add('border-indigo-500', 'bg-indigo-50/50'); }}
        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50/50'); }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50/50');
          if (isProcessing) return;
          const files = Array.from(e.dataTransfer.files) as File[];
          if (files.length > 0) {
            const newItems: QueueItem[] = files.map((file: File) => ({
              id: `q-${Math.random().toString(36).substr(2, 9)}`,
              file,
              status: 'pending' as const,
              progress: 0
            }));
            setQueue(prev => [...prev, ...newItems]);
          }
        }}
        className={`group relative bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center transition-all overflow-hidden ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-400 cursor-pointer'}`}
      >
        <div className="relative z-10">
          <div className={`mx-auto w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 transition-transform duration-500 shadow-sm ${!isProcessing && 'group-hover:scale-110'}`}>
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800">Drop documents here</h3>
          <p className="text-slate-500 text-sm mt-2 max-w-xs mx-auto">Upload multiple invoices, receipts, or bills. AI will extract data automatically.</p>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          multiple 
          className="hidden" 
          accept="image/*,application/pdf"
          onChange={handleFileSelection}
          disabled={isProcessing}
        />
      </div>

      {/* Queue List */}
      {queue.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500 mt-8">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-700">Processing Queue</span>
              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${allFinished ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                {allFinished ? 'Batch Complete' : `${stats.pending} Remaining`}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {allFinished ? (
                <button 
                  onClick={() => onAllDone && onAllDone()}
                  className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  Return to Dashboard
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-500" 
                      style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{Math.round((stats.completed / stats.total) * 100)}%</span>
               </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {queue.map((item) => (
              <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all duration-300 ${
                  item.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' :
                  item.status === 'failed' ? 'bg-rose-50 border-rose-100 text-rose-500' :
                  item.status === 'analyzing' || item.status === 'saving' ? 'bg-indigo-50 border-indigo-100 text-indigo-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  {item.status === 'completed' ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  ) : item.status === 'failed' ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  ) : item.status === 'analyzing' || item.status === 'saving' ? (
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-800 truncate pr-4">{item.file.name}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'completed' ? 'text-emerald-600' :
                      item.status === 'failed' ? 'text-rose-600' :
                      item.status === 'analyzing' ? 'text-indigo-600' : 'text-slate-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          item.status === 'completed' ? 'bg-emerald-500' :
                          item.status === 'failed' ? 'bg-rose-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  
                  {item.error && (
                    <p className="text-[10px] text-rose-500 font-medium mt-1">{item.error}</p>
                  )}
                </div>

                {!isProcessing && (
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benefits Section */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h4 className="font-bold text-slate-800 mb-2">High-Speed Extraction</h4>
          <p className="text-sm text-slate-500">Gemini 3 Flash analyzes your documents in seconds with industry-leading accuracy.</p>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h4 className="font-bold text-slate-800 mb-2">Queue Logic</h4>
          <p className="text-sm text-slate-500">Processing happens in the background. Documents are processed sequentially to ensure data integrity.</p>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h4 className="font-bold text-slate-800 mb-2">Secure Local Vault</h4>
          <p className="text-sm text-slate-500">Your documents are processed locally. Files are stored within your browser's private vault.</p>
        </div>
      </div>
    </div>
  );
};

export default Uploader;
