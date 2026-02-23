/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
import { describe, it, expect, beforeEach } from 'vitest';
import { TutorialRegistry } from './TutorialRegistry';
import { TutorialEngine } from './TutorialEngine';
import { GettingStartedTutorial } from './tutorials/GettingStarted';
import { DddPatternsTutorial } from './tutorials/DddPatterns';
import { CqrsTutorial } from './tutorials/Cqrs';
import { EventSourcingTutorial } from './tutorials/EventSourcing';
import { TestingStrategiesTutorial } from './tutorials/TestingStrategies';
import { MigrationFromMonolithTutorial } from './tutorials/MigrationFromMonolith';
import type { Tutorial } from './TutorialTypes';

// ────────────────────────────────────────────────────────────────────────────
// TutorialRegistry
// ────────────────────────────────────────────────────────────────────────────
describe('TutorialRegistry', () => {
  let registry: TutorialRegistry;

  beforeEach(() => {
    registry = new TutorialRegistry();
  });

  it('returns 6 built-in tutorials', () => {
    expect(registry.count()).toBe(6);
  });

  it('getAll returns readonly array of 6', () => {
    const all = registry.getAll();
    expect(all.length).toBe(6);
  });

  it('get returns getting-started tutorial', () => {
    const t = registry.get('getting-started');
    expect(t?.id).toBe('getting-started');
  });

  it('get returns undefined for unknown id', () => {
    expect(registry.get('no-such')).toBeUndefined();
  });

  it('getByCategory filters correctly', () => {
    const ddd = registry.getByCategory('ddd');
    expect(ddd.length).toBe(1);
    expect(ddd[0]?.id).toBe('ddd-patterns');
  });

  it('getByCategory returns empty for missing category', () => {
    expect(registry.getByCategory('migration').length).toBeGreaterThanOrEqual(1);
  });

  it('getByDifficulty returns beginner tutorials', () => {
    const beginners = registry.getByDifficulty('beginner');
    expect(beginners.length).toBeGreaterThanOrEqual(1);
    for (const t of beginners) expect(t.difficulty).toBe('beginner');
  });

  it('getByDifficulty returns advanced tutorials', () => {
    const adv = registry.getByDifficulty('advanced');
    expect(adv.length).toBeGreaterThanOrEqual(2);
  });

  it('getByTag filters by tag', () => {
    const tagged = registry.getByTag('ddd');
    expect(tagged.length).toBeGreaterThanOrEqual(1);
  });

  it('getByTag returns empty for unknown tag', () => {
    expect(registry.getByTag('no-tag').length).toBe(0);
  });

  it('register adds a custom tutorial', () => {
    const custom: Tutorial = {
      id: 'custom',
      title: 'Custom',
      description: 'Custom tutorial',
      difficulty: 'beginner',
      category: 'getting-started',
      tags: [],
      estimatedMinutes: 5,
      steps: [],
    };
    registry.register(custom);
    expect(registry.count()).toBe(7);
    expect(registry.get('custom')?.id).toBe('custom');
  });

  it('register replaces tutorial with same id', () => {
    const v1: Tutorial = {
      id: 'dup',
      title: 'v1',
      description: '',
      difficulty: 'beginner',
      category: 'testing',
      tags: [],
      estimatedMinutes: 10,
      steps: [],
    };
    const v2: Tutorial = { ...v1, title: 'v2' };
    registry.register(v1);
    registry.register(v2);
    expect(registry.get('dup')?.title).toBe('v2');
    expect(registry.count()).toBe(7);
  });

  it('remove deletes a registered tutorial', () => {
    const t: Tutorial = {
      id: 'rm',
      title: 'Removable',
      description: '',
      difficulty: 'intermediate',
      category: 'cqrs',
      tags: [],
      estimatedMinutes: 15,
      steps: [],
    };
    registry.register(t);
    expect(registry.remove('rm')).toBe(true);
    expect(registry.get('rm')).toBeUndefined();
  });

  it('remove returns false for built-in tutorial id', () => {
    expect(registry.remove('getting-started')).toBe(false);
  });

  it('remove returns false for unknown id', () => {
    expect(registry.remove('ghost')).toBe(false);
  });

  it('summaries returns correct shape', () => {
    const sums = registry.summaries();
    expect(sums.length).toBe(6);
    for (const s of sums) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.stepCount).toBe('number');
      expect(typeof s.estimatedMinutes).toBe('number');
    }
  });

  it('totalEstimatedMinutes sums all tutorials', () => {
    const total = registry.totalEstimatedMinutes();
    expect(total).toBeGreaterThan(200);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TutorialEngine
// ────────────────────────────────────────────────────────────────────────────
describe('TutorialEngine', () => {
  let engine: TutorialEngine;

  beforeEach(() => {
    engine = new TutorialEngine();
  });

  it('start creates a session', () => {
    const session = engine.start(GettingStartedTutorial);
    expect(session.tutorialId).toBe('getting-started');
    expect(session.currentStepIndex).toBe(0);
    expect(session.completedAt).toBeUndefined();
  });

  it('first step is active after start', () => {
    const session = engine.start(GettingStartedTutorial);
    const firstStep = GettingStartedTutorial.steps[0];
    expect(firstStep).toBeDefined();
    expect(session.stepStatuses.get(firstStep!.id)).toBe('active');
  });

  it('getSession returns started session', () => {
    engine.start(GettingStartedTutorial);
    expect(engine.getSession('getting-started')).toBeDefined();
  });

  it('getSession returns undefined for unknown tutorial', () => {
    expect(engine.getSession('ghost')).toBeUndefined();
  });

  it('currentStep returns first step', () => {
    const session = engine.start(GettingStartedTutorial);
    const s = engine.currentStep(GettingStartedTutorial, session);
    expect(s?.id).toBe('gs-1');
  });

  it('validateStep passes correct input', () => {
    const session = engine.start(GettingStartedTutorial);
    const result = engine.validateStep(GettingStartedTutorial, session, 'pnpm add @acme/kernel');
    expect(result.valid).toBe(true);
  });

  it('validateStep fails wrong input', () => {
    const session = engine.start(GettingStartedTutorial);
    const result = engine.validateStep(GettingStartedTutorial, session, 'pnpm add lodash');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.hint.length).toBeGreaterThan(0);
  });

  it('advance moves to next step', () => {
    const session = engine.start(GettingStartedTutorial);
    const moved = engine.advance(GettingStartedTutorial, session);
    expect(moved).toBe(true);
    expect(session.currentStepIndex).toBe(1);
  });

  it('advance marks step as completed', () => {
    const session = engine.start(GettingStartedTutorial);
    const first = GettingStartedTutorial.steps[0]!;
    engine.advance(GettingStartedTutorial, session);
    expect(session.stepStatuses.get(first.id)).toBe('completed');
  });

  it('advance on last step sets completedAt', () => {
    const singleStep: Tutorial = {
      id: 'single',
      title: 'Single',
      description: '',
      difficulty: 'beginner',
      category: 'getting-started',
      tags: [],
      estimatedMinutes: 5,
      steps: [
        {
          id: 's1',
          title: 'Only step',
          description: '',
          hints: [],
          validate: () => ({ valid: true }),
        },
      ],
    };
    const session = engine.start(singleStep);
    const finished = engine.advance(singleStep, session);
    expect(finished).toBe(false);
    expect(session.completedAt).toBeInstanceOf(Date);
  });

  it('skipStep marks step as skipped', () => {
    const session = engine.start(GettingStartedTutorial);
    const first = GettingStartedTutorial.steps[0]!;
    engine.skipStep(GettingStartedTutorial, session);
    expect(session.stepStatuses.get(first.id)).toBe('skipped');
  });

  it('progress returns 0% at start', () => {
    const session = engine.start(GettingStartedTutorial);
    const p = engine.progress(GettingStartedTutorial, session);
    expect(p.percentComplete).toBe(0);
    expect(p.isFinished).toBe(false);
  });

  it('progress counts skipped steps', () => {
    const session = engine.start(GettingStartedTutorial);
    engine.skipStep(GettingStartedTutorial, session);
    const p = engine.progress(GettingStartedTutorial, session);
    expect(p.completedSteps).toBe(1);
  });

  it('progress returns 100% when all steps done', () => {
    const session = engine.start(GettingStartedTutorial);
    const stepCount = GettingStartedTutorial.steps.length;
    for (let i = 0; i < stepCount; i++) {
      engine.advance(GettingStartedTutorial, session);
    }
    const p = engine.progress(GettingStartedTutorial, session);
    expect(p.percentComplete).toBe(100);
    expect(p.isFinished).toBe(true);
  });

  it('reset resets the session back to start', () => {
    const session = engine.start(GettingStartedTutorial);
    engine.advance(GettingStartedTutorial, session);
    engine.advance(GettingStartedTutorial, session);
    engine.reset(GettingStartedTutorial);
    expect(session.currentStepIndex).toBe(0);
    expect(session.completedAt).toBeUndefined();
    const first = GettingStartedTutorial.steps[0]!;
    expect(session.stepStatuses.get(first.id)).toBe('active');
  });

  it('validateStep returns error when no active step', () => {
    const empty: Tutorial = {
      id: 'empty',
      title: 'Empty',
      description: '',
      difficulty: 'beginner',
      category: 'getting-started',
      tags: [],
      estimatedMinutes: 0,
      steps: [],
    };
    const session = engine.start(empty);
    const result = engine.validateStep(empty, session, 'anything');
    expect(result.valid).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Tutorial content
// ────────────────────────────────────────────────────────────────────────────
describe('GettingStartedTutorial', () => {
  it('has 4 steps', () => {
    expect(GettingStartedTutorial.steps.length).toBe(4);
  });

  it('is beginner difficulty', () => {
    expect(GettingStartedTutorial.difficulty).toBe('beginner');
  });

  it('step gs-2 validates Entity reference', () => {
    const step = GettingStartedTutorial.steps.find((s) => s.id === 'gs-2')!;
    expect(step.validate('class User extends Entity<string> {}').valid).toBe(true);
    expect(step.validate('class User {}').valid).toBe(false);
  });
});

describe('DddPatternsTutorial', () => {
  it('has 5 steps', () => {
    expect(DddPatternsTutorial.steps.length).toBe(5);
  });

  it('is intermediate difficulty', () => {
    expect(DddPatternsTutorial.difficulty).toBe('intermediate');
  });

  it('step ddd-3 validates aggregate reference', () => {
    const step = DddPatternsTutorial.steps.find((s) => s.id === 'ddd-3')!;
    expect(step.validate('class Order extends AggregateRoot {}').valid).toBe(true);
    expect(step.validate('class Order {}').valid).toBe(false);
  });
});

describe('CqrsTutorial', () => {
  it('has 4 steps', () => {
    expect(CqrsTutorial.steps.length).toBe(4);
  });

  it('is intermediate difficulty', () => {
    expect(CqrsTutorial.difficulty).toBe('intermediate');
  });

  it('step cqrs-4 validates dispatch', () => {
    const step = CqrsTutorial.steps.find((s) => s.id === 'cqrs-4')!;
    expect(step.validate('await commandBus.dispatch(cmd)').valid).toBe(true);
    expect(step.validate('commandBus.send(cmd)').valid).toBe(false);
  });
});

describe('EventSourcingTutorial', () => {
  it('has 5 steps', () => {
    expect(EventSourcingTutorial.steps.length).toBe(5);
  });

  it('is advanced difficulty', () => {
    expect(EventSourcingTutorial.difficulty).toBe('advanced');
  });

  it('step es-3 validates replay', () => {
    const step = EventSourcingTutorial.steps.find((s) => s.id === 'es-3')!;
    expect(step.validate('Order.rebuild(events)').valid).toBe(true);
    expect(step.validate('Order.load()').valid).toBe(false);
  });
});

describe('TestingStrategiesTutorial', () => {
  it('has 5 steps', () => {
    expect(TestingStrategiesTutorial.steps.length).toBe(5);
  });

  it('step test-2 validates in-memory repo', () => {
    const step = TestingStrategiesTutorial.steps.find((s) => s.id === 'test-2')!;
    expect(step.validate('class InMemoryOrderRepo implements OrderRepository').valid).toBe(true);
    expect(step.validate('class DbRepo').valid).toBe(false);
  });
});

describe('MigrationFromMonolithTutorial', () => {
  it('has 6 steps', () => {
    expect(MigrationFromMonolithTutorial.steps.length).toBe(6);
  });

  it('is advanced difficulty', () => {
    expect(MigrationFromMonolithTutorial.difficulty).toBe('advanced');
  });

  it('step mig-3 validates strangler pattern', () => {
    const step = MigrationFromMonolithTutorial.steps.find((s) => s.id === 'mig-3')!;
    expect(step.validate('use strangler fig pattern').valid).toBe(true);
    expect(step.validate('rewrite everything').valid).toBe(false);
  });

  it('step mig-6 validates event publishing', () => {
    const step = MigrationFromMonolithTutorial.steps.find((s) => s.id === 'mig-6')!;
    expect(step.validate('await eventBus.publish(event)').valid).toBe(true);
    expect(step.validate('call other service').valid).toBe(false);
  });
});
