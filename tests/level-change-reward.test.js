import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadModule(storage = {}) {
  globalThis.window = globalThis;
  globalThis.localStorage = {
    _data: { ...storage },
    getItem(k) {
      return k in this._data ? this._data[k] : null;
    },
    setItem(k, v) {
      this._data[k] = v;
    },
  };
  const layoutCode = readFileSync(join(rootDir, "js/layout-config.js"), "utf8");
  const rewardCode = readFileSync(join(rootDir, "js/level-change-reward.js"), "utf8");
  new Function("window", layoutCode)(globalThis);
  new Function("window", rewardCode)(globalThis);
  return globalThis.LevelChangeReward;
}

beforeEach(() => {
  delete globalThis.LayoutConfig;
  delete globalThis.LevelChangeReward;
});

test("options are cumulative and persist independently", () => {
  const Reward = loadModule();
  assert.equal(Reward.isEnabled("starsPulse"), true);
  assert.equal(Reward.isEnabled("celebrateLabel"), true);
  assert.equal(Reward.isEnabled("sparkle"), false);
  assert.deepEqual(Reward.REWARD_OPTS.map((o) => o.key), [
    "starsPulse",
    "celebrateLabel",
    "sparkle",
  ]);

  Reward.setEnabled("sparkle", true);
  Reward.setEnabled("starsPulse", false);

  assert.deepEqual(Reward.getEnabledKeys(), ["celebrateLabel", "sparkle"]);
  assert.equal(Reward.isAnyEnabled(), true);

  Reward.setEnabled("celebrateLabel", false);
  assert.deepEqual(Reward.getEnabledKeys(), ["sparkle"]);
});

test("play returns 0 when no option enabled", () => {
  const Reward = loadModule();
  Reward.setEnabled("starsPulse", false);
  Reward.setEnabled("celebrateLabel", false);
  assert.equal(Reward.play(), 0);
});

test("play returns duration when at least one option enabled", () => {
  const Reward = loadModule();
  Reward.setEnabled("starsPulse", false);
  Reward.setEnabled("celebrateLabel", false);
  Reward.setEnabled("sparkle", true);
  assert.equal(Reward.play(), Reward.DURATION_MS);
});
