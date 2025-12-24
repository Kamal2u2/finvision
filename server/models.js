
import mongoose from 'mongoose';

let isMongoConnected = false;

// 1. Define Mongoose Schemas (The "Real" DB)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  gdriveFolderId: { type: String, default: '' }, // New field for per-user storage
  createdAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true }, 
  date: { type: String, required: true },
  vendor: { type: String, required: true },
  amount: { type: Number, required: true },
  tax: { type: Number, required: true },
  category: { type: String, required: true },
  currency: { type: String, required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  documentId: { type: String }
});

const MongoUser = mongoose.model('User', userSchema);
const MongoTransaction = mongoose.model('Transaction', transactionSchema);

// 2. Define In-Memory Storage (The "Fallback" DB)
const memoryUsers = [];
const memoryTransactions = [];

// 3. Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

export const setDbConnected = (status) => {
  isMongoConnected = status;
  if(!status) console.log("⚠️  Running in In-Memory Mode (Data will trigger reset on restart)");
};

export class User {
  constructor(data) {
    this.data = { ...data, _id: generateId(), gdriveFolderId: data.gdriveFolderId || '' };
  }

  async save() {
    if (isMongoConnected) {
      const u = new MongoUser(this.data);
      const saved = await u.save();
      this.data = saved.toObject();
      return this.data;
    }
    const index = memoryUsers.findIndex(u => u.email === this.data.email);
    if (index !== -1) {
      memoryUsers[index] = { ...memoryUsers[index], ...this.data };
      return memoryUsers[index];
    }
    memoryUsers.push(this.data);
    return this.data;
  }

  static async findOne(query) {
    if (isMongoConnected) return MongoUser.findOne(query);
    return memoryUsers.find(u => u.email === query.email);
  }

  static async findById(id) {
    if (isMongoConnected) return MongoUser.findById(id);
    return memoryUsers.find(u => u._id === id);
  }

  static async findByIdAndUpdate(id, update) {
    if (isMongoConnected) return MongoUser.findByIdAndUpdate(id, update, { new: true });
    const index = memoryUsers.findIndex(u => u._id === id);
    if (index !== -1) {
      memoryUsers[index] = { ...memoryUsers[index], ...update };
      return memoryUsers[index];
    }
    return null;
  }
}

export class Transaction {
  constructor(data) {
    this.data = { ...data, _id: generateId() };
  }

  async save() {
    if (isMongoConnected) {
      const t = new MongoTransaction(this.data);
      const saved = await t.save();
      this.data = saved.toObject();
      return this.data;
    }
    memoryTransactions.push(this.data);
    return this.data;
  }

  static async find(query) {
    if (isMongoConnected) return MongoTransaction.find(query);
    return memoryTransactions.filter(t => t.userId === query.userId);
  }

  static async findOneAndDelete(query) {
    if (isMongoConnected) return MongoTransaction.findOneAndDelete(query);
    const index = memoryTransactions.findIndex(t => t._id === query._id && t.userId === query.userId);
    if (index !== -1) {
      const deleted = memoryTransactions[index];
      memoryTransactions.splice(index, 1);
      return deleted;
    }
    return null;
  }
}
