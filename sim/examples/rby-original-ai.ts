// pokemon-showdown/sim/examples/rby-original-ai.ts

type RequestData = any;

const WILD_SLOT_WEIGHTS = [63, 64, 63, 66];

const CATEGORY_2_MOVES = new Set([
  'meditate', 'sharpen',
  'defensecurl', 'harden', 'withdraw',
  'growth',
  'doubleteam', 'minimize',
  'payday', 'swift',
  'growl', 'leer', 'tailwhip',
  'stringshot',
  'flash', 'kinesis', 'sandattack', 'smokescreen',
  'conversion', 'haze',
  'swordsdance',
  'acidarmor', 'barrier',
  'agility',
  'amnesia',
  'recover', 'rest', 'softboiled',
  'transform',
  'screech',
  'lightscreen', 'reflect',
]);

const STATUS_MOVES_CATEGORY_1 = new Set([
  'glare', 'hypnosis', 'sing', 'sleeppowder', 'stunspore',
  'poisonpowder', 'toxic', 'thunderwave', 'spore',
  'confuseray', 'supersonic',
]);

const SET_DAMAGE_MOVES = new Set([
  'dragonrage', 'psywave', 'nightshade', 'seismictoss', 'sonicboom',
]);

export class RBYOriginalAI {
  categories: Set<1 | 2 | 3>;
  turnsActive = 0;

  constructor(categories: Array<1 | 2 | 3> = [1, 3]) {
    this.categories = new Set(categories);
  }

  choose(request: RequestData): string {
  if (request.forceSwitch?.[0]) return this.chooseSwitch(request);
  if (request.active?.[0]?.moves) return this.chooseMove(request);
  if (request.teamPreview) return 'team 123456';
  return 'default';
}
  }

  chooseSwitch(request: RequestData): string {
    const side = request.side;
    const firstHealthyBench = side.pokemon.findIndex((p: any, i: number) =>
      i > 0 && !p.condition.endsWith(' fnt')
    );
    return `switch ${firstHealthyBench + 1}`;
  }

  chooseMove(request: RequestData): string {
    const moves = request.active[0].moves
      .map((m: any, i: number) => ({...m, slot: i + 1}))
      .filter((m: any) => !m.disabled);

    let candidates = moves.slice();

    // Category 1: strongly discourage redundant status moves.
    if (this.categories.has(1) && request.foe?.active?.[0]?.status) {
      const nonRedundant = candidates.filter((m: any) => !STATUS_MOVES_CATEGORY_1.has(toID(m.id || m.move)));
      if (nonRedundant.length) candidates = nonRedundant;
    }

    // Category 2: on the second turn active, encourage specific “good” effects.
    // The guide notes this appears bugged: intended first turn, actually second turn. 
    if (this.categories.has(2) && this.turnsActive === 1) {
      const boosted = candidates.filter((m: any) => CATEGORY_2_MOVES.has(toID(m.id || m.move)));
      if (boosted.length) candidates = boosted;
    }

    // Category 3: prefer super-effective moves, even status ones.
    // You will need Showdown request enrichment or a helper evaluator for exact Gen 1 type logic.
    if (this.categories.has(3)) {
      const superEffective = candidates.filter((m: any) => m.typeMod > 0);
      if (superEffective.length) candidates = superEffective;
    }

    this.turnsActive++;
    return `move ${this.weightedSlotPick(candidates)}`;
  }

  weightedSlotPick(moves: Array<{slot: number}>): number {
    const validSlots = new Set(moves.map(m => m.slot));

    while (true) {
      const roll = Math.floor(Math.random() * 256);
      let acc = 0;
      for (let i = 0; i < 4; i++) {
        acc += WILD_SLOT_WEIGHTS[i];
        if (roll < acc && validSlots.has(i + 1)) return i + 1;
      }
    }
  }
}

function toID(text: string) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}
