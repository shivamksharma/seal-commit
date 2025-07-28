# 🔒 seal-commit

A production-ready CLI tool to automatically detect and block API keys, secrets, tokens, or credentials from being committed to Git repositories.

[![npm version](https://badge.fury.io/js/seal-commit.svg)](https://badge.fury.io/js/seal-commit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)

## ✨ Features

- **Zero-config setup** - Automatically installs Git pre-commit hooks
- **Comprehensive detection** - Finds API keys, tokens, and high-entropy strings
- **Multiple scan modes** - Check staged files, scan entire codebase, or fix secrets
- **Customizable patterns** - Add your own regex patterns and ignore rules
- **Developer-friendly** - Clear output with file paths and line numbers
- **CI/CD ready** - JSON report generation for automated workflows
- **Cross-platform** - Works on Linux, macOS, and Windows

## 🚀 Quick Start

### Installation

Install as a dev dependency in your project:

```bash
npm install --save-dev seal-commit
```

Or use with npx (no installation required):

```bash
npx seal-commit
```

### Automatic Setup

When installed via npm, `seal-commit` automatically:
1. Installs Husky (if not already present)
2. Creates a pre-commit hook that runs on every `git commit`
3. Scans staged files for secrets before allowing commits

### Basic Usage

```bash
# Check staged files (default behavior)
npx seal-commit

# Scan all tracked files in repository
npx seal-commit scan-all

# Attempt to redact/fix detected secrets
npx seal-commit fix

# Generate JSON report
npx seal-commit --report secrets-report.json
```

## 📖 Usage Guide

### Commands

#### `check` (default)
Scans staged files for secrets before commit:

```bash
npx seal-commit check
# or simply
npx seal-commit
```

**Options:**
- `-c, --config <path>` - Use custom configuration file
- `--no-colors` - Disable colored output
- `-v, --verbose` - Enable verbose output with additional details
- `-r, --report <path>` - Generate JSON report at specified path

#### `scan-all`
Scans all tracked files in the repository:

```bash
npx seal-commit scan-all
```

**Options:**
- `-c, --config <path>` - Use custom configuration file
- `--no-colors` - Disable colored output
- `-v, --verbose` - Enable verbose output
- `-r, --report <path>` - Generate JSON report

#### `fix`
Attempts to redact or remove detected secrets:

```bash
npx seal-commit fix
```

**Options:**
- `-c, --config <path>` - Use custom configuration file
- `--no-colors` - Disable colored output
- `-v, --verbose` - Enable verbose output
- `--backup` - Create backup files before making changes (default: true)

### Configuration

Create a `.sealcommitrc` file in your project root to customize behavior:

```json
{
  "patterns": {
    "custom": [
      "my-custom-secret-pattern-\\w{32}"
    ],
    "enabled": [
      "aws-access-key",
      "google-api-key",
      "jwt-token"
    ],
    "disabled": [
      "bearer-token"
    ]
  },
  "entropy": {
    "threshold": 4.5,
    "minLength": 25,
    "maxLength": 80
  },
  "ignore": {
    "files": [
      "*.test.js",
      "mock-data.json"
    ],
    "directories": [
      "test-fixtures",
      "examples"
    ],
    "extensions": [
      ".example",
      ".template"
    ]
  },
  "allowlist": [
    "example-api-key-not-real",
    "test-token-12345"
  ]
}
```

Configuration files can be in JSON or YAML format:
- `.sealcommitrc`
- `.sealcommitrc.json`
- `.sealcommitrc.yaml`
- `.sealcommitrc.yml`

## 🔍 Detection Capabilities

### Built-in Patterns

`seal-commit` detects these secret types out of the box:

**Cloud Provider Keys:**
- AWS Access Keys (`AKIA[0-9A-Z]{16}`)
- AWS Secret Keys (`[0-9a-zA-Z/+]{40}`)
- Google API Keys (`AIza[0-9A-Za-z\\-_]{35}`)

**Service API Keys:**
- Stripe Keys (`sk_live_`, `pk_live_`)
- GitHub Tokens (`ghp_`, `gho_`, `ghs_`, `ghr_`)
- Firebase Keys

**Generic Patterns:**
- JWT Tokens (`eyJ...`)
- Bearer Tokens (`Bearer [token]`)
- Private Keys (`-----BEGIN PRIVATE KEY-----`)

### Entropy-Based Detection

Detects high-entropy strings that might be secrets:
- Shannon entropy threshold ≥ 4.0 (configurable)
- String length between 20-100 characters (configurable)
- Alphanumeric with special characters
- Base64-like patterns

## 📊 Output Examples

### Terminal Output

When secrets are detected:

```
❌ Secrets detected in staged files!

📁 src/config.js
  Line 15: AWS Access Key
    AKIA████████████████ (truncated)
  
  Line 23: High-Entropy String
    eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9... (truncated)

📁 api/auth.js  
  Line 8: Google API Key
    AIza████████████████████████████████ (truncated)

🚫 Commit blocked! Found 3 secret(s) in 2 file(s).

To bypass this check (NOT RECOMMENDED):
  git commit --no-verify
```

### JSON Report

Generate structured reports for CI/CD:

```bash
npx seal-commit --report secrets-report.json
```

```json
{
  "summary": {
    "hasSecrets": true,
    "totalFindings": 3,
    "filesScanned": 15,
    "filesWithSecrets": 2,
    "scanDuration": 245
  },
  "findings": [
    {
      "type": "pattern",
      "category": "aws-access-key",
      "filePath": "src/config.js",
      "lineNumber": 15,
      "columnStart": 20,
      "columnEnd": 40,
      "truncatedMatch": "AKIA████████████████",
      "confidence": 0.95
    }
  ],
  "metadata": {
    "scanMode": "staged-files",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0.0"
  }
}
```

## 🛠️ Advanced Usage

### Custom Patterns

Add your own regex patterns to detect organization-specific secrets:

```json
{
  "patterns": {
    "custom": [
      "MYCOMPANY_API_[A-Z0-9]{32}",
      "internal-token-[a-f0-9]{64}"
    ]
  }
}
```

### Ignore Rules

Exclude files, directories, or patterns from scanning:

```json
{
  "ignore": {
    "files": [
      "*.min.js",
      "test-data.json",
      "mock-*.js"
    ],
    "directories": [
      "node_modules",
      "dist",
      "test-fixtures"
    ],
    "extensions": [
      ".log",
      ".tmp",
      ".cache"
    ]
  }
}
```

### Allowlist

Whitelist known safe strings that shouldn't be flagged:

```json
{
  "allowlist": [
    "example-api-key-12345",
    "test-secret-not-real",
    "demo-token-for-docs"
  ]
}
```

### Entropy Tuning

Adjust entropy detection sensitivity:

```json
{
  "entropy": {
    "threshold": 4.5,    // Higher = less sensitive
    "minLength": 30,     // Minimum string length to check
    "maxLength": 200     // Maximum string length to check
  }
}
```

## 🔧 Integration Examples

### GitHub Actions

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  scan-secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx seal-commit scan-all --report secrets-report.json
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: secrets-report
          path: secrets-report.json
```

### Pre-commit Hook (Manual Setup)

If you need to manually configure the pre-commit hook:

```bash
#!/bin/sh
# .husky/pre-commit
npx seal-commit
```

### Package.json Scripts

```json
{
  "scripts": {
    "security:scan": "npx seal-commit scan-all",
    "security:fix": "npx seal-commit fix",
    "security:report": "npx seal-commit scan-all --report security-report.json"
  }
}
```

## 🚨 Troubleshooting

### Common Issues

#### "Not in a Git repository"
**Problem:** Running seal-commit outside a Git repository.
**Solution:** Initialize Git or run from within a Git repository:
```bash
git init
```

#### "No staged files to scan"
**Problem:** No files are staged for commit.
**Solution:** Stage files first or use `scan-all` mode:
```bash
git add .
# or
npx seal-commit scan-all
```

#### "Permission denied" during installation
**Problem:** Insufficient permissions to install Husky hooks.
**Solution:** Check repository permissions or run with appropriate privileges.

#### High false positive rate
**Problem:** Too many legitimate strings flagged as secrets.
**Solution:** Adjust entropy threshold or add to allowlist:
```json
{
  "entropy": {
    "threshold": 4.5
  },
  "allowlist": [
    "legitimate-string-that-looks-like-secret"
  ]
}
```

#### Missing secrets in scan
**Problem:** Known secrets not being detected.
**Solution:** 
1. Check if pattern is in disabled list
2. Verify file isn't in ignore rules
3. Add custom pattern if needed

### Debug Mode

Enable verbose output for troubleshooting:

```bash
npx seal-commit --verbose
```

### Bypass Protection (Emergency)

In emergency situations, you can bypass the pre-commit hook:

```bash
git commit --no-verify
```

**⚠️ Warning:** This bypasses all secret detection. Use only when absolutely necessary.

## 🔄 Migration Guide

### From other secret scanners

If migrating from other tools:

1. **Remove old hooks:** Clean up existing pre-commit configurations
2. **Install seal-commit:** `npm install --save-dev seal-commit`
3. **Configure patterns:** Migrate custom patterns to `.sealcommitrc`
4. **Test setup:** Run `npx seal-commit scan-all` to verify

### Updating configuration

When updating from older versions:

1. **Check schema:** Configuration schema may have changed
2. **Update patterns:** New built-in patterns may be available
3. **Review ignore rules:** Default ignore rules may have been updated

## 📝 Configuration Reference

### Complete Configuration Schema

```json
{
  "patterns": {
    "custom": ["string[]"],
    "enabled": ["aws-access-key", "aws-secret-key", "google-api-key", "stripe-key", "github-token", "firebase-key", "jwt-token", "bearer-token", "private-key"],
    "disabled": ["string[]"]
  },
  "entropy": {
    "threshold": 4.0,
    "minLength": 20,
    "maxLength": 100
  },
  "ignore": {
    "files": ["*.min.js", "*.map", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
    "directories": ["node_modules", ".git", "dist", "build", "coverage"],
    "extensions": [".min.js", ".lock", ".map", ".log"]
  },
  "allowlist": ["string[]"],
  "output": {
    "format": "terminal|json|both",
    "colors": true,
    "verbose": false
  }
}
```

### Environment Variables

- `NO_COLOR` - Disable colored output (respects standard)
- `CI` - Automatically detected for CI/CD environments

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/your-org/seal-commit.git
cd seal-commit
npm install
npm test
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [Husky](https://github.com/typicode/husky) - Git hooks made easy
- [detect-secrets](https://github.com/Yelp/detect-secrets) - Python-based secret scanner
- [gitleaks](https://github.com/zricethezav/gitleaks) - Go-based secret scanner

## 📞 Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/your-org/seal-commit/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/your-org/seal-commit/discussions)
- 📖 **Documentation:** [Wiki](https://github.com/your-org/seal-commit/wiki)

---

**Made with ❤️ for secure development workflows**