/**
 * Seal-Commit v2 - Run Command (Staged Files Scanner)
 * 
 * Features:
 * - CI mode for hooks
 * - Dry-run mode
 * - Risk scoring
 * - Verbose output
 */

import fs from 'fs';
import path from 'path';
import { SecretDetector } from '../detector.js';
import { 
    log, 
    box, 
    assertGitRepo, 
    getIgnoreManager, 
    getStagedFiles,
    readFileSafe,
    isBinaryFile,
    verifySealignoreIntegrity,
    displayRiskScore,
    CONFIG
} from '../utils.js';

export function cmdRun(options = {}) {
    assertGitRepo();
    
    const stagedFiles = getStagedFiles();
    const ig = getIgnoreManager();
    const detector = new SecretDetector();
    
    // CI mode for pre-commit hooks
    const ciMode = options.ci || process.env.CI === 'true';
    const dryRun = options.dryRun || process.argv.includes('--dry-run');
    const verbose = options.verbose || process.env.DEBUG;
    
    if (ciMode) {
        log.dim('Running in CI mode...');
    }
    
    if (dryRun) {
        log.info('DRY RUN MODE - No changes will be made');
    }
    
    if (!ciMode && !dryRun) {
        const integrity = verifySealignoreIntegrity();
        if (!integrity.valid) {
            log.warn(integrity.message);
        }
    }
    
    if (stagedFiles.length === 0) {
        log.info('No files staged for commit.');
        return;
    }
    
    log.info('Scanning ' + stagedFiles.length + ' staged file(s)...');
    
    if (verbose) {
        log.debug('Files: ' + stagedFiles.join(', '));
    }
    
    const allFindings = [];
    
    for (const file of stagedFiles) {
        if (ig.ignores(file)) {
            if (verbose) {
                log.dim('  Ignored: ' + file);
            }
            continue;
        }
        
        const fullPath = path.resolve(file);
        
        if (!fs.existsSync(fullPath)) {
            continue;
        }
        
        if (isBinaryFile(fullPath)) {
            continue;
        }
        
        const content = readFileSafe(fullPath);
        if (content === null) {
            continue;
        }
        
        const findings = detector.scan(content, file, ig);
        
        if (findings.length > 0) {
            allFindings.push(...findings);
            
            for (const f of findings) {
                displayFinding(f, ciMode);
            }
        } else if (dryRun) {
            log.success('  Clean: ' + file);
        }
    }
    
    // Calculate risk score
    const riskScore = detector.calculateRiskScore(allFindings);
    
    if (allFindings.length > 0) {
        displayRiskScore(riskScore, allFindings);
        
        if (dryRun) {
            log.info('DRY RUN: Commit would be BLOCKED.');
            log.info('To fix, remove or replace detected secrets.');
        } else if (ciMode) {
            log.error('Secrets detected. Commit blocked.');
            process.exit(1);
        } else {
            log.error('COMMIT BLOCKED due to potential secrets.');
            console.log('\nOptions:');
            console.log('  seal-commit allow "<pattern>"  # Allow false positive');
            console.log('  git reset <file>              # Unstage file');
            process.exit(1);
        }
    } else {
        if (dryRun) {
            log.success('DRY RUN: No secrets found. Commit would proceed.');
        } else {
            log.success('No secrets found. Proceeding...');
        }
        
        if (!ciMode) {
            displayRiskScore(riskScore, allFindings);
        }
        
        process.exit(0);
    }
}

function displayFinding(finding, ciMode) {
    const severityColor = {
        critical: 'red',
        high: 'red',
        medium: 'yellow',
        low: 'cyan',
        info: 'dim'
    }[finding.severity] || 'red';
    
    const header = 'SECRET DETECTED: ' + finding.file;
    
    const details = [
        'Line: ' + finding.line,
        'Type: ' + finding.type,
        'Severity: ' + finding.severity.toUpperCase(),
        'Match: "' + finding.match + '"',
        '',
        'Why: ' + finding.message,
        '',
        'Fix: ' + finding.fix
    ];
    
    if (ciMode) {
        console.log('\n[' + finding.severity.toUpperCase() + '] ' + finding.file + ':' + finding.line);
        console.log('  Type: ' + finding.type);
        console.log('  Match: ' + finding.match);
    } else {
        box(header, details, severityColor);
    }
}
