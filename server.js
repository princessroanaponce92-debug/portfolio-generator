require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('./db');


const MAX_MB = 5;

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.maxMB = MAX_MB;
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const arr = v => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const toDataUrl = f => (f ? `data:${f.mimetype};base64,${f.buffer.toString('base64')}` : null);


const CHILDREN = [
  ['education', ['school', 'degree', 'years'], ['edu_school', 'edu_degree', 'edu_years']],
  ['projects', ['title', 'description', 'link'], ['proj_title', 'proj_desc', 'proj_link']],
  ['experience', ['company', 'position', 'years', 'description'], ['exp_company', 'exp_position', 'exp_years', 'exp_desc']],
  ['social_links', ['label', 'url'], ['link_label', 'link_url']]
];

async function saveChildren(conn, id, b) {
  for (const [table, cols, fields] of CHILDREN) {
    await conn.query(`DELETE FROM ${table} WHERE portfolio_id = ?`, [id]);
    const lists = fields.map(f => arr(b[f]));
    for (let i = 0; i < lists[0].length; i++) {
      if (!String(lists[0][i]).trim()) continue;
      const vals = lists.map(l => String(l[i] || '').trim());
      await conn.query(
        `INSERT INTO ${table} (portfolio_id, ${cols.join(',')}) VALUES (?${',?'.repeat(cols.length)})`,
        [id, ...vals]
      );
    }
  }
  await conn.query('DELETE FROM skills WHERE portfolio_id = ?', [id]);
  const skills = String(b.skills || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const s of skills) {
    await conn.query('INSERT INTO skills (portfolio_id, name) VALUES (?, ?)', [id, s]);
  }
}

async function tx(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getPortfolio(id) {
  const [rows] = await db.query('SELECT * FROM portfolios WHERE id = ?', [id]);
  if (!rows.length) return null;
  const p = rows[0];
  for (const t of ['education', 'skills', 'projects', 'experience', 'social_links']) {
    [p[t]] = await db.query(`SELECT * FROM ${t} WHERE portfolio_id = ? ORDER BY id`, [id]);
  }
  return p;
}

// HOME
app.get('/', (req, res) => res.render('home'));


app.get('/health', (req, res) => res.send('ok'));

// CREATE (form)
app.get('/create', (req, res) => res.render('form', { p: null }));

// CREATE (save)
app.post('/portfolio/save', upload.single('photo'), wrap(async (req, res) => {
  const b = req.body;
  const id = await tx(async conn => {
    const [r] = await conn.query(
      'INSERT INTO portfolios (full_name, email, phone, address, about, photo) VALUES (?,?,?,?,?,?)',
      [b.full_name, b.email, b.phone, b.address, b.about, toDataUrl(req.file)]
    );
    await saveChildren(conn, r.insertId, b);
    return r.insertId;
  });
  res.redirect(`/portfolio/${id}/templates`);
}));

// SELECT TEMPLATE
app.get('/portfolio/:id/templates', wrap(async (req, res) => {
  const p = await getPortfolio(req.params.id);
  if (!p) return res.status(404).send('Portfolio not found. <a href="/manage">Back</a>');
  res.render('templates', { p });
}));

app.post('/portfolio/:id/template', wrap(async (req, res) => {
  const t = [1, 2, 3].includes(+req.body.template) ? +req.body.template : 1;
  await db.query('UPDATE portfolios SET template = ? WHERE id = ?', [t, req.params.id]);
  res.redirect(`/portfolio/${req.params.id}/preview`);
}));

// PREVIEW / GENERATE
app.get('/portfolio/:id/preview', wrap(async (req, res) => {
  const p = await getPortfolio(req.params.id);
  if (!p) return res.status(404).send('Portfolio not found. <a href="/manage">Back</a>');
  const t = [1, 2, 3].includes(+req.query.t) ? +req.query.t : p.template;
  res.render(`templates/t${t}`, { p, t, previewing: t !== p.template, embed: !!req.query.embed });
}));

// MANAGE (list)
app.get('/manage', wrap(async (req, res) => {
  const [list] = await db.query('SELECT id, full_name, email, template, created_at FROM portfolios ORDER BY id DESC');
  res.render('manage', { list });
}));

// EDIT
app.get('/portfolio/:id/edit', wrap(async (req, res) => {
  const p = await getPortfolio(req.params.id);
  if (!p) return res.status(404).send('Portfolio not found. <a href="/manage">Back</a>');
  res.render('form', { p });
}));

app.post('/portfolio/:id/update', upload.single('photo'), wrap(async (req, res) => {
  const b = req.body;
  const newPhoto = toDataUrl(req.file);
  const removePhoto = b.remove_photo === '1';

  let setSql = 'full_name=?, email=?, phone=?, address=?, about=?';
  const vals = [b.full_name, b.email, b.phone, b.address, b.about];

  if (newPhoto) {               
    setSql += ', photo=?';
    vals.push(newPhoto);
  } else if (removePhoto) {     
    setSql += ', photo=NULL';
  }                             

  await tx(async conn => {
    await conn.query(`UPDATE portfolios SET ${setSql} WHERE id=?`, [...vals, req.params.id]);
    await saveChildren(conn, req.params.id, b);
  });
  res.redirect(`/portfolio/${req.params.id}/preview`);
}));

// DELETE
app.post('/portfolio/:id/delete', wrap(async (req, res) => {
  await db.query('DELETE FROM portfolios WHERE id = ?', [req.params.id]);
  res.redirect('/manage');
}));

// ERRORS
app.use((err, req, res, next) => {
  console.error(err);
  const msg = err.code === 'LIMIT_FILE_SIZE'
    ? `Profile picture must be ${MAX_MB}MB or smaller.`
    : 'Something went wrong.';
  res.status(500).send(`${msg} <a href="javascript:history.back()">Go back</a>`);
});


process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught exception:', err));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Close other terminals running the server, then try again.`);
  } else {
    console.error(e);
  }
  process.exit(1);
});