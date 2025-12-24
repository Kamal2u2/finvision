
import { api } from './api';
import { ExtractionResult } from "../types";

export const extractFinancialData = async (
  base64Data: string, 
  mimeType: string
): Promise<ExtractionResult | null> => {
  try {
    // The 'api.post' now handles retrieving the user context if in local mode
    // or the server handles it if in cloud mode.
    const result = await api.post('/analyze', { base64Data, mimeType });
    return result as ExtractionResult;
  } catch (error) {
    console.error("Extraction failed:", error);
    return null;
  }
};
