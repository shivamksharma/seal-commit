#!/usr/bin/env node

/**
 * Bypass detection script for seal-commit
 * This script detects when Git hooks are bypassed using --no-verify
 * and logs the bypass event for audit purposes
 */

import { BypassDetector } from '../src/git/BypassDetector.js';
import { AuditLogger } from '../src/audit/AuditLogger.js';

async function main() {
  try {
    // Initialize bypass detector with audit logging enabled
    const detector = new BypassDetector({
      verbose: process.env.SEAL_COMMIT_VERBOSE === 'true',
      auditLogger: {
        enabled: true,
        includeContext: true
      }
    });

    // Check for bypass attempts
    const isBypassed = detector.detectBypass();

    if (isBypassed) {
      // Log additional bypass event details
      const auditLogger = new AuditLogger({ enabled: true });
      auditLogger.logEvent('BYPASS_DETECTION_TRIGGERED', {
        detectionScript: 'detect-bypass.js',
        timestamp: new Date().toISOString(),
        processInfo: {
          pid: process.pid,
          ppid: process.ppid,
          argv: process.argv,
          env: {
            USER: process.env.USER || process.env.USERNAME,
            PWD: process.env.PWD || process.cwd(),
            GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME,
            GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL
          }
        }
      }, 'HIGH');

      // Exit with error code to indicate bypass was detected
      process.exit(1);
    }

    // No bypass detected, exit successfully
    process.exit(0);

  } catch (error) {
    console.error(`Error in bypass detection: ${error.message}`);
    
    // Log the error but don't fail the commit process
    try {
      const auditLogger = new AuditLogger({ enabled: true });
      auditLogger.logEvent('BYPASS_DETECTION_ERROR', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }, 'MEDIUM');
    } catch (logError) {
      // Ignore logging errors
    }

    // Exit successfully to not block legitimate commits
    process.exit(0);
  }
}

// Run the main function
main();