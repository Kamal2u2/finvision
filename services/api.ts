
// Core API Service for FinVision AI
export type StorageProvider = 'local' | 'gdrive';

const DB_KEYS = {
  CURRENT_USER: 'fv_user',
  TOKEN: 'fv_token',
  STORAGE_PROVIDER: 'fv_storage_provider',
  GDRIVE_FOLDER_ID: 'fv_gdrive_folder_id'
};

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
          console.error("Cloud settings sync failed:", e);
        }
      }
    }
  },

  getGDriveFolderId(): string {
    const user = JSON.parse(localStorage.getItem(DB_KEYS.CURRENT_USER) || '{}');
    return user.gdriveFolderId || localStorage.getItem(DB_KEYS.GDRIVE_FOLDER_ID) || '';
  },

  async get(endpoint: string) {
    const res = await fetch(`/api${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(DB_KEYS.TOKEN)}`
      }
    });
    
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Server request failed');
    }
    return res.json();
  },

  async post(endpoint: string, data: any) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem(DB_KEYS.TOKEN);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Operation failed');
    return json;
  },

  async delete(endpoint: string) {
    const res = await fetch(`/api${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem(DB_KEYS.TOKEN)}`
      }
    });
    return res.json();
  },

  logout() {
    localStorage.removeItem(DB_KEYS.TOKEN);
    localStorage.removeItem(DB_KEYS.CURRENT_USER);
    window.location.reload();
  }
};
