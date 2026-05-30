// pokemon-showdown/sim/examples/smart-ai.ts

type RequestData = any;

export class SmartAI {
  choose(request: RequestData): string {
    if (request.forceSwitch?.[0]) return this.bestSwitch(request);
    if (request.active?.[0]?.moves) return this.bestMove(request);
    if (request.teamPreview) return 'team 123456';
    return 'default';
  }

  bestMove(request: RequestData): string {
    const moves = request.active[0].moves
      .map((m: any, i: number) => ({...m, slot: i + 1}))
      .filter((m: any) => !m.disabled);

    // Simple baseline heuristic:
    // 1. prefer KO
    // 2. prefer highest expected damage
    // 3. prefer status/recovery if useful
    // Replace this with battle-state cloning + rollouts later.
    let best = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      const score = this.scoreMove(move, request);
      if (score > bestScore) {
        best = move;
        bestScore = score;
      }
    }

    return `move ${best.slot}`;
  }

  bestSwitch(request: RequestData): string {
    const side = request.side;
    const options = side.pokemon
      .map((p: any, i: number) => ({p, slot: i + 1}))
      .filter((x: any, i: number) => i > 0 && !x.p.condition.endsWith(' fnt'));

    return `switch ${options[0]?.slot ?? 2}`;
  }

  scoreMove(move: any, request: RequestData): number {
    let score = 0;

    // You can enrich requests to include expectedDamage, typeMod, targetHP, etc.
    if (typeof move.basePower === 'number') score += move.basePower;
    if (typeof move.accuracy === 'number') score *= move.accuracy / 100;
    if (move.typeMod > 0) score *= 1.5;
    if (move.typeMod < 0) score *= 0.5;

    if (move.id === 'recover' || move.id === 'softboiled' || move.id === 'rest') {
      score += 25;
    }

    return score;
  }
}
