const path = require('path');
const fs = require('fs');

const cwd = process.cwd();
const imgPath = '/uploads/rentals/1.jpeg';
const joined = path.join(cwd, imgPath);
console.log('Joined:', joined);
console.log('Exists:', fs.existsSync(joined));

const relative = imgPath.startsWith('/') ? imgPath.substring(1) : imgPath;
const joined2 = path.join(cwd, relative);
console.log('Joined2:', joined2);
console.log('Exists2:', fs.existsSync(joined2));
