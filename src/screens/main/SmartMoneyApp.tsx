import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, TrendingUp, TrendingDown, Calendar, Bell, Mail, 
  BarChart3, PieChart, CheckCircle, AlertCircle, List, Eye, Save, X, 
  Sparkles, Home, Car, Coffee, Utensils, Zap, Heart, ShoppingBag,
  GraduationCap, Shield, CreditCard, DollarSign, Target, TrendingDownIcon
} from 'lucide-react';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';

// Import all our services
import { GmailService } from '@/services/gmail/GmailService';
import { NotificationService } from '@/services/smartMoney/notificationService';
import { AnalyticsService } from '@/services/smartMoney/analyticsService';
import { DataService } from '@/services/smartMoney/dataService';
import { Analytics } from '@/types';

const SmartMoneyApp: React.FC = () => {
  // ... (existing state management)
  
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize services
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    setIsLoading(true);
    
    // Request notification permission
    await NotificationService.getInstance().requestPermission();
    
    // Load data
    const dataService = DataService.getInstance();
    const expenses = await dataService.getExpenses();
    const income = await dataService.getIncome();
    const reminders = await dataService.getReminders();
    
    setExpenses(expenses);
    setIncome(income);
    setReminders(reminders);
    
    // Generate analytics
    const analyticsService = AnalyticsService.getInstance();
    const monthlyAnalytics = analyticsService.generateAnalytics(expenses, income, 'monthly');
    setAnalytics(monthlyAnalytics);
    
    // Schedule notifications
    const notificationService = NotificationService.getInstance();
    await notificationService.scheduleDailyExpenseReminder();
    await notificationService.scheduleWeeklyAnalytics();
    
    setIsLoading(false);
  };

  const connectGmail = async () => {
    const gmailService = GmailService.getInstance();
    const success = await gmailService.authenticate();
    
    if (success) {
      setGmailConnected(true);
      const detectedReminders = await gmailService.scanEmailsForBills();
      setReminders([...reminders, ...detectedReminders]);
    }
  };

  // Enhanced Overview with Income Breakdown
  const renderEnhancedOverview = () => (
    <div className="space-y-8">
      {/* Existing hero section... */}
      
      {/* Income Breakdown Visualization */}
      <div className="bg-white bg-opacity-80 backdrop-blur-xl rounded-2xl p-6 border border-white border-opacity-50 shadow-xl">
        <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Where Your Money Goes
        </h3>
        
        {analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pie Chart */}
            <div className="relative">
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={analytics.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {analytics.categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            {/* Category Cards */}
            <div className="space-y-3">
              {analytics.categoryBreakdown.slice(0, 6).map((category, index) => (
                <div
                  key={category.category}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center space-x-4">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{category.icon}</span>
                      <div>
                        <p className="font-semibold text-gray-800">{category.category}</p>
                        <p className="text-sm text-gray-600">{category.percentage.toFixed(1)}% of income</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg" style={{ color: category.color }}>
                      ${category.amount.toFixed(2)}
                    </p>
                    <div className="flex items-center space-x-1">
                      {category.trend === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-red-500" />
                      ) : category.trend === 'down' ? (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
                      )}
                      <span className="text-xs text-gray-500">vs last month</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Monthly Trends Chart */}
      <div className="bg-white bg-opacity-80 backdrop-blur-xl rounded-2xl p-6 border border-white border-opacity-50 shadow-xl">
        <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          Financial Trends
        </h3>
        
        {analytics && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: number, name: string) => [`${value.toFixed(2)}`, name]}
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="income" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                name="Income"
              />
              <Line 
                type="monotone" 
                dataKey="expenses" 
                stroke="#ef4444" 
                strokeWidth={3}
                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                name="Expenses"
              />
              <Line 
                type="monotone" 
                dataKey="netFlow" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                name="Net Flow"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* AI Predictions */}
      <div className="bg-white bg-opacity-80 backdrop-blur-xl rounded-2xl p-6 border border-white border-opacity-50 shadow-xl">
        <h3 className="text-xl font-bold mb-6 flex items-center bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          <Sparkles className="h-6 w-6 mr-3 text-purple-600" />
          AI Predictions & Recommendations
        </h3>
        
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.predictions.map((prediction, index) => (
              <div
                key={prediction.category}
                className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-800">{prediction.category}</h4>
                  <div className="flex items-center space-x-1">
                    <Target className="h-4 w-4 text-purple-600" />
                    <span className="text-xs text-purple-600">
                      {(prediction.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>
                
                <div className="mb-3">
                  <p className="text-sm text-gray-600">Predicted next month:</p>
                  <p className="text-xl font-bold text-purple-700">
                    ${prediction.predictedAmount.toFixed(2)}
                  </p>
                </div>
                
                <div className="bg-white bg-opacity-50 rounded-lg p-3">
                  <p className="text-xs text-gray-700">{prediction.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Reminders Summary */}
      <div className="bg-white bg-opacity-80 backdrop-blur-xl rounded-2xl p-6 border border-white border-opacity-50 shadow-xl">
        <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
          Upcoming This Week
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reminders
            .filter(reminder => {
              const dueDate = new Date(reminder.dueDate);
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              return dueDate <= nextWeek && reminder.status === 'pending';
            })
            .slice(0, 6)
            .map(reminder => (
              <div
                key={reminder.id}
                className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-lg ${
                  new Date(reminder.dueDate) < new Date() 
                    ? 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200' 
                    : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-800">{reminder.title}</h4>
                  {reminder.autoDetected && (
                    <div className="bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs px-2 py-1 rounded-full">
                      AI
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-gray-800">${reminder.amount.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">Due: {new Date(reminder.dueDate).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {new Date(reminder.dueDate) < new Date() && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div className={`w-3 h-3 rounded-full ${
                      reminder.priority === 'high' ? 'bg-red-500' :
                      reminder.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}></div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  // Rest of the component remains the same...
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-cyan-50">
      {/* Loading State */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white bg-opacity-95 backdrop-blur-xl rounded-2xl p-8 flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <p className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Loading Smart Money...
            </p>
          </div>
        </div>
      )}

      {/* Header with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 text-white p-6">
        <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-10"></div>
        <div className="relative z-10 max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Smart Money</h1>
            <p className="text-blue-100">AI-powered personal finance management</p>
          </div>
          
          {/* Notification Bell */}
          <div className="relative">
            <button className="p-3 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm hover:bg-opacity-30 transition-all duration-300">
              <Bell className="h-6 w-6" />
              {notifications.filter(n => !n.read).length > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notifications.filter(n => !n.read).length}
                </div>
              )}
            </button>
          </div>
        </div>
        
        {/* Animated Background Elements */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white bg-opacity-10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-300 bg-opacity-20 rounded-full blur-2xl"></div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Navigation Tabs */}
        <div className="bg-white bg-opacity-80 backdrop-blur-xl rounded-2xl mb-8 border border-white border-opacity-50 shadow-xl">
          <div className="flex space-x-1 p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-3 px-6 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'overview' 
                  ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-1 py-3 px-6 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'transactions' 
                  ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`flex-1 py-3 px-6 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'reminders' 
                  ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Reminders
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 py-3 px-6 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'analytics' 
                  ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Analytics
            </button>
          </div>
        </div>

        {/* Main Content */}
        {activeTab === 'overview' && renderEnhancedOverview()}
        {/* Other tabs would be rendered here */}
      </div>
    </div>
  );
};

export default SmartMoneyApp;