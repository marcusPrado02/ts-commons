export type TutorialDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type TutorialCategory =
  | 'getting-started'
  | 'ddd'
  | 'cqrs'
  | 'event-sourcing'
  | 'testing'
  | 'migration';

export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped';

export type ValidationResult = { valid: true } | { valid: false; hint: string };

export interface TutorialStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly codeExample?: string;
  readonly expectedOutput?: string;
  readonly hints: readonly string[];
  validate(input: string): ValidationResult;
}

export interface Tutorial {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: TutorialDifficulty;
  readonly category: TutorialCategory;
  readonly tags: readonly string[];
  readonly estimatedMinutes: number;
  readonly steps: readonly TutorialStep[];
}

export interface TutorialSession {
  readonly tutorialId: string;
  readonly startedAt: Date;
  completedAt: Date | undefined;
  readonly stepStatuses: Map<string, StepStatus>;
  currentStepIndex: number;
}

export interface TutorialProgress {
  readonly tutorialId: string;
  readonly totalSteps: number;
  readonly completedSteps: number;
  readonly percentComplete: number;
  readonly isFinished: boolean;
}

export interface TutorialSummary {
  readonly id: string;
  readonly title: string;
  readonly difficulty: TutorialDifficulty;
  readonly category: TutorialCategory;
  readonly estimatedMinutes: number;
  readonly stepCount: number;
}
