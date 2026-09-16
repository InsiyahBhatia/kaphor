const fs = require('fs');
const buf = fs.readFileSync('public/models/royal-elegance-kurta.glb');
// find images in glb json
const str = buf.toString('utf8', 0, 10000);
const jsonEnd = str.indexOf('}]}') + 3;
console.log('JSON part:', str.slice(0, 3000));
