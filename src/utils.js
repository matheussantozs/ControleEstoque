function text(value, { min = 1, max = 255 } = {}) {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    return v.length >= min && v.length <= max ? v : null;
}

function positiveInt(value) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function nonNegativeInt(value) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && Math.round(n * 100) === n * 100 ? Number(n.toFixed(2)) : null;
}

function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

module.exports = { text, positiveInt, nonNegativeInt, money, validDate };
