// pokemon-showdown/sim/examples/run-rby-ai-tournament.ts

import {BattleStream} from '../battle-stream';
import {SmartAI, BattleCommand} from './smart-ai';
import {RBYOriginalAI} from './rby-original-ai';
import {TEAM_A, TEAM_B} from './teams';

const FORMAT = 'gen1uberssmartvsrbyai';
const NUM_BATTLES = 100;

type BattleResult = {
  battleNumber: number;
  winner: string | null;
  turns: number;
};

async function runBattle(
  battleNumber: number,
  p1Team: any[],
  p2Team: any[]
): Promise<BattleResult> {
  const stream = new BattleStream();

  const history: BattleCommand[] = [];

  const p1 = new SmartAI({
    formatid: FORMAT,
    p1Team,
    p2Team,
    rolloutsPerMove: 8,
    rolloutTurnLimit: 6,
  });

  const p2 = new RBYOriginalAI([1, 3]);

  p1.battleHistory = history;

  let p1Request: any = null;
  let p2Request: any = null;
  let winner: string | null = null;
  let turns = 0;

  const seed: [number, number, number, number] = [
    battleNumber + 11,
    battleNumber + 101,
    battleNumber + 1001,
    battleNumber + 10001,
  ];

  const reader = (async () => {
    for await (const chunk of stream) {
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        if (line.startsWith('|turn|')) {
          turns = Number(line.split('|')[2] || turns);
        }

        if (line.startsWith('|win|')) {
          winner = line.split('|')[2] || null;
        }

        if (line.startsWith('|request|')) {
          const request = JSON.parse(line.slice('|request|'.length));
          if (request.side?.id === 'p1') p1Request = request;
          if (request.side?.id === 'p2') p2Request = request;
        }
      }

      if (p1Request) {
        const choice = await p1.choose(p1Request);
        history.push({side: 'p1', choice});
        stream.write(`>p1 ${choice}`);
        p1Request = null;
      }

      if (p2Request) {
        const choice = p2.choose(p2Request);
        history.push({side: 'p2', choice});
        stream.write(`>p2 ${choice}`);
        p2Request = null;
      }

      if (winner) {
        stream.writeEnd();
        break;
      }
    }
  })();

  stream.write(`>start ${JSON.stringify({
    formatid: FORMAT,
    seed,
  })}`);

  stream.write(`>player p1 ${JSON.stringify({
    name: 'Smart AI',
    team: p1Team,
  })}`);

  stream.write(`>player p2 ${JSON.stringify({
    name: 'RBY Original AI',
    team: p2Team,
  })}`);

  await reader;

  return {
    battleNumber,
    winner,
    turns,
  };
}

async function main() {
  let smartWins = 0;
  let originalWins = 0;
  let tiesOrErrors = 0;
  let totalTurns = 0;

  const results: BattleResult[] = [];

  for (let i = 1; i <= NUM_BATTLES; i++) {
    const result = await runBattle(i, TEAM_A, TEAM_B);
    results.push(result);
    totalTurns += result.turns;

    if (result.winner === 'Smart AI') smartWins++;
    else if (result.winner === 'RBY Original AI') originalWins++;
    else tiesOrErrors++;

    console.log(
      `Battle ${i}/${NUM_BATTLES}: winner=${result.winner ?? 'none'}, turns=${result.turns}`
    );
  }

  console.log('');
  console.log('=== Tournament Results ===');
  console.log(`Format: ${FORMAT}`);
  console.log(`Battles: ${NUM_BATTLES}`);
  console.log(`Smart AI wins: ${smartWins}`);
  console.log(`RBY Original AI wins: ${originalWins}`);
  console.log(`Ties/errors/no result: ${tiesOrErrors}`);
  console.log(`Smart AI win rate: ${(smartWins / NUM_BATTLES * 100).toFixed(2)}%`);
  console.log(`Original AI win rate: ${(originalWins / NUM_BATTLES * 100).toFixed(2)}%`);
  console.log(`Average turns: ${(totalTurns / NUM_BATTLES).toFixed(2)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
