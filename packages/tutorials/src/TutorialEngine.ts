import type {
  Tutorial,
  TutorialSession,
  TutorialProgress,
  TutorialStep,
  ValidationResult,
  StepStatus,
} from './TutorialTypes';

export class TutorialEngine {
  private readonly sessions = new Map<string, TutorialSession>();

  start(tutorial: Tutorial): TutorialSession {
    const session: TutorialSession = {
      tutorialId: tutorial.id,
      startedAt: new Date(),
      completedAt: undefined,
      stepStatuses: new Map<string, StepStatus>(
        tutorial.steps.map((s) => [s.id, 'pending'] as const),
      ),
      currentStepIndex: 0,
    };
    if (tutorial.steps.length > 0) {
      const first = tutorial.steps[0];
      if (first !== undefined) {
        session.stepStatuses.set(first.id, 'active');
      }
    }
    this.sessions.set(tutorial.id, session);
    return session;
  }

  getSession(tutorialId: string): TutorialSession | undefined {
    return this.sessions.get(tutorialId);
  }

  currentStep(tutorial: Tutorial, session: TutorialSession): TutorialStep | undefined {
    return tutorial.steps[session.currentStepIndex];
  }

  validateStep(tutorial: Tutorial, session: TutorialSession, input: string): ValidationResult {
    const step = this.currentStep(tutorial, session);
    if (step === undefined) {
      return { valid: false, hint: 'No active step found.' };
    }
    return step.validate(input);
  }

  advance(tutorial: Tutorial, session: TutorialSession): boolean {
    const step = this.currentStep(tutorial, session);
    if (step === undefined) return false;

    session.stepStatuses.set(step.id, 'completed');
    session.currentStepIndex += 1;

    const next = tutorial.steps[session.currentStepIndex];
    if (next !== undefined) {
      session.stepStatuses.set(next.id, 'active');
      return true;
    }
    session.completedAt = new Date();
    return false;
  }

  skipStep(tutorial: Tutorial, session: TutorialSession): boolean {
    const step = this.currentStep(tutorial, session);
    if (step === undefined) return false;

    session.stepStatuses.set(step.id, 'skipped');
    session.currentStepIndex += 1;

    const next = tutorial.steps[session.currentStepIndex];
    if (next !== undefined) {
      session.stepStatuses.set(next.id, 'active');
      return true;
    }
    session.completedAt = new Date();
    return false;
  }

  progress(tutorial: Tutorial, session: TutorialSession): TutorialProgress {
    const totalSteps = tutorial.steps.length;
    let completedSteps = 0;
    for (const [, status] of session.stepStatuses) {
      if (status === 'completed' || status === 'skipped') {
        completedSteps += 1;
      }
    }
    const percentComplete =
      totalSteps === 0 ? 100 : Math.round((completedSteps / totalSteps) * 100);
    return {
      tutorialId: tutorial.id,
      totalSteps,
      completedSteps,
      percentComplete,
      isFinished: session.completedAt !== undefined,
    };
  }

  reset(tutorial: Tutorial): void {
    const existing = this.sessions.get(tutorial.id);
    if (existing === undefined) return;
    existing.stepStatuses.clear();
    for (const step of tutorial.steps) {
      existing.stepStatuses.set(step.id, 'pending');
    }
    existing.currentStepIndex = 0;
    existing.completedAt = undefined;
    const first = tutorial.steps[0];
    if (first !== undefined) {
      existing.stepStatuses.set(first.id, 'active');
    }
  }
}
