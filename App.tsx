
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import StatCard from './components/StatCard';
import AnalyticsCharts from './components/Charts';
import Uploader from './components/Uploader';
import TransactionTable from './components/TransactionTable';
import DocumentModal from './components/DocumentModal';
import EditTransactionModal from './components/EditTransactionModal';
import Auth from './components/Auth';
import { Transaction, DashboardStats } from './types';
import { api, StorageProvider } from './services/api';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('fv_token'));
  const [activeView, setActiveView] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Storage Settings State
  const [storageProvider, setStorageProvider] = useState<StorageProvider>(api.getStorageProvider());
  const [gdriveFolderId, setGDriveFolderId] = useState(api.getGDriveFolderId());
  const [isVerifyingDrive, setIsVerifyingDrive] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(!!api.getGDriveFolderId() && api.getStorageProvider() === 'gdrive');

  useEffect(() => {
    if (isAuthenticated) {
      // Re-initialize Folder ID from profile after potential new login
      setGDriveFolderId(api.getGDriveFolderId());
      setIsDriveConnected(!!api.getGDriveFolderId() && api.getStorageProvider() === 'gdrive');
      fetchTransactions();
    }
  }, [isAuthenticated, storageProvider]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await api.get('/transactions');
      if (Array.isArray(data)) {
        const mappedData = data.map((t: any) => ({ ...t, id: t._id || t.id }));
        setTransactions(mappedData);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
  };

  const handleGDriveConnect = async () => {
    if (!gdriveFolderId || !gdriveFolderId.trim()) {
      alert("Please enter a valid Google Drive Folder ID.");
      return;
    }

    setIsVerifyingDrive(true);
    
    // Simulate API handshake with Google Drive
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsVerifyingDrive(false);
    setIsDriveConnected(true);
    // This now triggers a PUT to the cloud backend via the updated API service
    await api.setStorageProvider('gdrive', gdriveFolderId.trim());
    setStorageProvider('gdrive');
  };

  const handleDisconnectDrive = () => {
    setIsDriveConnected(false);
    setGDriveFolderId('');
    api.setStorageProvider('local', '');
    setStorageProvider('local');
  };

  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    const lowerTerm = searchTerm.toLowerCase();
    return transactions.filter(t => 
      t.vendor.toLowerCase().includes(lowerTerm) ||
      t.category.toLowerCase().includes(lowerTerm)
    );
  }, [transactions, searchTerm]);

  const handleDownloadCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ["Date", "Vendor", "Category", "Type", "Amount", "Currency"];
    const csvContent = [headers.join(","), ...filteredTransactions.map(t => [t.date, `"${t.vendor}"`, t.category, t.type, t.amount, t.currency].join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FinVision_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const calculatedStats = useMemo(() => {
    if (filteredTransactions.length === 0) return { totalRevenue: 0, totalExpenses: 0, netProfit: 0, burnRate: 0, revenueChange: "0%", expensesChange: "0%", profitChange: "0%", isRevPos: true, isExpPos: true, isProfitPos: true };
    const latestDate = new Date(Math.max(...filteredTransactions.map(t => new Date(t.date).getTime())));
    const currentMonth = latestDate.getMonth();
    const currentYear = latestDate.getFullYear();
    const currentItems = filteredTransactions.filter(t => new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear);
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevItems = filteredTransactions.filter(t => new Date(t.date).getMonth() === prevMonthDate.getMonth() && new Date(t.date).getFullYear() === prevMonthDate.getFullYear());
    const getTotals = (items: Transaction[]) => ({ rev: items.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), exp: items.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) });
    const curr = getTotals(currentItems);
    const prev = getTotals(prevItems);
    const calcChange = (c: number, p: number) => { if (p === 0) return { text: c > 0 ? "+100%" : "0%", isHigher: c > 0 }; const change = ((c - p) / Math.abs(p)) * 100; return { text: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, isHigher: change > 0 }; };
    const totalRev = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExp = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { 
      totalRevenue: totalRev, 
      totalExpenses: totalExp, 
      netProfit: totalRev - totalExp, 
      burnRate: Math.round(totalExp / 12), 
      revenueChange: calcChange(curr.rev, prev.rev).text, 
      expensesChange: calcChange(curr.exp, prev.exp).text, 
      profitChange: calcChange(curr.rev - curr.exp, prev.rev - prev.exp).text, 
      isRevPos: calcChange(curr.rev, prev.rev).isHigher, 
      isExpPos: !calcChange(curr.exp, prev.exp).isHigher, 
      isProfitPos: calcChange(curr.rev - curr.exp, prev.rev - prev.exp).isHigher 
    };
  }, [filteredTransactions]);

  const handleNewRecord = async (doc: any, trans: Transaction) => {
    try {
      const savedTrans = await api.post('/transactions', trans);
      if (savedTrans) {
        setTransactions(prev => [{ ...savedTrans, id: savedTrans._id || savedTrans.id }, ...prev]);
      }
    } catch (error) { console.error("Failed to save", error); }
  };

  const handleUpdateTransaction = async (updated: Transaction) => {
    try {
      const saved = await api.post('/transactions', updated);
      if (saved) {
        setTransactions(prev => prev.map(t => (t.id === (saved._id || saved.id) ? { ...saved, id: saved._id || saved.id } : t)));
        setEditingTransaction(null);
      }
    } catch (error) { alert("Failed to update"); }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try { await api.delete(`/transactions/${id}`); setTransactions(prev => prev.filter(t => t.id !== id)); } catch (error) { alert("Failed to delete"); }
  };

  const saveStorageSettings = async () => {
    if (storageProvider === 'gdrive' && !isDriveConnected) {
      alert("Please connect your Google Drive first.");
      return;
    }
    await api.setStorageProvider(storageProvider, gdriveFolderId);
    alert(`Storage configuration updated.`);
    fetchTransactions();
  };

  if (!isAuthenticated) return <Auth onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">
            {activeView === 'dashboard' ? 'Overview' : activeView === 'transactions' ? 'Transaction History' : activeView === 'upload' ? 'Upload Center' : 'Settings'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 w-48 md:w-64 transition-all" />
              <svg className="w-4 h-4 text-slate-400 absolute left-4 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <button onClick={handleLogout} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg">Sign Out</button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {loading ? <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent animate-spin rounded-full"></div></div> : (
            <>
              {/* Dashboard View */}
              <div className={activeView === 'dashboard' ? 'space-y-8 animate-in fade-in duration-500' : 'hidden'}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard label="Total Revenue" value={`${calculatedStats.totalRevenue.toLocaleString()} PLN`} change={calculatedStats.revenueChange} isPositive={calculatedStats.isRevPos} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                  <StatCard label="Total Expenses" value={`${calculatedStats.totalExpenses.toLocaleString()} PLN`} change={calculatedStats.expensesChange} isPositive={calculatedStats.isExpPos} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
                  <StatCard label="Burn Rate /mo" value={`${calculatedStats.burnRate.toLocaleString()} PLN`} change="Avg" isPositive={true} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
                  <StatCard label="Net Profit" value={`${calculatedStats.netProfit.toLocaleString()} PLN`} change={calculatedStats.profitChange} isPositive={calculatedStats.isProfitPos} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                </div>
                <AnalyticsCharts transactions={filteredTransactions} />
              </div>

              {/* Transactions View */}
              <div className={activeView === 'transactions' ? 'animate-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
                 <div className="mb-6 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-900">All Transactions</h2>
                    <div className="flex gap-3">
                      <button onClick={handleDownloadCSV} className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 text-sm font-semibold"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download CSV</button>
                      <button onClick={() => setActiveView('upload')} className="px-6 py-2 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all text-sm font-semibold flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>Process Document</button>
                    </div>
                 </div>
                 <TransactionTable transactions={filteredTransactions} onDelete={handleDeleteTransaction} onView={setViewingTransaction} onEdit={setEditingTransaction} />
              </div>

              {/* Upload View */}
              {activeView === 'upload' && <Uploader onProcessingComplete={handleNewRecord} onAllDone={() => setActiveView('dashboard')} />}

              {/* Settings View */}
              <div className={activeView === 'settings' ? 'max-w-2xl mx-auto py-12 space-y-8 animate-in fade-in duration-500' : 'hidden'}>
                <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    Account Storage Settings
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Storage Destination</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setStorageProvider('local')}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${storageProvider === 'local' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                          <p className={`font-bold ${storageProvider === 'local' ? 'text-indigo-700' : 'text-slate-700'}`}>Local Only</p>
                          <p className="text-xs text-slate-500 mt-1">Files saved to this browser profile.</p>
                        </button>
                        <button 
                          onClick={() => setStorageProvider('gdrive')}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${storageProvider === 'gdrive' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                          <p className={`font-bold ${storageProvider === 'gdrive' ? 'text-indigo-700' : 'text-slate-700'}`}>Personal Drive</p>
                          <p className="text-xs text-slate-500 mt-1">Sync to your private GDrive folder.</p>
                        </button>
                      </div>
                    </div>

                    {storageProvider === 'gdrive' && (
                      <div className="animate-in slide-in-from-top-2 duration-300">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Your Google Drive Folder ID</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Paste your private Folder ID here..." 
                            value={gdriveFolderId}
                            readOnly={isDriveConnected}
                            onChange={(e) => setGDriveFolderId(e.target.value)}
                            className={`flex-1 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${isDriveConnected ? 'bg-slate-50 border-emerald-100 text-slate-500' : 'bg-white border-slate-200'}`}
                          />
                          {!isDriveConnected ? (
                            <button 
                              onClick={handleGDriveConnect}
                              disabled={isVerifyingDrive}
                              className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 min-w-[100px] justify-center"
                            >
                              {isVerifyingDrive ? (
                                <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : 'Connect Account'}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                              <span className="text-xs font-bold whitespace-nowrap">Verified</span>
                            </div>
                          )}
                        </div>
                        {isDriveConnected && (
                          <button 
                            onClick={handleDisconnectDrive}
                            className="text-[10px] text-rose-500 hover:text-rose-600 font-bold mt-2 underline"
                          >
                            Unlink this folder
                          </button>
                        )}
                        <p className="text-[10px] text-slate-400 mt-2">Each user should paste their own folder ID. This will not be shared with other users.</p>
                      </div>
                    )}

                    <button 
                      onClick={saveStorageSettings}
                      disabled={storageProvider === 'gdrive' && !isDriveConnected}
                      className={`w-full py-3 font-bold rounded-xl shadow-lg transition-all ${storageProvider === 'gdrive' && !isDriveConnected ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'}`}
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>

                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-800">Clear Cache</h3>
                    <p className="text-xs text-slate-500">Removes local metadata and resets session.</p>
                  </div>
                  <button onClick={() => { if(confirm("Clear cache?")) { localStorage.clear(); window.location.reload(); }}} className="px-4 py-2 text-rose-600 text-xs font-bold hover:bg-rose-50 rounded-lg">Reset App</button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {viewingTransaction && <DocumentModal transaction={viewingTransaction} onClose={() => setViewingTransaction(null)} />}
      {editingTransaction && <EditTransactionModal transaction={editingTransaction} onSave={handleUpdateTransaction} onClose={() => setEditingTransaction(null)} />}
    </div>
  );
};

export default App;
