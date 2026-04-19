import type { ProjectInitOptions } from '../cli/CliTypes';

/** A single file to be written during project initialisation. */
export interface ProjectFile {
  readonly path: string;
  readonly content: string;
}

/** The outcome of a project initialisation. */
export interface ProjectInitResult {
  readonly name: string;
  readonly files: ProjectFile[];
  readonly installCommand: string;
}

function buildPackageJson(opts: ProjectInitOptions): string {
  return JSON.stringify(
    {
      name: opts.name,
      version: '0.1.0',
      description: opts.description ?? '',
      type: 'module',
      author: opts.author ?? '',
      license: opts.license ?? 'MIT',
      scripts: {
        build: 'tsc -b',
        test: 'vitest run',
        lint: 'eslint src --ext .ts',
      },
      devDependencies: {
        typescript: '^5.3.0',
        vitest: '^2.1.9',
      },
    },
    null,
    2,
  );
}

function buildTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        outDir: './dist',
      },
      include: ['src/**/*'],
    },
    null,
    2,
  );
}

function buildReadme(opts: ProjectInitOptions): string {
  return [
    `# ${opts.name}`,
    ``,
    opts.description ?? '',
    ``,
    `## Getting started`,
    ``,
    `\`\`\`bash`,
    `npm install`,
    `npm run build`,
    `\`\`\``,
  ].join('\n');
}

/**
 * Generates the scaffolded file set required to initialise a new TypeScript
 * project without touching the actual file system.
 *
 * @example
 * ```typescript
 * const init = new ProjectInitializer();
 * const result = init.initialize({ name: 'my-package', license: 'MIT' });
 * result.files.forEach(f => fs.writeFileSync(f.path, f.content));
 * ```
 */
export class ProjectInitializer {
  initialize(opts: ProjectInitOptions): ProjectInitResult {
    const pm = opts.packageManager ?? 'npm';
    const installCommand =
      pm === 'pnpm' ? 'pnpm install' : pm === 'yarn' ? 'yarn install' : 'npm install';

    const files: ProjectFile[] = [
      { path: 'package.json', content: buildPackageJson(opts) },
      { path: 'tsconfig.json', content: buildTsConfig() },
      { path: 'README.md', content: buildReadme(opts) },
      { path: 'src/index.ts', content: '// Entry point\n' },
    ];

    return { name: opts.name, files, installCommand };
  }

  /** Return just the list of paths that would be generated. */
  previewPaths(opts: ProjectInitOptions): string[] {
    return this.initialize(opts).files.map((f) => f.path);
  }

  /** Number of files generated for any initialisation request. */
  fileCount(): number {
    return 4; // package.json, tsconfig.json, README.md, src/index.ts
  }
}
