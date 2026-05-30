// pokemon-showdown/data/mods/gen1rbyaitournament/rulesets.ts

const RBY_PRIMARY_STAT_DROP_MOVES = new Set([
  'growl',
  'leer',
  'tailwhip',
  'stringshot',
  'flash',
  'kinesis',
  'sandattack',
  'smokescreen',
  'screech',
]);

export const Rulesets: {[k: string]: ModdedFormatData} = {
  rbyaistatdropfail: {
    effectType: 'Rule',
    name: 'RBY AI Stat Drop Fail',
    desc: 'When p2, the RBY-style AI, uses a primary stat-decreasing move, it has an extra 25% chance to fail.',
    onBeforeMovePriority: 100,
    onBeforeMove(pokemon, target, move) {
      // Convention: p1 = smart AI, p2 = original RBY AI.
      if (pokemon.side.id !== 'p2') return;

      if (!RBY_PRIMARY_STAT_DROP_MOVES.has(move.id)) return;

      // “Additional 25% chance to fail on top of original accuracy.”
      // This is independent of the normal Gen 1 accuracy check.
      if (this.randomChance(1, 4)) {
        this.add('-fail', pokemon, move, '[from] rule: RBY AI Stat Drop Fail');
        return false;
      }
    },
  },
};
