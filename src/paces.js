// VDOT calculation logic (Daniels' Running Formula)

const VDOT_VARS = {
    a: 0.000104,
    b: 0.182258,
    c_offset: 4.60
};

function getVelocityFromVO2(vo2) {
    const a = VDOT_VARS.a;
    const b = VDOT_VARS.b;
    const c = -(vo2 + VDOT_VARS.c_offset);
    const root = Math.sqrt(b * b - 4 * a * c);
    return (-b + root) / (2 * a);
}

function getVO2FromVelocity(v) {
    return -VDOT_VARS.c_offset + VDOT_VARS.b * v + VDOT_VARS.a * v * v;
}

export function calculateVDOT(distanceMeters, timeMinutes) {
    const v = distanceMeters / timeMinutes;
    const vo2Cost = getVO2FromVelocity(v);
    const t = timeMinutes;
    const percentMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
    return vo2Cost / percentMax;
}

export function calculatePacesFromVDOT(vdot) {
    const intensities = {
        easy: 0.70,
        marathon: 0.82,
        threshold: 0.88,
        interval: 0.975,
        repetition: 1.05
    };

    const paces = {};
    for (const [key, intensity] of Object.entries(intensities)) {
        const targetVO2 = vdot * intensity;
        const v = getVelocityFromVO2(targetVO2);
        paces[key] = (1000 / v) * 60;
    }
    return paces;
}

export function calculateAverageVDOT(pbTimes) {
    const vdots = [];
    const distances = {
        '5k': 5000,
        '10k': 10000,
        'half': 21097.5,
        'marathon': 42195
    };

    for (const [key, distMeters] of Object.entries(distances)) {
        const timeSec = pbTimes[key];
        if (timeSec && timeSec > 0) {
            const timeMinutes = timeSec / 60;
            const vdot = calculateVDOT(distMeters, timeMinutes);
            vdots.push(vdot);
        }
    }

    if (vdots.length === 0) return null;
    return vdots.reduce((a, b) => a + b, 0) / vdots.length;
}

export function getDistanceMeters(raceDist) {
    if (raceDist === '5k') return 5000;
    if (raceDist === '10k') return 10000;
    if (raceDist === 'half') return 21097.5;
    if (raceDist === 'marathon') return 42195;
    return 5000;
}

export function getDistanceLabel(raceDist) {
    if (raceDist === '5k') return '5km';
    if (raceDist === '10k') return '10km';
    if (raceDist === 'half') return 'Half Marathon';
    if (raceDist === 'marathon') return 'Marathon';
    return raceDist;
}

export function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function parseTimeInput(str) {
    if (!str || str.trim() === '') return 0;
    const parts = str.split(':');
    if (parts.length === 2) {
        return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
    }
    if (parts.length === 3) {
        return (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60) + parseInt(parts[2]);
    }
    return 0;
}
