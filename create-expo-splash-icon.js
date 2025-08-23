const fs = require('fs');
const { createCanvas } = require('canvas');

// Create canvas for Expo splash screen icon
const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');

// Clear background (transparent)
ctx.clearRect(0, 0, 200, 200);

// Draw white "S" for Expo splash screen
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 120px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('S', 100, 100);

// Save the image
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./assets/expo-splash-icon.png', buffer);

console.log('✅ Expo splash icon created: expo-splash-icon.png');
