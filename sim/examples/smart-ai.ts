// pokemon-showdown/sim/examples/smart-ai.ts

import {BattleStream} from '../battle-stream';
import {RBYOriginalAI} from './rby-original-ai';

type RequestData = any;

export type BattleCommand = {
  side: 'p1' | 'p2';
  choice: string;
};

export type SmartAIOptions = {
  formatid: string;
  p1Team: any[];
  p2Team: any[];
  rolloutsPerMove?: number;
  rolloutTurnLimit?: number;
};

export class SmartAI {
  formatid: string;
  p1Team: any[];
  p2Team: any[];
  rolloutsPerMove: number;
  rolloutTurnLimit: number;

  // Filled in by the runner after every committed turn.
  battleHistory: BattleCommand[] = [];

  constructor(options: SmartAIOptions) {
    this.formatid = options.formatid;
    this.p1Team = options.p1Team;
    this.p2Team = options.p2Team;
    this.rolloutsPerMove = options.rolloutsPerMove ?? 12;
    this.rolloutTurnLimit = options.rolloutTurnLimit ?? 8;
  }

  async choose(request: RequestData): Promise<string> {
    if (request.forceSwitch?.[0]) return this.bestSwitch(request);
    if (request.active?.[0]?.moves) return this.bestMoveByRollout(request);
    if (request.teamPreview) return 'team 123456';
    return 'default';
  }

  legalMoveChoices(request: RequestData): string[] {
    return request.active[0].moves
      .map((m: any, i: number) => ({...m, slot: i + 1}))
      .filter((m: any) => !m.disabled)
      .map((m: any) => `move ${m.slot}`);
  }

  legalSwitchChoices(request: RequestData): string[] {
    const pokemon = request.side?.pokemon ?? [];
    return pokemon
      .map((p: any, i: number) => ({p, slot: i + 1}))
      .filter((x: any) => !x.p.active && !String(x.p.condition).endsWith(' fnt'))
      .map((x: any) => `switch ${x.slot}`);
  }

  bestSwitch(request: RequestData): string {
    const choices = this.legalSwitchChoices(request);
    return choices[0] ?? 'default';
  }

  async bestMoveByRollout(request: RequestData): Promise<string> {
    const choices = this.legalMoveChoices(request);
    if (choices.length === 1) return choices[0];

    let bestChoice = choices[0];
    let bestScore = -Infinity;

    for (const candidate of choices) {
      let total = 0;

      for (let i = 0; i < this.rolloutsPerMove; i++) {
        const seed: [number, number, number, number] = [
          1000 + i,
          2000 + i,
          3000 + i,
          4000 + i,
        ];

        const score = await this.simulateCandidate(candidate, seed);
        total += score;
      }

      const average = total / this.rolloutsPerMove;

      if (average > bestScore) {
        bestScore = average;
        bestChoice = candidate;
      }
    }

    return bestChoice;
  }

  async simulateCandidate(
    candidateChoice: string,
    seed: [number, number, number, number]
  ): Promise<number> {
    const stream = new BattleStream();

    const p1Rollout = new RolloutHeuristicAI();
    const p2Rollout = new RBYOriginalAI([1, 3]);

    let p1Request: any = null;
    let p2Request: any = null;
    let winner: string | null = null;

    let committedHistoryIndex = 0;
    let candidateInjected = false;
    let simulatedTurnsAfterCandidate = 0;

    const reader = (async () => {
      for await (const chunk of stream) {
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('|win|')) {
            winner = line.split('|')[2] || null;
          }

          if (line.startsWith('|request|')) {
            const request = JSON.parse(line.slice('|request|'.length));
            if (request.side?.id === 'p1') p1Request = request;
            if (request.side?.id === 'p2') p2Request = request;
          }
        }

        // Replay already-committed real battle choices.
        while (
          committedHistoryIndex < this.battleHistory.length &&
          (p1Request || p2Request)
        ) {
          const command = this.battleHistory[committedHistoryIndex];

          if (command.side === 'p1' && p1Request) {
            stream.write(`>p1 ${command.choice}`);
            p1Request = null;
            committedHistoryIndex++;
          } else if (command.side === 'p2' && p2Request) {
            stream.write(`>p2 ${command.choice}`);
            p2Request = null;
            committedHistoryIndex++;
          } else {
            break;
          }
        }

        // Inject the candidate p1 move at the current decision point.
        if (
          committedHistoryIndex >= this.battleHistory.length &&
          !candidateInjected &&
          p1Request
        ) {
          stream.write(`>p1 ${candidateChoice}`);
          p1Request = null;
          candidateInjected = true;
        }

        // Let p2 respond using original RBY AI.
        if (
          committedHistoryIndex >= this.battleHistory.length &&
          candidateInjected &&
          p2Request
        ) {
          const choice = p2Rollout.choose(p2Request);
          stream.write(`>p2 ${choice}`);
          p2Request = null;
          simulatedTurnsAfterCandidate++;
        }

        // Continue rollout with cheap heuristic p1 and RBY p2.
        if (
          candidateInjected &&
          simulatedTurnsAfterCandidate < this.rolloutTurnLimit
        ) {
          if (p1Request) {
            const choice = p1Rollout.choose(p1Request);
            stream.write(`>p1 ${choice}`);
            p1Request = null;
          }

          if (p2Request) {
            const choice = p2Rollout.choose(p2Request);
            stream.write(`>p2 ${choice}`);
            p2Request = null;
            simulatedTurnsAfterCandidate++;
          }
        }

        if (winner || simulatedTurnsAfterCandidate >= this.rolloutTurnLimit) {
          stream.writeEnd();
          break;
        }
      }
    })();

    stream.write(`>start ${JSON.stringify({
      formatid: this.formatid,
      seed,
    })}`);

    stream.write(`>player p1 ${JSON.stringify({
      name: 'Smart AI Rollout',
      team: this.p1Team,
    })}`);

    stream.write(`>player p2 ${JSON.stringify({
      name: 'RBY Original AI Rollout',
      team: this.p2Team,
    })}`);

    await reader;

    if (winner === 'Smart AI Rollout') return 1_000_000;
    if (winner === 'RBY Original AI Rollout') return -1_000_000;

    // If the short rollout did not finish, use a neutral fallback.
    // You can improve this later by parsing HP/status from battle logs.
    return 0;
  }
}

class RolloutHeuristicAI {
  choose(request: RequestData): string {
    if (request.forceSwitch?.[0]) return this.chooseSwitch(request);
    if (request.active?.[0]?.moves) return this.chooseMove(request);
    if (request.teamPreview) return 'team 123456';
    return 'default';
  }

  chooseSwitch(request: RequestData): string {
    const pokemon = request.side?.pokemon ?? [];
    const options = pokemon
      .map((p: any, i: number) => ({p, slot: i + 1}))
      .filter((x: any) => !x.p.active && !String(x.p.condition).endsWith(' fnt'));

    return options.length ? `switch ${options[0].slot}` : 'default';
  }

  chooseMove(request: RequestData): string {
    const moves = request.active[0].moves
      .map((m: any, i: number) => ({...m, slot: i + 1}))
      .filter((m: any) => !m.disabled);

    let best = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      const score = this.scoreMove(move);
      if (score > bestScore) {
        best = move;
        bestScore = score;
      }
    }

    return `move ${best.slot}`;
  }

  scoreMove(move: any): number {
    const id = String(move.id || move.move || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (['recover', 'softboiled', 'rest'].includes(id)) return 75;
    if (['thunderwave', 'sleeppowder', 'hypnosis', 'stunspore', 'spore'].includes(id)) return 70;
    if (['swordsdance', 'amnesia', 'agility'].includes(id)) return 65;
    if (['explosion', 'selfdestruct'].includes(id)) return 60;

    let score = 0;

    if (typeof move.basePower === 'number') score += move.basePower;
    else score += 30;

    if (typeof move.accuracy === 'number') {
      score *= move.accuracy / 100;
    }

    return score;
  }
}
