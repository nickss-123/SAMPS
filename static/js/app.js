/* ============================================================
   SAPMS - Student Academic Performance Monitoring System
   Frontend application logic (static/js/app.js)
   Talks to the Flask backend via the /api/* REST endpoints.
   ============================================================ */

const SUBJECTS = ['Mathematics','English','Science','History','Computer Studies','Physical Education'];
const SUBJECT_COLORS = ['#E84B6A','#1A5FAB','#00C9A7','#F4A01C','#9B59B6','#2ECC71'];
const CLASS_COLORS   = ['#1A5FAB','#00C9A7','#F4A01C','#E84B6A'];

let studentsCache = [];

// ── API HELPERS ──
async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}
async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
async function apiDelete(url) {
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── UI HELPERS ──
function toast(msg, icon = '✓') {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.children[0].textContent = icon;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function gpaColor(g) {
  if (g === null || g === undefined) return 'var(--muted)';
  if (g >= 3.0) return 'var(--mint)';
  if (g >= 2.0) return 'var(--amber)';
  return 'var(--rose)';
}
function attendColor(a) {
  if (a >= 85) return 'var(--mint)';
  if (a >= 75) return 'var(--amber)';
  return 'var(--rose)';
}
function scoreToGrade(s) {
  if (s >= 90) return 'A+';
  if (s >= 85) return 'A';
  if (s >= 80) return 'A−';
  if (s >= 75) return 'B+';
  if (s >= 70) return 'B';
  if (s >= 65) return 'B−';
  if (s >= 60) return 'C+';
  if (s >= 55) return 'C';
  if (s >= 50) return 'D';
  return 'F';
}
function statusBadge(s) {
  if (s.at_risk) return '<span class="badge risk">🔴 At-Risk</span>';
  if (s.gpa !== null && s.gpa < 2.5) return '<span class="badge watch">🟡 Watch</span>';
  return '<span class="badge safe">🟢 Safe</span>';
}

// ── TAB SWITCHING ──
function showTab(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');

  if (name === 'dashboard') renderDashboard();
  if (name === 'students')  renderStudentTable();
  if (name === 'grades')    renderGradesPage();
  if (name === 'at-risk')   renderAtRisk();
}

// ============================================================
//  DASHBOARD
// ============================================================
async function renderDashboard() {
  try {
    const data = await apiGet('/api/dashboard/summary');

    document.getElementById('kpi-gpa').textContent = data.avg_gpa !== null ? data.avg_gpa : '—';
    document.getElementById('kpi-attend').textContent = data.avg_attendance + '%';
    document.getElementById('kpi-assign').textContent = data.avg_assignment_rate + '%';
    document.getElementById('kpi-risk').textContent = data.at_risk_count;

    // Subject bar chart
    const barEl = document.getElementById('subject-bar-chart');
    barEl.innerHTML = data.subjects.map((s, i) => `
      <div class="bar-row">
        <div class="bar-label">${s.subject.split(' ')[0]}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${s.avg_score}%;background:${SUBJECT_COLORS[i % SUBJECT_COLORS.length]}"></div></div>
        <div class="bar-val">${s.avg_score}%</div>
      </div>`).join('') || '<div class="empty"><p>No grade data yet.</p></div>';

    // Heat map
    const heatEl = document.getElementById('heat-grid');
    heatEl.innerHTML = data.subjects.map(s => {
      let bg, col, lbl;
      if (s.fail_rate > 20)      { bg = '#FFE4EA'; col = '#C0183D'; lbl = 'High Risk'; }
      else if (s.fail_rate > 10) { bg = '#FFF3D6'; col = '#A06200'; lbl = 'Watch'; }
      else                       { bg = '#E2F9F3'; col = '#007A5E'; lbl = 'Healthy'; }
      return `
        <div class="heat-cell" style="background:${bg}">
          <div class="heat-subj" style="color:${col}">${s.subject.split(' ')[0]}</div>
          <div class="heat-pct" style="color:${col}">${s.avg_score}%</div>
          <div class="heat-lbl" style="color:${col}">${lbl}</div>
        </div>`;
    }).join('') || '<div class="empty"><p>No data yet.</p></div>';

    // Class distribution legend
    const legEl = document.getElementById('class-dist-legend');
    legEl.innerHTML = data.classes.map((c, i) => `
      <div class="donut-item">
        <div class="donut-dot" style="background:${CLASS_COLORS[i % CLASS_COLORS.length]}"></div>
        <span>Class ${c.class}: <strong>${c.count}</strong> students</span>
      </div>`).join('');

    // Attendance by class
    const attendEl = document.getElementById('attend-by-class');
    attendEl.innerHTML = data.classes.map(c => `
      <div class="attend-row">
        <div class="attend-name">Class ${c.class}</div>
        <div class="attend-bar-wrap"><div class="attend-bar" style="width:${c.avg_attendance}%;background:${attendColor(c.avg_attendance)}"></div></div>
        <div class="attend-pct" style="color:${attendColor(c.avg_attendance)}">${c.avg_attendance}%</div>
      </div>`).join('');

  } catch (err) {
    toast('Failed to load dashboard: ' + err.message, '⚠️');
  }
}

// ============================================================
//  STUDENTS
// ============================================================
async function addStudent() {
  const name = document.getElementById('inp-name').value.trim();
  const cls  = document.getElementById('inp-class').value;
  const gender = document.getElementById('inp-gender').value;
  const attendance = document.getElementById('inp-attend').value;

  if (!name) return toast('Please enter a student name.', '⚠️');
  if (attendance === '' || attendance < 0 || attendance > 100) return toast('Enter a valid attendance (0–100).', '⚠️');

  try {
    await apiPost('/api/students', { name, class: cls, gender, attendance: parseInt(attendance) });
    document.getElementById('inp-name').value = '';
    document.getElementById('inp-attend').value = '';
    toast(`${name} added successfully!`);
    renderStudentTable();
  } catch (err) {
    toast(err.message, '⚠️');
  }
}

async function fetchStudents() {
  studentsCache = await apiGet('/api/students');
  return studentsCache;
}

async function renderStudentTable() {
  const fc = document.getElementById('filter-class').value;
  const fg = document.getElementById('filter-gender').value;
  const fr = document.getElementById('filter-risk').value;

  let list;
  try {
    list = await fetchStudents();
  } catch (err) {
    toast('Failed to load students: ' + err.message, '⚠️');
    return;
  }

  const filtered = list.filter(s => {
    if (fc && s.class !== fc) return false;
    if (fg && s.gender !== fg) return false;
    if (fr === 'risk' && !s.at_risk) return false;
    if (fr === 'safe' && s.at_risk) return false;
    return true;
  });

  document.getElementById('student-count-label').textContent = `${filtered.length} of ${list.length} students`;

  const tbody = document.getElementById('student-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty-icon">🔍</div><p>No students match the current filters.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(s => `
    <tr class="${s.at_risk ? 'at-risk-row' : ''}">
      <td><strong>${s.name}</strong></td>
      <td>Class ${s.class}</td>
      <td>${s.gender}</td>
      <td style="font-weight:700;color:${gpaColor(s.gpa)}">${s.gpa !== null ? s.gpa : '—'}</td>
      <td style="font-weight:600;color:${attendColor(s.attendance)}">${s.attendance}%</td>
      <td>${statusBadge(s)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" data-action="profile" data-id="${s.id}">View Profile</button>
        <button class="btn btn-danger btn-sm" data-action="remove" data-id="${s.id}" data-name="${s.name}" style="margin-left:6px">Remove</button>
      </td>
    </tr>`).join('');
}

async function removeStudent(id, name) {
  if (!confirm(`Remove ${name}? This also deletes their grades.`)) return;
  try {
    await apiDelete(`/api/students/${id}`);
    toast(`${name} removed.`, '🗑️');
    renderStudentTable();
  } catch (err) {
    toast(err.message, '⚠️');
  }
}

// ============================================================
//  GRADES
// ============================================================
async function populateGradeDropdown() {
  const sel = document.getElementById('grade-student');
  const list = studentsCache.length ? studentsCache : await fetchStudents();
  sel.innerHTML = list.map(s => `<option value="${s.id}">${s.name} (Class ${s.class})</option>`).join('');
}

async function addGrade() {
  const studentId = parseInt(document.getElementById('grade-student').value);
  const subject = document.getElementById('grade-subject').value;
  const assessmentType = document.getElementById('grade-type').value;
  const score = document.getElementById('grade-score').value;

  if (score === '' || score < 0 || score > 100) return toast('Enter a valid score (0–100).', '⚠️');
  if (!studentId) return toast('Please select a student.', '⚠️');

  try {
    await apiPost('/api/grades', { student_id: studentId, subject, assessment_type: assessmentType, score: parseInt(score) });
    document.getElementById('grade-score').value = '';
    const student = studentsCache.find(s => s.id === studentId);
    toast(`Grade saved for ${student ? student.name : 'student'}!`);
    renderGradesTable();
  } catch (err) {
    toast(err.message, '⚠️');
  }
}

async function renderGradesPage() {
  await populateGradeDropdown();
  renderGradesTable();
}

async function renderGradesTable() {
  let recent;
  try {
    recent = await apiGet('/api/grades');
  } catch (err) {
    toast('Failed to load grades: ' + err.message, '⚠️');
    return;
  }

  const tbody = document.getElementById('grades-tbody');
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="empty-icon">📝</div><p>No grades entered yet.</p></div></td></tr>';
    return;
  }

  const typeLabels = { quiz: 'Quiz', midterm: 'Midterm', assignment: 'Assignment', final: 'Final Exam' };

  tbody.innerHTML = recent.map(g => {
    const gradeColor = g.score >= 75 ? 'var(--mint)' : g.score >= 50 ? 'var(--amber)' : 'var(--rose)';
    const bg = g.score >= 75 ? '#E2F9F3' : g.score >= 50 ? '#FFF3D6' : '#FFE4EA';
    return `
      <tr>
        <td><strong>${g.student_name}</strong></td>
        <td>${g.subject}</td>
        <td>${typeLabels[g.assessment_type] || g.assessment_type}</td>
        <td style="font-weight:700">${g.score}/100</td>
        <td><span class="badge" style="background:${bg};color:${gradeColor}">${scoreToGrade(g.score)}</span></td>
        <td style="color:var(--muted)">${new Date(g.entered_at).toLocaleDateString()}</td>
      </tr>`;
  }).join('');
}

// ============================================================
//  AT-RISK
// ============================================================
async function renderAtRisk() {
  let atRisk;
  try {
    atRisk = await apiGet('/api/at-risk');
  } catch (err) {
    toast('Failed to load at-risk data: ' + err.message, '⚠️');
    return;
  }

  const container = document.getElementById('risk-alerts-container');
  if (atRisk.length === 0) {
    container.innerHTML = '<div class="alert success"><div class="alert-icon">✅</div><div><strong>No at-risk students detected.</strong> All students currently meet GPA and attendance thresholds. Keep monitoring weekly.</div></div>';
  } else {
    container.innerHTML = `<div class="alert danger"><div class="alert-icon">🚨</div><div><strong>${atRisk.length} student${atRisk.length > 1 ? 's' : ''} require immediate attention.</strong> These students have a GPA below 2.0 or attendance below 75%. Contact their class teachers and schedule counseling sessions.</div></div>`;
  }

  const tbody = document.getElementById('risk-tbody');
  if (!atRisk.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="empty-icon">🎉</div><p>No at-risk students at this time.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = atRisk.map(s => `
    <tr class="at-risk-row">
      <td><strong>${s.name}</strong></td>
      <td>Class ${s.class}</td>
      <td style="font-weight:700;color:${gpaColor(s.gpa)}">${s.gpa !== null ? s.gpa : 'No grades'}</td>
      <td style="font-weight:600;color:${attendColor(s.attendance)}">${s.attendance}%</td>
      <td><span style="color:var(--rose);font-size:.82rem;font-weight:500">${s.reasons.join(' · ')}</span></td>
      <td><button class="btn btn-ghost btn-sm" data-action="profile" data-id="${s.id}">View Profile</button></td>
    </tr>`).join('');
}

// ============================================================
//  MODAL
// ============================================================
async function openModal(id) {
  try {
    const s = await apiGet(`/api/students/${id}/profile`);

    document.getElementById('modal-name').textContent = s.name;
    document.getElementById('modal-meta').textContent = `Class ${s.class} · ${s.gender} · ID #${s.id}`;
    document.getElementById('modal-gpa').textContent = s.gpa !== null ? s.gpa : '—';
    document.getElementById('modal-gpa').style.color = gpaColor(s.gpa);
    document.getElementById('modal-attend-val').textContent = s.attendance + '%';
    document.getElementById('modal-attend-val').style.color = attendColor(s.attendance);

    const statusEl = document.getElementById('modal-status-val');
    statusEl.textContent = s.at_risk ? 'At-Risk' : 'Safe';
    statusEl.style.color = s.at_risk ? 'var(--rose)' : 'var(--mint)';

    const subjEl = document.getElementById('modal-subjects');
    if (!s.subjects.length) {
      subjEl.innerHTML = '<div class="empty"><div class="empty-icon">📚</div><p>No grades recorded yet for this student.</p></div>';
    } else {
      subjEl.innerHTML = s.subjects.map(sub => {
        const c = sub.score >= 75 ? 'var(--mint)' : sub.score >= 50 ? 'var(--amber)' : 'var(--rose)';
        return `
          <div class="modal-subject-row">
            <div class="msub-name">${sub.subject}</div>
            <div class="msub-bar-wrap"><div class="msub-bar" style="width:${sub.score}%;background:${c}"></div></div>
            <div class="msub-score" style="color:${c}">${sub.score}%</div>
          </div>`;
      }).join('');
    }

    document.getElementById('modal-overlay').classList.add('open');
  } catch (err) {
    toast('Failed to load profile: ' + err.message, '⚠️');
  }
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ============================================================
//  EVENT WIRING
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  document.getElementById('btn-add-student').addEventListener('click', addStudent);
  document.getElementById('btn-add-grade').addEventListener('click', addGrade);
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  ['filter-class', 'filter-gender', 'filter-risk'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderStudentTable);
  });

  // Delegated events for dynamically-rendered table buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = parseInt(btn.dataset.id);
    if (action === 'profile') openModal(id);
    if (action === 'remove') removeStudent(id, btn.dataset.name);
  });

  renderDashboard();
});
