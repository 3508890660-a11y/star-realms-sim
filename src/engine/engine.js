import { CARD_DEFS, buildTradeDeckIds, normalizeExpansions, getCardDef, getFactions } from './cards.js';
import { hashSeed, shuffle } from './rng.js';
import { MODES, validateMode, alivePlayers, nextAlive, canAttackPlayer, canTargetBase, teamOf, teammates } from './modes.js';

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
    const isTeam = mode === 'team2v2';
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
        id, name, team: isTeam ? id % 2 : null,
        authority: isTeam ? 75 : 50, trade: 0, combat: 0,
        reserve: { trade: 0, combat: 0 },
        deck: [], hand: [], discard: [], inPlay: [],
        used: {}, triggered: {}, topDeckNextShip: false,
        topDeckNextAny: false, nextAcquireToHand: false,
        scrappedThisTurn: 0, playedThisTurn: [], eliminated: false
      })),
      teams: isTeam ? [
        { id: 0, name: '第一舰队', players: [0, 2], authority: 75 },
        { id: 1, name: '第二舰队', players: [1, 3], authority: 75 }
      ] : [],
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
      const handSize = this.state.mode === 'standard' ? (player.id === 0 ? 3 : 5) : Math.min(5, player.id + 3);
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
    if (this.state.mode === 'team2v2') {
      const team = this.state.teams[teamOf(this.state, playerId)];
      team.authority += delta;
      this.syncTeamAuthority(team.id);
    } else this.state.players[playerId].authority += delta;
  }

  loseAuthority(playerId, amount) {
    const before = this.state.mode === 'team2v2'
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
    if (this.state.mode === 'team2v2') {
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
        if (!def.ally || player.triggered[uid]) continue;
        const factions = getFactions(uid, this.state);
        const triggered = player.inPlay.some(otherUid => {
          if (otherUid === uid) return false;
          const other = getCardDef(otherUid, this.state);
          return other.allAlly || getFactions(otherUid, this.state).some(f => factions.includes(f));
        });
        if (triggered) {
          player.triggered[uid] = true;
          this.emit('allyReady', `${player.name} 的 ${def.name} 同盟能力已触发`, { playerId: player.id, cardId: uid });
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
        for (const targets of combinations(candidates, def.primary.scrapOwn)) ability('primary', { targets });
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
        for (const targets of combinations(candidates, def.optionalPrimary.scrapOwn)) ability('optional', { targets });
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

    if (def.ally && player.triggered[uid] && !used.includes('ally')) {
      if (def.ally.acquireShipFree) {
        s.tradeRow.forEach((cardId, row) => {
          if (cardId && CARD_DEFS[s.cards[cardId].id].type === 'ship') ability('ally', { row });
        });
      } else if (def.ally.acquireCheapFree) {
        s.tradeRow.forEach((cardId, row) => {
          if (cardId && CARD_DEFS[s.cards[cardId].id].cost !== null && CARD_DEFS[s.cards[cardId].id].cost <= def.ally.acquireCheapFree.maxCost) ability('ally', { row });
        });
      } else if (def.ally.destroyAndOrScrap) {
        const bases = this.legalEnemyBases();
        const rows = s.tradeRow.map((cardId, row) => cardId ? row : null).filter(row => row !== null);
        for (const targetId of bases) ability('ally', { targetId });
        for (const row of rows) ability('ally', { row });
        for (const targetId of bases) for (const row of rows) ability('ally', { targetId, row });
      } else if (def.ally.destroyBase) {
        for (const targetId of this.legalEnemyBases()) ability('ally', { targetId });
      } else if (def.ally.scrapOwn) {
        const candidates = unique(def.ally.zones.flatMap(zone => player[zone]));
        for (const cardId of candidates) ability('ally', { targets: [cardId] });
      } else ability('ally');
    }

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
    if (this.state.mode !== 'team2v2') return [];
    const player = this.state.players[this.state.activePlayer];
    const actions = [];
    for (const teammate of teammates(this.state, player.id)) {
      for (const resource of ['trade', 'combat']) {
        for (let amount = 1; amount <= player[resource]; amount++) actions.push({ type: 'transfer', targetId: teammate.id, resource, amount });
      }
    }
    return actions;
  }

  teamHasOutpost(owner) {
    if (this.state.mode !== 'team2v2') return this.state.players[owner].inPlay.some(uid => getCardDef(uid, this.state).outpost);
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
    player.used[uid] ||= [];
    player.used[uid].push(kind);
    this.emit('ability', `${player.name} 发动 ${def.name} 的${{ primary: '主要', optional: '可选', ally: '同盟', scrap: '销毁' }[kind]}能力`, { playerId: player.id, cardId: uid, ability: kind });

    if (kind === 'scrap') this.scrapFrom(player, uid);
    let effect = kind === 'ally' ? def.ally : kind === 'scrap' ? def.scrap : kind === 'optional' ? def.optionalPrimary : def.primary;
    if (def.primaryChoice && kind === 'primary') effect = def.primaryChoice[action.choice];

    if (kind === 'primary' && def.primary?.scrapOwnMandatory) {
      this.applySimpleEffect(player, { draw: def.primary.draw });
      if (player.hand.length) s.pending = { type: 'scrapMandatory', actor: player.id, player: player.id };
      return;
    }
    if (effect?.scrapOwn) {
      for (const cardId of action.targets || []) this.scrapFrom(player, cardId);
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
    const top = !toHand && (forceTopDeck || player.topDeckNextAny || (def.type === 'ship' && player.topDeckNextShip));
    if (toHand) player.hand.push(uid);
    else if (top) player.deck.unshift(uid);
    else player.discard.push(uid);
    if (def.type === 'ship') player.topDeckNextShip = false;
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
      const remaining = s.mode === 'team2v2' ? s.teams[teamOf(s, target.id)].authority : target.authority;
      if (remaining <= 0) this.eliminate(target.id, player.id);
    }
  }

  eliminate(playerId, attacker) {
    const s = this.state;
    const player = s.players[playerId];
    if (player.eliminated) return;
    if (s.mode === 'team2v2') {
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
    player.topDeckNextShip = false;
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
    case 'ability': return `${name(action.cardId)}：${{ primary: '主要', optional: '可选', ally: '同盟', scrap: '销毁' }[action.ability]}能力${action.targetId ? ` → ${name(action.targetId)}` : ''}${action.row !== undefined ? ` → 交易行 ${action.row + 1}` : ''}${action.rows ? ` → 交易行 ${action.rows.map(row => row + 1).join('/')}` : ''}${action.targets?.length ? ` → ${action.targets.map(name).join('、')}` : ''}`;
    case 'buy': return action.explorer ? '购买探索者' : `购买交易行 ${action.row + 1} 号位卡牌`;
    case 'attack': return action.targetType === 'player' ? `攻击 ${state.players[action.targetId].name} ${action.amount} 点` : `攻击 ${name(action.targetId)} ${action.amount} 点`;
    case 'transfer': return `向 ${state.players[action.targetId].name} 预留 ${action.amount} ${{ trade: '贸易', combat: '战斗' }[action.resource]}`;
    case 'eventChoice': return action.pay ? '事件选择：失去 6 权威' : action.baseId ? `事件选择：摧毁 ${name(action.baseId)}` : action.cards ? `事件选择：将 ${action.cards.map(name).join('、')} 放回牌库顶` : `事件选择：${(action.targets || []).map(name).join('、') || '跳过'}`;
    case 'discard': return `弃掉 ${name(action.cardId)}`;
    case 'selectScrap': return `选择销毁 ${name(action.cardId)}`;
    case 'targetDiscard': return `指定 ${state.players[action.targetId].name} 弃牌`;
    case 'endTurn': return '结束回合';
    default: return JSON.stringify(action);
  }
}
