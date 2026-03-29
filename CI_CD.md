# CI/CD Pipeline Documentation

## 🚀 Overview

Complete CI/CD pipeline with multiple workflows for quality, security, and automation.

## 📋 Workflows

### 1. 🔄 CI Workflow (`.github/workflows/ci.yml`)

**Triggers**: Push and PR to `main` and `develop` branches

**Matrix Testing**:

- **Node.js versions**: 20.x, 22.x
- **Operating Systems**: Ubuntu, Windows, macOS
- **Total combinations**: 6 test environments

**Steps**:

1. ✅ Checkout code
2. ⚙️ Setup pnpm and Node.js with caching
3. 📦 Install dependencies (`--frozen-lockfile`)
4. 🏗️ Build all packages (`pnpm build`)
5. 🔍 Type checking (`pnpm typecheck`)
6. 🧪 Run tests with coverage (`pnpm test:coverage`)
7. 📊 Upload coverage reports (Ubuntu + Node 20.x only)

### 2. 🔍 Lint Workflow (`.github/workflows/lint.yml`)

**Features**:

- **ESLint analysis** with strict rules
- **Prettier formatting** check
- **Dependency analysis** (unused deps)
- **Circular dependency** detection
- **Auto-fix for PRs** (commits fixes automatically)

### 3. 🔒 Security Workflow (`.github/workflows/security.yml`)

**Triggers**:

- Push/PR events
- Weekly schedule (Sundays 2 AM UTC)

**Security Checks**:

- 🛡️ **npm audit** (moderate+ severity)
- 🕵️ **Snyk security scan** (uploaded to GitHub Security)
- 🔍 **CodeQL analysis** (GitHub native security scanning)

### 4. 🚀 Release Workflow (`.github/workflows/release.yml`)

**Production Release** (`main` branch):

1. ✅ Build and quality checks
2. 📝 Generate changelog (conventional commits)
3. 🏷️ Bump version and create Git tag
4. 📋 Create GitHub Release with notes
5. 📦 Publish to NPM (`@marcusprado02` scope)

**Development Release** (`develop` branch):

- 🧪 Publishes dev versions with timestamp/commit SHA
- 🏷️ NPM tag: `dev` (e.g., `npm install @marcusprado02/kernel@dev`)

## 🤖 Automation Features

### Dependabot (`.github/dependabot.yml`)

**NPM Dependencies**:

- 📅 **Schedule**: Weekly (Mondays 9 AM)
- 📦 **Grouping**: TypeScript-ESLint, Vitest, Build tools
- 🎯 **Auto-merge**: Minor and patch updates
- 🚫 **Ignored**: Major TypeScript/Node.js updates

**GitHub Actions**:

- 📅 **Schedule**: Weekly (Mondays 10 AM)
- 🔄 Updates action versions automatically

### Issue Templates

**Bug Report** (`.github/ISSUE_TEMPLATE/bug_report.yml`):

- 🐛 Structured bug reporting
- 🌍 Environment details capture
- 🔥 Priority classification
- ✅ Validation checklist

**Feature Request** (`.github/ISSUE_TEMPLATE/feature_request.yml`):

- ✨ Structured feature suggestions
- 📦 Component targeting
- 🎯 Use case documentation
- 🔧 Optional API design input

### Pull Request Template

**Comprehensive PR template** (`.github/pull_request_template.md`):

- 📝 Description and issue linking
- 🧪 Change type classification
- ✅ Quality checklist (tests, docs, lint)
- 📊 Code quality requirements
- 🚀 Deployment notes

## 📊 Quality Gates

**Every PR must pass**:

- ✅ Build on all OS/Node.js combinations
- ✅ Type checking (strict mode)
- ✅ ESLint (0 errors, warnings allowed)
- ✅ Tests (existing must not break)
- ✅ Security scans (no high-severity issues)

**Release Requirements**:

- ✅ All CI checks pass
- ✅ Test coverage maintained
- ✅ No security vulnerabilities
- ✅ Conventional commit format

## 🛠️ Development Scripts

```bash
# Quality checks (used in CI)
npm run quality:check     # Full quality pipeline
npm run lint             # ESLint analysis
npm run typecheck        # TypeScript strict checking
npm run test:coverage    # Tests with coverage

# Analysis tools
npm run analyze:deps     # Find unused dependencies
npm run analyze:circular # Detect circular dependencies
npm run analyze:all     # Run all analysis tools

# Development workflow
npm run dev             # Start development mode
npm run format          # Format code with Prettier
npm run workspace:info  # Show workspace structure
```

## 🔄 Semantic Versioning

**Conventional Commits** (`.releaserc.json`):

- **feat**: 🆕 Minor version bump
- **fix**: 🐛 Patch version bump
- **BREAKING CHANGE**: 💥 Major version bump
- **docs, style, refactor**: 📝 No version bump

**Branching Strategy**:

- `main`: Production releases (stable)
- `develop`: Development releases (beta)
- Feature branches: PR to `develop`

## 🎯 Benefits

**Quality Assurance**:

- 🔄 **Consistent testing** across multiple environments
- 🛡️ **Early detection** of security vulnerabilities
- 📊 **Automated quality** metrics and reporting

**Developer Experience**:

- 🚀 **Fast feedback** on code changes
- 🔧 **Auto-fixing** for common issues
- 📝 **Clear guidelines** for contributions

**Release Management**:

- 📦 **Automated versioning** based on commit messages
- 📋 **Generated changelogs** for every release
- 🏷️ **NPM publishing** with proper dist-tags

**Security**:

- 🔍 **Continuous monitoring** for vulnerabilities
- 📊 **SARIF integration** with GitHub Security tab
- 🔄 **Automated dependency** updates with security patches
