// ralph-kiro Studio v3.0 — Frontend
const WS_URL = `ws://${location.host}`;
let ws = null;
let connected = false;
let acpReady = false;
let activeOp = null; // tracks current operation: 'init', 'iterate', 'plan', 'review', 'reset'

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// DOM refs
const elStatus = $('#connection-status');
const elFeed = $('#agent-feed');
const elFeedStatus = $('#feed-status');
const elProgress = $('#progress-content');
const elAgentsMd = $('#agents-md-content');
const elPrdEditor = $('#prd-editor');
const elReviewOutput = $('#review-output');
const elGitTimeline = $('#git-timeline');
const elIteration = $('#metric-iteration');
const elIterBar = $('#metric-iteration-bar');
const elMetricStatus = $('#metric-status');
const elCost = $('#metric-cost');
const elStalls = $('#metric-stalls');
const elBranch = $('#metric-branch');
const elMetricTasks = $('#metric-tasks');

// ── Navigation ──
$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.panel').forEach(p => p.classList.remove('active'));
    $(`#panel-${btn.dataset.panel}`).classList.add('active');
  });
});

// ── WebSocket ──
function connectWs() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    connected = true;
    elStatus.textContent = 'connected';
    elStatus.className = 'status-badge connected';
  };
  ws.onclose = () => {
    connected = false; acpReady = false;
    elStatus.textContent = 'disconnected';
    elStatus.className = 'status-badge disconnected';
    setTimeout(connectWs, 3000);
  };
  ws.onmessage = (evt) => handleMessage(JSON.parse(evt.data));
}
function send(data) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(data)); }

// ── Load AWS Profiles ──
async function loadAwsProfiles() {
  try {
    const profiles = await fetch('/api/aws-profiles').then(r => r.json());
    const sel = $('#select-aws-profile');
    sel.innerHTML = profiles.map(p => `<option value="${p}" ${p === 'default' ? 'selected' : ''}>${p}</option>`).join('');
  } catch {}
}

// ── Message Handler ──
function handleMessage(msg) {
  switch (msg.type) {
    case 'connected':
      if (msg.cwd) {
        $('#input-cwd').value = msg.cwd;
        // Auto-load project data if server already has a cwd
        loadProjectData();
      }
      if (msg.acpRunning) { acpReady = true; elStatus.textContent = 'acp ready'; elStatus.className = 'status-badge connected'; }
      break;
    case 'ready':
      acpReady = true; elStatus.textContent = 'acp ready'; elStatus.className = 'status-badge connected';
      unlockUI(); loadProjectData();
      break;
    case 'acp_initialized': appendFeed('system', 'ACP initialized'); break;
    case 'session_created': appendFeed('system', `Session: ${msg.sessionId}`); break;
    case 'acp_notification': handleAcpNotification(msg); break;
    case 'prompt_complete': {
      elFeedStatus.textContent = 'idle'; elFeedStatus.className = 'feed-badge';
      const finishedOp = activeOp;
      activeOp = null;
      elMetricStatus.textContent = '✅ Done'; elMetricStatus.style.color = 'var(--accent-green)';
      loadProjectData().then(() => {
        // After Plan PRD completes, switch to PRD Editor panel
        if (finishedOp === 'plan') {
          $$('.nav-btn').forEach(b => b.classList.remove('active'));
          $('[data-panel="prd"]').classList.add('active');
          $$('.panel').forEach(p => p.classList.remove('active'));
          $('#panel-prd').classList.add('active');
        }
      });
      unlockUI();
      break;
    }
    case 'acp_stderr': appendFeed('error', msg.data); break;
    case 'acp_raw': appendFeed('text', msg.data); break;
    case 'acp_closed':
      acpReady = false; elStatus.textContent = 'acp stopped'; elStatus.className = 'status-badge disconnected';
      appendFeed('system', `ACP exited (code: ${msg.code})`); unlockUI();
      break;
    case 'acp_error': appendFeed('error', msg.error); unlockUI(); break;
    case 'permission_auto_approved': appendFeed('system', `✓ Auto-approved tool call`); break;
    case 'file_changed': handleFileChange(msg); break;
    case 'error': appendFeed('error', msg.error); break;
  }
}

function handleAcpNotification(msg) {
  const update = msg.params?.update;
  if (!update) return;
  switch (update.sessionUpdate) {
    case 'agent_message_chunk':
      if (update.content?.text) {
        const text = update.content.text;
        // Detect completion promise
        if (text.includes('<promise>') || text.includes('DONE</promise>') || text.includes('</promise>')) {
          appendFeed('system', '🎉 Completion promise detected — task is DONE');
          elMetricStatus.textContent = '✅ Done';
          elMetricStatus.style.color = 'var(--accent-green)';
        } else {
          appendFeed('text', text);
        }
        // Also append to review panel if review is active
        if (activeOp === 'review') {
          const entry = document.createElement('div');
          entry.className = 'feed-entry text';
          entry.textContent = text;
          elReviewOutput.appendChild(entry);
          elReviewOutput.scrollTop = elReviewOutput.scrollHeight;
        }
      }
      break;
    case 'tool_call':
      appendFeed('tool-call', `🔧 ${update.title || 'Tool'} [${update.kind || ''}] — ${update.status}`);
      break;
    case 'tool_call_update':
      if (update.status === 'completed' && update.content) {
        for (const c of update.content) { if (c.content?.text) appendFeed('tool-result', c.content.text.slice(0, 500)); }
      } else {
        appendFeed('tool-call', `🔧 ${update.toolCallId} — ${update.status}`);
      }
      break;
    case 'plan':
      if (update.entries) {
        appendFeed('system', '📋 Plan:\n' + update.entries.map(e => `  ${e.status === 'completed' ? '✅' : '⬜'} ${e.content}`).join('\n'));
      }
      break;
  }
}

// ── Feed ──
function appendFeed(type, text) {
  const empty = elFeed.querySelector('.feed-empty');
  if (empty) empty.remove();
  const entry = document.createElement('div');
  entry.className = `feed-entry ${type}`;
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const icons = { text:'💬', 'tool-call':'🔧', 'tool-result':'✅', error:'❌', system:'ℹ️' };
  entry.innerHTML = `<span class="timestamp">${time}</span><span class="label">${icons[type]||''}</span>${esc(text)}`;
  elFeed.appendChild(entry);
  elFeed.scrollTop = elFeed.scrollHeight;
}
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function handleFileChange(msg) {
  switch (msg.file) {
    case 'ralph-state.json': try { updateMetrics(JSON.parse(msg.content)); } catch {} break;
    case 'tasks.json': try { const d = JSON.parse(msg.content); renderTaskGraph(d); renderTaskGraphFull(d); } catch {} break;
    case 'progress.txt': elProgress.textContent = msg.content || 'No progress file yet'; break;
    case 'AGENTS.md': elAgentsMd.textContent = msg.content || 'No AGENTS.md yet'; break;
  }
}

// ── Data Loading ──
async function loadProjectData() {
  try {
    const [state, progress, agentsMd, prd, gitLog, tasks, logs] = await Promise.all([
      fetch('/api/state').then(r => r.json()),
      fetch('/api/progress').then(r => r.json()),
      fetch('/api/agents-md').then(r => r.json()),
      fetch('/api/prd').then(r => r.json()),
      fetch('/api/git-log').then(r => r.json()),
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/logs').then(r => r.json()),
    ]);
    if (state) updateMetrics(state);
    elProgress.textContent = progress.content || 'No progress file yet';
    elAgentsMd.textContent = agentsMd.content || 'No AGENTS.md yet';
    if (prd.content) elPrdEditor.value = prd.content;
    renderGitTimeline(gitLog);
    renderTaskGraph(tasks);
    renderTaskGraphFull(tasks);
    renderIterationLogs(logs);
  } catch (e) { console.error('Load failed:', e); }
}

function updateMetrics(s) {
  // Always respect activeOp first — even if state file is null
  if (activeOp) {
    const opLabels = { init: '🔄 Building...', iterate: '🔄 Iterating...', plan: '📋 Creating PRD...', review: '🔍 Reviewing...', reset: '🗑 Resetting...' };
    elMetricStatus.textContent = opLabels[activeOp] || '🟢 Running';
    elMetricStatus.style.color = 'var(--accent-green)';
  }
  if (!s) return;
  const iter = s.iteration || 0;
  const uiMax = parseInt($('#input-max-iter')?.value);
  const max = (uiMax && uiMax !== 50) ? uiMax : (s.maxIterations || 50);
  elIteration.textContent = `${iter} / ${max}`;
  elIterBar.style.width = `${Math.round((iter/max)*100)}%`;
  // Only update status from state file if no active operation
  if (!activeOp) {
    // Don't overwrite "Done" if it was set by completion promise detection
    const currentStatus = elMetricStatus.textContent;
    if (currentStatus === '✅ Done') {
      // keep it
    } else if (s.active) {
      elMetricStatus.textContent = '🟢 Active';
      elMetricStatus.style.color = 'var(--accent-green)';
    } else if (s.success) {
      elMetricStatus.textContent = '✅ Done';
      elMetricStatus.style.color = 'var(--accent-green)';
    } else if (iter > 0) {
      elMetricStatus.textContent = '⏸️ Idle';
      elMetricStatus.style.color = 'var(--text-dim)';
    } else {
      elMetricStatus.textContent = '—';
      elMetricStatus.style.color = 'var(--text-dim)';
    }
  }
  elCost.textContent = `$${Number(s.metrics?.estimatedCostUsd || 0).toFixed(2)}`;
  const stalls = s.metrics?.stalls || 0;
  elStalls.textContent = `${stalls} / 3`;
  elStalls.style.color = stalls >= 2 ? 'var(--accent-red)' : stalls >= 1 ? 'var(--accent-yellow)' : 'var(--text)';
  elBranch.textContent = s.branch || '—';
}

function renderGitTimeline(commits) {
  if (!commits?.length) { elGitTimeline.innerHTML = '<div class="feed-empty">No commits yet</div>'; return; }
  elGitTimeline.innerHTML = commits.map(c => `
    <div class="commit-entry"><div class="commit-dot"></div><div>
      <span class="commit-hash">${(c.hash||'').slice(0,7)}</span>
      <span class="commit-msg">${esc(c.message||'')}</span>
      <div class="commit-date">${c.date||''}</div>
    </div></div>`).join('');
}

function renderTaskItems(data) {
  if (!data?.tasks?.length) return '<div class="feed-empty">No task graph yet</div>';
  const tasks = data.tasks;
  const done = tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
  const pending = tasks.filter(t => t.status === 'pending' || t.status === 'todo' || !t.status).length;
  const blocked = tasks.filter(t => t.status === 'blocked').length;
  const total = tasks.length;
  const pct = Math.round((done / total) * 100);
  elMetricTasks.textContent = `${done}/${total} (${pct}%)`;
  let html = `<div class="task-summary"><span>${done}/${tasks.length}</span> done (${pct}%) | <span style="color:var(--accent-yellow)">${pending}</span> pending | <span style="color:var(--accent-red)">${blocked}</span> blocked</div>`;
  html += tasks.map(t => {
    const icon = t.status === 'done' ? '✅' : t.status === 'blocked' ? '🚫' : '⬜';
    // Normalize priority — agent may use numbers (1-2=high, 3-4=medium, 5+=low) or strings
    let pri = t.priority || 'medium';
    if (typeof pri === 'number') pri = pri <= 2 ? 'high' : pri <= 4 ? 'medium' : 'low';
    return `<div class="task-item ${t.status}">
      <span class="task-status">${icon}</span>
      <span class="task-priority ${pri}">${pri.slice(0,3)}</span>
      <span class="task-desc">${esc(t.description||t.title||'')}</span>
      <span class="task-cat">${esc(t.category||'')}</span>
      <span class="task-iter">${t.iteration ? 'iter '+t.iteration : ''}</span>
    </div>`;
  }).join('');
  return html;
}
function renderTaskGraph(data) { $('#tasks-graph').innerHTML = renderTaskItems(data); }
function renderTaskGraphFull(data) { $('#tasks-graph-full').innerHTML = renderTaskItems(data); }

function renderIterationLogs(logs) {
  const el = $('#iteration-logs');
  if (!logs?.length) { el.innerHTML = '<div class="feed-empty">No iteration logs yet. Logs are created when using ralph-kiro CLI (not Studio ACP mode). Use the Agent Feed tab for live output.</div>'; return; }
  el.innerHTML = logs.map(l => `<div class="log-entry" onclick="viewLog('${esc(l.name)}')">
    <span class="log-name">📄 ${esc(l.name)}</span>
    <span class="log-size">${(l.size/1024).toFixed(1)} KB</span>
  </div>`).join('');
}

async function viewLog(name) {
  try {
    const data = await fetch(`/api/logs/${name}`).then(r => r.json());
    if (!data.content) return;
    const modal = document.createElement('div');
    modal.className = 'log-modal';
    modal.innerHTML = `<div class="log-modal-content"><div class="log-modal-header"><span>${esc(name)}</span><button class="log-modal-close" onclick="this.closest('.log-modal').remove()">✕</button></div><div class="log-modal-body">${esc(data.content)}</div></div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  } catch {}
}
window.viewLog = viewLog;

// ── UI Lock (disable inputs during operations) ──
const actionBtns = ['#btn-set-cwd', '#btn-connect-acp', '#btn-init', '#btn-iterate', '#btn-plan', '#btn-review', '#btn-reset', '#btn-generate-prd', '#btn-run-review'];
const actionInputs = ['#input-cwd', '#input-prompt', '#input-max-iter', '#input-max-cost', '#input-delay', '#input-agent', '#input-plan-desc', '#select-aws-profile', '#select-branch', '#prd-editor'];

function lockUI() {
  actionBtns.forEach(s => { const el = $(s); if (el) el.disabled = true; });
  actionInputs.forEach(s => { const el = $(s); if (el) el.disabled = true; });
}
function unlockUI() {
  actionBtns.forEach(s => { const el = $(s); if (el) el.disabled = false; });
  actionInputs.forEach(s => { const el = $(s); if (el) el.disabled = false; });
  // Cancel stays disabled unless a prompt is running
  $('#btn-cancel').disabled = true;
}

// ── Dark/Light Theme Toggle ──
function initTheme() {
  const saved = localStorage.getItem('ralph-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  $('#btn-theme').textContent = saved === 'dark' ? '☀️' : '🌙';
}
$('#btn-theme').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ralph-theme', next);
  $('#btn-theme').textContent = next === 'dark' ? '☀️' : '🌙';
});
initTheme();

// ── Button Handlers ──

$('#btn-set-cwd').addEventListener('click', async () => {
  const cwd = $('#input-cwd').value.trim();
  if (!cwd) return;
  lockUI();
  try {
    const res = await fetch('/api/set-cwd', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cwd}) });
    const data = await res.json();
    if (data.ok) { appendFeed('system', `Project: ${data.cwd}`); await loadProjectData(); }
    else appendFeed('error', data.error || 'Failed');
  } catch (e) { appendFeed('error', e.message); }
  unlockUI();
});

$('#btn-connect-acp').addEventListener('click', () => {
  const cwd = $('#input-cwd').value.trim();
  if (!cwd) { appendFeed('error', 'Set a project directory first'); return; }
  lockUI();
  elMetricStatus.textContent = '🔌 Connecting...'; elMetricStatus.style.color = 'var(--accent)';
  elStatus.textContent = 'connecting'; elStatus.className = 'status-badge running';
  appendFeed('system', 'Starting ACP session...');
  send({ action: 'init_acp', cwd });
});

$('#btn-init').addEventListener('click', () => {
  const prompt = $('#input-prompt').value.trim();
  if (!prompt) return;
  if (!acpReady) { appendFeed('error', 'Connect ACP first'); return; }
  lockUI();
  const maxIter = $('#input-max-iter').value || 50;
  const maxCost = $('#input-max-cost').value || '';
  const awsProfile = $('#select-aws-profile').value || 'default';
  const branch = $('#select-branch').value;
  const initPrompt = `[Ralph Loop - Init]
You are starting a new Ralph loop. AWS_PROFILE=${awsProfile}. Max iterations: ${maxIter}.${maxCost ? ' Max cost: $'+maxCost+'.' : ''}${branch === 'none' ? ' Do NOT create a branch.' : ''}

Begin working on:
${prompt}

Follow the Ralph methodology: read progress.txt, AGENTS.md, .kiro/tasks.json. Choose highest priority task, implement with feedback loops, commit, update progress.
Output <promise>DONE</promise> ONLY when ALL tasks are genuinely complete.`;
  elFeedStatus.textContent = 'running'; elFeedStatus.className = 'feed-badge active';
  $('#btn-cancel').disabled = false;
  
  appendFeed('system', `▶ Init: ${prompt.slice(0, 80)}...`);
  activeOp = 'init';
  elMetricStatus.textContent = '🔄 Building...'; elMetricStatus.style.color = 'var(--accent-green)';
  send({ action: 'prompt', text: initPrompt, initTasks: true });
  // unlockUI happens on prompt_complete
});

$('#btn-iterate').addEventListener('click', () => {
  if (!acpReady) { appendFeed('error', 'Connect ACP first'); return; }
  lockUI();
  elFeedStatus.textContent = 'running'; elFeedStatus.className = 'feed-badge active';
  $('#btn-cancel').disabled = false;
  
  appendFeed('system', '⏭ Continuing iteration...');
  activeOp = 'iterate';
  elMetricStatus.textContent = '🔄 Iterating...'; elMetricStatus.style.color = 'var(--accent-green)';
  send({ action: 'prompt', text: `[Ralph Loop - Continue]\nContinue the Ralph loop. Read progress.txt, AGENTS.md, .kiro/tasks.json. Pick next pending task. Implement, test, commit, update progress.\nOutput <promise>DONE</promise> ONLY when ALL tasks are genuinely complete.` });
});

$('#btn-plan').addEventListener('click', () => {
  const desc = $('#input-prompt').value.trim() || $('#input-plan-desc')?.value?.trim();
  if (!desc) { appendFeed('error', 'Enter a description first'); return; }
  if (!acpReady) { appendFeed('error', 'Connect ACP first'); return; }
  lockUI();
  elFeedStatus.textContent = 'running'; elFeedStatus.className = 'feed-badge active';
  $('#btn-cancel').disabled = false;
  
  appendFeed('system', `📋 Generating PRD: ${desc.slice(0, 60)}...`);
  activeOp = 'plan';
  elMetricStatus.textContent = '📋 Creating PRD...'; elMetricStatus.style.color = 'var(--accent)';
  send({ action: 'prompt', text: `Generate a structured prd.json from this description. Output ONLY the JSON. Write it to prd.json.\n\nDescription: ${desc}\n\nFormat: {"name":"...","description":"...","requirements":[{"id":"1","category":"Setup","tasks":["..."],"priority":"high"}],"success_criteria":["..."],"tech_stack":["..."]}` });
});

$('#btn-review').addEventListener('click', () => {
  if (!acpReady) { appendFeed('error', 'Connect ACP first'); return; }
  lockUI();
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  $('[data-panel="review"]').classList.add('active');
  $$('.panel').forEach(p => p.classList.remove('active'));
  $('#panel-review').classList.add('active');
  elFeedStatus.textContent = 'running'; elFeedStatus.className = 'feed-badge active';
  $('#btn-cancel').disabled = false;
  
  elReviewOutput.innerHTML = '<div class="feed-entry system">Running judge review...</div>';
  activeOp = 'review';
  elMetricStatus.textContent = '🔍 Reviewing...'; elMetricStatus.style.color = 'var(--accent-purple)';
  send({ action: 'prompt', text: `You are a JUDGE. Do NOT make changes. Read progress.txt, prd.json/prd.md, .kiro/tasks.json, and the codebase. Output: requirements met (✅/❌), code quality, completion %, remaining work, risks.` });
});

$('#btn-cancel').addEventListener('click', () => {
  send({ action: 'cancel' });
  appendFeed('system', '⏹ Cancelled');
  activeOp = null;
  unlockUI();
});

$('#btn-reset').addEventListener('click', () => {
  if (confirm('Reset Ralph state?')) {
    lockUI();
    if (acpReady) send({ action: 'prompt', text: 'Delete .kiro/ralph-state.json and .kiro/tasks.json if they exist. Say "State cleared."' });
    appendFeed('system', '🗑 Reset');
    // unlockUI on prompt_complete
  }
});

$('#btn-run-review')?.addEventListener('click', () => $('#btn-review').click());
$('#btn-generate-prd')?.addEventListener('click', () => {
  const desc = $('#input-plan-desc').value.trim();
  if (!desc) return;
  $('#input-prompt').value = desc;
  $('#btn-plan').click();
});

$('#input-prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && e.metaKey) $('#btn-init').click(); });

// Live update iteration metric when max-iterations changes
$('#input-max-iter').addEventListener('input', () => { loadProjectData(); });

// PRD tab switching
$$('.prd-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.prd-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// ── Init ──
connectWs();
loadAwsProfiles();
initTheme();
setTimeout(loadProjectData, 500);
setInterval(() => { if (connected) loadProjectData(); }, 10000);
