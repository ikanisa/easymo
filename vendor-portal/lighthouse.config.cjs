const sharedSettings = {
  formFactor: "mobile",
  screenEmulation: {
    mobile: true,
    width: 360,
    height: 640,
    deviceScaleFactor: 3,
    disabled: false,
  },
  throttlingMethod: "simulate",
  throttling: {
    cpuSlowdownMultiplier: 4,
    downloadThroughputKbps: 1500,
    uploadThroughputKbps: 750,
    rttMs: 150,
  },
};

module.exports = {
  extends: "lighthouse:default",
  settings: sharedSettings,
  ci: {
    collect: {
      numberOfRuns: 1,
      settings: sharedSettings,
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.88 }],
        "categories:accessibility": ["error", { minScore: 0.96 }],
        "categories:best-practices": ["error", { minScore: 0.92 }],
        "categories:seo": ["error", { minScore: 0.92 }],
        "categories:pwa": ["error", { minScore: 0.9 }],
      },
    },
  },
};
