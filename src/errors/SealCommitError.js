/**
 * Custom error class for seal-commit specific errors
 * Provides structured error handling with error codes and additional context
 */
export class SealCommitError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SealCommitError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SealCommitError);
    }
  }

  /**
   * Converts the error to a JSON representation
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Formats the error for terminal display
   * @returns {string} Formatted error message
   */
  toString() {
    const codeStr = this.code ? ` [${this.code}]` : '';
    let output = `❌ ${this.name}${codeStr}: ${this.message}`;
    
    if (Object.keys(this.details).length > 0) {
      output += '\n📋 Details:';
      Object.entries(this.details).forEach(([key, value]) => {
        output += `\n  ${key}: ${value}`;
      });
    }
    
    return output;
  }

  /**
   * Checks if this error matches a specific error code
   * @param {string} code - Error code to check against
   * @returns {boolean} True if codes match
   */
  hasCode(code) {
    return this.code === code;
  }

  /**
   * Gets a user-friendly description of the error
   * @returns {string} User-friendly error description
   */
  getUserMessage() {
    const descriptions = {
      [ErrorCodes.CONFIG_INVALID]: 'Configuration file is invalid or malformed',
      [ErrorCodes.CONFIG_NOT_FOUND]: 'Configuration file could not be found',
      [ErrorCodes.GIT_NOT_FOUND]: 'Git repository not found in current directory',
      [ErrorCodes.GIT_COMMAND_FAILED]: 'Git command execution failed',
      [ErrorCodes.HOOK_INSTALL_FAILED]: 'Failed to install Git pre-commit hook',
      [ErrorCodes.HOOK_ALREADY_EXISTS]: 'Git pre-commit hook already exists',
      [ErrorCodes.FILE_ACCESS_DENIED]: 'Permission denied accessing file or directory',
      [ErrorCodes.FILE_NOT_FOUND]: 'Required file could not be found',
      [ErrorCodes.FILE_READ_ERROR]: 'Error reading file contents',
      [ErrorCodes.PATTERN_COMPILE_ERROR]: 'Failed to compile regex pattern',
      [ErrorCodes.PATTERN_INVALID]: 'Invalid regex pattern provided',
      [ErrorCodes.ENTROPY_CALCULATION_ERROR]: 'Error calculating string entropy',
      [ErrorCodes.SCAN_INTERRUPTED]: 'Scan operation was interrupted',
      [ErrorCodes.SCAN_TIMEOUT]: 'Scan operation timed out',
      [ErrorCodes.OUTPUT_WRITE_ERROR]: 'Failed to write output file',
      [ErrorCodes.DEPENDENCY_MISSING]: 'Required dependency is missing',
      [ErrorCodes.VALIDATION_ERROR]: 'Input validation failed',
      [ErrorCodes.UNKNOWN_ERROR]: 'An unknown error occurred'
    };

    return descriptions[this.code] || this.message;
  }
}

/**
 * Predefined error codes for different categories of errors
 */
export const ErrorCodes = {
  // Configuration errors
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  
  // Git integration errors
  GIT_NOT_FOUND: 'GIT_NOT_FOUND',
  GIT_COMMAND_FAILED: 'GIT_COMMAND_FAILED',
  HOOK_INSTALL_FAILED: 'HOOK_INSTALL_FAILED',
  HOOK_ALREADY_EXISTS: 'HOOK_ALREADY_EXISTS',
  
  // File system errors
  FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  
  // Pattern and scanning errors
  PATTERN_COMPILE_ERROR: 'PATTERN_COMPILE_ERROR',
  PATTERN_INVALID: 'PATTERN_INVALID',
  ENTROPY_CALCULATION_ERROR: 'ENTROPY_CALCULATION_ERROR',
  
  // Runtime errors
  SCAN_INTERRUPTED: 'SCAN_INTERRUPTED',
  SCAN_TIMEOUT: 'SCAN_TIMEOUT',
  OUTPUT_WRITE_ERROR: 'OUTPUT_WRITE_ERROR',
  DEPENDENCY_MISSING: 'DEPENDENCY_MISSING',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Generic error
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Error handling strategies for different error categories
 */
export const ErrorHandlingStrategies = {
  // Configuration errors - usually require user intervention
  [ErrorCodes.CONFIG_INVALID]: {
    severity: 'error',
    recoverable: false,
    suggestion: 'Check your .sealcommitrc file for syntax errors'
  },
  [ErrorCodes.CONFIG_NOT_FOUND]: {
    severity: 'warning',
    recoverable: true,
    suggestion: 'Using default configuration. Create .sealcommitrc to customize'
  },
  
  // Git errors - may be recoverable depending on context
  [ErrorCodes.GIT_NOT_FOUND]: {
    severity: 'error',
    recoverable: false,
    suggestion: 'Initialize a Git repository or run from within a Git repository'
  },
  [ErrorCodes.GIT_COMMAND_FAILED]: {
    severity: 'error',
    recoverable: false,
    suggestion: 'Ensure Git is installed and repository is in a valid state'
  },
  [ErrorCodes.HOOK_INSTALL_FAILED]: {
    severity: 'error',
    recoverable: true,
    suggestion: 'Try running with elevated permissions or install hooks manually'
  },
  [ErrorCodes.HOOK_ALREADY_EXISTS]: {
    severity: 'warning',
    recoverable: true,
    suggestion: 'Existing hook detected. Use --force to overwrite'
  },
  
  // File system errors - may be temporary
  [ErrorCodes.FILE_ACCESS_DENIED]: {
    severity: 'error',
    recoverable: true,
    suggestion: 'Check file permissions or run with appropriate privileges'
  },
  [ErrorCodes.FILE_NOT_FOUND]: {
    severity: 'error',
    recoverable: false,
    suggestion: 'Ensure the required file exists and path is correct'
  },
  [ErrorCodes.FILE_READ_ERROR]: {
    severity: 'warning',
    recoverable: true,
    suggestion: 'File may be corrupted or temporarily locked. Try again'
  },
  
  // Pattern errors - usually configuration issues
  [ErrorCodes.PATTERN_COMPILE_ERROR]: {
    severity: 'error',
    recoverable: false,
    suggestion: 'Check regex patterns in configuration for syntax errors'
  },
  [ErrorCodes.PATTERN_INVALID]: {
    severity: 'error',
    recoverable: false,
    suggestion: 'Provide a valid regex pattern'
  },
  
  // Runtime errors - may be recoverable
  [ErrorCodes.ENTROPY_CALCULATION_ERROR]: {
    severity: 'warning',
    recoverable: true,
    suggestion: 'Skipping entropy analysis for problematic content'
  },
  [ErrorCodes.SCAN_INTERRUPTED]: {
    severity: 'warning',
    recoverable: true,
    suggestion: 'Scan was interrupted. Results may be incomplete'
  },
  [ErrorCodes.SCAN_TIMEOUT]: {
    severity: 'warning',
    recoverable: true,
    suggestion: 'Scan timed out. Consider reducing scope or increasing timeout'
  },
  [ErrorCodes.OUTPUT_WRITE_ERROR]: {
    severity: 'error',
    recoverable: true,
    suggestion: 'Check output directory permissions and available disk space'
  },
  [ErrorCodes.DEPENDENCY_MISSING]: {
    severity: 'error',
    recoverable: false,
    suggestion: 'Install missing dependencies using npm install'
  },
  [ErrorCodes.VALIDATION_ERROR]: {
    severity: 'error',
    recoverable: false,
    suggestion: 'Check input parameters and try again'
  },
  [ErrorCodes.UNKNOWN_ERROR]: {
    severity: 'error',
    recoverable: false,
    suggestion: 'An unexpected error occurred. Please report this issue'
  }
};

/**
 * Factory functions for creating common errors
 */
export const ErrorFactory = {
  /**
   * Creates a configuration error
   */
  configError(message, details = {}) {
    return new SealCommitError(message, ErrorCodes.CONFIG_INVALID, details);
  },

  /**
   * Creates a Git-related error
   */
  gitError(message, details = {}) {
    return new SealCommitError(message, ErrorCodes.GIT_COMMAND_FAILED, details);
  },

  /**
   * Creates a file system error
   */
  fileError(message, details = {}) {
    return new SealCommitError(message, ErrorCodes.FILE_READ_ERROR, details);
  },

  /**
   * Creates a pattern compilation error
   */
  patternError(message, details = {}) {
    return new SealCommitError(message, ErrorCodes.PATTERN_COMPILE_ERROR, details);
  },

  /**
   * Creates a validation error
   */
  validationError(message, details = {}) {
    return new SealCommitError(message, ErrorCodes.VALIDATION_ERROR, details);
  },

  /**
   * Creates a generic error with unknown code
   */
  unknownError(message, details = {}) {
    return new SealCommitError(message, ErrorCodes.UNKNOWN_ERROR, details);
  }
};

/**
 * Error handler utility for consistent error processing
 */
export class ErrorHandler {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.exitOnError = options.exitOnError !== false; // Default to true
  }

  /**
   * Handles an error based on its type and strategy
   * @param {Error} error - The error to handle
   * @param {Object} context - Additional context for error handling
   */
  handle(error, context = {}) {
    const sealError = error instanceof SealCommitError ? error : this.wrapError(error);
    const strategy = ErrorHandlingStrategies[sealError.code] || ErrorHandlingStrategies[ErrorCodes.UNKNOWN_ERROR];
    
    // Log the error
    this.logError(sealError, strategy, context);
    
    // Determine if we should exit
    if (this.exitOnError && strategy.severity === 'error' && !strategy.recoverable) {
      process.exit(1);
    }
    
    return {
      error: sealError,
      strategy,
      shouldExit: strategy.severity === 'error' && !strategy.recoverable
    };
  }

  /**
   * Wraps a generic error in a SealCommitError
   * @param {Error} error - The error to wrap
   * @returns {SealCommitError} Wrapped error
   */
  wrapError(error) {
    return new SealCommitError(
      error.message || 'Unknown error occurred',
      ErrorCodes.UNKNOWN_ERROR,
      {
        originalError: error.name,
        stack: error.stack
      }
    );
  }

  /**
   * Logs an error with appropriate formatting
   * @param {SealCommitError} error - The error to log
   * @param {Object} strategy - Error handling strategy
   * @param {Object} context - Additional context
   */
  logError(error, strategy, context) {
    const prefix = strategy.severity === 'error' ? '❌' : '⚠️';
    
    console.error(`${prefix} ${error.toString()}`);
    
    if (strategy.suggestion) {
      console.error(`💡 Suggestion: ${strategy.suggestion}`);
    }
    
    if (this.verbose && error.stack) {
      console.error('\n📋 Stack trace:');
      console.error(error.stack);
    }
    
    if (context.file) {
      console.error(`📁 File: ${context.file}`);
    }
    
    if (context.operation) {
      console.error(`⚙️ Operation: ${context.operation}`);
    }
  }

  /**
   * Handles multiple errors in batch
   * @param {Error[]} errors - Array of errors to handle
   * @param {Object} context - Shared context for all errors
   */
  handleBatch(errors, context = {}) {
    const results = errors.map(error => this.handle(error, context));
    
    const criticalErrors = results.filter(result => result.shouldExit);
    
    if (criticalErrors.length > 0 && this.exitOnError) {
      console.error(`\n❌ ${criticalErrors.length} critical error(s) encountered. Exiting.`);
      process.exit(1);
    }
    
    return results;
  }
}