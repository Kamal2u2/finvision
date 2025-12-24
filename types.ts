
export enum DocumentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface Transaction {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  tax: number;
  category: string;
  currency: string;
  type: 'income' | 'expense';
  documentId: string;
  documentData?: string; // Base64 representation of the file
  mimeType?: string;     // To help the viewer render correctly
}

export interface DocumentRecord {
  id: string;
  name: string;
  uploadDate: string;
  status: DocumentStatus;
  fileSize: number;
  thumbnail?: string;
}

export interface ExtractionResult {
  date: string;
  vendor: string;
  totalAmount: number;
  taxAmount: number;
  category: string;
  currency: string;
  type?: 'income' | 'expense'; // AI inferred type
  items: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
}

export interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  burnRate: number;
  netProfit: number;
}
