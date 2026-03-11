// ralph-kiro Studio — Frontend
const WS_URL = `ws://${location.host}`;
let ws = null;
let connected = false;
let acpReady = false;

// ── DOM refs ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const elStatus = $('#connection-status');
const elFeed = $('#agent-feed');
const elFeedStatus = $('#feed-status');
const elProgress = $('#progress-content');
const elAgentsMd = $('#agents-md-content');
const elPrdEditor = $('#prd-editor');
const elReviewOutput = $('#review-output');
const elGitTimeline = $('#git-timeline');

// Metrics
const elIteration = $('#metric-iteration');
const elMetricStatus = $('#metric-status');
const elCost = $('#metric-cost');
const elStalls = $('#metric-stalls');
const elBranch = $('#metric-branch');

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
    connected = false;
    acpReady = false;
    elStatus.textContent = 'disconnected';
    elStatus.className = 'status-badge disconnected';
    setTimeout(connectWs, 3000);
  };

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    handleMessage(msg);
  };
}

function send(data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(data));
}

// ── Message Handler ──
function handleMessage(msg) {
  switch (msg.type) {
    case 'connected':
      if (msg.cwd) $('#input-cwd').value = msg.cwd;
      if (msg.acpRunning) {
        acpReady = true;
        elStatus.textContent = 'acp ready';
        elStatus.className = 'status-badge connected';
      }
      break;

    case 'ready':
      acpReady = true;
      elStatus.textContent = 'acp ready';
      elStatus.className = 'status-badge connected';
      loadProjectData();
      break;

    case 'acp_initialized':
      appendFeed('system', 'ACP initialized');
      break;

    case 'session_created':
      appendFeed('system', `Session created: ${msg.sessionId}`);
      break;

    case 'acp_notification':
      handleAcpNotification(msg);
      break;

    case 'acp_response':
      if (msg.method === 'session/prompt') {
        elFeedStatus.textContent = 'idle';
        elFeedStatus.className = 'feed-badge';
        $('#btn-cancel').disabled = true;
        loadProjectData();
      }
      break;

    case 'prompt_complete':
      elFeedStatus.textContent = 'idle';
      elFeedStatus.className = 'feed-badge';
      $('#btn-cancel').disabled = true;
      loadProjectData();
      break;

    case 'acp_stderr':
      appendFeed('error', msg.data);
      break;

    case 'acp_raw':
      appendFeed('text', msg.data);
      break;

    case 'acp_closed':
      acpReady = false;
      elStatus.textContent = 'acp stopped';
      elStatus.className = 'status-badge disconnected';
      appendFeed('system', `ACP process exited (code: ${msg.code})`);
      break;

    case 'acp_error':
      appendFeed('error', msg.error);
      break;

    case 'permission_auto_approved':
      appendFeed('system', `Auto-approved: ${JSON.stringify(msg.params).slice(0, 100)}`);
      break;

    case 'file_changed':
      handleFileChange(msg);
      break;

    case 'error':
      appendFeed('error', msg.error);
      break;
  }
}

// ── ACP Notification Handler ──
function handleAcpNotification(msg) {
  const { method, params } = msg;
  if (!params) return;

  const update = params.update;
  if (!update) return;

  switch (update.sessionUpdate) {
    case 'agent_message_chunk':
      if (update.content && update.content.text) {
        appendFeed('text', update.content.text);
      }
      break;

    case 'tool_call':
      appendFeed('tool-call', `🔧 ${update.title || 'Tool call'} [${update.kind || ''}] — ${update.status}`);
      break;

    case 'tool_call_update':
      if (update.status === 'completed' && update.content) {
        for (const c of update.content) {
          if (c.content && c.content.text) {
            appendFeed('tool-result', c.content.text.slice(0, 500));
          }
        }
      } else {
        appendFeed('tool-call', `🔧 Tool ${update.toolCallId} — ${update.status}`);
      }
      break;

    case 'plan':
      if (update.entries) {
        const planText = update.entries.map(e =>
          `${e.status === 'completed' ? '✅' : '⬜'} [${e.priority || ''}] ${e.content}`
        ).join('\n');
        appendFeed('system', `📋 Plan:\n${planText}`);
      }
      break;

    case 'user_message_chunk':
      if (update.content && update.content.text) {
        appendFeed('system', `👤 ${update.content.text}`);
      }
      break;
  }
}

// ── Feed ──
function appendFeed(type, text) {
  // Remove empty placeholder
  const empty = elFeed.querySelector('.feed-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = `feed-entry ${type}`;

  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const label = { text: '💬', 'tool-call': '🔧', 'tool-result': '✅', error: '❌', system: 'ℹ️' }[type] || '';

  entry.innerHTML = `<span class="timestamp">${time}</span><span class="label">${label}</span>${escapeHtml(text)}`;
  elFeed.appendChild(entry);
  elFeed.scrollTop = elFeed.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── File Change Handler ──
function handleFileChange(msg) {
  switch (msg.file) {
    case 'ralph-state.json':
      try { updateMetrics(JSON.parse(msg.content)); } catch {}
      break;
    case 'progress.txt':
      elProgress.textContent = msg.content || 'No progress file yet';
      break;
    case 'AGENTS.md':
      elAgentsMd.textContent = msg.content || 'No AGENTS.md yet';
      break;
  }
}

// ── Load Project Data ──
async function loadProjectData() {
  try {
    const [state, progress, agentsMd, prd, gitLog] = await Promise.all([
      fetch('/api/state').then(r => r.json()),
      fetch('/api/progress').then(r => r.json()),
      fetch('/api/agents-md').then(r => r.json()),
      fetch('/api/prd').then(r => r.json()),
      fetch('/api/git-log').then(r => r.json()),
    ]);

    if (state) updateMetrics(state);
    elProgress.textContent = progress.content || 'No progress file yet';
    elAgentsMd.textContent = agentsMd.content || 'No AGENTS.md yet';
    if (prd.content) elPrdEditor.value = prd.content;
    renderGitTimeline(gitLog);
  } catch (e) {
    console.error('Failed to load project data:', e);
  }
}

function updateMetrics(state) {
  if (!state) return;
  elIteration.textContent = `${state.iteration || 0} / ${state.maxIterations || 50}`;
  const active = state.active;
  const success = state.success;
  if (active) {
    elMetricStatus.textContent = '🟢 Active';
    elMetricStatus.style.color = 'var(--accent-green)';
  } else if (success) {
    elMetricStatus.textContent = '✅ Done';
    elMetricStatus.style.color = 'var(--accent-green)';
  } else {
    elMetricStatus.textContent = '⏸️ Stopped';
    elMetricStatus.style.color = 'var(--accent-yellow)';
  }
  const cost = state.metrics?.estimatedCostUsd || 0;
  elCost.textContent = `$${Number(cost).toFixed(2)}`;
  const stalls = state.metrics?.stalls || 0;
  elStalls.textContent = `${stalls} / 3`;
  elStalls.style.color = stalls >= 2 ? 'var(--accent-red)' : stalls >= 1 ? 'var(--accent-yellow)' : 'var(--text)';
  elBranch.textContent = state.branch || '—';
}

function renderGitTimeline(commits) {
  if (!commits || !commits.length) {
    elGitTimeline.innerHTML = '<div class="feed-empty">No commits yet</div>';
    return;
  }
  elGitTimeline.innerHTML = commits.map(c => `
    <div class="commit-entry">
      <div class="commit-dot"></div>
      <div>
        <span class="commit-hash">${(c.hash || '').slice(0, 7)}</span>
        <span class="commit-msg">${escapeHtml(c.message || '')}</span>
        <div class="commit-date">${c.date || ''}</div>
      </div>
    </div>
  `).join('');
}

// ── Button Handlers ──

// Set project directory
$('#btn-set-cwd').addEventListener('click', async () => {
  const cwd = $('#input-cwd').value.trim();
  if (!cwd) return;
  try {
    const res = await fetch('/api/set-cwd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd })
    });
    const data = await res.json();
    if (data.ok) {
      appendFeed('system', `Project set to: ${data.cwd}`);
      loadProjectData();
    } else {
      appendFeed('error', data.error || 'Failed to set directory');
    }
  } catch (e) {
    appendFeed('error', e.message);
  }
});

// Connect ACP
$('#btn-connect-acp').addEventListener('click', () => {
  const cwd = $('#input-cwd').value.trim();
  if (!cwd) {
    appendFeed('error', 'Set a project directory first');
    return;
  }
  appendFeed('system', 'Starting ACP connection...');
  send({ action: 'init_acp', cwd });
});

// Init & Iterate
$('#btn-init').addEventListener('click', () => {
  const prompt = $('#input-prompt').value.trim();
  if (!prompt) return;
  if (!acpReady) {
    appendFeed('error', 'Connect ACP first');
    return;
  }

  const initPrompt = `[Ralph Loop - Init]

You are starting a new Ralph loop. First:
1. Initialize git repo if not already done
2. Create AGENTS.md knowledge base if it doesn't exist
3. Create .kiro/ralph-state.json with iteration 0

Then begin working on:
${prompt}

Follow the Ralph methodology: read progress.txt, choose highest priority task, implement with feedback loops, commit, update progress.txt and AGENTS.md.

Output <promise>DONE</promise> ONLY when ALL tasks are genuinely complete.`;

  elFeedStatus.textContent = 'running';
  elFeedStatus.className = 'feed-badge active';
  $('#btn-cancel').disabled = false;
  appendFeed('system', `Starting loop: ${prompt.slice(0, 80)}...`);
  send({ action: 'prompt', text: initPrompt });
});

// Continue Iterate
$('#btn-iterate').addEventListener('click', () => {
  if (!acpReady) {
    appendFeed('error', 'Connect ACP first');
    return;
  }

  const iterPrompt = `[Ralph Loop - Continue]

Continue the Ralph loop. Read progress.txt and AGENTS.md to see what's done.
Choose the next highest priority task and implement it.
Follow feedback loops (tests, types, lint) before committing.
Update progress.txt and AGENTS.md after each task.

Output <promise>DONE</promise> ONLY when ALL tasks are genuinely complete.`;

  elFeedStatus.textContent = 'running';
  elFeedStatus.className = 'feed-badge active';
  $('#btn-cancel').disabled = false;
  appendFeed('system', 'Continuing iteration...');
  send({ action: 'prompt', text: iterPrompt });
});

// Judge Review
$('#btn-review').addEventListener('click', () => {
  if (!acpReady) {
    appendFeed('error', 'Connect ACP first');
    return;
  }

  const reviewPrompt = `You are a JUDGE reviewing the current state of this project. Do NOT make any changes.

YOUR TASK:
1. Read progress.txt to see what has been completed
2. Read prd.json or prd.md if they exist to see the full requirements
3. Review the codebase to assess current state

OUTPUT A REPORT:
- Requirements met (list each with ✅ or ❌)
- Code quality assessment
- Estimated completion percentage
- Remaining work summary
- Risks or blockers

Do NOT modify any files. This is a read-only review.`;

  // Switch to review panel
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  $('[data-panel="review"]').classList.add('active');
  $$('.panel').forEach(p => p.classList.remove('active'));
  $('#panel-review').classList.add('active');

  elReviewOutput.innerHTML = '<div class="feed-entry system">Running judge review...</div>';
  send({ action: 'prompt', text: reviewPrompt });
});

// Cancel
$('#btn-cancel').addEventListener('click', () => {
  send({ action: 'cancel' });
  appendFeed('system', 'Cancellation requested');
  $('#btn-cancel').disabled = true;
});

// Reset
$('#btn-reset').addEventListener('click', () => {
  if (confirm('Reset Ralph state? This clears .kiro/ralph-state.json')) {
    if (acpReady) {
      send({ action: 'prompt', text: 'Delete the file .kiro/ralph-state.json if it exists. Say "State cleared."' });
    }
    appendFeed('system', 'Reset requested');
  }
});

// Generate PRD
$('#btn-plan').addEventListener('click', () => {
  const desc = $('#input-plan').value.trim();
  if (!desc) return;
  if (!acpReady) {
    appendFeed('error', 'Connect ACP first');
    return;
  }

  const planPrompt = `Generate a structured prd.json file from this description. Output ONLY the JSON file content, no explanation.

Description: ${desc}

The prd.json should follow this format:
{
  "name": "Project Name",
  "description": "What the project does",
  "requirements": [
    {"id": "1", "category": "Setup", "tasks": ["task1", "task2"], "priority": "high"},
    {"id": "2", "category": "Core", "tasks": ["task3"], "priority": "high"}
  ],
  "success_criteria": ["criterion 1", "criterion 2"],
  "tech_stack": ["technology choices"]
}

Write the JSON to prd.json in the current directory.`;

  appendFeed('system', `Generating PRD from: ${desc.slice(0, 60)}...`);
  send({ action: 'prompt', text: planPrompt });
});

// Run Review button in review panel
$('#btn-run-review').addEventListener('click', () => {
  $('#btn-review').click();
});

// Enter key in prompt
$('#input-prompt').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.metaKey) {
    $('#btn-init').click();
  }
});

// ── Init ──
connectWs();

// Load data on page load
setTimeout(loadProjectData, 500);

// Periodic refresh
setInterval(() => {
  if (connected) loadProjectData();
}, 10000);
