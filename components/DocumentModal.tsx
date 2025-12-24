
import React, { useEffect, useState } from 'react';
import { Transaction } from '../types';

interface DocumentModalProps {
  transaction: Transaction;
  onClose: () => void;
}

const DocumentModal: React.FC<DocumentModalProps> = ({ transaction, onClose }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!transaction.documentData) return;

    // Helper to convert base64 to Blob
    const base64ToBlob = (base64Data: string) => {
      try {
        const parts = base64Data.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);

        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }

        return new Blob([uInt8Array], { type: contentType });
      } catch (e) {
        console.error("Failed to convert base64 to blob", e);
        return null;
      }
    };

    const blob = base64ToBlob(transaction.documentData);
    if (blob) {
      const url = URL.createObjectURL(blob);
      setObjectUrl(url);

      // Cleanup on unmount
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [transaction.documentData]);

  if (!transaction.documentData) return null;

  const isPDF = transaction.mimeType === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className="relative bg-white w-full max-w-4xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{transaction.vendor}</h3>
            <p className="text-xs text-slate-500">
              {new Date(transaction.date).toLocaleDateString()} • {transaction.amount} {transaction.currency}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 p-6 flex items-center justify-center">
          {objectUrl ? (
            isPDF ? (
              <iframe 
                src={`${objectUrl}#toolbar=0`}
                className="w-full h-full rounded-lg border border-slate-200 bg-white"
                title="Document Preview"
              />
            ) : (
              <img 
                src={objectUrl} 
                alt="Receipt Preview" 
                className="max-w-full max-h-full object-contain shadow-lg rounded-sm"
              />
            )
          ) : (
            <div className="text-slate-400 flex flex-col items-center gap-2">
               <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Preparing document view...</span>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
          {objectUrl && (
            <a 
              href={objectUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              Open in New Tab
            </a>
          )}
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentModal;
