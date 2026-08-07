const express = require('express');
const initSqlJs = require('sql.js');
const dotenv = require('dotenv');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const ROOT = __dirname;
dotenv.config({ path: path.join(ROOT, '.env') });
const API_PORT = Number(process.env.API_PORT || 8787);
const DATA_DIR = process.env.SYNAPSE_DATA_DIR ? path.resolve(process.env.SYNAPSE_DATA_DIR) : path.join(ROOT, 'data');
const LEGACY_WORKSPACE_FILE = path.join(DATA_DIR, 'workspace.json');
const LEGACY_SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DB_FILE = path.join(DATA_DIR, 'synapse.db');
const DEFAULT_SYSTEM_PROMPT = '你是 Synapse 的学习伙伴。使用清晰、准确的中文分层解释，并保持回答紧凑。';

function now() { return new Date().toISOString(); }
function defaultSettings() {
  return {
    provider: process.env.AI_PROVIDER || 'demo',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || '',
    systemPrompt: process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT
  };
}
function makeMessage(threadId, role, content) { return { id: randomUUID(), threadId, role, content, createdAt: now() }; }
function createSeed() {
  const workspaceId = 'default';
  const quick = [
    makeMessage('quick', 'user', '解释快速排序的核心思想，并用一个数组例子说明。'),
    makeMessage('quick', 'assistant', '快速排序通过 **分治** 工作：选择一个基准值，将小于它的元素移到左侧，大于它的元素移到右侧，再递归处理两个子数组。\n\n例如对 `[6, 3, 8, 2, 5]` 选择 5 为基准，分区后得到 `[3, 2] 5 [6, 8]`。此时 5 已在最终位置。'),
    makeMessage('quick', 'user', '为什么它的平均时间复杂度是 O(n log n)？'),
    makeMessage('quick', 'assistant', '每一层分区要遍历约 `n` 个元素；如果基准通常能把数组分成接近两半，递归树高度约为 `log n`，因此总工作量是 `O(n log n)`。')
  ];
  const merge = [
    makeMessage('merge', 'user', '解释归并排序，并和快速排序做个对比。'),
    makeMessage('merge', 'assistant', '归并排序先不断二分，直到每组只有一个元素，然后按大小合并。它在任何输入下都稳定地保持 `O(n log n)`，代价是需要 `O(n)` 的额外空间。'),
    makeMessage('merge', 'user', '什么叫稳定排序？'),
    makeMessage('merge', 'assistant', '若两个元素的键相同，排序后仍保持原来的相对顺序，就称算法稳定。归并时先取左侧元素，即可保证这一点。')
  ];
  const divide = [
    makeMessage('divide', 'user', '分治算法有什么共同特征？'),
    makeMessage('divide', 'assistant', '典型结构是：**分解**问题、**递归**解决子问题、再**合并**结果。合并成本和子问题规模决定最终复杂度。'),
    makeMessage('divide', 'assistant', '二分查找、归并排序和快速排序都是常见例子，但快速排序的合并发生在分区阶段。')
  ];
  const heap = [
    makeMessage('heap', 'user', '堆排序适合什么场景？'),
    makeMessage('heap', 'assistant', '需要保证 `O(n log n)` 最坏复杂度且内存较紧时，堆排序很实用；但它不稳定，也通常不如快速排序有较好的常数表现。')
  ];
  return {
    workspaces: [{ id: workspaceId, title: '算法复习工作台', createdAt: now(), updatedAt: now() }],
    threads: [
      { id: 'quick', workspaceId, parentThreadId: null, parentMessageId: null, title: '快速排序', topic: '#0d9488', model: 'Synapse Demo', status: 'active', pinned: true, position: { x: 100, y: 205 }, createdAt: now(), updatedAt: now() },
      { id: 'merge', workspaceId, parentThreadId: 'quick', parentMessageId: quick[3].id, title: '归并排序', topic: '#d97706', model: 'Synapse Demo', status: 'active', pinned: false, position: { x: 480, y: 100 }, createdAt: now(), updatedAt: now() },
      { id: 'divide', workspaceId, parentThreadId: 'quick', parentMessageId: quick[3].id, title: '分治思想', topic: '#0369a1', model: 'Synapse Demo', status: 'active', pinned: false, position: { x: 480, y: 305 }, createdAt: now(), updatedAt: now() },
      { id: 'heap', workspaceId, parentThreadId: null, parentMessageId: null, title: '堆排序', topic: '#be123c', model: 'Synapse Demo', status: 'active', pinned: true, position: { x: 100, y: 440 }, createdAt: now(), updatedAt: now() }
    ],
    messages: [...quick, ...merge, ...divide, ...heap],
    links: [{ id: 'quick-merge-link', workspaceId, sourceThreadId: 'quick', targetThreadId: 'merge', label: '排序策略对比', type: 'semantic' }]
  };
}

let db;
function createDatabaseFacade(raw) {
  let transactionDepth = 0;
  let dirty = false;
  function save() {
    if (transactionDepth) { dirty = true; return; }
    writeFileSync(DB_FILE, Buffer.from(raw.export()));
  }
  function parameters(values) { return values.length === 1 && Array.isArray(values[0]) ? values[0] : values; }
  return {
    exec(sql) { raw.exec(sql); save(); },
    prepare(sql) {
      return {
        get(...values) { const statement = raw.prepare(sql); try { statement.bind(parameters(values)); return statement.step() ? statement.getAsObject() : undefined; } finally { statement.free(); } },
        all(...values) { const statement = raw.prepare(sql); const rows = []; try { statement.bind(parameters(values)); while (statement.step()) rows.push(statement.getAsObject()); return rows; } finally { statement.free(); } },
        run(...values) { raw.run(sql, parameters(values)); save(); return { changes: raw.getRowsModified() }; }
      };
    },
    transaction(callback) {
      return (...values) => { raw.run('BEGIN'); transactionDepth += 1; try { const result = callback(...values); raw.run('COMMIT'); transactionDepth -= 1; if (dirty) { dirty = false; save(); } return result; } catch (error) { raw.run('ROLLBACK'); transactionDepth -= 1; dirty = false; throw error; } };
    }
  };
}
async function openDatabase() {
  mkdirSync(DATA_DIR, { recursive: true });
  const SQL = await initSqlJs({ locateFile: file => path.join(ROOT, 'node_modules', 'sql.js', 'dist', file) });
  const raw = existsSync(DB_FILE) ? new SQL.Database(readFileSync(DB_FILE)) : new SQL.Database();
  db = createDatabaseFacade(raw);
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), provider TEXT NOT NULL, base_url TEXT NOT NULL, api_key TEXT NOT NULL, model TEXT NOT NULL, system_prompt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), parent_thread_id TEXT, parent_message_id TEXT, title TEXT NOT NULL, topic TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0, position_x REAL NOT NULL, position_y REAL NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('user', 'assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), source_thread_id TEXT NOT NULL REFERENCES threads(id), target_thread_id TEXT NOT NULL REFERENCES threads(id), label TEXT NOT NULL, type TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS messages_thread_created_idx ON messages(thread_id, created_at);
    CREATE INDEX IF NOT EXISTS threads_workspace_idx ON threads(workspace_id);
  `);
  if (!db.prepare('PRAGMA table_info(settings)').all().some(column => column.name === 'system_prompt')) db.exec(`ALTER TABLE settings ADD COLUMN system_prompt TEXT NOT NULL DEFAULT '${DEFAULT_SYSTEM_PROMPT.replace(/'/g, "''")}'`);
  if (!db.prepare('SELECT 1 FROM workspaces LIMIT 1').get()) seedDatabase(db);
  if (!db.prepare('SELECT 1 FROM settings WHERE id = 1').get()) {
    const legacy = existsSync(LEGACY_SETTINGS_FILE) ? JSON.parse(readFileSync(LEGACY_SETTINGS_FILE, 'utf8')) : {};
    const setting = { ...defaultSettings(), ...legacy };
    db.prepare('INSERT INTO settings (id, provider, base_url, api_key, model, system_prompt) VALUES (1, ?, ?, ?, ?, ?)').run(setting.provider, setting.baseUrl, setting.apiKey, setting.model, setting.systemPrompt || DEFAULT_SYSTEM_PROMPT);
  }
  return db;
}

function seedDatabase(db) {
  const source = existsSync(LEGACY_WORKSPACE_FILE) ? JSON.parse(readFileSync(LEGACY_WORKSPACE_FILE, 'utf8')) : createSeed();
  const insert = db.transaction(() => {
    const workspace = db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?)');
    const thread = db.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const message = db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?)');
    const link = db.prepare('INSERT INTO links VALUES (?, ?, ?, ?, ?, ?)');
    for (const item of source.workspaces || []) workspace.run(item.id, item.title, item.createdAt, item.updatedAt);
    for (const item of source.threads || []) thread.run(item.id, item.workspaceId, item.parentThreadId, item.parentMessageId, item.title, item.topic, item.model, item.status, item.pinned ? 1 : 0, item.position.x, item.position.y, item.createdAt, item.updatedAt);
    for (const item of source.messages || []) message.run(item.id, item.threadId, item.role, item.content, item.createdAt);
    for (const item of source.links || []) link.run(item.id, item.workspaceId, item.sourceThreadId, item.targetThreadId, item.label || '', item.type || 'semantic');
  });
  insert();
}

function settingRow() { return db.prepare('SELECT provider, base_url, api_key, model, system_prompt FROM settings WHERE id = 1').get(); }
function configuredModelName() { const row = settingRow(); return row.provider === 'demo' ? 'Synapse Demo' : (row.model || 'Configured model'); }
function publicSettings() { const row = settingRow(); return { provider: row.provider, baseUrl: row.base_url, model: row.model, systemPrompt: row.system_prompt || DEFAULT_SYSTEM_PROMPT, hasApiKey: Boolean(row.api_key) }; }
function applySettings(input, { includeApiKey = true } = {}) {
  const current = settingRow();
  const provider = input.provider || current.provider;
  if (!['demo', 'openai-compatible'].includes(provider)) throw new Error('Unsupported provider');
  const next = { provider, baseUrl: String(input.baseUrl || current.base_url).replace(/\/$/, ''), apiKey: current.api_key, model: String(input.model || current.model).trim(), systemPrompt: typeof input.systemPrompt === 'string' ? input.systemPrompt.trim().slice(0, 8000) : (current.system_prompt || DEFAULT_SYSTEM_PROMPT) };
  if (provider === 'openai-compatible') { try { new URL(next.baseUrl); } catch { throw new Error('Model service URL is invalid'); } }
  if (includeApiKey && typeof input.apiKey === 'string' && input.apiKey.trim()) next.apiKey = input.apiKey.trim();
  if (input.clearApiKey === true) next.apiKey = '';
  return next;
}
function saveSettings(settings) { db.prepare('UPDATE settings SET provider = ?, base_url = ?, api_key = ?, model = ?, system_prompt = ? WHERE id = 1').run(settings.provider, settings.baseUrl, settings.apiKey, settings.model, settings.systemPrompt || DEFAULT_SYSTEM_PROMPT); }
function getThread(id) { return db.prepare('SELECT * FROM threads WHERE id = ?').get(id); }
function rowThread(row) { return row && { id: row.id, workspaceId: row.workspace_id, parentThreadId: row.parent_thread_id, parentMessageId: row.parent_message_id, title: row.title, topic: row.topic, model: row.model, status: row.status, pinned: Boolean(row.pinned), position: { x: row.position_x, y: row.position_y }, createdAt: row.created_at, updatedAt: row.updated_at }; }
function messagesFor(threadId) { return db.prepare('SELECT id, thread_id, role, content, created_at FROM messages WHERE thread_id = ? ORDER BY created_at').all(threadId).map(row => ({ id: row.id, threadId: row.thread_id, role: row.role, content: row.content, createdAt: row.created_at })); }
function serializeThread(row) { const thread = rowThread(row); const messages = messagesFor(thread.id); return { ...thread, messages, messageCount: messages.length }; }
function workspacePayload(workspaceId) {
  const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
  if (!row) return null;
  return {
    workspace: { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at },
    threads: db.prepare('SELECT * FROM threads WHERE workspace_id = ? ORDER BY created_at').all(workspaceId).map(serializeThread),
    links: db.prepare('SELECT id, workspace_id, source_thread_id, target_thread_id, label, type FROM links WHERE workspace_id = ?').all(workspaceId).map(link => ({ id: link.id, workspaceId: link.workspace_id, sourceThreadId: link.source_thread_id, targetThreadId: link.target_thread_id, label: link.label, type: link.type }))
  };
}
function safeTitle(value) { return String(value || '未命名线索').trim().slice(0, 80) || '未命名线索'; }
function safeWorkspaceTitle(value) { return String(value || '未命名画布').trim().slice(0, 80) || '未命名画布'; }
function topicFor(index) { return ['#0d9488', '#d97706', '#0369a1', '#be123c', '#6d28d9', '#059669', '#c2410c'][index % 7]; }
function buildConversation(threadRow) {
  const trail = []; let cursor = threadRow;
  while (cursor?.parent_thread_id) {
    const parent = getThread(cursor.parent_thread_id); if (!parent) break;
    const parentMessages = messagesFor(parent.id);
    const cutoff = cursor.parent_message_id ? parentMessages.findIndex(message => message.id === cursor.parent_message_id) : parentMessages.length - 1;
    trail.unshift(...parentMessages.slice(0, cutoff + 1)); cursor = parent;
  }
  return [...trail, ...messagesFor(threadRow.id)].map(message => ({ role: message.role, content: message.content }));
}
function demoAnswer(thread, prompt) { const prior = buildConversation(thread).filter(message => message.role === 'user').length; return `沿着「${thread.title}」继续：${prompt}\n\n可以先把问题拆成两个层次：**定义或前提**，以及它在具体例子中的表现。这里已经带入了此分支的 ${prior} 条上下文消息；其他线索不会影响这个回答。\n\n下一步可从一个反例或边界情况检验这个结论。`; }
async function streamOpenAICompatible(thread, onDelta) {
  const settings = settingRow();
  if (!settings.api_key) throw new Error('模型服务尚未设置 API Key');
  if (!settings.model) throw new Error('模型服务尚未选择模型');
  const response = await fetch(`${settings.base_url.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${settings.api_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: settings.model, stream: true, messages: [{ role: 'system', content: settings.system_prompt || DEFAULT_SYSTEM_PROMPT }, ...buildConversation(thread)] }) });
  if (!response.ok || !response.body) throw new Error(`Model request failed: ${response.status} ${await response.text()}`);
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let answer = '';
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop();
    for (const line of lines) { if (!line.startsWith('data: ')) continue; const payload = line.slice(6).trim(); if (payload === '[DONE]') continue; try { const delta = JSON.parse(payload).choices?.[0]?.delta?.content; if (delta) { answer += delta; onDelta(delta); } } catch { /* provider keepalive */ } }
  }
  return answer || '模型没有返回可显示的内容。';
}
async function streamReply(thread, prompt, onDelta) { const settings = settingRow(); if (settings.provider === 'demo') { const answer = demoAnswer(rowThread(thread), prompt); for (const part of answer.match(/.{1,12}/gu) || []) { onDelta(part); await new Promise(resolve => setTimeout(resolve, 14)); } return answer; } return streamOpenAICompatible(thread, onDelta); }

async function createApp() {
  await openDatabase();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((_, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_, response) => response.json({ ok: true, provider: publicSettings().provider, model: configuredModelName(), hasApiKey: publicSettings().hasApiKey }));
  app.get('/api/settings', (_, response) => response.json(publicSettings()));
  app.put('/api/settings', (request, response, next) => { try { const nextSettings = applySettings(request.body); saveSettings(nextSettings); response.json(publicSettings()); } catch (error) { next(error); } });
  app.post('/api/settings/test', async (request, response, next) => { try { const candidate = applySettings(request.body); if (candidate.provider === 'demo') return response.json({ ok: true, message: '演示提供方已就绪' }); if (!candidate.apiKey) return response.status(400).json({ error: '输入 API Key 后才能测试连接' }); const upstream = await fetch(`${candidate.baseUrl}/models`, { headers: { Authorization: `Bearer ${candidate.apiKey}` } }); if (!upstream.ok) return response.status(400).json({ error: `模型服务返回 HTTP ${upstream.status}` }); return response.json({ ok: true, message: '模型服务连接成功' }); } catch (error) { next(error); } });
  app.get('/api/workspaces', (_, response) => response.json(db.prepare('SELECT id, title, created_at, updated_at FROM workspaces ORDER BY updated_at DESC').all().map(row => ({ id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at }))));
  app.post('/api/workspaces', (request, response) => { const id=randomUUID(); const createdAt=now(); const workspace={ id, title:safeWorkspaceTitle(request.body.title), createdAt, updatedAt:createdAt }; db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?)').run(workspace.id, workspace.title, workspace.createdAt, workspace.updatedAt); response.status(201).json(workspace); });
  app.get('/api/workspaces/:id', (request, response) => { const payload = workspacePayload(request.params.id); if (!payload) return response.status(404).json({ error: 'Workspace not found' }); response.json(payload); });
  app.post('/api/threads', (request, response) => { const workspaceId=String(request.body.workspaceId || 'default'); if(!db.prepare('SELECT 1 FROM workspaces WHERE id = ?').get(workspaceId)) return response.status(404).json({ error: 'Workspace not found' }); const createdAt = now(); const id = randomUUID(); const count = db.prepare('SELECT COUNT(*) AS count FROM threads WHERE workspace_id = ?').get(workspaceId).count; const position = request.body.position || { x: 160, y: 160 }; db.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, workspaceId, null, null, safeTitle(request.body.title), request.body.topic || topicFor(count), configuredModelName(), 'active', 0, position.x, position.y, createdAt, createdAt); db.prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(createdAt, workspaceId); response.status(201).json(serializeThread(getThread(id))); });
  app.post('/api/threads/:id/branches', (request, response) => { const parent = getThread(request.params.id); if (!parent) return response.status(404).json({ error: 'Thread not found' }); const parentMessages = messagesFor(parent.id); const parentMessage = parentMessages.find(message => message.id === request.body.parentMessageId) || parentMessages.at(-1); const id = randomUUID(); const createdAt = now(); const count = db.prepare('SELECT COUNT(*) AS count FROM threads').get().count; const position = request.body.position || { x: parent.position_x + 440, y: parent.position_y + 160 }; db.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, parent.workspace_id, parent.id, parentMessage?.id || null, safeTitle(request.body.title), request.body.topic || topicFor(count), configuredModelName(), 'active', 0, position.x, position.y, createdAt, createdAt); response.status(201).json(serializeThread(getThread(id))); });
  app.patch('/api/threads/:id', (request, response) => { const thread = getThread(request.params.id); if (!thread) return response.status(404).json({ error: 'Thread not found' }); const title = typeof request.body.title === 'string' ? safeTitle(request.body.title) : thread.title; const pinned = typeof request.body.pinned === 'boolean' ? Number(request.body.pinned) : thread.pinned; const position = request.body.position && Number.isFinite(request.body.position.x) && Number.isFinite(request.body.position.y) ? request.body.position : { x: thread.position_x, y: thread.position_y }; db.prepare('UPDATE threads SET title = ?, pinned = ?, position_x = ?, position_y = ?, updated_at = ? WHERE id = ?').run(title, pinned, position.x, position.y, now(), thread.id); response.json(serializeThread(getThread(thread.id))); });
  app.delete('/api/threads', (request, response) => {
    const rootIds = [...new Set(Array.isArray(request.body?.ids) ? request.body.ids.filter(id => typeof id === 'string') : [])];
    if (!rootIds.length) return response.status(400).json({ error: '请选择至少一条线索' });
    const roots = rootIds.map(getThread);
    if (roots.some(root => !root)) return response.status(404).json({ error: 'Thread not found' });
    const workspaceId = roots[0].workspace_id;
    if (roots.some(root => root.workspace_id !== workspaceId)) return response.status(400).json({ error: '只能删除同一工作台中的线索' });
    const ids = new Set();
    const collect = id => { if (ids.has(id)) return; ids.add(id); for (const child of db.prepare('SELECT id FROM threads WHERE parent_thread_id = ?').all(id)) collect(child.id); };
    rootIds.forEach(collect);
    const deletedIds = [...ids];
    const placeholders = deletedIds.map(() => '?').join(',');
    db.transaction(() => {
      db.prepare(`DELETE FROM links WHERE source_thread_id IN (${placeholders}) OR target_thread_id IN (${placeholders})`).run(...deletedIds, ...deletedIds);
      db.prepare(`DELETE FROM messages WHERE thread_id IN (${placeholders})`).run(...deletedIds);
      db.prepare(`DELETE FROM threads WHERE id IN (${placeholders})`).run(...deletedIds);
      db.prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(now(), workspaceId);
    })();
    response.json({ deletedIds });
  });
  app.delete('/api/threads/:id', (request, response) => {
    const root = getThread(request.params.id);
    if (!root) return response.status(404).json({ error: 'Thread not found' });
    const ids = [];
    const collect = id => { ids.push(id); for (const child of db.prepare('SELECT id FROM threads WHERE parent_thread_id = ?').all(id)) collect(child.id); };
    collect(root.id);
    const placeholders = ids.map(() => '?').join(',');
    db.transaction(() => {
      db.prepare(`DELETE FROM links WHERE source_thread_id IN (${placeholders}) OR target_thread_id IN (${placeholders})`).run(...ids, ...ids);
      db.prepare(`DELETE FROM messages WHERE thread_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM threads WHERE id IN (${placeholders})`).run(...ids);
      db.prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(now(), root.workspace_id);
    })();
    response.json({ deletedIds: ids });
  });
  app.post('/api/threads/:id/messages', async (request, response) => { const thread = getThread(request.params.id); if (!thread) return response.status(404).json({ error: 'Thread not found' }); const prompt = String(request.body.content || '').trim(); if (!prompt) return response.status(400).json({ error: 'Message content is required' }); const userMessage = makeMessage(thread.id, 'user', prompt); db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?)').run(userMessage.id, userMessage.threadId, userMessage.role, userMessage.content, userMessage.createdAt); db.prepare('UPDATE threads SET updated_at = ? WHERE id = ?').run(now(), thread.id); response.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' }); response.flushHeaders(); const send = payload => response.write(`data: ${JSON.stringify(payload)}\n\n`); send({ type: 'message', message: userMessage }); send({ type: 'start' }); try { const answer = await streamReply(getThread(thread.id), prompt, delta => send({ type: 'delta', delta })); const assistantMessage = makeMessage(thread.id, 'assistant', answer); db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?)').run(assistantMessage.id, assistantMessage.threadId, assistantMessage.role, assistantMessage.content, assistantMessage.createdAt); db.prepare('UPDATE threads SET updated_at = ? WHERE id = ?').run(now(), thread.id); send({ type: 'done', message: assistantMessage }); } catch (error) { send({ type: 'error', error: error.message || 'Unable to create a response' }); } response.end(); });
  app.use(express.static(path.join(ROOT, 'dist'), { index: 'index.html', etag: false }));
  app.use((error, _, response, __) => { console.error(error); response.status(400).json({ error: error.message || 'Request failed' }); });
  return app;
}

if (require.main === module) {
  createApp().then(app => app.listen(API_PORT, '127.0.0.1', () => console.log(`Synapse API is running at http://127.0.0.1:${API_PORT}`))).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { createApp, buildConversation, createSeed, openDatabase };
