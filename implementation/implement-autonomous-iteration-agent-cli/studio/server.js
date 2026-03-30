import { spawn } from 'child_process';
import express from 'express';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unwatchFile, watchFile, writeFileSync } from 'fs';
import { createServer } from 'http';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3456;
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static frontend
app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

// State
let acpProcess = null;
let acpSessionId = null;
let pendingRequests = new Map();
let requestId = 0;
let clients = new Set();

// Default project directory to where studio was launched
let projectCwd = process.cwd();
let currentIteration = 0; // track iterations in-memory

// Save cwd to disk for persistence within a session (not auto-loaded on restart)
const cwdFile = join(__dirname, '.last-cwd');

function saveCwd(cwd) {
  projectCwd = cwd;
  try { writeFileSync(cwdFile, cwd); } catch {}
}

// ── REST API for project state ──

app.get('/api/state', (req, res) => {
  const cwd = projectCwd || process.cwd();
  const stateFile = join(cwd, '.kiro', 'ralph-state.json');
  if (existsSync(stateFile)) {
    try {
      res.json(JSON.parse(readFileSync(stateFile, 'utf-8')));
    } catch { res.json(null); }
  } else {
    res.json(null);
  }
});

app.get('/api/progress', (req, res) => {
  const cwd = projectCwd || process.cwd();
  const f = join(cwd, 'progress.txt');
  res.json({ content: existsSync(f) ? readFileSync(f, 'utf-8') : null });
});

app.get('/api/agents-md', (req, res) => {
  const cwd = projectCwd || process.cwd();
  const f = join(cwd, 'AGENTS.md');
  res.json({ content: existsSync(f) ? readFileSync(f, 'utf-8') : null });
});

app.get('/api/prd', (req, res) => {
  const cwd = projectCwd || process.cwd();
  for (const name of ['prd.json', 'prd.md']) {
    const f = join(cwd, name);
    if (existsSync(f)) {
      return res.json({ filename: name, content: readFileSync(f, 'utf-8') });
    }
  }
  res.json({ filename: null, content: null });
});

app.get('/api/tasks', (req, res) => {
  const cwd = projectCwd || process.cwd();
  const f = join(cwd, '.kiro', 'tasks.json');
  if (existsSync(f)) {
    try { res.json(JSON.parse(readFileSync(f, 'utf-8'))); }
    catch { res.json(null); }
  } else {
    res.json(null);
  }
});

app.get('/api/logs', (req, res) => {
  const cwd = projectCwd || process.cwd();
  const logDir = join(cwd, '.kiro', 'ralph-logs');
  if (!existsSync(logDir)) return res.json([]);
  try {
    const files = readdirSync(logDir)
      .filter(f => f.startsWith('iteration-') && f.endsWith('.log'))
      .map(f => {
        const st = statSync(join(logDir, f));
        return { name: f, size: st.size, modified: st.mtime };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
    res.json(files);
  } catch { res.json([]); }
});

app.get('/api/logs/:name', (req, res) => {
  const cwd = projectCwd || process.cwd();
  const logDir = join(cwd, '.kiro', 'ralph-logs');
  const name = req.params.name;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return res.status(400).json({ error: 'Invalid log name' });
  }
  const f = resolve(logDir, name);
  if (!f.startsWith(logDir + '/') || !existsSync(f)) {
    return res.status(404).json({ error: 'Log not found' });
  }
  res.json({ content: readFileSync(f, 'utf-8') });
});

app.get('/api/skills', (req, res) => {
  const cwd = projectCwd || process.cwd();
  const skills = [];
  for (const dir of ['skills', '.kiro/skills']) {
    const skillsPath = join(cwd, dir);
    if (!existsSync(skillsPath)) continue;
    try {
      for (const entry of readdirSync(skillsPath, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const skillMd = join(skillsPath, entry.name, 'SKILL.md');
          if (existsSync(skillMd)) {
            skills.push({ name: entry.name, content: readFileSync(skillMd, 'utf-8') });
          }
        }
      }
    } catch {}
  }
  res.json(skills);
});

app.get('/api/git-log', (req, res) => {
  const cwd = projectCwd || process.cwd();
  const git = spawn('git', ['-P', 'log', '--oneline', '--format=%H|%s|%ai', '-20'], { cwd });
  let out = '';
  git.stdout.on('data', d => out += d);
  git.on('close', () => {
    const commits = out.trim().split('\n').filter(Boolean).map(line => {
      const [hash, ...rest] = line.split('|');
      return { hash, message: rest[0], date: rest[1] };
    });
    res.json(commits);
  });
  git.on('error', () => res.json([]));
});

app.get('/api/aws-profiles', (req, res) => {
  const cwd = projectCwd || process.cwd();
  const awsConfig = join(process.env.HOME || '', '.aws', 'config');
  const profiles = ['default'];
  if (existsSync(awsConfig)) {
    try {
      const content = readFileSync(awsConfig, 'utf-8');
      const matches = content.matchAll(/\[profile\s+(.+?)\]/g);
      for (const m of matches) profiles.push(m[1]);
    } catch {}
  }
  res.json([...new Set(profiles)]);
});

app.post('/api/set-cwd', (req, res) => {
  const { cwd } = req.body;
  if (cwd && existsSync(cwd)) {
    saveCwd(resolve(cwd));
    watchProjectFiles();
    broadcast({ type: 'cwd_changed', cwd: projectCwd });
    res.json({ ok: true, cwd: projectCwd });
  } else {
    res.status(400).json({ error: 'Invalid directory' });
  }
});

// ── ACP Bridge ──

function nextId() { return ++requestId; }

function sendToAcp(method, params) {
  return new Promise((resolve, reject) => {
    if (!acpProcess || acpProcess.killed) {
      return reject(new Error('ACP process not running'));
    }
    const id = nextId();
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    pendingRequests.set(id, { resolve, reject, method });
    acpProcess.stdin.write(msg + '\n');
  });
}

function handleAcpMessage(msg) {
  // Agent requesting permission from us (client) — has both method and id
  if (msg.method === 'session/request_permission' && msg.id) {
    broadcast({ type: 'acp_notification', method: msg.method, params: msg.params });
    const response = JSON.stringify({
      jsonrpc: '2.0', id: msg.id,
      result: { outcome: 'approved' }
    });
    acpProcess.stdin.write(response + '\n');
    broadcast({ type: 'permission_auto_approved', id: msg.id, params: msg.params });
    return;
  }

  // Any other request from agent to client (fs/read_text_file, terminal/create, etc.)
  if (msg.method && msg.id) {
    broadcast({ type: 'acp_notification', method: msg.method, params: msg.params });
    // For now, return empty success for fs operations
    if (msg.method.startsWith('fs/') || msg.method.startsWith('terminal/')) {
      const response = JSON.stringify({
        jsonrpc: '2.0', id: msg.id,
        error: { code: -32601, message: `Method not implemented: ${msg.method}` }
      });
      acpProcess.stdin.write(response + '\n');
    }
    return;
  }

  // Response to a request we sent
  if (msg.id && pendingRequests.has(msg.id)) {
    const pending = pendingRequests.get(msg.id);
    pendingRequests.delete(msg.id);
    if (msg.error) {
      pending.reject(msg.error);
    } else {
      pending.resolve(msg.result);
    }
    broadcast({ type: 'acp_response', id: msg.id, method: pending.method, result: msg.result, error: msg.error });
    return;
  }

  // Notification from agent (session/update, etc.) — no id
  if (msg.method) {
    broadcast({ type: 'acp_notification', method: msg.method, params: msg.params });
    return;
  }
}

function startAcpProcess(cwd) {
  if (acpProcess && !acpProcess.killed) {
    acpProcess.kill();
  }

  const kiroCli = process.env.KIRO_CLI || 'kiro-cli';
  acpProcess = spawn(kiroCli, ['acp', '--agent', 'ralph'], {
    cwd: cwd || projectCwd || process.cwd(),
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const thisProcess = acpProcess;

  let buffer = '';
  acpProcess.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        handleAcpMessage(msg);
      } catch (e) {
        broadcast({ type: 'acp_raw', data: line });
      }
    }
  });

  acpProcess.stderr.on('data', (data) => {
    broadcast({ type: 'acp_stderr', data: data.toString() });
  });

  acpProcess.on('close', (code) => {
    if (acpProcess !== thisProcess) return;
    for (const [id, pending] of pendingRequests) {
      pending.reject(new Error(`ACP process exited with code ${code}`));
    }
    pendingRequests.clear();
    broadcast({ type: 'acp_closed', code });
    acpProcess = null;
    acpSessionId = null;
  });

  acpProcess.on('error', (err) => {
    broadcast({ type: 'acp_error', error: err.message });
  });

  return acpProcess;
}

async function initializeAcp(cwd) {
  const proc = startAcpProcess(cwd);
  await new Promise((resolve, reject) => {
    proc.on('spawn', resolve);
    proc.on('error', reject);
  });

  const initResult = await sendToAcp('initialize', {
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true
    }
  });
  broadcast({ type: 'acp_initialized', capabilities: initResult });
  return initResult;
}

async function createSession(cwd) {
  const result = await sendToAcp('session/new', {
    cwd: cwd || projectCwd || process.cwd(),
    mcpServers: []
  });
  acpSessionId = result.sessionId;
  broadcast({ type: 'session_created', sessionId: acpSessionId });
  return result;
}

async function sendPrompt(text) {
  if (!acpSessionId) throw new Error('No active session');
  const result = await sendToAcp('session/prompt', {
    sessionId: acpSessionId,
    prompt: [{ type: 'text', text }]
  });
  broadcast({ type: 'prompt_complete', result });
  return result;
}

function cancelSession() {
  if (!acpSessionId || !acpProcess) return;
  const msg = JSON.stringify({
    jsonrpc: '2.0',
    method: 'session/cancel',
    params: { sessionId: acpSessionId }
  });
  acpProcess.stdin.write(msg + '\n');
  broadcast({ type: 'session_cancelled' });
}

// ── Task Graph Generation ──

function initStateFile(cwd, prompt, maxIterations) {
  const dir = join(cwd, '.kiro');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const stateFile = join(dir, 'ralph-state.json');
  const state = {
    active: true,
    iteration: 0,
    maxIterations: maxIterations || 50,
    completionPromise: 'DONE',
    awsProfile: 'default',
    branch: '',
    maxCost: '',
    prompt: prompt || '',
    startedAt: new Date().toISOString(),
    agent: 'ralph',
    metrics: { totalIterations: 0, estimatedCostUsd: 0, stalls: 0 }
  };
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  broadcast({ type: 'file_changed', file: 'ralph-state.json', content: JSON.stringify(state, null, 2) });
}

function markStateComplete(cwd) {
  const stateFile = join(cwd, '.kiro', 'ralph-state.json');
  if (!existsSync(stateFile)) return;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    state.active = false;
    state.success = true;
    state.iteration = Math.max(state.iteration, 1);
    state.metrics.totalIterations = state.iteration;
    state.completedAt = new Date().toISOString();
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
    broadcast({ type: 'file_changed', file: 'ralph-state.json', content: JSON.stringify(state, null, 2) });
  } catch {}
}

function updateStateIteration(cwd, iteration) {
  if (!cwd) return;
  const stateFile = join(cwd, '.kiro', 'ralph-state.json');
  if (!existsSync(stateFile)) return;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    state.iteration = iteration;
    state.metrics.totalIterations = iteration;
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
    broadcast({ type: 'file_changed', file: 'ralph-state.json', content: JSON.stringify(state, null, 2) });
  } catch {}
}

function generateTasksFromPrd(cwd) {
  const tasksFile = join(cwd, '.kiro', 'tasks.json');
  if (existsSync(tasksFile)) return;

  const prdJson = join(cwd, 'prd.json');
  if (!existsSync(prdJson)) return;

  try {
    const prd = JSON.parse(readFileSync(prdJson, 'utf-8'));
    const tasks = [];
    let taskId = 0;
    const reqs = prd.requirements || [];
    for (const req of reqs) {
      if (typeof req === 'object' && req.tasks) {
        const cat = req.category || 'General';
        const priority = req.priority || 'medium';
        for (const t of req.tasks) {
          taskId++;
          tasks.push({ id: taskId, description: typeof t === 'string' ? t : String(t), category: cat, priority, status: 'pending', depends_on: [], iteration: null, notes: '' });
        }
      } else if (typeof req === 'string') {
        taskId++;
        tasks.push({ id: taskId, description: req, category: 'General', priority: 'medium', status: 'pending', depends_on: [], iteration: null, notes: '' });
      }
    }
    if (tasks.length > 0) {
      const dir = join(cwd, '.kiro');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const graph = { version: 1, source: 'prd.json', tasks, success_criteria: prd.success_criteria || [] };
      writeFileSync(tasksFile, JSON.stringify(graph, null, 2));
      broadcast({ type: 'file_changed', file: 'tasks.json', content: JSON.stringify(graph, null, 2) });
    }
  } catch (e) { console.error('Failed to generate tasks:', e.message); }
}

// ── WebSocket handling ──

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({
    type: 'connected',
    cwd: projectCwd,
    sessionId: acpSessionId,
    acpRunning: acpProcess && !acpProcess.killed
  }));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      switch (msg.action) {
        case 'init_acp': {
          const cwd = msg.cwd || projectCwd;
          if (cwd) saveCwd(resolve(cwd));
          await initializeAcp(projectCwd);
          await createSession(projectCwd);
          ws.send(JSON.stringify({ type: 'ready', sessionId: acpSessionId }));
          break;
        }
        case 'prompt': {
          // Before first prompt, generate tasks.json and init state file
          if (msg.initTasks && projectCwd) {
            generateTasksFromPrd(projectCwd);
            currentIteration = 0;
            initStateFile(projectCwd, msg.prompt || '', msg.maxIterations || 50);
          }
          currentIteration++;
          // Update iteration in state file
          updateStateIteration(projectCwd, currentIteration);
          const result = await sendPrompt(msg.text);
          // Mark state complete after prompt finishes
          if (msg.initTasks && projectCwd) {
            markStateComplete(projectCwd);
          }
          break;
        }
        case 'cancel': {
          cancelSession();
          break;
        }
        case 'stop_acp': {
          if (acpProcess && !acpProcess.killed) acpProcess.kill();
          break;
        }
        default:
          ws.send(JSON.stringify({ type: 'error', error: `Unknown action: ${msg.action}` }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', error: err.message || String(err) }));
    }
  });

  ws.on('close', () => clients.delete(ws));
});

// ── File watchers for live updates ──

let watchedFiles = [];

function unwatchProjectFiles() {
  for (const f of watchedFiles) {
    unwatchFile(f);
  }
  watchedFiles = [];
}

function watchProjectFiles() {
  unwatchProjectFiles();
  if (!projectCwd) return;
  const files = [
    join(projectCwd, '.kiro', 'ralph-state.json'),
    join(projectCwd, '.kiro', 'tasks.json'),
    join(projectCwd, 'progress.txt'),
    join(projectCwd, 'AGENTS.md')
  ];
  for (const f of files) {
    watchedFiles.push(f);
    watchFile(f, { interval: 2000 }, () => {
      try {
        const content = readFileSync(f, 'utf-8');
        const name = f.split('/').pop();
        broadcast({ type: 'file_changed', file: name, content });
      } catch {}
    });
  }
}

// ── Start server ──

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  🎛️  ralph-kiro Studio`);
  console.log(`  ─────────────────────`);
  console.log(`  http://localhost:${PORT}\n`);
  if (projectCwd) {
    console.log(`  Project: ${projectCwd}`);
    watchProjectFiles();
  }
});
