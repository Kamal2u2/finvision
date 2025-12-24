
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

const CLOUD_API_URL = localStorage.getItem('fv_api_url') || 'http://localhost:3001/api';

const getLocalData = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const setLocalData = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

// --- Gemini Direct Integration ---
const runGeminiAnalysis = async (base64Data: string, mimeType: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const userData = JSON.parse(localStorage.getItem(DB_KEYS.CURRENT_USER) || '{"name": "Guest User"}');
  const userName = userData.name;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: mimeType } },
        { text: `The current user is "${userName}". Analyze this document relative to this user. Return JSON.` }
      ]
    },
    config: {
      systemInstruction: `You are a high-precision financial auditor specializing in international and Polish bookkeeping. 
      
      DETERMINING INCOME VS EXPENSE:
      - INCOME: User is SELLER/ISSUER. 
      - EXPENSE: User is BUYER/RECEIVER. 
      - RETAIL DEFAULT: Simple receipts are ALWAYS 'expense'.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          vendor: { type: Type.STRING },
          totalAmount: { type: Type.NUMBER },
          taxAmount: { type: Type.NUMBER },
          category: { type: Type.STRING },
          currency: { type: Type.STRING },
          type: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                price: { type: Type.NUMBER }
              }
            }
          }
        },
        required: ['date', 'vendor', 'totalAmount', 'category', 'currency', 'type']
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const api = {
  getStorageProvider(): StorageProvider {
    return (localStorage.getItem(DB_KEYS.STORAGE_PROVIDER) as StorageProvider) || 'local';
  },

  setStorageProvider(provider: StorageProvider, folderId?: string) {
    localStorage.setItem(DB_KEYS.STORAGE_PROVIDER, provider);
    if (folderId !== undefined) localStorage.setItem(DB_KEYS.GDRIVE_FOLDER_ID, folderId);
  },

  getGDriveFolderId(): string {
    return localStorage.getItem(DB_KEYS.GDRIVE_FOLDER_ID) || '';
  },

  setBaseUrl(url: string) {
    localStorage.setItem('fv_api_url', url);
  },

  async get(endpoint: string) {
    const provider = this.getStorageProvider();
    
    if (provider === 'local') {
      if (endpoint === '/transactions') {
        const user = JSON.parse(localStorage.getItem(DB_KEYS.CURRENT_USER) || '{}');
        const allTrans = getLocalData(DB_KEYS.TRANSACTIONS);
        return allTrans.filter((t: any) => t.userId === user.id);
      }
      return [];
    }

    if (provider === 'gdrive') {
       console.log("Fetching from GDrive Folder:", this.getGDriveFolderId());
       return getLocalData(DB_KEYS.TRANSACTIONS); 
    }

    const res = await fetch(`${CLOUD_API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(DB_KEYS.TOKEN)}`
      }
    });
    return res.json();
  },

  async post(endpoint: string, data: any) {
    const provider = this.getStorageProvider();

    if (endpoint === '/auth/register') {
      const users = getLocalData(DB_KEYS.USERS);
      if (users.find((u: any) => u.email === data.email)) throw new Error('Email exists');
      const newUser = { ...data, id: 'u-' + Date.now() };
      users.push(newUser);
      setLocalData(DB_KEYS.USERS, users);
      return { token: 'local-token-' + newUser.id, user: newUser };
    }

    if (endpoint === '/auth/login') {
      const users = getLocalData(DB_KEYS.USERS);
      const user = users.find((u: any) => u.email === data.email && u.password === data.password);
      if (!user) throw new Error('Invalid credentials');
      return { token: 'local-token-' + user.id, user };
    }

    if (endpoint === '/transactions') {
      const user = JSON.parse(localStorage.getItem(DB_KEYS.CURRENT_USER) || '{}');
      const transactions = getLocalData(DB_KEYS.TRANSACTIONS);
      
      const id = data.id || data._id;
      const index = id ? transactions.findIndex((t: any) => (t.id === id || t._id === id)) : -1;

      let processedData;
      if (index !== -1) {
        transactions[index] = { ...transactions[index], ...data };
        processedData = transactions[index];
      } else {
        processedData = { ...data, _id: id || 't-' + Date.now(), userId: data.userId || user.id };
        transactions.push(processedData);
      }
      
      setLocalData(DB_KEYS.TRANSACTIONS, transactions);

      if (provider === 'gdrive') {
        console.log("Syncing transaction to GDrive folder:", this.getGDriveFolderId());
      }
      
      return processedData;
    }

    if (endpoint === '/analyze') {
      return await runGeminiAnalysis(data.base64Data, data.mimeType);
    }

    return {};
  },

  async delete(endpoint: string) {
    if (endpoint.startsWith('/transactions/')) {
      const id = endpoint.split('/').pop();
      const transactions = getLocalData(DB_KEYS.TRANSACTIONS);
      const filtered = transactions.filter((t: any) => (t._id !== id && t.id !== id));
      setLocalData(DB_KEYS.TRANSACTIONS, filtered);
      return { success: true };
    }
    return { success: true };
  },

  logout() {
    localStorage.removeItem(DB_KEYS.TOKEN);
    localStorage.removeItem(DB_KEYS.CURRENT_USER);
    window.location.reload();
  }
};
