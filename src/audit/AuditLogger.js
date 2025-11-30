import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * AuditLogger class for logging security-related events
 * Handles logging of secret detections, bypasses, and other audit events
 */
export class AuditLogger {
  constructor(options = {}) {
    this.enabled = options.enabled !== false; // Default to enabled
    this.logPath = options.logPath || this.getDefaultLogPath();
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB default
    this.maxLogFiles = options.maxLogFiles || 5;
    this.includeContext = options.includeContext !== false;
  }

  /**
   * Get the default log file path
   * @returns {string} Default log file path
   */
  getDefaultLogPath() {
    // Try to use project-specific log location first
    try {
      const projectRoot = process.cwd();
      const logDir = path.join(projectRoot, '.seal-commit');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      return path.join(logDir, 'audit.log');
    } catch (error) {
      // Fallback to user home directory
      const homeDir = os.homedir();
      const logDir = path.join(homeDir, '.seal-commit');
      
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      return path.join(logDir, 'audit.log');
    }
  }

  /**
   * Log a secret detection event
   * @param {Object} event - Event details
   * @param {ScanResult} scanResult - Scan results
   * @param {Object} context - Additional context
   */
  logSecretDetection(event, scanResult, context = {}) {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'SECRET_DETECTED',
      severity: 'HIGH',
      action: event.action || 'COMMIT_BLOCKED',
      summary: {
        totalSecrets: scanResult.findings.length,
        filesAffected: scanResult.groupByFile() ? Object.keys(scanResult.groupByFile()).length : 0,
        scanMode: context.scanMode || 'unknown'
      },
      environment: this.getEnvironmentInfo(),
      details: this.includeContext ? {
        findings: scanResult.findings.map(finding => ({
          type: finding.type,
          category: finding.category,
          filePath: finding.filePath,
          lineNumber: finding.lineNumber,
          confidence: finding.confidence,
          // Don't log the actual secret value for security
          hasMatch: !!finding.match
        })),
        scanStats: scanResult.getSummary()
      } : undefined
    };

    this.writeLogEntry(logEntry);
  }

  /**
   * Log a commit bypass event
   * @param {Object} event - Event details
   * @param {ScanResult} scanResult - Previous scan results that were bypassed
   * @param {Object} context - Additional context
   */
  logCommitBypass(event, scanResult = null, _context = {}) {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'COMMIT_BYPASS',
      severity: 'CRITICAL',
      action: 'SECURITY_CHECK_BYPASSED',
      warning: 'Secret detection was bypassed using --no-verify flag',
      bypassMethod: event.bypassMethod || 'no-verify',
      environment: this.getEnvironmentInfo(),
      previousDetection: scanResult ? {
        totalSecrets: scanResult.findings.length,
        filesAffected: scanResult.groupByFile() ? Object.keys(scanResult.groupByFile()).length : 0,
        detectedAt: event.previousDetectionTime || null
      } : null,
      details: this.includeContext && scanResult ? {
        bypassedFindings: scanResult.findings.map(finding => ({
          type: finding.type,
          category: finding.category,
          filePath: finding.filePath,
          lineNumber: finding.lineNumber,
          confidence: finding.confidence
        }))
      } : undefined
    };

    this.writeLogEntry(logEntry);
  }

  /**
   * Log a general audit event
   * @param {string} eventType - Type of event
   * @param {Object} details - Event details
   * @param {string} severity - Event severity (LOW, MEDIUM, HIGH, CRITICAL)
   */
  logEvent(eventType, details = {}, severity = 'MEDIUM') {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: eventType,
      severity: severity,
      environment: this.getEnvironmentInfo(),
      ...details
    };

    this.writeLogEntry(logEntry);
  }

  /**
   * Get environment information for audit context
   * @returns {Object} Environment information
   */
  getEnvironmentInfo() {
    return {
      user: os.userInfo().username,
      hostname: os.hostname(),
      platform: os.platform(),
      nodeVersion: process.version,
      workingDirectory: process.cwd(),
      gitBranch: this.getCurrentGitBranch(),
      timestamp: Date.now()
    };
  }

  /**
   * Get current Git branch if available
   * @returns {string|null} Current Git branch or null
   */
  getCurrentGitBranch() {
    try {
      const { execSync } = require('child_process');
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      return branch;
    } catch (error) {
      return null;
    }
  }

  /**
   * Write a log entry to the audit log file
   * @param {Object} logEntry - Log entry to write
   */
  writeLogEntry(logEntry) {
    try {
      // Rotate logs if necessary
      this.rotateLogsIfNeeded();

      // Format log entry as JSON line
      const logLine = JSON.stringify(logEntry) + '\n';

      // Append to log file
      fs.appendFileSync(this.logPath, logLine, 'utf8');
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.warn(`Warning: Failed to write audit log: ${error.message}`);
    }
  }

  /**
   * Rotate log files if they exceed size limits
   */
  rotateLogsIfNeeded() {
    try {
      if (!fs.existsSync(this.logPath)) {
        return;
      }

      const stats = fs.statSync(this.logPath);
      if (stats.size < this.maxLogSize) {
        return;
      }

      // Rotate existing log files
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldPath = `${this.logPath}.${i}`;
        const newPath = `${this.logPath}.${i + 1}`;
        
        if (fs.existsSync(oldPath)) {
          if (i === this.maxLogFiles - 1) {
            // Delete the oldest log file
            fs.unlinkSync(oldPath);
          } else {
            fs.renameSync(oldPath, newPath);
          }
        }
      }

      // Move current log to .1
      fs.renameSync(this.logPath, `${this.logPath}.1`);
    } catch (error) {
      console.warn(`Warning: Failed to rotate audit logs: ${error.message}`);
    }
  }

  /**
   * Read recent audit log entries
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Array of log entries
   */
  getRecentEntries(limit = 100) {
    if (!this.enabled || !fs.existsSync(this.logPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.logPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      // Parse JSON lines and return most recent entries
      const entries = lines
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (error) {
            return null;
          }
        })
        .filter(entry => entry !== null);

      return entries.reverse(); // Most recent first
    } catch (error) {
      console.warn(`Warning: Failed to read audit log: ${error.message}`);
      return [];
    }
  }

  /**
   * Get audit log statistics
   * @returns {Object} Log statistics
   */
  getLogStats() {
    if (!this.enabled || !fs.existsSync(this.logPath)) {
      return {
        enabled: this.enabled,
        logPath: this.logPath,
        exists: false,
        size: 0,
        entries: 0
      };
    }

    try {
      const stats = fs.statSync(this.logPath);
      const content = fs.readFileSync(this.logPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      return {
        enabled: this.enabled,
        logPath: this.logPath,
        exists: true,
        size: stats.size,
        entries: lines.length,
        lastModified: stats.mtime,
        maxLogSize: this.maxLogSize,
        maxLogFiles: this.maxLogFiles
      };
    } catch (error) {
      return {
        enabled: this.enabled,
        logPath: this.logPath,
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Clear the audit log
   */
  clearLog() {
    if (!this.enabled) return;

    try {
      if (fs.existsSync(this.logPath)) {
        fs.unlinkSync(this.logPath);
      }
      
      // Also remove rotated log files
      for (let i = 1; i <= this.maxLogFiles; i++) {
        const rotatedPath = `${this.logPath}.${i}`;
        if (fs.existsSync(rotatedPath)) {
          fs.unlinkSync(rotatedPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to clear audit log: ${error.message}`);
    }
  }

  /**
   * Update logger configuration
   * @param {Object} newOptions - New configuration options
   */
  updateConfig(newOptions) {
    this.enabled = newOptions.enabled !== undefined ? newOptions.enabled : this.enabled;
    this.logPath = newOptions.logPath || this.logPath;
    this.maxLogSize = newOptions.maxLogSize || this.maxLogSize;
    this.maxLogFiles = newOptions.maxLogFiles || this.maxLogFiles;
    this.includeContext = newOptions.includeContext !== undefined ? newOptions.includeContext : this.includeContext;
  }
}