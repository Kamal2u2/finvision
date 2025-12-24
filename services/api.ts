
import { GoogleGenAI, Type } from "@google/genai";

// Available providers
export type StorageProvider = 'local' | 'gdrive';

const DB_KEYS = {
  USERS: 'fv_db_users',
  TRANSACTIONS: 'fv_db_transactions',
  CURRENT_USER: 'fv_user',
  TOKEN: 'fv_token',
  STORAGE_PROVIDER: 'fv_storage_provider',
  GDRIVE_FOLDER_ID: 'fv_gdrive_folder_id'
};

const getLocalData = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const setLocalData = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

export const api = {
  getStorageProvider(): StorageProvider {
    return (localStorage.getItem(DB_KEYS.STORAGE_PROVIDER) as StorageProvider) || 'local';
  },

  async setStorageProvider(provider: StorageProvider, folderId?: string) {
    localStorage.setItem(DB_KEYS.STORAGE_PROVIDER, provider);
    if (folderId !== undefined) {
      localStorage.setItem(DB_KEYS.GDRIVE_FOLDER_ID, folderId);
      
      const token = localStorage.getItem(DB_KEYS.TOKEN);
      if (token && folderId) {
        try {
          const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ gdriveFolderId: folderId })
          });
          const updatedUser = await res.json();
          localStorage.setItem(DB_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
        } catch (e) {
          console.error("Cloud profile sync failed", e);
        }
      }
    }
  },

  getGDriveFolderId(): string {
    const user = JSON.parse(localStorage.getItem(DB_KEYS.CURRENT_USER) || '{}');
    return user.gdriveFolderId || localStorage.getItem(DB_KEYS.GDRIVE_FOLDER_ID) || '';
  },

  async get(endpoint: string) {
    const provider = this.getStorageProvider();
    
    // In Monolith mode, we only use 'local' if user explicitly chose it for browsing
    // but the backend API is always at /api
    if (provider === 'local' && endpoint === '/transactions') {
      const user = JSON.parse(localStorage.getItem(DB_KEYS.CURRENT_USER) || '{}');
      const allTrans = getLocalData(DB_KEYS.TRANSACTIONS);
      const localResults = allTrans.filter((t: any) => t.userId === user.id);
      if (localResults.length > 0) return localResults;
    }

    const res = await fetch(`/api${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(DB_KEYS.TOKEN)}`
      }
    });
    
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Fetch failed');
    }
    return res.json();
  },

  async post(endpoint: string, data: any) {
    const provider = this.getStorageProvider();

    if (endpoint === '/auth/register' || endpoint === '/auth/login') {
      const res = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Auth failed');
      return json;
    }

    if (endpoint === '/transactions') {
      const user = JSON.parse(localStorage.getItem(DB_KEYS.CURRENT_USER) || '{}');
      if (provider === 'local') {
        const transactions = getLocalData(DB_KEYS.TRANSACTIONS);
        const processedData = { ...data, _id: data._id || 't-' + Date.now(), userId: user.id };
        transactions.push(processedData);
        setLocalData(DB_KEYS.TRANSACTIONS, transactions);
        return processedData;
      }
      
      const res = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(DB_KEYS.TOKEN)}`
        },
        body: JSON.stringify(data)
      });
      return res.json();
    }

    if (endpoint === '/analyze') {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(DB_KEYS.TOKEN)}`
        },
        body: JSON.stringify(data)
      });
      return res.json();
    }

    return {};
  },

  async delete(endpoint: string) {
    if (endpoint.startsWith('/transactions/')) {
      const provider = this.getStorageProvider();
      if (provider === 'local') {
        const id = endpoint.split('/').pop();
        const transactions = getLocalData(DB_KEYS.TRANSACTIONS);
        const filtered = transactions.filter((t: any) => (t._id !== id && t.id !== id));
        setLocalData(DB_KEYS.TRANSACTIONS, filtered);
        return { success: true };
      }

      const res = await fetch(`/api${endpoint}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem(DB_KEYS.TOKEN)}` }
      });
      return res.json();
    }
    return { success: true };
  },

  logout() {
    localStorage.removeItem(DB_KEYS.TOKEN);
    localStorage.removeItem(DB_KEYS.CURRENT_USER);
    window.location.reload();
  }
};
