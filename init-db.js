const fs = require('fs');
const db = require('./db');

(async () => {
  try {
    await db.query(fs.readFileSync('schema.sql', 'utf8'));
    console.log('✅ Tables created in the online database.');
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    process.exit();
  }
})();