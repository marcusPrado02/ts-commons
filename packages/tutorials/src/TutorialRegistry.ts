import type {
  Tutorial,
  TutorialCategory,
  TutorialDifficulty,
  TutorialSummary,
} from './TutorialTypes';
import { GettingStartedTutorial } from './tutorials/GettingStarted';
import { DddPatternsTutorial } from './tutorials/DddPatterns';
import { CqrsTutorial } from './tutorials/Cqrs';
import { EventSourcingTutorial } from './tutorials/EventSourcing';
import { TestingStrategiesTutorial } from './tutorials/TestingStrategies';
import { MigrationFromMonolithTutorial } from './tutorials/MigrationFromMonolith';

const ALL_TUTORIALS: readonly Tutorial[] = [
  GettingStartedTutorial,
  DddPatternsTutorial,
  CqrsTutorial,
  EventSourcingTutorial,
  TestingStrategiesTutorial,
  MigrationFromMonolithTutorial,
];

export class TutorialRegistry {
  private readonly extra: Tutorial[] = [];

  getAll(): readonly Tutorial[] {
    return [...ALL_TUTORIALS, ...this.extra];
  }

  get(id: string): Tutorial | undefined {
    return this.getAll().find((t) => t.id === id);
  }

  getByCategory(category: TutorialCategory): readonly Tutorial[] {
    return this.getAll().filter((t) => t.category === category);
  }

  getByDifficulty(difficulty: TutorialDifficulty): readonly Tutorial[] {
    return this.getAll().filter((t) => t.difficulty === difficulty);
  }

  getByTag(tag: string): readonly Tutorial[] {
    return this.getAll().filter((t) => t.tags.includes(tag));
  }

  count(): number {
    return this.getAll().length;
  }

  register(tutorial: Tutorial): void {
    const existing = this.extra.findIndex((t) => t.id === tutorial.id);
    if (existing >= 0) {
      this.extra.splice(existing, 1);
    }
    this.extra.push(tutorial);
  }

  remove(id: string): boolean {
    const idx = this.extra.findIndex((t) => t.id === id);
    if (idx < 0) return false;
    this.extra.splice(idx, 1);
    return true;
  }

  summaries(): readonly TutorialSummary[] {
    return this.getAll().map((t) => ({
      id: t.id,
      title: t.title,
      difficulty: t.difficulty,
      category: t.category,
      estimatedMinutes: t.estimatedMinutes,
      stepCount: t.steps.length,
    }));
  }

  totalEstimatedMinutes(): number {
    return this.getAll().reduce((sum, t) => sum + t.estimatedMinutes, 0);
  }
}
