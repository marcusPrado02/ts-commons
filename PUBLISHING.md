# Publishing & Consuming @marcusprado02 Packages

Packages are published to [GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

---

## For Consumers

### 1. Create a GitHub Personal Access Token

Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)** and create a token with the `read:packages` scope.

### 2. Configure your project's `.npmrc`

Add the following to the `.npmrc` at the root of your project (never commit the actual token):

```ini
@marcusprado02:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then set the `GITHUB_TOKEN` environment variable to your PAT:

```bash
# In your shell (or add to your CI secrets)
export GITHUB_TOKEN=ghp_your_token_here
```

Or store it in your personal `~/.npmrc` (never in the repo):

```ini
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

### 3. Install packages

```bash
npm install @marcusprado02/kernel @marcusprado02/application
# or
pnpm add @marcusprado02/kernel @marcusprado02/application
```

### Available packages

| Package                        | Description                                                      |
| ------------------------------ | ---------------------------------------------------------------- |
| `@marcusprado02/kernel`        | Core DDD building blocks: AggregateRoot, DomainEvent, Result     |
| `@marcusprado02/application`   | CQRS: Mediator, MediatorRequest, RequestHandler, ValidationError |
| `@marcusprado02/persistence`   | Repository port: RepositoryPort, Page                            |
| `@marcusprado02/errors`        | HTTP error mapping: AppError, AppErrorCode, HttpErrorMapper      |
| `@marcusprado02/observability` | Logger, metrics, performance monitoring                          |
| `@marcusprado02/eventsourcing` | EventSourcedAggregate, InMemoryEventStore, ProjectionRunner      |
| `@marcusprado02/messaging`     | Event broker abstractions: EventEnvelope, FanOutBroker           |
| `@marcusprado02/validation`    | Schema validation utilities                                      |
| `@marcusprado02/security`      | Auth helpers, JWT utilities                                      |
| `@marcusprado02/web`           | Framework-agnostic HTTP abstractions                             |
| `@marcusprado02/web-nestjs`    | NestJS integration: ValidationPipe, exception filters            |
| `@marcusprado02/web-express`   | Express integration                                              |
| `@marcusprado02/web-fastify`   | Fastify integration                                              |
| `@marcusprado02/testing`       | Test utilities: InMemoryRepository, fixtures                     |

---

## For Maintainers

### Prerequisites

- Push access to the repository
- Changesets installed: `pnpm add -D @changesets/cli` (already in workspace)

### Creating a release

1. **Add a changeset** describing your changes:

   ```bash
   pnpm changeset
   ```

   Select the packages changed, bump type (patch/minor/major), and write a summary.

2. **Commit** the generated `.changeset/*.md` file along with your code changes.

3. **Open a PR** targeting `main`. The `publish.yml` CI workflow will automatically create (or update) a **"Version Packages"** pull request that bumps all affected packages.

4. **Merge the "Version Packages" PR** — CI will publish all changed packages to GitHub Packages automatically using `GITHUB_TOKEN` (no extra secrets needed).

### Manual publish (emergency)

```bash
# Authenticate first
export NODE_AUTH_TOKEN=ghp_your_token_here

pnpm build
pnpm changeset:publish
```

### CI secrets required

| Secret         | Value                                                      |
| -------------- | ---------------------------------------------------------- |
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions — no setup needed |

No additional secrets are required. GitHub Packages for packages owned by the same repository can be published using the built-in `GITHUB_TOKEN`.
