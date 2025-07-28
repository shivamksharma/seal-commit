/**
 * EntropyEngine - High-entropy string detection engine
 * Detects potential secrets using Shannon entropy analysis
 */
export class EntropyEngine {
  constructor(options = {}) {
    this.threshold = options.threshold || 4.0;
    this.minLength = options.minLength || 20;
    this.maxLength = options.maxLength || 100;
    this.charsetFilters = options.charsetFilters || this.getDefaultCharsetFilters();
  }

  /**
   * Get default character set filters for entropy analysis
   * @returns {Object} Character set filter configuration
   */
  getDefaultCharsetFilters() {
    return {
      // Require at least some alphanumeric characters
      requireAlphanumeric: true,
      // Minimum percentage of alphanumeric characters
      minAlphanumericRatio: 0.5,
      // Allow special characters that commonly appear in secrets
      allowedSpecialChars: /[._\-+=\/]/,
      // Exclude strings that are mostly whitespace or common separators
      excludePatterns: [
        /^\s*$/,           // Only whitespace
        /^[.\-_=\/]+$/,    // Only separators
        /^[0-9]+$/,        // Only numbers
        /^[a-zA-Z]+$/      // Only letters (no mixed case complexity)
      ]
    };
  }

  /**
   * Calculate Shannon entropy of a string
   * @param {string} str - String to analyze
   * @returns {number} Shannon entropy value
   */
  calculateEntropy(str) {
    if (!str || str.length === 0) return 0;

    // Count character frequencies
    const charFreq = {};
    for (const char of str) {
      charFreq[char] = (charFreq[char] || 0) + 1;
    }

    // Calculate Shannon entropy
    let entropy = 0;
    const length = str.length;
    
    for (const count of Object.values(charFreq)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Extract potential secret candidates from content using heuristics
   * @param {string} content - Content to analyze
   * @returns {Array} Array of potential secret strings with metadata
   */
  extractCandidates(content) {
    const candidates = [];
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      // Extract strings from various contexts
      const extractors = [
        this.extractFromAssignments.bind(this),
        this.extractFromQuotedStrings.bind(this),
        this.extractFromEnvironmentVars.bind(this),
        this.extractFromBase64Like.bind(this),
        this.extractFromTokens.bind(this)
      ];

      for (const extractor of extractors) {
        const extracted = extractor(line, lineIndex);
        candidates.push(...extracted);
      }
    });

    return candidates;
  }

  /**
   * Extract strings from variable assignments
   * @param {string} line - Line to analyze
   * @param {number} lineIndex - Line index
   * @returns {Array} Extracted candidates
   */
  extractFromAssignments(line, lineIndex) {
    const candidates = [];
    // Match patterns like: key = "value", key: "value", key="value"
    const assignmentRegex = /(?:^|\s)([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*["']([^"']+)["']/g;
    
    let match;
    while ((match = assignmentRegex.exec(line)) !== null) {
      const [fullMatch, key, value] = match;
      if (this.isLikelySecretKey(key) && this.passesLengthFilter(value)) {
        candidates.push({
          value,
          context: 'assignment',
          key,
          lineIndex,
          columnStart: match.index + fullMatch.indexOf(value),
          columnEnd: match.index + fullMatch.indexOf(value) + value.length
        });
      }
    }

    return candidates;
  }

  /**
   * Extract strings from quoted contexts
   * @param {string} line - Line to analyze
   * @param {number} lineIndex - Line index
   * @returns {Array} Extracted candidates
   */
  extractFromQuotedStrings(line, lineIndex) {
    const candidates = [];
    // Match quoted strings
    const quotedRegex = /["']([^"']{20,100})["']/g;
    
    let match;
    while ((match = quotedRegex.exec(line)) !== null) {
      const [fullMatch, value] = match;
      if (this.passesCharsetFilter(value)) {
        candidates.push({
          value,
          context: 'quoted',
          lineIndex,
          columnStart: match.index + 1,
          columnEnd: match.index + 1 + value.length
        });
      }
    }

    return candidates;
  }

  /**
   * Extract strings from environment variable contexts
   * @param {string} line - Line to analyze
   * @param {number} lineIndex - Line index
   * @returns {Array} Extracted candidates
   */
  extractFromEnvironmentVars(line, lineIndex) {
    const candidates = [];
    // Match environment variable patterns
    const envRegex = /(?:export\s+|process\.env\.|ENV\[["']?)([A-Z_][A-Z0-9_]*)\s*[:=]\s*["']?([^"'\s]+)["']?/g;
    
    let match;
    while ((match = envRegex.exec(line)) !== null) {
      const [fullMatch, key, value] = match;
      if (this.isLikelySecretKey(key) && this.passesLengthFilter(value)) {
        candidates.push({
          value,
          context: 'environment',
          key,
          lineIndex,
          columnStart: match.index + fullMatch.indexOf(value),
          columnEnd: match.index + fullMatch.indexOf(value) + value.length
        });
      }
    }

    return candidates;
  }

  /**
   * Extract Base64-like strings
   * @param {string} line - Line to analyze
   * @param {number} lineIndex - Line index
   * @returns {Array} Extracted candidates
   */
  extractFromBase64Like(line, lineIndex) {
    const candidates = [];
    // Match Base64-like patterns
    const base64Regex = /[A-Za-z0-9+\/]{20,}={0,2}/g;
    
    let match;
    while ((match = base64Regex.exec(line)) !== null) {
      const value = match[0];
      if (this.passesLengthFilter(value) && this.isValidBase64Like(value)) {
        candidates.push({
          value,
          context: 'base64',
          lineIndex,
          columnStart: match.index,
          columnEnd: match.index + value.length
        });
      }
    }

    return candidates;
  }

  /**
   * Extract token-like strings
   * @param {string} line - Line to analyze
   * @param {number} lineIndex - Line index
   * @returns {Array} Extracted candidates
   */
  extractFromTokens(line, lineIndex) {
    const candidates = [];
    // Match token-like patterns (alphanumeric with some special chars)
    const tokenRegex = /[A-Za-z0-9._\-+=\/]{20,100}/g;
    
    let match;
    while ((match = tokenRegex.exec(line)) !== null) {
      const value = match[0];
      if (this.passesCharsetFilter(value) && !this.isCommonPattern(value)) {
        candidates.push({
          value,
          context: 'token',
          lineIndex,
          columnStart: match.index,
          columnEnd: match.index + value.length
        });
      }
    }

    return candidates;
  }

  /**
   * Check if a key name suggests it might contain a secret
   * @param {string} key - Key name to check
   * @returns {boolean} True if key suggests secret content
   */
  isLikelySecretKey(key) {
    const secretKeywords = [
      'key', 'secret', 'token', 'password', 'pass', 'auth', 'api',
      'credential', 'private', 'access', 'session', 'jwt', 'bearer',
      'oauth', 'client_secret', 'client_id'
    ];
    
    const lowerKey = key.toLowerCase();
    return secretKeywords.some(keyword => lowerKey.includes(keyword));
  }

  /**
   * Check if string passes length filters
   * @param {string} str - String to check
   * @returns {boolean} True if passes length filter
   */
  passesLengthFilter(str) {
    return str.length >= this.minLength && str.length <= this.maxLength;
  }

  /**
   * Check if string passes character set filters
   * @param {string} str - String to check
   * @returns {boolean} True if passes charset filter
   */
  passesCharsetFilter(str) {
    // Check exclude patterns first
    for (const pattern of this.charsetFilters.excludePatterns) {
      if (pattern.test(str)) return false;
    }

    // Check alphanumeric requirement
    if (this.charsetFilters.requireAlphanumeric) {
      const alphanumericCount = (str.match(/[A-Za-z0-9]/g) || []).length;
      const ratio = alphanumericCount / str.length;
      if (ratio < this.charsetFilters.minAlphanumericRatio) return false;
    }

    return true;
  }

  /**
   * Check if string is a valid Base64-like pattern
   * @param {string} str - String to check
   * @returns {boolean} True if valid Base64-like
   */
  isValidBase64Like(str) {
    // Base64 strings should have length divisible by 4 (with padding)
    // or be close to it
    const paddingCount = (str.match(/=/g) || []).length;
    const withoutPadding = str.replace(/=/g, '');
    
    // Check for invalid characters (anything not in Base64 alphabet)
    if (!/^[A-Za-z0-9+\/]*$/.test(withoutPadding)) {
      return false;
    }
    
    // Should be mostly Base64 characters
    const base64Chars = withoutPadding.match(/[A-Za-z0-9+\/]/g) || [];
    const ratio = base64Chars.length / withoutPadding.length;
    
    return ratio > 0.9 && paddingCount <= 2;
  }

  /**
   * Check if string matches common non-secret patterns
   * @param {string} str - String to check
   * @returns {boolean} True if matches common pattern
   */
  isCommonPattern(str) {
    const commonPatterns = [
      /^[0-9.]+$/,                    // Version numbers
      /^[a-f0-9]{32}$/,              // MD5 hashes (too predictable)
      /^localhost(:[0-9]+)?$/,       // Localhost URLs
      /^https?:\/\/example\.com/,    // Example URLs
      /^test[_-]?/i,                 // Test prefixes
      /^sample[_-]?/i,               // Sample prefixes
      /^demo[_-]?/i,                 // Demo prefixes
      /^placeholder/i,               // Placeholder text
      /^[.\-_=\/]+$/                 // Only separators
    ];

    return commonPatterns.some(pattern => pattern.test(str));
  }

  /**
   * Detect high-entropy strings in content
   * @param {string} content - Content to scan
   * @param {string} filePath - Path to the file being scanned
   * @returns {Array} Array of findings
   */
  detectHighEntropyStrings(content, filePath) {
    const findings = [];
    const lines = content.split('\n');
    const candidates = this.extractCandidates(content);

    for (const candidate of candidates) {
      const entropy = this.calculateEntropy(candidate.value);
      
      if (entropy >= this.threshold) {
        const finding = {
          type: 'entropy',
          category: 'high-entropy',
          name: 'high-entropy-string',
          description: `High-Entropy String Detected (entropy: ${entropy.toFixed(2)})`,
          filePath,
          lineNumber: candidate.lineIndex + 1,
          columnStart: candidate.columnStart + 1,
          columnEnd: candidate.columnEnd + 1,
          match: candidate.value,
          truncatedMatch: this.truncateMatch(candidate.value),
          confidence: this.calculateConfidence(entropy, candidate),
          entropy,
          context: this.getContext(lines, candidate.lineIndex),
          contextType: candidate.context,
          contextKey: candidate.key || null
        };
        
        findings.push(finding);
      }
    }

    return this.deduplicateFindings(findings);
  }

  /**
   * Get context lines around a finding
   * @param {Array} lines - Array of file lines
   * @param {number} lineIndex - Index of the line with the finding
   * @returns {Array} Array of context lines
   */
  getContext(lines, lineIndex) {
    const contextSize = 2;
    const before = lines.slice(Math.max(0, lineIndex - contextSize), lineIndex);
    const current = lines[lineIndex] || '';
    const after = lines.slice(lineIndex + 1, Math.min(lines.length, lineIndex + contextSize + 1));
    
    return [...before, current, ...after];
  }

  /**
   * Calculate confidence score based on entropy and context
   * @param {number} entropy - Entropy value
   * @param {Object} candidate - Candidate object with context
   * @returns {number} Confidence score (0.0 - 1.0)
   */
  calculateConfidence(entropy, candidate) {
    let confidence = Math.min((entropy - this.threshold) / (8.0 - this.threshold), 1.0);
    
    // Boost confidence based on context
    const contextBoosts = {
      'assignment': 0.1,
      'environment': 0.2,
      'base64': 0.15,
      'token': 0.05,
      'quoted': 0.05
    };
    
    confidence += contextBoosts[candidate.context] || 0;
    
    // Boost confidence if key name suggests secret
    if (candidate.key && this.isLikelySecretKey(candidate.key)) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
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
   * Update entropy threshold
   * @param {number} threshold - New threshold value
   */
  setThreshold(threshold) {
    this.threshold = threshold;
  }

  /**
   * Update length filters
   * @param {number} minLength - Minimum string length
   * @param {number} maxLength - Maximum string length
   */
  setLengthFilters(minLength, maxLength) {
    this.minLength = minLength;
    this.maxLength = maxLength;
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return {
      threshold: this.threshold,
      minLength: this.minLength,
      maxLength: this.maxLength,
      charsetFilters: this.charsetFilters
    };
  }
}