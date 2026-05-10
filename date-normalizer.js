/**
 * Date Normalizer Module
 * 
 * Converts parsed date and time components to ISO 8601 standard format.
 * Works in conjunction with date-parser.js for automatic format detection.
 * 
 * Output format: YYYY-MM-DD (for dates)
 * Output format: HH:MM:SS (for times, 24-hour)
 * Output format: YYYY-MM-DDTHH:MM:SS (for full datetime)
 */

// ===============================
// Date Normalization
// ===============================

/**
 * Normalize date components to ISO 8601 string (YYYY-MM-DD)
 * 
 * @param {Object} components - {day, month, year} from date-parser
 * @returns {string|null} ISO 8601 date string or null if invalid
 */
function normalizeDateComponents(components) {
    if (!components || typeof components !== 'object') {
        return null;
    }

    const { day, month, year } = components;

    // Validate before converting
    if (!validateDateComponents(components)) {
        return null;
    }

    // Format as YYYY-MM-DD with zero padding
    const yyyy = String(year).padStart(4, '0');
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Normalize a date string in any detected format to ISO 8601
 * 
 * Automatically detects the format and converts.
 * Requires date-parser.js to be loaded.
 * 
 * @param {string} dateString - Date string in any supported format
 * @returns {string|null} ISO 8601 date (YYYY-MM-DD) or null if parsing/validation fails
 */
function normalizeDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        return null;
    }

    // Check if DateParser is available (should be loaded before this)
    if (typeof window !== 'undefined' && !window.DateParser) {
        console.error('DateParser module not loaded. Load date-parser.js first.');
        return null;
    }

    if (typeof module !== 'undefined' && !global.DateParser) {
        try {
            global.DateParser = require('./date-parser.js');
        } catch (e) {
            console.error('Could not load date-parser module:', e);
            return null;
        }
    }

    const DateParser = typeof window !== 'undefined' ? window.DateParser : global.DateParser;

    // Detect format
    const format = DateParser.detectDateFormat(dateString);
    if (!format) {
        return null;
    }

    // Parse components
    const components = DateParser.parseDateComponents(dateString, format);
    if (!components) {
        return null;
    }

    // Validate
    if (!DateParser.validateDateComponents(components)) {
        return null;
    }

    // Normalize to ISO 8601
    return normalizeDateComponents(components);
}

// ===============================
// Time Normalization
// ===============================

/**
 * Normalize time components to ISO 8601 time string (HH:MM:SS)
 * 
 * Converts to 24-hour format, handles AM/PM.
 * 
 * @param {Object} components - {hour, minute, second} from date-parser
 * @returns {string|null} ISO 8601 time (HH:MM:SS) or null if invalid
 */
function normalizeTimeComponents(components) {
    if (!components || typeof components !== 'object') {
        return null;
    }

    const { hour, minute, second } = components;

    // Validate before converting
    if (!validateTimeComponents(components)) {
        return null;
    }

    // Format as HH:MM:SS with zero padding
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    const ss = String(second).padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
}

/**
 * Normalize a time string in any detected format to ISO 8601
 * 
 * Handles 12-hour to 24-hour conversion automatically.
 * Requires date-parser.js to be loaded.
 * 
 * @param {string} timeString - Time string in any supported format
 * @returns {string|null} ISO 8601 time (HH:MM:SS) or null if parsing/validation fails
 */
function normalizeTime(timeString) {
    if (!timeString || typeof timeString !== 'string') {
        return null;
    }

    // Check if DateParser is available
    if (typeof window !== 'undefined' && !window.DateParser) {
        console.error('DateParser module not loaded. Load date-parser.js first.');
        return null;
    }

    if (typeof module !== 'undefined' && !global.DateParser) {
        try {
            global.DateParser = require('./date-parser.js');
        } catch (e) {
            console.error('Could not load date-parser module:', e);
            return null;
        }
    }

    const DateParser = typeof window !== 'undefined' ? window.DateParser : global.DateParser;

    // Detect format
    const format = DateParser.detectTimeFormat(timeString);
    if (!format) {
        return null;
    }

    // Parse components
    const components = DateParser.parseTimeComponents(timeString, format);
    if (!components) {
        return null;
    }

    // Validate
    if (!DateParser.validateTimeComponents(components)) {
        return null;
    }

    // Normalize to ISO 8601
    return normalizeTimeComponents(components);
}

// ===============================
// DateTime Normalization
// ===============================

/**
 * Normalize a full datetime (date + time) to ISO 8601 format
 * 
 * Combines normalized date and time into YYYY-MM-DDTHH:MM:SS format.
 * Either or both can be null (returns only the non-null component).
 * 
 * @param {string} dateString - Date string (any format)
 * @param {string} timeString - Time string (any format)
 * @returns {string|null} ISO 8601 datetime or null if both are invalid
 */
function normalizeDateTime(dateString, timeString) {
    const normalizedDate = normalizeDate(dateString);
    const normalizedTime = normalizeTime(timeString);

    // At least one component must be valid
    if (!normalizedDate && !normalizedTime) {
        return null;
    }

    // Combine with 'T' separator (ISO 8601 format)
    if (normalizedDate && normalizedTime) {
        return `${normalizedDate}T${normalizedTime}`;
    }

    // Return whichever component is available
    return normalizedDate || normalizedTime;
}

// ===============================
// Internal Validation (mirrored from date-parser)
// ===============================

/**
 * Validate date components (internal)
 * 
 * @param {Object} components - {day, month, year}
 * @returns {boolean}
 */
function validateDateComponents(components) {
    if (!components || typeof components !== 'object') {
        return false;
    }

    const { day, month, year } = components;

    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return false;
    }

    if (month < 1 || month > 12) {
        return false;
    }

    if (day < 1 || day > 31) {
        return false;
    }

    if (year < 1 || year > 9999) {
        return false;
    }

    // Validate day for specific months
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (isLeapYear) {
        daysInMonth[1] = 29;
    }

    if (day > daysInMonth[month - 1]) {
        return false;
    }

    return true;
}

/**
 * Validate time components (internal)
 * 
 * @param {Object} components - {hour, minute, second}
 * @returns {boolean}
 */
function validateTimeComponents(components) {
    if (!components || typeof components !== 'object') {
        return false;
    }

    const { hour, minute, second } = components;

    if (!Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(second)) {
        return false;
    }

    if (hour < 0 || hour > 23) {
        return false;
    }

    if (minute < 0 || minute > 59) {
        return false;
    }

    if (second < 0 || second > 59) {
        return false;
    }

    return true;
}

// ===============================
// Exports
// ===============================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeDateComponents,
        normalizeDate,
        normalizeTimeComponents,
        normalizeTime,
        normalizeDateTime,
        validateDateComponents,
        validateTimeComponents
    };
}

if (typeof window !== 'undefined') {
    window.DateNormalizer = {
        normalizeDateComponents,
        normalizeDate,
        normalizeTimeComponents,
        normalizeTime,
        normalizeDateTime,
        validateDateComponents,
        validateTimeComponents
    };
}
