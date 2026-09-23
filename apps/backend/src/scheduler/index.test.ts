import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * WHY THIS FILE:
 *  - PROBLEM: all five sweeps are individually well tested, and every one of
 *    those tests calls the sweep directly. Nothing checked that the sweeps are
 *    actually WIRED IN — that starting the app runs them, and keeps running
 *    them. Drop a line from runAllSweeps and every existing test still passes
 *    while that sweep silently never runs in production again.
 *  - COST OF FAILURE: total and invisible, for whichever sweep it is. The
 *    escalation clocks stop chasing referrers, or nothing is ever cleaned up,
 *    and the only symptom is an absence — no error, no alert, just nothing
 *    happening. The retention sweep already spent days broken exactly that way.
 *  - METHOD: the sweeps themselves are mocked; this is purely about whether
 *    the wiring calls them. Fake timers, so the 15-minute interval is proved
 *    without waiting 15 minutes.
 */

const escalation = vi.fn().mockResolvedValue(undefined);
const creditGrant = vi.fn().mockResolvedValue(undefined);
const retention = vi.fn().mockResolvedValue(undefined);
const jobCleanup = vi.fn().mockResolvedValue(undefined);
const jobLiveness = vi.fn().mockResolvedValue(undefined);

vi.mock('./escalationSweep', () => ({ runEscalationSweep: () => escalation() }));
vi.mock('./creditGrantSweep', () => ({ runCreditGrantSweep: () => creditGrant() }));
vi.mock('./applicationRetentionSweep', () => ({ runApplicationRetentionSweep: () => retention() }));
vi.mock('./jobCleanupSweep', () => ({ runJobCleanupSweep: () => jobCleanup() }));
vi.mock('./jobLivenessSweep', () => ({ runJobLivenessSweep: () => jobLiveness() }));

// Static import — see the note in jobLiveness.test.ts. vi.mock is hoisted, so
// the sweeps below are already stubbed when this binds.
import { startScheduler } from './index';

const ALL = [
  ['escalation', escalation],
  ['credit grant', creditGrant],
  ['retention', retention],
  ['job cleanup', jobCleanup],
  ['job liveness', jobLiveness],
] as const;

beforeEach(() => {
  vi.useFakeTimers();
  for (const [, fn] of ALL) fn.mockClear();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('starting the app', () => {
  it.each(ALL)('runs the %s sweep immediately, without waiting for the first tick', (_name, fn) => {
    // A restart must not leave the product idle for 15 minutes. It also means
    // a deploy catches up on anything that came due while it was down.
    startScheduler();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('runs all five — none is quietly missing from the wiring', () => {
    // The assertion that would catch a deleted line in runAllSweeps.
    startScheduler();
    for (const [name, fn] of ALL) {
      expect(fn, `the ${name} sweep is not wired into the scheduler`).toHaveBeenCalledOnce();
    }
  });
});

describe('keeping them running', () => {
  it('runs them again every 15 minutes', () => {
    startScheduler();
    vi.advanceTimersByTime(15 * 60 * 1000);
    for (const [name, fn] of ALL) {
      expect(fn, `the ${name} sweep did not run on the next tick`).toHaveBeenCalledTimes(2);
    }
  });

  it('keeps going over a full day', () => {
    // 96 ticks. The clocks and retention windows are measured in days, so the
    // scheduler has to survive far longer than a single interval.
    startScheduler();
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(escalation.mock.calls.length).toBeGreaterThan(90);
  });

  it('does not fire early', () => {
    startScheduler();
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(escalation).toHaveBeenCalledOnce(); // just the one at startup
  });
});

describe('one broken sweep must not stop the others', () => {
  it('carries on when a sweep rejects', async () => {
    // Every sweep is launched without awaiting, each with its own .catch().
    // Without that, one failure would take down the whole tick — and the
    // escalation clocks are the last thing that should stop because job
    // cleanup had a bad night.
    escalation.mockRejectedValueOnce(new Error('database unreachable'));

    expect(() => startScheduler()).not.toThrow();

    for (const [name, fn] of ALL) {
      expect(fn, `${name} did not run after an earlier sweep failed`).toHaveBeenCalled();
    }
    await vi.runOnlyPendingTimersAsync();
  });

  it('still runs on the next tick after a failure', async () => {
    escalation.mockRejectedValueOnce(new Error('transient'));
    startScheduler();
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(escalation).toHaveBeenCalledTimes(2);
  });
});
