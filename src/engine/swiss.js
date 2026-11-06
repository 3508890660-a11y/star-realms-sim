import { randomFrom } from './rng.js';

/**
 * 瑞士轮赛制内核（纯函数，不跑对局、不读写文件）。
 *
 * 随机性全部由 masterSeed 派生，同一 masterSeed + 同一配置可完整复现：
 *   - :entrants  决定参赛者的初始随机排序
 *   :pair:rN     决定每轮同分组内的随机排序
 *   :game-seeds  生成每局独立的随机种子
 *   :tiebreak    决定最终同分时的随机优先级
 */

export function shuffleWithRandom(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hex8(random) {
  return Math.floor(random() * 0x100000000).toString(16).padStart(8, '0');
}

/** 预生成 rounds × matchesPerRound × (perSide*2) 个互不相同的局种子。 */
export function makeGameSeeds(masterSeed, rounds, matchesPerRound, perSide) {
  const random = randomFrom(`${masterSeed}:game-seeds`);
  const table = [];
  for (let r = 0; r < rounds; r++) {
    const round = [];
    for (let m = 0; m < matchesPerRound; m++) {
      const seeds = [];
      for (let g = 0; g < perSide * 2; g++) {
        seeds.push(`${masterSeed}:r${r + 1}:m${m + 1}:g${g + 1}:${hex8(random)}`);
      }
      round.push(seeds);
    }
    table.push(round);
  }
  return table;
}

export function pairKey(a, b) {
  return [a, b].sort().join('|');
}

/** 按场分降序分组，组内随机排序，组间保持降序。 */
export function seededOrder(standings, random) {
  const groups = new Map();
  for (const row of standings) {
    const key = String(row.mp);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const keys = [...groups.keys()].sort((a, b) => Number(b) - Number(a));
  return keys.flatMap(key => shuffleWithRandom(groups.get(key), random));
}

/**
 * 回溯寻找整轮的完美匹配。候选优先级：未交手同分 > 未交手跨分 > 已交手同分 > 已交手跨分。
 * 由于「未交手」排在「已交手」之前，只要存在零重赛的匹配就一定会先找到它；
 * 只有全部匹配都不可行时才退化到重赛。12 人的搜索空间约一万，开销可忽略。
 */
function findMatching(ids, mpOf, played, allowRematch, degree) {
  const backtrack = (pool, chosen) => {
    if (!pool.length) return chosen;
    const a = pool[0];
    const rest = pool.slice(1);
    const candidates = rest
      .map((b, index) => ({ b, index, rematch: played.has(pairKey(a, b)), same: mpOf.get(a) === mpOf.get(b) }))
      .filter(candidate => allowRematch || !candidate.rematch)
      .sort((x, y) =>
        Number(x.rematch) - Number(y.rematch) ||
        Number(y.same) - Number(x.same) ||
        (degree.get(x.b) || 0) - (degree.get(y.b) || 0) ||
        x.index - y.index
      );
    for (const candidate of candidates) {
      const result = backtrack(rest.filter(id => id !== candidate.b), [...chosen, {
        a, b: candidate.b,
        mpA: mpOf.get(a), mpB: mpOf.get(candidate.b),
        sameScore: candidate.same,
        rematch: candidate.rematch,
        scoreGap: Math.abs(mpOf.get(a) - mpOf.get(candidate.b))
      }]);
      if (result) return result;
    }
    return null;
  };
  return backtrack(ids, []);
}

/**
 * 一轮配对。按场分降序分组、组内随机排序后做回溯匹配；同分优先、零重赛优先，
 * 必要时允许跨分组浮动。奇数人数时最低分者轮空并获得 1 场分。
 */
export function pairRound({ standings, played, round, masterSeed, attempts = 24 }) {
  const random = randomFrom(`${masterSeed}:pair:r${round}`);
  const mpOf = new Map(standings.map(row => [row.id, row.mp]));
  const degree = new Map(standings.map(row => [row.id, 0]));
  for (const key of played) for (const id of key.split('|')) degree.set(id, (degree.get(id) || 0) + 1);

  let bestOrder = null;
  let pairs = null;
  // 同分组内随机排序可重掷：先用严格「零重赛」搜索，多试几种随机顺序
  for (let attempt = 0; attempt < attempts; attempt++) {
    const order = seededOrder(standings, random);
    const ids = order.map(row => row.id);
    let bye = null;
    if (ids.length % 2) bye = ids.pop();
    const strict = findMatching(ids, mpOf, played, false, degree);
    if (strict?.length) return { pairs: strict, bye, order: order.map(row => row.id), attempts: attempt + 1 };
    if (!bestOrder) { bestOrder = { order: order.map(row => row.id), ids, bye }; }
  }
  // 确实不存在零重赛匹配时，退化为允许重赛，但按「重赛数最少」近似择优
  pairs = findMatching(bestOrder.ids, mpOf, played, true, degree);
  if (!pairs?.length && bestOrder.ids.length) throw new Error(`第 ${round} 轮无法完成配对`);
  return { pairs: pairs || [], bye: bestOrder.bye, order: bestOrder.order, attempts, fellBack: true };
}

/** 一场 BO(2*perSide)：aWins + bWins 必须等于总局数。 */
export function matchScore(aWins, bWins, totalGames) {
  if (aWins + bWins !== totalGames) throw new Error(`BO${totalGames} 局分不守恒：${aWins}+${bWins}`);
  const mpA = aWins > bWins ? 1 : aWins < bWins ? 0 : 0.5;
  return { aWins, bWins, mpA, mpB: 1 - mpA, drawn: aWins === bWins };
}

/**
 * 最终排名。依次为：场分 MP → 局胜 GP → 对手场分和 Buchholz →
 * Sonneborn–Berger → 随机优先级（由 masterSeed 决定，可复现）。
 */
export function rankPlayers({ entrants, matches, masterSeed }) {
  const random = randomFrom(`${masterSeed}:tiebreak`);
  const tiePriority = new Map(entrants.map(e => [e.id, random()]));
  const stat = new Map(entrants.map(e => [e.id, {
    id: e.id, mp: 0, gameWins: 0, gameLosses: 0,
    matchWins: 0, matchDraws: 0, matchLosses: 0,
    firstWins: 0, firstGames: 0, secondWins: 0, secondGames: 0,
    turns: 0, actions: 0, games: 0,
    opponents: [], results: [], byes: 0
  }]));

  for (const match of matches) {
    if (match.bye) stat.get(match.bye).mp += 1;
    if (!match.a) continue;
    const a = stat.get(match.a);
    const b = stat.get(match.b);
    a.mp += match.mpA; b.mp += match.mpB;
    a.gameWins += match.aWins; b.gameWins += match.bWins;
    a.gameLosses += match.bWins; b.gameLosses += match.aWins;
    a.games += match.aWins + match.bWins; b.games += match.aWins + match.bWins;
    a.turns += match.turnsA; b.turns += match.turnsB;
    a.actions += match.actionsA; b.actions += match.actionsB;
    a.firstWins += match.firstWinsA; a.firstGames += match.firstGamesA;
    a.secondWins += match.secondWinsA; a.secondGames += match.secondGamesA;
    b.firstWins += match.firstWinsB; b.firstGames += match.firstGamesB;
    b.secondWins += match.secondWinsB; b.secondGames += match.secondGamesB;
    if (match.mpA === 1) { a.matchWins++; b.matchLosses++; }
    else if (match.mpA === 0) { b.matchWins++; a.matchLosses++; }
    else { a.matchDraws++; b.matchDraws++; }
    a.opponents.push(match.b); a.results.push(match.mpA);
    b.opponents.push(match.a); b.results.push(match.mpB);
  }

  const rows = [...stat.values()].map(row => {
    const buchholz = row.opponents.reduce((sum, id) => sum + stat.get(id).mp, 0);
    const sb = row.opponents.reduce((sum, id, i) => sum + stat.get(id).mp * row.results[i], 0);
    const total = row.gameWins + row.gameLosses;
    return {
      ...row,
      buchholz: +buchholz.toFixed(2),
      sb: +sb.toFixed(2),
      gameRate: total ? +(row.gameWins / total).toFixed(4) : 0,
      firstRate: row.firstGames ? +(row.firstWins / row.firstGames).toFixed(4) : 0,
      secondRate: row.secondGames ? +(row.secondWins / row.secondGames).toFixed(4) : 0,
      avgTurns: row.games ? +(row.turns / row.games).toFixed(2) : 0,
      tiePriority: tiePriority.get(row.id)
    };
  });

  rows.sort((x, y) =>
    y.mp - x.mp ||
    y.gameWins - x.gameWins ||
    y.buchholz - x.buchholz ||
    y.sb - x.sb ||
    y.firstWins - x.firstWins ||
    (y.tiePriority - x.tiePriority) ||
    x.id.localeCompare(y.id)
  );
  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

/** 多届独立瑞士轮的聚合（每届配对/种子独立，积分不跨届累积）。 */
export function aggregateSeasons(seasons, entrants) {
  const totals = new Map(entrants.map(e => [e.id, {
    id: e.id, seasons: 0, mp: 0, gameWins: 0, games: 0,
    rankSum: 0, titles: 0, buchholzSum: 0,
    firstWins: 0, firstGames: 0, secondWins: 0, secondGames: 0
  }]));
  for (const season of seasons) {
    for (const row of season.standings) {
      const t = totals.get(row.id);
      t.seasons++;
      t.mp += row.mp;
      t.gameWins += row.gameWins;
      t.games += row.games;
      t.rankSum += row.rank;
      t.buchholzSum += row.buchholz;
      t.firstWins += row.firstWins; t.firstGames += row.firstGames;
      t.secondWins += row.secondWins; t.secondGames += row.secondGames;
      if (row.rank === 1) t.titles++;
    }
  }
  const rows = [...totals.values()].map(t => ({
    ...t,
    mp: +t.mp.toFixed(2),
    gameRate: +(t.gameWins / t.games).toFixed(4),
    avgRank: +(t.rankSum / t.seasons).toFixed(2),
    avgBuchholz: +(t.buchholzSum / t.seasons).toFixed(2),
    firstRate: +(t.firstWins / t.firstGames).toFixed(4),
    secondRate: +(t.secondWins / t.secondGames).toFixed(4)
  }));
  rows.sort((a, b) =>
    b.gameRate - a.gameRate ||
    b.mp - a.mp ||
    a.avgRank - b.avgRank ||
    b.titles - a.titles ||
    b.avgBuchholz - a.avgBuchholz ||
    a.id.localeCompare(b.id)
  );
  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}
