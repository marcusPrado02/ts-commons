// Snippet types and library
export type {
  RenderOptions,
  RenderedSnippet,
  Snippet,
  SnippetFile,
  SnippetFileEntry,
  SnippetKind,
} from './snippets/SnippetTypes';
export { SnippetLibrary } from './snippets/SnippetLibrary';

// DDD pattern detection
export type { DddPattern, PatternMatch, PatternReport } from './detection/PatternTypes';
export { PatternDetector } from './detection/PatternDetector';

// Architecture validation
export type {
  ArchLayer,
  ArchViolation,
  ProjectValidationResult,
  ValidationResult,
  ViolationSeverity,
} from './validation/ArchTypes';
export { ArchitectureValidator } from './validation/ArchitectureValidator';

// Refactoring
export type {
  RefactoringKind,
  RefactoringReport,
  RefactoringSuggestion,
} from './refactoring/RefactoringTypes';
export { RefactoringTool } from './refactoring/RefactoringTool';

// Quick fixes
export type { QuickFix, QuickFixCategory } from './quickfix/QuickFixTypes';
export { QuickFixProvider } from './quickfix/QuickFixProvider';
