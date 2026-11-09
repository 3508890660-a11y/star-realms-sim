// 实况对局追踪：用当前时间做种子新建对局，逐步跑完，并独立校验
// ① 行动顺序（整队轮流、队内升序）② 攻击目标（提督对位/大将特权）。
// 判定逻辑全部在本文件内重算，不调用 modes.js 的 canAttackPlayer/canTargetBase，
// 避免「用被测函数验证被测函数」。
import { MatchRunner } from '../src/engine/runner.js';
import { getCardDef } from '../src/engine/cards.js';

const SEAT_SCRIPTS = [
  'script:agent-hy4.js',
  'script:agent-glm53.js',
  'script:agent-deepseekv41flash.js',
  'script:agent-minimaxm3.js',
  'script:agent-kimi31pro.js',
  'script:agent-mimov26pro.js'
];

const SEED = `live-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;

function roleOf(state, id) {
  return (state.emperors || []).includes(id) ? '大将' : '提督';
}

function teamName(state, id) {
  return state.teams?.[state.players[id].team]?.name || `队 ${state.players[id].team}`;
}

function seatTag(state, id) {
  const mode = state.mode === 'emperor' ? roleOf(state, id) : '队员';
  return `座位 ${id}（${teamName(state, id)}·${mode}）`;
}

/** 独立重算：某攻击者的合法目标集合（玩家）。
 *  applyOutpost=false 只看「角色/队伍」规则；true 再叠加前哨保护。 */
function legalPlayerTargets(state, attacker, applyOutpost = true) {
  const out = new Set();
  const isTeam = state.mode === 'team2v2' || state.mode === 'hydra3';
  const attackerEmperor = (state.emperors || []).includes(attacker);
  const ownTeam = state.players[attacker].team;
  // 提督对位：两队提督各按队内座位升序一一配对
  let opposite = null;
  if (state.mode === 'emperor' && !attackerEmperor) {
    const own = state.players.filter(p => p.team === ownTeam && !(state.emperors || []).includes(p.id)).map(p => p.id).sort((a, b) => a - b);
    const rival = state.players.filter(p => p.team !== ownTeam && !(state.emperors || []).includes(p.id)).map(p => p.id).sort((a, b) => a - b);
    const index = own.indexOf(attacker);
    opposite = index >= 0 && index < rival.length ? rival[index] : null;
  }
  // 前哨保护：团队模式看整队，其余模式看个人
  const hasOutpost = ownerId => {
    const owners = isTeam
      ? state.players.filter(p => p.team === state.players[ownerId].team).map(p => p.id)
      : [ownerId];
    return owners.some(id => state.players[id].inPlay.some(uid => getCardDef(uid, state).outpost));
  };
  for (const p of state.players) {
    if (p.id === attacker || p.eliminated) continue;
    if (applyOutpost && hasOutpost(p.id)) continue; // 有前哨的玩家/队伍无法被直接攻击
    if (isTeam) {
      if (p.team !== ownTeam) out.add(p.id);
      continue;
    }
    if (state.mode === 'emperor') {
      if (p.team === ownTeam) continue;
      if (attackerEmperor) { out.add(p.id); continue; } // 大将可打任何敌方
      if (opposite === null) continue;
      if (p.id === opposite) { out.add(p.id); continue; }
      // 对位提督阵亡后，才解锁敌方大将
      const oppositeDead = state.players[opposite].eliminated;
      const targetIsEmperor = (state.emperors || []).includes(p.id);
      if (oppositeDead && targetIsEmperor) out.add(p.id);
      continue;
    }
    out.add(p.id);
  }
  return out;
}

/** 独立重算：是否存在「提督越位打大将」——即对位提督还活着却打敌方大将。 */
function admiralBreach(state, attacker, target) {
  if (state.mode !== 'emperor') return null;
  if ((state.emperors || []).includes(attacker)) return null;
  if (!(state.emperors || []).includes(target)) return null;
  const ownTeam = state.players[attacker].team;
  const own = state.players.filter(p => p.team === ownTeam && !(state.emperors || []).includes(p.id)).map(p => p.id).sort((a, b) => a - b);
  const rival = state.players.filter(p => p.team !== ownTeam && !(state.emperors || []).includes(p.id)).map(p => p.id).sort((a, b) => a - b);
  const opposite = rival[own.indexOf(attacker)];
  return { opposite, oppositeDead: state.players[opposite]?.eliminated === true };
}

async function traceOne({ label, mode, seats, emperors, sets }) {
  const players = seats.map((script, i) => ({ name: `座位${i}`, script }));
  const config = { mode, seed: `${SEED}-${label}`, players, expansions: { sets } };
  if (mode === 'emperor') config.emperors = emperors;
  const runner = await MatchRunner.create(config);
  const state = runner.game.state;

  const order = [];        // 每次换人后的行动者
  const attacks = [];      // 攻击明细
  const breaches = [];     // 提督越位
  const orderBreaks = [];  // 行动顺序违规
  const illegalTargets = [];
  const offeredMismatch = []; // 引擎给出的合法目标 vs 独立重算
  const unlockSeen = [];   // 对位阵亡后，提督确实被放行打大将
  const emperorVsAdmiral = []; // 大将打敌方提督
  const baseAttacks = [];
  let decisions = 0;
  let comparableDecisions = 0;
  let admiralDecisions = 0;
  let admiralWithEmperorOfferedWhileOppositeAlive = 0;
  let admiralWithEmperorOfferedAfterUnlock = 0;
  let admiralWithEmperorOfferedAfterUnlockActual = 0;
  const opening = [];
  const teamSwitchChecks = [];
  let prevOwner = null;
  let guard = 0;

  while (state.status === 'playing' && guard++ < 20000) {
    const owner = state.activePlayer;
    if (owner !== prevOwner) {
      // —— 独立校验：整队轮流 + 队内升序 ——
      if (prevOwner !== null) {
        const prevTeam = state.players[prevOwner].team;
        const nextTeam = state.players[owner].team;
        const aliveSeatsOf = team => state.players.filter(p => p.team === team && !p.eliminated).map(p => p.id).sort((a, b) => a - b);
        if (prevTeam === nextTeam) {
          const bigger = aliveSeatsOf(prevTeam).filter(s => s > prevOwner);
          const expected = bigger.length ? Math.min(...bigger) : null;
          if (expected !== owner) {
            orderBreaks.push(`同队换人 ${prevOwner} → ${owner}，按座位升序应为 ${expected}`);
          }
        } else {
          const ownBigger = aliveSeatsOf(prevTeam).filter(s => s > prevOwner);
          if (ownBigger.length) {
            orderBreaks.push(`队 ${prevTeam} 未走完就换队：${prevOwner} 之后还有座位 ${ownBigger.join('/')}`);
          }
          const rivalSmallest = Math.min(...aliveSeatsOf(nextTeam));
          if (rivalSmallest !== owner) {
            orderBreaks.push(`换队后应从头开始，实际 ${owner}，应为 ${rivalSmallest}`);
          }
          teamSwitchChecks.push(`${prevTeam}→${nextTeam}`);
        }
      }
      order.push(owner);
      prevOwner = owner;
    }

    // 记录该次决策前的攻击合法性基线
    const actor = state.pending ? state.pending.player : state.activePlayer;
    const legalBefore = legalPlayerTargets(state, actor);
    const pending = Boolean(state.pending);
    const canAttackNow = state.players[actor].combat > 0;
    const engineOffered = pending || !canAttackNow ? null : new Set(
      runner.game.legalActions()
        .filter(a => a.type === 'attack' && a.targetType === 'player')
        .map(a => a.targetId)
    );
    const record = await runner.step();
    if (!record) break;
    decisions++;

    // —— 独立校验：引擎本次给出的「可攻击玩家」集合，必须等于独立重算 ——
    if (engineOffered) {
      comparableDecisions++;
      const same = engineOffered.size === legalBefore.size && [...engineOffered].every(id => legalBefore.has(id));
      if (!same) {
        offeredMismatch.push(`#${record.index} 座位 ${actor}：引擎给 [${[...engineOffered].sort((a, b) => a - b).join(',')}]，独立重算 [${[...legalBefore].sort((a, b) => a - b).join(',')}]`);
      }
    }
    if (state.mode === 'emperor' && !(state.emperors || []).includes(actor) && canAttackNow) {
      admiralDecisions++;
      const ownTeam = state.players[actor].team;
      const own = state.players.filter(p => p.team === ownTeam && !(state.emperors || []).includes(p.id)).map(p => p.id).sort((a, b) => a - b);
      const rival = state.players.filter(p => p.team !== ownTeam && !(state.emperors || []).includes(p.id)).map(p => p.id).sort((a, b) => a - b);
      const opposite = rival[own.indexOf(actor)];
      const enemyEmperor = state.players.find(p => p.team !== ownTeam && (state.emperors || []).includes(p.id) && !p.eliminated);
      if (enemyEmperor) {
        const byRole = legalPlayerTargets(state, actor, false); // 只看角色规则
        const inRole = byRole.has(enemyEmperor.id);
        const inActual = legalBefore.has(enemyEmperor.id);      // 再叠加前哨
        const dead = opposite !== undefined && state.players[opposite].eliminated;
        const targetHasOutpost = state.players[enemyEmperor.id].inPlay.some(uid => getCardDef(uid, state).outpost);
        if (inRole && !dead) {
          admiralWithEmperorOfferedWhileOppositeAlive++;
          breaches.push(`#${record.index} 座位 ${actor}：对位 ${opposite} 仍存活，规则却把大将 ${enemyEmperor.id} 判为可攻击`);
        }
        if (inRole && dead) {
          admiralWithEmperorOfferedAfterUnlock++;
          if (inActual) admiralWithEmperorOfferedAfterUnlockActual++;
          if (unlockSeen.length < 6) {
            unlockSeen.push(`#${record.index} 座位 ${actor}（提督）对位 ${opposite} 阵亡 → 规则放行打大将 ${enemyEmperor.id}${targetHasOutpost ? '（该大将当前有前哨，实际仍需先拆前哨）' : ''}`);
          }
        }
        if (!inRole && dead) {
          offeredMismatch.push(`#${record.index} 座位 ${actor}：对位 ${opposite} 已阵亡，规则仍未放行大将 ${enemyEmperor.id}`);
        }
      }
    }
    if (opening.length < 12) opening.push(`#${String(record.index).padStart(4, '0')} ${seatTag({ ...state, mode }, record.playerId)} ${record.description}`);

    const action = record.action;
    if (action.type === 'attack') {
      const targetType = action.targetType;
      const target = action.targetId;
      let why = '';
      if (targetType === 'player') {
        const ok = legalBefore.has(target);
        if (!ok) illegalTargets.push(`#${record.index} ${seatTag(state, record.playerId)} → 座位 ${target} 不在独立重算的合法集合 [${[...legalBefore].join(',')}]`);
        const br = admiralBreach(state, record.playerId, target);
        if (br) {
          if (!br.oppositeDead) breaches.push(`#${record.index} 座位 ${record.playerId} 打大将 ${target} 时对位 ${br.opposite} 仍存活`);
          why = br.oppositeDead ? `对位 ${br.opposite} 已阵亡 → 解锁大将` : `对位 ${br.opposite} 存活`;
        } else if ((state.emperors || []).includes(record.playerId)) {
          why = '大将特权 · 可打任何敌方';
        } else {
          why = '敌对阵位';
        }
      } else {
        why = '打基地';
        baseAttacks.push({ index: record.index, by: seatTag(state, record.playerId), to: `基地 ${state.cards[target]?.id || target}` });
      }
      if (state.mode === 'emperor'
        && (state.emperors || []).includes(record.playerId)
        && targetType === 'player'
        && !(state.emperors || []).includes(target)) {
        emperorVsAdmiral.push(`#${record.index} 座位 ${record.playerId}（大将）→ 座位 ${target}（敌方提督）`);
      }
      attacks.push({
        index: record.index, turn: `T${state.turn}`,
        by: seatTag(state, record.playerId), to: targetType === 'player' ? seatTag(state, target) : `基地 ${state.cards[target]?.id || target}`,
        amount: action.amount, why,
        legal: targetType !== 'player' || legalBefore.has(target)
      });
    }
  }

  const result = runner.result();
  return {
    label, mode, emperors, order, attacks, breaches, orderBreaks, illegalTargets,
    offeredMismatch, unlockSeen, emperorVsAdmiral, baseAttacks, opening, result,
    seatCount: seats.length, decisions, comparableDecisions, admiralDecisions,
    admiralWithEmperorOfferedWhileOppositeAlive, admiralWithEmperorOfferedAfterUnlock,
    admiralWithEmperorOfferedAfterUnlockActual
  };
}

function summarize(t) {
  const orderSeq = t.order.map((id, i) => (i && t.order[i - 1] === id ? '' : String(id))).filter(Boolean).join(' → ');
  return { orderSeq, ...t };
}

const CASES = [
  { label: 'team2v2', mode: 'team2v2', seats: SEAT_SCRIPTS.slice(0, 4), sets: ['core'] },
  { label: 'hydra3', mode: 'hydra3', seats: SEAT_SCRIPTS, sets: ['core'] },
  { label: 'emperor-e01', mode: 'emperor', seats: SEAT_SCRIPTS, emperors: [0, 1], sets: ['core'] },
  { label: 'emperor-e23', mode: 'emperor', seats: SEAT_SCRIPTS, emperors: [2, 3], sets: ['core'] },
  { label: 'emperor-e45', mode: 'emperor', seats: SEAT_SCRIPTS, emperors: [4, 5], sets: ['core'] }
];

const out = [];
const push = line => out.push(line);
push(`实况对局追踪 · 种子前缀 ${SEED}`);
push(`全部为新建对局（种子含当前时间），与 reply/ 中任何报告无关。`);
push('');

let allOk = true;
for (const testCase of CASES) {
  const t = summarize(await traceOne(testCase));
  const r = t.result;
  const winner = r.winningTeam !== null && r.winningTeam !== undefined
    ? `队伍 ${r.winningTeam} 胜` : `座位 ${r.winner} 胜`;
  const ok = t.breaches.length === 0 && t.orderBreaks.length === 0 && t.illegalTargets.length === 0 && t.offeredMismatch.length === 0;
  allOk &&= ok;

  push('─'.repeat(78));
  push(`对局 ${t.label} · ${t.mode}${t.emperors ? ` · 大将座位 [${t.emperors.join(', ')}]` : ''} · 种子 ${SEED}-${t.label}`);
  push(`座位身份：${Array.from({ length: t.seatCount }, (_, i) => `${i}=${t.mode === 'emperor' ? (t.emperors.includes(i) ? '大将' : '提督') : '队员'}`).join('  ')}`);
  push(`先手 12 个动作：`);
  for (const line of t.opening) push(`  ${line}`);
  push(`行动顺序：${t.orderSeq}`);
  push(`攻击记录（共 ${t.attacks.length} 次）：`);
  const show = t.attacks.slice(0, 14);
  for (const a of show) {
    push(`  #${String(a.index).padStart(4, '0')} ${a.turn} ${a.by} → ${a.to} ${a.amount} 点  ${a.legal ? 'OK' : '非法'} · ${a.why}`);
  }
  if (t.attacks.length > show.length) push(`  …另有 ${t.attacks.length - show.length} 次攻击（略）`);
  push(`结算：${winner} · ${r.turns} 回合 · ${r.actions} 动作 · 终局权威 ${r.authorities.join('/')}`);
  push(`决策级审计：${t.decisions} 次决策（提督 ${t.admiralDecisions} 次），其中 ${t.comparableDecisions} 次战斗值 > 0、可比对「引擎合法目标 vs 独立重算」`);
  if (t.mode === 'emperor') {
    push(`  · 对位存活时把敌方大将判为可打：${t.admiralWithEmperorOfferedWhileOppositeAlive} 次（应为 0）`);
    push(`  · 对位阵亡后规则放行打大将：${t.admiralWithEmperorOfferedAfterUnlock} 次，其中无前哨阻挡、引擎实际放出 ${t.admiralWithEmperorOfferedAfterUnlockActual} 次`);
    push(`  · 大将攻击敌方提督：${t.emperorVsAdmiral.length} 次`);
    for (const line of t.unlockSeen.slice(0, 3)) push(`    ↪ ${line}`);
    for (const line of t.emperorVsAdmiral.slice(0, 3)) push(`    ↪ ${line}`);
  }
  push(`  · 基地攻击：${t.baseAttacks.length} 次`);
  push(`校验：提督越位 ${t.breaches.length} 次 · 行动顺序违规 ${t.orderBreaks.length} 次 · 目标非法 ${t.illegalTargets.length} 次 · 合法集不符 ${t.offeredMismatch.length} 次 → ${ok ? '通过' : '失败'}`);
  for (const b of t.breaches) push(`  ✗ ${b}`);
  for (const b of t.orderBreaks) push(`  ✗ ${b}`);
  for (const b of t.illegalTargets) push(`  ✗ ${b}`);
  for (const b of t.offeredMismatch) push(`  ✗ ${b}`);
  push('');
}

push('─'.repeat(78));
push(`总判定：${allOk ? '5 局全部通过' : '存在失败项'}`);
console.log(out.join('\n'));
if (!allOk) process.exitCode = 1;
