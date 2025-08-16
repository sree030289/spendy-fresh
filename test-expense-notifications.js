/**
 * Test script to verify expense notification system
 */

const https = require('https');

const API_BASE_URL = 'https://spendyapi-2fy22mkg6q-uc.a.run.app';
const TEST_TOKEN = 'your-jwt-token-here'; // Replace with actual token

function makeApiRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, API_BASE_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_TOKEN}`
            }
        };

        if (data) {
            const jsonData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(jsonData);
        }

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({
                        statusCode: res.statusCode,
                        data: parsed
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function testExpenseNotifications() {
    console.log('🧪 Testing Expense Notification System...\n');

    try {
        // Test creating an expense in a group (this should trigger notifications)
        console.log('💰 1. Creating a test expense...');
        const expenseData = {
            description: 'Test Notification Expense',
            amount: 25.50,
            paidBy: 'G1LvPEfuDYqWGSfAsuox', // Replace with actual user ID
            groupId: 'xhozbcqRqaYatFdGVNFD', // Replace with actual group ID
            category: 'food',
            categoryIcon: '🍕',
            currency: 'USD',
            splitType: 'equal',
            splits: [
                {
                    userId: 'G1LvPEfuDYqWGSfAsuox',
                    amount: 12.75,
                    percentage: 50
                },
                {
                    userId: 'R8lgO0eVYn7S5BclTvca', // Replace with another group member
                    amount: 12.75,
                    percentage: 50
                }
            ]
        };

        const expenseResponse = await makeApiRequest('/expenses', 'POST', expenseData);
        console.log('Expense Creation Response:', JSON.stringify(expenseResponse, null, 2));

        if (expenseResponse.statusCode === 201) {
            console.log('✅ Expense created successfully!');
            console.log('📧 Notifications should have been sent to group members');
            
            // Check if notifications were created
            console.log('\n📋 2. Checking app notifications...');
            const notificationsResponse = await makeApiRequest('/notifications');
            console.log('Notifications Response:', JSON.stringify(notificationsResponse, null, 2));
        } else {
            console.log('❌ Failed to create expense');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

// Instructions
console.log('🔧 Setup Instructions:');
console.log('1. Replace TEST_TOKEN with a valid JWT token');
console.log('2. Replace user IDs and group ID with actual values from your test data');
console.log('3. Run: node test-expense-notifications.js\n');

// Uncomment to run test
// testExpenseNotifications();

console.log('💡 To run the test, uncomment the last line and update the test data.');
