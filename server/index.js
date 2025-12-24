
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
const JWT_SECRET = process.env.JWT_SECRET || 'finvision-super-secret-key';
const MONGO_URI = process.env.MONGODB_URI;

// 1. Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 2. Database Connection
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => { setDbConnected(true); console.log("✅ Connected to MongoDB Atlas"); })
    .catch((err) => { setDbConnected(false); console.error("❌ MongoDB connection error:", err); });
} else {
  setDbConnected(false);
}

// 3. Auth Helper
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

const getAI = () => {
  if (!process.env.API_KEY) throw new Error("API_KEY environment variable is missing");
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// 4. API Endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, name });
    const savedUser = await user.save();
    const userId = savedUser._id.toString();
    const token = jwt.sign({ id: userId, email: savedUser.email, name: savedUser.name }, JWT_SECRET);
    res.json({ token, user: { id: userId, name: savedUser.name, email: savedUser.email, gdriveFolderId: '' } });
  } catch (error) { res.status(500).json({ error: 'Registration failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    const userData = user?.toObject ? user.toObject() : user;
    if (!userData) return res.status(400).json({ error: 'Account not found' });
    if (!(await bcrypt.compare(password, userData.password))) return res.status(400).json({ error: 'Invalid password' });
    const token = jwt.sign({ id: userData._id.toString(), email: userData.email, name: userData.name }, JWT_SECRET);
    res.json({ token, user: { id: userData._id.toString(), name: userData.name, email: userData.email, gdriveFolderId: userData.gdriveFolderId || '' } });
  } catch (error) { res.status(500).json({ error: 'Login failed' }); }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { gdriveFolderId } = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.user.id, { gdriveFolderId });
    const userData = updatedUser?.toObject ? updatedUser.toObject() : updatedUser;
    res.json({ id: userData._id.toString(), name: userData.name, email: userData.email, gdriveFolderId: userData.gdriveFolderId });
  } catch (error) { res.status(500).json({ error: 'Profile update failed' }); }
});

app.get('/api/transactions', authenticateToken, async (req, res) => {
  const transactions = await Transaction.find({ userId: req.user.id });
  res.json(transactions);
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  const transactionData = { ...req.body, userId: req.user.id };
  const transaction = new Transaction(transactionData);
  const saved = await transaction.save();
  res.json(saved);
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
        parts: [{ inlineData: { data: base64Data, mimeType: mimeType } }, { text: `Extract financial data. Return JSON.` }]
      },
      config: {
        systemInstruction: `Analyze document for user "${req.user.name}". Identify if INCOME or EXPENSE. Extract: vendor, date (YYYY-MM-DD), totalAmount, category, currency, type.`,
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
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 5. Static File Serving (Monolith Mode)
// Serve all files from the project root for development/production simplicity
app.use(express.static(path.join(__dirname, '../')));

// 6. SPA Routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).send('API endpoint not found');
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(PORT, '0.0.0.0', () => { 
  console.log(`🚀 FinVision Monolith Service running on port ${PORT}`); 
});
