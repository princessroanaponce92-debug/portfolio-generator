const db = require('./db');

(async () => {
  try {
    const [tables] = await db.query('SHOW TABLES');
    console.log('\nTABLES IN THE ONLINE DATABASE:');
    console.table(tables);

    const [rows] = await db.query(
      'SELECT id, full_name, email, template, created_at FROM portfolios'
    );
    console.log('\nSAVED PORTFOLIOS:');
    console.table(rows);

    for (const t of ['education', 'skills', 'projects', 'experience', 'social_links']) {
      const [c] = await db.query(`SELECT COUNT(*) AS total FROM ${t}`);
      console.log(`${t}: ${c[0].total} row(s)`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit();
  }
})();