// Web 层实况核对：通过 /api/match 真的新建一局，模拟「你在界面上操作」的路径，
// 逐次比对「界面拿到的合法攻击目标」与「按官方规则独立重算」的结果。
import { spawn } from 'node:child_process';

const PORT = 4488 + Math.floor(Math.random() * 40);
const BASE = `http://127.0.0.1:${PORT}`;
const SEED = `web-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SCRIPTS = [
  'script:agent-hy4.js',
  'script:agent-glm53.js',
  'script:agent-deepseekv41flash.js',
  'script:agent-minimaxm3.js',
  'script:agent-kimi31pro.js',
  'script:agent-mimov26pro.js'
];

/** 从「玩家看到的视图」独立重算可攻击玩家集合（含前哨与大将/提督规则）。 */
function expectedTargets(state, attackerId) {
  const out = new Set();
  const isTeam = state.mode === 'team2v2' || state.mode === 'hydra3';
  const attacker = state.players[attackerId];
  const attackerEmperor = (state.emperors || []).includes(attackerId);
  const ownTeam = attacker.team;
  let opposite = null;
  if (state.mode === 'emperor' && !attackerEmperor) {
    const isEmp = id => (state.emperors || []).includes(id);
    const own = state.players.filter(p => p.team === ownTeam && !isEmp(p.id)).map(p => p.id).sort((a, b) => a - b);
    const rival = state.players.filter(p => p.team !== ownTeam && !isEmp(p.id)).map(p => p.id).sort((a, b) => a - b);
    const index = own.indexOf(attackerId);
    opposite = index >= 0 && index < rival.length ? rival[index] : null;
  }
  const hasOutpost = ownerId => {
    const owners = isTeam ? state.players.filter(p => p.team === state.players[ownerId].team).map(p => p.id) : [ownerId];
    return owners.some(id => state.players[id].inPlay.some(uid => state.cards[uid]?.outpost));
  };
  for (const p of state.players) {
    if (p.id === attackerId || p.eliminated) continue;
    if (hasOutpost(p.id)) continue;
    if (isTeam) { if (p.team !== ownTeam) out.add(p.id); continue; }
    if (state.mode === 'emperor') {
      if (p.team === ownTeam) continue;
      if (attackerEmperor) { out.add(p.id); continue; }
      if (opposite === null) continue;
      if (p.id === opposite) { out.add(p.id); continue; }
      if (state.players[opposite].eliminated && (state.emperors || []).includes(p.id)) out.add(p.id);
      continue;
    }
    out.add(p.id);
  }
  return out;
}

async function req(method, path, payload) {
  const res = await fetch(BASE + path, {
    method,
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const child = spawn(process.execPath, ['src/server/server.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverErr = '';
child.stderr.on('data', d => { serverErr += d; });
child.stdout.on('data', () => {});

const lines = [];
const push = line => lines.push(line);
let ok = true;

try {
  // 等待服务就绪
  for (let i = 0; i < 60; i++) {
    try { await req('GET', '/api/options'); break; } catch { await sleep(150); }
  }

  push(`Web 实况核对 · 端口 ${PORT} · 种子 ${SEED}`);
  push('');

  // ——— A. 界面新开一局大将战（我是座位 0 的提督，敌方大将座位 3）———
  const players = [
    { name: '我（座位0·提督）', script: 'human' },
    { name: '座位1·提督', script: SCRIPTS[1] },
    { name: '座位2·提督', script: SCRIPTS[2] },
    { name: '座位3·大将', script: SCRIPTS[3] },
    { name: '座位4·提督', script: SCRIPTS[4] },
    { name: '座位5·大将', script: SCRIPTS[5] }
  ];
  await req('POST', '/api/match', {
    mode: 'emperor', emperors: [4, 3], sets: ['core'], seed: SEED, players, autoRun: true, speed: 0
  });
  push('A. 新建大将战（座位 0 是我/提督，我方大将座位 4，敌方大将座位 3，敌方提督 1/5）');

  const seenTurns = [];
  let comparisons = 0;
  let mismatch = 0;
  let breach = 0;
  let unlockOffered = 0;
  const evidence = [];

  for (let iter = 0; iter < 4000; iter++) {
    const snap = await req('GET', '/api/match?perspective=0');
    if (!snap.state) { await sleep(30); continue; }
    if (snap.state.status !== 'playing') break;
    if (!(snap.waitingForHuman && snap.actor === 0)) { await sleep(20); continue; }

    const state = snap.state;
    const me = state.players[0];
    const acts = snap.legalActions || [];
    const attackPlayers = acts.filter(a => a.type === 'attack' && a.targetType === 'player');
    const offered = new Set(attackPlayers.map(a => a.targetId));

    if (me.combat > 0) {
      const expected = expectedTargets(state, 0);
      comparisons++;
      const same = expected.size === offered.size && [...expected].every(id => offered.has(id));
      if (!same) {
        mismatch++;
        if (evidence.length < 4) evidence.push(`不匹配：界面给 [${[...offered].join(',')}]，独立重算 [${[...expected].join(',')}]`);
      }
      const opposite = 1; // 我方提督 [0,2] ↔ 敌方提督 [1,5]，座位 0 的对位是座位 1
      const oppositeDead = state.players[opposite].eliminated;
      const enemyEmperor = 3;
      if (!oppositeDead && offered.has(enemyEmperor)) breach++;
      if (oppositeDead && offered.has(enemyEmperor)) {
        unlockOffered++;
        if (evidence.length < 6) evidence.push(`对位 1 阵亡后，界面确实放出「攻击敌方大将 3」`);
      }
      if (seenTurns.length < 5) {
        seenTurns.push({
          turn: state.turn, combat: me.combat,
          offered: [...offered].map(id => `座位${id}(${id === 3 ? '敌方大将' : '敌方提督'})`).join(' / ') || '无',
          expected: [...expected].map(id => `座位${id}`).join(' / ') || '无'
        });
      }
    }

    // 待决（弃牌/事件选择等）先处理；否则手上还有牌就先打完，攒战斗值；否则结束回合
    if (state.pending) {
      await req('POST', '/api/action', { playerId: 0, action: acts[0] });
      continue;
    }
    const play = acts.find(a => a.type === 'play');
    if (me.combat === 0 && play) await req('POST', '/api/action', { playerId: 0, action: play });
    else await req('POST', '/api/action', { playerId: 0, action: { type: 'endTurn' } });
  }
  const finalA = await req('GET', '/api/match');
  push(`   结算：${finalA.result?.winningTeam !== null && finalA.result?.winningTeam !== undefined ? `队伍 ${finalA.result.winningTeam} 胜` : '未结束'} · ${finalA.result?.turns} 回合 · ${finalA.result?.actions} 动作`);
  push(`   战斗值>0 的可比时点 ${comparisons} 次：合法集不符 ${mismatch} 次 · 对位存活却可打大将 ${breach} 次 · 对位阵亡后放出大将 ${unlockOffered} 次`);
  for (const line of seenTurns) push(`   回合 ${line.turn} 战斗 ${line.combat}：界面 ${line.offered} ｜ 独立重算 ${line.expected}`);
  for (const line of evidence) push(`   ↪ ${line}`);
  if (mismatch || breach) ok = false;
  push('');

  // ——— B. 界面新开一局三头龙，全脚本自动跑完 ———
  await req('POST', '/api/match', {
    mode: 'hydra3', sets: ['core'], seed: `${SEED}-hydra`, autoRun: true, speed: 0,
    players: SCRIPTS.map((script, i) => ({ name: `座位${i}`, script }))
  });
  let last = null;
  for (let iter = 0; iter < 4000; iter++) {
    const snap = await req('GET', '/api/match');
    last = snap;
    if (snap.state && snap.state.status !== 'playing') break;
    await sleep(25);
  }
  push('B. 新建三头龙 3V3（全脚本自动）');
  push(`   结算：${last?.result?.winningTeam !== null && last?.result?.winningTeam !== undefined ? `队伍 ${last.result.winningTeam} 胜` : '未结束'} · ${last?.result?.turns} 回合 · ${last?.result?.actions} 动作 · 终局权威 ${(last?.result?.authorities || []).join('/')}`);
  // 从历史里核对行动顺序：最近 60 条的动作归属必须是整队连续
  const history = (last?.history || []).filter(r => r.description === '结束回合').slice(-12);
  push(`   最近 ${history.length} 次「结束回合」的座位：${history.map(r => r.playerId).join(' → ')}`);
  push('');

  push(`总判定：${ok ? '通过' : '失败'}`);
  if (serverErr.trim()) push(`服务端 stderr：${serverErr.trim().split('\n').slice(0, 3).join(' | ')}`);
  console.log(lines.join('\n'));
  if (!ok) process.exitCode = 1;
} finally {
  child.kill();
}
