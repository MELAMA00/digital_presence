import { useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  fetchSummary,
  fetchTeams,
  fetchEmployees,
  fetchPresence,
  createTeam,
  updateTeam,
  deleteTeam,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  setPresence,
} from './api';
import logo from './assets/decathlon-logo.png';

const tabs = [
  { id: 'exec', label: 'Vue flash' },
  { id: 'overview', label: 'Synthèse (vue globale)' },
  { id: 'presence', label: 'Présence' },
  { id: 'teams', label: 'Par équipe' },
  { id: 'admin', label: 'Admin' },
];

const emptyEmployee = {
  name: '',
  teamId: '',
  epiCert: false,
  sstCert: false,
  role: 'employee',
};

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [theme, setTheme] = useState('light');
  const [summary, setSummary] = useState(null);
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [presenceList, setPresenceList] = useState([]);
  const [presenceTeamFilter, setPresenceTeamFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [teamForm, setTeamForm] = useState({ name: '', isActive: true, editingId: null });
  const [employeeForm, setEmployeeForm] = useState({ ...emptyEmployee, editingId: null });
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const handleTabChange = (id) => {
    if (id !== 'admin' && adminUnlocked) {
      setAdminUnlocked(false);
      setAdminPassword('');
    }
    setActiveTab(id);
  };

  const presenceMap = useMemo(() => {
    const map = new Map();
    presenceList.forEach((item) => map.set(item.id, item.isPresent));
    return map;
  }, [presenceList]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryData, teamsData, employeesData, presenceData] = await Promise.all([
        fetchSummary(),
        fetchTeams(),
        fetchEmployees(),
        fetchPresence(),
      ]);
      setSummary(summaryData);
      setTeams(teamsData);
      setEmployees(employeesData);
      setPresenceList(presenceData);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const refreshPresence = async (teamId = '') => {
    const data = await fetchPresence(teamId || undefined);
    setPresenceList(data);
    const summaryData = await fetchSummary();
    setSummary(summaryData);
  };

  const handlePresenceToggle = async (employeeId, checked) => {
    try {
      await setPresence(employeeId, checked);
      await refreshPresence(presenceTeamFilter);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!teamForm.name.trim()) return;
      if (teamForm.editingId) {
        await updateTeam(teamForm.editingId, { name: teamForm.name, isActive: true });
      } else {
        await createTeam({ name: teamForm.name, isActive: true });
      }
      setTeamForm({ name: '', isActive: true, editingId: null });
      const freshTeams = await fetchTeams();
      setTeams(freshTeams);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleTeamEdit = (team) => {
    setTeamForm({ name: team.name, isActive: true, editingId: team.id });
  };

  const handleTeamDelete = async (id) => {
    if (!window.confirm('Supprimer cette équipe ?')) return;
    try {
      await deleteTeam(id);
      const freshTeams = await fetchTeams();
      setTeams(freshTeams);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...employeeForm };
      const formatted = {
        name: payload.name,
        teamId: payload.teamId || null,
        epiCert: payload.epiCert,
        sstCert: payload.sstCert,
        active: true,
        role: payload.role,
      };
      if (payload.editingId) {
        await updateEmployee(payload.editingId, formatted);
      } else {
        await createEmployee(formatted);
      }
      setEmployeeForm({ ...emptyEmployee, editingId: null });
      const [freshEmployees, summaryData] = await Promise.all([fetchEmployees(), fetchSummary()]);
      setEmployees(freshEmployees);
      setSummary(summaryData);
      await refreshPresence(presenceTeamFilter);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleEmployeeEdit = (emp) => {
    setEmployeeForm({
      editingId: emp.id,
      name: emp.name,
      teamId: emp.teamId || '',
      epiCert: !!emp.epiCert,
      sstCert: !!emp.sstCert,
      role: emp.role || 'employee',
    });
  };

  const handleEmployeeDelete = async (emp) => {
    if (!window.confirm(`Supprimer ${emp.name} ?`)) return;
    try {
      await deleteEmployee(emp.id);
      const [freshEmployees, summaryData] = await Promise.all([fetchEmployees(), fetchSummary()]);
      setEmployees(freshEmployees);
      setSummary(summaryData);
      await refreshPresence(presenceTeamFilter);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => (presenceTeamFilter ? emp.teamId === Number(presenceTeamFilter) : true));
  }, [employees, presenceTeamFilter]);

  const dashboardStats = useMemo(() => {
    const activeCount = employees.filter((emp) => emp.active !== false).length;
    const presenceRate = summary && activeCount ? Math.round((summary.totalPresent / activeCount) * 100) : 0;
    const topTeams = summary ? [...summary.perTeam].sort((a, b) => b.presentCount - a.presentCount).slice(0, 3) : [];
    const lowTeams = summary ? summary.perTeam.filter((team) => team.presentCount === 0) : [];
    return { activeCount, presenceRate, topTeams, lowTeams };
  }, [employees, summary]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <img src={logo} alt="Decathlon" className="logo-img" />
          <div>
            <p className="eyebrow">Decathlon Marina</p>
            <h1>Présence magasin</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <nav className="nav">
            {tabs.map((tab) => (
              <button key={tab.id} className={activeTab === tab.id ? 'nav-btn active' : 'nav-btn'} onClick={() => handleTabChange(tab.id)}>
                {tab.label}
              </button>
            ))}
          </nav>
          <button className="theme-toggle" aria-label="Basculer le theme" onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <div className="hero">
        <div className="quote-block">
          <p className="eyebrow light">Our Purpose</p>
          <p className="quote headline">
            Bring people <span className="bold">together</span> through sport to <span className="italic">make</span> wellbeing{' '}
            <span className="bold">accessible for all</span>
          </p>
        </div>
      </div>

      {message && (
        <div className="notice" onClick={() => setMessage('')}>
          {message}
        </div>
      )}

      {!loading && activeTab === 'exec' && summary && (
        <section className="grid exec-grid">
          <div className="panel highlight">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Vue flash</p>
                <h2>Opération en cours</h2>
              </div>
              <span className="dot online" />
            </div>
            <div className="kpi-grid">
              <div className="kpi">
                <p className="eyebrow">Présents</p>
                <p className="metric">{summary.totalPresent}</p>
                <p className="muted">Sur {dashboardStats.activeCount || '—'} actifs</p>
              </div>
              <div className="kpi">
                <p className="eyebrow">Taux présence</p>
                <p className="metric">{dashboardStats.presenceRate}%</p>
                <p className="muted">Actifs marqués présents</p>
              </div>
              <div className="kpi">
                <p className="eyebrow">EPI / SST</p>
                <p className="metric">{summary.epiPresent} / {summary.sstPresent}</p>
                <p className="muted">Compétences critiques</p>
              </div>
              <div className="kpi">
                <p className="eyebrow">Visiteurs</p>
                <p className="metric">{summary.visitorsPresent}</p>
                <p className="muted">Dans le magasin</p>
              </div>
            </div>
          </div>

          <div className="panel stretch">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Top équipes</p>
                <h2>Couverture immédiate</h2>
              </div>
            </div>
            <div className="mini-list">
              {dashboardStats.topTeams.map((team, idx) => (
                <div key={team.teamId} className="mini-row">
                  <div className="rank">{idx + 1}</div>
                  <div className="stack">
                    <strong>{team.teamName}</strong>
                    <p className="muted">{team.presentCount} présents</p>
                  </div>
                </div>
              ))}
              {dashboardStats.topTeams.length === 0 && <p className="muted">Aucune équipe trouvée.</p>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Alertes</p>
                <h2>Équipes à surveiller</h2>
              </div>
            </div>
            {dashboardStats.lowTeams.length === 0 ? (
              <p className="muted">Pas d'alerte détectée.</p>
            ) : (
              <div className="mini-list">
                {dashboardStats.lowTeams.map((team) => (
                  <div key={team.teamId} className="mini-row caution">
                    <div className="dot offline" />
                    <div className="stack">
                      <strong>{team.teamName}</strong>
                      <p className="muted">0 présent</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {loading && <div className="panel">Chargement...</div>}

      {!loading && activeTab === 'overview' && summary && (
        <section className="grid">
          <div className="panel highlight">
            <div className="panel-header">
              <h2>Vue rapide</h2>
              <span className="dot online" />
            </div>
            <div className="metrics">
              <div>
                <p className="eyebrow">Présents</p>
                <p className="metric">{summary.totalPresent}</p>
              </div>
              <div>
                <p className="eyebrow">EPI</p>
                <p className="metric">{summary.epiPresent}</p>
              </div>
              <div>
                <p className="eyebrow">SST</p>
                <p className="metric">{summary.sstPresent}</p>
              </div>
              <div>
                <p className="eyebrow">Visiteurs</p>
                <p className="metric">{summary.visitorsPresent}</p>
              </div>
            </div>
          </div>

          <div className="panel stretch">
            <div className="panel-header">
              <h2>Présence par équipe</h2>
            </div>
            <div className="team-list">
              {summary.perTeam.map((team) => (
                <div key={team.teamId} className="team-chip">
                  <div>
                    <p className="eyebrow">{team.teamName}</p>
                    <strong>{team.presentCount} présents</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!loading && activeTab === 'presence' && (
        <section className="panel stretch">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Présence</p>
              <h2>Marquer l'arrivée</h2>
            </div>
            <div className="filters">
              <label>
                Équipe
                <select
                  value={presenceTeamFilter}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setPresenceTeamFilter(value);
                    const data = await fetchPresence(value || undefined);
                    setPresenceList(data);
                  }}
                >
                  <option value="">Toutes</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="list">
            {filteredEmployees.map((emp) => (
              <div key={emp.id} className="presence-row">
                <div className="presence-left">
                  <strong>{emp.name}</strong>
                  <p className="muted">{teams.find((t) => t.id === emp.teamId)?.name || 'Aucune équipe'}</p>
                  <div className="tags">
                    {emp.epiCert && <span className="tag">EPI</span>}
                    {emp.sstCert && <span className="tag alt">SST</span>}
                  </div>
                </div>
                <div className="presence-right">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!presenceMap.get(emp.id)}
                      onChange={(e) => handlePresenceToggle(emp.id, e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                  <span className="present-label">Présent</span>
                </div>
              </div>
            ))}
            {filteredEmployees.length === 0 && <p className="muted">Aucun employé actif.</p>}
          </div>
        </section>
      )}

      {!loading && activeTab === 'admin' && (
        <div>
          {!adminUnlocked ? (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Accès Admin</p>
                  <h2>Authentification requise</h2>
                </div>
              </div>
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (adminPassword === 'Marina1966$') {
                    setAdminUnlocked(true);
                    setAdminPassword('');
                  } else {
                    setMessage('Mot de passe incorrect');
                  }
                }}
              >
                <label>
                  Mot de passe
                  <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                </label>
                <div className="actions">
                  <button type="submit" className="primary">
                    Valider
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <div className="grid admin-grid">
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Équipes</p>
                    <h2>Gérer les équipes</h2>
                  </div>
                </div>
                <form className="form" onSubmit={handleTeamSubmit}>
                  <div className="form-row">
                    <label>Nom</label>
                    <input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
                  </div>
                  <div className="actions">
                    <button type="submit" className="primary">
                      {teamForm.editingId ? 'Mettre à jour' : 'Créer'}
                    </button>
                    {teamForm.editingId && (
                      <button type="button" onClick={() => setTeamForm({ name: '', isActive: true, editingId: null })}>
                        Annuler
                      </button>
                    )}
                  </div>
                </form>
                <div className="list">
                  {teams.map((team) => (
                    <div key={team.id} className="list-row">
                      <div>
                        <strong>{team.name}</strong>
                        <p className="muted">{team.isActive ? 'Active' : 'Inactive'}</p>
                      </div>
                      <div className="row-actions">
                        <button onClick={() => handleTeamEdit(team)}>Modifier</button>
                        <button className="ghost" onClick={() => handleTeamDelete(team.id)}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel stretch">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Employés</p>
                    <h2>Gestion</h2>
                  </div>
                </div>
                <form className="form" onSubmit={handleEmployeeSubmit}>
                  <div className="form-grid">
                    <label>
                      Nom
                      <input value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} required />
                    </label>
                    <label>
                      Équipe
                      <select value={employeeForm.teamId} onChange={(e) => setEmployeeForm({ ...employeeForm, teamId: e.target.value })}>
                        <option value="">Aucune</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="checkbox-row">
                      <label className="inline-label">
                        <input
                          type="checkbox"
                          checked={employeeForm.epiCert}
                          onChange={(e) => setEmployeeForm({ ...employeeForm, epiCert: e.target.checked })}
                        />
                        EPI
                      </label>
                      <label className="inline-label">
                        <input
                          type="checkbox"
                          checked={employeeForm.sstCert}
                          onChange={(e) => setEmployeeForm({ ...employeeForm, sstCert: e.target.checked })}
                        />
                        SST
                      </label>
                    </div>
                    <label>
                      Rôle
                      <select value={employeeForm.role} onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}>
                        <option value="employee">Employé</option>
                        <option value="visitor">Visiteur</option>
                      </select>
                    </label>
                  </div>
                  <div className="actions">
                    <button type="submit" className="primary">
                      {employeeForm.editingId ? 'Mettre à jour' : 'Ajouter'}
                    </button>
                    {employeeForm.editingId && (
                      <button type="button" onClick={() => setEmployeeForm({ ...emptyEmployee, editingId: null })}>
                        Annuler
                      </button>
                    )}
                  </div>
                </form>

                <div className="list">
                  {employees.map((emp) => (
                    <div key={emp.id} className="list-row">
                      <div className="stack">
                        <strong>{emp.name}</strong>
                        <p className="muted">
                          {teams.find((t) => t.id === emp.teamId)?.name || 'Aucune équipe'} · {emp.role === 'visitor' ? 'Visiteur' : 'Employé'}
                        </p>
                        <div className="tags">
                          {emp.epiCert && <span className="tag">EPI</span>}
                          {emp.sstCert && <span className="tag alt">SST</span>}
                        </div>
                      </div>
                      <div className="row-actions">
                        <button onClick={() => handleEmployeeEdit(emp)}>Modifier</button>
                        <button className="danger" onClick={() => handleEmployeeDelete(emp)}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'teams' && summary && (
        <section className="panel stretch">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Vue équipe</p>
              <h2>Présence par équipe</h2>
            </div>
          </div>
          <div className="team-grid">
            {summary.perTeam.map((team) => (
              <div key={team.teamId} className="team-card">
                <div className="team-header">
                  <strong>{team.teamName}</strong>
                  <span className="badge">{team.presentCount} présents</span>
                </div>
                <div className="team-body">
                  <p className="muted">Membres actifs</p>
                  <ul className="team-members">
                    {employees
                      .filter((emp) => emp.teamId === team.teamId)
                      .map((emp) => (
                        <li key={emp.id}>
                          <span>{emp.name}</span>
                          <span className="mini-tag">{presenceMap.get(emp.id) ? 'Présent' : 'Absent'}</span>
                        </li>
                      ))}
                    {employees.filter((emp) => emp.teamId === team.teamId).length === 0 && <li className="muted">Aucun membre</li>}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
