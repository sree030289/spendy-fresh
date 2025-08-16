/**
 * Test script to verify enhanced group leave functionality with settlement validation
 */

const https = require('https');

const API_BASE_URL = 'https://spendyapi-2fy22mkg6q-uc.a.run.app';

// Test JWT token (you'll need to replace this with a valid token)
const TEST_TOKEN = 'your-jwt-token-here';

// Test group ID (replace with actual group ID that has pending settlements)
const TEST_GROUP_ID = 'xhozbcqRqaYatFdGVNFD';

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

async function testGroupLeaveWithSettlements() {
    console.log('🧪 Testing Group Leave with Settlement Validation...\n');

    try {
        // First, get group info
        console.log('📋 1. Getting group information...');
        const groupResponse = await makeApiRequest(`/groups/${TEST_GROUP_ID}`);
        console.log('Group Response:', JSON.stringify(groupResponse, null, 2));

        // Get group expenses
        console.log('\n💰 2. Getting group expenses...');
        const expensesResponse = await makeApiRequest(`/expenses/group/${TEST_GROUP_ID}`);
        console.log('Expenses Response:', JSON.stringify(expensesResponse, null, 2));

        // Get settlement recommendations
        console.log('\n🔄 3. Getting settlement recommendations...');
        const settlementsResponse = await makeApiRequest(`/settlements/${TEST_GROUP_ID}`);
        console.log('Settlements Response:', JSON.stringify(settlementsResponse, null, 2));

        // Test leaving group (this should fail with proper error message if settlements pending)
        console.log('\n🚪 4. Attempting to leave group...');
        const leaveResponse = await makeApiRequest(`/groups/${TEST_GROUP_ID}/members`, 'DELETE');
        console.log('Leave Group Response:', JSON.stringify(leaveResponse, null, 2));

        if (leaveResponse.statusCode === 400) {
            console.log('\n✅ SUCCESS: Group leave was properly blocked due to settlement validation!');
            console.log('Error Message:', leaveResponse.data.message);
            console.log('Error Details:', leaveResponse.data.details);
        } else if (leaveResponse.statusCode === 200) {
            console.log('\n⚠️ WARNING: User was allowed to leave group (no pending settlements?)');
        } else {
            console.log('\n❌ UNEXPECTED: Unexpected response status:', leaveResponse.statusCode);
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

// Instructions for running the test
console.log('🔧 Setup Instructions:');
console.log('1. Replace TEST_TOKEN with a valid JWT token for a user in a group');
console.log('2. Replace TEST_GROUP_ID with a group ID that has pending settlements');
console.log('3. Run: node test-group-leave-settlement.js\n');

// Uncomment the line below to run the test
// testGroupLeaveWithSettlements();

console.log('💡 To run the test, uncomment the last line in this file and ensure you have valid test data.');
