import { spawn } from 'child_process';
import express from 'express';
import { existsSync, readFileSync } from 'fs';
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
let projectCwd = null;

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

app.post('/api/set-cwd', (req, res) => {
  const { cwd } = req.body;
  if (cwd && existsSync(cwd)) {
    projectCwd = resolve(cwd);
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
        result: {}
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
  startAcpProcess(cwd);
  // Wait a moment for process to start
  await new Promise(r => setTimeout(r, 500));

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
          if (cwd) projectCwd = resolve(cwd);
          await initializeAcp(projectCwd);
          await createSession(projectCwd);
          ws.send(JSON.stringify({ type: 'ready', sessionId: acpSessionId }));
          break;
        }
        case 'prompt': {
          await sendPrompt(msg.text);
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

function watchProjectFiles() {
  if (!projectCwd) return;
  const files = [
    join(projectCwd, '.kiro', 'ralph-state.json'),
    join(projectCwd, 'progress.txt'),
    join(projectCwd, 'AGENTS.md')
  ];
  for (const f of files) {
    if (existsSync(f)) {
      watchFile(f, { interval: 2000 }, () => {
        try {
          const content = readFileSync(f, 'utf-8');
          const name = f.split('/').pop();
          broadcast({ type: 'file_changed', file: name, content });
        } catch {}
      });
    }
  }
}

// ── Start server ──

server.listen(PORT, () => {
  console.log(`\n  🎛️  ralph-kiro Studio`);
  console.log(`  ─────────────────────`);
  console.log(`  http://localhost:${PORT}\n`);
  if (projectCwd) {
    console.log(`  Project: ${projectCwd}`);
    watchProjectFiles();
  }
});
