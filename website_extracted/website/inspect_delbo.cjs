const fs = require('fs');
const buf = fs.readFileSync('public/models/delbo-leather.glb');
console.log(buf.toString('utf8', 0, 1000));
