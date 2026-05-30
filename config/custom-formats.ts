// pokemon-showdown/config/custom-formats.ts

export const Formats: import('../sim/dex-formats').FormatList = [
  {
    section: "Custom Trainer Tournaments",
  },
  {
    name: "[Gen 1] Ubers Smart vs RBY AI",
    desc: "Gen 1 Ubers tournament simulator: p1 smart AI vs p2 RBY-style original AI.",
    mod: 'gen1rbyaitournament',
    ruleset: ['[Gen 1] Ubers'],
    challengeShow: false,
    searchShow: false,
    tournamentShow: false,
    rated: false,
  },
];
