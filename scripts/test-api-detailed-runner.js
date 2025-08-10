const { spawn } = require('child_process');
const fetch = require('node-fetch');

// Try multiple possible URLs for the Firebase Functions
const POSSIBLE_URLS = [
  'http://127.0.0.1:5001/spendy-97913/us-central1/spendyApi',
  'http://localhost:5001/spendy-97913/us-central1/spendyApi',
  'http://127.0.0.1:5002/spendy-97913/us-central1/spendyApi',
  'http://localhost:5002/spendy-97913/us-central1/spendyApi'
];

let BASE_URL = null;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log(colorize('\n' + '═'.repeat(80), 'cyan'));
  console.log(colorize(`  ${title}`, 'bright'));
  console.log(colorize('═'.repeat(80), 'cyan'));
}

function printSection(title) {
  console.log(colorize('\n' + '─'.repeat(60), 'blue'));
  console.log(colorize(`  ${title}`, 'yellow'));
  console.log(colorize('─'.repeat(60), 'blue'));
}

async function runPlaywrightTests() {
  return new Promise((resolve, reject) => {
    printHeader('🚀 SPENDY API COMPREHENSIVE TEST SUITE');
    
    const testProcess = spawn('npx', ['playwright', 'test', 'tests/e2e/specs/', '--reporter=list'], {
      stdio: 'inherit',
      shell: true
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(colorize('\n✅ All API tests completed successfully!', 'green'));
      } else {
        console.log(colorize('\n⚠️  Some tests failed, but continuing with data analysis...', 'yellow'));
      }
      resolve(code);
    });

    testProcess.on('error', (error) => {
      console.error(colorize(`\n❌ Error running tests: ${error.message}`, 'red'));
      resolve(1); // Continue even if tests fail
    });
  });
}

async function createTestUsersAndAnalyze() {
  printHeader('📊 POST-TEST DATA ANALYSIS & USER MANAGEMENT DEMO');
  
  const timestamp = Date.now();
  const users = [];
  
  // Create 4 test users for demonstration
  const userNames = [
    { name: 'Alice', role: 'Admin' },
    { name: 'Bob', role: 'Member' },
    { name: 'Charlie', role: 'Member' },
    { name: 'Diana', role: 'Member' }
  ];
  
  printSection('👥 Creating Test Users');
  
  for (const userInfo of userNames) {
    try {
      const email = `${userInfo.name.toLowerCase()}_demo_${timestamp}@spendytest.com`;
      const password = 'TestPassword123!';
      
      // Register user
      const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName: `Demo ${userInfo.name}`,
          country: 'US',
          currency: 'USD'
        })
      });
      
      if (registerResponse.ok) {
        const registerData = await registerResponse.json();
        
        // Login to get token
        const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          users.push({
            name: userInfo.name,
            role: userInfo.role,
            email,
            id: loginData.data.user.id,
            token: loginData.data.token,
            fullName: `Demo ${userInfo.name}`
          });
          
          console.log(colorize(`  ✅ Created: ${userInfo.name} (${email})`, 'green'));
        }
      }
    } catch (error) {
      console.log(colorize(`  ❌ Failed to create user ${userInfo.name}: ${error.message}`, 'red'));
    }
  }
  
  if (users.length === 0) {
    console.log(colorize('\n❌ No users created. API might not be running.', 'red'));
    console.log(colorize('Please start Firebase functions: cd functions && npm start', 'yellow'));
    return;
  }
  
  // Create friendships
  printSection('🤝 Creating Friend Networks');
  const friendships = await createFriendships(users);
  
  // Create groups
  printSection('👥 Creating Groups');
  const groups = await createGroups(users);
  
  // Create expenses
  printSection('💰 Creating Sample Expenses');
  const expenses = await createExpenses(users, groups);
  
  // Print comprehensive analysis
  await printComprehensiveAnalysis(users, groups, expenses, friendships);
}

async function createFriendships(users) {
  const friendships = [];
  
  // Alice befriends everyone
  for (let i = 1; i < users.length; i++) {
    try {
      // Send friend request
      const requestResponse = await fetch(`${BASE_URL}/friends/requests/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${users[0].token}`
        },
        body: JSON.stringify({ 
          toEmail: users[i].email,
          message: `Hi ${users[i].name}! Let's be friends on Spendy!`
        })
      });
      
      if (requestResponse.ok) {
        // Get friend requests for the target user
        const requestsResponse = await fetch(`${BASE_URL}/friends/requests`, {
          headers: { 'Authorization': `Bearer ${users[i].token}` }
        });
        
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json();
          const pendingRequest = requestsData.data.incoming.find(req => 
            req.fromUser.email === users[0].email
          );
          
          if (pendingRequest) {
            // Accept the friend request
            const acceptResponse = await fetch(`${BASE_URL}/friends/requests/accept`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${users[i].token}`
              },
              body: JSON.stringify({ requestId: pendingRequest.id })
            });
            
            if (acceptResponse.ok) {
              friendships.push({
                user1: users[0].name,
                user1Email: users[0].email,
                user2: users[i].name,
                user2Email: users[i].email,
                status: 'active'
              });
              console.log(colorize(`  ✅ ${users[0].name} ↔ ${users[i].name}`, 'green'));
            }
          }
        }
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.log(colorize(`  ❌ Failed to create friendship: ${error.message}`, 'red'));
    }
  }
  
  // Bob and Charlie become friends
  try {
    const requestResponse = await fetch(`${BASE_URL}/friends/requests/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${users[1].token}`
      },
      body: JSON.stringify({ 
        toEmail: users[2].email,
        message: `Hey ${users[2].name}! Want to connect?`
      })
    });
    
    if (requestResponse.ok) {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const requestsResponse = await fetch(`${BASE_URL}/friends/requests`, {
        headers: { 'Authorization': `Bearer ${users[2].token}` }
      });
      
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        const pendingRequest = requestsData.data.incoming.find(req => 
          req.fromUser.email === users[1].email
        );
        
        if (pendingRequest) {
          const acceptResponse = await fetch(`${BASE_URL}/friends/requests/accept`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${users[2].token}`
            },
            body: JSON.stringify({ requestId: pendingRequest.id })
          });
          
          if (acceptResponse.ok) {
            friendships.push({
              user1: users[1].name,
              user1Email: users[1].email,
              user2: users[2].name,
              user2Email: users[2].email,
              status: 'active'
            });
            console.log(colorize(`  ✅ ${users[1].name} ↔ ${users[2].name}`, 'green'));
          }
        }
      }
    }
  } catch (error) {
    console.log(colorize(`  ❌ Failed to create Bob-Charlie friendship: ${error.message}`, 'red'));
  }
  
  return friendships;
}

async function createGroups(users) {
  const groups = [];
  
  try {
    // Alice creates "Weekend Trip" group
    const group1Response = await fetch(`${BASE_URL}/groups`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${users[0].token}`
      },
      body: JSON.stringify({
        name: `Weekend Trip - ${Date.now()}`,
        description: 'Planning our weekend getaway expenses',
        category: 'travel',
        currency: 'USD',
        avatar: '🏖️'
      })
    });
    
    if (group1Response.ok) {
      const group1Data = await group1Response.json();
      const group1 = group1Data.data.group;
      
      // Add Bob and Charlie to the group
      for (const user of [users[1], users[2]]) {
        try {
          await fetch(`${BASE_URL}/groups/${group1.id}/members`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${users[0].token}`
            },
            body: JSON.stringify({ email: user.email })
          });
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.log(colorize(`    ⚠️  Failed to add ${user.name} to group`, 'yellow'));
        }
      }
      
      groups.push({
        id: group1.id,
        name: group1.name,
        description: group1.description,
        admin: users[0].name,
        adminEmail: users[0].email,
        members: [users[0].name, users[1].name, users[2].name],
        memberEmails: [users[0].email, users[1].email, users[2].email],
        category: 'travel',
        currency: 'USD'
      });
      
      console.log(colorize(`  ✅ Created: ${group1.name}`, 'green'));
      console.log(colorize(`     Admin: ${users[0].name} (${users[0].email})`, 'blue'));
      console.log(colorize(`     Members: ${users[1].name}, ${users[2].name}`, 'blue'));
    }
    
    // Bob creates "Dinner Club" group
    const group2Response = await fetch(`${BASE_URL}/groups`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${users[1].token}`
      },
      body: JSON.stringify({
        name: `Dinner Club - ${Date.now()}`,
        description: 'Monthly dinner meetups',
        category: 'food',
        currency: 'USD',
        avatar: '🍽️'
      })
    });
    
    if (group2Response.ok) {
      const group2Data = await group2Response.json();
      const group2 = group2Data.data.group;
      
      // Add Diana to the group
      try {
        await fetch(`${BASE_URL}/groups/${group2.id}/members`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${users[1].token}`
          },
          body: JSON.stringify({ email: users[3].email })
        });
      } catch (error) {
        console.log(colorize(`    ⚠️  Failed to add ${users[3].name} to group`, 'yellow'));
      }
      
      groups.push({
        id: group2.id,
        name: group2.name,
        description: group2.description,
        admin: users[1].name,
        adminEmail: users[1].email,
        members: [users[1].name, users[3].name],
        memberEmails: [users[1].email, users[3].email],
        category: 'food',
        currency: 'USD'
      });
      
      console.log(colorize(`  ✅ Created: ${group2.name}`, 'green'));
      console.log(colorize(`     Admin: ${users[1].name} (${users[1].email})`, 'blue'));
      console.log(colorize(`     Members: ${users[3].name}`, 'blue'));
    }
  } catch (error) {
    console.log(colorize(`  ❌ Failed to create groups: ${error.message}`, 'red'));
  }
  
  return groups;
}

async function createExpenses(users, groups) {
  const expenses = [];
  
  if (groups.length === 0) {
    console.log(colorize('  ⚠️  No groups available for expense creation', 'yellow'));
    return expenses;
  }
  
  try {
    // Create expense in first group (Weekend Trip)
    if (groups[0]) {
      const expense1Response = await fetch(`${BASE_URL}/expenses`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${users[0].token}`
        },
        body: JSON.stringify({
          groupId: groups[0].id,
          description: 'Hotel booking for weekend trip',
          amount: 450.00,
          currency: 'USD',
          category: 'accommodation',
          splitType: 'equal',
          participants: [
            { userId: users[0].id, amount: 150.00 },
            { userId: users[1].id, amount: 150.00 },
            { userId: users[2].id, amount: 150.00 }
          ]
        })
      });
      
      if (expense1Response.ok) {
        const expense1Data = await expense1Response.json();
        expenses.push({
          id: expense1Data.data.expense.id,
          description: 'Hotel booking for weekend trip',
          amount: 450.00,
          group: groups[0].name,
          paidBy: users[0].name,
          splitBetween: [users[0].name, users[1].name, users[2].name]
        });
        console.log(colorize(`  ✅ Created expense: Hotel booking ($450.00)`, 'green'));
      }
    }
    
    // Create expense in second group (Dinner Club)
    if (groups[1]) {
      const expense2Response = await fetch(`${BASE_URL}/expenses`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${users[1].token}`
        },
        body: JSON.stringify({
          groupId: groups[1].id,
          description: 'Fancy restaurant dinner',
          amount: 125.50,
          currency: 'USD',
          category: 'dining',
          splitType: 'equal',
          participants: [
            { userId: users[1].id, amount: 62.75 },
            { userId: users[3].id, amount: 62.75 }
          ]
        })
      });
      
      if (expense2Response.ok) {
        const expense2Data = await expense2Response.json();
        expenses.push({
          id: expense2Data.data.expense.id,
          description: 'Fancy restaurant dinner',
          amount: 125.50,
          group: groups[1].name,
          paidBy: users[1].name,
          splitBetween: [users[1].name, users[3].name]
        });
        console.log(colorize(`  ✅ Created expense: Restaurant dinner ($125.50)`, 'green'));
      }
    }
  } catch (error) {
    console.log(colorize(`  ❌ Failed to create expenses: ${error.message}`, 'red'));
  }
  
  return expenses;
}

async function printComprehensiveAnalysis(users, groups, expenses, friendships) {
  printHeader('📋 COMPREHENSIVE DATA ANALYSIS REPORT');
  
  // Users Summary
  printSection('👥 USER DIRECTORY');
  console.log(colorize(`Total Users Created: ${users.length}`, 'bright'));
  users.forEach((user, index) => {
    console.log(colorize(`\n[${index + 1}] ${user.name} (${user.role})`, 'cyan'));
    console.log(colorize(`    📧 Email: ${user.email}`, 'white'));
    console.log(colorize(`    🆔 User ID: ${user.id}`, 'white'));
    console.log(colorize(`    👤 Full Name: ${user.fullName}`, 'white'));
  });
  
  // Friends Network
  printSection('🤝 FRIENDSHIP NETWORK');
  console.log(colorize(`Total Friendships: ${friendships.length}`, 'bright'));
  if (friendships.length > 0) {
    friendships.forEach((friendship, index) => {
      console.log(colorize(`\n[${index + 1}] ${friendship.user1} ↔ ${friendship.user2}`, 'green'));
      console.log(colorize(`    📧 ${friendship.user1Email} ↔ ${friendship.user2Email}`, 'white'));
      console.log(colorize(`    📊 Status: ${friendship.status}`, 'white'));
    });
    
    // Friend connections per user
    console.log(colorize('\n🔗 Friend Connections by User:', 'yellow'));
    users.forEach(user => {
      const userFriendships = friendships.filter(f => 
        f.user1Email === user.email || f.user2Email === user.email
      );
      const friendNames = userFriendships.map(f => 
        f.user1Email === user.email ? f.user2 : f.user1
      );
      console.log(colorize(`  ${user.name}: ${friendNames.join(', ') || 'No friends'}`, 'white'));
    });
  } else {
    console.log(colorize('  No friendships created', 'yellow'));
  }
  
  // Groups Analysis
  printSection('👥 GROUP ANALYSIS');
  console.log(colorize(`Total Groups Created: ${groups.length}`, 'bright'));
  if (groups.length > 0) {
    groups.forEach((group, index) => {
      console.log(colorize(`\n[${index + 1}] ${group.name}`, 'magenta'));
      console.log(colorize(`    📝 Description: ${group.description}`, 'white'));
      console.log(colorize(`    🆔 Group ID: ${group.id}`, 'white'));
      console.log(colorize(`    👑 Admin: ${group.admin} (${group.adminEmail})`, 'yellow'));
      console.log(colorize(`    👥 Members (${group.members.length}):`, 'white'));
      group.members.forEach((member, i) => {
        console.log(colorize(`        ${i + 1}. ${member} (${group.memberEmails[i]})`, 'blue'));
      });
      console.log(colorize(`    🏷️  Category: ${group.category}`, 'white'));
      console.log(colorize(`    💱 Currency: ${group.currency}`, 'white'));
    });
    
    // Group membership matrix
    console.log(colorize('\n📊 Group Membership Matrix:', 'yellow'));
    users.forEach(user => {
      const userGroups = groups.filter(g => g.memberEmails.includes(user.email));
      const groupInfo = userGroups.map(g => `${g.name} (${g.admin === user.name ? 'Admin' : 'Member'})`);
      console.log(colorize(`  ${user.name}: ${groupInfo.join(', ') || 'No groups'}`, 'white'));
    });
  } else {
    console.log(colorize('  No groups created', 'yellow'));
  }
  
  // Expenses Analysis
  printSection('💰 EXPENSE ANALYSIS');
  console.log(colorize(`Total Expenses Created: ${expenses.length}`, 'bright'));
  if (expenses.length > 0) {
    let totalAmount = 0;
    expenses.forEach((expense, index) => {
      console.log(colorize(`\n[${index + 1}] ${expense.description}`, 'green'));
      console.log(colorize(`    💵 Amount: $${expense.amount.toFixed(2)}`, 'white'));
      console.log(colorize(`    🆔 Expense ID: ${expense.id}`, 'white'));
      console.log(colorize(`    👥 Group: ${expense.group}`, 'white'));
      console.log(colorize(`    💳 Paid by: ${expense.paidBy}`, 'white'));
      console.log(colorize(`    🔄 Split between: ${expense.splitBetween.join(', ')}`, 'white'));
      totalAmount += expense.amount;
    });
    
    console.log(colorize(`\n💰 Total Amount: $${totalAmount.toFixed(2)}`, 'bright'));
    console.log(colorize(`📊 Average Expense: $${(totalAmount / expenses.length).toFixed(2)}`, 'bright'));
  } else {
    console.log(colorize('  No expenses created', 'yellow'));
  }
  
  // Summary Statistics
  printSection('📈 SUMMARY STATISTICS');
  console.log(colorize(`👥 Total Users: ${users.length}`, 'cyan'));
  console.log(colorize(`🤝 Total Friendships: ${friendships.length}`, 'cyan'));
  console.log(colorize(`👥 Total Groups: ${groups.length}`, 'cyan'));
  console.log(colorize(`💰 Total Expenses: ${expenses.length}`, 'cyan'));
  console.log(colorize(`💵 Total Money Tracked: $${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}`, 'cyan'));
  
  const avgFriendsPerUser = users.length > 0 ? (friendships.length * 2) / users.length : 0;
  const avgGroupsPerUser = users.length > 0 ? groups.reduce((sum, g) => sum + g.members.length, 0) / users.length : 0;
  
  console.log(colorize(`📊 Average Friends per User: ${avgFriendsPerUser.toFixed(1)}`, 'cyan'));
  console.log(colorize(`📊 Average Groups per User: ${avgGroupsPerUser.toFixed(1)}`, 'cyan'));
  
  // Email Directory
  printSection('📧 EMAIL DIRECTORY');
  console.log(colorize('Complete Email List:', 'bright'));
  users.forEach((user, index) => {
    console.log(colorize(`  ${index + 1}. ${user.email} (${user.name} - ${user.role})`, 'white'));
  });
  
  // Links and Connections
  printSection('🔗 CONNECTION LINKS');
  console.log(colorize('User-Group Connections:', 'bright'));
  groups.forEach(group => {
    console.log(colorize(`\n📁 ${group.name}:`, 'magenta'));
    console.log(colorize(`   Admin Link: ${group.adminEmail} → ${group.name}`, 'yellow'));
    group.memberEmails.forEach(email => {
      const isAdmin = email === group.adminEmail;
      console.log(colorize(`   Member Link: ${email} → ${group.name} ${isAdmin ? '(Admin)' : '(Member)'}`, 'blue'));
    });
  });
  
  console.log(colorize('\nFriend Connection Links:', 'bright'));
  friendships.forEach((friendship, index) => {
    console.log(colorize(`  ${index + 1}. ${friendship.user1Email} ↔ ${friendship.user2Email}`, 'green'));
  });
  
  printHeader('✅ ANALYSIS COMPLETE');
  console.log(colorize('All API tests executed and user data analyzed successfully!', 'green'));
  console.log(colorize('This demonstrates the complete Spendy application functionality:', 'white'));
  console.log(colorize('  • User Registration & Authentication', 'blue'));
  console.log(colorize('  • Friend Management & Requests', 'blue'));
  console.log(colorize('  • Group Creation & Member Management', 'blue'));
  console.log(colorize('  • Expense Tracking & Splitting', 'blue'));
  console.log(colorize('  • Data Relationships & Analytics', 'blue'));
}

async function findWorkingApiUrl() {
  console.log(colorize('🔍 Searching for running Firebase Functions API...', 'yellow'));
  
  for (const url of POSSIBLE_URLS) {
    try {
      console.log(colorize(`  Trying: ${url}`, 'blue'));
      const response = await fetch(`${url}/health`, { 
        timeout: 3000,
        headers: { 'User-Agent': 'test-script' }
      });
      if (response.ok) {
        console.log(colorize(`  ✅ Found working API at: ${url}`, 'green'));
        return url;
      }
    } catch (error) {
      console.log(colorize(`  ❌ Not responding: ${url}`, 'red'));
    }
  }
  
  return null;
}

async function main() {
  try {
    // Find the working API URL
    BASE_URL = await findWorkingApiUrl();
    
    if (!BASE_URL) {
      console.log(colorize('\n❌ Firebase Functions API is not running on any expected port!', 'red'));
      console.log(colorize('Please start the API first:', 'yellow'));
      console.log(colorize('  cd functions && npm start', 'cyan'));
      console.log(colorize('  OR', 'yellow'));
      console.log(colorize('  firebase emulators:start --only functions', 'cyan'));
      process.exit(1);
    }
    
    // Run the complete test suite
    const testResult = await runPlaywrightTests();
    
    // Create demo data and analyze
    await createTestUsersAndAnalyze();
    
    process.exit(testResult);
  } catch (error) {
    console.error(colorize(`\n❌ Fatal error: ${error.message}`, 'red'));
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(colorize(`\n❌ Unhandled error: ${error.message}`, 'red'));
  process.exit(1);
});
