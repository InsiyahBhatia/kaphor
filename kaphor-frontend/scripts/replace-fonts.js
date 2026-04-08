const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = [...walk('./app'), ...walk('./src')];

let changedCount = 0;
files.forEach(file => {
  if (file.includes('_layout.tsx')) return; // Skip layout to manually handle imports

  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('CormorantGaramond')) {
    content = content.replace(/CormorantGaramond_700Bold/g, 'BebasNeue_400Regular');
    content = content.replace(/CormorantGaramond_400Regular/g, 'IBMPlexMono_400Regular');
    content = content.replace(/CormorantGaramond/g, 'BebasNeue'); // Catch any stray family names
    fs.writeFileSync(file, content, 'utf8');
    changedCount++;
    console.log(`Updated fonts in ${file}`);
  }
});

console.log(`Successfully updated ${changedCount} files.`);
