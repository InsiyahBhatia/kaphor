const fs = require('fs');

const buf = fs.readFileSync('public/models/handbag.glb');
// find strings in glb
const str = buf.toString('utf8', 0, 5000);
console.log(str.slice(0, 1000));
