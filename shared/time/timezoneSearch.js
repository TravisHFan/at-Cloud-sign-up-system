"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUtcInstantFromLocal = findUtcInstantFromLocal;
exports.formatViewerLocalTime = formatViewerLocalTime;
exports.formatViewerLocalDateTime = formatViewerLocalDateTime;
function findUtcInstantFromLocal(spec) {
    try {
        const { date, time, timeZone } = spec;
        const [h, m] = time.split(":").map((v) => parseInt(v, 10));
        const [y, mo, d] = date.split("-").map((v) => parseInt(v, 10));
        if ([h, m, y, mo, d].some((n) => isNaN(n)))
            return null;
        if (!timeZone) {
            const local = new Date();
            local.setFullYear(y, mo - 1, d);
            local.setHours(h, m, 0, 0);
            return local;
        }
        const target = {
            year: String(y).padStart(4, "0"),
            month: String(mo).padStart(2, "0"),
            day: String(d).padStart(2, "0"),
            hour: String(h).padStart(2, "0"),
            minute: String(m).padStart(2, "0"),
        };
        const fmt = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
        const base = Date.UTC(y, mo - 1, d, h, m, 0, 0);
        const matchesTarget = (ts) => {
            const parts = fmt
                .formatToParts(ts)
                .reduce((acc, p) => {
                if (p.type !== "literal")
                    acc[p.type] = p.value;
                return acc;
            }, {});
            return (parts.year === target.year &&
                parts.month === target.month &&
                parts.day === target.day &&
                parts.hour === target.hour &&
                parts.minute === target.minute);
        };
        let found = null;
        const stepMs = 15 * 60 * 1000;
        const rangeMs = 24 * 60 * 60 * 1000;
        for (let offset = -rangeMs; offset <= rangeMs; offset += stepMs) {
            const ts = base + offset;
            if (matchesTarget(ts)) {
                found = new Date(ts);
                break;
            }
        }
        return found || new Date(base);
    }
    catch {
        return null;
    }
}
function formatViewerLocalTime(spec) {
    const instant = findUtcInstantFromLocal(spec);
    if (!instant)
        return null;
    return instant.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}
function formatViewerLocalDateTime(spec) {
    let instant = null;
    if (spec.eventDateTimeUtc) {
        try {
            const d = new Date(spec.eventDateTimeUtc);
            if (!isNaN(d.getTime()))
                instant = d;
        }
        catch {
        }
    }
    if (!instant && spec.timeZone)
        instant = findUtcInstantFromLocal(spec);
    if (!instant)
        instant = findUtcInstantFromLocal({ date: spec.date, time: spec.time });
    if (!instant)
        return null;
    const y = instant.getFullYear();
    const m = String(instant.getMonth() + 1).padStart(2, "0");
    const d = String(instant.getDate()).padStart(2, "0");
    const hh = String(instant.getHours()).padStart(2, "0");
    const mm = String(instant.getMinutes()).padStart(2, "0");
    return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}
