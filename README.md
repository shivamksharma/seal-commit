# 🔒 seal-commit

**A lightweight, zero-config CLI tool to prevent secrets from being committed to your Git repository.**

`seal-commit` automatically hooks into your Git workflow to scan for API keys, credentials, and other sensitive data before you commit. It's fast, accurate, and designed to integrate seamlessly into any project.

[![npm version](https://badge.fury.io/js/seal-commit.svg)](https://badge.fury.io/js/seal-commit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)

---

## ✨ Why seal-commit?

- **Prevent Security Breaches:** Automatically block commits containing secrets, protecting your organization from costly leaks.
- **Developer-First:** Designed to be intuitive and unobtrusive, with clear, actionable feedback directly in your terminal.
- **Zero Configuration:** Works out of the box. Install it, and it instantly protects your repository.
- **CI/CD Friendly:** Generate JSON reports for easy integration into your existing security and DevOps pipelines.
- **Highly Performant:** Built with modern JavaScript, ensuring fast scans that don't slow you down.

## 🚀 Getting Started

### Installation

Install `seal-commit` as a development dependency in your project. This will automatically set up the pre-commit hook using Husky.

```bash
npm install --save-dev seal-commit
```

That's it! The next time you run `git commit`, `seal-commit` will automatically scan your staged files.

### Usage Without Installation

You can also run `seal-commit` on any repository using `npx`:

```bash
npx seal-commit scan-all
```

## 📖 Command-Line Interface

`seal-commit` comes with several commands to fit your workflow.

### `check` (Default)

Scans staged files for secrets. This is the default command that runs in the pre-commit hook.

```bash
# Runs automatically on `git commit`
npx seal-commit
```

### `scan-all`

Performs a comprehensive scan of all tracked files in your repository. Ideal for initial setup or CI/CD pipelines.

```bash
npx seal-commit scan-all
```

### `fix`

Attempts to automatically redact secrets found in your staged files by replacing them with `[REDACTED]`.

```bash
npx seal-commit fix
```

### Command Options

All commands accept the following options:

- `-c, --config <path>`: Path to a custom configuration file.
- `-r, --report <path>`: Generate a JSON report at the specified path.
- `-v, --verbose`: Enable verbose output with additional details.
- `--no-colors`: Disable colored output in the terminal.

## ⚙️ Configuration

For most users, `seal-commit` works great with zero configuration. If you need to customize its behavior, create a `.sealcommitrc` file in your project's root directory.

Supported file names: `.sealcommitrc`, `.sealcommitrc.json`, `.sealcommitrc.yaml`, or `.sealcommitrc.yml`.

### Example Configuration (`.sealcommitrc`)

```yaml
# Adjust the sensitivity of entropy-based scanning.
entropy:
  threshold: 4.5 # Higher is less sensitive.
  minLength: 25

# Define custom regex patterns to find organization-specific secrets.
patterns:
  custom:
    - "my-company-token-[a-f0-9]{40}"
  # Disable built-in patterns that you don't need.
  disabled:
    - "bearer-token"

# Whitelist specific strings that are safe to commit.
allowlist:
  - "this-is-a-false-positive-example"

# Ignore files, directories, or extensions that should not be scanned.
ignore:
  files:
    - "package-lock.json"
    - "yarn.lock"
  directories:
    - "node_modules/"
    - "dist/"
  extensions:
    - ".test.js"
    - ".snap"
```

## 🔍 Detection Capabilities

`seal-commit` uses a combination of pattern matching and entropy analysis to detect secrets.

### High-Confidence Patterns

It detects a wide range of secrets with high accuracy, including:
- **Cloud Provider Keys:** AWS Access Keys, AWS Session Tokens, Google API Keys
- **Service API Keys:** Stripe, GitHub (Personal Access Tokens, OAuth), Firebase
- **Generic Secrets:** JWTs, Private Keys (RSA, EC, OpenSSH), Bearer Tokens

### Entropy-Based Detection

It also identifies high-entropy strings that are likely to be credentials, even if they don't match a known pattern. This is useful for catching randomly generated tokens or custom keys. The sensitivity of this detection can be tuned in the configuration.

## 📊 CI/CD Integration

`seal-commit` is designed for seamless integration into your CI/CD pipelines.

### Example: GitHub Actions

Here's how to use `seal-commit` to scan your codebase in a GitHub Actions workflow and upload a report if secrets are found.

```yaml
name: Secret Scan

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  scan-secrets:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run seal-commit scan
        run: npx seal-commit scan-all --report secrets-report.json || true

      - name: Upload report if secrets were found
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: secrets-report
          path: secrets-report.json
```

## 🚨 Troubleshooting

- **"No staged files to scan"**: This is expected if you run `seal-commit` without any staged files. Use `git add .` to stage files or run `seal-commit scan-all` to check the whole repository.
- **High False Positives**: If the scanner flags strings that are not secrets, you can either add them to the `allowlist` or increase the `entropy.threshold` in your configuration to make the detection less sensitive.
- **Bypassing the Hook (Use with Caution!)**: In an emergency, you can bypass the pre-commit hook using the `--no-verify` flag. This is **not recommended**.
  ```bash
  git commit -m "My commit message" --no-verify
  ```

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for more details on how to get involved.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.