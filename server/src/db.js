const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'presence.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const initSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      team_id INTEGER,
      epi_cert INTEGER DEFAULT 0,
      sst_cert INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      role TEXT DEFAULT 'employee' CHECK (role IN ('employee', 'visitor')),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS presence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL UNIQUE,
      is_present INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
  `);
};

const seedData = () => {
  const teamCount = db.prepare('SELECT COUNT(*) as count FROM teams').get().count;
  if (teamCount > 0) return;

  const insertTeam = db.prepare('INSERT INTO teams (name, is_active) VALUES (?, ?)');
  const insertEmployee = db.prepare(`
    INSERT INTO employees (name, team_id, epi_cert, sst_cert, active, role)
    VALUES (@name, @team_id, @epi_cert, @sst_cert, @active, @role)
  `);
  const insertPresence = db.prepare(`
    INSERT INTO presence (employee_id, is_present, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `);

  const salesId = insertTeam.run('Sales', 1).lastInsertRowid;
  const opsId = insertTeam.run('Operations', 1).lastInsertRowid;
  const supportId = insertTeam.run('Support', 1).lastInsertRowid;

  const employees = [
    { name: 'Alice Martin', team_id: salesId, epi_cert: 1, sst_cert: 0, active: 1, role: 'employee' },
    { name: 'Bruno Silva', team_id: opsId, epi_cert: 0, sst_cert: 1, active: 1, role: 'employee' },
    { name: 'Chloe Dupont', team_id: opsId, epi_cert: 1, sst_cert: 1, active: 1, role: 'employee' },
    { name: 'David Rossi', team_id: supportId, epi_cert: 0, sst_cert: 0, active: 1, role: 'employee' },
    { name: 'Eva Kim', team_id: null, epi_cert: 0, sst_cert: 0, active: 1, role: 'visitor' },
    { name: 'Farid Lopez', team_id: salesId, epi_cert: 0, sst_cert: 1, active: 0, role: 'employee' },
  ];

  const employeeIds = employees.map((emp) => insertEmployee.run(emp).lastInsertRowid);
  employeeIds.forEach((id, index) => {
    const present = index % 2 === 0 ? 1 : 0;
    insertPresence.run(id, present);
  });
};

initSchema();
seedData();

module.exports = db;
