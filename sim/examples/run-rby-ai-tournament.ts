// pokemon-showdown/sim/examples/run-rby-ai-tournament.ts

import {BattleStream} from '../../sim/battle-stream';
import {SmartAI} from './smart-ai';
import {RBYOriginalAI} from './rby-original-ai';

const FORMAT = 'gen1uberssmartvsrbyai';

export async function runBattle(p1Team: string, p2Team: string, seed?: number[]) {
  const stream = new BattleStream();

  const p1 = new SmartAI();
  const p2 = new RBYOriginalAI([1, 3]);

  let latestP1Request: any = null;
  let latestP2Request: any = null;
  let winner: string | null = null;

  (async () => {
    for await (const chunk of stream) {
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('|request|')) {
          // In actual Showdown output, request routing may need to be tracked
          // per side depending on the stream output shape you are using.
          const json = JSON.parse(line.slice('|request|'.length));
          if (json.side?.id === 'p1') latestP1Request = json;
          if (json.side?.id === 'p2') latestP2Request = json;
        }

        if (line.startsWith('|win|')) {
          winner = line.split('|')[2];
        }
      }

      if (latestP1Request) {
        stream.write(`>p1 ${p1.choose(latestP1Request)}`);
        latestP1Request = null;
      }

      if (latestP2Request) {
        stream.write(`>p2 ${p2.choose(latestP2Request)}`);
        latestP2Request = null;
      }
    }
  })();

  stream.write(`>start ${JSON.stringify({
    formatid: FORMAT,
    seed: seed ?? [1, 2, 3, 4],
  })}`);

  stream.write(`>player p1 ${JSON.stringify({
    name: 'Smart AI',
    team: p1Team,
  })}`);

  stream.write(`>player p2 ${JSON.stringify({
    name: 'RBY Original AI',
    team: p2Team,
  })}`);

  return winner;
}
