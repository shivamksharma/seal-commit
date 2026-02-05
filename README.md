# Seal-Commit

A production-grade CLI tool that scans staged git files for secrets and blocks commits when sensitive data is detected.

## Overview

Seal-Commit prevents accidental secret leaks by automatically scanning your staged changes before every commit. If a secret is detected, the commit is blocked with a clear explanation of the issue and guidance on how to fix it.

### The Problem

Developers frequently commit secrets—API keys, tokens, passwords, and credentials—into git repositories. These secrets often end up in public repos, version history, and CI/CD pipelines. According to security research, thousands of secrets are leaked to GitHub every day.

### The Solution

Seal-Commit acts as a last line of defense, intercepting commits that contain secrets before they enter your git history. It's designed to be:

- **Zero-configuration**: Works out of the box with sensible defaults
- **Fast**: Scans only staged files, not your entire repository
- **Cross-platform**: Works consistently on Windows, macOS, and Linux
- **Developer-friendly**: Clear error messages with fix suggestions

## Key Features

- **Multi-Layer Detection**: Combines regex patterns, entropy analysis, and AST parsing
- **Bypass Technique Detection**: Identifies common obfuscation methods (base64, concatenation, Unicode)
- **Severity Scoring**: Categorizes findings as critical, high, medium, or low
- **Educational Messages**: Explains why each secret type is dangerous
- **Whitelisting**: Easily allow false positives without disabling protection
- **CI/CD Ready**: Designed for integration into automated pipelines
- **No Dependencies**: Minimal external dependencies for security and reliability

## Installation

### Global Install (Recommended)

```bash
npm install -g seal-commit
```

### Local Install (For Teams)

```bash
npm install --save-dev seal-commit
npx seal-commit init
```

### Requirements

- Node.js 18.0 or higher
- Git 2.0 or higher
- npm or compatible package manager

## Quick Start

1. **Install Seal-Commit**
   ```bash
   npm install -g seal-commit
   ```

2. **Initialize in Your Repository**
   ```bash
   cd /path/to/your/repo
   seal-commit init
   ```

3. **Make a Commit**
   ```bash
   git add .
   git commit -m "Add new feature"
   ```

   If a secret is detected, you'll see:
   ```
   ┌─ SECRET DETECTED: src/config.js ────────────────────────
   │ Line: 12
   │ Type: AWS Access Key ID
   │ Severity: CRITICAL
   │ Match: "AKIAIOSFODNN7EXAMPLE"
   │
   │ Why: AWS Access Keys provide full access to AWS resources.
   │ Fix: Use environment variables or IAM roles instead.
   └────────────────────────────────────────────────────────
   ✖ Commit blocked due to potential secrets.
   ```

## How It Works

### Pre-Commit Hook Flow

1. Developer runs `git commit`
2. Git executes the pre-commit hook
3. Seal-Commit scans only staged files
4. If secrets are found, commit is blocked
5. Developer reviews findings and fixes the issue
6. Commit proceeds once secrets are resolved

### Secret Detection

Seal-Commit uses three complementary detection methods:

1. **Pattern Matching**: 25+ regex patterns for known secret formats (AWS keys, JWT tokens, API keys, etc.)
2. **Entropy Analysis**: Statistical analysis to detect high-entropy strings that may be unknown secrets
3. **AST Parsing**: JavaScript/TypeScript analysis to detect concatenated strings and template literals

### Commit Blocking

When a secret is detected:
- The commit is blocked (exit code 1)
- All findings are displayed with severity levels
- Educational messages explain the risk
- Fix suggestions are provided
- The commit is prevented from entering history

## Supported Secret Types

### Cloud Providers

| Type | Pattern | Severity |
|------|---------|----------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | Critical |
| AWS Secret Key | `[A-Za-z0-9/+=]{40}` | Critical |
| Google API Key | `AIza[0-9A-Za-z-_]{35}` | High |
| Google OAuth | `*.apps.googleusercontent.com` | High |

### Authentication Tokens

| Type | Pattern | Severity |
|------|---------|----------|
| Slack Token | `xox[baprs]-...` | Critical |
| GitHub Token | `gh[pousr]_...` | Critical |
| JWT Token | `eyJ...` | High |
| OpenAI Key | `sk-...` | High |

### Database Connections

| Type | Pattern | Severity |
|------|---------|----------|
| PostgreSQL | `postgres://...` | High |
| MySQL | `mysql://...` | High |
| MongoDB | `mongodb://...` | High |
| Redis | `redis://...` | High |

### Private Keys

| Type | Pattern | Severity |
|------|---------|----------|
| RSA Private Key | `-----BEGIN...PRIVATE KEY-----` | Critical |
| OpenSSH Key | `-----BEGIN OPENSSH...` | Critical |

### Email Services

| Type | Pattern | Severity |
|------|---------|----------|
| SendGrid | `SG....` | Critical |
| Mailgun | `key-...` | High |
| Mailchimp | `*-us*` | High |

### Other

| Type | Pattern | Severity |
|------|---------|----------|
| Stripe Key | `sk_...` / `pk_...` | Critical |
| Twilio Key | `SK...` / `AC...` | High |
| Square Token | `sq0atp-...` | Critical |
| Shopify Token | `shpat_...` | Critical |

## Usage

### CLI Commands

```bash
seal-commit init          # Initialize pre-commit hook
seal-commit run           # Scan staged files
seal-commit run --dry-run # Preview without blocking
seal-commit scan          # Scan entire project
seal-commit scan .        # Scan specific path
seal-commit allow "pattern"  # Add to whitelist
seal-commit verify        # Verify .sealignore integrity
seal-commit list          # List whitelisted patterns
seal-commit patterns      # Show all supported patterns
seal-commit config        # View/set configuration
seal-commit ci            # CI/CD mode
```

### Command Options

#### `seal-commit run`

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview findings without blocking |
| `--ci` | CI mode for automated pipelines |
| `-v, --verbose` | Enable debug output |

#### `seal-commit scan`

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview without exit code 1 |
| `--ci` | CI mode with proper exit codes |
| `--history` | Scan git history |
| `--no-parallel` | Disable parallel scanning |

#### `seal-commit init`

| Option | Description |
|--------|-------------|
| `-f, --force` | Overwrite existing hook |
| `--merge` | Combine with existing hook |

## Common Use Cases

### Individual Developers

Protect your personal projects and prevent accidental secrets in your code:

```bash
seal-commit init
# Done - protection is active
```

### Development Teams

Standardize secret prevention across your team:

```bash
# Add to package.json
npm install --save-dev seal-commit

# Add to your CI pipeline
- name: Seal-Commit Scan
  run: npx seal-commit ci
```

### Open-Source Maintainers

Ensure contributors don't accidentally commit secrets:

```markdown
<!-- Add to CONTRIBUTING.md -->
## Security

This project uses Seal-Commit to prevent secret leaks. 
Before committing, ensure no secrets are included. 
Run `seal-commit run --dry-run` to verify.
```

### Security Researchers

Scan repositories for potential vulnerabilities:

```bash
# Clone and scan
git clone https://github.com/target/repo.git
cd repo
seal-commit scan --history
```

## Configuration

### Default Configuration

Seal-Commit works without configuration. Default settings:

```json
{
  "entropyThreshold": 5.2,
  "maxFileSize": 10485760,
  "enableCache": true
}
```

### Custom Configuration

Create `.sealconfig.json` in your project root:

```json
{
  "entropyThreshold": 5.5,
  "maxFileSize": 5242880,
  "enableCache": true,
  "ignoredPaths": ["tests/", "fixtures/"]
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entropyThreshold` | number | 5.2 | Min entropy for secret detection |
| `maxFileSize` | number | 10485760 | Max file size in bytes |
| `enableCache` | boolean | true | Enable result caching |
| `ignoredPaths` | array | [] | Paths to ignore |

## Whitelisting Secrets

### Allowing a Pattern

```bash
# Allow a specific key
seal-commit allow "AKIA_TEST_12345EXAMPLE"

# Allow using .sealignore directly
echo "AKIA_TEST_12345EXAMPLE" >> .sealignore
```

### Best Practices

1. **Be Specific**: Whitelist exact patterns, not broad matches
2. **Document Reasons**: Comment why each pattern is whitelisted
3. **Review Regularly**: Periodically audit `.sealignore`
4. **Use Test Patterns**: If testing with fake keys, whitelist them:

```bash
# In .sealignore
# Test keys (safe for development)
AKIA_TEST_12345EXAMPLE
sk_test_fake_key_12345
```

### Ignoring Files

Use glob patterns to ignore entire files or directories:

```bash
# In .sealignore
# Ignore test files
*.test.js

# Ignore configuration
config/*.js

# Ignore specific directory
secrets/
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Seal-Commit Scan

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Seal-Commit
        run: npm install -g seal-commit
      
      - name: Run Seal-Commit
        run: seal-commit ci
```

### GitLab CI

```yaml
seal_commit:
  stage: security
  script:
    - npm install -g seal-commit
    - seal-commit ci
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

### CircleCI

```yaml
workflows:
  version: 2
  scan:
    jobs:
      - seal-commit:
          context: security
```

## Security Philosophy

### Zero-Configuration

Seal-Commit is designed to work without configuration. Sensible defaults are carefully chosen to:
- Minimize false positives
- Catch real secrets
- Block critical vulnerabilities

You shouldn't need to configure a security tool to make it effective.

### Developer-First Design

- **Fast**: Staged file scanning takes milliseconds
- **Clear**: Error messages explain the problem and solution
- **Respectful**: Doesn't block workflows unnecessarily
- **Educational**: Each finding teaches about the risk

### Fail-Safe Commit Blocking

- Secrets are never committed, even in emergencies
- The only way to bypass is `git commit --no-verify`
- Audit trails show when bypasses occur
- Team policies can disable bypasses if needed

## Performance Notes

### Why It's Fast

1. **Staged-Only Scanning**: Only modified files are scanned, not the entire repository
2. **Efficient Regex**: Optimized patterns minimize processing time
3. **Early Exit**: Large files are skipped after size check
4. **Caching**: Results are cached to avoid rescanning unchanged files

### Benchmarks

| Repository Size | Staged Files | Scan Time |
|-----------------|--------------|-----------|
| Small (<100 files) | 1-5 | <50ms |
| Medium (100-1000 files) | 5-20 | 100-500ms |
| Large (1000+ files) | 20-50 | 500ms-2s |

## Roadmap

### v2.1 (Upcoming)
- Python AST parsing
- Go AST parsing
- Ruby AST parsing
- Custom pattern support via config

### v3.0 (Planned)
- Server-side secret scanning
- Team management dashboard
- SIEM integration
- Compliance reporting
- Enterprise SSO support

## Contributing

Contributions are welcome! Please read our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Add tests for your changes
4. Ensure all tests pass
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/your-org/seal-commit.git
cd seal-commit
npm install
npm test
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## FAQ

**Q: Does Seal-Commit scan committed history?**
A: No, it only scans staged files for the current commit. Use `seal-commit scan --history` to scan history.

**Q: Can I bypass Seal-Commit in an emergency?**
A: Yes, use `git commit --no-verify`. This bypasses all hooks. Your team may want to audit or disable this capability.

**Q: Will Seal-Commit slow down my commits?**
A: No, scanning staged files typically takes less than 100ms for most projects.

**Q: Does Seal-Commit send data anywhere?**
A: No, all scanning happens locally. No data is transmitted to external servers.

**Q: How do I update Seal-Commit?**
A: `npm update -g seal-commit`

**Q: Can I use Seal-Commit without git hooks?**
A: Yes, run `seal-commit scan` or `seal-commit run` manually.

**Q: Does Seal-Commit support private registries?**
A: Yes, configure through `.sealconfig.json` or environment variables.

**Q: How do I report a false positive?**
A: Use `seal-commit allow "<pattern>"` to whitelist the pattern. For pattern improvements, open an issue.

---

**Remember**: The best secret is one that never enters version control. Seal-Commit helps ensure that.
