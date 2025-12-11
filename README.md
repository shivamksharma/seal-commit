# 🦭 Seal-Commit

> **A lightweight, zero-config CLI tool that checks your code for secrets before you commit.**

[![npm version](https://img.shields.io/npm/v/seal-commit.svg)](https://www.npmjs.com/package/seal-commit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)

**Seal-Commit** acts as a guardian for your git repositories. It automatically scans staged files for sensitive information like API keys, tokens, and passwords. If a secret is detected, the commit is blocked, preventing accidental leaks.

It works out-of-the-box with **no configuration required**. 

---

## ✨ Features

- **🚀 Zero Configuration**: Install and go. No complex YAML files needed.
- **🛡️ Robust Detection**: Uses regex patterns to catch:
  - AWS Access Keys (`AKIA...`)
  - Google API Keys (`AIza...`)
  - Slack Tokens (`xox...`)
  - JWT Tokens
  - Private Keys (`-----BEGIN RSA PRIVATE KEY...`)
  - Generic patterns (e.g., `apiKey`, `password`, `secret` assignments)
- **⚡ Fast Execution**: Scans only the files you are about to commit (staged files).
- **✅ Cross-Platform**: Fully compatible with Windows, macOS, and Linux.
- **🔓 Easy Whitelisting**: False positive? Run `seal-commit allow` to ignore it.
- **📦 Zero Dependencies**: Built with minimal dependencies for security and speed.

---

## 🚀 Getting Started

### Installation

Install `seal-commit` globally using npm:

```bash
npm install -g seal-commit
```

### Setup

To protect a repository, navigate to the project root and run:

```bash
seal-commit init
```

That's it! 
This command installs a git `pre-commit` hook. Now, every time you run `git commit`, Seal-Commit will automatically scan your staged changes.

---

## 🛠 Usage

### Automatic Protection
Once initialized, just work as normal. If you try to commit a file containing a secret:

```bash
git add .
git commit -m "add API key"
```

**Seal-Commit** will intercept the process:

```
┌─ SECRET DETECTED: src/config.js ───────────────────
│ Line: 12
│ Type: AWS Access Key
│ Match: "AKIAIOSFODNN7EXAMPLE"
│ 
│ Advice: Replace this hardcoded value with an environment variable.
└───────────────────────────────────────────────────
✖ Commit blocked due to potential secrets.
```

### Manual Scanning

You can scan your entire project codebase at any time (ignoring `.git`, `node_modules`, etc.):

```bash
seal-commit scan
```

### Handling False Positives

Sometimes a safe string might look like a secret (e.g., a test string or a public ID). To allow it, run:

```bash
seal-commit allow "AKIA_FAKE_KEY_FOR_TESTING"
```

This adds the pattern to a `.sealignore` file in your project root. You can also edit `.sealignore` manually. It works similar to `.gitignore`.

---

## ⚙️ Configuration (.sealignore)

The `.sealignore` file contains a list of patterns (strings or regex) that the scanner should ignore.

Example `.sealignore`:
```text
# Ignore specific test values
AKIA_TEST_12345
my-public-token

# Ignore lines matching a pattern
EXAMPLE_KEY_.*
```

---

## 🛡 Supported Detectors

Seal-Commit comes with built-in patterns for:

| Provider | Description | Pattern Example |
|----------|-------------|-----------------|
| **AWS** | Access Key IDs | `AKIA...` |
| **Google** | API Keys | `AIza...` |
| **Slack** | Bot/User Tokens | `xoxb-...` |
| **JWT** | JSON Web Tokens | `eyJ...` |
| **Crypto** | Private Keys | `BEGIN PRIVATE KEY` |
| **Generic**| Variable assignments | `const apiKey = "..."` |

*Note: The generic detector looks for common variable names like `password`, `secret`, `token`, `key` assigned to string literals.*

---

## ❓ Troubleshooting

**Q: I installed it, but commits aren't being blocked?**  
A: Ensure you ran `seal-commit init` in the specific repository. Check if `.git/hooks/pre-commit` exists and is executable (`chmod +x .git/hooks/pre-commit`).

**Q: Can I bypass the check in an emergency?**  
A: Yes, standard git behavior applies. You can use `git commit --no-verify` to bypass hooks, but do so with caution!

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository.
2. Clone it locally.
3. Run `npm install` to install dependencies.
4. Make your changes and test using `npm link`.
5. Submit a Pull Request.

---
