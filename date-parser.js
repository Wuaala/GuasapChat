/**
 * Date Parser Module
 * 
 * Automatic detection and parsing of multiple date formats used in WhatsApp exports.
 * Supports various locales and date representations.
 * 
 * Supported formats:
 * - DD/MM/YY (European: 25/12/23)
 * - DD/MM/YYYY (European: 25/12/2023)
 * - MM/DD/YYYY (American: 12/25/2023)
 * - DD.MM.YYYY (German/Continental: 25.12.2023)
 * - YYYY-MM-DD (ISO 8601: 2023-12-25)
 * 
 * Time formats:
 * - HH:MM:SS (24-hour)
 * - HH:MM (24-hour, no seconds)
 * - HH:MM:SS AM/PM (12-hour)
 * - HH:MM AM/PM (12-hour, no seconds)
 */

// ===============================
// Date Format Detection
// ===============================

/**
 * Detect the format of a date string
 * 
 * Analyzes the structure and separators to identify the date format.
 * Returns an object with format info or null if unrecognized.
 * 
 * @param {string} dateString - Date string to analyze
 * @returns {Object|null} Format info: {format, separator, components} or null
 */
function detectDateFormat(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        return null;
    }

    dateString = dateString.trim();

    // Pattern: YYYY-MM-DD (ISO 8601)
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateString)) {
        return {
            format: 'ISO8601',
            separator: '-',
            components: 'YYYY-MM-DD'
        };
    }

    // Pattern: DD/MM/YYYY or MM/DD/YYYY or DD/MM/YY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateString)) {
        const parts = dateString.split('/');
        const [part1, part2, part3] = parts;

        // Determine format based on value ranges
        const num1 = parseInt(part1, 10);
        const num2 = parseInt(part2, 10);
        const num3 = parseInt(part3, 10);

        // If first part > 12, must be DD (day cannot be > 31 but > 12 rules out month)
        if (num1 > 12) {
            return {
                format: 'DD/MM/' + (part3.length === 2 ? 'YY' : 'YYYY'),
                separator: '/',
                components: part3.length === 2 ? 'DD/MM/YY' : 'DD/MM/YYYY'
            };
        }

        // If second part > 12, must be MM and first is DD
        if (num2 > 12) {
            return {
                format: 'DD/MM/' + (part3.length === 2 ? 'YY' : 'YYYY'),
                separator: '/',
                components: part3.length === 2 ? 'DD/MM/YY' : 'DD/MM/YYYY'
            };
        }

        // Ambiguous case: both could be day or month
        // Default to European format (DD/MM) for ambiguous dates
        // This can be overridden by guessDateFormat() analyzing multiple samples
        return {
            format: 'DD/MM/' + (part3.length === 2 ? 'YY' : 'YYYY'),
            separator: '/',
            components: part3.length === 2 ? 'DD/MM/YY' : 'DD/MM/YYYY',
            ambiguous: true
        };
    }

    // Pattern: DD.MM.YYYY (German/Continental)
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateString)) {
        return {
            format: 'DD.MM.YYYY',
            separator: '.',
            components: 'DD.MM.YYYY'
        };
    }

    return null;
}

/**
 * Detect time format (HH:MM:SS or HH:MM, with optional AM/PM)
 * 
 * @param {string} timeString - Time string to analyze
 * @returns {Object|null} Format info: {format, hasSeconds, hasAMPM} or null
 */
function detectTimeFormat(timeString) {
    if (!timeString || typeof timeString !== 'string') {
        return null;
    }

    timeString = timeString.trim();

    // HH:MM:SS AM/PM
    if (/^\d{1,2}:\d{2}:\d{2}\s+(AM|PM)$/i.test(timeString)) {
        return {
            format: 'HH:MM:SS AM/PM',
            hasSeconds: true,
            hasAMPM: true
        };
    }

    // HH:MM AM/PM
    if (/^\d{1,2}:\d{2}\s+(AM|PM)$/i.test(timeString)) {
        return {
            format: 'HH:MM AM/PM',
            hasSeconds: false,
            hasAMPM: true
        };
    }

    // HH:MM:SS (24-hour)
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(timeString)) {
        return {
            format: 'HH:MM:SS',
            hasSeconds: true,
            hasAMPM: false
        };
    }

    // HH:MM (24-hour)
    if (/^\d{1,2}:\d{2}$/.test(timeString)) {
        return {
            format: 'HH:MM',
            hasSeconds: false,
            hasAMPM: false
        };
    }

    return null;
}

// ===============================
// Date Parsing
// ===============================

/**
 * Parse a date string in detected/specified format
 * 
 * Returns an object with day, month, year components.
 * Does NOT validate if the date is logically possible (Jan 32nd, etc).
 * Use validateDateComponents() for validation.
 * 
 * @param {string} dateString - Date string to parse
 * @param {Object} format - Format object from detectDateFormat() or manual spec
 * @returns {Object|null} {day, month, year} or null if parsing fails
 */
function parseDateComponents(dateString, format) {
    if (!dateString || !format) {
        return null;
    }

    dateString = dateString.trim();

    if (format.format === 'ISO8601') {
        const parts = dateString.split('-');
        if (parts.length !== 3) return null;

        return {
            year: parseInt(parts[0], 10),
            month: parseInt(parts[1], 10),
            day: parseInt(parts[2], 10)
        };
    }

    if (format.separator === '/') {
        const parts = dateString.split('/');
        if (parts.length !== 3) return null;

        const [part1, part2, part3] = parts;
        let day, month, year;

        // Determine order based on format
        if (format.components.startsWith('DD')) {
            day = parseInt(part1, 10);
            month = parseInt(part2, 10);
        } else if (format.components.startsWith('MM')) {
            month = parseInt(part1, 10);
            day = parseInt(part2, 10);
        } else {
            return null;
        }

        year = parseInt(part3, 10);

        // Convert 2-digit year to 4-digit
        if (year < 100) {
            year = year < 50 ? year + 2000 : year + 1900;
        }

        return { day, month, year };
    }

    if (format.separator === '.') {
        const parts = dateString.split('.');
        if (parts.length !== 3) return null;

        return {
            day: parseInt(parts[0], 10),
            month: parseInt(parts[1], 10),
            year: parseInt(parts[2], 10)
        };
    }

    return null;
}

/**
 * Parse time components from a time string
 * 
 * @param {string} timeString - Time string to parse
 * @param {Object} format - Format object from detectTimeFormat()
 * @returns {Object|null} {hour, minute, second} or null if parsing fails
 */
function parseTimeComponents(timeString, format) {
    if (!timeString || !format) {
        return null;
    }

    timeString = timeString.trim();

    // Remove AM/PM if present (keep it separate for 12→24 hour conversion)
    const ampmMatch = timeString.match(/(AM|PM)$/i);
    const isAM = ampmMatch && ampmMatch[1].toUpperCase() === 'AM';
    const isPM = ampmMatch && ampmMatch[1].toUpperCase() === 'PM';
    const timePart = ampmMatch ? timeString.replace(/(AM|PM)$/i, '').trim() : timeString;

    const parts = timePart.split(':');
    if (parts.length < 2) return null;

    let hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    const second = parts.length > 2 ? parseInt(parts[2], 10) : 0;

    // Convert 12-hour to 24-hour format
    if (format.hasAMPM) {
        if (isPM && hour !== 12) {
            hour += 12;
        } else if (isAM && hour === 12) {
            hour = 0;
        }
    }

    return { hour, minute, second };
}

// ===============================
// Date Validation
// ===============================

/**
 * Validate date components
 * 
 * Checks for impossible dates:
 * - Month: 1-12
 * - Day: 1-31 (with month validation for Feb 29, etc.)
 * - Year: > 0 (reasonable range)
 * 
 * @param {Object} components - {day, month, year}
 * @returns {boolean} True if valid date
 */
function validateDateComponents(components) {
    if (!components || typeof components !== 'object') {
        return false;
    }

    const { day, month, year } = components;

    // Validate ranges
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

    // Check leap year
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
 * Validate time components
 * 
 * @param {Object} components - {hour, minute, second}
 * @returns {boolean} True if valid time
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
// Format Guessing (for ambiguous cases)
// ===============================

/**
 * Guess the true date format by analyzing multiple date samples
 * 
 * When dates are ambiguous (DD/MM vs MM/DD), this function analyzes
 * multiple samples to determine which interpretation is correct.
 * 
 * @param {string[]} dateStrings - Array of date strings to analyze
 * @returns {string} Detected format: 'DD/MM' or 'MM/DD'
 */
function guessDateFormatFromSamples(dateStrings) {
    if (!Array.isArray(dateStrings) || dateStrings.length === 0) {
        return 'DD/MM'; // Default to European
    }

    let ddmmValid = 0;
    let mmddValid = 0;

    dateStrings.forEach(dateStr => {
        const detected = detectDateFormat(dateStr);
        if (!detected || !detected.ambiguous) {
            return;
        }

        const parts = dateStr.split('/');
        if (parts.length !== 3) return;

        const num1 = parseInt(parts[0], 10);
        const num2 = parseInt(parts[1], 10);

        // Test DD/MM interpretation
        if (num1 >= 1 && num1 <= 31 && num2 >= 1 && num2 <= 12) {
            ddmmValid++;
        }

        // Test MM/DD interpretation
        if (num1 >= 1 && num1 <= 12 && num2 >= 1 && num2 <= 31) {
            mmddValid++;
        }
    });

    // More valid interpretations in one direction = that's the format
    if (mmddValid > ddmmValid) {
        return 'MM/DD';
    }

    return 'DD/MM';
}

// ===============================
// Exports
// ===============================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        detectDateFormat,
        detectTimeFormat,
        parseDateComponents,
        parseTimeComponents,
        validateDateComponents,
        validateTimeComponents,
        guessDateFormatFromSamples
    };
}

if (typeof window !== 'undefined') {
    window.DateParser = {
        detectDateFormat,
        detectTimeFormat,
        parseDateComponents,
        parseTimeComponents,
        validateDateComponents,
        validateTimeComponents,
        guessDateFormatFromSamples
    };
}
