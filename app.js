import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.use({ breaks: true, gfm: true });

const state = {
  mode: 'canvas', workspaceId: 'default', workspaceTitle: '算法复习工作台', activeId: 'quick', selected: new Set(), links: [], scale: 1, pan: { x: 0, y: 0 }, backendAvailable: false, branchTargetId: null, branchMessageId: null, quickBranchTargetId: null, quickReplyTargetId: null, branchType: null, deleteTargetIds: [],
  threads: [
    { id:'quick', title:'快速排序', topic:'#0d9488', model:'GPT-4o', count:6, updated:'刚刚', parent:null, x:100, y:205, pinned:true, preview:'理解分区过程，以及它为什么在平均情况下很快。', messages:[
      { role:'user', text:'解释快速排序的核心思想，并用一个数组例子说明。' },
      { role:'assistant', text:'快速排序通过 **分治** 工作：选择一个基准值，将小于它的元素移到左侧，大于它的移到右侧，再递归处理两个子数组。\n\n例如对 `[6, 3, 8, 2, 5]` 选择 5 为基准，分区后得到 `[3, 2] 5 [6, 8]`。此时 5 已在最终位置。' },
      { role:'user', text:'为什么它的平均时间复杂度是 O(n log n)？' },
      { role:'assistant', text:'每一层分区要遍历约 `n` 个元素；如果基准通常能把数组分成接近两半，递归树高度约为 `log n`，因此总工作量是 `O(n log n)`。' }
    ]},
    { id:'merge', title:'归并排序', topic:'#d97706', model:'GPT-4o', count:5, updated:'4 分钟前', parent:'quick', x:480, y:100, preview:'将数组持续二分，再把有序子数组线性合并。', messages:[
      { role:'user', text:'解释归并排序，并和快速排序做个对比。' },
      { role:'assistant', text:'归并排序先不断二分，直到每组只有一个元素，然后按大小合并。它在任何输入下都稳定地保持 `O(n log n)`，代价是需要 `O(n)` 的额外空间。' },
      { role:'user', text:'什么叫稳定排序？' },
      { role:'assistant', text:'若两个元素的键相同，排序后仍保持原来的相对顺序，就称算法稳定。归并时先取左侧元素，即可保证这一点。' }
    ]},
    { id:'divide', title:'分治思想', topic:'#0369a1', model:'GPT-4o', count:4, updated:'8 分钟前', parent:'quick', x:480, y:305, preview:'把复杂问题拆为同构的小问题，组合子问题答案。', messages:[
      { role:'user', text:'分治算法有什么共同特征？' },
      { role:'assistant', text:'典型结构是：**分解**问题、**递归**解决子问题、再**合并**结果。合并成本和子问题规模决定最终复杂度。' },
      { role:'assistant', text:'二分查找、归并排序和快速排序都是常见例子，但快速排序的合并发生在分区阶段。' }
    ]},
    { id:'heap', title:'堆排序', topic:'#be123c', model:'GPT-4o', count:3, updated:'12 分钟前', parent:null, x:100, y:440, pinned:true, preview:'借助二叉堆维护最大或最小元素，空间开销较低。', messages:[
      { role:'user', text:'堆排序适合什么场景？' },
      { role:'assistant', text:'需要保证 `O(n log n)` 最坏复杂度且内存较紧时，堆排序很实用；但它不稳定，也通常不如快速排序有较好的常数表现。' }
    ]}
  ]
};

const BRANCH_TYPES = ['深入解释', '反例', '应用场景', '代码实现', '换个角度', '质疑结论'];

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const getThread = id => state.threads.find(t => t.id === id);
const renderMarkdown = value => `<div class="markdown-body">${DOMPurify.sanitize(marked.parse(String(value || '')))}</div>`;
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
const activeBranchType = () => BRANCH_TYPES.includes(state.branchType) ? state.branchType : null;

function initIcons() { if (window.lucide) lucide.createIcons({attrs:{'stroke-width':1.6}}); }
function branchTypeControls() {
  const current=activeBranchType();
  return `<div class="branch-type-row" role="group" aria-label="分支类型">${BRANCH_TYPES.map(type=>`<button type="button" class="branch-type ${type===current ? 'active' : ''}" data-action="set-branch-type" data-branch-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`).join('')}</div>`;
}
function threadPath(thread) {
  const path=[]; let cursor=thread; const seen=new Set();
  while (cursor && !seen.has(cursor.id)) { path.unshift(cursor); seen.add(cursor.id); cursor=cursor.parent ? getThread(cursor.parent) : null; }
  return path;
}
function renderCardPath(thread) {
  if (isSynthesisThread(thread)) return `<div class="card-path"><span>${thread.messages.length ? '合流' : '合流草稿'}</span></div>`;
  const path=threadPath(thread);
  if (path.length < 2) return `<div class="card-path"><span>主线索</span></div>`;
  return `<div class="card-path">${path.map((item,index)=>`<span>${escapeHtml(item.title)}</span>${index<path.length-1 ? '<i data-lucide="chevron-right"></i>' : ''}`).join('')}</div>`;
}
function isSynthesisThread(thread) {
  return Boolean(thread && (thread.title.startsWith('综合：') || state.links.some(link=>link.target===thread.id && link.type==='synthesis')));
}
function renderSynthesisComposer(thread) {
  return `<form class="synthesis-compose" data-quick-reply="${thread.id}"><textarea rows="3" placeholder="输入你想怎样综合这两条线索..." aria-label="综合 ${escapeHtml(thread.title)}"></textarea><div class="synthesis-compose-actions"><button type="submit" aria-label="生成综合" title="生成综合"><i data-lucide="arrow-up"></i></button></div></form>`;
}
function branchPrompt(type, prompt) {
  const value=String(prompt || '').trim();
  return type ? `【${type}】${value}` : value;
}
function titleFromPrompt(value) {
  const normalized=String(value || '').replace(/^【(.+?)】/, '$1：').trim();
  return normalized.length>18 ? normalized.slice(0,18)+'…' : normalized;
}
function formatMessage(message, compact=false, threadId=state.activeId) {
  const label = message.role === 'user' ? '你' : 'Synapse';
  if (compact) return `<div class="compact-message ${message.role}"><strong>${label}</strong>${message.streaming ? '<span class="typing">正在思考</span>' : renderMarkdown(message.text)}</div>`;
  return `<article class="message ${message.role}" data-message="${message.id || ''}"><div class="message-label"><span class="mini-dot" style="background:${message.role === 'user' ? '#0d9488' : '#a8a29e'}"></span>${label}</div><div class="message-content">${message.streaming ? '<span class="typing">正在思考</span>' : renderMarkdown(message.text)}</div>${message.role === 'assistant' && !message.streaming ? `<div class="message-actions"><button data-action="branch" data-thread="${threadId}" data-message="${message.id || ''}"><i data-lucide="git-branch"></i>创建分支</button><button data-action="copy" data-thread="${threadId}" data-message="${message.id || ''}"><i data-lucide="copy"></i>复制</button></div>` : ''}</article>`;
}

function toClientThread(thread) {
  const messages = (thread.messages || []).map(message => ({ id: message.id, role: message.role, text: message.content, createdAt: message.createdAt }));
  const last = messages.at(-1);
  return { id:thread.id, title:thread.title, topic:thread.topic, model:thread.model, count:thread.messageCount ?? messages.length, updated:'刚刚', parent:thread.parentThreadId, parentMessageId:thread.parentMessageId, x:thread.position?.x ?? 100, y:thread.position?.y ?? 100, pinned:Boolean(thread.pinned), preview:last?.text || '开始这个学习线索', messages };
}
function toClientLink(link) {
  return { id:link.id, source:link.sourceThreadId, target:link.targetThreadId, label:link.label || '', type:link.type || 'semantic' };
}
function inferredSynthesisLinks(threads, existingLinks=[]) {
  const existingKeys=new Set(existingLinks.map(link=>`${link.source}->${link.target}`));
  const byTitle=new Map();
  threads.forEach(thread => {
    if (!byTitle.has(thread.title)) byTitle.set(thread.title, []);
    byTitle.get(thread.title).push(thread);
  });
  return threads.flatMap(target => {
    const prompt=target.messages.find(message=>message.role==='user')?.text || '';
    if (!target.title.startsWith('综合：') || !prompt.includes('## 来源')) return [];
    const sourceTitles=[...prompt.matchAll(/^## 来源 \d+：(.+)$/gm)].map(match=>match[1].trim()).filter(Boolean);
    return sourceTitles.flatMap(title => (byTitle.get(title) || []).filter(source=>source.id!==target.id).map(source=>({ source, title }))).filter(({source})=>!existingKeys.has(`${source.id}->${target.id}`)).map(({source},index)=>({ id:`inferred-synthesis-${source.id}-${target.id}-${index}`, source:source.id, target:target.id, label:'综合', type:'synthesis' }));
  });
}
async function api(path, options={}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Request failed (${response.status})`);
  return response;
}
async function bootstrap(workspaceId=state.workspaceId) {
  try {
    const response = await api(`/api/workspaces/${workspaceId}`);
    const payload = await response.json();
    state.workspaceId=payload.workspace.id;
    state.workspaceTitle=payload.workspace.title;
    state.threads = payload.threads.map(toClientThread);
    state.links = (payload.links || []).map(toClientLink);
    state.links.push(...inferredSynthesisLinks(state.threads, state.links));
    state.activeId=state.threads[0]?.id || null;
    state.backendAvailable = true;
    const heap = state.threads.find(thread => thread.id === 'heap');
    if (heap && heap.y >= 500) { const seedLayout={quick:[100,205],merge:[480,100],divide:[480,305],heap:[100,440]}; state.threads.forEach(thread=>{const point=seedLayout[thread.id];if(point){thread.x=point[0];thread.y=point[1];void persistThread(thread);}}); }
    state.selected.clear();
    await renderWorkspacePicker();
    renderAll();
    try { await (await api('/api/settings')).json(); } catch { /* The workspace remains usable when settings are unavailable. */ }
    toast('已连接本地学习工作台');
  } catch {
    state.backendAvailable = false;
  }
}
async function persistThread(thread) {
  if (!state.backendAvailable) return;
  try { await api(`/api/threads/${thread.id}`, { method:'PATCH', body:JSON.stringify({ title:thread.title, pinned:thread.pinned, position:{x:thread.x,y:thread.y} }) }); } catch { toast('本地保存失败，稍后会重试'); }
}
function renderTree() {
  const list = $('#thread-list');
  if (!list) return;
  list.innerHTML = state.threads.map(thread => `<div class="tree-item ${state.activeId === thread.id ? 'selected' : ''}" style="${thread.parent ? 'padding-left:12px' : ''}"><button class="tree-select" data-select="${thread.id}" aria-label="${state.selected.has(thread.id) ? '取消选择' : '选择'} ${thread.title}" title="${state.selected.has(thread.id) ? '取消选择' : '选择'}"><i data-lucide="${state.selected.has(thread.id) ? 'check-circle-2' : 'circle'}"></i></button><button class="tree-main" data-action="activate" data-thread="${thread.id}"><span class="tree-dot" style="background:${thread.topic}"></span><span class="tree-title">${thread.title}</span>${thread.parent ? '<i data-lucide="git-branch"></i>' : ''}</button></div>`).join('');
  const count = $('#thread-count');
  if (count) count.textContent = state.threads.length;
}
async function renderWorkspacePicker() {
  if (!state.backendAvailable) return;
  try {
    const response=await api('/api/workspaces');
    const workspaces=await response.json();
    $('#workspace-selector').innerHTML=workspaces.map(workspace=>`<option value="${workspace.id}">${workspace.title}</option>`).join('');
    $('#workspace-selector').value=state.workspaceId;
  } catch { /* Workspace switching remains optional when the list is unavailable. */ }
}
function renderCards() {
  const layer = $('#cards-layer');
  const scrollPositions = new Map($$('.thread-card', layer).map(card => [card.dataset.card, $('.card-conversation', card)?.scrollTop || 0]));
  layer.innerHTML = state.threads.map(thread => {
    const title=escapeHtml(thread.title);
    const synthesisDraft=isSynthesisThread(thread) && thread.messages.length === 0;
    const quickBranch = state.quickBranchTargetId === thread.id ? `<form class="quick-branch" data-quick-branch="${thread.id}">${branchTypeControls()}<textarea rows="2" placeholder="新的问题..." aria-label="从「${title}」创建分支"></textarea><div><button type="button" data-action="close-quick-branch" aria-label="取消" title="取消"><i data-lucide="x"></i></button><button type="submit" aria-label="创建分支" title="创建分支"><i data-lucide="arrow-up"></i></button></div></form>` : '';
    const quickReply = !synthesisDraft && state.quickReplyTargetId === thread.id ? `<form class="quick-reply" data-quick-reply="${thread.id}"><textarea rows="2" placeholder="继续追问当前线索..." aria-label="继续追问「${title}」"></textarea><button type="button" data-action="close-quick-reply" aria-label="取消" title="取消"><i data-lucide="x"></i></button><button type="submit" aria-label="发送" title="发送"><i data-lucide="arrow-up"></i></button></form>` : '';
    const body=synthesisDraft ? renderSynthesisComposer(thread) : `<div class="card-conversation">${thread.messages.slice(-3).map(message => formatMessage(message,true)).join('')}</div>${quickReply}<div class="thread-card-actions"><button class="card-action" data-action="open-thread" data-thread="${thread.id}"><i data-lucide="maximize-2"></i>打开</button><button class="card-action danger-action" data-action="request-delete" data-thread="${thread.id}"><i data-lucide="trash-2"></i>删除</button></div>`;
    return `<article class="thread-card ${synthesisDraft ? 'synthesis-draft' : ''} ${state.activeId === thread.id ? 'active' : ''} ${state.selected.has(thread.id) ? 'selected' : ''}" data-card="${thread.id}" style="left:${thread.x}px;top:${thread.y}px"><button class="branch-node" data-action="quick-branch" data-thread="${thread.id}" aria-label="从「${title}」创建分支" title="创建分支"><i data-lucide="plus"></i></button>${quickBranch}${renderCardPath(thread)}<div class="card-top"><span class="topic-dot" style="background:${thread.topic}"></span><span class="card-title">${title}</span><button class="card-select" data-select="${thread.id}" aria-label="${state.selected.has(thread.id) ? '取消选择' : '选择'} ${title}" title="${state.selected.has(thread.id) ? '取消选择' : '选择'}"><i data-lucide="${state.selected.has(thread.id) ? 'check' : 'circle'}"></i></button></div>${body}</article>`;
  }).join('');
  $$('.thread-card', layer).forEach(card => {
    const conversation = $('.card-conversation', card);
    if (conversation && scrollPositions.has(card.dataset.card)) conversation.scrollTop = scrollPositions.get(card.dataset.card);
  });
  renderConnectors();
  const quickInput=$('.quick-branch textarea, .quick-reply textarea, .synthesis-compose textarea');
  if (quickInput) setTimeout(()=>quickInput.focus(),0);
}
function renderedCardBounds(thread) {
  const card=$(`[data-card="${thread.id}"]`);
  return { x:thread.x, y:thread.y, width:card?.offsetWidth || 400, height:card?.offsetHeight || 340 };
}
function smoothConnectorPath(fromThread, toThread) {
  const from=renderedCardBounds(fromThread);
  const to=renderedCardBounds(toThread);
  const fromMidY=from.y+from.height/2;
  const toMidY=to.y+to.height/2;
  const start={ x:from.x+from.width, y:fromMidY };
  const end={ x:to.x, y:toMidY };
  const gap=end.x-start.x;
  // A branch keeps its parent-to-child direction even when cards are rearranged.
  const handle=gap>=0 ? Math.min(150,gap*.5) : Math.min(110,Math.max(26,Math.abs(gap)*.3));
  const first={ x:start.x+handle, y:start.y };
  const second={ x:end.x-handle, y:end.y };
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${first.x.toFixed(1)} ${first.y.toFixed(1)}, ${second.x.toFixed(1)} ${second.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}
function pointConnectorPath(start, end) {
  const gap=end.x-start.x;
  const handle=Math.max(46, Math.min(180, Math.abs(gap)*.5));
  const direction=gap >= 0 ? 1 : -1;
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${(start.x+handle*direction).toFixed(1)} ${start.y.toFixed(1)}, ${(end.x-handle*direction).toFixed(1)} ${end.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}
function branchAnchor(thread) {
  const bounds=renderedCardBounds(thread);
  return { x:bounds.x+bounds.width, y:bounds.y+bounds.height/2 };
}
function renderConnectors() {
  const svg = $('#connectors');
  const parentLinks = state.threads.filter(t => t.parent).map(thread => {
    const parent = getThread(thread.parent); if (!parent) return '';
    return `<path class="connector ${thread.id === state.activeId ? 'active' : ''}" data-connector-thread="${thread.id}" d="${smoothConnectorPath(parent,thread)}" />`;
  }).join('');
  const semanticLinks = state.links.map(link => {
    const source=getThread(link.source), target=getThread(link.target);
    if (!source || !target) return '';
    const active=link.source===state.activeId || link.target===state.activeId ? 'active' : '';
    return `<path class="connector-link ${link.type === 'synthesis' ? 'synthesis-link' : ''} ${active}" data-link="${link.id}" data-link-source="${link.source}" data-link-target="${link.target}" d="${smoothConnectorPath(source,target)}" />`;
  }).join('');
  svg.innerHTML = parentLinks + semanticLinks;
}
function refreshConnector(thread) {
  if (!thread?.parent) return;
  const parent=getThread(thread.parent);
  const path=$(`[data-connector-thread="${thread.id}"]`);
  if (parent && path) path.setAttribute('d',smoothConnectorPath(parent,thread));
}
function refreshConnectorsForThread(threadId) {
  const thread=getThread(threadId);
  refreshConnector(thread);
  state.threads.filter(item=>item.parent===threadId).forEach(refreshConnector);
  $$(`[data-link-source="${threadId}"], [data-link-target="${threadId}"]`).forEach(path => {
    const source=getThread(path.dataset.linkSource), target=getThread(path.dataset.linkTarget);
    if (source && target) path.setAttribute('d', smoothConnectorPath(source,target));
  });
}
function renderDetail() {
  const thread = getThread(state.activeId) || state.threads[0];
  if (!thread) { $('#thread-detail').innerHTML = `<div class="detail-shell empty-workspace"><h1>${state.workspaceTitle}</h1><p>画布已创建。添加第一条线索开始探索。</p><button class="button primary" data-action="new-thread"><i data-lucide="plus"></i>新建线索</button></div>`; return; }
  $('#thread-detail').innerHTML = `<div class="detail-shell"><button class="detail-back" data-action="show-canvas"><i data-lucide="arrow-left"></i>返回学习画布</button><p class="eyebrow">${thread.parent ? '从「'+getThread(thread.parent)?.title+'」分叉' : '主线索'}</p><div class="detail-title-row"><h1>${thread.title}</h1><div class="detail-title-actions"><button class="button secondary" data-action="branch" data-thread="${thread.id}"><i data-lucide="git-branch"></i>创建分支</button><button class="icon-button detail-delete" data-action="request-delete" data-thread="${thread.id}" aria-label="删除线索" title="删除线索"><i data-lucide="trash-2"></i></button></div></div><div class="detail-meta"><i data-lucide="bot"></i>${thread.model}<span>·</span><span>${thread.count} 条消息</span><span>·</span><span>上下文独立保存</span></div><div class="messages">${thread.messages.map(message => formatMessage(message, false, thread.id)).join('')}</div><form class="detail-input" data-compose="${thread.id}"><textarea rows="2" placeholder="继续探索这个线索..." aria-label="继续探索"></textarea><div class="input-row"><button class="send-button" aria-label="发送"><i data-lucide="arrow-up"></i></button></div></form></div>`;
}
function renderCompare() {
  const selected = [...state.selected].map(getThread).filter(Boolean).slice(0,2);
  $('#compare-empty').classList.toggle('show', selected.length < 2);
  $('#compare-columns').innerHTML = selected.length >= 2 ? selected.map(thread => `<section class="compare-column"><header class="compare-column-header"><span class="topic-dot" style="background:${thread.topic}"></span><strong>${thread.title}</strong><button class="icon-button small" data-action="open-thread" data-thread="${thread.id}" title="打开线索"><i data-lucide="maximize-2"></i></button></header><div class="column-meta"><i data-lucide="bot"></i><span>${thread.model}</span><span>·</span><span>${thread.count} 条消息</span></div><div class="compare-message-list" data-scroll-column="${thread.id}">${thread.messages.map(message => formatMessage(message, false, thread.id)).join('')}</div><form class="compare-input" data-compose="${thread.id}"><input placeholder="继续追问..." aria-label="继续追问 ${thread.title}"/><button aria-label="发送"><i data-lucide="arrow-up"></i></button></form></section>`).join('') : '';
}
function renderBulkActions() {
  const count=state.selected.size;
  $('#canvas-bulk-actions').innerHTML=count ? `${count>=2 ? `<button class="bulk-action" data-action="synthesize-selected" aria-label="生成综合卡片" title="生成综合卡片"><i data-lucide="git-merge"></i>综合<small>${Math.min(count,3)}</small></button>` : ''}<button class="bulk-action danger" data-action="request-bulk-delete" aria-label="删除已选线索" title="删除已选线索"><i data-lucide="trash-2"></i>删除<small>${count}</small></button>` : '';
  const sidebarActions=$('#sidebar-bulk-actions');
  if (sidebarActions) sidebarActions.innerHTML=count ? `${count>=2 ? `<button class="icon-button small" data-action="synthesize-selected" aria-label="生成综合卡片" title="生成综合卡片"><i data-lucide="git-merge"></i></button>` : ''}<button class="icon-button small detail-delete" data-action="request-bulk-delete" aria-label="删除已选线索" title="删除已选线索"><i data-lucide="trash-2"></i></button>` : '';
}
function renderAll() { renderTree(); renderCards(); renderDetail(); renderCompare(); renderBulkActions(); initIcons(); applyCanvasTransform(); }
function renderActiveState() {
  $$('.thread-card').forEach(card => card.classList.toggle('active', card.dataset.card === state.activeId));
  $$('#thread-list .tree-item').forEach(item => {
    const threadId=$('[data-thread]', item)?.dataset.thread;
    item.classList.toggle('selected', threadId === state.activeId);
  });
  $$('[data-connector-thread]').forEach(path => path.classList.toggle('active', path.dataset.connectorThread === state.activeId));
  $$('[data-link]').forEach(path => path.classList.toggle('active', path.dataset.linkSource === state.activeId || path.dataset.linkTarget === state.activeId));
  if (state.mode === 'thread') { renderDetail(); initIcons(); }
}
function applyCanvasTransform() {
  const viewport=$('#canvas-viewport');
  viewport.style.setProperty('--grid-size', `${24 * state.scale}px`);
  viewport.style.setProperty('--grid-x', `${state.pan.x}px`);
  viewport.style.setProperty('--grid-y', `${state.pan.y}px`);
  $('#canvas-grid').style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.scale})`;
  $('#zoom-label').textContent = `${Math.round(state.scale*100)}%`;
}
function zoomCanvas(nextScale, clientX, clientY) {
  const viewport=$('#canvas-viewport');
  const target=Math.max(.6,Math.min(1.5,nextScale));
  if (target===state.scale) return;
  const bounds=viewport.getBoundingClientRect();
  const localX=clientX ?? bounds.left+bounds.width/2;
  const localY=clientY ?? bounds.top+bounds.height/2;
  const canvasX=(localX-bounds.left-state.pan.x)/state.scale;
  const canvasY=(localY-bounds.top-state.pan.y)/state.scale;
  state.scale=target;
  state.pan.x=localX-bounds.left-canvasX*target;
  state.pan.y=localY-bounds.top-canvasY*target;
  applyCanvasTransform();
}
function setMode(mode) { state.mode = mode; $$('.view').forEach(v=>v.classList.remove('active')); $(`#${mode}-view`).classList.add('active'); $$('.mode-button').forEach(btn=>{const yes=btn.dataset.mode===mode;btn.classList.toggle('active',yes);btn.setAttribute('aria-selected',yes);}); if (mode==='compare') renderCompare(); if (mode==='thread') renderDetail(); }
function toast(message) { const element=$('#toast'); element.textContent=message;element.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.classList.remove('show'),2100); }
function updateFocus(id) { const thread=getThread(id); if (!thread) return; state.activeId=id; }
function cardFootprint(thread) { return { x:thread.x, y:thread.y, width:400, height:340 }; }
function isTextInputTarget(target) { return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]')); }
function openQuickBranch(threadId=state.activeId) {
  const thread=getThread(threadId) || state.threads[0];
  if (!thread) return;
  state.activeId=thread.id;
  state.quickBranchTargetId=thread.id;
  state.quickReplyTargetId=null;
  renderAll();
}
function closeQuickBranch() {
  state.quickBranchTargetId=null;
  renderAll();
}
function openQuickReply(threadId=state.activeId) {
  const thread=getThread(threadId) || state.threads[0];
  if (!thread) return;
  state.activeId=thread.id;
  state.quickReplyTargetId=thread.id;
  state.quickBranchTargetId=null;
  renderAll();
}
function closeQuickReply() {
  state.quickReplyTargetId=null;
  renderAll();
}
function setBranchType(type) {
  if (!BRANCH_TYPES.includes(type)) return;
  state.branchType=state.branchType === type ? null : type;
  $$('.branch-type').forEach(button => button.classList.toggle('active', button.dataset.branchType === state.branchType));
}
function directionalThread(direction) {
  const current=getThread(state.activeId) || state.threads[0];
  if (!current) return null;
  const currentBounds=renderedCardBounds(current);
  const origin={x:currentBounds.x+currentBounds.width/2,y:currentBounds.y+currentBounds.height/2};
  const candidates=state.threads.filter(thread=>thread.id!==current.id).map(thread=>{
    const bounds=renderedCardBounds(thread);
    const center={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
    const dx=center.x-origin.x, dy=center.y-origin.y;
    const primary=direction==='left' ? -dx : direction==='right' ? dx : direction==='up' ? -dy : dy;
    const cross=direction==='left' || direction==='right' ? Math.abs(dy) : Math.abs(dx);
    return {thread,primary,cross,score:primary+cross*1.35};
  }).filter(item=>item.primary>12);
  return candidates.sort((a,b)=>a.score-b.score || a.cross-b.cross)[0]?.thread || null;
}
function overlaps(a,b,padding=26) { return a.x < b.x+b.width+padding && a.x+a.width+padding > b.x && a.y < b.y+b.height+padding && a.y+a.height+padding > b.y; }
function findOpenPosition(preferred) {
  const footprint={x:preferred.x,y:preferred.y,width:400,height:340};
  const occupied=state.threads.map(cardFootprint);
  const isFree=point=>{footprint.x=point.x;footprint.y=point.y;return occupied.every(item=>!overlaps(footprint,item));};
  if(isFree(preferred)) return preferred;
  for(let ring=1;ring<20;ring+=1){
    for(let row=-ring;row<=ring;row+=1){
      for(let column=-ring;column<=ring;column+=1){
        if(Math.abs(row)!==ring && Math.abs(column)!==ring) continue;
        const point={x:Math.max(70,preferred.x+column*365),y:Math.max(70,preferred.y+row*230)};
        if(isFree(point)) return point;
      }
    }
  }
  return {x:preferred.x+365,y:preferred.y+230};
}
async function createThread(prompt, parent=null, sendInitial=false, parentMessageId=null, placement='branch', options={}) {
  const question=String(prompt || '').trim();
  if (!question) return null;
  const n=state.threads.length+1; const parentThread=parent ? getThread(parent) : null; const title=options.title || titleFromPrompt(question);
  const preferred=parentThread ? {x:parentThread.x+455,y:parentThread.y+(placement==='continuation'?0:205)} : {x:100+(n%3)*365,y:90+Math.floor(n/3)*230};
  const position=options.position || findOpenPosition(preferred);
  if (state.backendAvailable) {
    try {
      const endpoint = parent ? `/api/threads/${parent}/branches` : '/api/threads';
      const body = parent ? { title, position, topic:options.topic, parentMessageId:parentMessageId || parentThread.messages.at(-1)?.id } : { title, position, topic:options.topic, workspaceId:state.workspaceId };
      const response = await api(endpoint, { method:'POST', body:JSON.stringify(body) });
      const thread = toClientThread(await response.json()); state.threads.push(thread); updateFocus(thread.id); state.selected.clear(); state.selected.add(thread.id); renderAll(); toast(parent ? '已从当前线索创建分支' : '已创建新的学习线索');
      if (sendInitial) void sendMessageToThread(thread.id, question);
      return thread;
    } catch (error) { toast(error.message || '创建线索失败'); return null; }
  }
  const id=`thread-${Date.now()}`; const thread={id,title,topic:options.topic || ['#6d28d9','#059669','#c2410c','#a21caf'][n%4],model:'Synapse Demo',count:0,updated:'刚刚',parent,x:position.x,y:position.y,preview:question,messages:[]}; state.threads.push(thread); updateFocus(id);state.selected.clear();state.selected.add(id);renderAll();if(sendInitial) void sendMessageToThread(id,question);return thread;
}
function branch(threadId, messageId=null) {
  const thread=getThread(threadId); if (!thread) return;
  $('#branch-drawer').classList.remove('new-thread-mode');
  $('#branch-drawer').setAttribute('aria-label','创建分支');
  $('#branch-drawer-eyebrow').textContent='创建分支';
  $('#branch-prompt-label').textContent='新的问题';
  $('#branch-prompt').placeholder='例如：为什么归并排序是稳定的？';
  $('#create-branch').innerHTML='<i data-lucide="git-branch"></i>创建分支';
  $('#branch-type-controls').innerHTML=branchTypeControls();
  state.branchTargetId=threadId;
  state.branchMessageId=messageId;
  $('#branch-dialog-title').textContent=`从「${thread.title}」延伸`;
  $('#branch-prompt').value='';
  const messages=thread.messages;
  const messageIndex=messageId ? messages.findIndex(message=>message.id===messageId) : messages.length-1;
  const context=messages.slice(Math.max(0,messageIndex-1),messageIndex+1);
  $('#branch-context').innerHTML=`<p class="branch-source-title">${escapeHtml(thread.title)}</p>${context.map(message=>`<div class="branch-context-message ${message.role}"><span>${message.role==='user'?'问题':'回答'}</span>${renderMarkdown(message.text)}</div>`).join('') || '<p class="branch-context-empty">从此线索继续探索。</p>'}`;
  $('#branch-drawer').classList.add('open');
  $('#branch-drawer').setAttribute('aria-hidden','false');
  initIcons();
  setTimeout(()=>$('#branch-prompt').focus(),50);
}
function openNewThread() {
  state.branchTargetId=null;
  state.branchMessageId=null;
  $('#branch-drawer').classList.add('new-thread-mode','open');
  $('#branch-drawer').setAttribute('aria-hidden','false');
  $('#branch-drawer').setAttribute('aria-label','新建线索');
  $('#branch-drawer-eyebrow').textContent='新建线索';
  $('#branch-dialog-title').textContent='从一个问题开始';
  $('#branch-prompt-label').textContent='你想探索什么？';
  $('#branch-prompt').value='';
  $('#branch-prompt').placeholder='例如：为什么归并排序是稳定的？';
  $('#branch-type-controls').innerHTML='';
  $('#create-branch').innerHTML='<i data-lucide="arrow-up"></i>开始探索';
  initIcons();
  setTimeout(()=>$('#branch-prompt').focus(),50);
}
function closeBranchDialog() {
  state.branchTargetId=null;
  state.branchMessageId=null;
  $('#branch-type-controls').innerHTML='';
  $('#branch-drawer').classList.remove('open');
  $('#branch-drawer').classList.remove('new-thread-mode');
  $('#branch-drawer').setAttribute('aria-hidden','true');
}
function descendantIds(threadId) {
  const result=[];
  const visit=id => state.threads.filter(thread=>thread.parent===id).forEach(child=>{result.push(child.id);visit(child.id);});
  visit(threadId);
  return result;
}
function requestDelete(threadId) {
  const thread=getThread(threadId); if (!thread) return;
  requestDeleteIds([threadId], `删除「${thread.title}」？`);
}
function deletionIdsFor(threadIds) {
  return [...new Set(threadIds.flatMap(id=>[id,...descendantIds(id)]))];
}
async function createThreadLinks(targetId, sourceIds, type='synthesis', label='综合') {
  const ids=[...new Set(sourceIds)].filter(id=>id && id!==targetId && getThread(id));
  if (!ids.length) return;
  if (state.backendAvailable) {
    try {
      const response=await api('/api/links',{ method:'POST', body:JSON.stringify({ targetThreadId:targetId, sourceThreadIds:ids, type, label }) });
      const links=await response.json();
      state.links.push(...links.map(toClientLink));
      return;
    } catch (error) { toast(error.message || '创建合流连线失败'); }
  }
  state.links.push(...ids.map(sourceId=>({ id:`link-${sourceId}-${targetId}-${Date.now()}`, source:sourceId, target:targetId, type, label })));
}
function requestBulkDelete() {
  if (!state.selected.size) return;
  requestDeleteIds([...state.selected], `删除已选的 ${state.selected.size} 条线索？`);
}
function requestDeleteIds(targetIds, title) {
  const ids=deletionIdsFor(targetIds);
  state.deleteTargetIds=targetIds;
  $('#delete-dialog-title').textContent=title;
  const extra=ids.length-targetIds.length;
  const emptyCanvas=ids.length===state.threads.length;
  $('#delete-dialog-copy').textContent=emptyCanvas ? '这会删除画布内的全部线索、对话和连接。画布将保留为空白状态，此操作无法撤销。' : extra ? `这会额外删除 ${extra} 条下游分支，以及所有相关对话和连接。此操作无法撤销。` : '这会删除所选线索及其中的全部对话。此操作无法撤销。';
  $('#delete-dialog').showModal();
}
function closeDeleteDialog() { state.deleteTargetIds=[]; $('#delete-dialog').close(); }
async function deleteThreads(threadIds) {
  const ids=deletionIdsFor(threadIds);
  if (state.backendAvailable) {
    try {
      const path=threadIds.length===1 ? `/api/threads/${threadIds[0]}` : '/api/threads';
      const options=threadIds.length===1 ? { method:'DELETE' } : { method:'DELETE', body:JSON.stringify({ ids:threadIds }) };
      const response=await api(path,options);
      const payload=await response.json();
      ids.splice(0,ids.length,...payload.deletedIds);
    }
    catch (error) { toast(error.message || '删除线索失败'); return; }
  }
  state.threads=state.threads.filter(thread=>!ids.includes(thread.id));
  state.selected=new Set([...state.selected].filter(id=>!ids.includes(id)));
  state.links=state.links.filter(link=>!ids.includes(link.source) && !ids.includes(link.target));
  state.activeId=state.threads[0]?.id || null;
  if (state.activeId) updateFocus(state.activeId);
  setMode('canvas');
  renderAll();
  toast(ids.length > threadIds.length ? `已删除 ${threadIds.length} 条线索及 ${ids.length-threadIds.length} 条分支` : `已删除 ${ids.length} 条线索`);
}
function refreshStreamingThread(thread) {
  const card=$(`[data-card="${thread.id}"]`);
  if (card) {
    const conversation=$('.card-conversation',card); if(conversation) conversation.innerHTML=thread.messages.slice(-3).map(message=>formatMessage(message,true)).join('');
  }
  $$(`[data-message]`).forEach(element=>{
    const message=thread.messages.find(item=>item.id===element.dataset.message);
    if (!message) return;
    const content=$('.message-content',element); if(content) content.innerHTML=message.streaming ? '<span class="typing">正在思考</span>' : renderMarkdown(message.text);
  });
}
function scheduleStreamingThreadRefresh(thread) {
  if (thread.streamingRefreshQueued) return;
  thread.streamingRefreshQueued=true;
  setTimeout(()=>{thread.streamingRefreshQueued=false;refreshStreamingThread(thread);initIcons();},80);
}
async function sendMessageToThread(threadId, raw) {
  const value=raw.trim(); if(!value) return; const thread=getThread(threadId); state.activeId=threadId;
  if (!state.backendAvailable) { thread.messages.push({role:'user',text:value},{role:'assistant',text:`沿着「${thread.title}」继续：${value}\n\n可以先抓住核心条件，再用一个具体例子检验它。这个结论只会保存在线索本身，不会影响其他探索路径。`});thread.count=thread.messages.length;thread.updated='刚刚';thread.preview=value;renderAll();toast('回复已加入独立上下文');return; }
  const optimistic = { id:`local-${Date.now()}`, role:'user', text:value }; const pending = { id:`pending-${Date.now()}`, role:'assistant', text:'', streaming:true }; thread.messages.push(optimistic, pending);thread.count=thread.messages.length;thread.preview=value;renderAll();
  try {
    const response = await api(`/api/threads/${threadId}/messages`, { method:'POST', body:JSON.stringify({content:value}) });
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const {done, value:chunk} = await reader.read(); if(done) break; buffer += decoder.decode(chunk, {stream:true}); const events = buffer.split('\n\n'); buffer = events.pop();
      events.forEach(event => { const line=event.split('\n').find(item => item.startsWith('data: ')); if(!line) return; try { const payload=JSON.parse(line.slice(6)); if(payload.type==='message') { optimistic.id=payload.message.id; } if(payload.type==='status') { pending.streaming=false; pending.text=payload.message; } if(payload.type==='sources') { pending.streaming=false; pending.text=`已找到 ${payload.sources.length} 个来源，正在整理回答…`; } if(payload.type==='delta') { if(pending.text.startsWith('正在联网搜索')||pending.text.startsWith('已找到 ')) pending.text=''; pending.streaming=false; pending.text += payload.delta; } if(payload.type==='done') { pending.id=payload.message.id; pending.text=payload.message.content; pending.streaming=false; } if(payload.type==='error') { pending.streaming=false; pending.text=`回复失败：${payload.error}`; toast(pending.text); } thread.count=thread.messages.length;thread.preview=pending.text || value;scheduleStreamingThreadRefresh(thread); } catch {} });
    }
    thread.updated='刚刚'; renderAll();
  } catch (error) { pending.streaming=false;pending.text=`回复失败：${error.message || '无法连接后端'}`;renderAll();toast('无法连接后端'); }
}
async function addMessage(threadId, raw) {
  const value=raw.trim(); if(!value) return;
  const parent=getThread(threadId); if(!parent)return;
  const child=await createThread(value,threadId,false,parent.messages.at(-1)?.id || null,'continuation');
  if(child) await sendMessageToThread(child.id,value);
}
function synthesisPrompt(threads) {
  const sources=threads.map((thread,index)=>{
    const messages=thread.messages.slice(-5).map(message=>`${message.role==='user'?'问题':'回答'}：${message.text}`).join('\n');
    return `## 来源 ${index+1}：${thread.title}\n${messages || '暂无对话内容'}`;
  }).join('\n\n');
  return `请把下面 ${threads.length} 条非线性探索线索综合成一张新的合流卡片。\n\n要求：\n- 先给出一个统一结论。\n- 列出这些线索互相补充或冲突的地方。\n- 给出下一步最值得追问的问题。\n- 回答要紧凑，适合放在画布卡片里。\n\n${sources}`;
}
async function synthesizeSelectedThreads() {
  const threads=[...state.selected].map(getThread).filter(Boolean).slice(0,3);
  if (threads.length < 2) { toast('至少选择两条线索'); return; }
  if (state.selected.size > 3) toast('先综合前 3 条已选线索');
  const bounds=threads.map(cardFootprint);
  const maxX=Math.max(...bounds.map(item=>item.x+item.width));
  const avgY=bounds.reduce((sum,item)=>sum+item.y,0)/bounds.length;
  const title=`综合：${threads.map(thread=>thread.title).join(' / ')}`.slice(0,38);
  const prompt=synthesisPrompt(threads);
  const thread=await createThread(prompt,null,false,null,'synthesis',{title,position:findOpenPosition({x:maxX+90,y:Math.max(70,avgY)}),topic:'#4f46e5'});
  if (thread) {
    await createThreadLinks(thread.id, threads.map(item=>item.id), 'synthesis', '综合');
    state.selected.clear();
    state.selected.add(thread.id);
    renderAll();
    void sendMessageToThread(thread.id,prompt);
    toast('正在生成综合卡片');
  }
}
async function createSynthesisDraft(sourceIds) {
  const threads=[...new Set(sourceIds)].map(getThread).filter(Boolean).slice(0,3);
  if (threads.length < 2) { toast('至少连接两条线索'); return null; }
  const bounds=threads.map(cardFootprint);
  const maxX=Math.max(...bounds.map(item=>item.x+item.width));
  const avgY=bounds.reduce((sum,item)=>sum+item.y,0)/bounds.length;
  const title=`综合：${threads.map(thread=>thread.title).join(' / ')}`.slice(0,38);
  const prompt=`综合 ${threads.map(thread=>`「${thread.title}」`).join(' 和 ')}`;
  const thread=await createThread(prompt,null,false,null,'synthesis',{title,position:findOpenPosition({x:maxX+90,y:Math.max(70,avgY)}),topic:'#4f46e5'});
  if (!thread) return null;
  await createThreadLinks(thread.id, threads.map(item=>item.id), 'synthesis', '综合');
  state.selected.clear();
  state.selected.add(thread.id);
  state.quickReplyTargetId=thread.id;
  state.quickBranchTargetId=null;
  renderAll();
  toast('已创建合流草稿，输入后开始综合');
  return thread;
}
function exportMarkdown() { const markdown=state.threads.map(thread=>`# ${thread.title}\n\n${thread.messages.map(m=>`## ${m.role==='user'?'你':'Synapse'}\n\n${m.text}`).join('\n\n')}`).join('\n\n---\n\n'); const blob=new Blob([markdown],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='synapse-算法复习.md';a.click();URL.revokeObjectURL(url);toast('已导出 Markdown'); }
function openCommand() { $('#command-dialog').showModal(); renderCommandResults(''); setTimeout(()=>$('#command-search').focus(),50); }
function settingsPayload() { return { provider:$('#provider-input').value, baseUrl:$('#base-url-input').value.trim(), apiKey:$('#api-key-input').value.trim(), model:$('#model-input').value.trim(), systemPrompt:$('#system-prompt-input').value.trim(), searchProvider:$('#search-provider-input').value, searchApiKey:$('#search-api-key-input').value.trim(), searchMaxResults:Number($('#search-max-results-input').value || 5) }; }
function updateProviderFields() { const demo=$('#provider-input').value==='demo'; $('#provider-setting').classList.toggle('disabled',demo); $$('#provider-setting input').forEach(input=>input.disabled=demo); }
function updateSearchFields() { const disabled=$('#search-provider-input').value==='off'; $('#search-provider-setting').classList.toggle('disabled',disabled); $$('#search-provider-setting input').forEach(input=>input.disabled=disabled); }
function setSettingsStatus(message, type='default') { const status=$('#settings-status'); status.className=`settings-status ${type === 'default' ? '' : type}`; status.innerHTML=`<i data-lucide="${type === 'error' ? 'circle-alert' : type === 'success' ? 'circle-check' : 'shield-check'}"></i><span>${message}</span>`; initIcons(); }
async function openSettings() {
  if (!state.backendAvailable) { toast('模型服务设置需要通过本地后端打开应用'); return; }
  try {
    const response=await api('/api/settings'); const config=await response.json(); $('#provider-input').value=config.provider; $('#base-url-input').value=config.baseUrl || ''; $('#api-key-input').value=''; $('#api-key-input').placeholder=config.hasApiKey ? '已设置，留空可保持不变' : '输入后仅保存在本机后端'; $('#model-input').value=config.model || ''; $('#system-prompt-input').value=config.systemPrompt || ''; $('#search-provider-input').value=config.searchProvider || 'off'; $('#search-api-key-input').value=''; $('#search-api-key-input').placeholder=config.hasSearchApiKey ? '已设置，留空可保持不变' : 'Tavily API Key'; $('#search-max-results-input').value=config.searchMaxResults || 5; updateProviderFields(); updateSearchFields(); setSettingsStatus(config.hasApiKey || config.hasSearchApiKey ? '密钥已保存在本机后端' : '密钥不会返回到浏览器'); $('#settings-dialog').showModal();
  } catch (error) { toast(error.message || '无法读取模型设置'); }
}
function openWorkspaceDialog() { $('#workspace-title-input').value=''; $('#workspace-dialog').showModal(); setTimeout(()=>$('#workspace-title-input').focus(),50); }
function closeWorkspaceDialog() { $('#workspace-dialog').close(); }
async function createWorkspace(title) {
  if (!state.backendAvailable) { toast('新建画布需要连接本地后端'); return; }
  try {
    const response=await api('/api/workspaces',{ method:'POST', body:JSON.stringify({ title }) });
    const workspace=await response.json();
    closeWorkspaceDialog();
    state.pan={x:0,y:0}; state.scale=1; state.selected.clear();
    await bootstrap(workspace.id);
    setMode('canvas');
    toast(`已创建「${workspace.title}」`);
  } catch(error) { toast(error.message || '创建画布失败'); }
}
function renderCommandResults(query) { const lower=query.toLowerCase(); const results=[...state.threads.filter(t=>t.title.toLowerCase().includes(lower)).map(t=>({type:'thread',id:t.id,label:t.title,detail:'打开线索',icon:'message-square-text'})),{type:'new',label:'新建线索',detail:'Ctrl N',icon:'plus'},{type:'compare',label:'对比已选线索',detail:'Ctrl Shift C',icon:'columns-2'}]; $('#command-results').innerHTML=results.map(r=>`<button class="command-result" data-command="${r.type}" data-thread="${r.id||''}"><i data-lucide="${r.icon}"></i><span>${r.label}</span><small>${r.detail}</small></button>`).join('');initIcons(); }
function bindEvents() {
  document.addEventListener('click', event => {
    const select=event.target.closest('[data-select]'); if(select){event.stopPropagation(); const id=select.dataset.select; const shouldSelect=select.matches('input[type="checkbox"]') ? select.checked : !state.selected.has(id); shouldSelect?state.selected.add(id):state.selected.delete(id);renderAll();return;}
    const card=event.target.closest('[data-card]');
    if(card && suppressCardActivationId===card.dataset.card){suppressCardActivationId=null;event.preventDefault();event.stopPropagation();return;}
    if(card && !event.target.closest('button,input,textarea,.quick-branch')) { updateFocus(card.dataset.card); renderActiveState(); return; }
    const button=event.target.closest('[data-action]'); if(!button)return;const action=button.dataset.action;const id=button.dataset.thread;
    if(action==='new-thread') openNewThread();
    if(action==='new-workspace') openWorkspaceDialog();
    if(action==='close-workspace') closeWorkspaceDialog();
    if(action==='activate'){updateFocus(id);setMode('thread');renderAll();}
    if(action==='open-thread'){state.activeId=id;setMode('thread');renderAll();}
    if(action==='show-canvas'){setMode('canvas');}
    if(action==='quick-branch'){if(suppressBranchClick){suppressBranchClick=false;event.preventDefault();return;}openQuickBranch(id||state.activeId);}
    if(action==='close-quick-branch') closeQuickBranch();
    if(action==='close-quick-reply') closeQuickReply();
    if(action==='set-branch-type') setBranchType(button.dataset.branchType);
    if(action==='branch') branch(id||state.activeId, button.dataset.message || null);
    if(action==='close-branch') closeBranchDialog();
    if(action==='request-delete') requestDelete(id||state.activeId);
    if(action==='request-bulk-delete') requestBulkDelete();
    if(action==='synthesize-selected') void synthesizeSelectedThreads();
    if(action==='close-delete') closeDeleteDialog();
    if(action==='export')exportMarkdown();
    if(action==='command')openCommand();
    if(action==='settings')void openSettings();
    if(action==='close-settings')$('#settings-dialog').close();
    if(action==='zoom-in') zoomCanvas(state.scale+.1);
    if(action==='zoom-out') zoomCanvas(state.scale-.1);
    if(action==='auto-layout'){const layout={quick:[100,205],merge:[480,100],divide:[480,305],heap:[100,440]};state.threads.forEach((t,index)=>{const point=layout[t.id]||[100+(index%2)*380,100+Math.floor(index/2)*185];t.x=point[0];t.y=point[1];void persistThread(t)});renderAll();toast('已按探索关系整理画布');}
    if(action==='copy'){const message=getThread(id||state.activeId)?.messages.find(item=>item.id===button.dataset.message);navigator.clipboard?.writeText(message?.text||'');toast('已复制回答');}
  });
  $$('.mode-button').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
  $('#cards-layer').addEventListener('submit',async event=>{const branchForm=event.target.closest('[data-quick-branch]');const replyForm=event.target.closest('[data-quick-reply]');if(!branchForm&&!replyForm)return;event.preventDefault();const form=branchForm||replyForm;const input=$('textarea',form);const value=input.value.trim();if(!value){input.focus();return;}const submit=$('button[type="submit"]',form);submit.disabled=true;try{if(branchForm){const prompt=branchPrompt(activeBranchType(),value);const created=await createThread(prompt,branchForm.dataset.quickBranch,true,getThread(branchForm.dataset.quickBranch)?.messages.at(-1)?.id || null);if(created){state.quickBranchTargetId=null;renderAll();}}else{state.quickReplyTargetId=null;await sendMessageToThread(replyForm.dataset.quickReply,value);}}finally{submit.disabled=false;}});
  $('#branch-form').addEventListener('submit',async event=>{event.preventDefault();const value=$('#branch-prompt').value.trim();if(!value){$('#branch-prompt').focus();return;}const parent=state.branchTargetId;const prompt=parent ? branchPrompt(activeBranchType(),value) : value;const create=$('#create-branch');create.disabled=true;try{const created=await createThread(prompt,parent,true,state.branchMessageId);if(created)closeBranchDialog();}finally{create.disabled=false;}});
  $('#delete-form').addEventListener('submit',async event=>{event.preventDefault();const targets=state.deleteTargetIds;if(!targets.length)return;const submit=$('#delete-form button[type="submit"]');submit.disabled=true;try{await deleteThreads(targets);closeDeleteDialog();}finally{submit.disabled=false;}});
  $('#workspace-form').addEventListener('submit',event=>{event.preventDefault();const title=$('#workspace-title-input').value.trim() || '未命名画布';void createWorkspace(title);});
  $('#workspace-selector').addEventListener('change',event=>{const nextId=event.target.value;if(nextId && nextId!==state.workspaceId){state.pan={x:0,y:0};state.scale=1;void bootstrap(nextId).then(()=>setMode('canvas'));}});
  $('#delete-dialog').addEventListener('cancel',()=>{state.deleteTargetIds=[];});
  $('#provider-input').addEventListener('change',updateProviderFields);
  $('#search-provider-input').addEventListener('change',updateSearchFields);
  $('#test-settings').addEventListener('click',async()=>{ try { setSettingsStatus('正在测试模型服务…'); const response=await api('/api/settings/test',{method:'POST',body:JSON.stringify(settingsPayload())}); const result=await response.json(); setSettingsStatus(result.message || '模型服务连接成功','success'); } catch(error) { setSettingsStatus(error.message || '模型服务连接失败','error'); } });
  $('#settings-form').addEventListener('submit',async event=>{ event.preventDefault(); try { const response=await api('/api/settings',{method:'PUT',body:JSON.stringify(settingsPayload())}); const result=await response.json(); $('#api-key-input').value=''; $('#api-key-input').placeholder=result.hasApiKey ? '已设置，留空可保持不变' : '输入后仅保存在本机后端'; $('#search-api-key-input').value=''; $('#search-api-key-input').placeholder=result.hasSearchApiKey ? '已设置，留空可保持不变' : 'Tavily API Key'; updateSearchFields(); setSettingsStatus('模型与搜索设置已保存','success'); toast('模型与搜索设置已保存'); } catch(error) { setSettingsStatus(error.message || '无法保存模型设置','error'); } });
  document.addEventListener('submit',event=>{const form=event.target.closest('[data-compose]');if(!form)return;event.preventDefault();const input=$('textarea, input',form);void addMessage(form.dataset.compose,input.value);});
  $('#command-search').addEventListener('input',event=>renderCommandResults(event.target.value));
  $('#command-results').addEventListener('click',event=>{const button=event.target.closest('[data-command]');if(!button)return;$('#command-dialog').close();if(button.dataset.command==='thread'){state.activeId=button.dataset.thread;setMode('thread');renderAll();}if(button.dataset.command==='new')openNewThread();if(button.dataset.command==='compare')setMode('compare');});
  document.addEventListener('keydown',event=>{
    const quickForm=event.target.closest?.('[data-quick-branch]');
    const quickReplyForm=event.target.closest?.('[data-quick-reply]');
    if(quickForm && event.key==='Enter' && !event.shiftKey){event.preventDefault();quickForm.requestSubmit();return;}
    if(quickForm && event.key==='Escape'){event.preventDefault();closeQuickBranch();return;}
    if(quickReplyForm && event.key==='Enter' && !event.shiftKey){event.preventDefault();quickReplyForm.requestSubmit();return;}
    if(quickReplyForm && event.key==='Escape'){event.preventDefault();closeQuickReply();return;}
    const mod=event.ctrlKey||event.metaKey;
    if(mod&&event.key.toLowerCase()==='n'){event.preventDefault();openNewThread();return;}
    if(mod&&event.key.toLowerCase()==='b'){event.preventDefault();branch(state.activeId);return;}
    if(mod&&event.shiftKey&&event.key.toLowerCase()==='c'){event.preventDefault();setMode('compare');return;}
    if(mod&&['1','2','3'].includes(event.key)){event.preventDefault();setMode({1:'canvas',2:'thread',3:'compare'}[event.key]);return;}
    if(isTextInputTarget(event.target)) return;
    if(event.key==='Escape'){
      if(state.quickBranchTargetId){event.preventDefault();closeQuickBranch();return;}
      if(state.quickReplyTargetId){event.preventDefault();closeQuickReply();return;}
      if($('#branch-drawer').classList.contains('open')){event.preventDefault();closeBranchDialog();return;}
    }
    if(state.mode!=='canvas' || document.querySelector('dialog[open]')) return;
    const directionKeys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
    if(directionKeys[event.key]){event.preventDefault();const next=directionalThread(directionKeys[event.key]);if(next){updateFocus(next.id);renderActiveState();}return;}
    if(event.key==='Tab'){event.preventDefault();openQuickBranch(state.activeId);return;}
    if(event.key==='Enter'){event.preventDefault();openQuickReply(state.activeId);return;}
  });
  const viewport=$('#canvas-viewport');let panStart=null,drag=null,linkDrag=null,suppressCardActivationId=null,suppressBranchClick=false;
  const clientToCanvasPoint=event=>{
    const grid=$('#canvas-grid');
    const bounds=grid.getBoundingClientRect();
    const scaleX=bounds.width/grid.offsetWidth || state.scale || 1;
    const scaleY=bounds.height/grid.offsetHeight || state.scale || 1;
    return {x:(event.clientX-bounds.left)/scaleX,y:(event.clientY-bounds.top)/scaleY};
  };
  const clearLinkDropTarget=()=>{$$('.branch-node.drop-target').forEach(node=>node.classList.remove('drop-target'));};
  const nearestSnapNode=event=>{
    let best=null;
    $$('.branch-node').forEach(node=>{
      if(node.dataset.thread===linkDrag?.sourceId)return;
      const bounds=node.getBoundingClientRect();
      const center={x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};
      const distance=Math.hypot(event.clientX-center.x,event.clientY-center.y);
      if(distance<=24 && (!best || distance<best.distance)) best={node,distance};
    });
    return best?.node || null;
  };
  const updateLinkDraft=event=>{
    if(!linkDrag)return;
    const source=getThread(linkDrag.sourceId); if(!source)return;
    const hovered=nearestSnapNode(event);
    const hoveredId=hovered?.dataset.thread;
    clearLinkDropTarget();
    linkDrag.targetId=hoveredId || null;
    if(linkDrag.targetId) hovered.classList.add('drop-target');
    const end=linkDrag.targetId ? branchAnchor(getThread(linkDrag.targetId)) : clientToCanvasPoint(event);
    linkDrag.path.setAttribute('d',pointConnectorPath(branchAnchor(source),end));
  };
  const endLinkDraft=event=>{
    if(!linkDrag)return;
    const targetId=linkDrag.targetId;
    const moved=linkDrag.moved;
    linkDrag.path.remove();
    clearLinkDropTarget();
    const sourceId=linkDrag.sourceId;
    linkDrag=null;
    if(moved) { suppressBranchClick=true; setTimeout(()=>{suppressBranchClick=false;},0); }
    if(moved && targetId && targetId!==sourceId) void createSynthesisDraft([sourceId,targetId]);
  };
  viewport.addEventListener('pointerdown',event=>{const node=event.target.closest('.branch-node');if(node){const source=getThread(node.dataset.thread);if(!source)return;event.preventDefault();event.stopPropagation();const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class','connector-draft');path.setAttribute('d',pointConnectorPath(branchAnchor(source),branchAnchor(source)));$('#connectors').append(path);linkDrag={sourceId:source.id,startX:event.clientX,startY:event.clientY,path,moved:false,targetId:null};node.setPointerCapture?.(event.pointerId);return;}const card=event.target.closest('[data-card]');const handle=event.target.closest('.card-top,.card-path');if(card && handle && !event.target.closest('button')){const thread=getThread(card.dataset.card);drag={id:thread.id,card,startX:event.clientX,startY:event.clientY,baseX:thread.x,baseY:thread.y,moved:false};card.setPointerCapture(event.pointerId);return;}if(card)return;if(event.target===viewport||event.target.closest('.canvas-grid')){panStart={x:event.clientX,y:event.clientY,baseX:state.pan.x,baseY:state.pan.y};viewport.classList.add('panning');}});
  window.addEventListener('pointermove',event=>{if(linkDrag){const deltaX=event.clientX-linkDrag.startX;const deltaY=event.clientY-linkDrag.startY;if(!linkDrag.moved && (Math.abs(deltaX)>4||Math.abs(deltaY)>4))linkDrag.moved=true;if(linkDrag.moved)updateLinkDraft(event);return;}if(drag){const deltaX=event.clientX-drag.startX;const deltaY=event.clientY-drag.startY;if(!drag.moved && (Math.abs(deltaX)>3||Math.abs(deltaY)>3))drag.moved=true;if(drag.moved){const thread=getThread(drag.id);thread.x=drag.baseX+deltaX/state.scale;thread.y=drag.baseY+deltaY/state.scale;drag.card.style.left=`${thread.x}px`;drag.card.style.top=`${thread.y}px`;refreshConnectorsForThread(thread.id);}}if(panStart){state.pan.x=panStart.baseX+event.clientX-panStart.x;state.pan.y=panStart.baseY+event.clientY-panStart.y;applyCanvasTransform();}});
  window.addEventListener('pointerup',event=>{if(linkDrag){endLinkDraft(event);return;}const movedThread=drag?.moved ? getThread(drag.id) : null;drag=null;panStart=null;viewport.classList.remove('panning');if(movedThread){suppressCardActivationId=movedThread.id;setTimeout(()=>{if(suppressCardActivationId===movedThread.id)suppressCardActivationId=null;},0);void persistThread(movedThread);}});
  viewport.addEventListener('wheel',event=>{if(event.target.closest('.card-conversation,.quick-branch'))return;event.preventDefault();zoomCanvas(state.scale+(event.deltaY>0?-.06:.06),event.clientX,event.clientY);},{passive:false});
  $('#sync-scroll').addEventListener('change',event=>{if(!event.target.checked)return;$$('[data-scroll-column]').forEach(column=>column.addEventListener('scroll',syncScroll));});
}
function syncScroll(event){if(!$('#sync-scroll').checked)return;$$('[data-scroll-column]').forEach(column=>{if(column!==event.currentTarget)column.scrollTop=event.currentTarget.scrollTop;});}
renderAll();bindEvents();void bootstrap();
