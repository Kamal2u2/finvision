
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from "@google/genai";
import { User, Transaction, setDbConnected } from './models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'finvision-secure-monolith-key-2024';
const MONGO_URI = process.env.MONGODB_URI;

// 1. Core Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 2. Database Initialization
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => { 
      setDbConnected(true); 
      console.log("✅ Database: MongoDB Atlas Connected"); 
    })
    .catch((err) => { 
      setDbConnected(false); 
      console.error("❌ Database: Connection Failed, using In-Memory Fallback", err); 
    });
} else {
  setDbConnected(false);
  console.log("ℹ️ Database: No MONGODB_URI found, using In-Memory Mode");
}

// 3. Secure Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// 4. Gemini AI Provider
const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("SaaS Configuration Error: API_KEY is missing in server environment.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- API ENDPOINTS ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'This email is already registered.' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, name });
    const savedUser = await user.save();
    
    const token = jwt.sign({ 
      id: savedUser._id.toString(), 
      email: savedUser.email, 
      name: savedUser.name 
    }, JWT_SECRET);
    
    res.json({ 
      token, 
      user: { id: savedUser._id.toString(), name: savedUser.name, email: savedUser.email, gdriveFolderId: '' } 
    });
  } catch (error) { res.status(500).json({ error: 'Cloud registration failed.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    const userData = user?.toObject ? user.toObject() : user;
    
    if (!userData || !(await bcrypt.compare(password, userData.password))) {
      return res.status(400).json({ error: 'Invalid credentials. Please try again.' });
    }
    
    const token = jwt.sign({ 
      id: userData._id.toString(), 
      email: userData.email, 
      name: userData.name 
    }, JWT_SECRET);
    
    res.json({ 
      token, 
      user: { id: userData._id.toString(), name: userData.name, email: userData.email, gdriveFolderId: userData.gdriveFolderId || '' } 
    });
  } catch (error) { res.status(500).json({ error: 'Authentication failed.' }); }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { gdriveFolderId } = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.user.id, { gdriveFolderId });
    const userData = updatedUser?.toObject ? updatedUser.toObject() : updatedUser;
    res.json({ 
      id: userData._id.toString(), 
      name: userData.name, 
      email: userData.email, 
      gdriveFolderId: userData.gdriveFolderId 
    });
  } catch (error) { res.status(500).json({ error: 'Settings update failed.' }); }
});

app.get('/api/transactions', authenticateToken, async (req, res) => {
  const transactions = await Transaction.find({ userId: req.user.id });
  res.json(transactions);
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transaction = new Transaction({ ...req.body, userId: req.user.id });
    const saved = await transaction.save();
    res.json(saved);
  } catch (err) { res.status(500).json({ error: 'Failed to save transaction.' }); }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ success: true });
});

app.post('/api/analyze', authenticateToken, async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    const ai = getAI();
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: `Analyze document for business user "${req.user.name}". Output JSON.` }
        ]
      },
      config: {
        systemInstruction: `You are a professional SaaS financial auditor. Extract data into structured JSON. 
        Identify if it is INCOME (user is seller) or EXPENSE (user is buyer). 
        Fields: date (YYYY-MM-DD), vendor, totalAmount, taxAmount, category, currency, type.`,
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
            type: { type: Type.STRING }
          },
          required: ['date', 'vendor', 'totalAmount', 'category', 'currency', 'type']
        }
      }
    });
    
    res.json(JSON.parse(response.text));
  } catch (error) { 
    console.error("AI Error:", error);
    res.status(500).json({ error: "Intelligence Engine failed: " + error.message }); 
  }
});

// 5. Static Asset Management (Monolith Mode)
// Serve built files from 'dist' (created by Vite during build)
const staticPath = path.join(__dirname, '../dist');
app.use(express.static(staticPath));

// 6. SPA Router Fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Endpoint not found' });
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 FinVision Monolith Service is LIVE on port ${PORT}`);
});
