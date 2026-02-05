/**
 * Seal-Commit v2 - Hook Installation Command
 */

import fs from 'fs';
import path from 'path';
import { log, assertGitRepo, checkExistingHook, backupHook, detectPlatform } from '../utils.js';

function getNodeHookContent(platform) {
    return `#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getSealCommitPath() {
    try {
        execSync('which seal-commit', { stdio: 'ignore' });
        return 'seal-commit';
    } catch (e) {
        return 'npx seal-commit';
    }
}

function runScan() {
    const sealCommitPath = getSealCommitPath();
    try {
        execSync(sealCommitPath + ' run --ci', { stdio: 'inherit', timeout: 60000 });
        return 0;
    } catch (e) {
        if (e.status === 1) {
            console.log('\nSeal-commit: Secrets detected. Commit blocked.');
        }
        return 1;
    }
}

process.exit(runScan());
`;
}

function getShellHookContent() {
    return `#!/bin/sh
echo "Seal-commit: Scanning staged files..."
npx seal-commit run --ci
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo "Seal-commit: Secrets detected. Commit blocked."
    exit 1
fi
exit 0
`;
}

export function cmdInit(options = {}) {
    assertGitRepo();
    
    const gitDir = path.resolve('.git');
    const hooksDir = path.join(gitDir, 'hooks');
    const preCommitPath = path.join(hooksDir, 'pre-commit');
    
    const platform = detectPlatform();
    log.info('Detected platform: ' + platform);
    
    const existingHook = checkExistingHook(preCommitPath);
    
    if (existingHook.exists && !options.force && !options.merge) {
        log.warn('A pre-commit hook already exists!');
        console.log('\n  Options:');
        console.log('    seal-commit init --force    # Overwrite');
        console.log('    seal-commit init --merge    # Combine\n');
        
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        
        rl.question('Overwrite? (y/n): ', (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'y') {
                performInstall(preCommitPath, hooksDir, platform, true);
            }
        });
        
        return;
    }
    
    if (options.merge && existingHook.exists && !existingHook.isSealCommit) {
        performMerge(preCommitPath, existingHook.content);
    } else {
        const force = options.force || !existingHook.exists;
        if (existingHook.exists) {
            backupHook(preCommitPath);
        }
        performInstall(preCommitPath, hooksDir, platform, force);
    }
}

function performInstall(preCommitPath, hooksDir, platform, force) {
    if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
    }
    
    const hookContent = platform === 'windows' 
        ? getNodeHookContent(platform)
        : getShellHookContent();
    
    fs.writeFileSync(preCommitPath, hookContent);
    
    if (platform !== 'windows') {
        fs.chmodSync(preCommitPath, '755');
    }
    
    log.success('Seal-Commit installed successfully!');
    log.info('Pre-commit hook: ' + preCommitPath);
}

function performMerge(preCommitPath, existingContent) {
    backupHook(preCommitPath);
    
    const mergedContent = '#!/bin/sh\n' +
        'npx seal-commit run --ci\n' +
        'SEAL_EXIT=$?\n' +
        'if [ $SEAL_EXIT -ne 0 ]; then exit 1; fi\n' +
        existingContent.replace(/#!\/bin\/sh/, '');
    
    fs.writeFileSync(preCommitPath, mergedContent);
    fs.chmodSync(preCommitPath, '755');
    
    log.success('Hooks merged successfully!');
}
