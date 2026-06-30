/**
 * ROBO-OS: Minimal ChatGPT-style Multi-Agent Robotics Console
 * Multi-agent orchestration, MCP integration, Human-in-the-Loop, Security guardrails
 */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // STATE
  // ============================================================
  let apiKey = '';
  let activeContext = null;
  let isProcessing = false;
  let totalQueries = 0;
  let mcpConnected = false;
  let pendingQuery = null;
  const completedSteps = new Set();

  // ============================================================
  // DOM
  // ============================================================
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const sidebarClose = document.getElementById('sidebar-close');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const apiStatusBadge = document.getElementById('api-status-badge');
  const apiStatusText = document.getElementById('api-status-text');
  const mcpStatusText = document.getElementById('mcp-status-text');
  const chatContainer = document.getElementById('chat-container');
  const emptyState = document.getElementById('empty-state');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const pillBtns = document.querySelectorAll('.pill-btn');
  const logsTerminal = document.getElementById('logs-terminal');
  const openLogsBtn = document.getElementById('open-logs-btn');
  const closeLogsBtn = document.getElementById('close-logs-btn');
  const logsDrawer = document.getElementById('logs-drawer');
  const logsDrawerOverlay = document.getElementById('logs-drawer-overlay');
  const securityModal = document.getElementById('security-modal');
  const securityModalBody = document.getElementById('security-modal-body');
  const securityModalClose = document.getElementById('security-modal-close');

  let chatThread = null; // created lazily on first message

  // ============================================================
  // INIT
  // ============================================================
  loadSavedApiKey();
  initMCP();
  autoResizeTextarea();

  // ============================================================
  // SIDEBAR TOGGLE
  // ============================================================
  function openSidebar() { sidebar.classList.add('open'); sidebarOverlay.classList.add('show'); }
  function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); }
  hamburgerBtn.addEventListener('click', openSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // ============================================================
  // LOGS DRAWER
  // ============================================================
  function openLogs() { logsDrawer.classList.remove('hidden'); logsDrawerOverlay.classList.remove('hidden'); }
  function closeLogs() { logsDrawer.classList.add('hidden'); logsDrawerOverlay.classList.add('hidden'); }
  openLogsBtn.addEventListener('click', () => { closeSidebar(); openLogs(); });
  closeLogsBtn.addEventListener('click', closeLogs);
  logsDrawerOverlay.addEventListener('click', closeLogs);

  // ============================================================
  // MCP
  // ============================================================
  function initMCP() {
    mcpStatusText.textContent = 'connecting';
    addLog('MCP', `Connecting to ${MCP_CONFIG.serverName} v${MCP_CONFIG.version}`);
    setTimeout(() => {
      mcpConnected = true;
      mcpStatusText.textContent = 'connected';
      addLog('MCP', `Connected. Tools: ${MCP_TOOLS.map(t => t.name).join(', ')}`);
    }, 1200);
  }

  async function callMCPTool(toolName, params) {
    addLog('MCP', `Tool call: ${toolName}(${JSON.stringify(params)})`);
    await delay(250);
    if (toolName === 'search_docs') { addLog('MCP', `Found docs for "${params.query}"`); return { found: true }; }
    return { found: false };
  }

  // ============================================================
  // API KEY
  // ============================================================
  function loadSavedApiKey() {
    const saved = localStorage.getItem('robo_os_gemini_key');
    if (saved) {
      apiKey = saved; apiKeyInput.value = saved;
      setApiStatus('connected', 'Gemini Live');
      addLog('SYSTEM', 'API key loaded. Live mode ON.');
    } else {
      setApiStatus('idle', 'Sandbox Mode');
      addLog('SYSTEM', 'No API key. Sandbox Mode.');
    }
  }
  saveKeyBtn.addEventListener('click', () => {
    const v = apiKeyInput.value.trim();
    if (!v) { localStorage.removeItem('robo_os_gemini_key'); apiKey=''; setApiStatus('idle','Sandbox Mode'); return; }
    if (v.length >= 20) {
      localStorage.setItem('robo_os_gemini_key', v); apiKey = v;
      setApiStatus('connected', 'Gemini Live'); addLog('SYSTEM','API key saved. Live mode ON.');
    } else { setApiStatus('error', 'Invalid Key'); }
  });
  function setApiStatus(status, text) {
    apiStatusBadge.className = 'sidebar-api-status ' + status;
    apiStatusText.textContent = text;
  }

  // ============================================================
  // LOGGING
  // ============================================================
  function addLog(type, message) {
    const ts = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `log-line ${type.toLowerCase()}-log`;
    line.textContent = `[${ts}] [${type}]: ${typeof message === 'string' ? message : JSON.stringify(message)}`;
    logsTerminal.appendChild(line);
    logsTerminal.scrollTop = logsTerminal.scrollHeight;
  }

  // ============================================================
  // CHAT THREAD SETUP
  // ============================================================
  function ensureThread() {
    if (chatThread) return chatThread;
    emptyState.remove();
    chatThread = document.createElement('div');
    chatThread.className = 'chat-thread';
    chatContainer.appendChild(chatThread);
    return chatThread;
  }

  function scrollToBottom() { chatContainer.scrollTop = chatContainer.scrollHeight; }

  function appendUserMsg(text) {
    const thread = ensureThread();
    const row = document.createElement('div');
    row.className = 'msg-row user';
    row.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div><div class="msg-time">${nowTime()}</div>`;
    thread.appendChild(row);
    scrollToBottom();
  }

  function appendSystemMsg(text, isSecurity = false) {
    const thread = ensureThread();
    const row = document.createElement('div');
    row.className = `msg-row system ${isSecurity ? 'security' : ''}`;
    row.innerHTML = `<div class="msg-bubble">${text}</div>`;
    thread.appendChild(row);
    scrollToBottom();
    return row;
  }

  function showTyping(label) {
    const thread = ensureThread();
    const row = document.createElement('div');
    row.className = 'msg-row agent';
    row.id = 'typing-indicator';
    row.innerHTML = `<div class="typing-bubble"><div class="typing-dots"><span></span><span></span><span></span></div><span class="typing-text">${label}</span></div>`;
    thread.appendChild(row);
    scrollToBottom();
    return row;
  }
  function updateTyping(label) {
    const el = document.querySelector('#typing-indicator .typing-text');
    if (el) el.textContent = label;
  }
  function removeTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  // Mini stepper showing 4-stage progress for THIS query
  function showMiniStepper() {
    const thread = ensureThread();
    const row = document.createElement('div');
    row.className = 'msg-row agent';
    row.id = 'mini-stepper-row';
    row.innerHTML = `<div class="mini-stepper">
      <div class="mini-step" id="ms-route"><span class="mini-step-icon"><i class="fa-solid fa-check"></i></span>Understand</div>
      <div class="mini-step" id="ms-mcp"><span class="mini-step-icon"><i class="fa-solid fa-check"></i></span>Docs</div>
      <div class="mini-step" id="ms-gen"><span class="mini-step-icon"><i class="fa-solid fa-check"></i></span>Generate</div>
      <div class="mini-step" id="ms-done"><span class="mini-step-icon"><i class="fa-solid fa-check"></i></span>Ready</div>
    </div>`;
    thread.appendChild(row);
    scrollToBottom();
    return row;
  }
  function markMiniStep(id, state) {
    const el = document.getElementById(id);
    if (el) el.className = `mini-step ${state}`;
  }

  function nowTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  // ============================================================
  // SIDEBAR AGENT STATUS
  // ============================================================
  function setSidebarAgentActive(key) {
    document.querySelectorAll('.sidebar-agent').forEach(el => { el.classList.remove('active'); el.querySelector('.sa-status').textContent = 'idle'; });
    const map = { IDEA: 'side-idea', COMPONENTS: 'side-components', BUILD: 'side-build', TROUBLESHOOTING: 'side-trouble' };
    const el = document.getElementById(map[key]);
    if (el) { el.classList.add('active'); el.querySelector('.sa-status').textContent = 'active'; }
  }

  // ============================================================
  // INPUT HANDLING
  // ============================================================
  function autoResizeTextarea() {
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });
  }
  sendBtn.addEventListener('click', handleSubmit);
  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } });
  pillBtns.forEach(btn => btn.addEventListener('click', () => { chatInput.value = btn.getAttribute('data-prompt'); handleSubmit(); }));
  clearChatBtn.addEventListener('click', () => {
    chatContainer.innerHTML = `<div class="empty-state" id="empty-state"><div class="empty-icon"><i class="fa-solid fa-robot"></i></div><h1>ROBO-OS</h1><p>What would you like to build?</p></div>`;
    chatThread = null;
    activeContext = null;
    completedSteps.clear();
    document.querySelectorAll('.sidebar-agent').forEach(el => { el.classList.remove('active'); el.querySelector('.sa-status').textContent='idle'; });
  });

  // ============================================================
  // MAIN PIPELINE
  // ============================================================
  async function handleSubmit() {
    const query = chatInput.value.trim();
    if (!query || isProcessing) return;
    isProcessing = true; sendBtn.disabled = true;
    chatInput.value = ''; chatInput.style.height = 'auto';
    totalQueries++;

    const check = validateQuery(query);
    if (!check.valid) {
      appendUserMsg(query);
      appendSystemMsg(`🛡️ ${escapeHtml(check.reason)}`, true);
      addLog('SECURITY', `Blocked: ${check.reason}`);
      securityModalBody.textContent = `🛡️ ${check.reason}`;
      securityModal.classList.remove('hidden');
      isProcessing = false; sendBtn.disabled = false;
      return;
    }

    appendUserMsg(query);
    pendingQuery = query;
    addLog('SYSTEM', `Query #${totalQueries}: "${query}"`);

    const typingEl = showTyping('ROBO-OS is thinking...');

    try {
      let route;
      if (!apiKey) { await delay(800); route = sandboxRoute(query); }
      else { route = await callGeminiOrchestrator(query); }

      const agentNameMap = { IDEA: 'Idea Agent', COMPONENTS: 'Components Agent', BUILD: 'Build Agent', TROUBLESHOOTING: 'Troubleshooting Agent', TROUBLE: 'Troubleshooting Agent' };
      const agentKeyMap  = { IDEA: 'IDEA', COMPONENTS: 'COMPONENTS', BUILD: 'BUILD', TROUBLESHOOTING: 'TROUBLESHOOTING', TROUBLE: 'TROUBLESHOOTING' };
      const key = agentKeyMap[route.agent.toUpperCase()] || 'IDEA';
      const name = agentNameMap[route.agent.toUpperCase()] || 'Idea Agent';

      if (route.project_context) { activeContext = route.project_context; }

      updateTyping(`Routing to ${name}...`);
      setSidebarAgentActive(key);
      addLog('ORCHESTRATOR', `Routed → ${key} (${(route.confidence*100).toFixed(0)}%) — ${route.reason}`);
      await delay(500);

      if (mcpConnected) { updateTyping('Checking developer docs...'); await callMCPTool('search_docs', { query, category: key.toLowerCase() }); }

      updateTyping(`${name} is generating a response...`);
      let markdown;
      if (!apiKey) { await delay(1100); markdown = SANDBOX_DATA.responses[key]; }
      else { markdown = await callGeminiAgent(key, query); }

      removeTyping();
      showResponseCard(key, name, markdown);

    } catch (err) {
      removeTyping();
      appendSystemMsg(`⚠️ Error: ${escapeHtml(err.message)}`);
      addLog('ERROR', err.message);
      isProcessing = false; sendBtn.disabled = false;
    }
  }

  // ============================================================
  // SANDBOX ROUTER
  // ============================================================
  function sandboxRoute(query) {
    const q = query.toLowerCase();
    let agent = 'IDEA', matched = 'default';
    for (const [k, v] of Object.entries(SANDBOX_DATA.classification)) { if (q.includes(k)) { agent = v; matched = k; break; } }
    let ctx = activeContext;
    if (q.includes('car') || q.includes('avoid') || q.includes('line follow')) ctx = 'Smart Obstacle-Avoiding Car';
    else if (q.includes('arm') || q.includes('servo')) ctx = '4-DOF Robotic Arm';
    else if (q.includes('weather')) ctx = 'IoT Wi-Fi Smart Weather Station';
    return { agent, confidence: 0.95, reason: `Matched "${matched}"`, project_context: ctx };
  }

  // ============================================================
  // GEMINI CALLS
  // ============================================================
  async function callGeminiOrchestrator(query) {
    const payload = {
      contents: [{ parts: [{ text: `Context: ${activeContext || 'None'}. Query: "${query}"` }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT_ORCHESTRATOR }] },
      generationConfig: { responseMimeType: 'application/json' }
    };
    addLog('SENT', JSON.stringify(payload));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Orchestrator ${res.status}: ${await res.text()}`);
    const data = await res.json();
    addLog('RECEIVED', JSON.stringify(data));
    const text = data.candidates[0].content.parts[0].text.trim().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  }

  async function callGeminiAgent(agentKey, query) {
    const promptMap = { IDEA: SYSTEM_PROMPT_IDEA, COMPONENTS: SYSTEM_PROMPT_COMPONENTS, BUILD: SYSTEM_PROMPT_BUILD, TROUBLESHOOTING: SYSTEM_PROMPT_TROUBLE };
    const ctxHeader = activeContext ? `[PROJECT: "${activeContext}"]\n\n` : '';
    const mcpCtx = mcpConnected ? '\n\n[MCP: google-developer-docs connected.]' : '';
    const payload = { contents: [{ parts: [{ text: `${ctxHeader}Query: "${query}"${mcpCtx}` }] }], systemInstruction: { parts: [{ text: promptMap[agentKey] || SYSTEM_PROMPT_IDEA }] } };
    addLog('SENT', JSON.stringify(payload));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`${agentKey} ${res.status}: ${await res.text()}`);
    const data = await res.json();
    addLog('RECEIVED', JSON.stringify(data));
    return data.candidates[0].content.parts[0].text;
  }

  // ============================================================
  // RESPONSE CARD (Human-in-the-Loop, inline)
  // ============================================================
  function showResponseCard(agentKey, agentName, markdown) {
    const thread = ensureThread();
    const agentClass = agentKey.toLowerCase();
    const iconMap = { idea: 'lightbulb', components: 'list-check', build: 'screwdriver-wrench', troubleshooting: 'triangle-exclamation' };
    const preview = markdown.substring(0, 280).replace(/[#*`]/g, '').trim() + '...';

    const row = document.createElement('div');
    row.className = 'msg-row agent';
    row.style.maxWidth = '100%';
    row.style.width = '100%';
    row.innerHTML = `
      <div class="response-card">
        <div class="response-card-header">
          <div class="response-card-agent ${agentClass}"><i class="fa-solid fa-${iconMap[agentClass]||'file'}"></i> ${agentName}</div>
          <div class="response-card-time">${nowTime()}</div>
        </div>
        <div class="response-card-body" id="rc-body-${agentClass}-${Date.now()}">
          <div class="rc-content">${parseMarkdownToHtml(preview)}</div>
          <div class="response-card-fade"></div>
        </div>
        <div class="response-card-actions">
          <button class="response-card-expand">▼ View Full Response</button>
          <button class="pill-action pill-reject" id="reject-${agentClass}"><i class="fa-solid fa-rotate"></i> Regenerate</button>
          <button class="pill-action pill-approve" id="approve-${agentClass}"><i class="fa-solid fa-check"></i> Approve</button>
        </div>
      </div>`;
    thread.appendChild(row);
    scrollToBottom();

    const bodyEl = row.querySelector('.response-card-body');
    const expandBtn = row.querySelector('.response-card-expand');
    expandBtn.addEventListener('click', () => {
      const expanded = bodyEl.classList.toggle('expanded');
      if (expanded) { bodyEl.querySelector('.rc-content').innerHTML = parseMarkdownToHtml(markdown); expandBtn.textContent = '▲ Collapse'; }
      else { bodyEl.querySelector('.rc-content').innerHTML = parseMarkdownToHtml(preview); expandBtn.textContent = '▼ View Full Response'; }
    });

    row.querySelector(`#approve-${agentClass}`).addEventListener('click', () => {
      addLog('HITL', `${agentName} response APPROVED.`);
      const actions = row.querySelector('.response-card-actions');
      const fileNames = { IDEA: 'project-ideas.md', COMPONENTS: 'bill-of-materials.md', BUILD: 'build-guide.md', TROUBLESHOOTING: 'diagnostic-report.md' };
      const fname = fileNames[agentKey] || 'output.md';
      actions.innerHTML = `<span class="approved-stamp">✓ Approved</span>`;
      const dl = document.createElement('div');
      dl.className = 'download-mini';
      dl.innerHTML = `<i class="fa-solid fa-download"></i><span>Download ${fname}</span>`;
      dl.addEventListener('click', () => downloadFile(fname, markdown));
      bodyEl.after(dl);
      isProcessing = false; sendBtn.disabled = false;
    });

    row.querySelector(`#reject-${agentClass}`).addEventListener('click', async () => {
      addLog('HITL', `${agentName} response REJECTED. Regenerating...`);
      row.remove();
      const typingEl = showTyping(`Regenerating ${agentName} response...`);
      try {
        let newMd;
        if (!apiKey) { await delay(900); newMd = SANDBOX_DATA.responses[agentKey]; }
        else { newMd = await callGeminiAgent(agentKey, pendingQuery); }
        removeTyping();
        showResponseCard(agentKey, agentName, newMd);
      } catch (err) {
        removeTyping();
        appendSystemMsg(`⚠️ Regeneration failed: ${escapeHtml(err.message)}`);
        isProcessing = false; sendBtn.disabled = false;
      }
    });
  }

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('SYSTEM', `Downloaded: ${filename}`);
  }

  // ============================================================
  // SECURITY MODAL
  // ============================================================
  securityModalClose.addEventListener('click', () => securityModal.classList.add('hidden'));

  // ============================================================
  // MARKDOWN PARSER
  // ============================================================
  function parseMarkdownToHtml(md) {
    if (!md) return '';
    const lines = md.split('\n');
    let html = '', inCode = false, codeLang = '', codeContent = '';
    let inTable = false, tableHeaders = [], tableRows = [];
    let inList = false, listType = '';

    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('```')) {
        if (inCode) {
          inCode = false;
          html += `<div class="code-block-header"><span>${(codeLang||'CODE').toUpperCase()}</span></div><pre><code>${escapeHtml(codeContent)}</code></pre>`;
          codeContent = '';
        } else { inCode = true; codeLang = t.substring(3).trim(); }
        continue;
      }
      if (inCode) { codeContent += line + '\n'; continue; }

      if (t.startsWith('|') && t.endsWith('|') && t.length > 2) {
        if (!inTable) { if (inList) { html += `</${listType}>`; inList = false; } inTable = true; tableHeaders = parseRow(t); }
        else if (!t.includes('---')) tableRows.push(parseRow(t));
        continue;
      } else if (inTable) { inTable = false; html += renderTable(tableHeaders, tableRows); tableHeaders = []; tableRows = []; }

      if (t.startsWith('>')) {
        if (inList) { html += `</${listType}>`; inList = false; }
        const warn = t.includes('[!WARNING]') || t.includes('[!CAUTION]');
        const txt = t.replace(/^>\s*/, '').replace(/\[!(WARNING|NOTE|CAUTION|IMPORTANT)\]/g, '').trim();
        html += `<blockquote><i class="fa-solid fa-${warn?'triangle-exclamation':'circle-info'}"></i> ${parseInline(txt)}</blockquote>`;
        continue;
      }

      if (t.startsWith('#')) {
        if (inList) { html += `</${listType}>`; inList = false; }
        let level = 0; while (line.charAt(level) === '#') level++;
        html += `<h${Math.min(level,4)+1}>${parseInline(line.substring(level).trim())}</h${Math.min(level,4)+1}>`;
        continue;
      }

      const lm = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
      if (lm) {
        const sym = lm[2], content = lm[3];
        const lt = isNaN(sym.charAt(0)) ? 'ul' : 'ol';
        if (!inList) { inList = true; listType = lt; html += `<${lt}>`; }
        else if (listType !== lt) { html += `</${listType}>`; listType = lt; html += `<${lt}>`; }
        if (content.startsWith('[ ]') || content.startsWith('[x]')) {
          const checked = content.startsWith('[x]');
          html += `<li><input type="checkbox" ${checked?'checked':''} disabled> ${parseInline(content.substring(3).trim())}</li>`;
        } else { html += `<li>${parseInline(content)}</li>`; }
        continue;
      } else if (inList) { html += `</${listType}>`; inList = false; }

      if (t.length > 0) html += `<p>${parseInline(t)}</p>`;
    }
    if (inTable) html += renderTable(tableHeaders, tableRows);
    if (inList) html += `</${listType}>`;
    return html;
  }

  function parseRow(line) {
    let cells = line.split('|').map(c => c.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length-1] === '') cells.pop();
    return cells;
  }
  function renderTable(headers, rows) {
    let h = '<table><thead><tr>';
    headers.forEach(c => h += `<th>${parseInline(c)}</th>`);
    h += '</tr></thead><tbody>';
    rows.forEach(row => {
      h += '<tr>';
      row.forEach(cell => {
        if (cell.startsWith('- [')) {
          const checked = cell.startsWith('- [x]');
          h += `<td><input type="checkbox" ${checked?'checked':''} disabled> ${parseInline(cell.substring(5).trim())}</td>`;
        } else h += `<td>${parseInline(cell)}</td>`;
      });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }
  function parseInline(t) {
    let s = escapeHtml(t);
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`(.*?)`/g, '<code>$1</code>');
    s = s.replace(/-&gt;/g, '&rarr;');
    return s;
  }
  function escapeHtml(t) {
    if (typeof t !== 'string') return String(t);
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

});
