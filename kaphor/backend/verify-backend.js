async function check() {
  try {
    const health = await fetch('http://localhost:4000/health').then(r => r.json());
    console.log('Health:', health);
    const db = await fetch('http://localhost:4000/test-db').then(r => r.json());
    console.log('Database:', db);
  } catch (e) {
    console.error('Failed to reach server:', e.message);
  }
}
check();
