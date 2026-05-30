// pokemon-showdown/config/custom-formats.ts

export const Formats: import('../sim/dex-formats').FormatList = [
  {
    section: "Custom Trainer Tournaments",
  },
  {
    name: "[Gen 1] Ubers Smart vs RBY AI",
    mod: 'gen1rbyaitournament',
    ruleset: ['[Gen 1] Ubers', 'RBY AI Stat Drop Fail'],
    challengeShow: false,
    searchShow: false,
    tournamentShow: false,
    rated: false,
  },
];
