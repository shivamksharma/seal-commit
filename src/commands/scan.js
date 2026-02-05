/**
 * Seal-Commit v2 - Scan Command (Full Project Scanner)
 * 
 * Features:
 * - Full project scanning
 * - Parallel processing
 * - CI mode
 * - History scanning
 */

import fs from 'fs';
import path from 'path';
import { SecretDetector } from '../detector.js';
import { 
    log, 
    box, 
    assertGitRepo, 
    getIgnoreManager,
    readFileSafe,
    isBinaryFile,
    displayRiskScore,
    CONFIG
} from '../utils.js';

function getAllFiles(dir, fileList = [], ig, rootDir) {
    try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            if (file === 'node_modules' || file === '.git' || file === 'dist' || 
                file === 'build' || file === '.sealignore') continue;
            
            const filePath = path.join(dir, file);
            const relativePath = path.relative(rootDir, filePath);
            
            if (ig.ignores(relativePath)) continue;
            
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                getAllFiles(filePath, fileList, ig, rootDir);
            } else if (!isBinaryFile(filePath)) {
                fileList.push(filePath);
            }
        }
    } catch (e) {
        // Directory may not be accessible
    }
    
    return fileList;
}

export async function cmdScan(options = {}) {
    assertGitRepo();
    
    const rootDir = process.cwd();
    const ig = getIgnoreManager();
    const detector = new SecretDetector();
    
    const target = options.args && options.args[0] || '.';
    const dryRun = options.dryRun;
    const ciMode = options.ci;
    const parallel = options.parallel !== false;
    
    log.title('Full Project Scan Initiated');
    
    let filesToScan = [];
    
    if (target === '.' || target === './') {
        filesToScan = getAllFiles(rootDir, [], ig, rootDir);
        log.info('Found ' + filesToScan.length + ' files to scan...');
    } else if (target.startsWith('--history')) {
        // Scan git history
        filesToScan = await scanGitHistory(ig, rootDir);
    } else {
        // Scan specific path
        const targetPath = path.resolve(target);
        if (fs.existsSync(targetPath)) {
            if (fs.statSync(targetPath).isDirectory()) {
                filesToScan = getAllFiles(targetPath, [], ig, rootDir);
            } else {
                filesToScan = [targetPath];
            }
        }
    }
    
    if (filesToScan.length === 0) {
        log.warn('No files found to scan.');
        return;
    }
    
    const allFindings = [];
    
    if (parallel && filesToScan.length > 10) {
        log.info('Using parallel scanning...');
        
        const batchSize = Math.min(10, filesToScan.length);
        for (let i = 0; i < filesToScan.length; i += batchSize) {
            const batch = filesToScan.slice(i, i + batchSize);
            
            const promises = batch.map(filePath => {
                const content = readFileSafe(filePath);
                if (!content) return Promise.resolve(null);
                
                const relativePath = path.relative(rootDir, filePath);
                return Promise.resolve({
                    filePath: relativePath,
                    findings: detector.scan(content, relativePath, ig)
                });
            });
            
            const results = await Promise.all(promises);
            
            for (const result of results) {
                if (result && result.findings.length > 0) {
                    allFindings.push(...result.findings);
                    result.findings.forEach(f => displayFinding(f, ciMode));
                }
            }
            
            log.info('Progress: ' + Math.min(i + batchSize, filesToScan.length) + '/' + filesToScan.length);
        }
    } else {
        // Sequential scanning
        for (let i = 0; i < filesToScan.length; i++) {
            const fullPath = filesToScan[i];
            
            const content = readFileSafe(fullPath);
            if (!content) continue;
            
            const relativePath = path.relative(rootDir, fullPath);
            const findings = detector.scan(content, relativePath, ig);
            
            if (findings.length > 0) {
                allFindings.push(...findings);
                findings.forEach(f => displayFinding(f, ciMode));
            }
            
            if (dryRun && i % 10 === 0) {
                log.info('Progress: ' + (i + 1) + '/' + filesToScan.length);
            }
        }
    }
    
    const riskScore = detector.calculateRiskScore(allFindings);
    
    if (allFindings.length > 0) {
        displayRiskScore(riskScore, allFindings);
        
        if (ciMode) {
            process.exit(1);
        }
        
        console.log('\nFound ' + allFindings.length + ' potential secret(s) in ' + 
                   new Set(allFindings.map(f => f.file)).size + ' file(s).');
        
        if (!dryRun) {
            console.log('\nOptions:');
            console.log('  seal-commit scan --dry-run    # Preview');
            console.log('  seal-commit allow "<pattern>"  # Allow false positive');
        }
        
        process.exit(1);
    } else {
        if (dryRun) {
            log.success('DRY RUN: No secrets found.');
        } else {
            log.success('Scan complete. No secrets found in ' + filesToScan.length + ' files.');
            displayRiskScore(riskScore, allFindings);
        }
        process.exit(0);
    }
}

async function scanGitHistory(ig, rootDir) {
    log.info('Scanning git history...');
    
    const { execSync } = require('child_process');
    const files = new Set();
    
    try {
        const output = execSync('git log --name-only --pretty=format:%h', { 
            encoding: 'utf-8',
            timeout: 60000
        });
        
        for (const line of output.split('\n')) {
            if (line && !line.match(/^[a-f0-9]{7}$/)) {
                const filePath = path.join(rootDir, line);
                if (fs.existsSync(filePath) && !isBinaryFile(filePath)) {
                    files.add(filePath);
                }
            }
        }
    } catch (e) {
        log.warn('Could not scan git history: ' + e.message);
    }
    
    const filesArray = Array.from(files);
    log.info('Found ' + filesArray.length + ' files in history...');
    
    return filesArray;
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
        'Match: "' + finding.match.substring(0, 40) + '"',
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
