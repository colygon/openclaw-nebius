// ── Chat Deploy Assistant ─────────────────────────────────────────────────
'use strict';

const CHAT_FEATURED_MODELS = [
  { id: 'zai-org/GLM-5',          icon: '🧠', name: 'GLM-5',         desc: 'Latest generation reasoning model from Zhipu AI' },
  { id: 'MiniMaxAI/MiniMax-M2.5', icon: '⚡', name: 'MiniMax M2.5', desc: 'Fast, powerful open-source model' },
];

const CHAT_PROVIDERS = [
  { id: 'token-factory', icon: '🏭', name: 'Token Factory', desc: 'Nebius native inference API',      hint: 'v1.xxx...' },
  { id: 'openrouter',    icon: '🔀', name: 'OpenRouter',    desc: 'Unified API for AI models',       hint: 'sk-or-v1-xxx...' },
  { id: 'huggingface',   icon: '🤗', name: 'Hugging Face',  desc: 'HF Inference API — Nebius provider', hint: 'hf_xxx...' },
];

let cs = null; // current chat session
let chatGateway = null; // { type, name, ip, model, region, apiKey }
let inferenceMessages = []; // OpenAI-format conversation history

function autoResizeChatInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

// ── Gateway Chat Mode ─────────────────────────────────────────────────────

function selectChatGateway(value) {
  if (!value) {
    // Switch back to deploy assistant
    chatGateway = null;
    inferenceMessages = [];
    if (cs) { cs.active = false; cs = null; }
    initChat();
    return;
  }

  try {
    chatGateway = JSON.parse(value);
  } catch (e) { return; }

  inferenceMessages = [];
  if (cs) { cs.active = false; cs = null; }

  const feed = document.getElementById('chat-messages');
  if (feed) feed.innerHTML = '';

  const input = document.getElementById('chat-input');
  const send = document.getElementById('chat-send');
  if (input) { input.disabled = false; input.placeholder = `Message ${chatGateway.name || 'Gateway'}…`; }
  if (send) send.disabled = false;

  botMsgQueue = Promise.resolve();
  botMsg(`Connected to **${esc(chatGateway.name)}**${chatGateway.model ? ` (${esc(chatGateway.model)})` : ''}\n\nType a message to start chatting.`, 0);
}

async function sendInferenceMessage(text) {
  if (!chatGateway) return;

  userMsg(text);
  inferenceMessages.push({ role: 'user', content: text });

  // Create streaming bot bubble
  const feed = document.getElementById('chat-messages');
  const row = document.createElement('div');
  row.className = 'chat-row chat-row-bot';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bubble-bot chat-streaming';
  row.innerHTML = '<div class="chat-avatar">🦞</div>';
  row.appendChild(bubble);
  feed.appendChild(row);
  scrollChat();

  setInputMode(false);

  let fullContent = '';

  try {
    const res = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateway: chatGateway,
        messages: inferenceMessages,
        model: chatGateway.model
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      bubble.classList.remove('chat-streaming');
      bubble.classList.add('chat-error');
      bubble.textContent = err.error || 'Inference request failed';
      setInputMode(true, `Message ${chatGateway.name}…`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            bubble.innerHTML = esc(fullContent).replace(/\n/g, '<br>');
            scrollChat();
          }
        } catch (e) { /* skip malformed chunks */ }
      }
    }

    bubble.classList.remove('chat-streaming');
    if (!fullContent) {
      bubble.textContent = '(empty response)';
    }
    inferenceMessages.push({ role: 'assistant', content: fullContent });

  } catch (err) {
    bubble.classList.remove('chat-streaming');
    bubble.classList.add('chat-error');
    bubble.textContent = `Error: ${err.message}`;
  }

  setInputMode(true, `Message ${chatGateway.name}…`);
}

// ── Public entry point ─────────────────────────────────────────────────────

function initChat() {
  if (cs?.active) return;
  cs = {
    active: true,
    step: null,
    imageType: null,  imageName: null,  customImage: null,
    model: null,      modelName: null,
    target: 'cloud',  targetName: 'Serverless Cloud',
    region: null,     regionName: null,
    projectId: null,  projectName: null,
    platform: null,   platformName: null,
    platformPreset: null, platformPresetLabel: null,
    provider: 'token-factory', providerName: 'Token Factory', providerHint: 'v1.xxx...',
    apiKey: null,
    network: 'private', networkName: 'Private IP',
    endpointName: '',
    mbSecrets: null,
  };

  const feed = document.getElementById('chat-messages');
  if (feed) feed.innerHTML = '';
  setInputMode(false);

  (async () => {
    await botMsg("Hey! I'll walk you through deploying an AI agent 🦞\n\nYou can deploy to the cloud, run locally, or use Docker.\n\nTap an option or type its number at each step.\n\nFirst up — which agent image?");
    await loadAndShowAgents();
  })();
}

function resetChat() {
  if (cs) cs.active = false;
  cs = null;
  initChat();
}

// ── Rendering helpers ──────────────────────────────────────────────────────

let botMsgQueue = Promise.resolve();

function botMsg(text, delay = 350) {
  botMsgQueue = botMsgQueue.then(() => new Promise(resolve => {
    setTimeout(() => {
      const feed = document.getElementById('chat-messages');
      if (!feed) { resolve(); return; }
      const row = document.createElement('div');
      row.className = 'chat-row chat-row-bot';
      row.innerHTML = `<div class="chat-avatar">🦞</div>
        <div class="chat-bubble chat-bubble-bot">${esc(text).replace(/\n/g, '<br>')}</div>`;
      feed.appendChild(row);
      scrollChat();
      resolve();
    }, delay);
  }));
  return botMsgQueue;
}

function userMsg(text) {
  const feed = document.getElementById('chat-messages');
  if (!feed) return;
  const row = document.createElement('div');
  row.className = 'chat-row chat-row-user';
  row.innerHTML = `<div class="chat-bubble chat-bubble-user">${esc(text)}</div>`;
  feed.appendChild(row);
  scrollChat();
}

function showOptions(opts, onPick) {
  clearOptions();
  const feed = document.getElementById('chat-messages');
  if (!feed) return;
  const wrap = document.createElement('div');
  wrap.className = 'chat-options';
  opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'chat-opt';
    btn.dataset.num = opt.num;
    btn.innerHTML = `<span class="chat-opt-num">${opt.num}</span>` +
      `<span class="chat-opt-text">${esc(opt.label)}` +
      (opt.desc ? `<span class="chat-opt-desc"> — ${esc(opt.desc)}</span>` : '') +
      `</span>`;
    btn.onclick = () => { clearOptions(); clearMbRow(); onPick(opt); };
    wrap.appendChild(btn);
  });
  feed.appendChild(wrap);
  scrollChat();
}

function clearOptions() {
  document.querySelectorAll('.chat-options').forEach(el => el.remove());
}

function clearMbRow() {
  document.querySelectorAll('.chat-mb-row').forEach(el => el.remove());
}

function showTyping() {
  const feed = document.getElementById('chat-messages');
  if (!feed || feed.querySelector('#chat-typing')) return;
  const row = document.createElement('div');
  row.id = 'chat-typing';
  row.className = 'chat-row chat-row-bot';
  row.innerHTML = `<div class="chat-avatar">🦞</div>
    <div class="chat-bubble chat-bubble-bot chat-typing-dots"><span></span><span></span><span></span></div>`;
  feed.appendChild(row);
  scrollChat();
}

function hideTyping() {
  document.getElementById('chat-typing')?.remove();
}

function setInputMode(on, placeholder) {
  const input = document.getElementById('chat-input');
  const send  = document.getElementById('chat-send');
  if (!input) return;
  input.disabled = !on;
  if (send) send.disabled = !on;
  input.placeholder = on ? (placeholder || 'Type here…') : 'Pick an option above…';
  if (on) setTimeout(() => input.focus(), 50);
}

function scrollChat() {
  const feed = document.getElementById('chat-messages');
  if (feed) requestAnimationFrame(() => { feed.scrollTop = feed.scrollHeight; });
}

// ── State machine ──────────────────────────────────────────────────────────

async function loadAndShowAgents() {
  let imageOptions;
  try {
    const res = await authFetch('/api/images');
    const imgs = await res.json();
    imageOptions = Object.entries(imgs).map(([id, v], i) => ({
      num: i + 1, id, icon: v.icon, name: v.name, desc: v.description,
      label: `${v.icon} ${v.name}`,
    }));
  } catch (_) {
    imageOptions = [
      { num: 1, id: 'openclaw', label: '🦞 OpenClaw', desc: 'General-purpose agent — serverless CPU' },
      { num: 2, id: 'nemoclaw', label: '🔱 NemoClaw', desc: 'GPU-accelerated agent — H200 VM' },
      { num: 3, id: 'custom',   label: '📦 Custom',   desc: 'Use your own Docker image URL' },
    ];
  }
  cs.step = 'agent';
  showOptions(imageOptions, async (opt) => {
    userMsg(`${opt.num} — ${opt.label.replace(/^\S+\s/, '')}`);
    cs.imageType = opt.id;
    cs.imageName = opt.name || opt.label.replace(/^\S+\s/, '');
    if (opt.id === 'custom') {
      await botMsg('What\'s the Docker image URL for your agent?');
      setInputMode(true, 'docker.io/myuser/myagent:latest');
      cs.step = 'custom_image';
    } else {
      if (opt.id === 'nemoclaw') {
        await botMsg(`Using ${cs.imageName}.\n\n⚠️ NemoClaw requires at least 4 vCPU, 8 GB RAM, and 20 GB disk (16 GB RAM recommended). The image is ~2.4 GB compressed.\n\nNow pick a language model.`);
      } else {
        await botMsg(`Using ${cs.imageName}.\n\nNow pick a language model — this is the LLM the agent will use for reasoning and tool calls.`);
      }
      await stepModel();
    }
  });
}

async function stepModel() {
  cs.step = 'model';
  const opts = [
    ...CHAT_FEATURED_MODELS.map((m, i) => ({
      num: i + 1, id: m.id, name: m.name, label: `${m.icon} ${m.name}`, desc: m.desc,
    })),
    { num: CHAT_FEATURED_MODELS.length + 1, id: '_browse', label: '📋 Browse all models', desc: 'Fetch the full Token Factory list' },
  ];
  showOptions(opts, async (opt) => {
    userMsg(`${opt.num} — ${opt.label.replace(/^\S+\s/, '')}`);
    if (opt.id === '_browse') {
      await botMsg('Fetching all available models…');
      await stepModelBrowse();
      return;
    }
    cs.model = opt.id;
    cs.modelName = opt.name;
    await botMsg(`Using ${opt.name}.\n\nWhere do you want to run the agent?`);
    await stepTarget();
  });
}

async function stepModelBrowse() {
  showTyping();
  try {
    const res = await authFetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region: cs.region || '' }),
    });
    const models = await res.json();
    hideTyping();
    if (!Array.isArray(models) || models.length === 0) {
      await botMsg('No models found — falling back to featured models.');
      await stepModel(); return;
    }
    const PAGE = 20;
    const slice = models.slice(0, PAGE);
    await botMsg(`Here are the first ${slice.length} available models:`);
    cs.step = 'model_browse';
    showOptions(slice.map((m, i) => ({
      num: i + 1,
      id: m.id,
      name: m.id.split('/').pop(),
      label: m.id.split('/').pop(),
      desc: m.owned_by || '',
    })), async (opt) => {
      userMsg(`${opt.num} — ${opt.name}`);
      cs.model = opt.id;
      cs.modelName = opt.name;
      await botMsg(`Using ${opt.name}.\n\nWhere do you want to run the agent?`);
      await stepTarget();
    });
  } catch (_) {
    hideTyping();
    await botMsg('Couldn\'t fetch models. Let\'s use the featured ones.');
    await stepModel();
  }
}

async function stepRegion() {
  cs.step = 'region';
  const regionOpts = [
    { num: 1, id: 'eu-north1',   name: 'EU North (Finland)', label: '🇫🇮 EU North (Finland)' },
    { num: 2, id: 'eu-west1',    name: 'EU West (Paris)',     label: '🇫🇷 EU West (Paris)' },
    { num: 3, id: 'us-central1', name: 'US Central',          label: '🇺🇸 US Central' },
  ];
  showOptions(regionOpts, async (opt) => {
    userMsg(`${opt.num} — ${opt.name}`);
    cs.region = opt.id;
    cs.regionName = opt.name;
    await botMsg(`Region set to ${opt.name}. Let me check for projects…`);
    await stepProject();
  });
}

async function stepTarget() {
  cs.step = 'target';
  showOptions([
    { num: 1, id: 'cloud',  label: '☁️ Serverless Cloud', desc: 'Deploy to Nebius Cloud infrastructure' },
    { num: 2, id: 'local',  label: '💻 Local Computer',   desc: 'Run directly on this machine' },
    { num: 3, id: 'docker', label: '🐳 Docker Container', desc: 'Run in a local Docker container' },
  ], async (opt) => {
    userMsg(`${opt.num} — ${opt.label.replace(/^\S+\s/, '')}`);
    cs.target = opt.id;
    cs.targetName = opt.label.replace(/^\S+\s/, '');
    if (opt.id === 'cloud') {
      await botMsg('Cloud deployment.\n\nWhich region? Pick the one closest to your users for the lowest latency.');
      await stepRegion();
    } else {
      // Local / Docker — skip region, project, compute, network
      await botMsg(`${cs.targetName} selected.\n\nWhich provider holds your API key?`);
      await stepProvider();
    }
  });
}

async function stepProject() {
  cs.step = 'project';
  showTyping();
  try {
    const res = await authFetch(`/api/projects/${encodeURIComponent(cs.region)}`);
    const data = await res.json();
    hideTyping();
    const projects = data.projects || [];

    if (projects.length === 0) {
      await botMsg('No projects found in this region. A default project will be created during deployment.\n\nHow should the agent run? GPU gives you a dedicated VM with the model loaded locally. CPU is serverless and starts faster.');
      cs.projectId = null;
      cs.projectName = null;
      await stepPlatform();
      return;
    }

    await botMsg('Which project should the endpoint be deployed in?');
    showOptions(projects.map((p, i) => ({
      num: i + 1, id: p.id, name: p.name, label: p.name, desc: p.id,
    })), async (opt) => {
      userMsg(`${opt.num} — ${opt.name}`);
      cs.projectId = opt.id;
      cs.projectName = opt.name;
      await botMsg(`Using project "${opt.name}".\n\nHow should the agent run? GPU gives you a dedicated VM with the model loaded locally. CPU is serverless and starts faster.`);
      await stepPlatform();
    });
  } catch (_) {
    hideTyping();
    await botMsg('Couldn\'t load projects — a default one will be used.\n\nHow should the agent run?');
    cs.projectId = null;
    cs.projectName = null;
    await stepPlatform();
  }
}

async function stepPlatform() {
  cs.step = 'platform';
  showOptions([
    { num: 1, id: 'gpu', label: '⚡ GPU',      desc: 'Dedicated H200 VM — model runs locally, no API key needed' },
    { num: 2, id: 'cpu', label: '🖥️ CPU Only', desc: 'Serverless — fast cold start, uses your API provider' },
    { num: 3, id: 'custom', label: '⚙️ Custom', desc: 'Choose exact vCPUs, RAM and GPU model' },
  ], async (opt) => {
    userMsg(`${opt.num} — ${opt.label.replace(/^\S+\s/, '')}`);
    cs.platform = opt.id;
    cs.platformName = opt.label.replace(/^\S+\s/, '');
    if (opt.id === 'gpu') {
      await botMsg('GPU mode — the model runs directly on the VM. You can also add an API provider to use additional models alongside the local one.');
      await stepProvider();
    } else if (opt.id === 'cpu') {
      await botMsg('CPU serverless mode — the agent calls an external inference API for the model.\n\nWhich provider holds your API key?');
      await stepProvider();
    } else {
      await botMsg('Let me fetch the available compute configurations for that region…');
      await stepPlatformCustom();
    }
  });
}

async function stepPlatformCustom() {
  cs.step = 'platform_custom';
  showTyping();
  try {
    const res = await authFetch(`/api/platforms?region=${encodeURIComponent(cs.region || '')}`);
    const platforms = await res.json();
    hideTyping();

    const opts = [];
    for (const p of (platforms || [])) {
      const isGpu = p.id.startsWith('gpu-');
      const gpuModel = p.id.replace('gpu-', '').replace(/-[a-z]$/, '').toUpperCase();
      for (const pr of (p.presets || [])) {
        let label;
        if (isGpu) {
          label = `${gpuModel} — ${pr.gpu_count}× GPU, ${pr.vcpu} vCPUs, ${pr.memory_gib} GiB`;
        } else {
          label = `${p.id.replace('cpu-', 'CPU ').toUpperCase()} — ${pr.vcpu} vCPUs, ${pr.memory_gib} GiB`;
        }
        opts.push({ num: opts.length + 1, id: `${p.id}:${pr.name}`, label, isGpu });
      }
    }

    if (opts.length === 0) {
      await botMsg('No custom platforms available in this region. Falling back to CPU Only.');
      cs.platform = 'cpu'; cs.platformName = 'CPU Only';
      await stepProvider(); return;
    }

    await botMsg('Choose a compute configuration:');
    showOptions(opts, async (opt) => {
      userMsg(`${opt.num} — ${opt.label}`);
      cs.platformPreset = opt.id;
      cs.platformPresetLabel = opt.label;
      if (opt.isGpu) {
        await botMsg('GPU config set — the model runs locally. You can also add an API provider to use additional models alongside the local one.');
        await stepProvider();
      } else {
        await botMsg('CPU config set — the agent will call an external inference API.\n\nWhich provider holds your API key?');
        await stepProvider();
      }
    });
  } catch (_) {
    hideTyping();
    await botMsg('Couldn\'t load platform options — defaulting to CPU Only.');
    cs.platform = 'cpu'; cs.platformName = 'CPU Only';
    await stepProvider();
  }
}

async function stepProvider() {
  cs.step = 'provider';
  showOptions(CHAT_PROVIDERS.map((p, i) => ({
    num: i + 1, id: p.id, name: p.name, hint: p.hint,
    label: `${p.icon} ${p.name}`, desc: p.desc,
  })), async (opt) => {
    userMsg(`${opt.num} — ${opt.name}`);
    cs.provider = opt.id;
    cs.providerName = opt.name;
    cs.providerHint = opt.hint;
    await botMsg(`Using ${opt.name}.\n\nPaste your API key below, or pick a saved one from MysteryBox:`);
    await stepApiKey();
  });
}

async function stepApiKey() {
  cs.step = 'apikey';
  await loadAndShowMbSecrets();
  setInputMode(true, cs.providerHint || 'Paste API key…');
}

async function stepNetwork() {
  cs.step = 'network';
  await botMsg('Should the endpoint get a public or private IP?\n\nPrivate is recommended — it\'s more secure and doesn\'t use your limited public IP quota. You can still access it from the dashboard.');
  showOptions([
    { num: 1, id: 'private', label: '🔒 Private IP', desc: 'Internal network only (recommended)' },
    { num: 2, id: 'public',  label: '🌐 Public IP',  desc: 'Accessible from the internet' },
  ], async (opt) => {
    userMsg(`${opt.num} — ${opt.label.replace(/^\S+\s/, '')}`);
    cs.network = opt.id;
    cs.networkName = opt.id === 'public' ? 'Public IP' : 'Private IP';
    const netExplain = opt.id === 'private'
      ? 'Private IP — only reachable from within the Nebius network. More secure, and doesn\'t count against your public IP quota.'
      : 'Public IP — accessible from anywhere on the internet. Uses one of your public IPv4 addresses.';
    await botMsg(`${netExplain}\n\nLast step — give the endpoint a name, or press Enter to auto-generate one.`);
    await stepName();
  });
}

async function stepName() {
  cs.step = 'name';
  await botMsg('Enter a name for the endpoint, or press Enter to auto-generate one.');
  setInputMode(true, 'my-agent  (leave blank to auto-generate)');
}

async function stepConfirm() {
  cs.step = 'confirm';
  const isGpu = cs.platform === 'gpu' ||
    (cs.platform === 'custom' && cs.platformPreset?.startsWith('gpu-'));

  const isCloud = cs.target === 'cloud';
  const lines = [
    `Here's your deployment summary:\n`,
    `• Platform: ${cs.targetName}`,
    `• Agent: ${cs.imageName}`,
    cs.imageType === 'custom' ? `  Image: ${cs.customImage}` : null,
    `• Model: ${cs.modelName}`,
    isCloud ? `• Region: ${cs.regionName}` : null,
    isCloud && cs.projectName ? `• Project: ${cs.projectName}` : null,
    isCloud ? `• Compute: ${cs.platformName}${cs.platformPresetLabel ? ` (${cs.platformPresetLabel})` : ''}` : null,
    isCloud ? `• Network: ${cs.networkName}` : null,
    `• Provider: ${cs.providerName}`,
    `\nReady to deploy?`,
  ].filter(Boolean);

  await botMsg(lines.join('\n'));
  showOptions([
    { num: 1, id: 'deploy',   label: '🚀 Deploy now' },
    { num: 2, id: 'restart',  label: '🔄 Start over' },
  ], async (opt) => {
    userMsg(opt.num === 1 ? '1 — Deploy now' : '2 — Start over');
    if (opt.id === 'restart') { setTimeout(resetChat, 300); return; }
    await stepDeploy();
  });
}

async function stepDeploy() {
  cs.step = 'deploying';
  await botMsg('Deploying your endpoint… 🚀');
  showTyping();

  const isGpu = cs.platform === 'gpu' ||
    (cs.platform === 'custom' && cs.platformPreset?.startsWith('gpu-'));

  const body = {
    target:        cs.target,
    imageType:     cs.imageType,
    model:         cs.model,
    region:        cs.region,
    projectId:     cs.projectId,
    platform:      cs.platform,
    platformPreset: cs.platform === 'custom' ? cs.platformPreset : null,
    provider:      cs.provider,
    customImage:   cs.customImage || '',
    endpointName:  cs.endpointName || '',
    apiKey:        cs.apiKey || '',
    usePublicIp:   cs.network === 'public',
    storage:       cs.target === 'cloud' ? (cs.storage || null) : null,
    storageSize:   cs.target === 'cloud' && cs.storage ? (cs.storageSize || 100) : null,
  };

  try {
    const res = await authFetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    hideTyping();

    if (res.ok) {
      await botMsg(`Your endpoint is being created! 🎉\n\n📌 Name: ${data.name}\n📦 Image: ${data.image}\n\nRefresh Endpoints in ~60 seconds to see it running.`);
      showOptions([
        { num: 1, id: 'endpoints', label: '📡 View Endpoints' },
        { num: 2, id: 'again',     label: '🦞 Deploy another agent' },
      ], (opt) => {
        userMsg(opt.num === 1 ? '1 — View Endpoints' : '2 — Deploy another');
        if (opt.id === 'endpoints') { switchPage('endpoints'); }
        else { setTimeout(resetChat, 300); }
      });
      loadEndpoints();
    } else {
      await botMsg(`Deployment failed: ${data.error || 'Unknown error'}\n\nWant to retry?`);
      showOptions([
        { num: 1, id: 'retry',   label: '🔄 Retry' },
        { num: 2, id: 'restart', label: '↩️ Start over' },
      ], async (opt) => {
        userMsg(opt.num === 1 ? '1 — Retry' : '2 — Start over');
        if (opt.id === 'retry') await stepConfirm();
        else setTimeout(resetChat, 300);
      });
    }
  } catch (e) {
    hideTyping();
    await botMsg(`Network error: ${e.message}`);
  }
}

// ── Text input handler ─────────────────────────────────────────────────────

function chatSend() {
  const input = document.getElementById('chat-input');
  if (!input || input.disabled) return;
  const raw = input.value;
  const text = raw.trim();
  input.value = '';
  autoResizeChatInput(input);

  // Inference chat mode — send to gateway
  if (chatGateway && text) {
    sendInferenceMessage(text);
    return;
  }

  // Allow typing a number to pick an option
  const optBtns = document.querySelectorAll('.chat-opt');
  if (/^\d+$/.test(text) && optBtns.length > 0) {
    const n = parseInt(text, 10);
    const match = Array.from(optBtns).find(b => parseInt(b.dataset.num, 10) === n);
    if (match) { match.click(); return; }
  }

  switch (cs?.step) {
    case 'custom_image':
      if (!text) return;
      userMsg(text);
      setInputMode(false);
      cs.customImage = text;
      cs.imageName   = 'Custom (' + text.split('/').pop() + ')';
      (async () => {
        await botMsg('Custom image set.\n\nNow pick a language model — this is the LLM the agent will use for reasoning and tool calls.');
        await stepModel();
      })();
      break;

    case 'apikey':
      if (!text) return;
      userMsg('••••••••');
      setInputMode(false);
      clearMbRow();
      cs.apiKey = text;
      (async () => {
        await botMsg('API key saved.');
        if (cs.target === 'cloud') {
          await stepNetwork();
        } else {
          await botMsg('Last step — give the endpoint a name, or press Enter to auto-generate one.');
          await stepName();
        }
      })();
      break;

    case 'name':
      userMsg(text || '(auto-generate)');
      setInputMode(false);
      cs.endpointName = text;
      (async () => {
        await botMsg(text
          ? `Endpoint name set to "${text}". Let me show you the summary.`
          : 'Name will be auto-generated. Let me show you the summary.');
        await stepConfirm();
      })();
      break;
  }
}

// ── MysteryBox ─────────────────────────────────────────────────────────────

async function loadAndShowMbSecrets() {
  if (cs.mbSecrets === null) {
    try {
      const res = await authFetch('/api/secrets');
      const all = await res.json();
      cs.mbSecrets = (all || []).filter(s => s.state === 'ACTIVE');
    } catch (_) {
      cs.mbSecrets = [];
    }
  }
  if (!cs.mbSecrets.length) return;

  const feed = document.getElementById('chat-messages');
  if (!feed) return;
  clearMbRow();

  const row = document.createElement('div');
  row.className = 'chat-mb-row';
  row.innerHTML = '<span class="chat-mb-label">MysteryBox</span>';
  cs.mbSecrets.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'chat-mb-btn';
    btn.textContent = s.name || s.id;
    btn.dataset.id = s.id;
    btn.onclick = async () => {
      btn.textContent = '…'; btn.disabled = true;
      try {
        const r = await authFetch(`/api/secrets/${encodeURIComponent(s.id)}/payload`);
        if (!r.ok) { btn.textContent = 'no access'; return; }
        const payload = await r.json();
        const val = payload.TOKEN_API_KEY || payload.TOKEN_FACTORY_API_KEY
          || payload.OPENROUTER_API_KEY || payload.HUGGINGFACE_API_KEY
          || payload.HF_TOKEN || payload.api_key || Object.values(payload)[0] || '';
        if (!val) { btn.textContent = 'empty'; return; }
        cs.apiKey = val;
        clearOptions();
        clearMbRow();
        setInputMode(false);
        userMsg(`🔐 ${s.name || s.id} (from MysteryBox)`);
        await botMsg('API key loaded from MysteryBox.');
        if (cs.target === 'cloud') {
          await stepNetwork();
        } else {
          await botMsg('Last step — give the endpoint a name, or press Enter to auto-generate one.');
          await stepName();
        }
      } catch (_) {
        btn.textContent = 'error';
      }
    };
    row.appendChild(btn);
  });
  feed.appendChild(row);
  scrollChat();
}
