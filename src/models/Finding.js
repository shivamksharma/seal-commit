/**
 * Finding model class for representing detected secrets
 * Handles validation, serialization, and display formatting
 */
export class Finding {
  constructor({
    type,           // 'pattern' | 'entropy'
    category,       // 'aws-key' | 'jwt' | 'high-entropy' etc.
    filePath,       // Relative path to file
    lineNumber,     // Line number (1-indexed)
    columnStart,    // Start column
    columnEnd,      // End column
    match,          // Full matched string
    truncatedMatch, // Truncated for display
    confidence,     // 0.0 - 1.0 confidence score
    context         // Surrounding lines for context
  }) {
    this.validateInputs({
      type,
      category,
      filePath,
      lineNumber,
      columnStart,
      columnEnd,
      match,
      truncatedMatch,
      confidence,
      context
    });

    this.type = type;
    this.category = category;
    this.filePath = filePath;
    this.lineNumber = lineNumber;
    this.columnStart = columnStart;
    this.columnEnd = columnEnd;
    this.match = match;
    this.truncatedMatch = truncatedMatch || this.truncateMatch(match);
    this.confidence = confidence;
    this.context = context || [];
    this.timestamp = new Date().toISOString();
  }

  /**
   * Validates constructor inputs
   */
  validateInputs({
    type,
    category,
    filePath,
    lineNumber,
    columnStart,
    columnEnd,
    match,
    confidence
  }) {
    // Required fields validation
    if (!type || typeof type !== 'string') {
      throw new Error('Finding type is required and must be a string');
    }

    if (!['pattern', 'entropy'].includes(type)) {
      throw new Error('Finding type must be either "pattern" or "entropy"');
    }

    if (!category || typeof category !== 'string') {
      throw new Error('Finding category is required and must be a string');
    }

    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Finding filePath is required and must be a string');
    }

    if (!Number.isInteger(lineNumber) || lineNumber < 1) {
      throw new Error('Finding lineNumber must be a positive integer');
    }

    if (!Number.isInteger(columnStart) || columnStart < 0) {
      throw new Error('Finding columnStart must be a non-negative integer');
    }

    if (!Number.isInteger(columnEnd) || columnEnd < columnStart) {
      throw new Error('Finding columnEnd must be an integer >= columnStart');
    }

    if (!match || typeof match !== 'string') {
      throw new Error('Finding match is required and must be a string');
    }

    if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
      throw new Error('Finding confidence must be a number between 0 and 1');
    }
  }

  /**
   * Truncates the match string for safe display
   */
  truncateMatch(match, maxLength = 20) {
    if (!match || match.length <= maxLength) {
      return match;
    }

    const halfLength = Math.floor((maxLength - 3) / 2);
    return `${match.substring(0, halfLength)}...${match.substring(match.length - halfLength)}`;
  }

  /**
   * Serializes the finding to JSON format for reports
   */
  toJSON() {
    return {
      type: this.type,
      category: this.category,
      filePath: this.filePath,
      lineNumber: this.lineNumber,
      columnStart: this.columnStart,
      columnEnd: this.columnEnd,
      match: this.match,
      truncatedMatch: this.truncatedMatch,
      confidence: this.confidence,
      context: this.context,
      timestamp: this.timestamp
    };
  }

  /**
   * Formats the finding for terminal display
   */
  toString() {
    const location = `${this.filePath}:${this.lineNumber}:${this.columnStart}`;
    const confidenceStr = this.confidence !== undefined ? ` (confidence: ${(this.confidence * 100).toFixed(1)}%)` : '';
    
    return `[${this.type.toUpperCase()}] ${this.category} detected at ${location}${confidenceStr}\n  Match: ${this.truncatedMatch}`;
  }

  /**
   * Gets a human-readable description of the finding
   */
  getDescription() {
    const typeDescriptions = {
      pattern: 'Pattern-based detection',
      entropy: 'High-entropy string detection'
    };

    return `${typeDescriptions[this.type]} found ${this.category} in ${this.filePath}`;
  }

  /**
   * Checks if this finding is equivalent to another finding
   */
  equals(other) {
    if (!(other instanceof Finding)) {
      return false;
    }

    return (
      this.type === other.type &&
      this.category === other.category &&
      this.filePath === other.filePath &&
      this.lineNumber === other.lineNumber &&
      this.columnStart === other.columnStart &&
      this.columnEnd === other.columnEnd &&
      this.match === other.match
    );
  }

  /**
   * Creates a hash key for deduplication
   */
  getHashKey() {
    return `${this.filePath}:${this.lineNumber}:${this.columnStart}:${this.columnEnd}:${this.match}`;
  }
}