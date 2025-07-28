# Configuration Examples

This directory contains example configuration files for different use cases and environments.

## Available Examples

### `basic-config.json`
A minimal configuration suitable for most projects. Includes:
- Essential secret patterns (AWS, Google, Stripe, GitHub, JWT)
- Standard entropy settings
- Basic ignore rules for common files

**Use case:** Small to medium projects with standard requirements

### `strict-config.json`
A comprehensive configuration with strict security settings. Includes:
- All built-in patterns enabled
- Custom patterns for organization-specific secrets
- Higher entropy threshold for fewer false positives
- Extensive ignore rules
- Verbose output enabled

**Use case:** Production environments, security-critical projects

### `development-config.yaml`
A developer-friendly configuration optimized for development workflows. Includes:
- Relaxed entropy threshold
- Test file exclusions
- Development-specific allowlist
- Custom patterns for development tokens

**Use case:** Development environments, local testing

### `ci-config.json`
Configuration optimized for CI/CD pipelines. Includes:
- JSON output format for automated processing
- No colored output (CI-friendly)
- Verbose logging for debugging
- Production-focused patterns

**Use case:** Continuous integration, automated security scanning

### `monorepo-config.json`
Configuration tailored for monorepo structures. Includes:
- Workspace-specific patterns
- Multiple package manager support
- Nested directory ignore rules
- Shared secret patterns

**Use case:** Monorepos, multi-package projects

## Usage

Copy any example to your project root and rename it to `.sealcommitrc`:

```bash
# Use basic configuration
cp examples/basic-config.json .sealcommitrc

# Use YAML format
cp examples/development-config.yaml .sealcommitrc.yaml

# Use specific config file
npx seal-commit --config examples/strict-config.json
```

## Customization

Each example can be customized for your specific needs:

1. **Add custom patterns** for your organization's secrets
2. **Modify ignore rules** based on your project structure
3. **Adjust entropy settings** to balance detection vs false positives
4. **Update allowlist** with known safe strings

## Pattern Examples

### Custom API Key Patterns

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

### Database Connection Strings

```json
{
  "patterns": {
    "custom": [
      "mongodb://[^\\s]+:[^\\s]+@[^\\s]+",
      "postgres://[^\\s]+:[^\\s]+@[^\\s]+",
      "mysql://[^\\s]+:[^\\s]+@[^\\s]+"
    ]
  }
}
```

### Cloud Provider Specific

```json
{
  "patterns": {
    "custom": [
      "AZURE_[A-Z_]+_[A-Za-z0-9+/]{40,}",
      "GCP_[A-Z_]+_[A-Za-z0-9_-]{40,}",
      "HEROKU_[A-Z_]+_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"
    ]
  }
}
```

## Environment-Specific Settings

### Development
- Lower entropy threshold (3.5-4.0)
- More files in ignore list
- Extensive allowlist for test data
- Terminal output with colors

### Staging
- Medium entropy threshold (4.0-4.5)
- Moderate ignore rules
- Limited allowlist
- Both terminal and JSON output

### Production
- Higher entropy threshold (4.5+)
- Minimal ignore rules
- No allowlist or very limited
- JSON output for automation

## Testing Your Configuration

Before committing a new configuration:

```bash
# Test on staged files
npx seal-commit --config your-config.json

# Test on entire repository
npx seal-commit scan-all --config your-config.json --verbose

# Generate test report
npx seal-commit scan-all --config your-config.json --report test-report.json
```

## Common Patterns by Technology

### Node.js Projects
```json
{
  "ignore": {
    "files": ["package-lock.json", "yarn.lock", "*.min.js"],
    "directories": ["node_modules", "dist", "build"]
  }
}
```

### Python Projects
```json
{
  "ignore": {
    "files": ["requirements.txt", "Pipfile.lock", "poetry.lock"],
    "directories": ["__pycache__", "venv", ".venv", "dist"]
  }
}
```

### Java Projects
```json
{
  "ignore": {
    "files": ["pom.xml", "gradle.properties"],
    "directories": ["target", "build", ".gradle"]
  }
}
```

### Docker Projects
```json
{
  "ignore": {
    "files": ["Dockerfile*", "docker-compose*.yml"],
    "directories": [".docker"]
  },
  "patterns": {
    "custom": ["DOCKER_[A-Z_]+_[A-Za-z0-9]{20,}"]
  }
}
```

## Migration Examples

### From Other Secret Scanners

If migrating from other tools, here are equivalent configurations:

#### From detect-secrets
```python
# detect-secrets
{
  "exclude": {
    "files": "package-lock.json|yarn.lock",
    "lines": "password|secret"
  }
}
```

Equivalent seal-commit:
```json
{
  "ignore": {
    "files": ["package-lock.json", "yarn.lock"]
  },
  "allowlist": ["password", "secret"]
}
```

#### From gitleaks
```toml
# gitleaks
[allowlist]
paths = ["test/**/*", "docs/**/*"]
regexes = ["example-.*"]
```

Equivalent seal-commit:
```json
{
  "ignore": {
    "directories": ["test", "docs"]
  },
  "allowlist": ["example-key", "example-token"]
}
```

## Best Practices

1. **Start simple** - Begin with `basic-config.json` and customize
2. **Test thoroughly** - Run on your entire codebase before deploying
3. **Version control** - Keep configuration files in your repository
4. **Document changes** - Comment why specific patterns or rules were added
5. **Regular updates** - Review and update patterns as your project evolves
6. **Team alignment** - Ensure all team members use the same configuration

## Troubleshooting

### Too Many False Positives
- Increase `entropy.threshold`
- Add legitimate strings to `allowlist`
- Expand `ignore` rules
- Disable problematic patterns

### Missing Real Secrets
- Decrease `entropy.threshold`
- Check `ignore` rules aren't too broad
- Ensure patterns aren't disabled
- Add custom patterns for your secrets

### Performance Issues
- Reduce `entropy.maxLength`
- Add more specific `ignore` rules
- Disable unused patterns
- Use file extensions in ignore rules

For more detailed configuration documentation, see [CONFIGURATION.md](../CONFIGURATION.md).