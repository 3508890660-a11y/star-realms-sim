const $ = selector => document.querySelector(selector);
const FACTIONS = { neutral: ['无阵营', '#91a4ba'], blob: ['虫群', '#73d68c'], machine: ['机械教团', '#e0b55f'], empire: ['星际帝国', '#79aefc'], federation: ['贸易联邦', '#e8e36f'] };
let options = { modes: [], expansions: [] };
const modeName = id => options.modes.find(mode => mode.id === id)?.name || id;
const modeConfig = id => options.modes.find(mode => mode.id === id) || { min: 2, max: 2 };
let snapshot = null;
let scripts = [];
let perspective = 'spectator';
let tournamentData = null;
let tourneyTab = 'board';
let tourneyParamsSynced = false;
let refreshSerial = 0;
let toastTimer;

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function toast(error) {
  const box = $('#toast');
  box.textContent = error.message || error;
  box.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.add('hidden'), 4000);
}

function setOffline(show, message) {
  const banner = $('#offlineBanner');
  if (!banner) return;
  banner.classList.toggle('hidden', !show);
  if (show) $('#offlineMessage').textContent = message || '无法连接 127.0.0.1:4397';
}

async function refresh() {
  const serial = ++refreshSerial;
  try {
    const data = await api(`/api/match?perspective=${perspective}`);
    if (serial !== refreshSerial) return;
    setOffline(false);
    snapshot = data;
    render();
  } catch (error) {
    const offline = error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(error.message || error));
    setOffline(true, offline
      ? '本地服务 127.0.0.1:4397 未启动或已断开，请运行 start-server.bat'
      : `读取对局数据失败：${error.message || error}`);
    toast(offline ? new Error('本地服务未连接：请运行 start-server.bat') : error);
  }
}

function actionsFor(predicate) {
  if (perspective === 'spectator' || !snapshot?.waitingForHuman) return [];
  return (snapshot.legalActions || []).filter(predicate);
}

function actionable(uid, zone) {
  return actionsFor(action =>
    ((zone === 'hand' || zone === 'inPlay') && action.cardId === uid) ||
    (zone === 'trade' && action.type === 'buy' && snapshot.state.tradeRow[action.row] === uid) ||
    (zone === 'base' && action.type === 'attack' && action.targetId === uid) ||
    (action.type === 'eventChoice' && [action.baseId, ...(action.targets || []), ...(action.cards || [])].includes(uid))
  );
}

function chooseActions(actions) {
  if (!actions.length) return;
  if (actions.length === 1) return perform(actions[0]);
  const box = $('#actionChoices');
  box.replaceChildren();
  for (const action of actions) {
    const button = document.createElement('button');
    button.className = 'action-choice';
    button.innerHTML = `<b>${escapeHtml(describe(action))}</b><small>${escapeHtml(JSON.stringify(action))}</small>`;
    button.onclick = () => { $('#actionDialog').close(); perform(action); };
    box.append(button);
  }
  $('#actionDialog').showModal();
}

async function perform(action) {
  try {
    await api('/api/action', { method: 'POST', body: JSON.stringify({ playerId: Number(perspective), action }) });
    await refresh();
  } catch (error) { toast(error); }
}

function describe(action) {
  const name = uid => snapshot.state.cards[uid]?.name || uid;
  const targets = (action.targets || []).map(name).join('、');
  switch (action.type) {
    case 'play': return `打出 ${name(action.cardId)}${action.copy ? `，复制 ${name(action.copy)}` : ''}${action.choice !== undefined ? `，效果选项 ${action.choice + 1}` : ''}`;
    case 'ability': return `${name(action.cardId)} · ${{ primary: '主要能力', optional: '可选能力', ally: '同盟能力', scrap: '销毁能力' }[action.ability]}${action.targetId ? ` → ${name(action.targetId)}` : ''}${action.row !== undefined ? ` → 交易行 ${action.row + 1}` : ''}${action.rows ? ` → 交易行 ${action.rows.map(row => row + 1).join('/')}` : ''}${targets ? ` → ${targets}` : ''}${action.resource ? `（${action.resource === 'combat' ? '战斗' : '贸易'}）` : ''}`;
    case 'buy': return action.explorer ? '以 2 贸易购买探索者' : `购买 ${name(snapshot.state.tradeRow[action.row])}`;
    case 'attack': return action.targetType === 'player' ? `攻击 ${snapshot.state.players[action.targetId].name}，造成 ${action.amount} 伤害` : `攻击 ${name(action.targetId)}，投入 ${action.amount} 战斗`;
    case 'transfer': return `向 ${snapshot.state.players[action.targetId].name} 预留 ${action.amount} ${action.resource === 'combat' ? '战斗' : '贸易'}`;
    case 'eventChoice': return action.pay ? '事件：选择失去 6 权威' : action.baseId ? `事件：摧毁 ${name(action.baseId)}` : action.cards ? `事件：按 ${action.cards.map(name).join(' → ')} 放回牌库顶` : `事件：${targets || '跳过'}`;
    case 'discard': return `弃掉 ${name(action.cardId)}`;
    case 'selectScrap': return `销毁 ${name(action.cardId)}`;
    case 'targetDiscard': return `指定 ${snapshot.state.players[action.targetId].name} 弃牌`;
    case 'endTurn': return '结束当前回合';
    default: return JSON.stringify(action);
  }
}

function cardElement(uid, zone = '', small = false) {
  const card = snapshot.state.cards[uid];
  if (!card) return document.createElement('span');
  const element = document.createElement('article');
  const actions = actionable(uid, zone);
  element.className = `${small ? 'base-chip' : 'game-card'}${actions.length ? ' actionable' : ''}`;
  const [faction, color] = FACTIONS[card.faction] || FACTIONS.neutral;
  element.style.setProperty('--faction', color);
  element.title = `${card.name} / ${card.en}\n${card.text || ''}`;
  if (small) {
    element.innerHTML = `<b>${escapeHtml(card.name)}</b><small>${card.outpost ? '前哨 · ' : ''}${faction}</small><span class="defense">${Math.max(0, card.defense - (snapshot.state.damage[uid] || 0))}/${card.defense}</span>`;
  } else {
    element.innerHTML = `${card.cost !== null ? `<span class="cost">${card.cost}</span>` : ''}<span class="faction">${faction} / ${card.factions?.join(' + ') || 'NEUTRAL'}</span><h3>${escapeHtml(card.name)}</h3><div class="en">${escapeHtml(card.en)}</div><div class="card-text">${escapeHtml(card.text)}</div><span class="type-tag">${card.type === 'base' ? 'BASE / 基地' : 'SHIP / 飞船'}</span>${card.outpost ? '<span class="outpost-tag">OUTPOST</span>' : ''}${card.defense ? `<span class="card-defense">DEF ${Math.max(0, card.defense - (snapshot.state.damage[uid] || 0))}</span>` : ''}`;
  }
  if (actions.length) element.onclick = () => chooseActions(actions);
  return element;
}

function render() {
  const s = snapshot.state;
  if (!s) return;
  const setName = (s.expansions?.sets || ['core']).join(' + ');
  $('#matchTitle').textContent = `${modeName(s.mode)} · ${setName}`;
  $('#turnLabel').textContent = `TURN ${String(s.turn).padStart(3, '0')}`;
  $('#seedLabel').textContent = `SEED ${s.seed}`;
  const eventBanner = $('#eventBanner');
  const eventActions = actionsFor(a => a.type === 'eventChoice');
  eventBanner.classList.toggle('hidden', !s.lastEvent);
  if (s.lastEvent) {
    eventBanner.innerHTML = `<div><span class="eyebrow">EVENT / 危机事件</span><strong>${escapeHtml(s.lastEvent.name)}</strong><small>${escapeHtml(s.lastEvent.text)}</small></div>${eventActions.length ? '<button id="eventChoiceBtn">选择事件响应</button>' : ''}`;
    if (eventActions.length) $('#eventChoiceBtn').onclick = () => chooseActions(eventActions);
  }
  $('#speedSelect').value = String(snapshot.speed);
  $('#liveBadge').classList.toggle('live', !snapshot.paused && s.status === 'playing');
  $('#liveBadge').innerHTML = `<i></i>${s.status === 'finished' ? '对局结束' : snapshot.paused ? '已暂停' : '模拟运行中'}`;
  $('#waitingBox').classList.toggle('hidden', !snapshot.waitingForHuman);
  $('#waitingBox').textContent = snapshot.waitingForHuman ? `等待 ${s.players[snapshot.actor].name} 决策` : '';
  $('#stepBtn').disabled = !snapshot.paused || snapshot.waitingForHuman || s.status !== 'playing';
  $('#actionCount').textContent = `${snapshot.history.length} ACTIONS`;
  renderPerspective();
  renderSeats();
  renderBoard();
  renderLog();
  const result = $('#resultBanner');
  result.classList.toggle('hidden', s.status !== 'finished');
  if (s.status === 'finished') result.innerHTML = `模拟结束 <b>${escapeHtml(s.players[s.winner].name)} 获胜</b> ${escapeHtml(s.winReason)} · ${snapshot.result.actions} 个动作`;
}

function renderPerspective() {
  const select = $('#perspectiveSelect');
  const old = perspective;
  select.replaceChildren(new Option('全局观战', 'spectator'));
  snapshot.config.players.forEach((player, i) => { if (player.script === 'human') select.append(new Option(`玩家视角 · ${player.name}`, String(i))); });
  if (![...select.options].some(option => option.value === old)) perspective = 'spectator';
  select.value = perspective;
}

function renderSeats() {
  const box = $('#seatList');
  box.replaceChildren();
  for (const player of snapshot.state.players) {
    const config = snapshot.config.players[player.id];
    const script = scripts.find(item => item.id === config.script);
    const item = document.createElement('div');
    item.className = `seat-item ${snapshot.actor === player.id && snapshot.state.status === 'playing' ? 'active' : ''} ${player.eliminated ? 'eliminated' : ''}`;
    const team = player.team === null ? '' : `<span class="team-tag team-${player.team}">${player.team === 0 ? '第一舰队' : '第二舰队'}</span>`;
    const reserve = player.reserve?.trade || player.reserve?.combat ? ` · 预留 ${player.reserve.trade}/${player.reserve.combat}` : '';
    item.innerHTML = `<div class="seat-top"><span class="seat-index">0${player.id + 1}</span><span class="seat-name">${escapeHtml(player.name)}</span>${team}<span class="authority">${player.authority}</span></div><div class="seat-meta"><span class="seat-script">${escapeHtml(script?.name || config.script)}</span><span>牌库 ${player.deckCount} · 手牌 ${player.handCount}${reserve}</span></div>`;
    box.append(item);
  }
}

function renderBoard() {
  const s = snapshot.state;
  const displayId = perspective === 'spectator' ? s.activePlayer : Number(perspective);
  const display = s.players[displayId];
  const opponents = $('#opponents');
  opponents.replaceChildren();
  for (const player of s.players.filter(p => p.id !== displayId)) {
    const panel = document.createElement('div');
    const attacks = actionsFor(a => a.type === 'attack' && a.targetType === 'player' && a.targetId === player.id);
    panel.className = `opponent ${attacks.length ? 'targetable' : ''}`;
    panel.innerHTML = `<div class="opponent-header"><strong>0${player.id + 1} ${escapeHtml(player.name)}</strong><span class="mini-resources">手牌 ${player.handCount} · 牌库 ${player.deckCount} · 弃牌 ${player.discard.length}</span><span class="authority">${player.authority} AUTH</span></div>`;
    if (attacks.length) panel.onclick = event => { if (event.target === panel || event.target.closest('.opponent-header')) chooseActions(attacks); };
    const bases = document.createElement('div');
    bases.className = 'base-line';
    const baseIds = player.inPlay.filter(uid => s.cards[uid]?.type === 'base');
    if (!baseIds.length) bases.innerHTML = '<span class="no-base">NO BASES DEPLOYED</span>';
    for (const uid of baseIds) bases.append(cardElement(uid, 'base', true));
    panel.append(bases);
    opponents.append(panel);
  }
  $('#deckCount').textContent = s.tradeDeckCount;
  const trade = $('#tradeRow');
  trade.replaceChildren();
  s.tradeRow.forEach((uid, row) => {
    if (!uid) return;
    const element = cardElement(uid, 'trade');
    const buys = actionsFor(a => a.type === 'buy' && a.row === row);
    element.onclick = buys.length ? () => chooseActions(buys) : null;
    trade.append(element);
  });
  const explorer = $('#explorerSlot');
  explorer.replaceChildren();
  const fake = document.createElement('article');
  const buys = actionsFor(a => a.type === 'buy' && a.explorer);
  fake.className = `game-card ${buys.length ? 'actionable' : ''}`;
  fake.style.setProperty('--faction', '#91a4ba');
  fake.innerHTML = `<span class="cost">2</span><span class="faction">无阵营</span><h3>探索者</h3><div class="en">EXPLORER</div><div class="card-text">获得 2 贸易。<br>销毁：获得 2 战斗。</div><span class="type-tag">SHIP / 飞船</span><span class="explorer-count">剩余 ${s.explorers}</span>`;
  if (buys.length) fake.onclick = () => perform(buys[0]);
  explorer.append(fake);

  $('#activeZoneLabel').textContent = `${display.name} · ${displayId === s.activePlayer ? '当前行动阵线' : '玩家阵线'}`;
  const board = $('#activeBoard');
  board.replaceChildren();
  for (const uid of display.inPlay.filter(uid => s.cards[uid]?.type === 'base')) board.append(cardElement(uid, 'inPlay', true));
  if (!display.inPlay.some(uid => s.cards[uid]?.type === 'base')) board.innerHTML = '<span class="no-base">基地部署区为空</span>';
  $('#resourceBar').innerHTML = `<span class="resource-pill trade">贸易 ${display.trade}</span><span class="resource-pill combat">战斗 ${display.combat}</span><span class="resource-pill authority">权威 ${display.authority}</span>`;
  const hand = $('#handRow');
  hand.replaceChildren();
  const ships = display.inPlay.filter(uid => s.cards[uid]?.type === 'ship');
  for (const uid of ships) hand.append(cardElement(uid, 'inPlay'));
  for (const uid of display.hand) hand.append(cardElement(uid, 'hand'));
  const endActions = actionsFor(a => a.type === 'endTurn');
  const transfers = actionsFor(a => a.type === 'transfer');
  if (transfers.length) {
    const transfer = document.createElement('button');
    transfer.className = 'end-turn actionable';
    transfer.textContent = '向队友预留资源';
    transfer.onclick = () => chooseActions(transfers);
    hand.append(transfer);
  }
  if (endActions.length) {
    const end = document.createElement('button');
    end.className = 'end-turn actionable';
    end.textContent = '结束回合';
    end.onclick = () => perform(endActions[0]);
    hand.append(end);
  }
  if (!ships.length && !display.hand.length && !endActions.length && !transfers.length) hand.innerHTML = '<span class="no-base">该视角没有可见手牌</span>';
}

function renderLog() {
  const log = $('#eventLog');
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  log.replaceChildren();
  for (const record of [...snapshot.history].reverse()) {
    const item = document.createElement('div');
    item.className = 'log-entry';
    item.innerHTML = `<div class="log-head"><span class="log-index">#${String(record.index).padStart(4, '0')}</span><span class="log-player">P${record.playerId + 1}</span><span class="log-time">${record.durationMs}ms</span></div><div class="log-action">${escapeHtml(record.description)}</div>${record.events.filter(e => !['resource', 'draw', 'allyReady'].includes(e.type)).map(e => `<div class="log-event ${e.type}">${escapeHtml(e.message)}</div>`).join('')}`;
    log.append(item);
  }
  if (atBottom) log.scrollTop = 0;
}

/**
 * 锦标赛面板的牌包勾选框改由 /api/options 动态生成，
 * 这样新增扩展（Frontiers / 危机小扩）不必再手改 HTML。
 */
function renderTourneySets() {
  for (const id of ['#tourneySets', '#teamTourneySets']) {
    const box = $(id);
    if (!box) continue;
    const checked = new Set([...box.querySelectorAll('input:checked')].map(input => input.value));
    if (!checked.size) checked.add('core');
    box.replaceChildren();
    const label = document.createElement('span');
    label.textContent = '牌包';
    box.append(label);
    for (const pack of options.expansions) {
      const item = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = pack.id;
      input.checked = checked.has(pack.id);
      item.append(input, document.createTextNode(pack.name));
      box.append(item);
    }
  }
}

function renderOptions() {
  const modeBox = $('#modeChoices');
  modeBox.replaceChildren();
  for (const [index, mode] of options.modes.entries()) {
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="mode" value="${mode.id}" ${index === 0 ? 'checked' : ''}><span><b>${escapeHtml(mode.name)}</b><small>${escapeHtml(mode.description)}</small></span>`;
    label.querySelector('input').onchange = () => {
      const config = modeConfig(mode.id);
      const countSelect = $('#playerCount');
      countSelect.replaceChildren();
      for (let n = config.min; n <= config.max; n++) countSelect.append(new Option(`${n} 人`, String(n)));
      countSelect.value = String(config.min);
      renderSeatEditors();
    };
    modeBox.append(label);
  }
  const expansionBox = $('#expansionChoices');
  expansionBox.replaceChildren();
  for (const pack of options.expansions) {
    const label = document.createElement('label');
    label.className = `expansion-choice ${pack.kind}`;
    label.innerHTML = `<input type="checkbox" value="${pack.id}" ${pack.default ? 'checked' : ''}><span><b>${escapeHtml(pack.name)}</b><small>${pack.cards} 张 · ${escapeHtml(pack.description)}</small></span>`;
    expansionBox.append(label);
  }
  renderSeatEditors();
}

function renderSeatEditors() {
  const mode = document.querySelector('input[name=mode]:checked')?.value || 'standard';
  const config = modeConfig(mode);
  const count = config.min === config.max ? config.min : Number($('#playerCount').value || config.min);
  $('#playerCountWrap').classList.toggle('hidden', config.min === config.max);
  const box = $('#seatEditors');
  const previous = [...box.querySelectorAll('.seat-editor')].map(row => ({ name: row.querySelector('input').value, script: row.querySelector('select').value }));
  box.replaceChildren();
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'seat-editor';
    const input = document.createElement('input');
    input.value = previous[i]?.name || `座位 ${i + 1}`;
    input.maxLength = 20;
    const select = document.createElement('select');
    select.append(new Option('人类座位', 'human'));
    for (const script of scripts.filter(s => !s.error)) select.append(new Option(script.name, script.id));
    select.value = previous[i]?.script || ['tactical', 'economic', 'random', 'tactical'][i];
    row.append(input, select);
    box.append(row);
  }
}

async function createMatch(event) {
  event.preventDefault();
  const mode = document.querySelector('input[name=mode]:checked').value;
  const sets = [...$('#expansionChoices').querySelectorAll('input:checked')].map(input => input.value);
  const players = [...$('#seatEditors').querySelectorAll('.seat-editor')].map(row => ({ name: row.querySelector('input').value.trim() || '未命名座位', script: row.querySelector('select').value }));
  try {
    await api('/api/match', { method: 'POST', body: JSON.stringify({ mode, seed: $('#seedInput').value, players, expansions: { sets }, autoRun: $('#autoRunInput').checked, speed: Number($('#setupSpeed').value) }) });
    perspective = players[0].script === 'human' ? '0' : 'spectator';
    $('#setupDialog').close();
    await refresh();
  } catch (error) { toast(error); }
}

let subagentsData = null;
let selectedAgentId = 'hy4';

function statusLabel(status) {
  return { queued: '排队中', running: '进行中', completed: '已完成', error: '异常' }[status] || status;
}

async function refreshSubagents() {
  try {
    subagentsData = await api('/api/subagents');
    const summary = subagentsData.summary;
    $('#subagentBadge').textContent = `${summary.completed}/${summary.total}`;
    const verified = subagentsData.agents.filter(agent => agent.modelVerified).length;
    $('#factorySummary').textContent = `已完成 ${summary.completed} · 进行中 ${summary.running} · 排队 ${summary.queued} · 异常 ${summary.errors} · 模型 ID 已验证 ${verified}/${summary.total}`;
    $('#factoryUpdated').textContent = new Date(subagentsData.updatedAt).toLocaleTimeString();
    if ($('#subagentsDialog').open) renderSubagents();
  } catch (error) { $('#factorySummary').textContent = `进度读取失败：${error.message}`; }
}

function renderSubagents() {
  if (!subagentsData) return;
  const box = $('#subagentsList');
  box.replaceChildren();
  for (const agent of subagentsData.agents) {
    const row = document.createElement('div');
    row.className = `agent-row ${agent.id === selectedAgentId ? 'selected' : ''}`;
    const modelLabel = `${escapeHtml(agent.model)}${agent.modelId ? ` · ${escapeHtml(agent.modelId)}` : ''}${agent.modelVerified ? ' · 已验证' : ''}`;
    row.innerHTML = `<div class="agent-row-head"><b>${escapeHtml(agent.name)}</b><span class="agent-model">${modelLabel}</span><span class="agent-status ${escapeHtml(agent.status)}">${statusLabel(agent.status)}</span></div><div class="agent-progress"><i style="width:${Number(agent.progress) || 0}%"></i></div><div class="agent-meta"><span>${escapeHtml(agent.phase)} · ${Number(agent.progress) || 0}%</span><span>${escapeHtml(agent.file)}${agent.fileExists ? ' · 已落盘' : ''}</span></div><div class="agent-note">${escapeHtml(agent.note || agent.strategy || '等待阶段摘要…')}</div>`;
    row.onclick = () => { selectedAgentId = agent.id; renderSubagents(); };
    box.append(row);
  }
  const selected = subagentsData.agents.find(agent => agent.id === selectedAgentId) || subagentsData.agents[0];
  $('#designTitle').textContent = `${selected.model}${selected.modelId ? ` (${selected.modelId})` : ''} · ${selected.name}`;
  $('#designNote').textContent = selected.designNote || `${selected.strategy}\n\n该模型尚未写入公开设计说明。`;
}

const pct = value => `${(Number(value || 0) * 100).toFixed(2)}%`;
const modelOf = (result, id) => result?.entrants?.find(entry => entry.id === id)?.model || id;
const strategyOf = (result, id) => result?.entrants?.find(entry => entry.id === id)?.strategy || '';

async function refreshTournament() {
  try {
    tournamentData = await api('/api/tournament');
    renderTournament();
  } catch (error) {
    $('#tourneySummary').innerHTML = `<div class="tourney-empty">读取失败：${escapeHtml(error.message)}</div>`;
  }
}

function boString(match, result) {
  const half = (match.games?.length || 0) / 2;
  const first = match.games.slice(0, half).map(g => g.winnerId === match.a ? 'A' : 'B').join('');
  const second = match.games.slice(half).map(g => g.winnerId === match.a ? 'A' : 'B').join('');
  return `<div><b>${escapeHtml(modelOf(result, match.a))}</b> ${match.aWins}:${match.bWins} <b>${escapeHtml(modelOf(result, match.b))}</b> · <em>[A先 ${first} | B先 ${second}]</em>${match.rematch ? ' · 重赛' : ''}</div>`;
}

// 牌包容器按 id 优先、class 兜底，避免标记改动导致永远取不到勾选项。
function tourneySetInputs() {
  const box = document.querySelector('#tourneySets') || document.querySelector('.tourney-sets');
  return box ? [...box.querySelectorAll('input[type=checkbox]')] : [];
}

function syncTourneyParams(cfg) {
  if (tourneyParamsSynced || !cfg) return;
  tourneyParamsSynced = true;
  if (cfg.masterSeed) $('#tourneySeed').value = cfg.masterSeed;
  const choose = (selector, value) => {
    const element = $(selector);
    if (value !== undefined && [...element.options].some(option => option.value === String(value))) element.value = String(value);
  };
  choose('#tourneySeasons', cfg.seasons);
  choose('#tourneyRounds', cfg.rounds);
  choose('#tourneyPerSide', cfg.perSide);
  for (const input of tourneySetInputs()) input.checked = (cfg.sets || []).includes(input.value);
}

function renderTournament() {
  const data = tournamentData;
  if (!data) return;
  const { progress, result, running } = data;
  const cfg = result?.config || progress?.config || {};
  syncTourneyParams(result?.config || progress?.config);
  const audit = result?.audit || {};
  const total = progress?.totalGames || audit.totalGames || 0;
  const played = progress?.playedGames ?? audit.playedGames ?? 0;
  const percent = total ? Math.min(100, Math.round(played / total * 100)) : 0;

  $('#tourneyBadge').textContent = running ? '进行中' : result ? '已完赛' : '未开始';
  $('#tourneySummary').innerHTML = [
    ['赛制', `${cfg.seasons ?? '—'} 届 × ${cfg.rounds ?? '—'} 轮`, `每场 BO${cfg.bo ?? '—'}`],
    ['主种子', escapeHtml(cfg.masterSeed || '—'), '同种子可完整复现'],
    ['牌包', escapeHtml((cfg.sets || []).join(' + ') || '—'), '标准双人 1v1'],
    ['对局总量', `${played} / ${total}`, `每脚本 ${audit.perEntrantGames ?? '—'} 局`],
    ['重赛 / 重试', `${audit.rematches ?? 0} / ${audit.retries ?? 0}`, '零重赛为目标'],
    ['耗时', audit.elapsedMs ? `${(audit.elapsedMs / 1000).toFixed(1)}s` : '—', result?.generatedAt ? new Date(result.generatedAt).toLocaleString() : '']
  ].map(([label, value, note]) => `<div class="tile"><span>${label}</span><b>${value}</b><small>${note}</small></div>`).join('');

  const live = (progress?.standings || []).slice(0, 6).map(row => `${row.rank}. ${escapeHtml(modelOf(result, row.id))} ${row.mp}MP/${row.gameWins}GP`).join(' · ');
  $('#tourneyProgress').innerHTML = `<div class="progress-head"><span>状态：<b>${running ? '实时推进中' : progress?.status === 'completed' ? '已完成' : progress?.status === 'error' ? '异常中止' : '等待启动'}</b></span><span class="mono">${percent}% · ${played}/${total} 局</span></div><div class="bar"><i style="width:${percent}%"></i></div><div class="now">当前：第 ${progress?.season ?? '—'} 届 / 第 ${progress?.round ?? '—'} 轮 / 第 ${progress?.currentMatch?.match ?? '—'} 场${progress?.currentMatch ? `（${escapeHtml(progress.currentMatch.a)} vs ${escapeHtml(progress.currentMatch.b)}）` : ''}<br>最近一局：${progress?.lastGame ? `${escapeHtml(progress.lastGame.first)} 先手 · 胜者 <b>${escapeHtml(progress.lastGame.winner)}</b> · <span class="mono">${escapeHtml(progress.lastGame.seed)}</span>` : '—'}<br>实时积分榜：${live || '—'}${progress?.error ? `<br>错误：${escapeHtml(progress.error)}` : ''}</div>`;

  const champ = result?.champion;
  const st = result?.stats || {};
  const hasStats = Array.isArray(st.championCI95);
  const stale = running && progress?.startedAt && result?.generatedAt && Date.parse(result.generatedAt) < Date.parse(progress.startedAt);
  const staleNote = stale ? `<span class="stat" style="color:var(--gold)">新赛进行中，下方榜单与冠军为上一届结果；完成后自动刷新</span>` : '';
  $('#tourneyChampion').innerHTML = champ
    ? `${staleNote}<span class="crown">CHAMPION · ${stale ? '上一届' : '本赛'}聚合总榜第一</span><span class="who">${escapeHtml(champ.model)}</span><span class="stat">局胜率 <b>${pct(champ.gameRate)}</b> · 局胜 <b>${champ.gameWins}/${champ.games}</b> · 累计场分 <b>${champ.mp}</b> · 平均名次 <b>${champ.avgRank}</b> · 夺冠 <b>${champ.titles}/${cfg.seasons ?? '—'}</b></span>` +
      (hasStats ? `<span class="stat">95% CI <b>[${pct(st.championCI95[0])}, ${pct(st.championCI95[1])}]</b> · 领先亚军 <b>${(st.rateGap * 100).toFixed(2)}pp</b> · z=<b>${st.zScore}</b> · ${st.significant95 ? '差异达到 95% 显著' : '差异未达 95% 显著'}</span><span class="stat">先手方总胜率 <b>${pct(st.firstSideRate)}</b> · 各届冠军 ${escapeHtml(Object.entries(st.championTitles || {}).map(([k, v]) => `${k}×${v}`).join('、'))}</span>` : `<span class="stat">统计口径将在本赛结束后生成（Wilson 95% CI、冠亚 z 检验、先后手核对）</span>`) +
      `<span class="script">${escapeHtml(champ.script)} · ${escapeHtml(champ.strategy || '')}</span>`
    : `<span class="stat">尚无结果：设置参数后点击「启动新赛」，或在命令行运行 <span class="mono">node src/tourney-cli.js --seed ...</span></span>`;

  for (const [id, tab] of [['#tourneyTabBoard', 'board'], ['#tourneyTabSeasons', 'seasons'], ['#tourneyTabRounds', 'rounds']]) $(id).classList.toggle('active', tourneyTab === tab);
  const box = $('#tourneyBody');
  if (!result) { box.innerHTML = '<div class="tourney-empty">暂无锦标赛结果</div>'; return; }

  if (tourneyTab === 'board') {
    box.innerHTML = `<table><thead><tr><th>名次</th><th>模型</th><th>策略</th><th>夺冠</th><th>平均名次</th><th>局胜率</th><th>局胜/总局</th><th>累计场分</th><th>先手胜率</th><th>后手胜率</th><th>平均 Buchholz</th></tr></thead><tbody>${result.aggregate.map(row => `<tr class="${row.rank === 1 ? 'champion' : ''}"><td class="rank">${String(row.rank).padStart(2, '0')}</td><td class="model">${escapeHtml(modelOf(result, row.id))}</td><td>${escapeHtml(strategyOf(result, row.id))}</td><td>${row.titles}/${cfg.seasons}</td><td>${row.avgRank}</td><td class="rate">${pct(row.gameRate)}</td><td>${row.gameWins}/${row.games}</td><td>${row.mp}</td><td>${pct(row.firstRate)}</td><td>${pct(row.secondRate)}</td><td>${row.avgBuchholz}</td></tr>`).join('')}</tbody></table>`;
  } else if (tourneyTab === 'seasons') {
    box.innerHTML = result.seasons.map(season => `<div class="season-block"><h4>第 ${season.index} 届 · 种子 ${escapeHtml(season.seed)} · 冠军 ${escapeHtml(modelOf(result, season.champion))} · ${season.audit.games} 局</h4><table><thead><tr><th>名次</th><th>模型</th><th>场分 MP</th><th>局胜 GP</th><th>局胜率</th><th>胜/平/负</th><th>Buchholz</th><th>SB</th></tr></thead><tbody>${season.standings.map(row => `<tr class="${row.rank === 1 ? 'champion' : ''}"><td class="rank">${String(row.rank).padStart(2, '0')}</td><td class="model">${escapeHtml(modelOf(result, row.id))}</td><td>${row.mp}</td><td>${row.gameWins}</td><td>${pct(row.gameRate)}</td><td>${row.matchWins}/${row.matchDraws}/${row.matchLosses}</td><td>${row.buchholz}</td><td>${row.sb}</td></tr>`).join('')}</tbody></table></div>`).join('');
  } else {
    box.innerHTML = result.seasons.map(season => `<div class="season-block"><h4>第 ${season.index} 届 · ${escapeHtml(season.seed)}</h4>${season.rounds.map(round => `<div class="round-title">第 ${round.round} 轮 · 配对顺序 ${escapeHtml(round.order.map(id => modelOf(result, id)).join(' → '))}${round.bye ? ` · 轮空 ${escapeHtml(modelOf(result, round.bye))}` : ''}</div><div class="bo-grid">${round.pairs.map(match => boString(match, result)).join('')}</div>`).join('')}</div>`).join('');
  }
}

async function startTournament() {
  const inputs = tourneySetInputs();
  const sets = inputs.filter(input => input.checked).map(input => input.value);
  if (!inputs.length) sets.push('core'); // 容器缺失时仍可用基础盒启动，不让界面彻底失效
  if (!sets.length) { toast(new Error('至少勾选一个牌包')); return; }
  const button = $('#tourneyStart');
  button.disabled = true;
  $('#tourneyStartHint').textContent = '正在启动…';
  try {
    const payload = {
      seed: $('#tourneySeed').value.trim() || `swiss-${Date.now()}`,
      seasons: Number($('#tourneySeasons').value),
      rounds: Number($('#tourneyRounds').value),
      perSide: Number($('#tourneyPerSide').value),
      sets
    };
    const response = await api('/api/tournament/start', { method: 'POST', body: JSON.stringify(payload) });
    $('#tourneyStartHint').textContent = `已启动 ${response.runId}（${response.config.seasons} 届 × ${response.config.rounds} 轮 · BO${response.config.perSide * 2}）`;
    await refreshTournament();
  } catch (error) {
    $('#tourneyStartHint').textContent = `启动失败：${error.message}`;
    toast(error);
  } finally { button.disabled = false; }
}

$('#tournamentBtn').onclick = async () => { await refreshTournament(); $('#tournamentDialog').showModal(); };
$('#closeTournament').onclick = () => $('#tournamentDialog').close();
$('#tourneyRefresh').onclick = refreshTournament;
$('#tourneyStart').onclick = startTournament;
for (const [id, tab] of [['#tourneyTabBoard', 'board'], ['#tourneyTabSeasons', 'seasons'], ['#tourneyTabRounds', 'rounds']]) {
  $(id).onclick = () => { tourneyTab = tab; renderTournament(); };
}

// ---------- 2V2 组队瑞士轮 ----------
let teamTournamentData = null;
let teamTourneyTab = 'board';
let teamParamsSynced = false;

const teamNameOf = (result, id) => result?.teams?.find(team => team.id === id)?.name || id;

function teamSetInputs() {
  const box = document.querySelector('#teamTourneySets') || document.querySelector('#teamTournamentDialog .tourney-sets');
  return box ? [...box.querySelectorAll('input[type=checkbox]')] : [];
}

async function refreshTeamTournament() {
  try {
    teamTournamentData = await api('/api/team-tournament');
    renderTeamTournament();
  } catch (error) {
    $('#teamTourneySummary').innerHTML = `<div class="tourney-empty">读取失败：${escapeHtml(error.message)}</div>`;
  }
}

function syncTeamParams(cfg) {
  if (teamParamsSynced || !cfg) return;
  teamParamsSynced = true;
  if (cfg.masterSeed) $('#teamTourneySeed').value = cfg.masterSeed;
  const choose = (selector, value) => {
    const element = $(selector);
    if (value !== undefined && [...element.options].some(option => option.value === String(value))) element.value = String(value);
  };
  choose('#teamTourneySeasons', cfg.seasons);
  choose('#teamTourneyRounds', cfg.rounds);
  choose('#teamTourneyRepeats', cfg.repeats);
  for (const input of teamSetInputs()) input.checked = (cfg.sets || []).includes(input.value);
}

function teamBoString(match, result) {
  const front = match.games.filter(g => g.first === match.a).map(g => g.winnerId === match.a ? 'A' : 'B').join('');
  const back = match.games.filter(g => g.first === match.b).map(g => g.winnerId === match.a ? 'A' : 'B').join('');
  return `<div><b>${escapeHtml(teamNameOf(result, match.a))}</b> ${match.aWins}:${match.bWins} <b>${escapeHtml(teamNameOf(result, match.b))}</b> · <em>[A前 ${front} | B前 ${back}]</em>${match.rematch ? ' · 重赛' : ''}</div>`;
}

function renderTeamTournament() {
  const data = teamTournamentData;
  if (!data) return;
  const { progress, result, running } = data;
  const cfg = result?.config || progress?.config || {};
  syncTeamParams(result?.config || progress?.config);
  const audit = result?.audit || {};
  const total = progress?.totalGames || audit.totalGames || 0;
  const played = progress?.playedGames ?? audit.playedGames ?? 0;
  const percent = total ? Math.min(100, Math.round(played / total * 100)) : 0;
  const teams = data.teams || result?.teams || [];

  $('#teamTourneyBadge').textContent = running ? '进行中' : result ? '已完赛' : '未开始';
  $('#teamTourneySummary').innerHTML = [
    ['赛制', `${teams.length || 6} 队 × ${cfg.rounds ?? '—'} 轮`, `每场 BO${cfg.bo ?? 8} · ${cfg.seasons ?? '—'} 届`],
    ['主种子', escapeHtml(cfg.masterSeed || '—'), '同种子可完整复现'],
    ['牌包', escapeHtml((cfg.sets || []).join(' + ') || '—'), 'team2v2 · 共享 75 权威'],
    ['对局总量', `${played} / ${total}`, `每队 ${audit.perTeamGames ?? '—'} 局`],
    ['重赛 / 重试', `${audit.rematches ?? 0} / ${audit.retries ?? 0}`, '零重赛为目标'],
    ['座位配平', statsBalanced(result) ? '通过' : '—', `前位队胜率 ${pct(result?.stats?.frontSideRate ?? 0)}`]
  ].map(([label, value, note]) => `<div class="tile"><span>${label}</span><b>${value}</b><small>${note}</small></div>`).join('');

  const champId = result?.champion?.id;
  $('#teamTourneyTeams').innerHTML = teams.map(team => `<div class="team-card ${team.id === champId ? 'champion' : ''}"><div class="team-head"><span class="team-name">${escapeHtml(team.name)}</span><span class="team-kind ${team.kind === 'mixed' ? 'mixed' : ''}">${team.kind === 'mixed' ? '混编' : '同厂'}</span></div><div class="team-vendor">${escapeHtml(team.vendor || '')}</div>${team.players.map(player => `<div class="member"><span>${escapeHtml(player.model)}</span><small>${escapeHtml(String(player.strategy || '').replace('模型自选：', ''))}</small></div>`).join('')}</div>`).join('') || '<div class="tourney-empty">队伍构成读取中…</div>';

  const live = (progress?.standings || []).slice(0, 6).map(row => `${row.rank}. ${escapeHtml(teamNameOf(result, row.id))} ${row.mp}MP/${row.gameWins}GP`).join(' · ');
  $('#teamTourneyProgress').innerHTML = `<div class="progress-head"><span>状态：<b>${running ? '实时推进中' : progress?.status === 'completed' ? '已完成' : progress?.status === 'error' ? '异常中止' : '等待启动'}</b></span><span class="mono">${percent}% · ${played}/${total} 局</span></div><div class="bar"><i style="width:${percent}%"></i></div><div class="now">当前：第 ${progress?.season ?? '—'} 届 / 第 ${progress?.round ?? '—'} 轮 / 第 ${progress?.currentMatch?.match ?? '—'} 场${progress?.currentMatch ? `（${escapeHtml(progress.currentMatch.a)} vs ${escapeHtml(progress.currentMatch.b)}）` : ''}<br>最近一局：${progress?.lastGame ? `${escapeHtml(progress.lastGame.front)} 占前位 · 胜者 <b>${escapeHtml(progress.lastGame.winner)}</b>` : '—'}<br>实时积分榜：${live || '—'}${progress?.error ? `<br>错误：${escapeHtml(progress.error)}` : ''}</div>`;

  const champ = result?.champion;
  const st = result?.stats || {};
  const stale = running && progress?.startedAt && result?.generatedAt && Date.parse(result.generatedAt) < Date.parse(progress.startedAt);
  $('#teamTourneyChampion').innerHTML = champ
    ? `${stale ? '<span class="stat" style="color:var(--gold)">新赛进行中，下方榜单与冠军为上一届结果；完成后自动刷新</span>' : ''}<span class="crown">CHAMPION · ${stale ? '上一届' : '本赛'}聚合总榜第一</span><span class="who">${escapeHtml(champ.name)}</span><span class="stat">${escapeHtml(champ.players.map(p => p.model).join(' + '))} · 局胜率 <b>${pct(champ.gameRate)}</b> · 局胜 <b>${champ.gameWins}/${champ.games}</b> · 累计场分 <b>${champ.mp}</b> · 平均名次 <b>${champ.avgRank}</b> · 夺冠 <b>${champ.titles}/${cfg.seasons ?? '—'}</b></span>` +
      (Array.isArray(st.championCI95) ? `<span class="stat">95% CI <b>[${pct(st.championCI95[0])}, ${pct(st.championCI95[1])}]</b> · 领先亚军 <b>${((st.rateGap || 0) * 100).toFixed(2)}pp</b> · z=<b>${st.zScore}</b> · ${st.significant95 ? '差异达到 95% 显著' : '差异未达 95% 显著'}</span><span class="stat">前位队总胜率 <b>${pct(st.frontSideRate)}</b> · 座位配平 <b>${st.seatBalanced ? '通过' : '未通过'}</b></span>` : '<span class="stat">统计口径将在本赛结束后生成</span>')
    : '<span class="stat">尚无结果：设置参数后点击「启动新赛」</span>';

  for (const [id, tab] of [['#teamTabBoard', 'board'], ['#teamTabSeasons', 'seasons'], ['#teamTabRounds', 'rounds'], ['#teamTabMembers', 'members']]) $(id).classList.toggle('active', teamTourneyTab === tab);
  const box = $('#teamTourneyBody');
  if (!result) { box.innerHTML = '<div class="tourney-empty">暂无组队赛结果</div>'; return; }

  if (teamTourneyTab === 'board') {
    box.innerHTML = `<table><thead><tr><th>名次</th><th>队伍</th><th>类型</th><th>队员</th><th>夺冠</th><th>平均名次</th><th>局胜率</th><th>局胜/总局</th><th>累计 MP</th><th>前位 / 后位</th><th>平均 Buchholz</th></tr></thead><tbody>${result.aggregate.map(row => {
      const team = result.teams.find(t => t.id === row.id);
      return `<tr class="${row.rank === 1 ? 'champion' : ''}"><td class="rank">${String(row.rank).padStart(2, '0')}</td><td class="model">${escapeHtml(team.name)}</td><td>${team.kind === 'mixed' ? '混编' : '同厂'}</td><td>${escapeHtml(team.players.map(p => p.model).join(' + '))}</td><td>${row.titles}/${cfg.seasons}</td><td>${row.avgRank}</td><td class="rate">${pct(row.gameRate)}</td><td>${row.gameWins}/${row.games}</td><td>${row.mp}</td><td>${pct(row.firstRate)} / ${pct(row.secondRate)}</td><td>${row.avgBuchholz}</td></tr>`;
    }).join('')}</tbody></table>`;
  } else if (teamTourneyTab === 'seasons') {
    box.innerHTML = result.seasons.map(season => `<div class="season-block"><h4>第 ${season.index} 届 · 种子 ${escapeHtml(season.seed)} · 冠军 ${escapeHtml(teamNameOf(result, season.champion))} · ${season.audit.games} 局</h4><table><thead><tr><th>名次</th><th>队伍</th><th>场分 MP</th><th>局胜 GP</th><th>局胜率</th><th>胜/平/负</th><th>Buchholz</th><th>SB</th></tr></thead><tbody>${season.standings.map(row => `<tr class="${row.rank === 1 ? 'champion' : ''}"><td class="rank">${String(row.rank).padStart(2, '0')}</td><td class="model">${escapeHtml(teamNameOf(result, row.id))}</td><td>${row.mp}</td><td>${row.gameWins}</td><td>${pct(row.gameRate)}</td><td>${row.matchWins}/${row.matchDraws}/${row.matchLosses}</td><td>${row.buchholz}</td><td>${row.sb}</td></tr>`).join('')}</tbody></table></div>`).join('');
  } else if (teamTourneyTab === 'rounds') {
    box.innerHTML = result.seasons.map(season => `<div class="season-block"><h4>第 ${season.index} 届 · ${escapeHtml(season.seed)}</h4>${season.rounds.map(round => `<div class="round-title">第 ${round.round} 轮 · 配对顺序 ${escapeHtml(round.order.map(id => teamNameOf(result, id)).join(' → '))}${round.bye ? ` · 轮空 ${escapeHtml(teamNameOf(result, round.bye))}` : ''}</div><div class="bo-grid">${round.pairs.map(match => teamBoString(match, result)).join('')}</div>`).join('')}</div>`).join('');
  } else {
    box.innerHTML = `<table><thead><tr><th>模型</th><th>队伍</th><th>参与局</th><th>队伍胜率</th><th>坐 0 号位胜率</th><th>本队前位胜率</th></tr></thead><tbody>${(result.memberStats || []).map(row => `<tr><td class="model">${escapeHtml(row.model)}</td><td>${escapeHtml(row.teamName)}</td><td>${row.games}</td><td class="rate">${pct(row.winRate)}</td><td>${pct(row.seat0Rate)}</td><td>${pct(row.leadRate)}</td></tr>`).join('')}</tbody></table>`;
  }
}

function statsBalanced(result) { return Boolean(result?.stats?.seatBalanced); }

async function startTeamTournament() {
  const inputs = teamSetInputs();
  const sets = inputs.filter(input => input.checked).map(input => input.value);
  if (!inputs.length) sets.push('core');
  if (!sets.length) { toast(new Error('至少勾选一个牌包')); return; }
  const button = $('#teamTourneyStart');
  button.disabled = true;
  $('#teamTourneyStartHint').textContent = '正在启动…';
  try {
    const response = await api('/api/team-tournament/start', { method: 'POST', body: JSON.stringify({
      seed: $('#teamTourneySeed').value.trim() || `team-swiss-${Date.now()}`,
      seasons: Number($('#teamTourneySeasons').value),
      rounds: Number($('#teamTourneyRounds').value),
      repeats: Number($('#teamTourneyRepeats').value),
      sets
    }) });
    $('#teamTourneyStartHint').textContent = `已启动 ${response.runId}（${response.config.seasons} 届 × ${response.config.rounds} 轮 · BO${response.config.bo}）`;
    await refreshTeamTournament();
  } catch (error) {
    $('#teamTourneyStartHint').textContent = `启动失败：${error.message}`;
    toast(error);
  } finally { button.disabled = false; }
}

/* ── 2V2 实验室：四场已落盘报告的只读看板 ─────────────────── */
let labData = null;
let labRunKey = 'clone-core';
let labTab = 'board';

const LAB_RUN_ORDER = [
  'clone-core', 'clone-all', 'random-core', 'random-all',
  'hydra3-core', 'hydra3-all', 'hydra3-clone-core', 'hydra3-clone-all',
  'emperor-core', 'emperor-all', 'emperor-clone-core', 'emperor-clone-all'
];
const LAB_RUN_LABELS = {
  'clone-core': ['实验 A · 核心', '同模型复制队 / 基础盒'],
  'clone-all': ['实验 A · 全扩', '同模型复制队 / 六牌包'],
  'random-core': ['实验 B · 核心', '随机组队 / 基础盒'],
  'random-all': ['实验 B · 全扩', '随机组队 / 六牌包'],
  'hydra3-core': ['三头龙 · 核心', '3V3 随机组队 / 基础盒'],
  'hydra3-all': ['三头龙 · 全扩', '3V3 随机组队 / 六牌包'],
  'hydra3-clone-core': ['三头龙复制队 · 核心', '同模型三人队 / 基础盒'],
  'hydra3-clone-all': ['三头龙复制队 · 全扩', '同模型三人队 / 六牌包'],
  'emperor-core': ['大将战 · 核心', '3V3 随机组队 / 基础盒'],
  'emperor-all': ['大将战 · 全扩', '3V3 随机组队 / 六牌包'],
  'emperor-clone-core': ['大将战复制队 · 核心', '同模型三人队 / 基础盒'],
  'emperor-clone-all': ['大将战复制队 · 全扩', '同模型三人队 / 六牌包']
};
const LAB_TABS = [['board', '总榜'], ['members', '在场统计'], ['seasons', '各届冠军'], ['notes', '口径与复现']];

const labModel = id => labData?.models?.[id]?.model || id;
const labStrategy = id => String(labData?.models?.[id]?.strategy || '').replace('模型自选：', '');
const labCurrent = () => labData?.runs?.find(run => run.key === labRunKey);

async function refreshLab() {
  try {
    labData = await api('/api/lab');
    const available = labData.runs.filter(run => !run.missing);
    $('#labBadge').textContent = `${available.length} 场`;
    if (!available.some(run => run.key === labRunKey)) labRunKey = available[0]?.key || labRunKey;
    renderLab();
  } catch (error) {
    $('#labSummary').innerHTML = `<div class="lab-empty">读取失败：${escapeHtml(error.message)}</div>`;
  }
}

function labTopName(run) {
  if (run.experiment === 'clone') {
    const top = run.aggregate?.[0];
    return run.teams?.find(team => team.id === top?.id)?.vendor || '—';
  }
  return labModel(run.contribution?.rows?.[0]?.id);
}

const is3v3Run = run => run?.mode === 'hydra3' || run?.mode === 'emperor'
  || run?.experiment === 'hydra3' || run?.experiment === 'emperor';

function labHeadline(available) {
  if (!available.length) return '<span class="stat">reply/ 下暂无实验室报告，可用 src/team-lab-cli.js 生成。</span>';
  const summary = labData.summary || {};
  const counts = new Map();
  for (const winner of summary.winners || []) {
    if (winner.id) counts.set(winner.id, (counts.get(winner.id) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  const consistent = summary.consistent && summary.championId;
  const name = consistent ? labModel(summary.championId) : (ranked.length ? `${labModel(ranked[0][0])} · ${ranked[0][1]}/${available.length} 场` : '—');
  const note = consistent
    ? `<b>${available.length} 场榜首完全一致</b>`
    : '各场榜首不一致，请对照明细（左为出现次数最多的模型）';
  const total = available.reduce((sum, run) => sum + (run.audit?.playedGames || 0), 0);
  const seed = available[0].config?.masterSeed || '—';
  return `<span class="crown">CROSS-RUN RESULT · ${available.length} 场</span><span class="who">${escapeHtml(name)}</span>` +
    `<span class="stat">${note}</span>` +
    `<span class="stat">复制队口径：局胜率　·　随机组队个人口径：控制队友与对手后的 β</span>` +
    `<span class="script">主种子 ${escapeHtml(seed)} · 合计 ${total} 局</span>`;
}

function labSummaryHtml(available) {
  const tiles = available.map(run => {
    const [label] = LAB_RUN_LABELS[run.key];
    const audit = run.audit || {}, stats = run.stats || {};
    return `<div class="tile"><span>${escapeHtml(label)}</span><b>${escapeHtml(labTopName(run))}</b>` +
      `<small>${audit.playedGames || 0} 局 · 前位 ${pct(stats.frontSideRate)} · ${audit.seatBalanced ? '座位配平' : '未配平'}</small></div>`;
  });
  const total = available.reduce((sum, run) => sum + (run.audit?.playedGames || 0), 0);
  const clean = available.every(run => !run.audit?.rematches && !run.audit?.retries && !run.audit?.infeasibleRounds);
  tiles.push(`<div class="tile"><span>合计</span><b>${total} 局</b><small>${clean ? '零重赛 · 零重试 · 零回退' : '存在异常，详见账目'}</small></div>`);
  return tiles.join('');
}

function labCloneBoard(run) {
  const rows = run.aggregate || [];
  const teamOf = id => run.teams?.find(team => team.id === id);
  return `<table><thead><tr><th>名次</th><th>模型</th><th>策略</th><th>夺冠</th><th>平均名次</th><th>局胜率</th><th>局胜/总局</th><th>累计 MP</th><th>前位</th><th>后位</th><th>平均 Buchholz</th></tr></thead><tbody>` +
    rows.map(row => {
      const team = teamOf(row.id);
      return `<tr class="${row.rank === 1 ? 'champion' : ''}"><td class="rank">${String(row.rank).padStart(2, '0')}</td>` +
        `<td class="model">${escapeHtml(team?.vendor || row.id)}</td><td>${escapeHtml(labStrategy(team?.players?.[0]?.model))}</td>` +
        `<td>${row.titles}/${run.config.seasons}</td><td>${row.avgRank}</td><td class="rate">${pct(row.gameRate)}</td>` +
        `<td>${row.gameWins}/${row.games}</td><td>${row.mp}</td><td>${pct(row.firstRate)}</td><td>${pct(row.secondRate)}</td><td>${row.avgBuchholz}</td></tr>`;
    }).join('') + '</tbody></table>';
}

function labBetaBoard(run) {
  const memberOf = new Map((run.members || []).map(row => [row.id, row]));
  const rows = run.contribution?.rows || [];
  return `<table><thead><tr><th>名次</th><th>模型</th><th>β（主口径）</th><th>e^β</th><th>近似 SE</th><th>近似 z</th><th>在场队伍胜率</th><th>参与局</th><th>所在队伍夺冠</th><th>说明</th></tr></thead><tbody>` +
    rows.map(row => {
      const member = memberOf.get(row.id) || {};
      return `<tr class="${row.rank === 1 ? 'champion' : ''}"><td class="rank">${String(row.rank).padStart(2, '0')}</td>` +
        `<td class="model">${escapeHtml(labModel(row.id))}</td><td class="beta">${row.beta}</td><td>${row.odds}</td>` +
        `<td>${row.se ?? '—'}</td><td>${row.z ?? '—'}</td><td class="rate">${pct(member.winRate)}</td>` +
        `<td>${member.games ?? '—'}</td><td>${member.titles ?? '—'}</td>` +
        `<td>${row.rank === 1 ? '<span class="lead">个人发挥第一</span>' : ''}</td></tr>`;
    }).join('') + '</tbody></table>';
}

function labMembersTable(run) {
  return `<table><thead><tr><th>模型</th><th>参与局（去重）</th><th>座位次数</th><th>队伍胜局</th><th>队伍胜率</th><th>Wilson 95% CI</th><th>前位队胜率</th><th>搭档数</th><th>对手数</th><th>所在队伍夺冠</th><th>座位分布</th></tr></thead><tbody>` +
    (run.members || []).map(row => `<tr><td class="model">${escapeHtml(labModel(row.id))}</td><td>${row.games}</td>` +
      `<td>${row.seatAppearances}</td><td>${row.wins}</td><td class="rate">${pct(row.winRate)}</td>` +
      `<td>[${pct(row.ci95[0])}, ${pct(row.ci95[1])}]</td><td>${pct(row.frontRate)}</td>` +
      `<td>${row.partnerCount}</td><td>${row.opponentCount}</td><td>${row.titles ?? '—'}</td>` +
      `<td class="mono">${row.seats.join('/')}</td></tr>`).join('') + '</tbody></table>';
}

function labSeasonsHtml(run) {
  return (run.seasons || []).map(season => {
    const team = season.teamRoster?.find(entry => entry.id === season.champion);
    const championName = run.experiment === 'clone'
      ? (run.teams?.find(entry => entry.id === season.champion)?.vendor || season.champion)
      : (team ? team.players.map(player => player.display).join(' + ') : season.champion);
    const top = season.standings?.[0] || {};
    const roster = run.experiment !== 'clone' && (run.experiment === 'random' || is3v3Run(run)) && season.teamRoster
      ? `<div class="roster">${season.teamRoster.map(entry => `<span>${entry.players.map(player => escapeHtml(player.display)).join(' + ')}</span>`).join('')}</div>`
      : '';
    return `<div class="lab-season"><h4>第 ${season.index} 届 · <span class="mono">${escapeHtml(season.seed)}</span> · 冠军 ${escapeHtml(championName)} · MP ${top.mp ?? '—'} / 局胜 ${top.gameWins ?? '—'}</h4>${roster}</div>`;
  }).join('');
}

function labNotesHtml(run) {
  const config = run.config || {};
  const isClone = run.experiment === 'clone';
  const is3v3 = is3v3Run(run);
  const clone3 = is3v3 && isClone;
  const command = clone3
    ? `node src/mode-lab-cli.js --mode ${config.mode} --sets ${config.setsKey} --seasons ${config.seasons} --rounds ${config.rounds} --repeats ${config.repeats} --seed ${config.masterSeed} --out ${config.outBase}`
    : is3v3
    ? `node src/mode-tourney-cli.js --mode ${config.mode} --sets ${config.setsKey} --seasons ${config.seasons} --repeats ${config.repeats} --seed ${config.masterSeed} --out ${config.outBase}`
    : `node src/team-lab-cli.js --experiment ${config.experiment} --sets ${config.setsKey} --seed ${config.masterSeed} --seasons ${config.seasons} --rounds ${config.rounds} --repeats ${config.repeats} --out ${config.outBase}`;
  const design = clone3
    ? `12 支队伍，每队由同一份 AI 脚本的三个副本组成；队友是自己的镜像，队伍成绩可近似归因为该脚本的 3V3 能力。赛制参考 1v1 瑞士轮 / 2V2 实验 A：12 个参赛单位、每届 ${config.rounds} 轮 × ${config.matchesPerRound} 场、同分优先 + 回溯零重赛，按局胜率聚合。${config.mode === 'emperor' ? '大将战每队 1 名大将（60 权威）+ 2 名提督（50 权威）；提督只能打自己的对位提督，对位阵亡后才可打敌方大将，大将可攻击任何敌方；大将被击败则全队失败。' : '三头龙全队共享 100 权威，队友间可转移贸易/战斗，任一人有前哨则全队受保护。'}`
    : is3v3
    ? `每届把 12 个模型随机分成 4 队、每队 3 人，打完整单循环（3 轮 × 2 场，零重赛）。队伍胜负共享，用团队 Bradley–Terry 拟合 12 个 β 与前位截距 γ。${config.mode === 'emperor' ? '大将战每队 1 名大将（60 权威）+ 2 名提督（50 权威）；提督只能打自己的对位提督，对位阵亡后才可打敌方大将，大将可攻击任何敌方；大将被击败则全队失败。' : '三头龙全队共享 100 权威，队友间可转移贸易/战斗，任一人有前哨则全队受保护。'}`
    : isClone
    ? '12 支队伍，每队由同一份 AI 脚本的两个副本组成；队友是自己的镜像，队伍成绩可近似归因为单个脚本的 2V2 能力。赛制参考 1v1：12 个参赛单位、每届 5 轮瑞士轮、同分优先 + 回溯零重赛，按局胜率聚合。'
    : '每届把 12 个模型随机两两配成 6 队，12 届队伍构成都不同；每届跑 5 轮组队瑞士轮（带剩余轮次可行性前瞻）。队伍胜负共享，因此用团队 Bradley–Terry 逻辑模型拟合 12 个 β 与前位截距 γ，控制队友与对手强度。';
  return `<div class="lab-notes"><h4>实验设计</h4><p>${design}</p>` +
    `<p>${is3v3 ? `每场 BO${config.bo}：前位队 ${config.perSide || 3} 局、后位队 ${config.perSide || 3} 局，队内座位按局轮换，每名队员在 6 个座位各坐 1 次${config.mode === 'emperor' ? '，且各当 2 次大将' : ''}。回合结构为整队轮流：同队队友按座位升序连续行动，队末才弃手、补牌、清基地伤害。` : `每场 BO${config.bo} 覆盖「哪队占前位 × A 队谁在前 × B 队谁在前」共 8 种座位排列；2v2 中座位 [0,2] 一队、[1,3] 一队，共享 75 点权威；同队两名队友连续行动。`}牌包：${escapeHtml((config.sets || []).join(' + '))}。</p>` +
    '<h4>口径与局限</h4><ul>' +
    `<li>${is3v3 ? '3v3' : '2v2'} 胜负由队伍共享，个人指标都是统计估计而非直接测量；β 依赖「随机组队让队友/对手强度在期望上抵消」的设计假设。</li>` +
    `<li>同一场 BO${config.bo} 内对局并不独立，置信区间、SE 与 z 均为近似参考；结论只适用于本赛制、本牌包与这组种子。</li>` +
    `<li>复制队${is3v3 ? '三个' : '两个'}副本各自拥有独立的 memory 与随机流，脚本模块级只有只读常量表，不存在跨座位状态串扰。</li>` +
    '<li>全扩 = 核心 + 殖民战争 + 危机事件 + Frontiers + 两个危机小扩；事件牌翻出即结算，会改变牌库节奏，两种牌包名次不必相同。</li>' +
    `<li>本场账目：${run.audit.playedGames} 局、重赛 ${run.audit.rematches}、重试 ${run.audit.retries}${run.audit.infeasibleRounds === undefined ? '' : `、配对回退 ${run.audit.infeasibleRounds}`}、座位配平 ${run.audit.seatBalanced ? '通过' : '未通过'}${run.audit.emperorBalanced === undefined ? '' : `、大将角色配平 ${run.audit.emperorBalanced ? '通过' : '未通过'}${run.audit.emperorSeatBalanced === undefined ? '' : `（按副本 ${run.audit.emperorSeatBalanced ? '通过' : '未通过'}）`}`}。</li>` +
    '</ul><h4>复现命令</h4><pre>' + escapeHtml(command) + '</pre>' +
    `<p class="source">数据源：${escapeHtml(run.file || '—')} · 生成于 ${escapeHtml(run.generatedAt ? new Date(run.generatedAt).toLocaleString() : '—')} · 完整逐局记录可点右下角「下载当前完整报告」</p></div>`;
}

function labBodyHtml(run, tab) {
  if (tab === 'members') return labMembersTable(run);
  if (tab === 'seasons') return labSeasonsHtml(run);
  if (tab === 'notes') return labNotesHtml(run);
  return run.experiment === 'clone' ? labCloneBoard(run) : labBetaBoard(run);
}

function renderLab() {
  if (!labData) return;
  const available = labData.runs.filter(run => !run.missing);
  $('#labHeadline').innerHTML = labHeadline(available);
  $('#labSummary').innerHTML = labSummaryHtml(available);

  $('#labRunTabs').innerHTML = LAB_RUN_ORDER.map(key => {
    const [label, sub] = LAB_RUN_LABELS[key];
    const exists = available.some(run => run.key === key);
    return `<button type="button" data-run="${key}" class="${labRunKey === key ? 'active' : ''}" ${exists ? '' : 'disabled'}>` +
      `${escapeHtml(label)}<span class="sub">${exists ? escapeHtml(sub) : '报告未生成'}</span></button>`;
  }).join('');
  for (const button of $('#labRunTabs').querySelectorAll('button[data-run]')) {
    button.onclick = () => { labRunKey = button.dataset.run; labTab = 'board'; renderLab(); };
  }

  const run = labCurrent();
  $('#labDownload').href = `/api/lab/full?run=${encodeURIComponent(labRunKey)}`;
  if (!run || run.missing) {
    $('#labAudit').innerHTML = '';
    $('#labTabs').innerHTML = '';
    $('#labBody').innerHTML = '<div class="lab-empty">该场报告尚未生成；可在命令行运行 src/team-lab-cli.js 生成。</div>';
    return;
  }

  const audit = run.audit || {}, config = run.config || {}, stats = run.stats || {};
  // 2v2 实验带前瞻回退与座位次数；3v3 是完整单循环，座位等频记在 seatDistinctCounts。
  const seatAppearances = audit.perModelSeatAppearances
    ?? (Array.isArray(audit.seatDistinctCounts) && audit.seatDistinctCounts.length === 1 ? audit.seatDistinctCounts[0] : null);
  const cells = [
    ['总局数', audit.playedGames, `计划 ${audit.totalGames}`],
    ['赛制', `${config.seasons} × ${config.rounds}`, `每场 BO${config.bo}`],
    ['牌包', config.setsLabel || (config.sets || []).join('+'), `模式 ${config.mode}`],
    ['前位队胜率', pct(stats.frontSideRate), `${stats.frontSideWins}/${stats.totalGames}`],
    ['座位配平', audit.seatBalanced ? '通过' : '未通过', is3v3Run(run) ? '六座等频' : '四座等频'],
    ['重赛 / 重试', `${audit.rematches} / ${audit.retries}`,
      audit.infeasibleRounds === undefined ? '完整单循环 · 无配对回退' : `配对回退 ${audit.infeasibleRounds}`],
    ['每人参与局数', audit.perModelGames, seatAppearances === null ? '按局去重' : `座位 ${seatAppearances} 次`]
  ];
  if (audit.emperorBalanced !== undefined) {
    cells.push(['大将角色配平', audit.emperorBalanced ? '通过' : '未通过', '每人 2 次大将']);
  }
  if (run.experiment === 'random') cells.push(['搭档覆盖', `${audit.partnerPairs}/66`, '跨届不同搭档']);
  cells.push(['耗时', `${(audit.elapsedMs / 1000).toFixed(1)}s`, run.generatedAt ? new Date(run.generatedAt).toLocaleString() : '']);
  $('#labAudit').innerHTML = cells.map(([label, value, note]) => {
    const ok = value === '通过' || value === '0 / 0';
    return `<div class="cell ${ok ? 'ok' : ''}"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}</b><small>${escapeHtml(String(note))}</small></div>`;
  }).join('');

  const boardLabel = run.experiment === 'clone' ? '复制队能力榜' : '个人 β 榜';
  $('#labTabs').innerHTML = LAB_TABS.map(([tab, label]) =>
    `<button type="button" data-tab="${tab}" class="${labTab === tab ? 'active' : ''}">${tab === 'board' ? boardLabel : escapeHtml(label)}</button>`).join('');
  for (const button of $('#labTabs').querySelectorAll('button[data-tab]')) {
    button.onclick = () => { labTab = button.dataset.tab; renderLab(); };
  }
  $('#labBody').innerHTML = labBodyHtml(run, labTab);
}

$('#labBtn').onclick = async () => { await refreshLab(); $('#labDialog').showModal(); };
$('#closeLab').onclick = () => $('#labDialog').close();
$('#labRefresh').onclick = refreshLab;

$('#teamTournamentBtn').onclick = async () => { await refreshTeamTournament(); $('#teamTournamentDialog').showModal(); };
$('#closeTeamTournament').onclick = () => $('#teamTournamentDialog').close();
$('#teamTourneyRefresh').onclick = refreshTeamTournament;
$('#teamTourneyStart').onclick = startTeamTournament;
for (const [id, tab] of [['#teamTabBoard', 'board'], ['#teamTabSeasons', 'seasons'], ['#teamTabRounds', 'rounds'], ['#teamTabMembers', 'members']]) {
  $(id).onclick = () => { teamTourneyTab = tab; renderTeamTournament(); };
}

$('#subagentsBtn').onclick = async () => { await refreshSubagents(); renderSubagents(); $('#subagentsDialog').showModal(); };
$('#closeSubagents').onclick = () => $('#subagentsDialog').close();
$('#refreshSubagents').onclick = refreshSubagents;
$('#newMatchBtn').onclick = () => $('#setupDialog').showModal();
$('#closeSetup').onclick = () => $('#setupDialog').close();
$('#closeActions').onclick = () => $('#actionDialog').close();
$('#setupForm').onsubmit = createMatch;
$('#playerCount').onchange = renderSeatEditors;
$('#pauseBtn').onclick = () => api('/api/control', { method: 'POST', body: JSON.stringify({ command: 'pause' }) }).then(refresh).catch(toast);
$('#resumeBtn').onclick = () => api('/api/control', { method: 'POST', body: JSON.stringify({ command: 'resume' }) }).then(refresh).catch(toast);
$('#stepBtn').onclick = () => api('/api/control', { method: 'POST', body: JSON.stringify({ command: 'step' }) }).then(refresh).catch(toast);
$('#speedSelect').onchange = event => api('/api/control', { method: 'POST', body: JSON.stringify({ command: 'speed', value: Number(event.target.value) }) }).catch(toast);
$('#perspectiveSelect').onchange = event => { perspective = event.target.value; refresh(); };
$('#logLatestBtn').onclick = () => { $('#eventLog').scrollTop = 0; };
document.addEventListener('keydown', event => {
  if (event.target.matches('input,select') || document.querySelector('dialog[open]')) return;
  if (event.code === 'Space') { event.preventDefault(); $(snapshot.paused ? '#resumeBtn' : '#pauseBtn').click(); }
  if (event.key.toLowerCase() === 'n' && !$('#stepBtn').disabled) $('#stepBtn').click();
});

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

try {
  [options, scripts] = await Promise.all([api('/api/options'), api('/api/scripts')]);
  renderOptions();
  renderTourneySets();
  await Promise.all([refresh(), refreshSubagents(), refreshTournament(), refreshTeamTournament(), refreshLab()]);
  const events = new EventSource('/api/events');
  events.addEventListener('match', () => refresh());
  events.onerror = () => {};
  const agentEvents = new EventSource('/api/subagents/events');
  agentEvents.addEventListener('agents', () => refreshSubagents());
  agentEvents.onerror = () => {};
  setInterval(() => {
    if (events.readyState !== EventSource.OPEN) refresh();
    if (agentEvents.readyState !== EventSource.OPEN) refreshSubagents();
  }, 3000);
  setInterval(() => {
    if ($('#tournamentDialog').open) refreshTournament();
    if ($('#teamTournamentDialog').open) refreshTeamTournament();
  }, 1500);
  // 实验室报告是静态落盘文件，单独低频轮询即可（服务端按 mtime 缓存）。
  setInterval(() => { if ($('#labDialog').open) refreshLab(); }, 3000);
} catch (error) {
  setOffline(true, `初始化失败：${error.message || error}；请运行 start-server.bat 后等待自动重连`);
  toast(error);
}

// 服务离线时每 4 秒自动重试，恢复后横幅消失、看板自动刷新（不依赖 SSE 是否已建立）。
setInterval(() => {
  if ($('#offlineBanner') && !$('#offlineBanner').classList.contains('hidden')) refresh();
}, 4000);
