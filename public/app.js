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
  await Promise.all([refresh(), refreshSubagents(), refreshTournament(), refreshTeamTournament()]);
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
} catch (error) {
  setOffline(true, `初始化失败：${error.message || error}；请运行 start-server.bat 后等待自动重连`);
  toast(error);
}

// 服务离线时每 4 秒自动重试，恢复后横幅消失、看板自动刷新（不依赖 SSE 是否已建立）。
setInterval(() => {
  if ($('#offlineBanner') && !$('#offlineBanner').classList.contains('hidden')) refresh();
}, 4000);
