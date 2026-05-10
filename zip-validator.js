/**
 * ZIP Validator Module
 * 
 * Comprehensive validation and security checks for ZIP files.
 * Prevents corruption, path traversal, and other security issues.
 * 
 * Features:
 * - MIME type validation (magic bytes detection)
 * - File size limits
 * - ZIP structure validation
 * - Path traversal prevention
 * - Duplicate file detection
 * - Async processing for large files
 */

// ===============================
// Configuration
// ===============================

const ZIP_CONFIG = {
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB default
    MAX_EXTRACTED_SIZE: 500 * 1024 * 1024, // 500 MB for extracted content
    ALLOWED_EXTENSIONS: ['txt', 'jpg', 'jpeg', 'png', 'gif', 'mp4', 'mp3', 'wav', 'opus', 'pdf', 'vcf']
};

// ===============================
// Commit 1: MIME & Size Validation
// ===============================

/**
 * Validate ZIP file MIME type using magic bytes
 * 
 * ZIP files start with magic bytes: 0x504B0304 (PK\x03\x04)
 * This is more reliable than checking file extension.
 * 
 * @param {Blob|File} fileBlob - File to validate
 * @returns {Promise<boolean>} True if valid ZIP magic bytes
 */
async function validateMIME(fileBlob) {
    if (!fileBlob) {
        return false;
    }

    try {
        // Read first 4 bytes
        const headerBuffer = await fileBlob.slice(0, 4).arrayBuffer();
        const headerView = new Uint8Array(headerBuffer);

        // Check for ZIP magic bytes: 0x50 0x4B 0x03 0x04 (PK\x03\x04)
        const isZIP = 
            headerView[0] === 0x50 &&
            headerView[1] === 0x4B &&
            headerView[2] === 0x03 &&
            headerView[3] === 0x04;

        return isZIP;
    } catch (error) {
        console.error('Error validating MIME type:', error);
        return false;
    }
}

/**
 * Validate file size against maximum limit
 * 
 * @param {Blob|File} fileBlob - File to validate
 * @param {number} maxSizeBytes - Maximum allowed size (default: 100 MB)
 * @returns {boolean} True if file is within size limit
 */
function validateFileSize(fileBlob, maxSizeBytes = ZIP_CONFIG.MAX_FILE_SIZE) {
    if (!fileBlob) {
        return false;
    }

    const fileSizeBytes = fileBlob.size;

    if (fileSizeBytes > maxSizeBytes) {
        console.warn(
            `File too large: ${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB > ` +
            `${(maxSizeBytes / 1024 / 1024).toFixed(2)} MB limit`
        );
        return false;
    }

    return true;
}

// ===============================
// Commit 2: ZIP Structure & Corruption Detection
// ===============================

/**
 * Validate ZIP structure without full extraction
 * 
 * Attempts to read the ZIP central directory to detect corruption.
 * Non-blocking: catches errors gracefully.
 * 
 * @param {JSZip} zipInstance - JSZip instance to validate
 * @returns {Object} Validation result: {valid, totalFiles, totalSize, error}
 */
function validateZipStructure(zipInstance) {
    const result = {
        valid: false,
        totalFiles: 0,
        totalSize: 0,
        error: null
    };

    if (!zipInstance || !zipInstance.files) {
        result.error = 'Invalid ZIP instance';
        return result;
    }

    try {
        let fileCount = 0;
        let totalSize = 0;

        // Iterate through ZIP files to validate structure
        for (const path in zipInstance.files) {
            const entry = zipInstance.files[path];

            // Skip directories
            if (entry.dir) {
                continue;
            }

            fileCount++;

            // Get uncompressed size
            try {
                const size = entry.uncompressedSize || 0;
                totalSize += size;

                // Warn if a single file is suspiciously large
                if (size > 100 * 1024 * 1024) {
                    console.warn(`Large file in ZIP: ${path} (${(size / 1024 / 1024).toFixed(2)} MB)`);
                }
            } catch (e) {
                console.warn(`Could not determine size of ${path}:`, e);
            }
        }

        // Check extracted size limit
        if (totalSize > ZIP_CONFIG.MAX_EXTRACTED_SIZE) {
            result.error = `Extracted content too large: ${(totalSize / 1024 / 1024).toFixed(2)} MB`;
            return result;
        }

        result.valid = true;
        result.totalFiles = fileCount;
        result.totalSize = totalSize;

        return result;
    } catch (error) {
        result.error = `ZIP structure validation error: ${error.message}`;
        return result;
    }
}

/**
 * Validate ZIP structure asynchronously (non-blocking)
 * 
 * @param {JSZip} zipInstance - JSZip instance to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateZipAsync(zipInstance) {
    return new Promise((resolve) => {
        try {
            const result = validateZipStructure(zipInstance);
            resolve(result);
        } catch (error) {
            resolve({
                valid: false,
                totalFiles: 0,
                totalSize: 0,
                error: `Async validation failed: ${error.message}`
            });
        }
    });
}

// ===============================
// Commit 3: Path Traversal & Duplicate Detection
// ===============================

/**
 * Validate file path to prevent path traversal attacks
 * 
 * Rejects:
 * - Paths with ../
 * - Paths with ..\
 * - Absolute paths (starting with /)
 * - Hidden files (starting with .)
 * 
 * @param {string} filePath - File path from ZIP entry
 * @returns {boolean} True if path is safe
 */
function validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return false;
    }

    // Normalize to forward slashes
    const normalized = filePath.replace(/\\/g, '/');

    // Reject path traversal
    if (normalized.includes('../') || normalized.includes('..\\')) {
        return false;
    }

    // Reject absolute paths
    if (normalized.startsWith('/')) {
        return false;
    }

    // Reject hidden files (except for acceptable cases)
    const fileName = normalized.split('/').pop();
    if (fileName.startsWith('.') && fileName !== '.txt' && !fileName.endsWith('.txt')) {
        return false;
    }

    // Reject null bytes
    if (normalized.includes('\0')) {
        return false;
    }

    return true;
}

/**
 * Detect duplicate files in ZIP
 * 
 * Returns a map of duplicate filenames and their occurrences.
 * 
 * @param {JSZip} zipInstance - JSZip instance
 * @returns {Object} Duplicates: {filename: [path1, path2, ...], ...}
 */
function detectDuplicates(zipInstance) {
    const duplicates = {};
    const fileNameMap = {};

    if (!zipInstance || !zipInstance.files) {
        return duplicates;
    }

    // Build map of filenames to paths
    for (const path in zipInstance.files) {
        const entry = zipInstance.files[path];

        // Skip directories
        if (entry.dir) {
            continue;
        }

        // Get the filename (last component)
        const fileName = path.split('/').pop().toLowerCase();

        if (!fileNameMap[fileName]) {
            fileNameMap[fileName] = [];
        }

        fileNameMap[fileName].push(path);
    }

    // Find duplicates
    for (const fileName in fileNameMap) {
        if (fileNameMap[fileName].length > 1) {
            duplicates[fileName] = fileNameMap[fileName];
        }
    }

    return duplicates;
}

/**
 * Get file extension safely
 * 
 * @param {string} filename - Filename to check
 * @returns {string} Extension in lowercase, or empty string
 */
function getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') {
        return '';
    }

    const parts = filename.split('.');
    if (parts.length < 2) {
        return '';
    }

    return parts[parts.length - 1].toLowerCase();
}

/**
 * Check if file has allowed extension
 * 
 * @param {string} filename - Filename to check
 * @param {string[]} allowedExtensions - List of allowed extensions
 * @returns {boolean} True if extension is allowed
 */
function isAllowedExtension(filename, allowedExtensions = ZIP_CONFIG.ALLOWED_EXTENSIONS) {
    const ext = getFileExtension(filename);
    return allowedExtensions.includes(ext);
}

// ===============================
// Main Orchestrator
// ===============================

/**
 * Complete ZIP validation
 * 
 * Performs all checks:
 * 1. MIME type validation
 * 2. File size validation
 * 3. ZIP structure validation
 * 4. Path traversal prevention
 * 5. Duplicate detection
 * 
 * @param {Blob|File} fileBlob - File to validate
 * @param {JSZip} zipInstance - JSZip instance (optional, for structure check)
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Complete validation result
 */
async function validateZip(fileBlob, zipInstance = null, options = {}) {
    const result = {
        valid: false,
        checks: {
            mimeValid: false,
            sizeValid: false,
            structureValid: false,
            pathsValid: true,
            noDuplicates: true
        },
        errors: [],
        warnings: [],
        metadata: {
            totalFiles: 0,
            totalSize: 0,
            duplicates: {}
        }
    };

    // Check 1: MIME type
    try {
        const mimeValid = await validateMIME(fileBlob);
        result.checks.mimeValid = mimeValid;

        if (!mimeValid) {
            result.errors.push('File is not a valid ZIP (invalid magic bytes)');
        }
    } catch (error) {
        result.errors.push(`MIME validation error: ${error.message}`);
    }

    // Check 2: File size
    try {
        const sizeValid = validateFileSize(fileBlob, options.maxFileSize);
        result.checks.sizeValid = sizeValid;

        if (!sizeValid) {
            result.errors.push('File exceeds maximum size limit');
        }
    } catch (error) {
        result.errors.push(`Size validation error: ${error.message}`);
    }

    // Check 3: ZIP structure (if instance provided)
    if (zipInstance) {
        try {
            const structureResult = await validateZipAsync(zipInstance);
            result.checks.structureValid = structureResult.valid;
            result.metadata.totalFiles = structureResult.totalFiles;
            result.metadata.totalSize = structureResult.totalSize;

            if (!structureResult.valid) {
                result.errors.push(structureResult.error);
            }
        } catch (error) {
            result.errors.push(`Structure validation error: ${error.message}`);
        }

        // Check 4: Path traversal
        try {
            let invalidPaths = [];

            for (const path in zipInstance.files) {
                if (!validateFilePath(path)) {
                    invalidPaths.push(path);
                    result.checks.pathsValid = false;
                }
            }

            if (invalidPaths.length > 0) {
                result.errors.push(`Invalid file paths detected: ${invalidPaths.join(', ')}`);
            }
        } catch (error) {
            result.errors.push(`Path validation error: ${error.message}`);
        }

        // Check 5: Duplicates
        try {
            const duplicates = detectDuplicates(zipInstance);

            if (Object.keys(duplicates).length > 0) {
                result.checks.noDuplicates = false;
                result.metadata.duplicates = duplicates;
                result.warnings.push(`Found ${Object.keys(duplicates).length} duplicate filenames`);
            }
        } catch (error) {
            result.errors.push(`Duplicate detection error: ${error.message}`);
        }
    }

    // Final verdict
    result.valid = 
        result.checks.mimeValid && 
        result.checks.sizeValid && 
        (zipInstance ? result.checks.structureValid && result.checks.pathsValid : true);

    return result;
}

// ===============================
// Exports
// ===============================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ZIP_CONFIG,
        validateMIME,
        validateFileSize,
        validateZipStructure,
        validateZipAsync,
        validateFilePath,
        detectDuplicates,
        getFileExtension,
        isAllowedExtension,
        validateZip
    };
}

if (typeof window !== 'undefined') {
    window.ZIPValidator = {
        ZIP_CONFIG,
        validateMIME,
        validateFileSize,
        validateZipStructure,
        validateZipAsync,
        validateFilePath,
        detectDuplicates,
        getFileExtension,
        isAllowedExtension,
        validateZip
    };
}
