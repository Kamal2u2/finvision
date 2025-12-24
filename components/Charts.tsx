
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { Transaction } from '../types';

interface ChartsProps {
  transactions: Transaction[];
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const AnalyticsCharts: React.FC<ChartsProps> = ({ transactions }) => {
  // Aggregate data for Trend Chart (Monthly Income vs Expense)
  const monthlyData = useMemo(() => {
    const dataMap = new Map<string, { income: number; expense: number; sortTime: number }>();

    transactions.forEach(t => {
      const date = new Date(t.date);
      // Create a key for uniqueness (Month + Year)
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      // Sort by first day of the month
      const sortTime = new Date(date.getFullYear(), date.getMonth(), 1).getTime();

      if (!dataMap.has(key)) {
        dataMap.set(key, { income: 0, expense: 0, sortTime });
      }

      const entry = dataMap.get(key)!;
      if (t.type === 'income') {
        entry.income += t.amount;
      } else {
        entry.expense += t.amount;
      }
    });

    // Convert to array and sort chronologically
    const result = Array.from(dataMap.entries()).map(([key, data]) => ({
      name: key.split(' ')[0], // Extract "Dec" from "Dec 2023" for x-axis brevity
      fullName: key, // Full name for potential tooltip use
      income: data.income,
      expense: data.expense,
      sortTime: data.sortTime
    }));

    return result.sort((a, b) => a.sortTime - b.sortTime);
  }, [transactions]);

  // Aggregate data for Category Breakdown
  const { pieData, categoryData } = useMemo(() => {
    const categoryMap = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
        return acc;
      }, {} as Record<string, number>);

    const data = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    const pData = data.length > 0 ? data : [{ name: 'No Data', value: 1 }];
    return { pieData: pData, categoryData: data };
  }, [transactions]);

  const pieColors = categoryData.length > 0 ? COLORS : ['#e2e8f0'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Trend Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Cash Flow Trend</h3>
        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 12, fill: '#64748b'}} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 12, fill: '#64748b'}} 
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value: number) => [`${value.toLocaleString()} PLN`, undefined]}
                labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="top" align="right" height={36}/>
              <Line type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="expense" name="Expenses" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Expense Breakdown</h3>
        <div className="h-72 w-full flex flex-col md:flex-row items-center">
          <div className="flex-1 w-full h-full min-w-0 relative">
             {/* Wrapper div with min-w-0 is crucial for flex children to allow ResponsiveContainer to calculate width correctly */}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => categoryData.length > 0 ? `${value.toLocaleString()} PLN` : ''} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 mt-4 md:mt-0 md:ml-4 overflow-y-auto max-h-48 scrollbar-hide shrink-0 w-full md:w-auto">
            {categoryData.length > 0 ? (
              categoryData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                  <span className="font-medium truncate max-w-[120px]" title={item.name}>{item.name}</span>
                  <span className="ml-auto text-slate-400 pl-2">{item.value.toLocaleString()} PLN</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center italic">No expenses yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
