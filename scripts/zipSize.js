const fs = require('fs');

// report zip size and remaining bytes
const size = fs.statSync('dist/game.zip').size;
const limit = 1024 * 13;
const remaining = limit - size;
const percentage = Math.round((remaining / limit) * 100 * 100) / 100;
console.log('\n-------------');
console.log(`Used: ${size} bytes`);
console.log(`Remaining: ${remaining} bytes (${percentage}% of #js13k budget)`);
console.log('-------------\n');

