import { randomFrom } from './rng.js';
import {
  shuffleWithRandom, seededOrder, makeGameSeeds, pairRound, pairKey,
  matchScore, rankPlayers, aggregateSeasons
} from './swiss.js';

/**
 * 2V2 组队瑞士轮赛制内核（纯逻辑，不跑对局、不读写文件）。
 *
 * 与 1v1 瑞士轮的区别：
 *  - 参赛单位是 6 支双人队伍，而非 12 个脚本；
 *  - 一局是 4 人 team2v2，引擎的 team0 = 座位 [0,2]、team1 = 座位 [1,3]；
 *  - 完全配平需要覆盖 2×2×2 = 8 种座位组合，故每场 BO8（repeats 可放大到 BO16…）。
 *
 * 随机性同样全部由 masterSeed 派生：
 *   :entrants / :pair:rN / :game-seeds / :seats:sN:rR:mM / :tiebreak
 */

/** 6 支队伍：前 5 支为同厂模型两两配合，最后一支为剩余两个模型混编。 */
export const TEAM_DEFS = Object.freeze([
  { id: 'team-hy', name: '混元联队', vendor: 'Hy', kind: 'same-vendor', members: ['hy4', 'hy3'] },
  { id: 'team-glm', name: 'GLM 联队', vendor: 'GLM', kind: 'same-vendor', members: ['glm53', 'glm53flash'] },
  { id: 'team-minimax', name: 'MiniMax 联队', vendor: 'MiniMax', kind: 'same-vendor', members: ['minimaxm3', 'minimaxm31flash'] },
  { id: 'team-kimi', name: 'KIMI 联队', vendor: 'KIMI', kind: 'same-vendor', members: ['kimi31pro', 'kimi28preview'] },
  { id: 'team-deepseek', name: 'DeepSeek 联队', vendor: 'DeepSeek', kind: 'same-vendor', members: ['deepseekv41flash', 'deepseekv4pro'] },
  { id: 'team-mixed', name: '混编联队', vendor: 'StepFun + MIMO', kind: 'mixed', members: ['step5preview', 'mimov26pro'] }
]);

/** 用脚本目录把 12 个模型填进 6 支队伍，并校验人员不重不漏。 */
export function buildTeams(catalog) {
  const byId = new Map(catalog.map(agent => [agent.id, agent]));
  const teams = TEAM_DEFS.map(def => ({
    ...def,
    players: def.members.map(id => {
      const agent = byId.get(id);
      if (!agent) throw new Error(`队伍 ${def.id} 的成员 ${id} 不在脚本目录中`);
      return {
        id: agent.id,
        model: agent.model,
        modelId: agent.modelId,
        strategy: agent.strategy,
        script: `script:${agent.file.split(/[\\/]/).pop()}`
      };
    })
  }));
  const used = teams.flatMap(team => team.players.map(player => player.id));
  if (used.length !== 12 || new Set(used).size !== 12) throw new Error('12 个模型必须恰好被分配一次');
  if (byId.size !== 12) throw new Error(`脚本目录应有 12 个模型，实际 ${byId.size}`);
  return teams;
}

/**
 * 8 种座位排列。seats[0]/seats[2] 属于引擎 team0，seats[1]/seats[3] 属于 team1。
 * leader=0 → A 队占前位（team0）；leader=1 → B 队占前位。
 * aFlip/bFlip 决定各队谁坐本队的前位。
 */
export function seatArrangements(teamA, teamB) {
  const a = teamA.players.map(p => p.id);
  const b = teamB.players.map(p => p.id);
  const out = [];
  for (let leader = 0; leader < 2; leader++) {
    for (let aFlip = 0; aFlip < 2; aFlip++) {
      for (let bFlip = 0; bFlip < 2; bFlip++) {
        const front = leader === 0 ? [a[aFlip], a[1 - aFlip]] : [b[bFlip], b[1 - bFlip]];
        const back = leader === 0 ? [b[bFlip], b[1 - bFlip]] : [a[aFlip], a[1 - aFlip]];
        out.push({
          key: `L${leader}A${aFlip}B${bFlip}`,
          leader, aFlip, bFlip,
          seats: [front[0], back[0], front[1], back[1]],
          frontTeam: leader === 0 ? teamA.id : teamB.id,
          backTeam: leader === 0 ? teamB.id : teamA.id,
          leadA: a[aFlip],
          leadB: b[bFlip]
        });
      }
    }
  }
  return out;
}

/** 把 8×repeats 种排列按主种子打乱顺序；每种排列出现次数严格相同。 */
export function makeArrangementPlan(teamA, teamB, repeats, random) {
  const base = seatArrangements(teamA, teamB);
  const plan = [];
  for (let i = 0; i < repeats; i++) plan.push(...shuffleWithRandom(base, random));
  return plan;
}

/** 枚举 n 个参赛者的所有完美匹配（6 队时共 15 个）。 */
function perfectMatchings(ids) {
  const result = [];
  const walk = (pool, chosen) => {
    if (!pool.length) { result.push(chosen); return; }
    const a = pool[0];
    for (let i = 1; i < pool.length; i++) {
      const b = pool[i];
      walk(pool.slice(1).filter(id => id !== b), [...chosen, { a, b }]);
    }
  };
  walk(ids, []);
  return result;
}

const matchingCache = new Map();
function matchingsFor(ids) {
  const key = ids.join('|');
  if (!matchingCache.has(key)) matchingCache.set(key, perfectMatchings(ids));
  return matchingCache.get(key);
}

/** 剩余 roundsLeft 轮是否仍能用互不重复的边完整配对（前瞻，避免最后一轮被迫重赛）。 */
function completionPossible(played, roundsLeft, matchings, memo) {
  if (roundsLeft <= 0) return true;
  const memoKey = `${roundsLeft}:${[...played].sort().join(',')}`;
  if (memo.has(memoKey)) return memo.get(memoKey);
  let ok = false;
  for (const matching of matchings) {
    const keys = matching.map(pair => pairKey(pair.a, pair.b));
    if (keys.some(key => played.has(key))) continue;
    const next = new Set(played);
    for (const key of keys) next.add(key);
    if (completionPossible(next, roundsLeft - 1, matchings, memo)) { ok = true; break; }
  }
  memo.set(memoKey, ok);
  return ok;
}

/**
 * 队伍专用配对：同分优先 + 组内随机排序，并前瞻检查剩余轮次仍能零重赛。
 * 6 队 × 5 轮会耗尽 K6 的全部 15 条边，逐轮贪心可能在第 4 轮把第 5 轮逼到无解；
 * 这里只接受「后续仍有完整 1-因子分解」的匹配，从而保证整届零重赛。
 */
export function pairRoundTeams({ standings, played, round, roundsLeft, masterSeed, allIds }) {
  const random = randomFrom(`${masterSeed}:pair:r${round}:team`);
  const order = seededOrder(standings, random);
  const ids = order.map(row => row.id);
  const mpOf = new Map(standings.map(row => [row.id, row.mp]));
  const globalMatchings = matchingsFor(allIds || ids);
  const candidates = matchingsFor(ids).map((matching, index) => ({
    matching, index,
    keys: matching.map(pair => pairKey(pair.a, pair.b)),
    same: matching.filter(pair => mpOf.get(pair.a) === mpOf.get(pair.b)).length
  })).sort((x, y) => y.same - x.same || x.index - y.index);

  for (const candidate of candidates) {
    if (candidate.keys.some(key => played.has(key))) continue;
    const next = new Set(played);
    for (const key of candidate.keys) next.add(key);
    if (!completionPossible(next, roundsLeft - 1, globalMatchings, new Map())) continue;
    return {
      pairs: candidate.matching.map(pair => ({
        a: pair.a, b: pair.b,
        mpA: mpOf.get(pair.a), mpB: mpOf.get(pair.b),
        sameScore: mpOf.get(pair.a) === mpOf.get(pair.b),
        rematch: false,
        scoreGap: Math.abs(mpOf.get(pair.a) - mpOf.get(pair.b))
      })),
      bye: null, order: ids, forwardChecked: true
    };
  }
  // 理论上 6 队 ≤5 轮恒有解；真无解时退回通用回溯，并如实标注重赛。
  return { ...pairRound({ standings, played, round, masterSeed }), forwardChecked: false, infeasible: true };
}

/** 引擎 winningTeam（0=座位 0/2，1=座位 1/3）映射到 A/B 队伍 id。 */
export function winnerTeamId(arrangement, teamA, teamB, winningTeam) {
  if (winningTeam !== 0 && winningTeam !== 1) throw new Error(`引擎未给出获胜队伍：${winningTeam}`);
  const frontWon = winningTeam === 0;
  return frontWon ? arrangement.frontTeam : arrangement.backTeam;
}

/** 校验一场里每队、每名队员、每个座位的配平情况（供测试与报告使用）。 */
export function auditArrangementPlan(plan, teamA, teamB) {
  const seatCount = new Map();
  const frontCount = new Map();
  const leadCount = new Map();
  for (const item of plan) {
    for (let seat = 0; seat < 4; seat++) {
      const key = `${item.seats[seat]}@${seat}`;
      seatCount.set(key, (seatCount.get(key) || 0) + 1);
    }
    frontCount.set(item.frontTeam, (frontCount.get(item.frontTeam) || 0) + 1);
    leadCount.set(item.leadA, (leadCount.get(item.leadA) || 0) + 1);
    leadCount.set(item.leadB, (leadCount.get(item.leadB) || 0) + 1);
  }
  return {
    games: plan.length,
    front: Object.fromEntries(frontCount),
    lead: Object.fromEntries(leadCount),
    seats: Object.fromEntries(seatCount),
    balanced: plan.length > 0 &&
      [...frontCount.values()].every(v => v * 2 === plan.length) &&
      [...leadCount.values()].every(v => v * 2 === plan.length) &&
      new Set(seatCount.values()).size === 1
  };
}

export { randomFrom, shuffleWithRandom, makeGameSeeds, pairRound, pairKey, matchScore, rankPlayers, aggregateSeasons };
