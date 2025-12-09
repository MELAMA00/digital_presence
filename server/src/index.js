const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const toBool = (value) => (value ? 1 : 0);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Teams
app.get('/api/teams', (_req, res) => {
  const teams = db.prepare('SELECT id, name, is_active as isActive FROM teams ORDER BY name').all();
  res.json(teams);
});

app.post('/api/teams', (req, res) => {
  const { name, isActive = true } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = db.prepare('INSERT INTO teams (name, is_active) VALUES (?, ?)').run(name, toBool(isActive));
    res.status(201).json({ id: result.lastInsertRowid, name, isActive: !!isActive });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/teams/:id', (req, res) => {
  const { name, isActive = true } = req.body;
  const { id } = req.params;
  const result = db
    .prepare('UPDATE teams SET name = ?, is_active = ? WHERE id = ?')
    .run(name, toBool(isActive), id);
  if (result.changes === 0) return res.status(404).json({ error: 'Team not found' });
  res.json({ id: Number(id), name, isActive: !!isActive });
});

app.delete('/api/teams/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM teams WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Team not found' });
  res.status(204).send();
});

// Employees
app.get('/api/employees', (req, res) => {
  const { teamId, active } = req.query;
  let query = `
    SELECT e.id, e.name, e.team_id as teamId, e.epi_cert as epiCert, e.sst_cert as sstCert,
           e.active as active, e.role,
           t.name as teamName
    FROM employees e
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE 1=1
  `;
  const params = [];
  if (teamId) {
    query += ' AND e.team_id = ?';
    params.push(teamId);
  }
  if (active !== undefined) {
    query += ' AND e.active = ?';
    params.push(active === 'true' ? 1 : 0);
  }
  query += ' ORDER BY e.name';
  const employees = db.prepare(query).all(...params);
  res.json(employees.map((emp) => ({ ...emp, active: !!emp.active, epiCert: !!emp.epiCert, sstCert: !!emp.sstCert })));
});

app.post('/api/employees', (req, res) => {
  const { name, teamId = null, epiCert = false, sstCert = false, active = true, role = 'employee' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = db
      .prepare(
        'INSERT INTO employees (name, team_id, epi_cert, sst_cert, active, role) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(name, teamId || null, toBool(epiCert), toBool(sstCert), toBool(active), role);
    db.prepare('INSERT OR IGNORE INTO presence (employee_id, is_present) VALUES (?, 0)').run(result.lastInsertRowid);
    res
      .status(201)
      .json({ id: result.lastInsertRowid, name, teamId, epiCert: !!epiCert, sstCert: !!sstCert, active: !!active, role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const { name, teamId = null, epiCert = false, sstCert = false, active = true, role = 'employee' } = req.body;
  const result = db
    .prepare(
      `
      UPDATE employees
      SET name = ?, team_id = ?, epi_cert = ?, sst_cert = ?, active = ?, role = ?
      WHERE id = ?
    `
    )
    .run(name, teamId || null, toBool(epiCert), toBool(sstCert), toBool(active), role, id);
  if (result.changes === 0) return res.status(404).json({ error: 'Employee not found' });
  res.json({ id: Number(id), name, teamId, epiCert: !!epiCert, sstCert: !!sstCert, active: !!active, role });
});

app.delete('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Employee not found' });
  res.status(204).send();
});

app.patch('/api/employees/:id/activate', (req, res) => {
  const { id } = req.params;
  const { active = true } = req.body;
  const result = db.prepare('UPDATE employees SET active = ? WHERE id = ?').run(toBool(active), id);
  if (result.changes === 0) return res.status(404).json({ error: 'Employee not found' });
  res.json({ id: Number(id), active: !!active });
});

// Presence
app.get('/api/presence', (req, res) => {
  const { teamId } = req.query;
  let query = `
    SELECT e.id, e.name, e.role, e.team_id as teamId, t.name as teamName,
           p.is_present as isPresent, p.updated_at as updatedAt
    FROM presence p
    JOIN employees e ON p.employee_id = e.id
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE p.is_present = 1 AND e.active = 1
  `;
  const params = [];
  if (teamId) {
    query += ' AND e.team_id = ?';
    params.push(teamId);
  }
  query += ' ORDER BY e.name';
  const rows = db.prepare(query).all(...params);
  res.json(rows.map((row) => ({ ...row, isPresent: !!row.isPresent })));
});

app.post('/api/presence/:employeeId', (req, res) => {
  const { employeeId } = req.params;
  const { isPresent = true } = req.body;
  const employee = db.prepare('SELECT id, active FROM employees WHERE id = ?').get(employeeId);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  if (!employee.active) return res.status(400).json({ error: 'Employee is inactive' });

  db.prepare(
    `
      INSERT INTO presence (employee_id, is_present, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(employee_id) DO UPDATE SET
        is_present = excluded.is_present,
        updated_at = CURRENT_TIMESTAMP
    `
  ).run(employeeId, toBool(isPresent));

  res.json({ employeeId: Number(employeeId), isPresent: !!isPresent });
});

// Summary
app.get('/api/summary', (_req, res) => {
  const totalPresent = db.prepare('SELECT COUNT(*) as count FROM presence p JOIN employees e ON e.id = p.employee_id WHERE p.is_present = 1 AND e.active = 1').get().count;

  const perTeam = db
    .prepare(
      `
      SELECT t.id as teamId, t.name as teamName, COUNT(p.employee_id) as presentCount
      FROM teams t
      LEFT JOIN employees e ON e.team_id = t.id AND e.active = 1
      LEFT JOIN presence p ON p.employee_id = e.id AND p.is_present = 1
      GROUP BY t.id
      ORDER BY t.name;
    `
    )
    .all();

  const epiPresent = db.prepare(`
      SELECT COUNT(*) as count
      FROM presence p
      JOIN employees e ON e.id = p.employee_id
      WHERE p.is_present = 1 AND e.epi_cert = 1 AND e.active = 1
    `).get().count;

  const sstPresent = db.prepare(`
      SELECT COUNT(*) as count
      FROM presence p
      JOIN employees e ON e.id = p.employee_id
      WHERE p.is_present = 1 AND e.sst_cert = 1 AND e.active = 1
    `).get().count;

  const visitorsPresent = db.prepare(`
      SELECT COUNT(*) as count
      FROM presence p
      JOIN employees e ON e.id = p.employee_id
      WHERE p.is_present = 1 AND e.role = 'visitor' AND e.active = 1
    `).get().count;

  res.json({
    totalPresent,
    perTeam: perTeam.map((t) => ({ ...t, presentCount: Number(t.presentCount) })),
    epiPresent,
    sstPresent,
    visitorsPresent,
  });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
