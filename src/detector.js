import fs from 'fs';
import path from 'path';

export const PATTERNS = [
    {
        name: 'AWS Access Key',
        regex: /\bAKIA[0-9A-Z]{16}\b/g,
    },
    {
        name: 'Google API Key',
        regex: /\bAIza[0-9A-Za-z-_]{35}\b/g,
    },
    {
        name: 'Slack Token',
        regex: /\bxox[baprs]-([0-9a-zA-Z]{10,48})\b/g,
    },
    {
        name: 'Private Key',
        regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g,
    },
    {
        name: 'JWT Token',
        regex: /\beyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\b/g,
    },
    {
        name: 'Stripe API Key',
        regex: /\b(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}\b/g
    },
    {
        name: 'GitHub Personal Access Token',
        regex: /\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/g
    },
    // Generic patterns looking for assignments
    {
        name: 'Generic Secret Assignment',
        // Look for (key/token/pass/secret/pw) followed by assignment operators and quote
        regex: /((?:api[_-]?key|auth[_-]?token|access[_-]?token|secret|password|passwd|pwd)[a-zA-Z0-9_]*)\s*[:=]\s*["'](?!\$|%|\{)(.+?)["']/gi,
        matchGroup: 2
    }
];

// Context based filtering to reduce false positives
function isFalsePositive(value) {
    if (!value) return true;
    if (value.length < 8) return true; // Short values are likely not secrets (e.g. "1234", "password")
    if (value.includes('PROCESS.ENV')) return true;
    if (value.includes('process.env')) return true;
    if (value.startsWith('${')) return true; // Template literals
    // Common placeholders
    if (/example|sample|test|placeholder|xxx/i.test(value)) return true;
    return false;
}

// Shannon Entropy Calculation
function getEntropy(str) {
    const len = str.length;
    if (len === 0) return 0;

    const frequencies = {};
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies[char] = (frequencies[char] || 0) + 1;
    }

    return Object.values(frequencies).reduce((sum, count) => {
        const p = count / len;
        return sum - (p * Math.log2(p));
    }, 0);
}

// Extract string literals from code
function extractStrings(content) {
    const strings = [];
    // Regex to match "..." or '...' or `...` handling escapes
    // This is a simplified version; parsing full AST is too heavy for this tool
    const strRegex = /(["'])(?:(?=(\\?))\2.)*?\1/g;
    let match;
    while ((match = strRegex.exec(content)) !== null) {
        // Remove quotes
        const val = match[0].slice(1, -1);
        strings.push({
            value: val,
            index: match.index
        });
    }
    return strings;
}

export function scanContent(content, fileName, ignoreManager) {
    const findings = [];

    // 1. Regex Scan
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        PATTERNS.forEach(pattern => {
            if (pattern.disabled) return;
            const regex = new RegExp(pattern.regex);
            let match;
            while ((match = regex.exec(line)) !== null) {
                const fullMatch = match[0];
                const capturedValue = pattern.matchGroup ? match[pattern.matchGroup] : fullMatch;

                if (isFalsePositive(capturedValue)) continue;

                // Check Whitelist via .sealignore (using ignoreManager is file-wide, but we might want per-line ignores too? 
                // For now, assume .sealignore handles files/glob patterns. 
                // We can add simple content ignoring if needed, but let's stick to the file-based ignore + "allow" command logic.
                // Wait, "allow" command adds to .sealignore. 
                // If the user wants to ignore a specific KEY in a file that IS scanned, they can add that key string to .sealignore?
                // The ignore package matches PATHS. It doesn't match CONTENT strings.
                // We need to check if the MATCH itself is in our "allowed list".
                // Let's re-read previous implementation of `cmdAllow`. It updated `.sealignore`.
                // If we switch to standard glob `ignore` package, we only support ignoring paths.
                // However, the user request says ".sealignore rules overriding any defaults" and "allow certain patterns".
                // Standard .gitignore behavior is PATHS.
                // BUT, we previously supported ignoring specific Secret Strings.
                // We should support BOTH:
                // 1. Files ignored by glob (handled by ignoreManager before reading file)
                // 2. Specific secrets whitelisted (maybe we check if the match text matches a list of allowed secrets?)
                // Let's stick to the prompt's implication: "files, folders, and glob patterns".
                // BUT preventing a specific "AKIA..." from triggering if it's a false positive is crucial.
                // Let's check `ignoreManager` for the exact match text? No, `ignore` works on paths.
                // Let's keep a separate "allowed secrets" check. We can read .sealignore and split it:
                // - if it looks like a path (contains / or *), treat as glob.
                // - if it looks like a string literel without globs, treat as ignored secret?
                // Actually, typical use for this tool: `seal-commit allow "AKIA..."`.
                // This adds "AKIA..." to .sealignore. 
                // If I use `ignore` package, it interprets "AKIA..." as a file named "AKIA...".
                // So checking `ignoreManager.ignores("AKIA...")` returns true if "AKIA..." pattern was added.
                // So we can abuse the ignore package to check content too! It just matches strings against patterns.

                if (ignoreManager.ignores(capturedValue)) continue;

                findings.push({
                    type: pattern.name,
                    line: index + 1,
                    content: line.trim(),
                    match: capturedValue
                });
            }
        });
    });

    // 2. High Entropy Scan for Unknown Secrets
    const stringLiterals = extractStrings(content);
    stringLiterals.forEach(strObj => {
        const val = strObj.value;
        if (val.length < 15) return; // Too short
        if (val.includes(' ')) return; // Secrets usually don't have spaces
        if (isFalsePositive(val)) return;

        // If we already found this via regex, skip
        if (findings.some(f => f.match === val)) return;
        if (ignoreManager.ignores(val)) return;

        const entropy = getEntropy(val);
        // Threshold: 4.5 is a common heuristic for base64/hex secrets
        // Hex: 16 chars (0-f). Max entropy = log2(16) = 4. 
        // Base64: 64 chars. Max entropy = log2(64) = 6. 
        // English text is usually ~3.5-4.5 depending on length.
        // Random 20 char string (alphanumeric): 62 chars. log2(62) ~= 5.95.
        // Let's set permissive threshold 4.8 to catch high-randomness strings
        // But verify length.
        if (entropy > 4.8) {
            // Find line number
            const linesUpToMatch = content.substring(0, strObj.index).split('\n');
            const lineNum = linesUpToMatch.length;
            const lineContent = lines[lineNum - 1] ? lines[lineNum - 1].trim() : val;

            findings.push({
                type: 'High Entropy String (Potential Secret)',
                line: lineNum,
                content: lineContent,
                match: val
            });
        }
    });

    return findings;
}

export function isBinary(filePath) {
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.exe', '.bin', '.node', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.eot'];
    return binaryExts.includes(path.extname(filePath).toLowerCase());
}
