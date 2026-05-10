/**
 * Text Normalizer Module
 * 
 * Comprehensive text normalization for WhatsApp chat exports.
 * Handles invisible characters, encoding issues, and Unicode normalization.
 * 
 * Phase 1: Invisible character removal and NFC normalization
 * Phase 2: Line endings and whitespace normalization
 * Phase 3: Emoji and zero-width joiner handling
 */

// ===============================
// Phase 1: Core Normalization Functions
// ===============================

/**
 * Remove invisible and control characters
 * 
 * Handles:
 * - BOM (U+FEFF)
 * - Unicode direction marks: LRE, RLE, PDF, LRO, RLO (U+202A-U+202E)
 * - Zero-width characters: ZWNJ (U+200C), ZWS (U+200B), ZWSP (U+200B)
 * - Format characters: soft hyphen (U+00AD), word joiner (U+2060)
 * - Invisibles: zero-width no-break space (U+FEFF)
 * - Control characters: C0 (U+0000-U+001F) and C1 (U+0080-U+009F) ranges
 * 
 * @param {string} text - Input text
 * @returns {string} Text with invisible characters removed
 */
function removeInvisibleChars(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    return text
        // Remove BOM
        .replace(/^\uFEFF/, '')
        
        // Remove Unicode direction marks
        .replace(/[\u202A-\u202E]/g, '')
        
        // Remove zero-width characters
        .replace(/[\u200B\u200C\u200D]/g, '')
        
        // Remove zero-width space (variant)
        .replace(/\u200B/g, '')
        
        // Remove soft hyphen and word joiner
        .replace(/[\u00AD\u2060]/g, '')
        
        // Remove zero-width no-break space
        .replace(/\uFEFF/g, '')
        
        // Remove control characters (C0: U+0000-U+001F, except tab U+0009, LF U+000A, CR U+000D)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        
        // Remove C1 control characters (U+0080-U+009F)
        .replace(/[\u0080-\u009F]/g, '');
}

/**
 * Normalize text to NFC (Canonical Composition)
 * 
 * Converts composed characters like é to their composed form (é, not e + ´)
 * This ensures consistent string matching and comparison.
 * 
 * @param {string} text - Input text
 * @returns {string} NFC-normalized text
 */
function normalizeToNFC(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    // Check if String.prototype.normalize is available (all modern browsers)
    if (typeof text.normalize === 'function') {
        return text.normalize('NFC');
    }

    // Fallback: return unchanged (should not occur in modern environments)
    console.warn('String.normalize not available. Text may have composition issues.');
    return text;
}

/**
 * Trim whitespace from both ends and internal extra spaces
 * 
 * @param {string} text - Input text
 * @returns {string} Trimmed text
 */
function trimText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    return text.trim();
}

// ===============================
// Main Orchestrator (Phase 1)
// ===============================

/**
 * Apply Phase 1 normalization: invisible chars + NFC
 * 
 * This is the primary entry point for text normalization.
 * Additional phases will be added as separate functions.
 * 
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
function normalizeText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    // Phase 1: Remove invisible characters
    let normalized = removeInvisibleChars(text);

    // Phase 1: Normalize to NFC
    normalized = normalizeToNFC(normalized);

    // Phase 1: Trim edges
    normalized = trimText(normalized);

    return normalized;
}

// ===============================
// Batch Processing (for ZIP content)
// ===============================

/**
 * Normalize all lines in bulk
 * Useful for processing entire chat exports
 * 
 * @param {string[]} lines - Array of text lines
 * @returns {string[]} Array of normalized lines
 */
function normalizeLines(lines) {
    if (!Array.isArray(lines)) {
        return [];
    }

    return lines.map(line => normalizeText(line));
}

/**
 * Normalize a chat text string (split by newlines)
 * 
 * @param {string} chatText - Full chat text
 * @returns {string} Normalized chat text
 */
function normalizeChatText(chatText) {
    if (!chatText || typeof chatText !== 'string') {
        return '';
    }

    const lines = chatText.split('\n');
    const normalized = normalizeLines(lines);
    return normalized.join('\n');
}

// ===============================
// Exports
// ===============================

// For use in Node.js/module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        removeInvisibleChars,
        normalizeToNFC,
        trimText,
        normalizeText,
        normalizeLines,
        normalizeChatText
    };
}

// For use in browser environments
if (typeof window !== 'undefined') {
    window.TextNormalizer = {
        removeInvisibleChars,
        normalizeToNFC,
        trimText,
        normalizeText,
        normalizeLines,
        normalizeChatText
    };
}
