import fs from 'fs';
import path from 'path';
import { AuditLogger } from '../audit/AuditLogger.js';

/**
 * BypassDetector class for detecting when Git hooks are bypassed
 * Monitors for --no-verify usage and logs bypass events
 */
export class BypassDetector {
  constructor(options = {}) {
    this.auditLogger = new AuditLogger(options.auditLogger || {});
    this.verbose = options.verbose || false;
  }

  /**
   * Check if the current commit is being bypassed
   * This is called from the pre-commit hook to detect bypass attempts
   * @returns {boolean} True if bypass is detected
   */
  detectBypass() {
    // Check various indicators that --no-verify might be in use
    const bypassIndicators = [
      this.checkProcessArguments(),
      this.checkEnvironmentVariables(),
      this.checkGitHookContext()
    ];

    const isBypassed = bypassIndicators.some(indicator => indicator.bypassed);
    
    if (isBypassed) {
      const bypassMethod = bypassIndicators.find(indicator => indicator.bypassed)?.method || 'unknown';
      this.logBypassAttempt(bypassMethod);
      this.displayBypassWarning(bypassMethod);
    }

    return isBypassed;
  }

  /**
   * Check process arguments for bypass indicators
   * @returns {Object} Bypass detection result
   */
  checkProcessArguments() {
    const args = process.argv.join(' ');
    
    // Look for --no-verify in the command line
    if (args.includes('--no-verify') || args.includes('-n')) {
      return {
        bypassed: true,
        method: 'no-verify-flag',
        details: 'Detected --no-verify flag in process arguments'
      };
    }

    return { bypassed: false };
  }

  /**
   * Check environment variables for bypass indicators
   * @returns {Object} Bypass detection result
   */
  checkEnvironmentVariables() {
    // Git sets specific environment variables during hook execution
    const gitHookEnvVars = [
      'GIT_AUTHOR_NAME',
      'GIT_AUTHOR_EMAIL',
      'GIT_COMMITTER_NAME',
      'GIT_COMMITTER_EMAIL'
    ];

    // Check if we're in a Git hook context but with bypass indicators
    const inGitContext = gitHookEnvVars.some(envVar => process.env[envVar]);
    
    if (inGitContext) {
      // Check for bypass-related environment variables
      if (process.env.GIT_SKIP_HOOKS === '1' || process.env.HUSKY_SKIP_HOOKS === '1') {
        return {
          bypassed: true,
          method: 'environment-variable',
          details: 'Detected hook skip environment variable'
        };
      }
    }

    return { bypassed: false };
  }

  /**
   * Check Git hook execution context for bypass indicators
   * @returns {Object} Bypass detection result
   */
  checkGitHookContext() {
    try {
      // Check if we're being called from a Git hook
      const isInHook = process.env.HUSKY_GIT_PARAMS || 
                      process.env.GIT_PARAMS || 
                      process.cwd().includes('.git/hooks');

      if (!isInHook) {
        // If we're not in a hook context but should be (for a commit),
        // this might indicate a bypass
        const parentProcess = this.getParentProcessInfo();
        if (parentProcess && parentProcess.includes('git commit')) {
          return {
            bypassed: true,
            method: 'hook-bypass',
            details: 'Git commit detected without proper hook execution'
          };
        }
      }

      return { bypassed: false };
    } catch (error) {
      // If we can't determine the context, assume no bypass
      return { bypassed: false };
    }
  }

  /**
   * Get information about the parent process
   * @returns {string|null} Parent process information
   */
  getParentProcessInfo() {
    try {
      const { execSync } = require('child_process');
      
      // Try to get parent process information (Unix-like systems)
      if (process.platform !== 'win32') {
        const ppid = process.ppid;
        if (ppid) {
          const psOutput = execSync(`ps -p ${ppid} -o comm=`, { 
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
          }).trim();
          return psOutput;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Log a bypass attempt
   * @param {string} bypassMethod - Method used to bypass
   */
  logBypassAttempt(bypassMethod) {
    // Try to get the previous scan results if available
    const previousScanResult = this.getPreviousScanResult();
    
    this.auditLogger.logCommitBypass(
      {
        bypassMethod,
        previousDetectionTime: previousScanResult?.timestamp || null
      },
      previousScanResult?.scanResult || null,
      {
        detectionMethod: 'pre-commit-hook',
        timestamp: new Date().toISOString()
      }
    );

    if (this.verbose) {
      console.log(`[BypassDetector] Logged bypass attempt using method: ${bypassMethod}`);
    }
  }

  /**
   * Display warning message when bypass is detected
   * @param {string} bypassMethod - Method used to bypass
   */
  displayBypassWarning(bypassMethod) {
    const warningMessage = this.formatBypassWarning(bypassMethod);
    console.error(warningMessage);
  }

  /**
   * Format bypass warning message
   * @param {string} bypassMethod - Method used to bypass
   * @returns {string} Formatted warning message
   */
  formatBypassWarning(bypassMethod) {
    const timestamp = new Date().toISOString();
    
    let warning = '\n🚨 SECURITY WARNING: Git Hook Bypass Detected 🚨\n';
    warning += '═'.repeat(60) + '\n';
    warning += `Timestamp: ${timestamp}\n`;
    warning += `Bypass Method: ${bypassMethod}\n`;
    warning += `User: ${process.env.USER || process.env.USERNAME || 'unknown'}\n`;
    warning += `Working Directory: ${process.cwd()}\n\n`;
    
    warning += '⚠️  You are bypassing secret detection security checks!\n';
    warning += '⚠️  This action has been logged for audit purposes.\n';
    warning += '⚠️  Ensure no secrets are being committed to the repository.\n\n';
    
    warning += 'If this bypass was intentional and necessary:\n';
    warning += '• Review your changes carefully for any sensitive information\n';
    warning += '• Consider using .gitignore or .sealcommitrc to exclude files\n';
    warning += '• Document the reason for bypassing in your commit message\n\n';
    
    warning += 'If this bypass was unintentional:\n';
    warning += '• Cancel this commit (Ctrl+C)\n';
    warning += '• Run "git commit" without --no-verify to enable security checks\n';
    warning += '• Review and fix any detected secrets before committing\n\n';
    
    warning += '═'.repeat(60) + '\n';
    
    return warning;
  }

  /**
   * Get previous scan result from temporary storage
   * This helps correlate bypass events with previous secret detections
   * @returns {Object|null} Previous scan result or null
   */
  getPreviousScanResult() {
    try {
      const tempDir = path.join(process.cwd(), '.seal-commit');
      const tempFile = path.join(tempDir, 'last-scan.json');
      
      if (fs.existsSync(tempFile)) {
        const content = fs.readFileSync(tempFile, 'utf8');
        const data = JSON.parse(content);
        
        // Check if the scan result is recent (within last 5 minutes)
        const scanTime = new Date(data.timestamp);
        const now = new Date();
        const timeDiff = now - scanTime;
        
        if (timeDiff < 5 * 60 * 1000) { // 5 minutes
          return data;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store scan result for potential bypass correlation
   * @param {ScanResult} scanResult - Scan result to store
   */
  storeScanResult(scanResult) {
    try {
      const tempDir = path.join(process.cwd(), '.seal-commit');
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFile = path.join(tempDir, 'last-scan.json');
      const data = {
        timestamp: new Date().toISOString(),
        scanResult: {
          hasSecrets: scanResult.hasSecrets,
          findings: scanResult.findings.map(finding => ({
            type: finding.type,
            category: finding.category,
            filePath: finding.filePath,
            lineNumber: finding.lineNumber,
            confidence: finding.confidence
          }))
        }
      };
      
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      // Don't fail if we can't store the scan result
      if (this.verbose) {
        console.warn(`Warning: Could not store scan result: ${error.message}`);
      }
    }
  }

  /**
   * Clean up temporary files
   */
  cleanup() {
    try {
      const tempDir = path.join(process.cwd(), '.seal-commit');
      const tempFile = path.join(tempDir, 'last-scan.json');
      
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Create a bypass detection script for integration with Git hooks
   * @param {string} outputPath - Path where to write the detection script
   */
  static createBypassDetectionScript(outputPath) {
    const script = `#!/usr/bin/env node

// Bypass detection script for seal-commit
// This script is called to detect when Git hooks are bypassed

import { BypassDetector } from './src/git/BypassDetector.js';

const detector = new BypassDetector({
  verbose: process.env.SEAL_COMMIT_VERBOSE === 'true',
  auditLogger: {
    enabled: true
  }
});

// Detect and handle bypass attempts
const isBypassed = detector.detectBypass();

// Exit with appropriate code
process.exit(isBypassed ? 1 : 0);
`;

    fs.writeFileSync(outputPath, script, 'utf8');
    
    // Make the script executable (Unix-like systems)
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(outputPath, '755');
      } catch (error) {
        console.warn(`Warning: Could not make bypass detection script executable: ${error.message}`);
      }
    }
  }
}