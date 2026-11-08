import { CARD_DEFS, buildTradeDeckIds, normalizeExpansions, getCardDef, getFactions } from './cards.js';
import { hashSeed, shuffle } from './rng.js';
import { MODES, validateMode, alivePlayers, nextAlive, canAttackPlayer, canTargetBase, teamOf, teammates, isTeamMode, TEAM_SPECS, isEmperor } from './modes.js';

const clone = value => structuredClone(value);
const sameAction = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const unique = values => [...new Set(values)];

function combinations(values, max, min = 1) {
  const result = [];
  const visit = (start, picked) => {
    if (picked.length >= min) result.push([...picked]);
    if (picked.length === max) return;
    for (let i = start; i < values.length; i++) visit(i + 1, [...picked, values[i]]);
  };
  visit(0, []);
  return result;
}

function permutations(values, count) {
  if (count === 0) return [[]];
  const result = [];
  for (let i = 0; i < values.length; i++) {
    for (const tail of permutations(values.filter((_, j) => j !== i), count - 1)) result.push([values[i], ...tail]);
  }
  return result;
}

export class Game {
  constructor(config = {}) {
    const mode = config.mode || 'standard';
    const count = config.players?.length || 2;
    validateMode(mode, count);
    const names = config.players?.map((p, i) => p.name || `玩家 ${i + 1}`) || ['玩家 1', '玩家 2'];
    const isTeam = isTeamMode(mode);
    const teamSpec = isTeam ? TEAM_SPECS[mode] : null;
    const emperorSeats = mode === 'emperor' ? (config.emperors || [0, 1]).slice() : [];
    const expansions = normalizeExpansions(config);
    this.state = {
      version: 2,
      mode,
      seed: String(config.seed ?? 'star-realms'),
      rngState: hashSeed(config.seed ?? 'star-realms'),
      status: 'playing',
      phase: 'main',
      turn: 1,
      activePlayer: 0,
      expansions,
      players: names.map((name, id) => ({
        id, name, team: (isTeam || mode === 'emperor') ? id % 2 : null,
        authority: emperorSeats.includes(id) ? 60 : (isTeam ? teamSpec.authority : 50), trade: 0, combat: 0,
        reserve: { trade: 0, combat: 0 },
        deck: [], hand: [], discard: [], inPlay: [],
        used: {}, triggered: {}, triggeredDouble: {}, topDeckNextShip: false, topDeckNextBase: false,
        topDeckNextAny: false, nextAcquireToHand: false,
        scrappedThisTurn: 0, playedThisTurn: [], eliminated: false
      })),
      teams: (isTeam || mode === 'emperor') ? [0, 1].map(id => ({
        id, name: id === 0 ? '第一舰队' : '第二舰队',
        players: names.map((_, index) => index).filter(index => index % 2 === id),
        authority: isTeam ? teamSpec.authority : 0
      })) : [],
      emperors: emperorSeats,
      cards: {},
      tradeDeck: [],
      tradeRow: [],
      explorers: 10,
      scrapHeap: [],
      damage: {},
      pending: null,
      eventContext: null,
      eventRefillQueue: [],
      eventProcessing: false,
      lastEvent: null,
      winner: null,
      winningTeam: null,
      winReason: null,
      nextUid: 1
    };
    this.events = [];
    this.setup();
  }

  emit(type, message, data = {}) {
    const event = { seq: this.events.length + 1, turn: this.state.turn, actor: this.state.activePlayer, type, message, ...data };
    this.events.push(event);
    return event;
  }

  makeCard(id, owner = null) {
    const uid = `c${this.state.nextUid++}`;
    this.state.cards[uid] = { uid, id, owner, copiedFrom: null };
    return uid;
  }

  setup() {
    const tradeIds = buildTradeDeckIds({ expansions: this.state.expansions });
    this.state.expansions.tradeDeckSize = tradeIds.length;
    if (!tradeIds.length) throw new Error('交易牌堆为空：至少启用一个交易牌包');
    this.state.tradeDeck = shuffle(this.state, tradeIds.map(id => this.makeCard(id)));
    for (const player of this.state.players) {
      const ids = [...Array(8).fill('scout'), ...Array(2).fill('viper')];
      player.deck = shuffle(this.state, ids.map(id => this.makeCard(id, player.id)));
      const handSize = this.state.mode === 'standard' ? (player.id === 0 ? 3 : 5)
        : (this.state.mode === 'hydra3' || this.state.mode === 'emperor')
          ? (player.id % 2 === 0 ? 3 : 5)
          : Math.min(5, player.id + 3);
      this.draw(player.id, handSize, false);
    }
    // 初始交易行不触发事件；被跳过的事件牌留在牌库中等待之后翻出。
    for (let i = 0; i < 5; i++) this.refillTradeRow(i, false);
    this.refreshAllies();
    const sets = this.state.expansions.sets.join(' + ');
    this.emit('setup', `${MODES[this.state.mode].name}开始；牌包 ${sets}；种子 ${this.state.seed}`, { seed: this.state.seed, sets: this.state.expansions.sets });
  }

  draw(playerId, count = 1, log = true) {
    const player = this.state.players[playerId];
    let drawn = 0;
    for (let i = 0; i < count; i++) {
      if (!player.deck.length && player.discard.length) {
        player.deck = shuffle(this.state, player.discard.splice(0));
        this.emit('shuffle', `${player.name} 将弃牌堆洗入牌库`, { playerId });
      }
      const uid = player.deck.shift();
      if (!uid) break;
      player.hand.push(uid);
      drawn++;
    }
    if (log && drawn) this.emit('draw', `${player.name} 抽了 ${drawn} 张牌`, { playerId, count: drawn });
    return drawn;
  }

  syncTeamAuthority(teamId) {
    const team = this.state.teams[teamId];
    for (const playerId of team.players) this.state.players[playerId].authority = team.authority;
  }

  adjustAuthority(playerId, delta) {
    if (isTeamMode(this.state.mode)) {
      const team = this.state.teams[teamOf(this.state, playerId)];
      team.authority += delta;
      this.syncTeamAuthority(team.id);
    } else this.state.players[playerId].authority += delta;
  }

  loseAuthority(playerId, amount) {
    const before = isTeamMode(this.state.mode)
      ? this.state.teams[teamOf(this.state, playerId)].authority
      : this.state.players[playerId].authority;
    const target = Math.max(1, before - amount);
    this.adjustAuthority(playerId, target - before);
  }

  beginTurn(playerId) {
    const player = this.state.players[playerId];
    if (player.reserve.trade || player.reserve.combat) {
      player.trade += player.reserve.trade;
      player.combat += player.reserve.combat;
      this.emit('transfer', `${player.name} 接收队友预留的 ${player.reserve.trade} 贸易、${player.reserve.combat} 战斗`, { playerId });
      player.reserve = { trade: 0, combat: 0 };
    }
  }

  refillTradeRow(index, allowEvents = true) {
    if (this.state.tradeRow[index]) return;
    let uid = this.state.tradeDeck.shift() || null;
    if (!uid) { this.state.tradeRow[index] = null; return; }
    let def = CARD_DEFS[this.state.cards[uid].id];
    if (!allowEvents && def.type === 'event') {
      // 初始布置把事件牌沉到牌库底，避免 setup 阶段出现多个并发待决事件。
      const skipped = [];
      while (def.type === 'event' && this.state.tradeDeck.length) {
        skipped.push(uid);
        uid = this.state.tradeDeck.shift();
        def = CARD_DEFS[this.state.cards[uid].id];
      }
      this.state.tradeDeck.push(...skipped);
      if (def.type === 'event') { this.state.tradeDeck.push(uid); this.state.tradeRow[index] = null; return; }
    }
    if (allowEvents && def.type === 'event') {
      this.state.tradeRow[index] = null;
      this.state.scrapHeap.push(uid);
      this.emit('event', `${def.name} 进入交易行：${def.text}`, { cardId: uid, eventId: def.id });
      this.state.lastEvent = { id: def.id, name: def.name, en: def.en, text: def.text, turn: this.state.turn };
      this.startEvent(def.id, index);
      return;
    }
    this.state.tradeRow[index] = uid;
  }

  eventSubjects() {
    if (isTeamMode(this.state.mode)) {
      return this.state.teams.filter(team => team.players.some(id => !this.state.players[id].eliminated))
        .map(team => team.players.find(id => !this.state.players[id].eliminated));
    }
    return alivePlayers(this.state).map(player => player.id);
  }

  startEvent(eventId, row) {
    this.state.eventContext = { eventId, row, subjects: this.eventSubjects(), index: 0, refillAll: false };
    this.advanceEvent();
  }

  processEventRefills() {
    const s = this.state;
    if (s.eventProcessing || s.eventContext) return;
    s.eventProcessing = true;
    try {
      while (!s.eventContext && s.eventRefillQueue.length) {
        const row = s.eventRefillQueue.shift();
        this.refillTradeRow(row);
      }
    } finally {
      s.eventProcessing = false;
    }
  }

  finishEvent(context) {
    this.state.eventContext = null;
    if (context.refillAll) this.state.eventRefillQueue.push(0, 1, 2, 3, 4);
    else this.state.eventRefillQueue.push(context.row);
    this.processEventRefills();
  }

  advanceEvent() {
    const context = this.state.eventContext;
    if (!context) return;
    while (context.index < context.subjects.length) {
      const playerId = context.subjects[context.index];
      const player = this.state.players[playerId];
      if (player.eliminated) { context.index++; continue; }
      const pending = this.eventPending(context, playerId);
      if (pending) { this.state.pending = pending; return; }
      this.resolveImmediateEvent(context.eventId, playerId, context);
      context.index++;
    }
    this.finishEvent(context);
  }

  resolveImmediateEvent(eventId, playerId, context) {
    const player = this.state.players[playerId];
    switch (eventId) {
      case 'galacticSummit':
        this.adjustAuthority(playerId, 7);
        this.emit('eventEffect', `${player.name} 获得 7 权威`, { playerId, eventId });
        break;
      case 'quasar':
        this.draw(playerId, 2);
        this.emit('eventEffect', `${player.name} 抽 2 张牌`, { playerId, eventId });
        break;
      case 'supernova':
        this.loseAuthority(playerId, 5);
        if (context.index === 0) {
          for (let row = 0; row < this.state.tradeRow.length; row++) {
            const uid = this.state.tradeRow[row];
            if (uid) this.state.scrapHeap.push(uid);
            this.state.tradeRow[row] = null;
          }
          context.refillAll = true;
          this.emit('eventEffect', '交易行所有卡牌被销毁', { eventId });
        }
        this.emit('eventEffect', `${player.name} 失去 5 权威（不会低于 1）`, { playerId, eventId });
        break;
      case 'tradeMission':
        if (playerId === this.state.activePlayer) {
          player.trade += 4;
          player.topDeckNextShip = true;
          this.emit('eventEffect', `${player.name} 获得 4 贸易，下一艘购入飞船可置牌库顶`, { playerId, eventId });
        } else {
          this.draw(playerId, 2);
          this.emit('eventEffect', `${player.name} 抽 2 张牌`, { playerId, eventId });
        }
        break;
      default:
        break;
    }
  }

  eventPending(context, playerId) {
    const player = this.state.players[playerId];
    const base = { type: 'eventChoice', player: playerId, eventId: context.eventId, actor: this.state.activePlayer };
    let actions = [];
    let extra = {};
    switch (context.eventId) {
      case 'blackHole':
        for (const targets of combinations(unique(player.hand), 2, 0)) actions.push({ type: 'eventChoice', eventId: context.eventId, targets });
        extra = { kind: 'blackHole' };
        break;
      case 'bombardment': {
        const bases = player.inPlay.filter(uid => getCardDef(uid, this.state).type === 'base');
        for (const baseId of bases) actions.push({ type: 'eventChoice', eventId: context.eventId, baseId });
        if (!bases.length) { this.loseAuthority(playerId, 6); this.emit('eventEffect', `${player.name} 没有基地可摧毁，失去 6 权威`, { playerId, eventId: context.eventId }); return null; }
        actions.push({ type: 'eventChoice', eventId: context.eventId, pay: true });
        extra = { kind: 'bombardment' };
        break;
      }
      case 'comet':
        for (const targets of combinations(unique([...player.hand, ...player.discard]), 2, 0)) actions.push({ type: 'eventChoice', eventId: context.eventId, targets });
        extra = { kind: 'comet' };
        break;
      case 'warpJump': {
        const before = new Set(player.hand);
        this.draw(playerId, 3);
        const drawn = player.hand.filter(uid => !before.has(uid));
        if (drawn.length < 2) return null;
        for (const cards of permutations(drawn, 2)) actions.push({ type: 'eventChoice', eventId: context.eventId, cards });
        extra = { kind: 'warpJump', drawn };
        this.emit('eventEffect', `${player.name} 抽 3 张牌，需选择 2 张放回牌库顶`, { playerId, eventId: context.eventId });
        break;
      }
      default:
        return null;
    }
    return { ...base, ...extra, actions };
  }

  resolveEventChoice(action, pending) {
    const s = this.state;
    const context = s.eventContext;
    const player = s.players[pending.player];
    s.pending = null;
    if (!context) return;
    switch (pending.kind) {
      case 'blackHole':
        for (const cardId of action.targets || []) {
          player.hand.splice(player.hand.indexOf(cardId), 1);
          player.discard.push(cardId);
        }
        this.loseAuthority(player.id, 4 * (2 - (action.targets || []).length));
        this.emit('eventEffect', `${player.name} 弃 ${(action.targets || []).length} 张牌`, { playerId: player.id, eventId: pending.eventId });
        break;
      case 'bombardment':
        if (action.baseId) this.destroyBase(action.baseId);
        else this.loseAuthority(player.id, 6);
        this.emit('eventEffect', `${player.name} ${action.baseId ? '摧毁一座己方基地' : '失去 6 权威'}`, { playerId: player.id, eventId: pending.eventId });
        break;
      case 'comet':
        for (const cardId of action.targets || []) this.scrapFrom(player, cardId);
        this.emit('eventEffect', `${player.name} 销毁 ${(action.targets || []).length} 张牌`, { playerId: player.id, eventId: pending.eventId });
        break;
      case 'warpJump':
        for (const cardId of action.cards || []) player.hand.splice(player.hand.indexOf(cardId), 1);
        player.deck.unshift(...(action.cards || []));
        this.emit('eventEffect', `${player.name} 将 2 张牌放回牌库顶`, { playerId: player.id, eventId: pending.eventId });
        break;
      default:
        break;
    }
    context.index++;
    this.advanceEvent();
  }

  refreshAllies() {
    for (const player of this.state.players) {
      for (const uid of player.inPlay) {
        const def = getCardDef(uid, this.state);
        if (!def.ally && !def.doubleAlly) continue;
        const factions = getFactions(uid, this.state);
        let allies = 0;
        for (const otherUid of player.inPlay) {
          if (otherUid === uid) continue;
          const other = getCardDef(otherUid, this.state);
          if (other.allAlly || getFactions(otherUid, this.state).some(f => factions.includes(f))) allies++;
        }
        if (def.ally && !player.triggered[uid] && allies >= 1) {
          player.triggered[uid] = true;
          this.emit('allyReady', `${player.name} 的 ${def.name} 同盟能力已触发`, { playerId: player.id, cardId: uid });
        }
        // 双同盟：需要另外两张同阵营卡在场（官方 Double Ally）。
        if (def.doubleAlly && !player.triggeredDouble[uid] && allies >= 2) {
          player.triggeredDouble[uid] = true;
          this.emit('allyReady', `${player.name} 的 ${def.name} 双同盟能力已触发`, { playerId: player.id, cardId: uid });
        }
      }
    }
  }

  legalActions() {
    const s = this.state;
    if (s.status !== 'playing') return [];
    if (s.pending) return this.pendingActions();
    const player = s.players[s.activePlayer];
    if (player.eliminated) return [];
    const actions = [];
    for (const uid of player.hand) actions.push(...this.playActions(uid));
    for (const uid of player.inPlay) actions.push(...this.abilityActions(uid));
    actions.push(...this.buyActions());
    actions.push(...this.attackActions());
    actions.push(...this.transferActions());
    actions.push(...this.emperorMoveActions());
    actions.push({ type: 'endTurn' });
    return actions;
  }

  pendingActions() {
    const p = this.state.pending;
    const player = this.state.players[p.player];
    if (p.type === 'discard') return unique(player.hand).map(cardId => ({ type: 'discard', cardId }));
    if (p.type === 'targetDiscard') return p.candidates.map(targetId => ({ type: 'targetDiscard', targetId }));
    if (p.type === 'scrapMandatory') return unique(player.hand).map(cardId => ({ type: 'selectScrap', cardId }));
    if (p.type === 'eventChoice') return p.actions;
    throw new Error(`未知待决动作: ${p.type}`);
  }

  /** 免费/降价获取的费用与类型筛选；交易行空位与无费用卡一律不合法。 */
  matchesAcquireSpec(cardId, spec = {}) {
    if (!cardId) return false;
    const def = CARD_DEFS[this.state.cards[cardId].id];
    if (!def || def.cost === null || def.cost === undefined) return false;
    if (spec.maxCost !== undefined && def.cost > spec.maxCost) return false;
    if (spec.type && def.type !== spec.type) return false;
    return true;
  }

  playActions(uid) {
    const s = this.state;
    const player = s.players[s.activePlayer];
    const raw = CARD_DEFS[s.cards[uid].id];
    let copies = [null];
    if (raw.copyShip) {
      const ships = player.inPlay.filter(other => CARD_DEFS[s.cards[other].id].type === 'ship' && !CARD_DEFS[s.cards[other].id].copyShip);
      if (ships.length) copies = ships;
    }
    if (raw.copyBase) {
      const bases = alivePlayers(s).flatMap(owner => owner.inPlay.filter(other =>
        CARD_DEFS[s.cards[other].id].type === 'base' && !CARD_DEFS[s.cards[other].id].copyBase && other !== uid
      ));
      if (bases.length) copies = bases;
    }
    const actions = [];
    for (const copy of copies) {
      const def = copy ? getCardDef(copy, s) : raw;
      if (def.type === 'ship' && def.primaryChoice) {
        def.primaryChoice.forEach((effect, choice) => {
          if (effect.acquireFreeMax !== undefined) {
            const rows = s.tradeRow.map((cardId, row) => ({ cardId, row }))
              .filter(({ cardId }) => cardId && CARD_DEFS[s.cards[cardId].id].cost !== null && CARD_DEFS[s.cards[cardId].id].cost <= effect.acquireFreeMax);
            if (rows.length) for (const { row } of rows) actions.push({ type: 'play', cardId: uid, copy, choice, row });
            else actions.push({ type: 'play', cardId: uid, copy, choice });
          } else actions.push({ type: 'play', cardId: uid, copy, choice });
        });
      } else if (def.type === 'ship' && def.primary?.acquireCheapFree) {
        const spec = def.primary.acquireCheapFree;
        const rows = s.tradeRow.map((cardId, row) => ({ cardId, row })).filter(({ cardId }) => this.matchesAcquireSpec(cardId, spec));
        for (const { row } of rows) actions.push({ type: 'play', cardId: uid, copy, row });
        if (!rows.length) actions.push({ type: 'play', cardId: uid, copy });
      } else if (def.type === 'ship' && def.primary?.scrapRowGainCostCombat) {
        s.tradeRow.forEach((cardId, row) => {
          if (cardId && CARD_DEFS[s.cards[cardId].id].cost !== null) actions.push({ type: 'play', cardId: uid, copy, row });
        });
      } else actions.push({ type: 'play', cardId: uid, copy });
    }
    return actions;
  }

  abilityActions(uid) {
    const s = this.state;
    const player = s.players[s.activePlayer];
    const def = getCardDef(uid, s);
    const used = player.used[uid] || [];
    const actions = [];
    const ability = (kind, extra = {}) => actions.push({ type: 'ability', cardId: uid, ability: kind, ...extra });

    if (def.type === 'base' && !used.includes('primary')) {
      if (def.primaryChoice) {
        def.primaryChoice.forEach((effect, choice) => {
          if (effect.recycle) {
            for (const targets of combinations(unique(player.hand), effect.recycle)) ability('primary', { choice, targets });
          } else ability('primary', { choice });
        });
      } else if (def.primary?.scrapOwn) {
        const candidates = unique(def.primary.zones.flatMap(zone => player[zone]));
        for (const targets of combinations(candidates, def.primary.scrapOwn, def.primary.minScrap ?? def.primary.scrapOwn)) ability('primary', { targets });
      } else if (def.primary?.discardThenDraw) {
        for (const targets of combinations(unique(player.hand), def.primary.discardThenDraw, 0)) ability('primary', { targets });
      } else if (def.primary?.depot) {
        for (const targets of combinations(unique(player.hand), 2, 0)) {
          for (const resource of ['trade', 'combat']) ability('primary', { targets, resource });
        }
      } else if (def.primary) ability('primary');
    }

    if (def.optionalPrimary && !used.includes('optional')) {
      if (def.optionalPrimary.scrapOwn) {
        const candidates = unique(def.optionalPrimary.zones.flatMap(zone => player[zone]));
        // minScrap 支持「至多 N 张」：允许 1..N，而不是只能选满 N 张。
        for (const targets of combinations(candidates, def.optionalPrimary.scrapOwn, def.optionalPrimary.minScrap ?? def.optionalPrimary.scrapOwn)) ability('optional', { targets });
      }
      if (def.optionalPrimary.scrapRow) {
        const rows = s.tradeRow.map((cardId, row) => cardId ? row : null).filter(row => row !== null);
        for (const chosen of combinations(rows, def.optionalPrimary.scrapRow)) {
          ability('optional', def.optionalPrimary.scrapRow === 1 ? { row: chosen[0] } : { rows: chosen });
        }
      }
      if (def.optionalPrimary.destroyBase) {
        for (const targetId of this.legalEnemyBases()) ability('optional', { targetId });
      }
    }

    // 同盟 / 双同盟共用同一套动作展开，只是触发门槛与能力键不同。
    // 双同盟仍以 ability: 'ally' 暴露给脚本（旧脚本不必理解新键），另带 double: true 标记。
    const pushFaction = (kind, effect, double = false) => {
      if (!effect) return;
      const extra = double ? { double: true } : {};
      if (effect.acquireShipFree) {
        s.tradeRow.forEach((cardId, row) => {
          if (cardId && CARD_DEFS[s.cards[cardId].id].type === 'ship') ability(kind, { row, ...extra });
        });
      } else if (effect.acquireCheapFree) {
        s.tradeRow.forEach((cardId, row) => {
          if (cardId && this.matchesAcquireSpec(cardId, effect.acquireCheapFree)) ability(kind, { row, ...extra });
        });
      } else if (effect.destroyAndOrScrap) {
        const bases = this.legalEnemyBases();
        const rows = s.tradeRow.map((cardId, row) => cardId ? row : null).filter(row => row !== null);
        for (const targetId of bases) ability(kind, { targetId, ...extra });
        for (const row of rows) ability(kind, { row, ...extra });
        for (const targetId of bases) for (const row of rows) ability(kind, { targetId, row, ...extra });
      } else if (effect.destroyBase) {
        for (const targetId of this.legalEnemyBases()) ability(kind, { targetId, ...extra });
      } else if (effect.scrapOwn) {
        const candidates = unique(effect.zones.flatMap(zone => player[zone]));
        for (const targets of combinations(candidates, effect.scrapOwn, effect.minScrap ?? effect.scrapOwn)) ability(kind, { targets, ...extra });
      } else if (effect.scrapRowGainCostCombat) {
        s.tradeRow.forEach((cardId, row) => {
          if (cardId && CARD_DEFS[s.cards[cardId].id].cost !== null) ability(kind, { row, ...extra });
        });
      } else if (effect.discardThenDraw) {
        for (const targets of combinations(unique(player.hand), effect.discardThenDraw, 0)) ability(kind, { targets, ...extra });
      } else ability(kind, extra);
    };

    if (def.ally && player.triggered[uid] && !used.includes('ally')) pushFaction('ally', def.ally);
    if (def.doubleAlly && player.triggeredDouble[uid] && !used.includes('ally#2')) pushFaction('ally', def.doubleAlly, true);

    if (def.scrap && !used.includes('scrap')) {
      if (def.scrap.destroyBase) {
        ability('scrap', { targetId: null });
        for (const targetId of this.legalEnemyBases()) ability('scrap', { targetId });
      } else ability('scrap');
    }
    return actions;
  }

  buyActions() {
    const s = this.state;
    const player = s.players[s.activePlayer];
    const actions = [];
    s.tradeRow.forEach((cardId, row) => {
      if (cardId && player.trade >= CARD_DEFS[s.cards[cardId].id].cost) actions.push({ type: 'buy', row });
    });
    if (s.explorers > 0 && player.trade >= 2) actions.push({ type: 'buy', explorer: true });
    return actions;
  }

  transferActions() {
    if (!isTeamMode(this.state.mode)) return [];
    const player = this.state.players[this.state.activePlayer];
    const actions = [];
    for (const teammate of teammates(this.state, player.id)) {
      for (const resource of ['trade', 'combat']) {
        for (let amount = 1; amount <= player[resource]; amount++) actions.push({ type: 'transfer', targetId: teammate.id, resource, amount });
      }
    }
    return actions;
  }

  /** 大将战专属：花 1 贸易把弃牌堆一张牌交给相邻队友（队内顺序相邻，环形）。 */
  emperorMoveActions() {
    const s = this.state;
    if (s.mode !== 'emperor') return [];
    const player = s.players[s.activePlayer];
    if (player.trade < 1 || !player.discard.length) return [];
    const order = s.teams[teamOf(s, player.id)].players;
    const index = order.indexOf(player.id);
    const neighbors = [...new Set([
      order[(index + 1) % order.length],
      order[(index - 1 + order.length) % order.length]
    ])].filter(id => id !== player.id && !s.players[id].eliminated);
    const actions = [];
    for (const uid of [...new Set(player.discard)]) {
      for (const targetId of neighbors) actions.push({ type: 'moveCard', cardId: uid, targetId });
    }
    return actions;
  }

  teamHasOutpost(owner) {
    if (!isTeamMode(this.state.mode)) return this.state.players[owner].inPlay.some(uid => getCardDef(uid, this.state).outpost);
    const team = this.state.teams[teamOf(this.state, owner)];
    return team.players.some(playerId => this.state.players[playerId].inPlay.some(uid => getCardDef(uid, this.state).outpost));
  }

  attackActions() {
    const s = this.state;
    const player = s.players[s.activePlayer];
    if (player.combat <= 0) return [];
    const actions = [];
    for (const opponent of alivePlayers(s)) {
      if (opponent.id === player.id) continue;
      for (const uid of opponent.inPlay) {
        const def = getCardDef(uid, s);
        if (def.type !== 'base' || !this.canAttackBase(player.id, opponent.id, uid)) continue;
        const needed = Math.max(1, def.defense - (s.damage[uid] || 0));
        const amount = Math.min(needed, player.combat);
        actions.push({ type: 'attack', targetType: 'base', targetId: uid, amount });
      }
      if (canAttackPlayer(s, player.id, opponent.id) && !this.teamHasOutpost(opponent.id)) {
        for (let amount = 1; amount <= player.combat; amount++) actions.push({ type: 'attack', targetType: 'player', targetId: opponent.id, amount });
      }
    }
    return actions;
  }

  canAttackBase(attacker, owner, uid) {
    if (!canTargetBase(this.state, attacker, owner)) return false;
    const hasOutpost = this.teamHasOutpost(owner);
    return !hasOutpost || getCardDef(uid, this.state).outpost;
  }

  legalEnemyBases() {
    const result = [];
    for (const opponent of alivePlayers(this.state)) {
      if (opponent.id === this.state.activePlayer) continue;
      for (const uid of opponent.inPlay) {
        if (getCardDef(uid, this.state).type === 'base' && this.canAttackBase(this.state.activePlayer, opponent.id, uid)) result.push(uid);
      }
    }
    return result;
  }

  applyAction(action) {
    const before = this.events.length;
    const legal = this.legalActions();
    if (!legal.some(candidate => sameAction(candidate, action))) {
      throw new Error(`非法动作: ${JSON.stringify(action)}；当前合法动作 ${legal.length} 个`);
    }
    if (this.state.pending) this.applyPending(action);
    else {
      switch (action.type) {
        case 'play': this.play(action); break;
        case 'ability': this.useAbility(action); break;
        case 'buy': this.buy(action); break;
        case 'attack': this.attack(action); break;
        case 'transfer': this.transfer(action); break;
        case 'moveCard': this.moveCard(action); break;
        case 'endTurn': this.endTurn(); break;
        default: throw new Error(`未知动作 ${action.type}`);
      }
    }
    this.refreshAllies();
    return this.events.slice(before);
  }

  applyPending(action) {
    const s = this.state;
    const pending = s.pending;
    const player = s.players[pending.player];
    if (action.type === 'discard') {
      const index = player.hand.indexOf(action.cardId);
      player.discard.push(player.hand.splice(index, 1)[0]);
      this.emit('discard', `${player.name} 弃掉 ${getCardDef(action.cardId, s).name}`, { playerId: player.id, cardId: action.cardId });
      pending.count--;
      if (pending.count <= 0 || !player.hand.length) s.pending = null;
    } else if (action.type === 'targetDiscard') {
      s.pending = null;
      this.requestDiscard(pending.actor, action.targetId, pending.count);
    } else if (action.type === 'selectScrap') {
      s.pending = null;
      this.scrapFrom(player, action.cardId);
    } else if (action.type === 'eventChoice') {
      this.resolveEventChoice(action, pending);
    }
  }

  transfer(action) {
    const player = this.state.players[this.state.activePlayer];
    const target = this.state.players[action.targetId];
    player[action.resource] -= action.amount;
    target.reserve[action.resource] += action.amount;
    this.emit('transfer', `${player.name} 向 ${target.name} 预留 ${action.amount} ${{ trade: '贸易', combat: '战斗' }[action.resource]}`, { playerId: player.id, targetId: target.id, resource: action.resource, amount: action.amount });
  }

  moveCard(action) {
    const s = this.state;
    const player = s.players[s.activePlayer];
    if (s.mode !== 'emperor') throw new Error('只有大将战支持移交弃牌');
    if (player.trade < 1) throw new Error('移交弃牌需要 1 贸易');
    const index = player.discard.indexOf(action.cardId);
    if (index < 0) throw new Error('该牌不在弃牌堆');
    const target = s.players[action.targetId];
    if (!target || target.eliminated) throw new Error('目标队友不可用');
    if (target.team !== player.team) throw new Error('只能交给队友');
    player.trade -= 1;
    player.discard.splice(index, 1);
    target.discard.push(action.cardId);
    s.cards[action.cardId].owner = target.id;
    this.emit('moveCard', `${player.name} 花 1 贸易把一张牌交给 ${target.name}`, { playerId: player.id, targetId: target.id, cardId: action.cardId });
  }

  play(action) {
    const s = this.state;
    const player = s.players[s.activePlayer];
    const uid = action.cardId;
    player.hand.splice(player.hand.indexOf(uid), 1);
    s.cards[uid].copiedFrom = action.copy || null;
    player.inPlay.push(uid);
    player.playedThisTurn.push(uid);
    player.used[uid] = [];
    const def = getCardDef(uid, s);
    this.emit('play', `${player.name} 打出 ${def.name}${action.copy ? `（复制 ${getCardDef(action.copy, s).name}）` : ''}`, { playerId: player.id, cardId: uid });
    const effect = def.primaryChoice ? def.primaryChoice[action.choice] : def.primary;
    if (def.type === 'ship' && effect) this.applySimpleEffect(player, effect);
    if (effect?.acquireFreeMax !== undefined && action.row !== undefined) {
      const cardId = s.tradeRow[action.row];
      if (cardId) {
        this.acquire(cardId, player, true, false);
        s.tradeRow[action.row] = null;
        this.refillTradeRow(action.row);
      }
    }
    if (effect?.scrapRowGainCostCombat && action.row !== undefined) {
      const cardId = s.tradeRow[action.row];
      if (cardId) {
        const cost = CARD_DEFS[s.cards[cardId].id].cost || 0;
        player.combat += cost;
        this.emit('resource', `${player.name} 销毁交易行卡牌，获得 ${cost} 战斗`, { playerId: player.id, combat: cost });
        this.scrapTradeRow(action.row);
      }
    }
    if (effect?.acquireCheapFree && action.row !== undefined) {
      const cardId = s.tradeRow[action.row];
      if (cardId) {
        this.acquire(cardId, player, true, !!effect.acquireCheapFree.toTop);
        s.tradeRow[action.row] = null;
        this.refillTradeRow(action.row);
      }
    }
    const fleetHQs = player.inPlay.filter(cardId => getCardDef(cardId, s).fleetHQ).length;
    if (def.type === 'ship' && fleetHQs) {
      player.combat += fleetHQs;
      this.emit('resource', `舰队总部使 ${def.name} 额外获得 ${fleetHQs} 战斗`, { playerId: player.id, combat: fleetHQs });
    }
    const empireBonus = player.inPlay.reduce((sum, cardId) => sum + (getCardDef(cardId, s).empireShipBonus || 0), 0);
    if (def.type === 'ship' && empireBonus && getFactions(uid, s).includes('empire')) {
      player.combat += empireBonus;
      this.emit('resource', `指挥中心使 ${def.name} 额外获得 ${empireBonus} 战斗`, { playerId: player.id, combat: empireBonus });
    }
    this.refreshAllies();
  }

  applySimpleEffect(player, effect) {
    const s = this.state;
    const gains = [];
    if (effect.trade) { player.trade += effect.trade; gains.push(`${effect.trade} 贸易`); }
    if (effect.combat) { player.combat += effect.combat; gains.push(`${effect.combat} 战斗`); }
    if (effect.combatIfEnemyBase && alivePlayers(s).some(p => p.id !== player.id && p.inPlay.some(uid => getCardDef(uid, s).type === 'base'))) {
      player.combat += effect.combatIfEnemyBase;
      gains.push(`${effect.combatIfEnemyBase} 战斗`);
    }
    const myBases = player.inPlay.filter(uid => getCardDef(uid, s).type === 'base').length;
    if (effect.combatIfTwoBases && myBases >= 2) {
      player.combat += effect.combatIfTwoBases;
      gains.push(`${effect.combatIfTwoBases} 战斗`);
    }
    if (effect.combatIfEnemyTwoBases && alivePlayers(s).some(p => p.id !== player.id
      && p.inPlay.filter(uid => getCardDef(uid, s).type === 'base').length >= 2)) {
      player.combat += effect.combatIfEnemyTwoBases;
      gains.push(`${effect.combatIfEnemyTwoBases} 战斗`);
    }
    if (effect.authorityIfTwoBases && myBases >= 2) {
      this.adjustAuthority(player.id, effect.authorityIfTwoBases);
      gains.push(`${effect.authorityIfTwoBases} 权威`);
    }
    if (effect.combatPerScrapOwn && player.scrappedThisTurn) {
      const amount = effect.combatPerScrapOwn * player.scrappedThisTurn;
      player.combat += amount;
      gains.push(`${amount} 战斗`);
    }
    if (effect.authority) { this.adjustAuthority(player.id, effect.authority); gains.push(`${effect.authority} 权威`); }
    if (gains.length) this.emit('resource', `${player.name} 获得 ${gains.join('、')}`, { playerId: player.id, trade: effect.trade || 0, combat: effect.combat || 0, authority: effect.authority || 0 });
    if (effect.draw) this.draw(player.id, effect.draw);
    if (effect.drawIfTwoBases && player.inPlay.filter(uid => getCardDef(uid, s).type === 'base').length >= 2) this.draw(player.id, effect.drawIfTwoBases);
    if (effect.drawIfThreeBases && player.inPlay.filter(uid => getCardDef(uid, s).type === 'base').length >= 3) {
      if (effect.authorityIfThreeBases) {
        this.adjustAuthority(player.id, effect.authorityIfThreeBases);
        this.emit('resource', `${player.name} 获得 ${effect.authorityIfThreeBases} 权威`, { playerId: player.id, authority: effect.authorityIfThreeBases });
      }
      this.draw(player.id, effect.drawIfThreeBases);
    }
    if (effect.drawBlobPlayed) {
      const count = player.playedThisTurn.filter(uid => CARD_DEFS[s.cards[uid].id].faction === 'blob').length;
      this.draw(player.id, count);
    }
    if (effect.topDeckNextShip) {
      player.topDeckNextShip = true;
      this.emit('effect', `${player.name} 的下一艘购入飞船将置于牌库顶`, { playerId: player.id });
    }
    if (effect.topDeckNextBase) {
      player.topDeckNextBase = true;
      this.emit('effect', `${player.name} 的下一座购入基地将置于牌库顶`, { playerId: player.id });
    }
    if (effect.topDeckNextAny) {
      player.topDeckNextAny = true;
      this.emit('effect', `${player.name} 下一张获得的牌将置于牌库顶`, { playerId: player.id });
    }
    if (effect.nextAcquireToHand) {
      player.nextAcquireToHand = true;
      this.emit('effect', `${player.name} 下一张获得的牌将置入手牌`, { playerId: player.id });
    }
    if (effect.discardOpponent) {
      const candidates = alivePlayers(s).filter(p => canAttackPlayer(s, player.id, p.id)).map(p => p.id);
      if (candidates.length === 1) this.requestDiscard(player.id, candidates[0], effect.discardOpponent);
      else if (candidates.length > 1) s.pending = { type: 'targetDiscard', actor: player.id, player: player.id, count: effect.discardOpponent, candidates };
    }
  }

  requestDiscard(actor, targetId, count) {
    const target = this.state.players[targetId];
    if (!target.hand.length) {
      this.emit('discard', `${target.name} 没有手牌可弃`, { playerId: targetId });
      return;
    }
    this.state.pending = { type: 'discard', actor, player: targetId, count };
    this.emit('effect', `${target.name} 必须选择 ${Math.min(count, target.hand.length)} 张手牌弃掉`, { playerId: targetId });
  }

  useAbility(action) {
    const s = this.state;
    const player = s.players[s.activePlayer];
    const uid = action.cardId;
    const def = getCardDef(uid, s);
    const kind = action.ability;
    const isDouble = !!action.double;
    player.used[uid] ||= [];
    player.used[uid].push(isDouble ? 'ally#2' : kind);
    this.emit('ability', `${player.name} 发动 ${def.name} 的${{ primary: '主要', optional: '可选', ally: isDouble ? '双同盟' : '同盟', scrap: '销毁' }[kind]}能力`, { playerId: player.id, cardId: uid, ability: kind, double: isDouble });

    if (kind === 'scrap') this.scrapFrom(player, uid);
    let effect = kind === 'ally' ? (isDouble ? def.doubleAlly : def.ally) : kind === 'scrap' ? def.scrap : kind === 'optional' ? def.optionalPrimary : def.primary;
    if (def.primaryChoice && kind === 'primary') effect = def.primaryChoice[action.choice];

    if (kind === 'primary' && def.primary?.scrapOwnMandatory) {
      this.applySimpleEffect(player, { draw: def.primary.draw });
      if (player.hand.length) s.pending = { type: 'scrapMandatory', actor: player.id, player: player.id };
      return;
    }
    if (effect?.scrapOwn) {
      let extraCombat = 0;
      for (const cardId of action.targets || []) {
        if (effect.gainCostCombat) extraCombat += CARD_DEFS[s.cards[cardId].id].cost || 0;
        this.scrapFrom(player, cardId);
      }
      if (extraCombat) {
        player.combat += extraCombat;
        this.emit('resource', `${player.name} 按销毁卡牌费用获得 ${extraCombat} 战斗`, { playerId: player.id, combat: extraCombat });
      }
      if (effect.combatIfScrap && (action.targets || []).length) {
        player.combat += effect.combatIfScrap;
        this.emit('resource', `${player.name} 因销毁手牌获得 ${effect.combatIfScrap} 战斗`, { playerId: player.id, combat: effect.combatIfScrap });
      }
      if (effect.drawPerScrap) this.draw(player.id, (action.targets || []).length);
      return;
    }
    if (effect?.discardThenDraw) {
      for (const cardId of action.targets || []) {
        player.hand.splice(player.hand.indexOf(cardId), 1);
        player.discard.push(cardId);
      }
      if ((action.targets || []).length) this.draw(player.id, (action.targets || []).length);
      return;
    }
    if (effect?.depot) {
      for (const cardId of action.targets || []) {
        player.hand.splice(player.hand.indexOf(cardId), 1);
        player.discard.push(cardId);
      }
      const amount = 2 * (action.targets || []).length;
      if (amount) player[action.resource === 'combat' ? 'combat' : 'trade'] += amount;
      this.emit('resource', `${player.name} 弃 ${(action.targets || []).length} 张牌，获得 ${amount} ${{ trade: '贸易', combat: '战斗' }[action.resource] || '贸易'}`, { playerId: player.id });
      return;
    }
    if (effect?.recycle) {
      for (const cardId of action.targets || []) {
        player.hand.splice(player.hand.indexOf(cardId), 1);
        player.discard.push(cardId);
      }
      this.emit('discard', `${player.name} 回收手牌 ${(action.targets || []).length} 张`, { playerId: player.id });
      this.draw(player.id, (action.targets || []).length);
      return;
    }
    if (effect?.scrapRow) {
      const rows = action.rows || (action.row !== undefined ? [action.row] : []);
      if (rows.length > 1) {
        for (const row of rows) this.scrapTradeRow(row, false);
        s.eventRefillQueue.push(...rows);
        this.processEventRefills();
      } else if (rows.length === 1) this.scrapTradeRow(rows[0]);
      return;
    }
    if (effect?.acquireShipFree) {
      const cardId = s.tradeRow[action.row];
      this.acquire(cardId, player, true, true);
      s.tradeRow[action.row] = null;
      this.refillTradeRow(action.row);
      return;
    }
    if (effect?.acquireCheapFree) {
      const cardId = s.tradeRow[action.row];
      if (cardId) {
        this.acquire(cardId, player, true, false, effect.acquireCheapFree.toHand);
        s.tradeRow[action.row] = null;
        this.refillTradeRow(action.row);
      }
      return;
    }
    if (effect?.destroyAndOrScrap) {
      if (action.targetId) this.destroyBase(action.targetId);
      if (action.row !== undefined) this.scrapTradeRow(action.row);
      return;
    }
    if (effect?.destroyBase && kind !== 'scrap') {
      if (action.targetId) this.destroyBase(action.targetId);
      return;
    }
    this.applySimpleEffect(player, effect || {});
    if (kind === 'scrap' && effect?.destroyBase && action.targetId) this.destroyBase(action.targetId);
  }

  scrapFrom(player, uid) {
    const zones = ['hand', 'discard', 'inPlay'];
    const zone = zones.find(name => player[name].includes(uid));
    if (!zone) throw new Error(`${uid} 不在可销毁区域`);
    player[zone].splice(player[zone].indexOf(uid), 1);
    if (zone === 'hand' || zone === 'discard') player.scrappedThisTurn = (player.scrappedThisTurn || 0) + 1;
    const id = this.state.cards[uid].id;
    if (id === 'explorer') this.state.explorers++;
    else this.state.scrapHeap.push(uid);
    delete this.state.damage[uid];
    this.emit('scrap', `${player.name} 销毁 ${getCardDef(uid, this.state).name}`, { playerId: player.id, cardId: uid });
  }

  scrapTradeRow(row, refill = true) {
    const uid = this.state.tradeRow[row];
    if (!uid) return;
    this.emit('scrap', `交易行的 ${getCardDef(uid, this.state).name} 被销毁`, { cardId: uid });
    this.state.scrapHeap.push(uid);
    this.state.tradeRow[row] = null;
    if (refill) this.refillTradeRow(row);
  }

  destroyBase(uid) {
    const owner = this.state.players[this.state.cards[uid].owner];
    owner.inPlay.splice(owner.inPlay.indexOf(uid), 1);
    owner.discard.push(uid);
    delete this.state.damage[uid];
    this.emit('destroy', `${owner.name} 的 ${getCardDef(uid, this.state).name} 被摧毁`, { playerId: owner.id, cardId: uid });
  }

  buy(action) {
    const player = this.state.players[this.state.activePlayer];
    let uid;
    let row;
    if (action.explorer) {
      uid = this.makeCard('explorer', player.id);
      this.state.explorers--;
    } else {
      row = action.row;
      uid = this.state.tradeRow[row];
      this.state.cards[uid].owner = player.id;
    }
    const def = CARD_DEFS[this.state.cards[uid].id];
    player.trade -= def.cost;
    this.acquire(uid, player, false, false, false);
    if (row !== undefined) {
      this.state.tradeRow[row] = null;
      this.refillTradeRow(row);
    }
    this.emit('buy', `${player.name} 以 ${def.cost} 贸易获得 ${def.name}`, { playerId: player.id, cardId: uid, cost: def.cost });
  }

  acquire(uid, player, free, forceTopDeck, forceHand = false) {
    const s = this.state;
    const def = CARD_DEFS[s.cards[uid].id];
    s.cards[uid].owner = player.id;
    const playedFaction = def.toHandIfFaction
      ? player.playedThisTurn.some(cardId => getFactions(cardId, s).includes(def.toHandIfFaction))
      : false;
    const toHand = forceHand || player.nextAcquireToHand || playedFaction;
    const top = !toHand && (forceTopDeck || player.topDeckNextAny || (def.type === 'ship' && player.topDeckNextShip) || (def.type === 'base' && player.topDeckNextBase));
    if (toHand) player.hand.push(uid);
    else if (top) player.deck.unshift(uid);
    else player.discard.push(uid);
    if (def.type === 'ship') player.topDeckNextShip = false;
    if (def.type === 'base') player.topDeckNextBase = false;
    if (player.topDeckNextAny) player.topDeckNextAny = false;
    if (player.nextAcquireToHand) player.nextAcquireToHand = false;
    const destination = toHand ? '手牌' : top ? '牌库顶' : '弃牌堆';
    this.emit('acquire', `${player.name} 将 ${def.name} ${free ? '免费' : ''}获得并置于${destination}`, { playerId: player.id, cardId: uid });
  }

  attack(action) {
    const s = this.state;
    const player = s.players[s.activePlayer];
    player.combat -= action.amount;
    if (action.targetType === 'base') {
      const uid = action.targetId;
      s.damage[uid] = (s.damage[uid] || 0) + action.amount;
      const def = getCardDef(uid, s);
      this.emit('attack', `${player.name} 对 ${def.name} 造成 ${action.amount} 点攻击`, { playerId: player.id, cardId: uid, amount: action.amount });
      if (s.damage[uid] >= def.defense) this.destroyBase(uid);
    } else {
      const target = s.players[action.targetId];
      this.adjustAuthority(target.id, -action.amount);
      this.emit('attack', `${player.name} 对 ${target.name} 造成 ${action.amount} 点伤害`, { playerId: player.id, targetId: target.id, amount: action.amount });
      const remaining = isTeamMode(s.mode) ? s.teams[teamOf(s, target.id)].authority : target.authority;
      if (remaining <= 0) this.eliminate(target.id, player.id);
    }
  }

  eliminate(playerId, attacker) {
    const s = this.state;
    const player = s.players[playerId];
    if (player.eliminated) return;
    if (s.mode === 'emperor') {
      player.eliminated = true;
      player.authority = 0;
      const emperorSeat = s.emperors[teamOf(s, playerId)];
      const emperor = s.players[emperorSeat];
      // 提督阵亡时，可把一张牌交给本队大将；自动对局默认取弃牌堆第一张，保证可复现。
      let moved = null;
      if (!isEmperor(s, playerId) && emperor && !emperor.eliminated) {
        moved = player.discard[0] || player.hand[0] || player.deck[0] || null;
        if (moved) {
          for (const zone of ['discard', 'hand', 'deck']) {
            const index = player[zone].indexOf(moved);
            if (index >= 0) { player[zone].splice(index, 1); break; }
          }
          emperor.discard.push(moved);
          s.cards[moved].owner = emperorSeat;
        }
      }
      for (const zone of ['deck', 'hand', 'discard', 'inPlay']) {
        for (const uid of player[zone].splice(0)) {
          if (s.cards[uid].id === 'explorer') s.explorers++;
          else s.scrapHeap.push(uid);
        }
      }
      this.emit('eliminated', `${player.name} 被击败${moved ? '，一张牌移交本队大将' : ''}`, { playerId, attacker });
      if (s.pending?.player === playerId) s.pending = null;
      if (isEmperor(s, playerId)) {
        const losingTeam = teamOf(s, playerId);
        const winningTeam = 1 - losingTeam;
        for (const memberId of s.teams[losingTeam].players) {
          const member = s.players[memberId];
          if (member.eliminated) continue;
          member.eliminated = true;
          for (const zone of ['deck', 'hand', 'discard', 'inPlay']) {
            for (const uid of member[zone].splice(0)) {
              if (s.cards[uid].id === 'explorer') s.explorers++;
              else s.scrapHeap.push(uid);
            }
          }
        }
        s.winningTeam = winningTeam;
        s.winner = s.teams[winningTeam].players.find(id => !s.players[id].eliminated);
        s.status = 'finished';
        s.pending = null;
        s.eventContext = null;
        s.winReason = '大将被击败，其队伍失败';
        this.emit('gameOver', `${s.players[s.winner].name} 所在舰队获胜：${s.winReason}`, { winner: s.winner, winningTeam });
      }
      return;
    }
    if (isTeamMode(s.mode)) {
      const losing = s.teams[teamOf(s, playerId)];
      const winning = s.teams[1 - losing.id];
      losing.authority = 0;
      this.syncTeamAuthority(losing.id);
      for (const memberId of losing.players) {
        const member = s.players[memberId];
        member.eliminated = true;
        for (const zone of ['deck', 'hand', 'discard', 'inPlay']) {
          for (const uid of member[zone].splice(0)) {
            if (s.cards[uid].id === 'explorer') s.explorers++;
            else s.scrapHeap.push(uid);
          }
        }
        this.emit('eliminated', `${member.name} 所在舰队权威归零`, { playerId: memberId, attacker });
      }
      s.winner = winning.players.find(id => !s.players[id].eliminated);
      s.winningTeam = winning.id;
      s.status = 'finished';
      s.pending = null;
      s.eventContext = null;
      s.winReason = `${winning.name}存活，对方舰队权威归零`;
      this.emit('gameOver', `${winning.name} 获胜：${s.winReason}`, { winner: s.winner, winningTeam: winning.id });
      return;
    }
    player.eliminated = true;
    player.authority = 0;
    for (const zone of ['deck', 'hand', 'discard', 'inPlay']) {
      for (const uid of player[zone].splice(0)) {
        if (s.cards[uid].id === 'explorer') s.explorers++;
        else s.scrapHeap.push(uid);
      }
    }
    this.emit('eliminated', `${player.name} 的权威降至 0，已被击败`, { playerId, attacker });
    if (s.pending?.player === playerId) s.pending = null;
    if (s.mode === 'firstBlood') {
      s.winner = nextAlive(s, playerId, -1);
      s.status = 'finished';
      s.winReason = '首位玩家败北，其右手边玩家获胜';
    } else if (alivePlayers(s).length === 1) {
      s.winner = alivePlayers(s)[0].id;
      s.status = 'finished';
      s.winReason = '唯一存活玩家获胜';
    }
    if (s.status === 'finished') {
      s.pending = null;
      this.emit('gameOver', `${s.players[s.winner].name} 获胜：${s.winReason}`, { winner: s.winner });
    }
  }

  endTurn() {
    const s = this.state;
    const player = s.players[s.activePlayer];
    for (const uid of player.inPlay) {
      const raw = CARD_DEFS[s.cards[uid].id];
      if (raw.copyShip || raw.copyBase) s.cards[uid].copiedFrom = null;
    }
    for (const uid of player.inPlay.splice(0)) {
      if (getCardDef(uid, s).type === 'ship') player.discard.push(uid);
      else player.inPlay.push(uid);
    }
    player.discard.push(...player.hand.splice(0));
    player.trade = 0;
    player.combat = 0;
    player.used = {};
    player.triggered = {};
    player.triggeredDouble = {};
    player.topDeckNextShip = false;
    player.topDeckNextBase = false;
    player.topDeckNextAny = false;
    player.nextAcquireToHand = false;
    player.scrappedThisTurn = 0;
    player.playedThisTurn = [];
    s.damage = {};
    this.draw(player.id, 5, false);
    this.emit('endTurn', `${player.name} 结束回合并补至 5 张手牌`, { playerId: player.id });
    s.activePlayer = nextAlive(s, player.id, 1);
    s.turn++;
    if (s.activePlayer !== null) this.beginTurn(s.activePlayer);
    this.refreshAllies();
  }

  getView(perspective = 'spectator') {
    const s = clone(this.state);
    const visible = new Set([...s.tradeRow.filter(Boolean), ...s.scrapHeap]);
    s.tradeDeckCount = s.tradeDeck.length;
    s.eventCardsRemaining = s.tradeDeck.filter(uid => CARD_DEFS[s.cards[uid].id].type === 'event').length;
    s.tradeDeck = [];
    for (const player of s.players) {
      player.deckCount = player.deck.length;
      player.deck = [];
      player.handCount = player.hand.length;
      player.discard.forEach(uid => visible.add(uid));
      player.inPlay.forEach(uid => visible.add(uid));
      if (perspective === 'spectator' || Number(perspective) === player.id) player.hand.forEach(uid => visible.add(uid));
      else player.hand = [];
      player.isViewer = Number(perspective) === player.id;
    }
    for (const [uid, card] of Object.entries(s.cards)) {
      if (visible.has(uid)) {
        const def = getCardDef(uid, this.state);
        card.name = def.name;
        card.en = def.en;
        card.type = def.type;
        card.faction = def.faction;
        card.set = def.set;
        card.cost = def.cost;
        card.defense = def.defense;
        card.outpost = !!def.outpost;
        card.text = def.text;
        card.factions = getFactions(uid, this.state);
      } else delete s.cards[uid];
    }
    s.perspective = perspective;
    return s;
  }
}

export function createGame(config) {
  return new Game(config);
}

export function describeAction(state, action) {
  const name = uid => uid && state.cards[uid] ? getCardDef(uid, state).name : uid;
  switch (action.type) {
    case 'play': return `打出 ${name(action.cardId)}${action.copy ? ` 复制 ${name(action.copy)}` : ''}${action.choice !== undefined ? `（选项 ${action.choice + 1}）` : ''}`;
    case 'ability': return `${name(action.cardId)}：${{ primary: '主要', optional: '可选', ally: action.double ? '双同盟' : '同盟', scrap: '销毁' }[action.ability]}能力${action.targetId ? ` → ${name(action.targetId)}` : ''}${action.row !== undefined ? ` → 交易行 ${action.row + 1}` : ''}${action.rows ? ` → 交易行 ${action.rows.map(row => row + 1).join('/')}` : ''}${action.targets?.length ? ` → ${action.targets.map(name).join('、')}` : ''}`;
    case 'buy': return action.explorer ? '购买探索者' : `购买交易行 ${action.row + 1} 号位卡牌`;
    case 'attack': return action.targetType === 'player' ? `攻击 ${state.players[action.targetId].name} ${action.amount} 点` : `攻击 ${name(action.targetId)} ${action.amount} 点`;
    case 'transfer': return `向 ${state.players[action.targetId].name} 预留 ${action.amount} ${{ trade: '贸易', combat: '战斗' }[action.resource]}`;
    case 'moveCard': return `花 1 贸易把 ${state.cards[action.cardId]?.id || '一张牌'} 交给 ${state.players[action.targetId].name}`;
    case 'eventChoice': return action.pay ? '事件选择：失去 6 权威' : action.baseId ? `事件选择：摧毁 ${name(action.baseId)}` : action.cards ? `事件选择：将 ${action.cards.map(name).join('、')} 放回牌库顶` : `事件选择：${(action.targets || []).map(name).join('、') || '跳过'}`;
    case 'discard': return `弃掉 ${name(action.cardId)}`;
    case 'selectScrap': return `选择销毁 ${name(action.cardId)}`;
    case 'targetDiscard': return `指定 ${state.players[action.targetId].name} 弃牌`;
    case 'endTurn': return '结束回合';
    default: return JSON.stringify(action);
  }
}
