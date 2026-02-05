/**
 * Seal-Commit v2 - Utility Functions
 * 
 * Features:
 * - Cross-platform utilities
 * - Git integration
 * - File handling with caching
 * - Security utilities
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ignore from 'ignore';
import pc from 'picocolors';
import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const CONFIG = {
    // Default ignores
    defaultIgnores: [
        '.git',
        'node_modules',
        'dist',
        'build',
        'coverage',
        '.DS_Store',
        '*.lock',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'seal-commit.js',
        '.sealignore',
        '.gitignore',
        '.eslintrc',
        '.prettierrc',
        '*.min.js',
        '*.min.css',
        '*.map',
        '*.log',
        '.seal-cache'
    ],
    
    // Maximum file size (10MB)
    maxFileSize: 10 * 1024 * 1024,
    
    // Timeout for operations (30 seconds)
    timeout: 30000,
    
    // Number of parallel workers
    maxWorkers: 4,
    
    // Config file name
    configFile: '.sealconfig.json'
};

// ============================================================================
// LOGGING
// ============================================================================

export const log = {
    info: (msg) => console.log(pc.cyan('ℹ ') + msg),
    success: (msg) => console.log(pc.green('✔ ') + msg),
    warn: (msg) => console.log(pc.yellow('⚠ ') + msg),
    error: (msg) => console.log(pc.red('✖ ') + msg),
    title: (msg) => console.log(pc.bold(pc.magenta(`\n🦭 ${msg}\n`))),
    dim: (msg) => console.log(pc.dim(msg)),
    debug: (msg) => {
        if (process.env.DEBUG) {
            console.log(pc.gray(`[DEBUG] ${msg}`));
        }
    }
};

// ============================================================================
// BOX DISPLAY
// ============================================================================

export function box(title, content, color = 'red') {
    const line = '─'.repeat(50);
    const borderColor = pc[color] || pc.red;
    
    console.log(borderColor(`\n┌─ ${title} ${line.slice(title.length + 1)}`));
    content.forEach(c => console.log(borderColor(`│ ${c}`)));
    console.log(borderColor(`└${line}─`));
}

// ============================================================================
// RISK DISPLAY
// ============================================================================

export function displayRiskScore(score, findings) {
    const colors = {
        critical: pc.red,
        high: pc.orange,
        medium: pc.yellow,
        low: pc.cyan,
        info: pc.dim
    };
    
    let level = 'SAFE';
    if (score >= 20) level = 'CRITICAL';
    else if (score >= 10) level = 'HIGH';
    else if (score >= 5) level = 'MEDIUM';
    else if (score >= 1) level = 'LOW';
    
    const levelColor = {
        'SAFE': pc.green,
        'LOW': pc.cyan,
        'MEDIUM': pc.yellow,
        'HIGH': pc.orange,
        'CRITICAL': pc.red
    }[level];
    
    console.log('\n' + '='.repeat(60));
    console.log(levelColor(`  Risk Level: ${level}`));
    console.log(pc.dim(`  Score: ${score}`));
    console.log(pc.dim(`  Findings: ${findings.length}`));
    console.log('='.repeat(60) + '\n');
}

// ============================================================================
// GIT UTILITIES
// ============================================================================

export function isGitRepo() {
    try {
        execSync('git rev-parse --is-inside-work-tree', { 
            stdio: 'ignore',
            timeout: CONFIG.timeout
        });
        return true;
    } catch (e) {
        return false;
    }
}

export function assertGitRepo() {
    if (!isGitRepo()) {
        log.error('This command must be run inside a Git repository.');
        log.info('Please initialize git using "git init" or navigate to a valid repository.');
        process.exit(1);
    }
}

export function getGitRoot() {
    try {
        return execSync('git rev-parse --show-toplevel', { 
            encoding: 'utf-8',
            timeout: CONFIG.timeout
        }).trim();
    } catch (e) {
        return process.cwd();
    }
}

export function getStagedFiles() {
    try {
        const output = execSync('git diff --cached --name-only', { 
            encoding: 'utf-8',
            timeout: CONFIG.timeout
        });
        return output.split('\n').filter(f => f.trim() !== '');
    } catch (e) {
        return [];
    }
}

export function getAllTrackedFiles() {
    try {
        const output = execSync('git ls-files', { 
            encoding: 'utf-8',
            timeout: CONFIG.timeout
        });
        return output.split('\n').filter(f => f.trim() !== '');
    } catch (e) {
        return [];
    }
}

export function getDiffForFile(filePath) {
    try {
        return execSync(`git diff --cached ${filePath}`, { 
            encoding: 'utf-8',
            timeout: CONFIG.timeout
        });
    } catch (e) {
        return '';
    }
}

// ============================================================================
// FILE UTILITIES
// ============================================================================

export function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (e) {
        return false;
    }
}

export function readFileSafe(filePath, maxSize = CONFIG.maxFileSize) {
    try {
        const stats = fs.statSync(filePath);
        if (stats.size > maxSize) {
            log.warn(`File too large to scan: ${filePath}`);
            return null;
        }
        return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        return null;
    }
}

export function getFileSize(filePath) {
    try {
        return fs.statSync(filePath).size;
    } catch (e) {
        return 0;
    }
}

export function isBinaryFile(filePath) {
    const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.exe', '.bin',
        '.node', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz',
        '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.wav',
        '.ico', '.svg', '.webp', '.avif', '.ttf', '.otf'
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    if (binaryExtensions.includes(ext)) {
        return true;
    }
    
    // Check for null bytes
    try {
        const buffer = Buffer.alloc(1024);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
        fs.closeSync(fd);
        
        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] === 0) return true;
        }
    } catch (e) {
        return true;
    }
    
    return false;
}

// ============================================================================
// CONFIG FILE MANAGEMENT
// ============================================================================

export function loadConfig() {
    const configPath = path.resolve(CONFIG.configFile);
    
    if (!fileExists(configPath)) {
        return {};
    }
    
    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        log.warn(`Failed to load config: ${e.message}`);
        return {};
    }
}

export function saveConfig(config) {
    const configPath = path.resolve(CONFIG.configFile);
    
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        log.error(`Failed to save config: ${e.message}`);
        return false;
    }
}

// ============================================================================
// IGNORE MANAGER
// ============================================================================

export function getIgnoreManager() {
    const ig = ignore();
    ig.add(CONFIG.defaultIgnores);
    
    const ignorePath = path.resolve('.sealignore');
    if (fileExists(ignorePath)) {
        try {
            const content = fs.readFileSync(ignorePath, 'utf-8');
            const lines = content.split('\n');
            const patterns = [];
            const hashes = [];
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                
                if (trimmed.startsWith('HASH:')) {
                    hashes.push(trimmed);
                } else {
                    patterns.push(trimmed);
                }
            }
            
            ig.add(patterns);
            
            return {
                ignores: (pathStr) => patterns.some(p => matchPattern(p, pathStr)),
                hashes,
                patterns
            };
        } catch (e) {
            log.warn('Could not read .sealignore file');
        }
    }
    
    return { ignores: () => false, hashes: [], patterns: [] };
}

function matchPattern(pattern, pathStr) {
    if (pattern === pathStr) return true;
    if (pattern.endsWith('/')) return pathStr.startsWith(pattern);
    if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(pathStr);
    }
    return false;
}

// ============================================================================
// SEALIGNORE MANAGEMENT WITH HASH PROTECTION
// ============================================================================

export function addToSealignore(pattern, options = {}) {
    const ignorePath = path.resolve('.sealignore');
    const content = [];
    
    if (fileExists(ignorePath)) {
        const existing = fs.readFileSync(ignorePath, 'utf-8');
        for (const line of existing.split('\n')) {
            if (line.trim() && !line.startsWith('HASH:')) {
                content.push(line);
            }
        }
    }
    
    content.push(pattern);
    
    if (options.hash) {
        const hash = generateHash(pattern);
        content.push(`HASH:${hash}`);
    }
    
    const header = `# seal-commit ignore rules\n# Generated: ${new Date().toISOString()}\n\n`;
    fs.writeFileSync(ignorePath, header + content.join('\n') + '\n');
    return true;
}

export function verifySealignoreIntegrity() {
    const ignorePath = path.resolve('.sealignore');
    
    if (!fileExists(ignorePath)) {
        return { valid: true, message: 'No .sealignore file found' };
    }
    
    try {
        const content = fs.readFileSync(ignorePath, 'utf-8');
        const lines = content.split('\n');
        const hashes = [];
        const patterns = [];
        
        for (const line of lines) {
            if (line.startsWith('HASH:')) {
                hashes.push(line.substring(5));
            } else if (line.trim()) {
                patterns.push(line);
            }
        }
        
        let allValid = true;
        for (let i = 0; i < patterns.length; i++) {
            if (hashes[i]) {
                const expectedHash = generateHash(patterns[i]);
                if (hashes[i] !== expectedHash) {
                    allValid = false;
                    log.warn(`Integrity check failed for pattern: ${patterns[i]}`);
                }
            }
        }
        
        if (!allValid) {
            return { valid: false, message: 'Integrity check failed.' };
        }
        
        return { valid: true, message: 'All patterns verified' };
    } catch (e) {
        return { valid: false, message: `Error: ${e.message}` };
    }
}

function generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

// ============================================================================
// HOOK MANAGEMENT
// ============================================================================

export function checkExistingHook(hookPath) {
    if (!fileExists(hookPath)) {
        return { exists: false, content: null };
    }
    
    const content = fs.readFileSync(hookPath, 'utf-8');
    
    if (content.includes('seal-commit')) {
        return { exists: true, isSealCommit: true, content };
    }
    
    return { exists: true, isSealCommit: false, content };
}

export function backupHook(hookPath) {
    if (fileExists(hookPath)) {
        const backupPath = hookPath + '.backup.' + Date.now();
        fs.writeFileSync(backupPath, fs.readFileSync(hookPath));
        log.info(`Existing hook backed up to: ${backupPath}`);
        return backupPath;
    }
    return null;
}

export function detectPlatform() {
    const platform = process.platform;
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'macos';
    return 'linux';
}

// ============================================================================
// PARALLEL PROCESSING
// ============================================================================

export async function scanFilesParallel(files, scanFunction, maxWorkers = CONFIG.maxWorkers) {
    const results = [];
    const queue = [...files];
    const workers = [];
    
    const worker = async () => {
        while (queue.length > 0) {
            const file = queue.shift();
            try {
                const result = await scanFunction(file);
                if (result) results.push(result);
            } catch (e) {
                log.warn(`Error scanning ${file}: ${e.message}`);
            }
        }
    };
    
    const workerCount = Math.min(maxWorkers, files.length);
    for (let i = 0; i < workerCount; i++) {
        workers.push(worker());
    }
    
    await Promise.all(workers);
    return results;
}

// ============================================================================
// CACHING
// ============================================================================

export class FileCache {
    constructor(cacheDir = CONFIG.cacheDir) {
        this.cacheDir = cacheDir;
        this.ensureCacheDir();
    }
    
    ensureCacheDir() {
        if (!fileExists(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    
    get(filePath) {
        try {
            const cachePath = this.getCachePath(filePath);
            if (fileExists(cachePath)) {
                const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
                if (cached.mtime === fs.statSync(filePath).mtime.getTime()) {
                    return cached.data;
                }
            }
        } catch (e) {
            return null;
        }
        return null;
    }
    
    set(filePath, data) {
        try {
            const cachePath = this.getCachePath(filePath);
            const mtime = fs.statSync(filePath).mtime.getTime();
            fs.writeFileSync(cachePath, JSON.stringify({ mtime, data }));
        } catch (e) {
            // Cache write failed, ignore
        }
    }
    
    getCachePath(filePath) {
        const hash = crypto.createHash('sha256').update(filePath).digest('hex');
        return path.join(this.cacheDir, hash + '.json');
    }
    
    clear() {
        if (fileExists(this.cacheDir)) {
            fs.rmSync(this.cacheDir, { recursive: true, force: true });
            this.ensureCacheDir();
        }
    }
}

// ============================================================================
// TIMEOUT UTILITY
// ============================================================================

export function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
        )
    ]);
}

// ============================================================================
// INTERACTIVE FIX SUGGESTIONS
// ============================================================================

export function suggestFix(finding) {
    const suggestions = [];
    
    switch (finding.type) {
        case 'AWS Access Key ID':
            suggestions.push('export AWS_ACCESS_KEY_ID="${1:YOUR_KEY_ID}"');
            suggestions.push('export AWS_SECRET_ACCESS_KEY="${2:YOUR_SECRET}"');
            break;
            
        case 'Generic API Key':
            suggestions.push(`export API_KEY="${finding.match}"`.replace(finding.match, '${API_KEY}'));
            suggestions.push('Add to .env file and use process.env.API_KEY');
            break;
            
        case 'Database Connection':
            suggestions.push('Use connection pool with environment variables');
            suggestions.push('Consider using Prisma or TypeORM with env vars');
            break;
            
        default:
            suggestions.push('Replace with environment variable');
            suggestions.push('Use secrets management service');
    }
    
    return suggestions;
}
