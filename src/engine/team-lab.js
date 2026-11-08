/**
 * 2V2 实验室内核（纯逻辑，不跑对局、不读写文件）。
 *
 * 两套实验：
 *  A. clone  —— 12 支「同模型复制队」，每队由同一份脚本的两个副本组成。
 *               赛制参考 1v1：12 个参赛单位、5 轮瑞士轮、零重赛回溯配对、按局胜率聚合。
 *               目的：队友是自己的镜像，队伍成绩可近似归因为「单个模型脚本的 2V2 能力」。
 *  B. random —— 每届把 12 个模型随机两两配成 6 队，跑多届瑞士轮。
 *               队伍胜负是共享的，因此用「在场胜率」+「控制队友/对手后的边际贡献 β」
 *               两个口径估计个人发挥，并审计搭档覆盖与座位配平。
 *
 * 随机性全部由 masterSeed 派生，同种子可完整复现。
 */
import { shuffleWithRandom } from './swiss.js';
import { randomFrom } from './rng.js';

/** 把脚本目录的 12 个模型各自复制成一支双人队。seatId 带后缀以便座位排列可区分。 */
export function buildCloneTeams(catalog) {
  if (!Array.isArray(catalog) || catalog.length !== 12) throw new Error(`复制队需要 12 个模型，实际 ${catalog?.length}`);
  return catalog.map(agent => ({
    id: `clone-${agent.id}`,
    name: `${agent.model} 复制队`,
    kind: 'clone',
    model: agent.id,
    vendor: agent.model,
    players: [0, 1].map(i => ({
      id: `${agent.id}#${i === 0 ? 'a' : 'b'}`,
      model: agent.id,
      display: agent.model,
      modelId: agent.modelId,
      strategy: agent.strategy,
      script: `script:${String(agent.file).split(/[\\/]/).pop()}`
    }))
  }));
}

/** 枚举 n 个成员的随机完美匹配（Fisher–Yates 洗牌后两两相邻）。 */
function randomMatching(ids, random) {
  const order = shuffleWithRandom(ids, random);
  const pairs = [];
  for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  return pairs;
}

/**
 * 生成一届的随机组队。
 * 为让跨届「谁和谁搭档」尽量均衡，采样若干次随机完美匹配，选累计搭档成本最低的一份；
 * 随机性仍完全来自 seasonSeed，成本只用来打破重复搭档。
 */
export function buildRandomTeams(catalog, seasonIndex, masterSeed, pairCounts = new Map(), samples = 48) {
  const byId = new Map(catalog.map(agent => [agent.id, agent]));
  const ids = catalog.map(agent => agent.id);
  const random = randomFrom(`${masterSeed}:teams:s${seasonIndex}`);
  const costOf = pairs => pairs.reduce((sum, [a, b]) => {
    const count = pairCounts.get([a, b].sort().join('|')) || 0;
    return sum + count * count + count;
  }, 0);

  let best = null;
  let bestCost = Infinity;
  for (let i = 0; i < samples; i++) {
    const pairs = randomMatching(ids, random);
    const cost = costOf(pairs);
    if (cost < bestCost) { best = pairs; bestCost = cost; }
  }
  const teams = best.map(([a, b], index) => ({
    id: `s${seasonIndex}-t${index + 1}`,
    name: `第 ${seasonIndex} 届 · 队伍 ${index + 1}`,
    kind: 'random',
    vendor: `${byId.get(a).model} + ${byId.get(b).model}`,
    players: [a, b].map(id => {
      const agent = byId.get(id);
      return {
        id,
        model: id,
        display: agent.model,
        modelId: agent.modelId,
        strategy: agent.strategy,
        script: `script:${String(agent.file).split(/[\\/]/).pop()}`
      };
    })
  }));
  const used = teams.flatMap(team => team.players.map(p => p.id));
  if (used.length !== 12 || new Set(used).size !== 12) throw new Error('随机组队必须让 12 个模型各出现一次');
  return { teams, pairs: best };
}

/**
 * 生成一届的随机三人队（3V3 模式用）。
 * 与 buildRandomTeams 同思路：采样若干次随机排列，按「同一对队友重复出现」成本择优，
 * 随机性完全来自 seasonSeed，成本只用于打散跨届重复搭档。
 */
export function buildRandomTrios(catalog, seasonIndex, masterSeed, pairCounts = new Map(), samples = 64) {
  const byId = new Map(catalog.map(agent => [agent.id, agent]));
  const ids = catalog.map(agent => agent.id);
  if (ids.length % 3 !== 0) throw new Error('三人队要求模型数能被 3 整除');
  const random = randomFrom(`${masterSeed}:trios:s${seasonIndex}`);
  const costOf = trios => trios.reduce((sum, trio) => {
    for (let i = 0; i < trio.length; i++) for (let j = i + 1; j < trio.length; j++) {
      const key = [trio[i], trio[j]].sort().join('|');
      const count = pairCounts.get(key) || 0;
      sum += count * count + count;
    }
    return sum;
  }, 0);

  let best = null;
  let bestCost = Infinity;
  for (let i = 0; i < samples; i++) {
    const order = shuffleWithRandom(ids, random);
    const trios = [];
    for (let k = 0; k < order.length; k += 3) trios.push(order.slice(k, k + 3));
    const cost = costOf(trios);
    if (cost < bestCost) { best = trios; bestCost = cost; }
  }
  const teams = best.map((members, index) => ({
    id: `s${seasonIndex}-t${index + 1}`,
    name: `第 ${seasonIndex} 届 · 队伍 ${index + 1}`,
    kind: 'random',
    vendor: members.map(id => byId.get(id).model).join(' + '),
    players: members.map(id => {
      const agent = byId.get(id);
      return {
        id, model: id, display: agent.model, modelId: agent.modelId,
        strategy: agent.strategy, script: `script:${String(agent.file).split(/[\\/]/).pop()}`
      };
    })
  }));
  const used = teams.flatMap(team => team.players.map(player => player.id));
  if (used.length !== ids.length || new Set(used).size !== ids.length) throw new Error('随机三人队必须让每个模型各出现一次');
  const pairs = best.flatMap(trio => {
    const out = [];
    for (let i = 0; i < trio.length; i++) for (let j = i + 1; j < trio.length; j++) out.push([trio[i], trio[j]].sort());
    return out;
  });
  return { teams, pairs };
}

/** Wilson score 置信区间。 */
export function wilson(wins, games, z = 1.96) {
  if (!games) return [0, 0];
  const p = wins / games;
  const d = 1 + z * z / games;
  const center = (p + z * z / (2 * games)) / d;
  const margin = z * Math.sqrt(p * (1 - p) / games + z * z / (4 * games * games)) / d;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

/** 高斯–约当求逆（部分主元），用于 IRLS 的 Hessian 求逆与标准误。 */
function invert(matrix) {
  const n = matrix.length;
  const a = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const div = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col];
      if (!factor) continue;
      for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[col][j];
    }
  }
  return a.map(row => row.slice(n));
}

const sigmoid = x => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, x))));

/**
 * 团队 Bradley–Terry 逻辑模型：
 *   logit P(前位队胜) = β[m0] + β[m2] − β[m1] − β[m3] + γ
 * 其中 γ 是全体共有的前位优势，β 是每个模型在控制队友与对手强度后的边际贡献。
 * 用 IRLS 拟合，带很小的 L2 正则保证可解；β 以均值为 0 中心化后排序。
 * 注意：同一场 BO8 的对局并不独立，SE 与 z 只作近似参考。
 */
export function fitContribution(games, modelIds, { lambda = 0.1, iterations = 24 } = {}) {
  const index = new Map(modelIds.map((id, i) => [id, i]));
  const k = modelIds.length;
  const n = k + 1;                       // 最后一个参数是前位截距 γ
  const rows = [];
  for (const game of games) {
    const x = Array(n).fill(0);
    const m = game.models;
    if (!m || m.length % 2 !== 0 || m.length < 4) throw new Error('个人贡献拟合需要每局至少 4 个座位且为偶数');
    if (m.some(id => !index.has(id))) throw new Error('个人贡献拟合出现了名单外的模型');
    // 队 0 占偶数座位，队 1 占奇数座位；3V3 与 2V2 用同一套线性预测器。
    for (let seat = 0; seat < m.length; seat++) x[index.get(m[seat])] += seat % 2 === 0 ? 1 : -1;
    x[k] = 1;
    rows.push({ x, y: game.winningTeam === 0 ? 1 : 0 });
  }
  let theta = Array(n).fill(0);
  let hessian = null;
  for (let iter = 0; iter < iterations; iter++) {
    const h = Array.from({ length: n }, () => Array(n).fill(0));
    const g = Array(n).fill(0);
    for (const { x, y } of rows) {
      const p = sigmoid(x.reduce((sum, v, j) => sum + v * theta[j], 0));
      const w = Math.max(1e-9, p * (1 - p));
      const resid = y - p;
      for (let i = 0; i < n; i++) {
        g[i] += x[i] * resid;
        for (let j = 0; j < n; j++) h[i][j] += w * x[i] * x[j];
      }
    }
    for (let i = 0; i < k; i++) { h[i][i] += lambda; g[i] -= lambda * theta[i]; }
    const inv = invert(h);
    if (!inv) break;
    hessian = h;
    const step = inv.map(row => row.reduce((sum, v, j) => sum + v * g[j], 0));
    theta = theta.map((v, i) => v + step[i]);
    if (step.every(v => Math.abs(v) < 1e-9)) break;
  }
  const inv = hessian ? invert(hessian) : null;
  const beta = theta.slice(0, k);
  const mean = beta.reduce((a, b) => a + b, 0) / k;
  const rowsOut = modelIds.map((id, i) => {
    const value = beta[i] - mean;
    const se = inv ? Math.sqrt(Math.max(0, inv[i][i])) : null;
    return {
      id, beta: +value.toFixed(4),
      se: se === null ? null : +se.toFixed(4),
      z: se ? +(value / se).toFixed(3) : null,
      odds: +Math.exp(value).toFixed(4)
    };
  }).sort((a, b) => b.beta - a.beta || a.id.localeCompare(b.id));
  rowsOut.forEach((row, i) => { row.rank = i + 1; });
  return {
    model: 'logit P(front wins) = sum(beta of even seats) - sum(beta of odd seats) + gamma',
    lambda, iterations, samples: rows.length,
    frontAdvantage: +theta[k].toFixed(4),
    converged: inv !== null,
    rows: rowsOut
  };
}

/**
 * 逐模型在场统计。
 * `games` 是「参与的局数」，按模型去重——复制队里同一模型占两个座位，一局仍只算一次参与；
 * `seatAppearances` 与 `seats` 才是座位次数（复制队是局数的两倍）。
 * 搭档/对手也按局去重计数，避免同一局被重复累计。
 */
export function memberStats(games, modelIds) {
  const stat = new Map(modelIds.map(id => [id, {
    id, games: 0, wins: 0, seatAppearances: 0,
    seats: [],
    frontGames: 0, frontWins: 0,
    partners: new Map(), opponents: new Map()
  }]));
  for (const game of games) {
    const m = game.models;
    if (!m || m.length % 2 !== 0) throw new Error('在场统计需要偶数个座位（2V2 / 3V3）');
    const seatCount = m.length;
    const evenSeats = [...Array(seatCount).keys()].filter(seat => seat % 2 === 0);
    const oddSeats = [...Array(seatCount).keys()].filter(seat => seat % 2 === 1);
    for (const id of new Set(m)) {
      const row = stat.get(id);
      if (!row) throw new Error(`未知模型：${id}`);
      if (!row.seats.length) row.seats = Array(seatCount).fill(0);
      const ownSeats = [...Array(seatCount).keys()].filter(seat => m[seat] === id);
      // 队 0 占偶数座位；同一模型的多个副本全部落在偶数座位时才算「前位队」。
      const isFront = ownSeats.every(seat => seat % 2 === 0);
      const won = (game.winningTeam === 0) === isFront;
      row.games++;
      if (won) row.wins++;
      if (isFront) { row.frontGames++; if (won) row.frontWins++; }
      for (const seat of ownSeats) { row.seats[seat]++; row.seatAppearances++; }
      const teamSeats = isFront ? evenSeats : oddSeats;
      const rivalSeats = isFront ? oddSeats : evenSeats;
      for (const partner of new Set(teamSeats.map(seat => m[seat]))) {
        if (partner === id) continue;
        row.partners.set(partner, (row.partners.get(partner) || 0) + 1);
      }
      for (const opponent of new Set(rivalSeats.map(seat => m[seat]))) {
        row.opponents.set(opponent, (row.opponents.get(opponent) || 0) + 1);
      }
    }
  }
  const rows = [...stat.values()].map(row => {
    const ci = wilson(row.wins, row.games);
    return {
      id: row.id, games: row.games, wins: row.wins,
      seatAppearances: row.seatAppearances,
      winRate: +(row.wins / row.games).toFixed(4),
      ci95: ci.map(v => +v.toFixed(4)),
      frontGames: row.frontGames,
      frontRate: row.frontGames ? +(row.frontWins / row.frontGames).toFixed(4) : 0,
      seats: row.seats,
      partnerCount: row.partners.size,
      opponentCount: row.opponents.size,
      partnerCounts: Object.fromEntries(row.partners),
      opponentCounts: Object.fromEntries(row.opponents)
    };
  }).sort((a, b) => b.winRate - a.winRate || a.id.localeCompare(b.id));
  rows.forEach((row, i) => { row.rank = i + 1; });
  return rows;
}

/** 座位配平审计：每个模型在 4 个座位出现次数是否相同。 */
export function auditSeatBalance(memberRows) {
  const counts = new Set();
  for (const row of memberRows) for (const value of row.seats) counts.add(value);
  return { balanced: counts.size <= 1, distinctCounts: [...counts].sort((a, b) => a - b) };
}

/** 把每局座位上的 seatId 映射成模型 id（复制队两个副本归到同一模型）。 */
export function modelsOfSeats(seatIds, bySeatId) {
  const models = seatIds.map(id => {
    const player = bySeatId.get(id);
    if (!player) throw new Error(`座位成员缺失：${id}`);
    return player.model;
  });
  if (models.length < 4 || models.length % 2 !== 0) throw new Error('一局必须有偶数个座位（至少 4 个）');
  return models;
}
