/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
import { describe, it, expect, beforeEach } from 'vitest';

import { StoryRegistry } from './story/StoryRegistry';
import { StoryRunner } from './story/StoryRunner';
import { ComponentCatalog } from './catalog/ComponentCatalog';
import { EmailModule, MoneyModule } from './stories/ValueObjectStories';
import { ResultModule, OptionModule, EitherModule } from './stories/ResultStories';
import {
  DomainErrorModule,
  ValidationErrorModule,
  NotFoundErrorModule,
} from './stories/ErrorStories';
import type { StoryModule, StoryArgs } from './story/StoryTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSimpleModule(component: string, passCount = 1): StoryModule<unknown, StoryArgs> {
  return {
    meta: {
      title: `${component} title`,
      description: `${component} desc`,
      component,
      tags: ['test'],
      create: () => ({ component }),
    },
    stories: Array.from({ length: passCount }, (_, i) => ({
      name: `story-${String(i)}`,
      description: 'a story',
      args: {},
      execute: (s) => s,
      expectedOutcome: 'defined',
    })),
  };
}

function makeFailingModule(component: string): StoryModule<unknown, StoryArgs> {
  return {
    meta: {
      title: `${component} title`,
      description: `${component} desc`,
      component,
      tags: ['failing'],
      create: () => ({}),
    },
    stories: [
      {
        name: 'throws',
        description: 'always throws',
        args: {},
        execute: () => {
          throw new Error('boom');
        },
        expectedOutcome: 'error',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// StoryRegistry
// ---------------------------------------------------------------------------

describe('StoryRegistry', () => {
  let registry: StoryRegistry;

  beforeEach(() => {
    registry = new StoryRegistry();
  });

  it('starts empty', () => {
    expect(registry.count()).toBe(0);
  });

  it('registers a module and reports has()', () => {
    registry.register(makeSimpleModule('A'));
    expect(registry.has('A')).toBe(true);
  });

  it('has() returns false for unknown component', () => {
    expect(registry.has('unknown')).toBe(false);
  });

  it('get() returns the registered module', () => {
    const m = makeSimpleModule('B');
    registry.register(m);
    expect(registry.get('B')).toBe(m);
  });

  it('get() returns undefined for missing component', () => {
    expect(registry.get('missing')).toBeUndefined();
  });

  it('getAll() returns all modules', () => {
    registry.register(makeSimpleModule('X'));
    registry.register(makeSimpleModule('Y'));
    expect(registry.getAll()).toHaveLength(2);
  });

  it('getByTag() filters by tag', () => {
    registry.register(makeSimpleModule('T1'));
    registry.register(makeSimpleModule('T2'));
    expect(registry.getByTag('test')).toHaveLength(2);
    expect(registry.getByTag('nonexistent')).toHaveLength(0);
  });

  it('search() finds by title substring', () => {
    registry.register(makeSimpleModule('SearchMe'));
    const results = registry.search('SearchMe title');
    expect(results).toHaveLength(1);
  });

  it('search() is case-insensitive', () => {
    registry.register(makeSimpleModule('CaseTest'));
    expect(registry.search('casetest')).toHaveLength(1);
  });

  it('componentNames() lists all keys', () => {
    registry.register(makeSimpleModule('C1'));
    registry.register(makeSimpleModule('C2'));
    expect(registry.componentNames()).toContain('C1');
    expect(registry.componentNames()).toContain('C2');
  });

  it('totalStories() sums across modules', () => {
    registry.register(makeSimpleModule('S', 3));
    registry.register(makeSimpleModule('T', 2));
    expect(registry.totalStories()).toBe(5);
  });

  it('remove() deletes a module and returns true', () => {
    registry.register(makeSimpleModule('Del'));
    expect(registry.remove('Del')).toBe(true);
    expect(registry.has('Del')).toBe(false);
  });

  it('remove() returns false for missing key', () => {
    expect(registry.remove('ghost')).toBe(false);
  });

  it('clear() empties the registry', () => {
    registry.register(makeSimpleModule('E'));
    registry.clear();
    expect(registry.count()).toBe(0);
  });

  it('toCatalogEntry() returns correct entry', () => {
    registry.register(makeSimpleModule('Cat', 4));
    const entry = registry.toCatalogEntry('Cat');
    expect(entry?.storyCount).toBe(4);
    expect(entry?.component).toBe('Cat');
  });

  it('toCatalogEntry() returns undefined for missing component', () => {
    expect(registry.toCatalogEntry('nope')).toBeUndefined();
  });

  it('summary() reflects modules and tags', () => {
    registry.register(makeSimpleModule('Sum1'));
    const s = registry.summary();
    expect(s.modules).toBe(1);
    expect(s.tags).toContain('test');
  });
});

// ---------------------------------------------------------------------------
// StoryRunner
// ---------------------------------------------------------------------------

describe('StoryRunner', () => {
  let runner: StoryRunner;

  beforeEach(() => {
    runner = new StoryRunner();
  });

  it('run() returns a ModuleResult with the module title', () => {
    const m = makeSimpleModule('RunMe', 2);
    const result = runner.run(m);
    expect(result.title).toBe('RunMe title');
  });

  it('run() marks passing stories as pass', () => {
    const result = runner.run(makeSimpleModule('P', 3));
    expect(result.passed).toBe(3);
    expect(result.failed).toBe(0);
  });

  it('run() marks thrown stories as fail', () => {
    const result = runner.run(makeFailingModule('F'));
    expect(result.failed).toBe(1);
    expect(result.passed).toBe(0);
  });

  it('run() captures error message for failing story', () => {
    const result = runner.run(makeFailingModule('Err'));
    expect(result.results[0]?.error).toBe('boom');
  });

  it('run() records durationMs >= 0', () => {
    const result = runner.run(makeSimpleModule('Dur'));
    expect(result.results[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('runAll() processes multiple modules', () => {
    const results = runner.runAll([makeSimpleModule('M1', 1), makeSimpleModule('M2', 2)]);
    expect(results).toHaveLength(2);
    expect(results[0]?.total).toBe(1);
    expect(results[1]?.total).toBe(2);
  });

  it('runFiltered() skips non-matching stories', () => {
    const m = makeSimpleModule('Filter', 3);
    const result = runner.runFiltered(m, (name) => name === 'story-0');
    expect(result.passed).toBe(1);
    expect(result.skipped).toBe(2);
  });

  it('summarize() aggregates totals', () => {
    const results = runner.runAll([makeSimpleModule('A', 2), makeSimpleModule('B', 3)]);
    const s = runner.summarize(results);
    expect(s.total).toBe(5);
    expect(s.passed).toBe(5);
    expect(s.failed).toBe(0);
  });

  it('allPassed() is true when no failures', () => {
    const results = runner.runAll([makeSimpleModule('Ok', 2)]);
    expect(runner.allPassed(results)).toBe(true);
  });

  it('allPassed() is false when any story fails', () => {
    const results = runner.runAll([makeFailingModule('Fail')]);
    expect(runner.allPassed(results)).toBe(false);
  });

  it('run() sets total equal to story count', () => {
    const result = runner.run(makeSimpleModule('Tot', 4));
    expect(result.total).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// ValueObject Stories
// ---------------------------------------------------------------------------

describe('EmailModule', () => {
  let runner: StoryRunner;

  beforeEach(() => {
    runner = new StoryRunner();
  });

  it('has 6 stories', () => {
    expect(EmailModule.stories).toHaveLength(6);
  });

  it('tagged with value-object', () => {
    expect(EmailModule.meta.tags).toContain('value-object');
  });

  it('all stories pass', () => {
    const result = runner.run(EmailModule);
    expect(result.failed).toBe(0);
  });

  it('valid email story returns true', () => {
    const result = runner.run(EmailModule);
    expect(result.results[0]?.output).toBe(true);
  });

  it('invalid email story returns false', () => {
    const result = runner.run(EmailModule);
    expect(result.results[1]?.output).toBe(false);
  });

  it('getDomain story returns example.com', () => {
    const result = runner.run(EmailModule);
    expect(result.results[2]?.output).toBe('example.com');
  });
});

describe('MoneyModule', () => {
  let runner: StoryRunner;

  beforeEach(() => {
    runner = new StoryRunner();
  });

  it('has 5 stories', () => {
    expect(MoneyModule.stories).toHaveLength(5);
  });

  it('all stories pass', () => {
    const result = runner.run(MoneyModule);
    expect(result.failed).toBe(0);
  });

  it('format story returns USD 100.00', () => {
    const result = runner.run(MoneyModule);
    expect(result.results[0]?.output).toBe('USD 100.00');
  });

  it('add story returns 150', () => {
    const result = runner.run(MoneyModule);
    expect(result.results[1]?.output).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// Result / Option / Either Stories
// ---------------------------------------------------------------------------

describe('ResultModule', () => {
  let runner: StoryRunner;

  beforeEach(() => {
    runner = new StoryRunner();
  });

  it('has 8 stories', () => {
    expect(ResultModule.stories).toHaveLength(8);
  });

  it('all stories pass', () => {
    const result = runner.run(ResultModule);
    expect(result.failed).toBe(0);
  });

  it('ok result story returns true for ok flag', () => {
    const result = runner.run(ResultModule);
    expect(result.results[0]?.output).toBe(true);
  });
});

describe('OptionModule', () => {
  let runner: StoryRunner;

  beforeEach(() => {
    runner = new StoryRunner();
  });

  it('has 6 stories', () => {
    expect(OptionModule.stories).toHaveLength(6);
  });

  it('all stories pass', () => {
    const result = runner.run(OptionModule);
    expect(result.failed).toBe(0);
  });

  it('some story returns some=true', () => {
    const result = runner.run(OptionModule);
    expect(result.results[0]?.output).toBe(true);
  });
});

describe('EitherModule', () => {
  let runner: StoryRunner;

  beforeEach(() => {
    runner = new StoryRunner();
  });

  it('has 5 stories', () => {
    expect(EitherModule.stories).toHaveLength(5);
  });

  it('all stories pass', () => {
    const result = runner.run(EitherModule);
    expect(result.failed).toBe(0);
  });

  it('right result story returns tag=right', () => {
    const result = runner.run(EitherModule);
    expect(result.results[0]?.output).toBe('right');
  });
});

// ---------------------------------------------------------------------------
// Error Stories
// ---------------------------------------------------------------------------

describe('DomainErrorModule', () => {
  let runner: StoryRunner;

  beforeEach(() => {
    runner = new StoryRunner();
  });

  it('has 6 stories', () => {
    expect(DomainErrorModule.stories).toHaveLength(6);
  });

  it('all stories pass', () => {
    const result = runner.run(DomainErrorModule);
    expect(result.failed).toBe(0);
  });

  it('name story returns DomainError', () => {
    const result = runner.run(DomainErrorModule);
    expect(result.results[0]?.output).toBe('DomainError');
  });
});

describe('ValidationErrorModule', () => {
  let runner: StoryRunner;

  beforeEach(() => {
    runner = new StoryRunner();
  });

  it('has 6 stories', () => {
    expect(ValidationErrorModule.stories).toHaveLength(6);
  });

  it('all stories pass', () => {
    const result = runner.run(ValidationErrorModule);
    expect(result.failed).toBe(0);
  });

  it('violationCount story returns 2', () => {
    const result = runner.run(ValidationErrorModule);
    expect(result.results[5]?.output).toBe(2);
  });
});

describe('NotFoundErrorModule', () => {
  let runner: StoryRunner;

  beforeEach(() => {
    runner = new StoryRunner();
  });

  it('has 6 stories', () => {
    expect(NotFoundErrorModule.stories).toHaveLength(6);
  });

  it('all stories pass', () => {
    const result = runner.run(NotFoundErrorModule);
    expect(result.failed).toBe(0);
  });

  it('resource story returns User', () => {
    const result = runner.run(NotFoundErrorModule);
    expect(result.results[2]?.output).toBe('User');
  });
});

// ---------------------------------------------------------------------------
// ComponentCatalog
// ---------------------------------------------------------------------------

describe('ComponentCatalog', () => {
  let catalog: ComponentCatalog;

  beforeEach(() => {
    catalog = new ComponentCatalog();
  });

  it('starts empty', () => {
    expect(catalog.size()).toBe(0);
  });

  it('add() registers a module', () => {
    catalog.add(EmailModule);
    expect(catalog.has('EmailValueObject')).toBe(true);
  });

  it('add() supports multiple modules at once', () => {
    catalog.add(EmailModule, MoneyModule);
    expect(catalog.size()).toBe(2);
  });

  it('browse() returns catalog entries', () => {
    catalog.add(EmailModule, MoneyModule);
    expect(catalog.browse()).toHaveLength(2);
  });

  it('browseByTag() filters entries', () => {
    catalog.add(EmailModule, MoneyModule, ResultModule);
    const vo = catalog.browseByTag('value-object');
    expect(vo.length).toBeGreaterThanOrEqual(2);
  });

  it('storyCount() sums stories across all modules', () => {
    catalog.add(EmailModule, MoneyModule);
    expect(catalog.storyCount()).toBe(EmailModule.stories.length + MoneyModule.stories.length);
  });

  it('run() executes a specific component', () => {
    catalog.add(EmailModule);
    const result = catalog.run('EmailValueObject');
    expect(result?.failed).toBe(0);
  });

  it('run() returns undefined for unknown component', () => {
    expect(catalog.run('ghost')).toBeUndefined();
  });

  it('runAll() runs all modules', () => {
    catalog.add(EmailModule, MoneyModule);
    const results = catalog.runAll();
    expect(results).toHaveLength(2);
  });

  it('runAndSummarize() reports totals', () => {
    catalog.add(EmailModule);
    const summary = catalog.runAndSummarize();
    expect(summary.total).toBe(EmailModule.stories.length);
    expect(summary.failed).toBe(0);
  });

  it('search() finds entries by query', () => {
    catalog.add(EmailModule, ResultModule);
    const found = catalog.search('Email');
    expect(found).toHaveLength(1);
    expect(found[0]?.component).toBe('EmailValueObject');
  });

  it('remove() deletes a component', () => {
    catalog.add(EmailModule);
    catalog.remove('EmailValueObject');
    expect(catalog.has('EmailValueObject')).toBe(false);
  });

  it('clear() empties the catalog', () => {
    catalog.add(EmailModule, MoneyModule);
    catalog.clear();
    expect(catalog.size()).toBe(0);
  });

  it('summary() includes all tags', () => {
    catalog.add(EmailModule, ResultModule);
    const s = catalog.summary();
    expect(s.tags).toContain('value-object');
    expect(s.tags).toContain('result');
  });
});
