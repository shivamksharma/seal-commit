import fs from 'fs';
import path from 'path';
import { scanContent, isBinary } from '../detector.js';
import { log, box, assertGitRepo, getIgnoreManager } from '../utils.js';

function getAllFiles(dir, fileList = [], ig, rootDir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        // Basic structural ignores
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') return;

        const filePath = path.join(dir, file);
        const relativePath = path.relative(rootDir, filePath);

        // Check against ignore manager (glob patterns)
        // ig.ignores() checks simple relative paths
        if (ig.ignores(relativePath)) return;

        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList, ig, rootDir);
        } else {
            fileList.push(filePath);
        }
    });
    return fileList;
}

export function cmdScan() {
    assertGitRepo(); // Ensure inside git repo

    const rootDir = process.cwd();
    const ig = getIgnoreManager();

    log.title('Full Project Scan Initiated');
    const allFiles = getAllFiles(rootDir, [], ig, rootDir);
    log.info(`Scanning ${allFiles.length} files...`);

    let checked = 0;
    let errorsFound = false;

    for (const fullPath of allFiles) {
        checked++;
        if (isBinary(fullPath)) continue;

        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const relativePath = path.relative(rootDir, fullPath);
            const findings = scanContent(content, relativePath, ig);

            if (findings.length > 0) {
                errorsFound = true;
                findings.forEach(f => {
                    box(`SECRET DETECTED: ${relativePath}`, [
                        `Line: ${f.line}`,
                        `Type: ${f.type}`,
                        `Match: "${f.match.substring(0, 30)}..."`
                    ]);
                });
            }
        } catch (err) {
            // ignore read errors
        }
    }

    if (errorsFound) {
        log.error('Scan complete. Secrets detected.');
        process.exit(1);
    } else {
        log.success(`Scan complete. No secrets found in ${checked} files.`);
        process.exit(0);
    }
}
