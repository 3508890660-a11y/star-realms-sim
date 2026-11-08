export const MODES = {
  standard: { name: '标准双人', min: 2, max: 2, description: '50 权威，先手 3 张、后手 5 张，击败唯一对手。' },
  ffa: { name: '自由混战', min: 3, max: 4, description: '可攻击任何对手，最后存活者获胜。' },
  hunter: { name: '猎杀', min: 3, max: 4, description: '只能攻击左手边玩家，可攻击左右邻家的基地。' },
  firstBlood: { name: '猎杀·先血', min: 3, max: 4, description: '猎杀规则；首位玩家败北时，其右手边玩家立即获胜。' },
  team2v2: { name: '双头龙 2V2', min: 4, max: 4, description: '座位 0/2 与 1/3 组队；同队共享 75 权威，可向队友预留资源。' },
  hydra3: { name: '三头龙 3V3', min: 6, max: 6, description: '6 人两队各 3 人，交替座位；同队共享 100 权威，队友间可转移贸易/战斗，任一人有前哨则全队受保护。' },
  emperor: { name: '大将战 3V3', min: 6, max: 6, description: '6 人两队各 3 人；每队 1 大将（60 权威）+ 2 提督（50 权威）；提督只能打对面提督，对面提督阵亡后才可打大将；大将被击败则该队失败。' }
};

/** 共享权威的队伍模式；hydra3 与 team2v2 只差队伍人数与起始权威。 */
export const TEAM_SPECS = Object.freeze({
  team2v2: { teams: 2, size: 2, authority: 75 },
  hydra3: { teams: 2, size: 3, authority: 100 }
});

export function isTeamMode(mode) {
  return Object.prototype.hasOwnProperty.call(TEAM_SPECS, mode);
}

export function validateMode(mode, count) {
  const config = MODES[mode];
  if (!config) throw new Error(`未知模式: ${mode}`);
  if (count < config.min || count > config.max) {
    throw new Error(`${config.name}需要 ${config.min}–${config.max} 名玩家`);
  }
}

export function alivePlayers(state) {
  return state.players.filter(player => !player.eliminated);
}

/** 队伍编号：两类队伍模式都按交替座位分队（0/2/4 与 1/3/5）。 */
export function teamOf(state, playerId) {
  return isTeamMode(state.mode) || state.mode === 'emperor' ? playerId % 2 : null;
}

export function teammates(state, playerId) {
  if (!(isTeamMode(state.mode) || state.mode === 'emperor')) return [];
  const team = teamOf(state, playerId);
  return state.players.filter(player => player.team === team && player.id !== playerId);
}

export function isEmperor(state, playerId) {
  return state.mode === 'emperor' && (state.emperors || []).includes(playerId);
}

/** 大将战的对位：0↔1、2↔3、4↔5。 */
export function oppositeSeat(state, playerId) {
  return (playerId + 1) % Math.max(2, state.players.length);
}

export function nextAlive(state, from, direction = 1) {
  for (let step = 1; step <= state.players.length; step++) {
    const index = (from + direction * step + state.players.length * 2) % state.players.length;
    if (!state.players[index].eliminated) return index;
  }
  return null;
}

export function canAttackPlayer(state, attacker, target) {
  if (attacker === target || state.players[target].eliminated || state.players[attacker].eliminated) return false;
  if (isTeamMode(state.mode)) return teamOf(state, attacker) !== teamOf(state, target);
  if (state.mode === 'emperor') {
    if (teamOf(state, attacker) === teamOf(state, target)) return false;
    if (isEmperor(state, attacker)) return true;
    // 提督：先打对面提督；对面提督阵亡后，才允许打敌方大将。
    const opposite = oppositeSeat(state, attacker);
    if (target === opposite) return true;
    return state.players[opposite].eliminated && isEmperor(state, target);
  }
  if (state.mode === 'hunter' || state.mode === 'firstBlood') {
    return nextAlive(state, attacker, 1) === target;
  }
  return true;
}

export function canTargetBase(state, attacker, owner) {
  if (attacker === owner || state.players[owner].eliminated || state.players[attacker].eliminated) return false;
  if (isTeamMode(state.mode)) return teamOf(state, attacker) !== teamOf(state, owner);
  if (state.mode === 'emperor') {
    if (teamOf(state, attacker) === teamOf(state, owner)) return false;
    if (isEmperor(state, attacker)) return true;
    const opposite = oppositeSeat(state, attacker);
    if (owner === opposite) return true;
    return state.players[opposite].eliminated && isEmperor(state, owner);
  }
  if (state.mode === 'hunter' || state.mode === 'firstBlood') {
    return nextAlive(state, attacker, 1) === owner || nextAlive(state, attacker, -1) === owner;
  }
  return true;
}
