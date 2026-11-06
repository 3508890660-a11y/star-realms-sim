export const MODES = {
  standard: { name: '标准双人', min: 2, max: 2, description: '50 权威，先手 3 张、后手 5 张，击败唯一对手。' },
  ffa: { name: '自由混战', min: 3, max: 4, description: '可攻击任何对手，最后存活者获胜。' },
  hunter: { name: '猎杀', min: 3, max: 4, description: '只能攻击左手边玩家，可攻击左右邻家的基地。' },
  firstBlood: { name: '猎杀·先血', min: 3, max: 4, description: '猎杀规则；首位玩家败北时，其右手边玩家立即获胜。' },
  team2v2: { name: '2V2 团队', min: 4, max: 4, description: '座位 1/3 与 2/4 组队；同队共享 75 权威，可向队友预留资源。' }
};

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

export function teamOf(state, playerId) {
  return state.mode === 'team2v2' ? state.players[playerId].team : null;
}

export function teammates(state, playerId) {
  if (state.mode !== 'team2v2') return [];
  const team = teamOf(state, playerId);
  return state.players.filter(player => player.team === team && player.id !== playerId);
}

export function nextAlive(state, from, direction = 1) {
  for (let step = 1; step <= state.players.length; step++) {
    const index = (from + direction * step + state.players.length * 2) % state.players.length;
    if (!state.players[index].eliminated) return index;
  }
  return null;
}

export function canAttackPlayer(state, attacker, target) {
  if (attacker === target || state.players[target].eliminated) return false;
  if (state.mode === 'team2v2') return teamOf(state, attacker) !== teamOf(state, target);
  if (state.mode === 'hunter' || state.mode === 'firstBlood') {
    return nextAlive(state, attacker, 1) === target;
  }
  return true;
}

export function canTargetBase(state, attacker, owner) {
  if (attacker === owner || state.players[owner].eliminated) return false;
  if (state.mode === 'team2v2') return teamOf(state, attacker) !== teamOf(state, owner);
  if (state.mode === 'hunter' || state.mode === 'firstBlood') {
    return nextAlive(state, attacker, 1) === owner || nextAlive(state, attacker, -1) === owner;
  }
  return true;
}
