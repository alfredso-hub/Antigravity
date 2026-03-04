import { supabase, signInWithGoogle, signOut, getUser, getSession } from './supabase.js';
import {
    calculateVDOT, calculatePacesFromVDOT, calculateAverageVDOT,
    getDistanceMeters, getDistanceLabel, formatTime, parseTimeInput
} from './paces.js';
import {
    loadPlans, loadPlanWeeks, loadUserCustomizations,
    saveUserCustomization, createPlan, loadProfile, saveProfile
} from './db.js';

// ─── State ───
let currentUser = null;
let allPlans = [];
let currentPlanWeeks = [];
let currentCustomizations = {};
let myChart = null;

// ─── Auth UI ───
function renderAuthUI(user) {
    const authContainer = document.getElementById('authContainer');
    if (user) {
        const meta = user.user_metadata || {};
        const name = meta.full_name || meta.name || user.email;
        const avatar = meta.avatar_url || meta.picture || '';
        authContainer.innerHTML = `
            <div class="user-info">
                ${avatar ? `<img src="${avatar}" alt="" class="user-avatar">` : ''}
                <span class="user-name">${name}</span>
                <button id="signOutBtn" class="btn btn-secondary btn-sm">Sign Out</button>
            </div>
        `;
        document.getElementById('signOutBtn').addEventListener('click', async () => {
            await signOut();
            window.location.reload();
        });
    } else {
        authContainer.innerHTML = `
            <button id="googleSignIn" class="btn btn-google">
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Sign in with Google
            </button>
        `;
        document.getElementById('googleSignIn').addEventListener('click', () => signInWithGoogle());
    }
}

function showApp(show) {
    document.getElementById('appContent').style.display = show ? 'block' : 'none';
    document.getElementById('loginPrompt').style.display = show ? 'none' : 'flex';
}

// ─── Profile Loading/Saving ───
async function loadUserProfile() {
    if (!currentUser) return;
    const profile = await loadProfile(currentUser.id);
    if (profile) {
        const mode = document.getElementById('tuningMode');
        if (profile.tuning_mode) mode.value = profile.tuning_mode;
        updateTuningSection();

        if (profile.single_pb) {
            document.getElementById('raceDistance').value = profile.single_pb.distance || '5k';
            document.getElementById('raceTime').value = profile.single_pb.time || '';
        }
        if (profile.all_pbs) {
            document.getElementById('pb5k').value = profile.all_pbs['5k'] || '';
            document.getElementById('pb10k').value = profile.all_pbs['10k'] || '';
            document.getElementById('pbHalf').value = profile.all_pbs.half || '';
            document.getElementById('pbMarathon').value = profile.all_pbs.marathon || '';
        }
        if (profile.goal_time) {
            document.getElementById('goalTime').value = profile.goal_time;
        }
    }
}

async function handleSavePaces() {
    if (!currentUser) return;
    const btn = document.getElementById('savePacesBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const meta = currentUser.user_metadata || {};
    const { error } = await saveProfile(currentUser.id, {
        displayName: meta.full_name || meta.name || currentUser.email,
        avatarUrl: meta.avatar_url || meta.picture || '',
        tuningMode: document.getElementById('tuningMode').value,
        singlePb: {
            distance: document.getElementById('raceDistance').value,
            time: document.getElementById('raceTime').value
        },
        allPbs: {
            '5k': document.getElementById('pb5k').value,
            '10k': document.getElementById('pb10k').value,
            'half': document.getElementById('pbHalf').value,
            'marathon': document.getElementById('pbMarathon').value
        },
        goalTime: document.getElementById('goalTime').value
    });

    if (error) {
        btn.textContent = 'Error!';
        setTimeout(() => { btn.textContent = 'Save'; btn.disabled = false; }, 2000);
    } else {
        btn.textContent = '✓ Saved';
        setTimeout(() => { btn.textContent = 'Save'; btn.disabled = false; }, 1500);
    }
}

// ─── Plan Loading ───
async function populatePlanDropdown() {
    allPlans = await loadPlans();
    const select = document.getElementById('planSelect');
    select.innerHTML = '';
    allPlans.forEach(plan => {
        const opt = document.createElement('option');
        opt.value = plan.id;
        opt.dataset.distance = plan.distance;
        opt.textContent = plan.name;
        select.appendChild(opt);
    });
    if (allPlans.length > 0) {
        updateGoalRaceLabel();
        await loadAndRenderPlan();
    }
}

async function loadAndRenderPlan() {
    const planId = document.getElementById('planSelect').value;
    if (!planId) return;

    currentPlanWeeks = await loadPlanWeeks(planId);
    if (currentUser) {
        currentCustomizations = await loadUserCustomizations(currentUser.id, planId);
    } else {
        currentCustomizations = {};
    }
    renderPlan();
}

// ─── Tuning Section ───
function updateTuningSection() {
    const mode = document.getElementById('tuningMode').value;
    document.getElementById('singlePbSection').classList.toggle('active', mode === 'single');
    document.getElementById('allPbsSection').classList.toggle('active', mode === 'allPbs');
    document.getElementById('goalTimeSection').classList.toggle('active', mode === 'goalTime');
}

function updateGoalRaceLabel() {
    const planSelect = document.getElementById('planSelect');
    const selectedOption = planSelect.options[planSelect.selectedIndex];
    if (!selectedOption) return;
    const distance = selectedOption.getAttribute('data-distance') || 'marathon';
    document.getElementById('goalRaceLabel').textContent = getDistanceLabel(distance);
}

function getVDOT() {
    const mode = document.getElementById('tuningMode').value;

    if (mode === 'single') {
        const raceDist = document.getElementById('raceDistance').value;
        const timeSec = parseTimeInput(document.getElementById('raceTime').value);
        if (!timeSec) return null;
        const distMeters = getDistanceMeters(raceDist);
        return calculateVDOT(distMeters, timeSec / 60);
    }

    if (mode === 'allPbs') {
        const pbTimes = {
            '5k': parseTimeInput(document.getElementById('pb5k').value),
            '10k': parseTimeInput(document.getElementById('pb10k').value),
            'half': parseTimeInput(document.getElementById('pbHalf').value),
            'marathon': parseTimeInput(document.getElementById('pbMarathon').value)
        };
        return calculateAverageVDOT(pbTimes);
    }

    if (mode === 'goalTime') {
        const planSelect = document.getElementById('planSelect');
        const selectedOption = planSelect.options[planSelect.selectedIndex];
        if (!selectedOption) return null;
        const distance = selectedOption.getAttribute('data-distance') || 'marathon';
        const goalTimeSec = parseTimeInput(document.getElementById('goalTime').value);
        if (!goalTimeSec) return null;
        const distMeters = getDistanceMeters(distance);
        return calculateVDOT(distMeters, goalTimeSec / 60);
    }

    return null;
}

// ─── Chart ───
function renderChart(weeks, unit) {
    const ctx = document.getElementById('planChart').getContext('2d');
    const labels = weeks.map(w => `Week ${w.week_number}`);
    const factor = unit === 'mi' ? 0.621371 : 1;

    // Compute stats from days
    const stats = weeks.map(w => {
        const days = w.days || [];
        let total = 0, lt = 0, at = 0, aboveAt = 0;
        days.forEach(d => {
            if (d.stats) {
                total += d.stats.total || 0;
                lt += d.stats.lt || 0;
                at += d.stats.at || 0;
                aboveAt += d.stats.aboveAt || 0;
            }
        });
        return { total, lt, at, aboveAt };
    });

    if (myChart) myChart.destroy();

    Chart.defaults.color = '#333333';
    Chart.defaults.font.family = 'Outfit';

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Total Distance',
                    data: stats.map(s => (s.total * factor).toFixed(1)),
                    borderColor: '#333333', backgroundColor: '#333333',
                    borderWidth: 2, tension: 0.3, pointBackgroundColor: '#FFFFFF'
                },
                {
                    label: 'LT Distance',
                    data: stats.map(s => (s.lt * factor).toFixed(1)),
                    borderColor: '#FFD60A', backgroundColor: '#FFD60A',
                    borderWidth: 2, tension: 0.3, pointBackgroundColor: '#FFFFFF'
                },
                {
                    label: 'AT Distance',
                    data: stats.map(s => (s.at * factor).toFixed(1)),
                    borderColor: '#FF9500', backgroundColor: '#FF9500',
                    borderWidth: 2, tension: 0.3, pointBackgroundColor: '#FFFFFF'
                },
                {
                    label: 'VO2 Distance',
                    data: stats.map(s => (s.aboveAt * factor).toFixed(1)),
                    borderColor: '#FF3B30', backgroundColor: '#FF3B30',
                    borderWidth: 2, tension: 0.3, pointBackgroundColor: '#FFFFFF'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { color: '#333333' } },
                tooltip: {
                    padding: 10, backgroundColor: 'rgba(255,255,255,0.9)',
                    titleColor: '#333', bodyColor: '#333',
                    titleFont: { size: 13 }, bodyFont: { size: 12 },
                    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)'
                }
            },
            scales: {
                x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#666' } },
                y: {
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    title: { display: true, text: `Distance (${unit})`, color: '#666' },
                    ticks: { color: '#666' }
                }
            }
        }
    });
}

// ─── Plan Rendering ───
function renderPlan() {
    const vdot = getVDOT();
    const unit = document.getElementById('units').value;
    const conversion = unit === 'mi' ? 1.60934 : 1;

    // Display VDOT
    const vdotDisplay = document.getElementById('vdotDisplay');
    const vdotValue = document.getElementById('vdotValue');
    if (vdot) {
        vdotDisplay.style.display = 'inline-flex';
        vdotValue.textContent = vdot.toFixed(1);
    } else {
        vdotDisplay.style.display = 'none';
        vdotValue.textContent = '--';
    }

    // Calculate paces
    let pacesDisplay = {};
    if (vdot) {
        const pacesKm = calculatePacesFromVDOT(vdot);
        for (let k in pacesKm) {
            pacesDisplay[k] = pacesKm[k] * conversion;
        }

        // Render Pace Summary
        const paceTypes = [
            { key: 'easy', label: 'Easy (E)' },
            { key: 'marathon', label: 'Marathon (M)' },
            { key: 'threshold', label: 'Threshold (T)' },
            { key: 'interval', label: 'Interval (I)' },
            { key: 'repetition', label: 'Repetition (R)' }
        ];
        document.getElementById('paceSummary').innerHTML = paceTypes.map(p => `
            <div class="pace-chip">
                <span class="label">${p.label}</span>
                <span class="value">${formatTime(pacesDisplay[p.key])}/${unit}</span>
            </div>
        `).join('');
    } else {
        document.getElementById('paceSummary').innerHTML =
            '<div class="pace-chip"><span class="label">Enter valid times to see paces</span></div>';
    }

    // Render plan weeks
    if (currentPlanWeeks.length === 0) {
        document.getElementById('planContainer').innerHTML =
            '<div class="card" style="text-align:center;padding:40px;color:var(--text-secondary)">No plan selected or no weeks found.</div>';
        return;
    }

    const raceDate = new Date(document.getElementById('raceDate').value);
    const totalWeeks = currentPlanWeeks.length;

    // Chart
    const hasStats = currentPlanWeeks[0]?.days?.[0]?.stats;
    if (hasStats) {
        document.getElementById('planChart').style.display = 'block';
        renderChart(currentPlanWeeks, unit);
    } else {
        document.getElementById('planChart').style.display = 'none';
    }

    let planHtml = '';
    currentPlanWeeks.forEach((week, weekIndex) => {
        const weekNum = week.week_number;
        const weeksUntilRace = totalWeeks - weekNum;
        const weekStartDate = new Date(raceDate);
        weekStartDate.setDate(raceDate.getDate() - (weeksUntilRace * 7) - 6);

        let days = [...(week.days || [])];
        if (currentCustomizations[weekNum]) {
            const order = currentCustomizations[weekNum];
            const original = [...days];
            days = order.map(idx => original[idx]);
        }

        // Stats
        let weekStats = { total: 0, lt: 0, at: 0, aboveAt: 0 };
        (week.days || []).forEach(d => {
            if (d.stats) {
                weekStats.total += d.stats.total || 0;
                weekStats.lt += d.stats.lt || 0;
                weekStats.at += d.stats.at || 0;
                weekStats.aboveAt += d.stats.aboveAt || 0;
            }
        });

        const formatStat = val => (val * (unit === 'mi' ? 0.621371 : 1)).toFixed(1);
        let statsHtml = '';
        if (weekStats.total > 0) {
            statsHtml = `
                <div style="display:flex;gap:10px;font-size:0.8rem;margin-top:5px;opacity:0.8;">
                    <span style="color:var(--text-main)">Total: ${formatStat(weekStats.total)}${unit}</span>
                    ${weekStats.lt > 0 ? `<span style="color:#FFD60A">LT: ${formatStat(weekStats.lt)}</span>` : ''}
                    ${weekStats.at > 0 ? `<span style="color:#FF9F0A">AT: ${formatStat(weekStats.at)}</span>` : ''}
                    ${weekStats.aboveAt > 0 ? `<span style="color:#FF3B30">VO2: ${formatStat(weekStats.aboveAt)}</span>` : ''}
                </div>
            `;
        }

        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 6);
        const formatDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const weekDates = `${formatDate(weekStartDate)} – ${formatDate(weekEndDate)}`;

        let daysHtml = '';
        days.forEach((day, dayIndex) => {
            const dayDate = new Date(weekStartDate);
            dayDate.setDate(weekStartDate.getDate() + dayIndex);
            const dayDateStr = dayDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

            let desc = day.desc || '';
            if (day.pace && pacesDisplay[day.pace]) {
                const p = formatTime(pacesDisplay[day.pace]);
                desc += ` <span style="opacity:0.6;font-size:0.8em;">(${p}/${unit})</span>`;
            }

            daysHtml += `
                <div class="day-cell" draggable="true" data-week="${weekNum}" data-day="${dayIndex}">
                    <div class="day-date">${dayDateStr}</div>
                    <div class="day-name">${day.day || 'Day'}</div>
                    <div class="workout-type type-${day.class || 'easy'}">${day.type || ''}</div>
                    <div class="workout-detail">${desc}</div>
                </div>
            `;
        });

        planHtml += `
            <div class="week-card" data-week="${weekNum}">
                <div class="week-header">
                    <div>Week ${weekNum}</div>
                    <div class="week-dates">${weekDates}</div>
                    ${statsHtml}
                </div>
                <div class="days-grid">${daysHtml}</div>
            </div>
        `;
    });

    document.getElementById('planContainer').innerHTML = planHtml;
    setupDragDrop();
}

// ─── Drag & Drop ───
function setupDragDrop() {
    const dayCells = document.querySelectorAll('.day-cell[draggable="true"]');
    let draggedEl = null;

    dayCells.forEach(cell => {
        cell.addEventListener('dragstart', e => {
            draggedEl = cell;
            cell.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        cell.addEventListener('dragend', () => {
            cell.classList.remove('dragging');
            document.querySelectorAll('.day-cell.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        cell.addEventListener('dragover', e => {
            e.preventDefault();
            if (draggedEl && draggedEl !== cell && draggedEl.dataset.week === cell.dataset.week) {
                cell.classList.add('drag-over');
            }
        });

        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));

        cell.addEventListener('drop', e => {
            e.preventDefault();
            cell.classList.remove('drag-over');
            if (draggedEl && draggedEl !== cell && draggedEl.dataset.week === cell.dataset.week) {
                const weekNum = parseInt(cell.dataset.week);
                const grid = cell.closest('.days-grid');
                const cells = Array.from(grid.querySelectorAll('.day-cell'));
                const fromIdx = cells.indexOf(draggedEl);
                const toIdx = cells.indexOf(cell);

                if (fromIdx < toIdx) {
                    cell.after(draggedEl);
                } else {
                    cell.before(draggedEl);
                }

                saveOrderToDb(weekNum);
            }
        });
    });
}

async function saveOrderToDb(weekNum) {
    if (!currentUser) return;
    const planId = document.getElementById('planSelect').value;
    const grid = document.querySelector(`.week-card[data-week="${weekNum}"] .days-grid`);
    const cells = Array.from(grid.querySelectorAll('.day-cell'));
    const dayOrder = cells.map(c => parseInt(c.dataset.day));

    currentCustomizations[weekNum] = dayOrder;
    await saveUserCustomization(currentUser.id, planId, weekNum, dayOrder);
}

// ─── Tab Switching ───
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            const targetTab = document.getElementById(btn.dataset.tab);
            if (targetTab) targetTab.classList.add('active');
        });
    });
}

// ─── Create Plan ───
function setupCreatePlan() {
    const addWeekBtn = document.getElementById('addWeekBtn');
    const createPlanForm = document.getElementById('createPlanForm');
    const basePlanSelect = document.getElementById('basePlanSelect');

    // Populate "base on existing plan" dropdown
    if (basePlanSelect) {
        populateBasePlanDropdown();
        basePlanSelect.addEventListener('change', async () => {
            const planId = basePlanSelect.value;
            const container = document.getElementById('weekInputsContainer');
            container.innerHTML = '';

            if (!planId) {
                // Start from scratch — add one empty week
                container.appendChild(createWeekInput(1));
            } else {
                // Clone from existing plan
                const weeks = await loadPlanWeeks(planId);
                weeks.forEach((week, idx) => {
                    container.appendChild(createWeekInput(idx + 1, week.days));
                });
            }
        });
    }

    if (addWeekBtn) {
        addWeekBtn.addEventListener('click', () => {
            const container = document.getElementById('weekInputsContainer');
            const weekCount = container.querySelectorAll('.week-input-card').length + 1;
            container.appendChild(createWeekInput(weekCount));
        });
    }

    if (createPlanForm) {
        createPlanForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const submitBtn = createPlanForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';

            const weekCards = document.querySelectorAll('.week-input-card');
            const weeksData = [];

            weekCards.forEach(card => {
                const days = [];
                const dayEditors = card.querySelectorAll('.day-editor');
                dayEditors.forEach(editor => {
                    days.push(extractDayData(editor));
                });
                weeksData.push({ days });
            });

            const planData = {
                name: document.getElementById('newPlanName').value,
                distance: document.getElementById('newPlanDistance').value,
                durationWeeks: weeksData.length,
                createdBy: currentUser.id
            };

            const { error } = await createPlan(planData, weeksData);

            if (error) {
                submitBtn.textContent = 'Error! Try again';
                submitBtn.disabled = false;
            } else {
                submitBtn.textContent = '✓ Created!';
                await populatePlanDropdown();
                populateBasePlanDropdown();
                setTimeout(() => {
                    submitBtn.textContent = 'Create Plan';
                    submitBtn.disabled = false;
                    document.querySelector('[data-tab="planViewTab"]').click();
                }, 1500);
            }
        });
    }
}

function populateBasePlanDropdown() {
    const basePlanSelect = document.getElementById('basePlanSelect');
    if (!basePlanSelect) return;
    // Keep the "Start from scratch" option
    basePlanSelect.innerHTML = '<option value="">Start from scratch</option>';
    allPlans.forEach(plan => {
        const opt = document.createElement('option');
        opt.value = plan.id;
        opt.textContent = plan.name;
        basePlanSelect.appendChild(opt);
    });
}

// ─── Pace zone classification ───
function closestPaceZone(paceMinKm) {
    // Map user-entered pace (min/km as seconds) to closest training zone
    // These are rough middle-ground values; the VDOT will refine at display time
    const zones = [
        { key: 'easy', label: 'E' },
        { key: 'marathon', label: 'M' },
        { key: 'threshold', label: 'T' },
        { key: 'interval', label: 'I' },
        { key: 'repetition', label: 'R' }
    ];
    // Just return the key — the rendering will match to actual VDOT paces
    return paceMinKm; // we store raw pace, classification happens at render
}

// ─── Extract structured day data from editor DOM ───
function extractDayData(editor) {
    const dayName = editor.querySelector('.day-name-label').textContent;
    const workoutType = editor.querySelector('.workout-type-select').value;

    if (workoutType === 'easy') {
        const dist = parseFloat(editor.querySelector('.easy-distance')?.value) || 0;
        return {
            day: dayName,
            type: 'Easy',
            desc: `${dist} km Easy`,
            dist: dist,
            pace: 'easy',
            class: 'easy',
            stats: { total: dist, lt: 0, at: 0, aboveAt: 0 },
            structured: { workoutType: 'easy', distance: dist }
        };
    }

    // Session or Long Run — parse structured intervals
    const warmUp = parseStructuredValue(editor.querySelector('.warmup-section'));
    const coolDown = parseStructuredValue(editor.querySelector('.cooldown-section'));
    const sets = [];

    editor.querySelectorAll('.interval-set').forEach(setEl => {
        const duration = parseStructuredValue(setEl.querySelector('.interval-duration-section'));
        const pace = setEl.querySelector('.interval-pace-input')?.value || '';
        const rest = parseStructuredValue(setEl.querySelector('.interval-rest-section'));
        const repeats = parseInt(setEl.querySelector('.interval-repeats-input')?.value) || 1;
        sets.push({ duration, pace, rest, repeats });
    });

    // Build description
    let desc = '';
    let totalDist = 0;
    let qualityDist = 0;

    // Warm-up distance
    const wuDist = getDistanceFromStructured(warmUp);
    if (wuDist > 0) {
        desc += `${formatStructured(warmUp)} WU, `;
        totalDist += wuDist;
    }

    // Sets
    sets.forEach((set, i) => {
        const setDist = getDistanceFromStructured(set.duration);
        const restDist = getDistanceFromStructured(set.rest);
        const paceStr = set.pace ? ` @ ${set.pace}` : '';
        const repsStr = set.repeats > 1 ? `${set.repeats}×` : '';
        desc += `${repsStr}${formatStructured(set.duration)}${paceStr}`;
        if (restDist > 0 || set.rest.value) {
            desc += ` (${formatStructured(set.rest)} rest)`;
        }
        if (i < sets.length - 1) desc += ', ';

        totalDist += (setDist + restDist) * set.repeats;
        qualityDist += setDist * set.repeats;
    });

    // Cool-down distance
    const cdDist = getDistanceFromStructured(coolDown);
    if (cdDist > 0) {
        desc += `, ${formatStructured(coolDown)} CD`;
        totalDist += cdDist;
    }

    // Determine pace classification and stats
    const dominantPace = determineDominantPace(sets);
    const typeLabel = workoutType === 'long' ? 'Long' : 'Session';
    const typeClass = workoutType === 'long' ? 'long' : (dominantPace === 'threshold' || dominantPace === 'marathon' ? 'tempo' : 'interval');

    // Classify quality distance into stats buckets
    const stats = { total: totalDist, lt: 0, at: 0, aboveAt: 0 };
    if (dominantPace === 'marathon') stats.lt = qualityDist;
    else if (dominantPace === 'threshold') stats.at = qualityDist;
    else stats.aboveAt = qualityDist;

    return {
        day: dayName,
        type: typeLabel,
        desc: desc,
        dist: totalDist,
        pace: dominantPace || 'easy',
        class: typeClass,
        stats: stats,
        structured: { workoutType, warmUp, coolDown, sets }
    };
}

function parseStructuredValue(section) {
    if (!section) return { value: 0, unit: 'km' };
    const val = parseFloat(section.querySelector('.struct-value')?.value) || 0;
    const unit = section.querySelector('.struct-unit')?.value || 'km';
    return { value: val, unit };
}

function getDistanceFromStructured(sv) {
    if (!sv || !sv.value) return 0;
    if (sv.unit === 'km') return sv.value;
    if (sv.unit === 'm') return sv.value / 1000;
    if (sv.unit === 'min') return sv.value * 0.2; // rough ~5min/km estimate → 0.2 km/min
    if (sv.unit === 'sec') return (sv.value / 60) * 0.2;
    return sv.value;
}

function formatStructured(sv) {
    if (!sv || !sv.value) return '';
    return `${sv.value}${sv.unit}`;
}

function determineDominantPace(sets) {
    // Try to classify based on entered paces
    if (sets.length === 0) return 'easy';
    // Parse the first set's pace as min/km (e.g. "4:30")
    const firstPace = sets[0].pace;
    if (!firstPace) return 'easy';
    const paceSec = parseTimeInput(firstPace);
    if (!paceSec) return 'easy';
    // Rough classification by seconds/km
    if (paceSec >= 330) return 'easy';       // > 5:30/km
    if (paceSec >= 280) return 'marathon';   // > 4:40/km
    if (paceSec >= 240) return 'threshold';  // > 4:00/km
    if (paceSec >= 200) return 'interval';   // > 3:20/km
    return 'repetition';
}

function getClassFromType(type) {
    const t = type.toLowerCase();
    if (t.includes('tempo') || t.includes('threshold') || t === 'quality (t)') return 'tempo';
    if (t.includes('interval') || t === 'quality (i)') return 'interval';
    if (t.includes('long')) return 'long';
    if (t.includes('rest') || t.includes('recovery')) return 'rest';
    return 'easy';
}

// ─── Build a week input card ───
function createWeekInput(weekNumber, existingDays = null) {
    const card = document.createElement('div');
    card.className = 'week-input-card card';

    const header = document.createElement('div');
    header.className = 'week-input-header';
    header.innerHTML = `
        <h3>Week ${weekNumber}</h3>
        <button type="button" class="btn btn-sm btn-secondary remove-week-btn">✕ Remove</button>
    `;
    card.appendChild(header);

    const daysContainer = document.createElement('div');
    daysContainer.className = 'day-inputs';

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach((dayName, idx) => {
        const existingDay = existingDays ? existingDays[idx] : null;
        daysContainer.appendChild(createDayEditor(dayName, existingDay));
    });

    card.appendChild(daysContainer);

    header.querySelector('.remove-week-btn').addEventListener('click', () => {
        card.remove();
        document.querySelectorAll('.week-input-card h3').forEach((h, i) => h.textContent = `Week ${i + 1}`);
    });

    return card;
}

// ─── Build a single day editor ───
function createDayEditor(dayName, existingDay = null) {
    const editor = document.createElement('div');
    editor.className = 'day-editor';

    // Determine initial workout type from existing data
    let initialType = 'easy';
    if (existingDay) {
        const t = (existingDay.type || '').toLowerCase();
        const hasStructured = existingDay.structured;
        if (hasStructured) {
            initialType = hasStructured.workoutType;
        } else if (t.includes('rest') || t.includes('recovery') || t.includes('easy')) {
            initialType = 'easy';
        } else if (t.includes('long')) {
            initialType = 'long';
        } else {
            initialType = 'session';
        }
    }

    // Day header row
    const headerRow = document.createElement('div');
    headerRow.className = 'day-editor-header';
    headerRow.innerHTML = `
        <span class="day-name-label">${dayName}</span>
        <select class="workout-type-select">
            <option value="easy" ${initialType === 'easy' ? 'selected' : ''}>Easy / Recovery</option>
            <option value="session" ${initialType === 'session' ? 'selected' : ''}>Session</option>
            <option value="long" ${initialType === 'long' ? 'selected' : ''}>Long Run</option>
        </select>
    `;
    editor.appendChild(headerRow);

    // Fields container (changes based on workout type)
    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'day-fields-container';
    editor.appendChild(fieldsContainer);

    // Wire type change
    const typeSelect = headerRow.querySelector('.workout-type-select');
    typeSelect.addEventListener('change', () => {
        renderDayFields(fieldsContainer, typeSelect.value, null);
    });

    // Initial render
    renderDayFields(fieldsContainer, initialType, existingDay);

    return editor;
}

function renderDayFields(container, workoutType, existingDay) {
    container.innerHTML = '';

    if (workoutType === 'easy') {
        const dist = existingDay?.dist || existingDay?.structured?.distance || '';
        container.innerHTML = `
            <div class="easy-fields">
                <div class="field-row">
                    <label>Distance (km)</label>
                    <input type="number" class="easy-distance" value="${dist}" placeholder="e.g. 10" step="0.1" min="0">
                </div>
            </div>
        `;
    } else {
        // Session or Long Run — structured input
        const structured = existingDay?.structured;
        const warmUp = structured?.warmUp || { value: '', unit: 'km' };
        const coolDown = structured?.coolDown || { value: '', unit: 'km' };
        const sets = structured?.sets || [{ duration: { value: '', unit: 'km' }, pace: '', rest: { value: '', unit: 'min' }, repeats: 1 }];

        // Warm-up
        const warmUpSection = createStructuredInput('Warm Up', warmUp, 'warmup-section');
        container.appendChild(warmUpSection);

        // Interval sets container
        const setsContainer = document.createElement('div');
        setsContainer.className = 'interval-sets-container';

        sets.forEach((set, idx) => {
            setsContainer.appendChild(createIntervalSet(idx, set));
        });

        container.appendChild(setsContainer);

        // Add set button
        const addSetBtn = document.createElement('button');
        addSetBtn.type = 'button';
        addSetBtn.className = 'btn btn-sm btn-secondary add-set-btn';
        addSetBtn.textContent = '+ Add Set';
        addSetBtn.addEventListener('click', () => {
            const idx = setsContainer.querySelectorAll('.interval-set').length;
            setsContainer.appendChild(createIntervalSet(idx));
        });
        container.appendChild(addSetBtn);

        // Cool-down
        const coolDownSection = createStructuredInput('Cool Down', coolDown, 'cooldown-section');
        container.appendChild(coolDownSection);
    }
}

function createStructuredInput(label, value, className) {
    const section = document.createElement('div');
    section.className = `structured-input-group ${className}`;
    section.innerHTML = `
        <label>${label}</label>
        <div class="struct-row">
            <input type="number" class="struct-value" value="${value?.value || ''}" placeholder="0" step="0.1" min="0">
            <select class="struct-unit">
                <option value="km" ${value?.unit === 'km' ? 'selected' : ''}>km</option>
                <option value="m" ${value?.unit === 'm' ? 'selected' : ''}>m</option>
                <option value="min" ${value?.unit === 'min' ? 'selected' : ''}>min</option>
            </select>
        </div>
    `;
    return section;
}

function createIntervalSet(index, data = null) {
    const set = document.createElement('div');
    set.className = 'interval-set';

    const dur = data?.duration || { value: '', unit: 'km' };
    const pace = data?.pace || '';
    const rest = data?.rest || { value: '', unit: 'min' };
    const repeats = data?.repeats || 1;

    set.innerHTML = `
        <div class="interval-set-header">
            <span class="interval-set-label">Set ${index + 1}</span>
            ${index > 0 ? '<button type="button" class="btn-remove-set" title="Remove set">✕</button>' : ''}
        </div>
        <div class="interval-set-fields">
            <div class="structured-input-group interval-duration-section">
                <label>Interval</label>
                <div class="struct-row">
                    <input type="number" class="struct-value" value="${dur.value || ''}" placeholder="0" step="0.1" min="0">
                    <select class="struct-unit">
                        <option value="km" ${dur.unit === 'km' ? 'selected' : ''}>km</option>
                        <option value="m" ${dur.unit === 'm' ? 'selected' : ''}>m</option>
                        <option value="min" ${dur.unit === 'min' ? 'selected' : ''}>min</option>
                        <option value="sec" ${dur.unit === 'sec' ? 'selected' : ''}>sec</option>
                    </select>
                </div>
            </div>
            <div class="structured-input-group">
                <label>Pace (min/km)</label>
                <input type="text" class="interval-pace-input" value="${pace}" placeholder="e.g. 4:30">
            </div>
            <div class="structured-input-group interval-rest-section">
                <label>Rest</label>
                <div class="struct-row">
                    <input type="number" class="struct-value" value="${rest.value || ''}" placeholder="0" step="0.1" min="0">
                    <select class="struct-unit">
                        <option value="min" ${rest.unit === 'min' ? 'selected' : ''}>min</option>
                        <option value="sec" ${rest.unit === 'sec' ? 'selected' : ''}>sec</option>
                        <option value="m" ${rest.unit === 'm' ? 'selected' : ''}>m</option>
                        <option value="km" ${rest.unit === 'km' ? 'selected' : ''}>km</option>
                    </select>
                </div>
            </div>
            <div class="structured-input-group">
                <label>Repeats</label>
                <input type="number" class="interval-repeats-input" value="${repeats}" min="1" step="1">
            </div>
        </div>
    `;

    const removeBtn = set.querySelector('.btn-remove-set');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            set.remove();
            // Renumber remaining sets
            set.closest('.interval-sets-container')?.querySelectorAll('.interval-set').forEach((s, i) => {
                s.querySelector('.interval-set-label').textContent = `Set ${i + 1}`;
            });
        });
    }

    return set;
}

// ─── Init ───
async function init() {
    // Setup tabs
    setupTabs();
    setupCreatePlan();

    // Check auth
    const session = await getSession();
    currentUser = session?.user || null;
    renderAuthUI(currentUser);
    showApp(!!currentUser);

    if (!currentUser) return;

    // Load profile paces
    await loadUserProfile();

    // Load plans
    await populatePlanDropdown();

    // Event listeners
    document.getElementById('tuningMode').addEventListener('change', () => {
        updateTuningSection();
        renderPlan();
    });

    document.getElementById('planSelect').addEventListener('change', async () => {
        updateGoalRaceLabel();
        await loadAndRenderPlan();
    });

    document.getElementById('savePacesBtn').addEventListener('click', handleSavePaces);

    const inputs = ['raceDistance', 'raceTime', 'units', 'raceDate', 'pb5k', 'pb10k', 'pbHalf', 'pbMarathon', 'goalTime'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            ['input', 'change'].forEach(evt => {
                el.addEventListener(evt, () => renderPlan());
            });
        }
    });

    // Listen for auth state changes (for OAuth redirect)
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            currentUser = session.user;
            renderAuthUI(currentUser);
            showApp(true);

            // Ensure profile exists
            const profile = await loadProfile(currentUser.id);
            if (!profile) {
                const meta = currentUser.user_metadata || {};
                await saveProfile(currentUser.id, {
                    displayName: meta.full_name || meta.name || currentUser.email,
                    avatarUrl: meta.avatar_url || meta.picture || '',
                    tuningMode: 'single',
                    singlePb: { distance: '5k', time: '' },
                    allPbs: { '5k': '', '10k': '', half: '', marathon: '' },
                    goalTime: ''
                });
            }

            await loadUserProfile();
            await populatePlanDropdown();
        }
    });

    // Add one default week to create plan form
    const container = document.getElementById('weekInputsContainer');
    if (container && container.children.length === 0) {
        container.appendChild(createWeekInput(1));
    }
}

init();
