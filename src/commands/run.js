import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { scanContent, isBinary } from '../detector.js';
import { log, box, assertGitRepo, getIgnoreManager } from '../utils.js';

function getStagedFiles() {
    try {
        const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
        return output.split('\n').filter(f => f.trim() !== '');
    } catch (e) {
        return [];
    }
}

export function cmdRun() {
    assertGitRepo(); // Ensure we are in a git repo

    const stagedFiles = getStagedFiles();
    const ig = getIgnoreManager();
    let errorsFound = false;

    if (stagedFiles.length === 0) {
        return;
    }

    log.info(`Scanning ${stagedFiles.length} staged file(s)...`);

    for (const file of stagedFiles) {
        // Check if file is ignored by .sealignore
        if (ig.ignores(file)) {
            continue;
        }

        const fullPath = path.resolve(file);

        // Check if file exists (it matches deletions too)
        if (!fs.existsSync(fullPath)) continue;
        if (isBinary(fullPath)) continue;

        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const findings = scanContent(content, file, ig);

            if (findings.length > 0) {
                errorsFound = true;

                findings.forEach(f => {
                    box(`SECRET DETECTED: ${file}`, [
                        `Line: ${f.line}`,
                        `Type: ${f.type}`,
                        `Match: "${f.match.length > 20 ? f.match.substring(0, 20) + '...' : f.match}"`,
                        '',
                        'Advice: Replace this hardcoded value with an environment variable.'
                    ]);
                });
            }
        } catch (err) {
            log.warn(`Could not read file: ${file}`);
        }
    }

    if (errorsFound) {
        log.error('Commit blocked due to potential secrets.');
        log.info('To allow a pattern, run: seal-commit allow "<pattern>"');
        log.info('Or add it to .sealignore manually.');
        process.exit(1);
    } else {
        log.success('No secrets found. Proceeding...');
        process.exit(0);
    }
}
