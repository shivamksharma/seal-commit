/**
 * PatternEngine - Regex-based secret detection engine
 * Detects secrets using predefined and custom regex patterns
 */
export class PatternEngine {
  constructor(customPatterns = []) {
    this.builtInPatterns = this.getBuiltInPatterns();
    this.customPatterns = customPatterns;
    this.compiledPatterns = this.compilePatterns();
  }

  /**
   * Get all built-in secret detection patterns
   * @returns {Array} Array of pattern objects
   */
  getBuiltInPatterns() {
    return [
      // AWS Patterns
      {
        name: 'aws-access-key',
        category: 'aws',
        pattern: /AKIA[0-9A-Z]{16}/g,
        confidence: 0.9,
        description: 'AWS Access Key ID'
      },
      {
        name: 'aws-secret-key',
        category: 'aws',
        pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)[\s]*[:=][\s]*['"]*([0-9a-zA-Z/+]{40})['"]*|(?:^|[^0-9a-zA-Z/+])[0-9a-zA-Z/+]{40}(?:[^0-9a-zA-Z/+]|$)/g,
        confidence: 0.8,
        description: 'AWS Secret Access Key'
      },
      {
        name: 'aws-session-token',
        category: 'aws',
        pattern: /(?:aws_session_token|AWS_SESSION_TOKEN)[\s]*[:=][\s]*['"]*([0-9a-zA-Z/+=]{100,})['"]*|AQoEXAMPLEH4aoAH0gNCAPyJxz4BlCFFxWNE1OPTgk5TthT\+FvwqnKwRcOIfrRh3c4VRrgVaVZNjyQjYgCOwuWdt8fGEzILiPZbm9eY\+qKOHGlcHXVtXN2s\+6NMq2G8YNnn4BISUdDPkkQf5G7tHc\+hXipVYn3jvv\+E5CgSgBrCfwqnKwRcOIfrRh3c4VRrgVaVZNjyQjYgCOwuWdt8fGEzILiPZbm9eY\+qKOHGlcHXVtXN2s\+6NMq2G8YNnn4BISUdDPkkQf5G7tHc\+hXipVYn3jvv\+E5CgSgBrCfwqnKwRcOIfrRh3c4VRrgVaVZNjyQjYgCOwuWdt8fGEzILiPZbm9eY\+qKOHGlcHXVtXN2s\+6NMq2G8YNnn4BISUdDPkkQf5G7tHc\+hXipVYn3jvv\+E5CgSgBrCf/g,
        confidence: 0.9,
        description: 'AWS Session Token'
      },

      // Google Patterns
      {
        name: 'google-api-key',
        category: 'google',
        pattern: /AIza[0-9A-Za-z\-_]{35}/g,
        confidence: 0.9,
        description: 'Google API Key'
      },
      {
        name: 'google-oauth-token',
        category: 'google',
        pattern: /ya29\.[0-9A-Za-z\-_]+/g,
        confidence: 0.9,
        description: 'Google OAuth Access Token'
      },
      {
        name: 'google-service-account',
        category: 'google',
        pattern: /"type":\s*"service_account"/g,
        confidence: 0.7,
        description: 'Google Service Account JSON'
      },

      // Stripe Patterns
      {
        name: 'stripe-secret-key',
        category: 'stripe',
        pattern: /sk_live_[0-9a-zA-Z]{24}/g,
        confidence: 0.95,
        description: 'Stripe Live Secret Key'
      },
      {
        name: 'stripe-publishable-key',
        category: 'stripe',
        pattern: /pk_live_[0-9a-zA-Z]{24}/g,
        confidence: 0.9,
        description: 'Stripe Live Publishable Key'
      },
      {
        name: 'stripe-test-secret-key',
        category: 'stripe',
        pattern: /sk_test_[0-9a-zA-Z]{24}/g,
        confidence: 0.8,
        description: 'Stripe Test Secret Key'
      },
      {
        name: 'stripe-test-publishable-key',
        category: 'stripe',
        pattern: /pk_test_[0-9a-zA-Z]{24}/g,
        confidence: 0.7,
        description: 'Stripe Test Publishable Key'
      },

      // GitHub Patterns
      {
        name: 'github-personal-token',
        category: 'github',
        pattern: /ghp_[0-9a-zA-Z]{36}/g,
        confidence: 0.95,
        description: 'GitHub Personal Access Token'
      },
      {
        name: 'github-oauth-token',
        category: 'github',
        pattern: /gho_[0-9a-zA-Z]{36}/g,
        confidence: 0.95,
        description: 'GitHub OAuth Access Token'
      },
      {
        name: 'github-user-token',
        category: 'github',
        pattern: /ghu_[0-9a-zA-Z]{36}/g,
        confidence: 0.95,
        description: 'GitHub User Access Token'
      },
      {
        name: 'github-server-token',
        category: 'github',
        pattern: /ghs_[0-9a-zA-Z]{36}/g,
        confidence: 0.95,
        description: 'GitHub Server Access Token'
      },
      {
        name: 'github-refresh-token',
        category: 'github',
        pattern: /ghr_[0-9a-zA-Z]{76}/g,
        confidence: 0.95,
        description: 'GitHub Refresh Token'
      },

      // Firebase Patterns
      {
        name: 'firebase-api-key',
        category: 'firebase',
        pattern: /(?:firebase|FIREBASE)[\s]*[:=][\s]*['"]*([A-Za-z0-9_-]{39})['"]*|AIza[0-9A-Za-z\-_]{35}/g,
        confidence: 0.8,
        description: 'Firebase API Key'
      },
      {
        name: 'firebase-database-url',
        category: 'firebase',
        pattern: /https:\/\/[a-z0-9-]+\.firebaseio\.com/g,
        confidence: 0.7,
        description: 'Firebase Database URL'
      },

      // JWT Patterns
      {
        name: 'jwt-token',
        category: 'jwt',
        pattern: /eyJ[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*/g,
        confidence: 0.8,
        description: 'JSON Web Token (JWT)'
      },

      // Bearer Token Patterns
      {
        name: 'bearer-token',
        category: 'bearer',
        pattern: /Bearer\s+[0-9a-zA-Z\-_=]+/gi,
        confidence: 0.7,
        description: 'Bearer Token'
      },
      {
        name: 'authorization-header',
        category: 'bearer',
        pattern: /Authorization:\s*Bearer\s+[0-9a-zA-Z\-_=]+/gi,
        confidence: 0.8,
        description: 'Authorization Bearer Header'
      },

      // Private Key Patterns
      {
        name: 'rsa-private-key',
        category: 'private-key',
        pattern: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/gm,
        confidence: 0.95,
        description: 'RSA Private Key'
      },
      {
        name: 'private-key',
        category: 'private-key',
        pattern: /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/gm,
        confidence: 0.95,
        description: 'Private Key'
      },
      {
        name: 'openssh-private-key',
        category: 'private-key',
        pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/gm,
        confidence: 0.95,
        description: 'OpenSSH Private Key'
      },
      {
        name: 'ec-private-key',
        category: 'private-key',
        pattern: /-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----/gm,
        confidence: 0.95,
        description: 'EC Private Key'
      },

      // Generic API Key Patterns
      {
        name: 'generic-api-key',
        category: 'generic',
        pattern: /(?:api[_-]?key|apikey|secret[_-]?key|secretkey)[\s]*[:=][\s]*['"]*([0-9a-zA-Z\-_]{20,})['"]/gi,
        confidence: 0.6,
        description: 'Generic API Key'
      },

      // Database Connection Strings
      {
        name: 'database-url',
        category: 'database',
        pattern: /(?:mongodb|mysql|postgresql|postgres):\/\/[^\s'"]+/gi,
        confidence: 0.8,
        description: 'Database Connection String'
      },

      // OAuth Patterns
      {
        name: 'oauth-token',
        category: 'oauth',
        pattern: /(?:access[_-]?token|accesstoken)[\s]*[:=][\s]*['"]*([0-9a-zA-Z\-_]{20,})['"]*|[0-9a-zA-Z\-_]{40,}/gi,
        confidence: 0.6,
        description: 'OAuth Access Token'
      }
    ];
  }

  /**
   * Compile all patterns (built-in and custom) for efficient matching
   * @returns {Array} Array of compiled pattern objects
   */
  compilePatterns() {
    const allPatterns = [...this.builtInPatterns, ...this.customPatterns];
    return allPatterns.map(pattern => ({
      ...pattern,
      regex: new RegExp(pattern.pattern.source, pattern.pattern.flags)
    }));
  }

  /**
   * Detect secrets in content using regex patterns
   * @param {string} content - Content to scan
   * @param {string} filePath - Path to the file being scanned
   * @returns {Array} Array of findings
   */
  detectSecrets(content, filePath) {
    const findings = [];
    const lines = content.split('\n');

    for (const pattern of this.compiledPatterns) {
      // Handle multiline patterns (like private keys) differently
      if (pattern.regex.flags.includes('m') && pattern.regex.source.includes('[\\s\\S]')) {
        // Process entire content for multiline patterns
        let match;
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        
        while ((match = regex.exec(content)) !== null) {
          // Find which line the match starts on
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;
          
          const finding = {
            type: 'pattern',
            category: pattern.category,
            name: pattern.name,
            description: pattern.description,
            filePath,
            lineNumber,
            columnStart: match.index - beforeMatch.lastIndexOf('\n'),
            columnEnd: match.index - beforeMatch.lastIndexOf('\n') + match[0].length,
            match: match[0],
            truncatedMatch: this.truncateMatch(match[0]),
            confidence: pattern.confidence,
            context: this.getContext(lines, lineNumber - 1)
          };
          
          findings.push(finding);
          
          // Prevent infinite loops with global regex
          if (!pattern.regex.global) break;
        }
      } else {
        // Process line by line for single-line patterns
        lines.forEach((line, lineIndex) => {
          let match;
          const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
          
          while ((match = regex.exec(line)) !== null) {
            const finding = {
              type: 'pattern',
              category: pattern.category,
              name: pattern.name,
              description: pattern.description,
              filePath,
              lineNumber: lineIndex + 1,
              columnStart: match.index + 1,
              columnEnd: match.index + match[0].length + 1,
              match: match[0],
              truncatedMatch: this.truncateMatch(match[0]),
              confidence: pattern.confidence,
              context: this.getContext(lines, lineIndex)
            };
            
            findings.push(finding);
            
            // Prevent infinite loops with global regex
            if (!pattern.regex.global) break;
          }
        });
      }
    }

    return this.deduplicateFindings(findings);
  }

  /**
   * Truncate match for safe display
   * @param {string} match - The matched string
   * @returns {string} Truncated match
   */
  truncateMatch(match) {
    if (match.length <= 20) return match;
    return match.substring(0, 10) + '...' + match.substring(match.length - 10);
  }

  /**
   * Get context lines around a finding
   * @param {Array} lines - All lines in the file
   * @param {number} lineIndex - Index of the line with the finding
   * @returns {Object} Context object with before and after lines
   */
  getContext(lines, lineIndex) {
    const contextSize = 2;
    const before = lines.slice(Math.max(0, lineIndex - contextSize), lineIndex);
    const current = lines[lineIndex] || '';
    const after = lines.slice(lineIndex + 1, Math.min(lines.length, lineIndex + contextSize + 1));
    
    return [...before, current, ...after];
  }

  /**
   * Remove duplicate findings based on file path, line number, and match
   * @param {Array} findings - Array of findings
   * @returns {Array} Deduplicated findings
   */
  deduplicateFindings(findings) {
    const seen = new Set();
    return findings.filter(finding => {
      const key = `${finding.filePath}:${finding.lineNumber}:${finding.match}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Get pattern by name
   * @param {string} name - Pattern name
   * @returns {Object|null} Pattern object or null if not found
   */
  getPattern(name) {
    return this.compiledPatterns.find(pattern => pattern.name === name) || null;
  }

  /**
   * Get patterns by category
   * @param {string} category - Pattern category
   * @returns {Array} Array of patterns in the category
   */
  getPatternsByCategory(category) {
    return this.compiledPatterns.filter(pattern => pattern.category === category);
  }

  /**
   * Get all available pattern categories
   * @returns {Array} Array of unique categories
   */
  getCategories() {
    return [...new Set(this.compiledPatterns.map(pattern => pattern.category))];
  }
}