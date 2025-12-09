const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
};

export const fetchSummary = () => fetch(`${API_URL}/summary`).then(handleResponse);
export const fetchTeams = () => fetch(`${API_URL}/teams`).then(handleResponse);
export const createTeam = (payload) =>
  fetch(`${API_URL}/teams`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(handleResponse);
export const updateTeam = (id, payload) =>
  fetch(`${API_URL}/teams/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(handleResponse);
export const deleteTeam = (id) => fetch(`${API_URL}/teams/${id}`, { method: 'DELETE' }).then((res) => {
  if (!res.ok) throw new Error('Failed to delete team');
});

export const fetchEmployees = (teamId) => {
  const query = teamId ? `?teamId=${teamId}` : '';
  return fetch(`${API_URL}/employees${query}`).then(handleResponse);
};

export const createEmployee = (payload) =>
  fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse);

export const updateEmployee = (id, payload) =>
  fetch(`${API_URL}/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse);

export const toggleEmployeeActive = (id, active) =>
  fetch(`${API_URL}/employees/${id}/activate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  }).then(handleResponse);

export const deleteEmployee = (id) =>
  fetch(`${API_URL}/employees/${id}`, { method: 'DELETE' }).then((res) => {
    if (!res.ok) throw new Error('Failed to delete employee');
  });

export const fetchPresence = (teamId) => {
  const query = teamId ? `?teamId=${teamId}` : '';
  return fetch(`${API_URL}/presence${query}`).then(handleResponse);
};

export const setPresence = (employeeId, isPresent) =>
  fetch(`${API_URL}/presence/${employeeId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPresent }),
  }).then(handleResponse);
