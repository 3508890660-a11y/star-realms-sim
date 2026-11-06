/**
 * 从已落盘报告的逐局记录重算派生统计，不重跑对局。
 * 用于口径修正后刷新 members / contribution / stats / audit 与 Markdown，
 * 原始赛程、种子、胜负、回合数、终局权威一概不改。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  memberStats, fitContribution, auditSeatBalance
} from './engine/team-lab.js';
import { markdownReport } from './team-lab-cli.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'reply/star-realms-2v2-clone-core',
  'reply/star-realms-2v2-clone-all',
  'reply/star-realms-2v2-random-core',
  'reply/star-realms-2v2-random-all'
];
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8')).agents;
const modelIds = catalog.map(a => a.id);

for (const base of FILES) {
  const jsonPath = path.join(ROOT, `${base}.json`);
  if (!fs.existsSync(jsonPath)) { console.log(`跳过（尚未生成）：${base}`); continue; }
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const allGames = [];
  const titles = new Map(modelIds.map(id => [id, 0]));
  let frontWins = 0;

  for (const season of report.seasons) {
    const champion = season.teamRoster.find(t => t.id === season.champion);
    if (champion) {
      for (const model of new Set(champion.players.map(p => p.model))) {
        titles.set(model, (titles.get(model) || 0) + 1);
      }
    }
    for (const round of season.rounds) {
      for (const match of round.pairs) {
        for (const game of match.games) {
          allGames.push({ models: game.models, winningTeam: game.winningTeam });
          if (game.winningTeam === 0) frontWins++;
        }
      }
    }
  }

  const members = memberStats(allGames, modelIds);
  for (const row of members) row.titles = titles.get(row.id) || 0;
  const contribution = fitContribution(allGames, modelIds);
  const seatAudit = auditSeatBalance(members);
  const playedGames = allGames.length;

  if (playedGames !== report.audit.playedGames) {
    throw new Error(`${base} 逐局数与审计不符：${playedGames} vs ${report.audit.playedGames}`);
  }
  if (members.some(row => row.games !== members[0].games)) {
    throw new Error(`${base} 每个模型参与局数不相等`);
  }

  report.members = members;
  report.contribution = contribution;
  report.stats = {
    ...report.stats,
    frontSideWins: frontWins,
    totalGames: playedGames,
    frontSideRate: +(frontWins / playedGames).toFixed(4)
  };
  report.audit = {
    ...report.audit,
    playedGames,
    perModelGames: members[0].games,
    perModelSeatAppearances: members[0].seatAppearances,
    seatBalanced: seatAudit.balanced,
    seatDistinctCounts: seatAudit.distinctCounts
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(ROOT, `${base}.md`), markdownReport(report), 'utf8');
  console.log(`${base}: ${playedGames} 局 · 每人参与 ${members[0].games} 局 / 座位 ${members[0].seatAppearances} 次 · 座位配平 ${seatAudit.balanced} · β 第一 ${contribution.rows[0].id}`);
}
