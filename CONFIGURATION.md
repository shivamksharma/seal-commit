# Configuration Guide

This document provides comprehensive documentation for all `seal-commit` configuration options.

## Configuration Files

`seal-commit` looks for configuration files in the following order:

1. `.sealcommitrc` (JSON or YAML)
2. `.sealcommitrc.json`
3. `.sealcommitrc.yaml`
4. `.sealcommitrc.yml`

You can also specify a custom config file using the `--config` option:

```bash
npx seal-commit --config path/to/custom-config.json
```

## Configuration Schema

### Complete Configuration Structure

```json
{
  "patterns": {
    "custom": ["string[]"],
    "enabled": ["string[]"],
    "disabled": ["string[]"]
  },
  "entropy": {
    "threshold": "number",
    "minLength": "integer",
    "maxLength": "integer"
  },
  "ignore": {
    "files": ["string[]"],
    "directories": ["string[]"],
    "extensions": ["string[]"]
  },
  "allowlist": ["string[]"],
  "output": {
    "format": "string",
    "colors": "boolean",
    "verbose": "boolean"
  }
}
```

## Configuration Options

### `patterns`

Controls which secret patterns are used for detection.

#### `patterns.custom`
- **Type:** `Array<string>`
- **Default:** `[]`
- **Description:** Custom regex patterns to detect organization-specific secrets

**Example:**
```json
{
  "patterns": {
    "custom": [
      "MYCOMPANY_API_[A-Z0-9]{32}",
      "internal-token-[a-f0-9]{64}",
      "prod-secret-[A-Za-z0-9]{40}"
    ]
  }
}
```

#### `patterns.enabled`
- **Type:** `Array<string>`
- **Default:** All built-in patterns
- **Description:** List of built-in patterns to enable
- **Valid values:**
  - `aws-access-key` - AWS Access Key ID
  - `aws-secret-key` - AWS Secret Access Key
  - `google-api-key` - Google API Key
  - `stripe-key` - Stripe API Key
  - `github-token` - GitHub Personal Access Token
  - `firebase-key` - Firebase API Key
  - `jwt-token` - JSON Web Token
  - `bearer-token` - Bearer Token
  - `private-key` - Private Key (PEM format)

**Example:**
```json
{
  "patterns": {
    "enabled": [
      "aws-access-key",
      "google-api-key",
      "jwt-token"
    ]
  }
}
```

#### `patterns.disabled`
- **Type:** `Array<string>`
- **Default:** `[]`
- **Description:** List of built-in patterns to disable

**Example:**
```json
{
  "patterns": {
    "disabled": [
      "bearer-token",
      "jwt-token"
    ]
  }
}
```

### `entropy`

Controls entropy-based secret detection for high-entropy strings.

#### `entropy.threshold`
- **Type:** `number`
- **Default:** `4.0`
- **Range:** `0.0` to `8.0`
- **Description:** Minimum Shannon entropy threshold for flagging strings

Higher values = less sensitive (fewer false positives)
Lower values = more sensitive (more potential secrets detected)

**Example:**
```json
{
  "entropy": {
    "threshold": 4.5
  }
}
```

#### `entropy.minLength`
- **Type:** `integer`
- **Default:** `20`
- **Range:** `1` to `1000`
- **Description:** Minimum string length to check for entropy

**Example:**
```json
{
  "entropy": {
    "minLength": 25
  }
}
```

#### `entropy.maxLength`
- **Type:** `integer`
- **Default:** `100`
- **Range:** `1` to `10000`
- **Description:** Maximum string length to check for entropy

**Example:**
```json
{
  "entropy": {
    "maxLength": 200
  }
}
```

### `ignore`

Controls which files, directories, and extensions to exclude from scanning.

#### `ignore.files`
- **Type:** `Array<string>`
- **Default:** `["*.min.js", "*.map", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"]`
- **Description:** File patterns to ignore (supports glob patterns with `*`)

**Example:**
```json
{
  "ignore": {
    "files": [
      "*.test.js",
      "mock-data.json",
      "config-*.example"
    ]
  }
}
```

#### `ignore.directories`
- **Type:** `Array<string>`
- **Default:** `["node_modules", ".git", "dist", "build", "coverage"]`
- **Description:** Directory names to ignore (exact match or substring)

**Example:**
```json
{
  "ignore": {
    "directories": [
      "test-fixtures",
      "examples",
      "docs"
    ]
  }
}
```

#### `ignore.extensions`
- **Type:** `Array<string>`
- **Default:** `[".min.js", ".lock", ".map", ".log"]`
- **Description:** File extensions to ignore

**Example:**
```json
{
  "ignore": {
    "extensions": [
      ".tmp",
      ".cache",
      ".backup"
    ]
  }
}
```

### `allowlist`

- **Type:** `Array<string>`
- **Default:** `[]`
- **Description:** Specific strings that should not be flagged as secrets

**Example:**
```json
{
  "allowlist": [
    "example-api-key-12345",
    "test-token-not-real",
    "demo-secret-for-documentation"
  ]
}
```

### `output`

Controls output formatting and display options.

#### `output.format`
- **Type:** `string`
- **Default:** `"terminal"`
- **Valid values:** `"terminal"`, `"json"`, `"both"`
- **Description:** Output format for scan results

**Example:**
```json
{
  "output": {
    "format": "json"
  }
}
```

#### `output.colors`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable colored terminal output

**Example:**
```json
{
  "output": {
    "colors": false
  }
}
```

#### `output.verbose`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Enable verbose output with additional details

**Example:**
```json
{
  "output": {
    "verbose": true
  }
}
```

## Configuration Examples

### Basic Configuration

Minimal configuration for most projects:

```json
{
  "patterns": {
    "enabled": [
      "aws-access-key",
      "google-api-key",
      "jwt-token"
    ]
  },
  "entropy": {
    "threshold": 4.0
  }
}
```

### Development Environment

Configuration optimized for development with more lenient settings:

```yaml
patterns:
  enabled:
    - aws-access-key
    - google-api-key
  disabled:
    - bearer-token  # Often used in tests

entropy:
  threshold: 3.5  # More sensitive
  minLength: 25

ignore:
  files:
    - "*.test.js"
    - "*.spec.js"
    - "mock-*.json"
  directories:
    - test-fixtures
    - examples

allowlist:
  - "example-api-key-12345"
  - "test-token-not-real"
```

### Production/CI Environment

Strict configuration for production environments:

```json
{
  "patterns": {
    "custom": [
      "PROD_[A-Z_]+_[A-Z0-9]{32}",
      "COMPANY_SECRET_[a-f0-9]{64}"
    ],
    "enabled": [
      "aws-access-key",
      "aws-secret-key",
      "google-api-key",
      "stripe-key",
      "github-token",
      "private-key"
    ]
  },
  "entropy": {
    "threshold": 4.5,
    "minLength": 20,
    "maxLength": 150
  },
  "ignore": {
    "files": [
      "*.test.js",
      "*.spec.js"
    ]
  },
  "output": {
    "format": "json",
    "colors": false,
    "verbose": true
  }
}
```

### Custom Patterns Guide

When creating custom patterns, follow these guidelines:

#### Pattern Syntax
- Use standard JavaScript regex syntax
- Escape special characters: `\`, `(`, `)`, `[`, `]`, `{`, `}`, `+`, `*`, `?`, `^`, `$`, `|`, `.`
- Use character classes: `[A-Z]`, `[0-9]`, `[a-f]`
- Use quantifiers: `{32}`, `{20,40}`, `+`, `*`

#### Examples

**API Key Pattern:**
```json
{
  "patterns": {
    "custom": [
      "MYCOMPANY_API_[A-Z0-9]{32}"
    ]
  }
}
```

**Database Connection String:**
```json
{
  "patterns": {
    "custom": [
      "mongodb://[^\\s]+:[^\\s]+@[^\\s]+/[^\\s]+"
    ]
  }
}
```

**Internal Token:**
```json
{
  "patterns": {
    "custom": [
      "internal-token-[a-f0-9]{64}"
    ]
  }
}
```

## Configuration Validation

`seal-commit` validates configuration files and provides helpful error messages:

### Common Validation Errors

**Invalid regex pattern:**
```
Configuration validation failed:
patterns.custom[0]: invalid regex pattern "INVALID[" - Unterminated character class
```

**Invalid entropy threshold:**
```
Configuration validation failed:
entropy.threshold: value 10 is above maximum 8
```

**Invalid pattern name:**
```
Configuration validation failed:
patterns.enabled[0]: "invalid-pattern" is not a valid option. Valid options: aws-access-key, google-api-key, ...
```

### Testing Configuration

Test your configuration with:

```bash
# Test with specific config file
npx seal-commit --config .sealcommitrc.test.json --verbose

# Test on all files
npx seal-commit scan-all --config your-config.json
```

## Environment-Specific Configurations

### Monorepo Setup

For monorepos, place configuration at the root:

```json
{
  "ignore": {
    "directories": [
      "packages/*/node_modules",
      "apps/*/dist"
    ]
  }
}
```

### CI/CD Integration

For automated environments:

```json
{
  "output": {
    "format": "json",
    "colors": false,
    "verbose": true
  }
}
```

## Migration from Other Tools

### From detect-secrets

```python
# detect-secrets baseline
{
  "exclude": {
    "files": "package-lock.json|yarn.lock"
  }
}
```

Equivalent seal-commit config:
```json
{
  "ignore": {
    "files": [
      "package-lock.json",
      "yarn.lock"
    ]
  }
}
```

### From gitleaks

```toml
# gitleaks config
[allowlist]
paths = ["test/**/*"]
```

Equivalent seal-commit config:
```json
{
  "ignore": {
    "directories": ["test"]
  }
}
```

## Best Practices

1. **Start with defaults** - Use built-in patterns first
2. **Add custom patterns gradually** - Test each pattern thoroughly
3. **Use allowlist sparingly** - Only for known safe strings
4. **Tune entropy threshold** - Balance false positives vs detection
5. **Version control config** - Keep configuration in Git
6. **Test in CI** - Validate configuration in automated builds
7. **Document custom patterns** - Comment why each pattern is needed

## Troubleshooting Configuration

### High False Positive Rate

1. Increase entropy threshold
2. Add legitimate strings to allowlist
3. Disable problematic patterns
4. Adjust string length limits

### Missing Secrets

1. Check disabled patterns
2. Verify ignore rules
3. Lower entropy threshold
4. Add custom patterns

### Performance Issues

1. Reduce entropy max length
2. Add more ignore rules
3. Disable unused patterns
4. Use more specific file patterns