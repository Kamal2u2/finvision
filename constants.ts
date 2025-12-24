
import { Transaction, DocumentStatus, DocumentRecord } from './types';

export const CATEGORIES = [
  'Software SaaS',
  'Office Supplies',
  'Rent',
  'Utilities',
  'Travel',
  'Marketing',
  'Payroll',
  'Other'
];

export const MOCK_DOCUMENTS: DocumentRecord[] = [
  {
    id: 'doc-1',
    name: 'AWS_Invoice_Dec_2023.pdf',
    uploadDate: '2023-12-15T10:30:00Z',
    status: DocumentStatus.COMPLETED,
    fileSize: 1024 * 450,
  },
  {
    id: 'doc-2',
    name: 'Starbucks_Receipt_1204.jpg',
    uploadDate: '2023-12-04T08:15:00Z',
    status: DocumentStatus.COMPLETED,
    fileSize: 1024 * 120,
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'tr-1',
    date: '2023-12-15',
    vendor: 'Amazon Web Services',
    amount: 1450.50,
    tax: 145.05,
    category: 'Software SaaS',
    currency: 'USD',
    type: 'expense',
    documentId: 'doc-1'
  },
  {
    id: 'tr-2',
    date: '2023-12-04',
    vendor: 'Starbucks',
    amount: 12.45,
    tax: 1.25,
    category: 'Other',
    currency: 'USD',
    type: 'expense',
    documentId: 'doc-2'
  },
  {
    id: 'tr-3',
    date: '2023-12-20',
    vendor: 'Stripe Payout',
    amount: 15400.00,
    tax: 0,
    category: 'Revenue',
    currency: 'USD',
    type: 'income',
    documentId: 'manual'
  },
  {
    id: 'tr-4',
    date: '2023-11-15',
    vendor: 'WeWork Office',
    amount: 2500.00,
    tax: 250.00,
    category: 'Rent',
    currency: 'USD',
    type: 'expense',
    documentId: 'doc-3'
  },
  {
    id: 'tr-5',
    date: '2023-11-10',
    vendor: 'LinkedIn Ads',
    amount: 800.00,
    tax: 80.00,
    category: 'Marketing',
    currency: 'USD',
    type: 'expense',
    documentId: 'doc-4'
  }
];
