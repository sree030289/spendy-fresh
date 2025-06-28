// Script to make sure we have sample data in our app
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const addSampleData = async () => {
  console.log('Adding sample data for demonstration');
  
  // Sample expenses
  const expenses = [
    {
      id: 'sample-expense-1',
      title: 'Groceries',
      amount: 120.50,
      category: 'Food',
      date: new Date().toISOString().split('T')[0],
      type: 'expense'
    },
    {
      id: 'sample-expense-2',
      title: 'Utilities',
      amount: 85.75,
      category: 'Utilities',
      date: new Date().toISOString().split('T')[0],
      type: 'expense'
    }
  ];
  
  // Sample income
  const income = [
    {
      id: 'sample-income-1',
      title: 'Salary',
      amount: 2500,
      category: 'Salary',
      date: new Date().toISOString().split('T')[0],
      type: 'income'
    }
  ];
  
  // Sample reminders
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const reminders = [
    {
      id: 'sample-reminder-1',
      title: 'Rent Payment',
      amount: 1200,
      dueDate: nextWeek.toISOString().split('T')[0],
      status: 'pending',
      category: 'Rent',
      recurring: 'monthly',
      autoDetected: false,
      priority: 'high'
    }
  ];
  
  // Save to AsyncStorage
  await AsyncStorage.setItem('smart_money_expenses', JSON.stringify(expenses));
  await AsyncStorage.setItem('smart_money_income', JSON.stringify(income));
  await AsyncStorage.setItem('smart_money_reminders', JSON.stringify(reminders));
  
  console.log('Sample data added successfully!');
};

// Run the function if this is executed directly
if (require.main === module) {
  addSampleData().then(() => {
    console.log('Script completed');
  }).catch(err => {
    console.error('Error:', err);
  });
}

module.exports = { addSampleData };
