import { supabase, signInWithGoogle, signOut, getUser, getSession } from './supabase.js';
import {
    calculateVDOT, calculatePacesFromVDOT, calculateAverageVDOT,
    getDistanceMeters, getDistanceLabel, formatTime, parseTimeInput
} from './paces.js';
import {
    loadPlans, loadPlanWeeks, loadUserCustomizations,
    saveUserCustomization, createPlan, loadProfile, saveProfile,
    loadAdminStatus, loadUserEvents, createUserEvent, updateUserEvent,
    deleteUserEvent, commitToPlan, uncommitFromPlan, getCommittedPlan,
    loadUserWorkouts, updateUserWorkout, createPlanAdjustment, wipeSandboxData
} from './db.js';
import { runAdjustmentEngine } from './engine/adjustment.js';
    deletePlan, updatePlanWeek
} from './db.js';

// ─── State ───
let currentUser = null;
let allPlans = [];
let currentPlanWeeks = [];
let currentCustomizations = {};
let myChart = null;
let isAdmin = false;
let adminModeEnabled = false;
let allUserEvents = [];
let timelineChart = null;
let committedPlanId = null;

// Sandbox Mode State
let isSandboxMode = false;
let realCurrentUser = null;
const SANDBOX_USER_ID = '99999999-9999-9999-9999-999999999999';

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
                <div id="adminToggleArea"></div>
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

function renderAdminToggle() {
    const area = document.getElementById('adminToggleArea');
    if (!area) return;
    if (!isAdmin) {
        area.innerHTML = '';
        return;
    }
    area.innerHTML = `
        <div class="admin-toggle-container">
            <span class="admin-toggle-label">Admin</span>
            <label class="admin-toggle">
                <input type="checkbox" id="adminModeCheckbox" ${adminModeEnabled ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
    `;
    document.getElementById('adminModeCheckbox').addEventListener('change', (e) => {
        adminModeEnabled = e.target.checked;
        updateAdminUI();
    });
}

function updateAdminUI() {
    const adminActions = document.getElementById('adminPlanActions');
    if (adminActions) {
        if (adminModeEnabled) {
            adminActions.style.display = 'flex';
            adminActions.innerHTML = `
                <button class="btn btn-sm btn-danger" id="adminDeletePlanBtn" title="Delete this plan">🗑️</button>
                <div class="sandbox-toggle-container" style="margin-left: 10px; display: flex; align-items: center; gap: 5px;">
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">Sandbox</span>
                    <label class="admin-toggle">
                        <input type="checkbox" id="sandboxModeCheckbox" ${isSandboxMode ? 'checked' : ''}>
                        <span class="toggle-slider" style="background-color: var(--secondary-color);"></span>
                    </label>
                </div>
            `;
            document.getElementById('adminDeletePlanBtn').addEventListener('click', handleDeletePlan);
            document.getElementById('sandboxModeCheckbox').addEventListener('change', async (e) => {
                isSandboxMode = e.target.checked;
                await toggleSandboxMode(isSandboxMode);
            });
        } else {
            adminActions.style.display = 'none';
            adminActions.innerHTML = '';
        }
    }
}

async function toggleSandboxMode(enabled) {
    if (enabled) {
        if (!realCurrentUser) realCurrentUser = currentUser;
        currentUser = { ...realCurrentUser, id: SANDBOX_USER_ID, email: 'sandbox@velocity.app' };
    } else {
        if (realCurrentUser) {
            currentUser = realCurrentUser;
            realCurrentUser = null;
        }
    }
    
    // Update Banner
    let banner = document.getElementById('sandboxBanner');
    if (enabled) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'sandboxBanner';
            banner.style.cssText = 'position: sticky; top: 0; background: #FF9F0A; color: #000; text-align: center; padding: 5px; font-weight: bold; z-index: 1000; display: flex; justify-content: center; gap: 15px; align-items: center;';
            banner.innerHTML = `
                <span>SANDBOX MODE ACTIVE</span>
                <button id="wipeSandboxBtn" style="background: transparent; border: 1px solid #000; color: #000; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Wipe Data</button>
            `;
            document.body.prepend(banner);
            
            document.getElementById('wipeSandboxBtn').addEventListener('click', async () => {
                if(confirm('Wipe all sandbox data?')) {
                    await wipeSandboxData(SANDBOX_USER_ID);
                    alert('Sandbox wiped!');
                    await loadAndRenderTimeline();
                    renderCommitButton();
                    const commit = await getCommittedPlan(currentUser.id);
                    if(commit) renderUserSchedule(commit.id);
                    else { const mc = document.querySelector('.main-content'); if(mc && mc.querySelector('.schedule-list')) location.reload(); }
                }
            });
        }
    } else {
        if (banner) banner.remove();
    }

    // Reload UI state with new user ID
    await loadAndRenderTimeline();
    renderCommitButton();
    const commit = await getCommittedPlan(currentUser.id);
    if (commit) {
        // If we were on schedule view, re-render it
        if (document.querySelector('.schedule-list')) {
            renderUserSchedule(commit.id);
        }
    } else {
        // If we were on schedule view but now have no commit, go back to plan view
        if (document.querySelector('.schedule-list')) {
            location.reload();
        }
    }
}

async function handleDeletePlan() {
    const planId = document.getElementById('planSelect').value;
    if (!planId) return;
    const planName = document.getElementById('planSelect').selectedOptions[0]?.textContent || 'this plan';
    if (!confirm(`Are you sure you want to delete "${planName}"? This action cannot be undone.`)) return;

    const { error } = await deletePlan(planId);
    if (error) {
        alert('Failed to delete plan: ' + (error.message || 'Unknown error'));
    } else {
        await populatePlanDropdown();
        populateBasePlanDropdown();
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

    try {
        currentPlanWeeks = await loadPlanWeeks(planId);
        if (currentUser) {
            currentCustomizations = await loadUserCustomizations(currentUser.id, planId);
        } else {
            currentCustomizations = {};
        }
    } catch (err) {
        console.error('Error loading plan:', err);
        currentPlanWeeks = [];
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

    Chart.defaults.color = '#98989D';
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif';

    // Get health overlays
    const raceDate = new Date(document.getElementById('raceDate').value);
    const healthAnnotations = getHealthOverlaysForPlanChart(weeks, raceDate);

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Total Distance',
                    data: stats.map(s => (s.total * factor).toFixed(1)),
                    borderColor: '#F5F5F7', backgroundColor: '#F5F5F7',
                    borderWidth: 2, tension: 0.3, pointBackgroundColor: '#1C1C1E'
                },
                {
                    label: 'LT (M pace)',
                    data: stats.map(s => (s.lt * factor).toFixed(1)),
                    borderColor: '#FF9F0A', backgroundColor: '#FF9F0A',
                    borderWidth: 2, tension: 0.3, pointBackgroundColor: '#1C1C1E'
                },
                {
                    label: 'AT (M→T)',
                    data: stats.map(s => (s.at * factor).toFixed(1)),
                    borderColor: '#0A84FF', backgroundColor: '#0A84FF',
                    borderWidth: 2, tension: 0.3, pointBackgroundColor: '#1C1C1E'
                },
                {
                    label: 'VO2 (I & R)',
                    data: stats.map(s => (s.aboveAt * factor).toFixed(1)),
                    borderColor: '#FF453A', backgroundColor: '#FF453A',
                    borderWidth: 2, tension: 0.3, pointBackgroundColor: '#1C1C1E'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { color: '#98989D' } },
                tooltip: {
                    padding: 10, backgroundColor: 'rgba(44,44,46,0.95)',
                    titleColor: '#F5F5F7', bodyColor: '#F5F5F7',
                    titleFont: { size: 13 }, bodyFont: { size: 12 },
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
                },
                annotation: {
                    annotations: healthAnnotations
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#636366' } },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    title: { display: true, text: `Distance (${unit})`, color: '#636366' },
                    ticks: { color: '#636366' }
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
                container.appendChild(createWeekInput(1));
            } else {
                const weeks = await loadPlanWeeks(planId);
                weeks.forEach((week, idx) => {
                    container.appendChild(createWeekInput(idx + 1, week.days));
                });
            }
            updateCopyFromDropdown();
        });
    }

    if (addWeekBtn) {
        addWeekBtn.addEventListener('click', () => {
            const container = document.getElementById('weekInputsContainer');
            const weekCount = container.querySelectorAll('.week-input-card').length + 1;
            const copyFromSelect = document.getElementById('copyFromWeekSelect');
            const copyFromWeek = copyFromSelect ? copyFromSelect.value : '';

            if (copyFromWeek) {
                // Clone from an existing week
                const sourceWeekIdx = parseInt(copyFromWeek) - 1;
                const sourceCard = container.querySelectorAll('.week-input-card')[sourceWeekIdx];
                if (sourceCard) {
                    // Extract day data from source week
                    const sourceDayEditors = sourceCard.querySelectorAll('.day-editor');
                    const clonedDays = [];
                    sourceDayEditors.forEach(editor => {
                        clonedDays.push(extractDayData(editor));
                    });
                    container.appendChild(createWeekInput(weekCount, clonedDays));
                } else {
                    container.appendChild(createWeekInput(weekCount));
                }
            } else {
                container.appendChild(createWeekInput(weekCount));
            }

            updateCopyFromDropdown();
        });
    }

    if (createPlanForm) {
        createPlanForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const submitBtn = createPlanForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
            submitBtn.style.background = '';

            try {
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

                console.log('Creating plan:', planData, 'weeks:', weeksData.length);
                const result = await createPlan(planData, weeksData);
                console.log('Create plan result:', result);

                if (result.error) {
                    const errMsg = result.error.message || result.error.details || JSON.stringify(result.error);
                    console.error('Plan creation error:', result.error);
                    submitBtn.textContent = `Error: ${errMsg}`;
                    submitBtn.style.background = 'var(--accent-red)';
                    submitBtn.disabled = false;
                    setTimeout(() => {
                        submitBtn.textContent = 'Save Plan';
                        submitBtn.style.background = '';
                    }, 4000);
                } else {
                    submitBtn.textContent = '✓ Saved!';
                    submitBtn.style.background = 'var(--accent-green)';
                    await populatePlanDropdown();
                    populateBasePlanDropdown();
                    setTimeout(() => {
                        submitBtn.textContent = 'Save Plan';
                        submitBtn.style.background = '';
                        submitBtn.disabled = false;
                        document.querySelector('[data-tab="planViewTab"]').click();
                    }, 1500);
                }
            } catch (err) {
                console.error('Plan creation threw:', err);
                submitBtn.textContent = `Error: ${err.message || 'Unknown error'}`;
                submitBtn.style.background = 'var(--accent-red)';
                submitBtn.disabled = false;
                setTimeout(() => {
                    submitBtn.textContent = 'Save Plan';
                    submitBtn.style.background = '';
                }, 4000);
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

// ─── VDOT Pace Zone helpers ───
const PACE_ZONES = [
    { key: 'easy', label: 'E (Easy)', short: 'E' },
    { key: 'marathon', label: 'M (Marathon)', short: 'M' },
    { key: 'threshold', label: 'T (Threshold)', short: 'T' },
    { key: 'interval', label: 'I (Interval)', short: 'I' },
    { key: 'repetition', label: 'R (Repetition)', short: 'R' }
];

function formatPaceWithOffset(zone, offsetSec) {
    const z = PACE_ZONES.find(p => p.key === zone);
    const label = z ? z.short : zone.toUpperCase();
    if (!offsetSec || offsetSec === 0) return `@ ${label}`;
    const sign = offsetSec > 0 ? '+' : '';
    return `@ ${label} ${sign}${offsetSec}s`;
}

function paceZoneToStats(zone) {
    if (zone === 'marathon') return 'lt';
    if (zone === 'threshold') return 'at';
    if (zone === 'interval' || zone === 'repetition') return 'aboveAt';
    return null; // easy doesn't count as quality
}

function getClassFromPaceZone(zone) {
    if (zone === 'marathon' || zone === 'threshold') return 'tempo';
    if (zone === 'interval' || zone === 'repetition') return 'interval';
    return 'easy';
}

// ─── Extract all workouts from a day editor into one day data object ───
function extractDayData(dayEditor) {
    const dayName = dayEditor.querySelector('.day-name-label').textContent;
    const workoutCards = dayEditor.querySelectorAll('.workout-card');
    const workouts = [];
    let totalDist = 0;
    let stats = { total: 0, lt: 0, at: 0, aboveAt: 0 };
    let allDescs = [];
    let dominantType = 'Easy';
    let dominantClass = 'easy';
    let dominantPace = 'easy';

    workoutCards.forEach(card => {
        const wo = extractWorkoutData(card);
        workouts.push(wo);
        totalDist += wo.dist;
        stats.total += wo.stats.total;
        stats.lt += wo.stats.lt;
        stats.at += wo.stats.at;
        stats.aboveAt += wo.stats.aboveAt;
        if (wo.desc) allDescs.push(wo.desc);
        // The most "intense" workout type wins
        if (wo.type !== 'Easy') {
            dominantType = wo.type;
            dominantClass = wo.class;
            dominantPace = wo.pace;
        }
    });

    return {
        day: dayName,
        type: dominantType,
        desc: allDescs.join(' + '),
        dist: totalDist,
        pace: dominantPace,
        class: dominantClass,
        stats: stats,
        structured: { workouts }
    };
}

function extractWorkoutData(card) {
    const workoutType = card.querySelector('.workout-type-select')?.value || 'easy';
    const description = card.querySelector('.workout-desc-input')?.value || '';

    // Get user's actual VDOT paces for rest distance calculation
    const vdot = getVDOT();
    const userPaces = vdot ? calculatePacesFromVDOT(vdot) : null;

    if (workoutType === 'rest') {
        return {
            type: 'Rest',
            desc: description || 'Rest',
            dist: 0,
            pace: 'easy',
            class: 'rest',
            stats: { total: 0, lt: 0, at: 0, aboveAt: 0 },
            structured: { workoutType: 'rest', description }
        };
    }

    if (workoutType === 'easy') {
        const dist = parseFloat(card.querySelector('.easy-distance')?.value) || 0;
        const userDesc = description || `${dist} km Easy`;
        return {
            type: 'Easy',
            desc: userDesc,
            dist: dist,
            pace: 'easy',
            class: 'easy',
            stats: { total: dist, lt: 0, at: 0, aboveAt: 0 },
            structured: { workoutType: 'easy', distance: dist, description }
        };
    }

    // Session, Long Run, or Hills
    const warmUp = parseStructuredValue(card.querySelector('.warmup-section'));
    const coolDown = parseStructuredValue(card.querySelector('.cooldown-section'));
    const items = []; // mixed array of standalone sets and groups

    // Extract from the interval-sets-container children
    const setsContainer = card.querySelector('.interval-sets-container');
    if (setsContainer) {
        Array.from(setsContainer.children).forEach(child => {
            if (child.classList.contains('interval-group')) {
                // Group
                const groupRepeats = parseInt(child.querySelector('.group-repeats-input')?.value) || 1;
                const setRest = parseStructuredValue(child.querySelector('.group-rest-section'));
                const setRestType = child.querySelector('.group-rest-type')?.value || 'standing';
                const intervals = [];
                child.querySelectorAll('.interval-item').forEach(itemEl => {
                    intervals.push(extractIntervalData(itemEl));
                });
                items.push({ type: 'group', repeats: groupRepeats, setRest, setRestType, intervals });
            } else if (child.classList.contains('interval-set')) {
                // Standalone set
                const data = extractIntervalData(child);
                items.push({ type: 'set', ...data });
            }
        });
    }

    // Build auto description + distance + stats
    let autoDesc = '';
    let totalDist = 0;
    let qualityDist = {};

    const wuDist = getDistanceFromStructured(warmUp);
    if (wuDist > 0) {
        autoDesc += `${formatStructured(warmUp)} WU, `;
        totalDist += wuDist;
    }

    items.forEach((item, i) => {
        if (item.type === 'group') {
            const R = item.repeats;
            const repsStr = R > 1 ? `${R}×` : '';
            let innerParts = [];
            let innerDist = 0;
            item.intervals.forEach(iv => {
                const d = getDistanceFromStructured(iv.duration);
                const rd = getRestDistance(iv.rest, iv.restType, userPaces);
                innerDist += d + rd;
                const bucket = paceZoneToStats(iv.zone);
                if (bucket) qualityDist[bucket] = (qualityDist[bucket] || 0) + d * R;
                innerParts.push(`${formatStructured(iv.duration)} ${formatPaceWithOffset(iv.zone, iv.offset)}`);
            });
            const setRestDist = getRestDistance(item.setRest, item.setRestType, userPaces);
            totalDist += R * innerDist + (R - 1) * setRestDist;
            autoDesc += `${repsStr}(${innerParts.join(' + ')})`;
            if (item.setRest?.value) {
                const rtl = item.setRestType === 'standing' ? 'standing' : item.setRestType === 'float' ? 'float' : 'jog';
                autoDesc += ` [${formatStructured(item.setRest)} ${rtl} between]`;
            }
        } else {
            // Standalone set
            const setDist = getDistanceFromStructured(item.duration);
            const restDist = getRestDistance(item.rest, item.restType, userPaces);
            const paceStr = formatPaceWithOffset(item.zone, item.offset);
            const repsStr = item.repeats > 1 ? `${item.repeats}×` : '';
            autoDesc += `${repsStr}${formatStructured(item.duration)} ${paceStr}`;
            if (item.rest?.value) {
                const rtl = item.restType === 'standing' ? 'standing' : item.restType === 'float' ? 'float' : 'jog';
                autoDesc += ` (${formatStructured(item.rest)} ${rtl})`;
            }
            totalDist += (setDist + restDist) * (item.repeats || 1);
            const bucket = paceZoneToStats(item.zone);
            if (bucket) qualityDist[bucket] = (qualityDist[bucket] || 0) + setDist * (item.repeats || 1);
        }
        if (i < items.length - 1) autoDesc += ', ';
    });

    const cdDist = getDistanceFromStructured(coolDown);
    if (cdDist > 0) {
        autoDesc += `, ${formatStructured(coolDown)} CD`;
        totalDist += cdDist;
    }

    const finalDesc = description || autoDesc;
    const firstZone = items.length > 0
        ? (items[0].type === 'group' ? (items[0].intervals[0]?.zone || 'easy') : (items[0].zone || 'easy'))
        : 'easy';
    const typeLabel = workoutType === 'long' ? 'Long' : workoutType === 'hills' ? 'Hills' : 'Session';
    const typeClass = workoutType === 'long' ? 'long' : workoutType === 'hills' ? 'interval' : getClassFromPaceZone(firstZone);

    return {
        type: typeLabel,
        desc: finalDesc,
        dist: totalDist,
        pace: firstZone,
        class: typeClass,
        stats: {
            total: totalDist,
            lt: qualityDist.lt || 0,
            at: qualityDist.at || 0,
            aboveAt: qualityDist.aboveAt || 0
        },
        structured: { workoutType, description, warmUp, coolDown, sets: items }
    };
}

// Extract duration/zone/offset/rest/restType/repeats from a single interval element
function extractIntervalData(el) {
    const duration = parseStructuredValue(el.querySelector('.interval-duration-section'));
    const zone = el.querySelector('.interval-zone-select')?.value || 'easy';
    const offset = parseInt(el.querySelector('.interval-offset-input')?.value) || 0;
    const rest = parseStructuredValue(el.querySelector('.interval-rest-section'));
    const restType = el.querySelector('.interval-rest-type')?.value || 'jog';
    const repeats = parseInt(el.querySelector('.interval-repeats-input')?.value) || 1;
    return { duration, zone, offset, rest, restType, repeats };
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
    if (sv.unit === 'min') return sv.value * 0.2;
    if (sv.unit === 'sec') return (sv.value / 60) * 0.2;
    return sv.value;
}

// Rest distance depends on rest type and the user's actual paces:
// - Standing: 0 km (no movement)
// - Jog: user's Easy pace + 60s/km
// - Float: user's Threshold pace + 45s/km
function getRestDistance(sv, restType, userPaces) {
    if (!sv || !sv.value) return 0;
    if (restType === 'standing') return 0;

    // For distance-based rests, the user runs that distance
    if (sv.unit === 'km') return sv.value;
    if (sv.unit === 'm') return sv.value / 1000;

    // For time-based rests, convert using user's actual pace
    let paceSecPerKm;
    if (restType === 'float') {
        // Float = Threshold pace + 45s/km
        paceSecPerKm = userPaces ? (userPaces.threshold + 45) : 300; // fallback ~5:00/km
    } else {
        // Jog = Easy pace + 60s/km
        paceSecPerKm = userPaces ? (userPaces.easy + 60) : 390; // fallback ~6:30/km
    }

    const minutes = sv.unit === 'min' ? sv.value : sv.value / 60;
    return minutes / (paceSecPerKm / 60); // minutes / (min/km) = km
}

function formatStructured(sv) {
    if (!sv || !sv.value) return '';
    return `${sv.value}${sv.unit}`;
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
        updateCopyFromDropdown();
    });

    return card;
}

function updateCopyFromDropdown() {
    const select = document.getElementById('copyFromWeekSelect');
    if (!select) return;
    const weekCount = document.querySelectorAll('.week-input-card').length;
    select.innerHTML = '<option value="">Blank</option>';
    for (let i = 1; i <= weekCount; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Copy Week ${i}`;
        select.appendChild(opt);
    }
}

// ─── Day Editor (multi-workout container) ───
function createDayEditor(dayName, existingDay = null) {
    const editor = document.createElement('div');
    editor.className = 'day-editor';

    // Day header
    const headerRow = document.createElement('div');
    headerRow.className = 'day-editor-header';
    headerRow.innerHTML = `<span class="day-name-label">${dayName}</span>`;
    editor.appendChild(headerRow);

    // Workouts container
    const workoutsContainer = document.createElement('div');
    workoutsContainer.className = 'workouts-container';
    editor.appendChild(workoutsContainer);

    // Add workout button (hidden initially, shown after first workout is "done")
    const addWorkoutBtn = document.createElement('button');
    addWorkoutBtn.type = 'button';
    addWorkoutBtn.className = 'btn btn-sm btn-secondary add-workout-btn';
    addWorkoutBtn.textContent = '+ Add Workout';
    addWorkoutBtn.style.display = 'none';
    addWorkoutBtn.addEventListener('click', () => {
        const woCard = createWorkoutCard(workoutsContainer, addWorkoutBtn);
        workoutsContainer.appendChild(woCard);
        addWorkoutBtn.style.display = 'none';
    });
    editor.appendChild(addWorkoutBtn);

    // Populate from existing data
    if (existingDay?.structured?.workouts && existingDay.structured.workouts.length > 0) {
        // Multi-workout format
        existingDay.structured.workouts.forEach(wo => {
            const woCard = createWorkoutCard(workoutsContainer, addWorkoutBtn, wo);
            workoutsContainer.appendChild(woCard);
        });
        // Collapse all existing workouts
        workoutsContainer.querySelectorAll('.workout-card').forEach(card => {
            collapseWorkout(card, addWorkoutBtn);
        });
    } else if (existingDay) {
        // Legacy single-workout format
        const woCard = createWorkoutCard(workoutsContainer, addWorkoutBtn, {
            structured: existingDay.structured || { workoutType: 'easy' },
            type: existingDay.type,
            desc: existingDay.desc,
            dist: existingDay.dist,
        });
        workoutsContainer.appendChild(woCard);
    } else {
        // New empty day — one blank workout
        const woCard = createWorkoutCard(workoutsContainer, addWorkoutBtn);
        workoutsContainer.appendChild(woCard);
    }

    return editor;
}

// ─── Single Workout Card ───
function createWorkoutCard(workoutsContainer, addWorkoutBtn, existingData = null) {
    const card = document.createElement('div');
    card.className = 'workout-card';

    // Determine initial type
    let initialType = 'easy';
    if (existingData?.structured) {
        initialType = existingData.structured.workoutType || 'easy';
    } else if (existingData) {
        const t = (existingData.type || '').toLowerCase();
        if (t.includes('rest') && !t.includes('recovery')) initialType = 'rest';
        else if (t.includes('hill')) initialType = 'hills';
        else if (t.includes('long')) initialType = 'long';
        else if (!t.includes('easy') && !t.includes('recovery')) initialType = 'session';
    }

    const existingDesc = existingData?.structured?.description || existingData?.desc || '';

    // Editable view
    const editView = document.createElement('div');
    editView.className = 'workout-edit-view';

    // Top row: type + description
    const topRow = document.createElement('div');
    topRow.className = 'workout-top-row';
    topRow.innerHTML = `
        <select class="workout-type-select">
            <option value="rest" ${initialType === 'rest' ? 'selected' : ''}>Rest</option>
            <option value="easy" ${initialType === 'easy' ? 'selected' : ''}>Easy / Recovery</option>
            <option value="session" ${initialType === 'session' ? 'selected' : ''}>Session</option>
            <option value="long" ${initialType === 'long' ? 'selected' : ''}>Long Run</option>
            <option value="hills" ${initialType === 'hills' ? 'selected' : ''}>Hills</option>
        </select>
        <input type="text" class="workout-desc-input" placeholder="Description (optional)" value="${escapeHtml(existingDesc)}">
    `;
    editView.appendChild(topRow);

    // Fields container
    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'workout-fields-container';
    editView.appendChild(fieldsContainer);

    // Action row
    const actionRow = document.createElement('div');
    actionRow.className = 'workout-action-row';
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'btn btn-sm btn-primary workout-done-btn';
    doneBtn.textContent = '✓ Done';
    actionRow.appendChild(doneBtn);

    // Remove button (if not the first workout)
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-sm btn-secondary workout-remove-btn';
    removeBtn.textContent = '✕ Remove';
    removeBtn.addEventListener('click', () => {
        card.remove();
        // Show add button if there's at least one collapsed workout
        if (workoutsContainer.querySelectorAll('.workout-card').length === 0) {
            // Add back a blank workout
            const newCard = createWorkoutCard(workoutsContainer, addWorkoutBtn);
            workoutsContainer.appendChild(newCard);
        }
        addWorkoutBtn.style.display = 'inline-flex';
    });
    actionRow.appendChild(removeBtn);

    editView.appendChild(actionRow);
    card.appendChild(editView);

    // Collapsed summary view (hidden initially)
    const summaryView = document.createElement('div');
    summaryView.className = 'workout-summary-view';
    summaryView.style.display = 'none';
    card.appendChild(summaryView);

    // Wire type change
    const typeSelect = topRow.querySelector('.workout-type-select');
    typeSelect.addEventListener('change', () => {
        renderWorkoutFields(fieldsContainer, typeSelect.value, null);
    });
    // Note: 'hills' uses same structured fields as session/long

    // Wire done button
    doneBtn.addEventListener('click', () => {
        collapseWorkout(card, addWorkoutBtn);
    });

    // Initial field render
    renderWorkoutFields(fieldsContainer, initialType, existingData);

    return card;
}

function collapseWorkout(card, addWorkoutBtn) {
    const editView = card.querySelector('.workout-edit-view');
    const summaryView = card.querySelector('.workout-summary-view');

    // Extract a summary from the current state
    const wo = extractWorkoutData(card);
    const typeLabel = wo.type;
    const distStr = wo.dist > 0 ? `${wo.dist.toFixed(1)} km` : '';
    const descStr = wo.desc || '';

    summaryView.innerHTML = `
        <div class="summary-content">
            <span class="summary-type type-${wo.class}">${typeLabel}</span>
            <span class="summary-desc">${descStr}</span>
            ${distStr ? `<span class="summary-dist">${distStr}</span>` : ''}
        </div>
        <button type="button" class="btn btn-sm btn-secondary workout-edit-btn">Edit</button>
    `;

    editView.style.display = 'none';
    summaryView.style.display = 'flex';
    addWorkoutBtn.style.display = 'inline-flex';

    // Wire edit button
    summaryView.querySelector('.workout-edit-btn').addEventListener('click', () => {
        editView.style.display = 'block';
        summaryView.style.display = 'none';
        addWorkoutBtn.style.display = 'none';
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderWorkoutFields(container, workoutType, existingData) {
    container.innerHTML = '';

    if (workoutType === 'rest') {
        // Rest day — no fields needed, only the description input in the top row
        container.innerHTML = `<div class="easy-fields"><span style="color:var(--text-tertiary);font-size:0.85rem;">Rest day — 0 km</span></div>`;
        return;
    }

    if (workoutType === 'easy') {
        const dist = existingData?.dist || existingData?.structured?.distance || '';
        container.innerHTML = `
            <div class="easy-fields">
                <div class="field-row">
                    <label>Distance (km)</label>
                    <input type="number" class="easy-distance" value="${dist}" placeholder="e.g. 10" step="0.1" min="0">
                </div>
            </div>
        `;
    } else {
        // Session, Long Run, or Hills — all use structured input
        const structured = existingData?.structured;
        const warmUp = structured?.warmUp || { value: '', unit: 'km' };
        const coolDown = structured?.coolDown || { value: '', unit: 'km' };
        const existingItems = structured?.sets || [{ duration: { value: '', unit: 'km' }, zone: 'threshold', offset: 0, rest: { value: '', unit: 'min' }, restType: 'jog', repeats: 1 }];

        // Warm-up
        container.appendChild(createStructuredInput('Warm Up', warmUp, 'warmup-section'));

        // Interval sets container (holds standalone sets AND groups)
        const setsContainer = document.createElement('div');
        setsContainer.className = 'interval-sets-container';
        let itemIdx = 0;
        existingItems.forEach(item => {
            if (item.type === 'group') {
                setsContainer.appendChild(createIntervalGroup(setsContainer, item));
            } else {
                setsContainer.appendChild(createIntervalSet(itemIdx, item, setsContainer));
                itemIdx++;
            }
        });
        container.appendChild(setsContainer);

        // Button row
        const btnRow = document.createElement('div');
        btnRow.className = 'interval-btn-row';

        const addSetBtn = document.createElement('button');
        addSetBtn.type = 'button';
        addSetBtn.className = 'btn btn-sm btn-secondary';
        addSetBtn.textContent = '+ Add Set';
        addSetBtn.addEventListener('click', () => {
            const idx = setsContainer.querySelectorAll('.interval-set').length;
            setsContainer.appendChild(createIntervalSet(idx, null, setsContainer));
            renumberItems(setsContainer);
        });
        btnRow.appendChild(addSetBtn);

        const addGroupBtn = document.createElement('button');
        addGroupBtn.type = 'button';
        addGroupBtn.className = 'btn btn-sm btn-secondary';
        addGroupBtn.textContent = '+ Add Group';
        addGroupBtn.addEventListener('click', () => {
            setsContainer.appendChild(createIntervalGroup(setsContainer));
            renumberItems(setsContainer);
        });
        btnRow.appendChild(addGroupBtn);

        const groupSelectedBtn = document.createElement('button');
        groupSelectedBtn.type = 'button';
        groupSelectedBtn.className = 'btn btn-sm btn-secondary group-selected-btn';
        groupSelectedBtn.textContent = 'Group Selected';
        groupSelectedBtn.disabled = true;
        groupSelectedBtn.addEventListener('click', () => {
            const checked = setsContainer.querySelectorAll('.interval-set .set-select-cb:checked');
            if (checked.length < 2) return;
            const selectedSets = Array.from(checked).map(cb => cb.closest('.interval-set'));
            const intervalsData = selectedSets.map(el => extractIntervalData(el));
            const insertRef = selectedSets[0];
            selectedSets.forEach(s => s.remove());
            const group = createIntervalGroup(setsContainer, { type: 'group', repeats: 1, setRest: { value: '', unit: 'min' }, setRestType: 'standing', intervals: intervalsData });
            if (insertRef && insertRef.parentElement) {
                setsContainer.insertBefore(group, insertRef);
            } else {
                setsContainer.appendChild(group);
            }
            renumberItems(setsContainer);
            groupSelectedBtn.disabled = true;
        });
        btnRow.appendChild(groupSelectedBtn);

        container.appendChild(btnRow);

        // Checkbox delegation for Group Selected button
        setsContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('set-select-cb')) {
                const count = setsContainer.querySelectorAll('.interval-set .set-select-cb:checked').length;
                groupSelectedBtn.disabled = count < 2;
            }
        });

        // Cool-down
        container.appendChild(createStructuredInput('Cool Down', coolDown, 'cooldown-section'));
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

function renumberItems(setsContainer) {
    let setIdx = 0;
    let groupIdx = 0;
    Array.from(setsContainer.children).forEach(child => {
        if (child.classList.contains('interval-set')) {
            setIdx++;
            const lbl = child.querySelector('.interval-set-label');
            if (lbl) lbl.textContent = `Set ${setIdx}`;
        } else if (child.classList.contains('interval-group')) {
            groupIdx++;
            const lbl = child.querySelector('.group-label');
            if (lbl) lbl.textContent = `Group ${groupIdx}`;
            let ivIdx = 0;
            child.querySelectorAll('.interval-item').forEach(item => {
                ivIdx++;
                const ivLbl = item.querySelector('.interval-item-label');
                if (ivLbl) ivLbl.textContent = `Interval ${ivIdx}`;
            });
        }
    });
}

// ─── Standalone Interval Set (with checkbox for grouping) ───
function createIntervalSet(index, data = null, setsContainer = null) {
    const set = document.createElement('div');
    set.className = 'interval-set';

    const dur = data?.duration || { value: '', unit: 'km' };
    const zone = data?.zone || data?.pace || 'threshold';
    const offset = data?.offset || 0;
    const rest = data?.rest || { value: '', unit: 'min' };
    const restType = data?.restType || 'jog';
    const repeats = data?.repeats || 1;

    set.innerHTML = `
        <div class="interval-set-header">
            <label class="set-select-label"><input type="checkbox" class="set-select-cb"> <span class="interval-set-label">Set ${index + 1}</span></label>
            <button type="button" class="btn-remove-set" title="Remove set">✕</button>
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
            <div class="structured-input-group interval-pace-group">
                <label>Pace</label>
                <div class="pace-zone-row">
                    <select class="interval-zone-select">
                        ${PACE_ZONES.map(z => `<option value="${z.key}" ${z.key === zone ? 'selected' : ''}>${z.label}</option>`).join('')}
                    </select>
                    <input type="number" class="interval-offset-input" value="${offset || ''}" placeholder="±sec" title="Offset in sec/km">
                </div>
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
                    <select class="interval-rest-type" title="Rest type">
                        <option value="jog" ${restType === 'jog' ? 'selected' : ''}>Jog</option>
                        <option value="standing" ${restType === 'standing' ? 'selected' : ''}>Standing</option>
                        <option value="float" ${restType === 'float' ? 'selected' : ''}>Float</option>
                    </select>
                </div>
            </div>
            <div class="structured-input-group">
                <label>Repeats</label>
                <input type="number" class="interval-repeats-input" value="${repeats}" min="1" step="1">
            </div>
        </div>
    `;

    set.querySelector('.btn-remove-set').addEventListener('click', () => {
        set.remove();
        if (setsContainer) renumberItems(setsContainer);
    });

    return set;
}

// ─── Interval Group (contains multiple interval-items) ───
function createIntervalGroup(setsContainer, data = null) {
    const group = document.createElement('div');
    group.className = 'interval-group';

    const groupRepeats = data?.repeats || 1;
    const setRest = data?.setRest || { value: '', unit: 'min' };
    const setRestType = data?.setRestType || 'standing';
    const intervals = data?.intervals || [
        { duration: { value: '', unit: 'km' }, zone: 'threshold', offset: 0, rest: { value: '', unit: 'min' }, restType: 'jog' }
    ];

    // Header
    const header = document.createElement('div');
    header.className = 'interval-group-header';
    header.innerHTML = `
        <span class="group-label">Group</span>
        <span class="group-repeats-label">×</span>
        <input type="number" class="group-repeats-input" value="${groupRepeats}" min="1" step="1" title="Group repeats">
        <div class="group-header-actions">
            <button type="button" class="btn-ungroup" title="Ungroup">⊟ Ungroup</button>
            <button type="button" class="btn-remove-group" title="Remove group">✕</button>
        </div>
    `;
    group.appendChild(header);

    // Body (interval items)
    const body = document.createElement('div');
    body.className = 'interval-group-body';
    intervals.forEach((iv, idx) => {
        body.appendChild(createIntervalItem(idx, iv, body));
    });
    group.appendChild(body);

    // Footer (set rest + add interval)
    const footer = document.createElement('div');
    footer.className = 'interval-group-footer';
    footer.innerHTML = `
        <div class="structured-input-group group-rest-section">
            <label>Set Rest (between group reps)</label>
            <div class="struct-row">
                <input type="number" class="struct-value" value="${setRest.value || ''}" placeholder="0" step="0.1" min="0">
                <select class="struct-unit">
                    <option value="min" ${setRest.unit === 'min' ? 'selected' : ''}>min</option>
                    <option value="sec" ${setRest.unit === 'sec' ? 'selected' : ''}>sec</option>
                    <option value="m" ${setRest.unit === 'm' ? 'selected' : ''}>m</option>
                    <option value="km" ${setRest.unit === 'km' ? 'selected' : ''}>km</option>
                </select>
                <select class="group-rest-type" title="Rest type">
                    <option value="standing" ${setRestType === 'standing' ? 'selected' : ''}>Standing</option>
                    <option value="jog" ${setRestType === 'jog' ? 'selected' : ''}>Jog</option>
                    <option value="float" ${setRestType === 'float' ? 'selected' : ''}>Float</option>
                </select>
            </div>
        </div>
    `;
    const addIntervalBtn = document.createElement('button');
    addIntervalBtn.type = 'button';
    addIntervalBtn.className = 'btn btn-sm btn-secondary add-interval-btn';
    addIntervalBtn.textContent = '+ Add Interval';
    addIntervalBtn.addEventListener('click', () => {
        const idx = body.querySelectorAll('.interval-item').length;
        body.appendChild(createIntervalItem(idx, null, body));
    });
    footer.appendChild(addIntervalBtn);
    group.appendChild(footer);

    // Wire remove group
    header.querySelector('.btn-remove-group').addEventListener('click', () => {
        group.remove();
        if (setsContainer) renumberItems(setsContainer);
    });

    // Wire ungroup — convert group intervals back to standalone sets
    header.querySelector('.btn-ungroup').addEventListener('click', () => {
        const items = body.querySelectorAll('.interval-item');
        const parentContainer = group.parentElement;
        items.forEach(itemEl => {
            const ivData = extractIntervalData(itemEl);
            const idx = parentContainer.querySelectorAll('.interval-set').length;
            const standalone = createIntervalSet(idx, ivData, parentContainer);
            parentContainer.insertBefore(standalone, group);
        });
        group.remove();
        if (setsContainer) renumberItems(setsContainer);
    });

    return group;
}

// ─── Single Interval inside a Group ───
function createIntervalItem(index, data = null, body = null) {
    const item = document.createElement('div');
    item.className = 'interval-item';

    const dur = data?.duration || { value: '', unit: 'km' };
    const zone = data?.zone || 'threshold';
    const offset = data?.offset || 0;
    const rest = data?.rest || { value: '', unit: 'min' };
    const restType = data?.restType || 'jog';

    item.innerHTML = `
        <div class="interval-item-header">
            <span class="interval-item-label">Interval ${index + 1}</span>
            ${index > 0 ? '<button type="button" class="btn-remove-interval" title="Remove">✕</button>' : ''}
        </div>
        <div class="interval-set-fields">
            <div class="structured-input-group interval-duration-section">
                <label>Distance/Time</label>
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
            <div class="structured-input-group interval-pace-group">
                <label>Pace</label>
                <div class="pace-zone-row">
                    <select class="interval-zone-select">
                        ${PACE_ZONES.map(z => `<option value="${z.key}" ${z.key === zone ? 'selected' : ''}>${z.label}</option>`).join('')}
                    </select>
                    <input type="number" class="interval-offset-input" value="${offset || ''}" placeholder="±sec">
                </div>
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
                    <select class="interval-rest-type" title="Rest type">
                        <option value="jog" ${restType === 'jog' ? 'selected' : ''}>Jog</option>
                        <option value="standing" ${restType === 'standing' ? 'selected' : ''}>Standing</option>
                        <option value="float" ${restType === 'float' ? 'selected' : ''}>Float</option>
                    </select>
                </div>
            </div>
        </div>
    `;

    const removeBtn = item.querySelector('.btn-remove-interval');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            item.remove();
            if (body) {
                body.querySelectorAll('.interval-item').forEach((it, i) => {
                    const lbl = it.querySelector('.interval-item-label');
                    if (lbl) lbl.textContent = `Interval ${i + 1}`;
                });
            }
        });
    }

    return item;
}

// ─── Commit to Plan ───
async function renderCommitButton() {
    const container = document.getElementById('commitBtnContainer');
    if (!container || !currentUser) return;

    const commit = await getCommittedPlan(currentUser.id);
    committedPlanId = commit?.plan_id || null;
    const currentPlanId = document.getElementById('planSelect').value;
    const isCommitted = committedPlanId === currentPlanId;

    if (isCommitted) {
        container.innerHTML = `
            <button class="btn-uncommit" id="uncommitBtn">
                <span>✓</span> Committed — Uncommit
            </button>
            <div style="margin-top: 10px; text-align: center;">
                <button class="btn btn-sm btn-secondary" id="viewScheduleBtn">View My Schedule</button>
            </div>
        `;
        document.getElementById('uncommitBtn').addEventListener('click', async () => {
            const { error } = await uncommitFromPlan(currentUser.id);
            if (!error) {
                committedPlanId = null;
                renderCommitButton();
            }
        });
        document.getElementById('viewScheduleBtn').addEventListener('click', () => {
            // Trigger a view change to the user schedule (will implement below)
            renderUserSchedule(commit.id);
        });
    } else {
        container.innerHTML = `
            <div class="commit-date-picker" style="margin-bottom: 10px; display: flex; gap: 10px; align-items: center; justify-content: center;">
                <select id="commitDateType" class="form-select" style="width: auto;">
                    <option value="start">Plan Start Date</option>
                    <option value="race">Target Race Date</option>
                </select>
                <input type="date" id="commitDateValue" class="form-control" style="width: auto;">
            </div>
            <button class="btn-commit" id="commitBtn">Commit to Plan</button>
        `;
        
        // Default to today or next Monday for start date
        const dateInput = document.getElementById('commitDateValue');
        const today = new Date();
        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
        dateInput.value = nextMonday.toISOString().split('T')[0];

        document.getElementById('commitBtn').addEventListener('click', async () => {
            const planId = document.getElementById('planSelect').value;
            const dateType = document.getElementById('commitDateType').value;
            const dateValue = document.getElementById('commitDateValue').value;

            if (!planId || !dateValue) {
                alert('Please select a plan and a date.');
                return;
            }

            // Generate workouts based on currentPlanWeeks
            if (!currentPlanWeeks || currentPlanWeeks.length === 0) {
                alert('Wait for plan weeks to load.');
                return;
            }

            const totalWeeks = currentPlanWeeks.length;
            let startDate = new Date(dateValue);
            if (dateType === 'race') {
                // Assuming race is on the last day (Sunday) of the last week.
                // Subtract (totalWeeks * 7) - 1 days
                startDate.setDate(startDate.getDate() - ((totalWeeks * 7) - 1));
            }

            const generatedWorkouts = [];
            let currentDay = new Date(startDate);

            // Reorder based on user customizations if any exist in currentPlanWeeks
            for (const week of currentPlanWeeks) {
                const weekNum = week.week_number;
                const days = week.days; // array of 7 days
                // If we loaded customizations, we should apply them here. 
                // For simplicity, assuming days array is in order Mon-Sun.
                
                for (let i = 0; i < 7; i++) {
                    const dayData = days[i];
                    generatedWorkouts.push({
                        scheduled_date: currentDay.toISOString().split('T')[0],
                        workout_type: dayData.type,
                        planned_data: dayData
                    });
                    // increment day
                    currentDay.setDate(currentDay.getDate() + 1);
                }
            }

            const btn = document.getElementById('commitBtn');
            btn.disabled = true;
            btn.textContent = 'Committing...';

            const { error } = await commitToPlan(currentUser.id, planId, generatedWorkouts);
            if (!error) {
                committedPlanId = planId;
                renderCommitButton();
            } else {
                alert('Error committing to plan.');
                btn.disabled = false;
                btn.textContent = 'Commit to Plan';
            }
        });
    }
}

// ─── User Schedule & Tick Off ───
async function renderUserSchedule(commitId) {
    const mainContainer = document.querySelector('.main-content');
    if (!mainContainer || !currentUser) return;

    const workouts = await loadUserWorkouts(currentUser.id, commitId);
    
    // Create view
    let html = `
        <div class="content-header" style="margin-bottom: 20px;">
            <h2 class="content-title">My Schedule</h2>
            <button class="btn btn-secondary" onclick="location.reload()">Back to Plan</button>
        </div>
        <div class="schedule-list" style="display: flex; flex-direction: column; gap: 10px;">
    `;

    if (workouts.length === 0) {
        html += `<p>No workouts found for this plan.</p>`;
    } else {
        // Group by week (just roughly by every 7 days)
        let currentWeek = 0;
        workouts.forEach((w, i) => {
            if (i % 7 === 0) {
                currentWeek++;
                html += `<h3 style="margin-top: 20px; color: var(--text-primary);">Week ${currentWeek}</h3>`;
            }
            
            const dateStr = new Date(w.scheduled_date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
            const isCompleted = w.status === 'COMPLETED';
            const isSkipped = w.status === 'SKIPPED';
            
            let statusBadge = '';
            if (isCompleted) statusBadge = `<span style="color: #30D158; font-size: 0.8rem; margin-left: auto;">✓ COMPLETED</span>`;
            if (isSkipped) statusBadge = `<span style="color: #FF453A; font-size: 0.8rem; margin-left: auto;">✕ SKIPPED</span>`;

            html += `
                <div class="card" style="padding: 15px; display: flex; align-items: center; cursor: pointer; opacity: ${isCompleted || isSkipped ? 0.6 : 1}" onclick="openTickOffModal('${w.id}')">
                    <div style="width: 100px; color: var(--text-secondary); font-size: 0.9rem;">${dateStr}</div>
                    <div style="width: 80px;"><span class="pace-badge ${w.planned_data.class || 'easy'}">${w.workout_type}</span></div>
                    <div style="flex: 1; padding: 0 15px;">${escapeHtml(w.planned_data.desc || '')}</div>
                    ${statusBadge}
                    ${!isCompleted && !isSkipped ? '<button class="btn btn-sm btn-primary">Tick Off</button>' : ''}
                </div>
            `;
        });
    }

    html += `</div>`;
    mainContainer.innerHTML = html;

    // We need to attach the modal html if it doesn't exist
    if (!document.getElementById('tickOffModal')) {
        const modalHtml = `
            <div class="modal" id="tickOffModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Tick Off Session</h3>
                        <button class="close-modal" id="closeTickOffModal">✕</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="tickOffWorkoutId">
                        <div class="form-group">
                            <label>Status</label>
                            <select id="tickOffStatus" class="form-select">
                                <option value="COMPLETED">Completed</option>
                                <option value="SKIPPED">Skipped</option>
                            </select>
                        </div>
                        <div id="tickOffDetails" style="display: block;">
                            <div class="form-group">
                                <label>Actual Distance (km)</label>
                                <input type="number" id="tickOffDistance" class="form-control" step="0.1" min="0" placeholder="e.g. 10.5">
                            </div>
                            <div class="form-group">
                                <label>Actual Time</label>
                                <input type="text" id="tickOffTime" class="form-control" placeholder="hh:mm:ss or mm:ss">
                            </div>
                            <div class="form-group">
                                <label>Notes</label>
                                <textarea id="tickOffNotes" class="form-control" rows="3" placeholder="How did it feel? Any deviations?"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="saveTickOffBtn">Save</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('closeTickOffModal').addEventListener('click', () => {
            document.getElementById('tickOffModal').classList.remove('active');
        });

        document.getElementById('tickOffStatus').addEventListener('change', (e) => {
            document.getElementById('tickOffDetails').style.display = e.target.value === 'COMPLETED' ? 'block' : 'none';
        });

        document.getElementById('saveTickOffBtn').addEventListener('click', async () => {
            const wId = document.getElementById('tickOffWorkoutId').value;
            const status = document.getElementById('tickOffStatus').value;
            const actualData = {};
            if (status === 'COMPLETED') {
                actualData.distance = document.getElementById('tickOffDistance').value;
                actualData.time = document.getElementById('tickOffTime').value;
                actualData.notes = document.getElementById('tickOffNotes').value;
            }

            const btn = document.getElementById('saveTickOffBtn');
            btn.disabled = true;
            btn.textContent = 'Saving...';

            const { error } = await updateUserWorkout(wId, { status, actual_data: actualData });
            if (!error) {
                document.getElementById('tickOffModal').classList.remove('active');
                renderUserSchedule(commitId); // refresh
            } else {
                alert('Error saving workout status.');
            }
            
            btn.disabled = false;
            btn.textContent = 'Save';
        });
    }

    // Expose open function globally so inline onclick works
    window.openTickOffModal = (workoutId) => {
        document.getElementById('tickOffWorkoutId').value = workoutId;
        document.getElementById('tickOffStatus').value = 'COMPLETED';
        document.getElementById('tickOffDistance').value = '';
        document.getElementById('tickOffTime').value = '';
        document.getElementById('tickOffNotes').value = '';
        document.getElementById('tickOffDetails').style.display = 'block';
        document.getElementById('tickOffModal').classList.add('active');
    };
}

// ─── Timeline ───
const TRACK_DISTANCES = ['3000m', '5000m', '10000m'];
const ROAD_DISTANCES = ['5k', '10k', 'half', 'marathon'];
const ALL_DISTANCES = [...ROAD_DISTANCES, ...TRACK_DISTANCES];

function isTrackDistance(distance) {
    return TRACK_DISTANCES.includes(distance);
}

function getDistanceLabelForEvent(distance) {
    const labels = {
        '3000m': '3000m', '5000m': '5000m', '10000m': '10000m',
        '5k': '5k', '10k': '10k', 'half': 'Half Marathon', 'marathon': 'Marathon'
    };
    return labels[distance] || distance;
}

// Parse race time string to total seconds (supports hh:mm:ss, mm:ss, mm:ss.xx)
function parseRaceTime(str) {
    if (!str || str.trim() === '') return 0;
    // Handle mm:ss.xx format (track)
    if (str.includes('.')) {
        const [main, frac] = str.split('.');
        const parts = main.split(':');
        let sec = 0;
        if (parts.length === 2) {
            sec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else if (parts.length === 1) {
            sec = parseInt(parts[0]);
        }
        return sec + (parseInt(frac || 0) / 100);
    }
    // Standard mm:ss or hh:mm:ss
    const parts = str.split(':');
    if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    return 0;
}

// Format seconds to display string based on distance type
function formatRaceTimeDisplay(seconds, distance) {
    if (!seconds || seconds <= 0) return '--';
    if (isTrackDistance(distance)) {
        // Track: mm:ss.00
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const wholeSecs = Math.floor(secs);
        const hundredths = Math.round((secs - wholeSecs) * 100);
        return `${mins}:${wholeSecs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
    } else {
        // Road: hh:mm:ss or mm:ss
        const totalSec = Math.round(seconds);
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

async function loadAndRenderTimeline() {
    if (!currentUser) return;
    allUserEvents = await loadUserEvents(currentUser.id);
    renderTimelineChart();
    renderEventsList();
}

function renderTimelineChart() {
    const ctx = document.getElementById('timelineChart');
    if (!ctx) return;
    const filter = document.getElementById('timelineDistanceFilter').value;

    // Filter race events
    let raceEvents = allUserEvents.filter(e => e.event_type === 'race');
    if (filter !== 'all') {
        raceEvents = raceEvents.filter(e => e.distance === filter);
    }

    // Health events (sickness + injury)
    const healthEvents = allUserEvents.filter(e => e.event_type === 'sickness' || e.event_type === 'injury');

    // Determine if we're showing a single distance or mixed
    const distances = [...new Set(raceEvents.map(e => e.distance))];
    const singleDistance = filter !== 'all' ? filter : (distances.length === 1 ? distances[0] : null);
    const isTrack = singleDistance ? isTrackDistance(singleDistance) : false;

    // Convert race events to chart data
    const raceData = raceEvents.map(e => ({
        x: e.start_date,
        y: parseRaceTime(e.time),
        distance: e.distance,
        notes: e.notes,
        time: e.time
    })).filter(d => d.y > 0);

    // Build annotation overlays for health events
    const annotations = {};
    healthEvents.forEach((event, idx) => {
        if (!event.start_date) return;
        const color = event.event_type === 'sickness'
            ? 'rgba(255, 159, 10, 0.12)'
            : 'rgba(255, 69, 58, 0.12)';
        const borderColor = event.event_type === 'sickness'
            ? 'rgba(255, 159, 10, 0.4)'
            : 'rgba(255, 69, 58, 0.4)';
        annotations[`health_${idx}`] = {
            type: 'box',
            xMin: event.start_date,
            xMax: event.end_date || event.start_date,
            backgroundColor: color,
            borderColor: borderColor,
            borderWidth: 1,
            label: {
                display: true,
                content: `${event.event_type === 'sickness' ? '🤒' : '🩹'} ${event.notes || event.event_type}`,
                position: 'start',
                font: { size: 10 },
                color: event.event_type === 'sickness' ? '#FF9F0A' : '#FF453A'
            }
        };
    });

    // Group data by distance for coloring
    const distanceColors = {
        '3000m': '#FF453A', '5000m': '#FF9F0A', '10000m': '#FFD60A',
        '5k': '#30D158', '10k': '#0A84FF', 'half': '#BF5AF2', 'marathon': '#FF375F'
    };

    // Create datasets — one per distance if "all", or one if filtered
    let datasets = [];
    if (filter === 'all' && distances.length > 1) {
        distances.forEach(dist => {
            const points = raceData.filter(d => d.distance === dist);
            datasets.push({
                label: getDistanceLabelForEvent(dist),
                data: points,
                borderColor: distanceColors[dist] || '#F5F5F7',
                backgroundColor: distanceColors[dist] || '#F5F5F7',
                pointRadius: 6,
                pointHoverRadius: 9,
                showLine: false,
                pointStyle: 'circle'
            });
        });
    } else {
        datasets.push({
            label: singleDistance ? getDistanceLabelForEvent(singleDistance) : 'Race Results',
            data: raceData,
            borderColor: singleDistance ? (distanceColors[singleDistance] || '#0A84FF') : '#0A84FF',
            backgroundColor: singleDistance ? (distanceColors[singleDistance] || '#0A84FF') : '#0A84FF',
            pointRadius: 6,
            pointHoverRadius: 9,
            showLine: raceData.length > 1,
            borderWidth: 2,
            tension: 0.3,
            pointBackgroundColor: '#1C1C1E'
        });
    }

    if (timelineChart) {
        timelineChart.destroy();
        timelineChart = null;
    }

    // Don't render chart if there's no data at all
    if (raceData.length === 0 && healthEvents.length === 0) return;

    Chart.defaults.color = '#98989D';
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif';

    try {
        timelineChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: true },
            plugins: {
                legend: {
                    display: datasets.length > 1,
                    position: 'top',
                    labels: { color: '#98989D' }
                },
                tooltip: {
                    padding: 10,
                    backgroundColor: 'rgba(44,44,46,0.95)',
                    titleColor: '#F5F5F7',
                    bodyColor: '#F5F5F7',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    callbacks: {
                        title: (items) => {
                            if (!items.length) return '';
                            const raw = items[0].raw;
                            const d = new Date(raw.x);
                            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                        },
                        label: (item) => {
                            const raw = item.raw;
                            const dist = raw.distance || singleDistance;
                            const timeStr = formatRaceTimeDisplay(raw.y, dist);
                            const label = raw.notes ? `${raw.notes}: ${timeStr}` : `${getDistanceLabelForEvent(dist)}: ${timeStr}`;
                            return label;
                        }
                    }
                },
                annotation: {
                    annotations
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: { month: 'MMM yyyy', day: 'dd MMM' }
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#636366' },
                    title: { display: true, text: 'Date', color: '#636366' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    title: {
                        display: true,
                        text: 'Race Time',
                        color: '#636366'
                    },
                    ticks: {
                        color: '#636366',
                        callback: function(value) {
                            return formatRaceTimeDisplay(value, singleDistance || '5k');
                        }
                    }
                }
            }
        }
    });
    } catch (err) {
        console.error('Error rendering timeline chart:', err);
    }
}

function setupEventForm() {
    const form = document.getElementById('eventForm');
    const typeSelect = document.getElementById('eventType');
    if (!form || !typeSelect) return;

    // Toggle fields based on event type
    typeSelect.addEventListener('change', () => {
        const type = typeSelect.value;
        const endDateGroup = document.querySelector('.event-end-date-group');
        const distanceGroup = document.querySelector('.event-distance-group');
        const timeGroup = document.querySelector('.event-time-group');

        if (type === 'race') {
            endDateGroup.style.display = 'none';
            distanceGroup.style.display = 'flex';
            timeGroup.style.display = 'flex';
        } else {
            endDateGroup.style.display = 'flex';
            distanceGroup.style.display = 'none';
            timeGroup.style.display = 'none';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const type = typeSelect.value;
        const startDate = document.getElementById('eventStartDate').value;
        if (!startDate) {
            alert('Please select a date.');
            return;
        }

        const eventData = {
            user_id: currentUser.id,
            event_type: type,
            start_date: startDate,
            notes: document.getElementById('eventNotes').value || null
        };

        if (type === 'race') {
            eventData.distance = document.getElementById('eventDistance').value;
            eventData.time = document.getElementById('eventTime').value;
        } else {
            eventData.end_date = document.getElementById('eventEndDate').value || null;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            const { data: createdEvent, error } = await createUserEvent(eventData);
            if (error) {
                submitBtn.textContent = 'Error!';
                setTimeout(() => { submitBtn.textContent = 'Add Event'; submitBtn.disabled = false; }, 2000);
                return;
            }

            // Adjustment Engine Trigger
            if ((type === 'sickness' || type === 'injury') && committedPlanId) {
                const commit = await getCommittedPlan(currentUser.id);
                if (commit) {
                    const upcomingWorkouts = await loadUserWorkouts(currentUser.id, commit.id);
                    // Filter to only future workouts starting from the event start date
                    const futureWorkouts = upcomingWorkouts.filter(w => new Date(w.scheduled_date) >= new Date(startDate) && w.status !== 'COMPLETED');
                    
                    if (futureWorkouts.length > 0) {
                        // Estimate VDOT or use a default if not fully implemented in profile
                        let vdot = 50; 
                        
                        const adjustmentResult = runAdjustmentEngine({ vdot }, {
                            reason: type,
                            startDate: startDate,
                            endDate: eventData.end_date
                        }, futureWorkouts);
                        
                        // Save the adjustment log
                        await createPlanAdjustment({
                            user_id: currentUser.id,
                            event_reason: type,
                            state_before: adjustmentResult.athleteStateBefore,
                            state_after: adjustmentResult.athleteStateAfter,
                            schedule_adjustments: adjustmentResult.scheduleAdjustments
                        });
                        
                        // Apply adjusted workouts back to the database
                        for (const adjW of adjustmentResult.scheduleAdjustments.adjustedWorkouts) {
                            await updateUserWorkout(adjW.id, {
                                workout_type: adjW.workout_type,
                                planned_data: adjW.planned_data,
                                actual_data: adjW.actual_data || {}
                            });
                        }
                        alert('Your training schedule has been automatically adjusted due to your ' + type + '.');
                        if (document.querySelector('.schedule-list')) {
                            renderUserSchedule(commit.id);
                        }
                    }
                }
            }

            submitBtn.textContent = '✓ Added!';
            form.reset();
            // Reset event type to race to reset form field visibility
            typeSelect.value = 'race';
            typeSelect.dispatchEvent(new Event('change'));

            await loadAndRenderTimeline();
        } catch (err) {
            console.error('Error saving event:', err);
        } finally {
            // Always re-enable the button
            setTimeout(() => { submitBtn.textContent = 'Add Event'; submitBtn.disabled = false; }, 1500);
        }
    });
}

function renderEventsList() {
    const container = document.getElementById('eventsListContainer');
    if (!container) return;

    if (allUserEvents.length === 0) {
        container.innerHTML = '<div class="card" style="text-align:center;padding:30px;color:var(--text-secondary)">No events logged yet. Use the form above to add your first race or health event.</div>';
        return;
    }

    // Sort newest first for the list
    const sorted = [...allUserEvents].sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

    container.innerHTML = sorted.map(event => {
        const dateStr = new Date(event.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        let dateRange = dateStr;
        if (event.end_date && event.end_date !== event.start_date) {
            const endStr = new Date(event.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            dateRange = `${dateStr} — ${endStr}`;
        }

        const title = event.notes || (event.event_type === 'race'
            ? getDistanceLabelForEvent(event.distance)
            : event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1));

        const timeDisplay = event.event_type === 'race' && event.time
            ? `<span class="event-result">${formatRaceTimeDisplay(parseRaceTime(event.time), event.distance)}</span>`
            : '';

        return `
            <div class="event-card" data-event-id="${event.id}">
                <span class="event-type-badge ${event.event_type}">${event.event_type}</span>
                <div class="event-info">
                    <div class="event-title">${escapeHtml(title)}${event.event_type === 'race' ? ` <span style="color:var(--text-tertiary);font-size:0.8rem">(${getDistanceLabelForEvent(event.distance)})</span>` : ''}</div>
                    <div class="event-date">${dateRange}</div>
                </div>
                ${timeDisplay}
                <div class="event-actions">
                    <button class="btn btn-sm btn-danger event-delete-btn" data-id="${event.id}" title="Delete">✕</button>
                </div>
            </div>
        `;
    }).join('');

    // Wire delete buttons
    container.querySelectorAll('.event-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete this event?')) return;
            const eventId = btn.dataset.id;
            const { error } = await deleteUserEvent(eventId);
            if (!error) {
                await loadAndRenderTimeline();
            }
        });
    });
}

// ─── Plan Chart Overlays ───
function getHealthOverlaysForPlanChart(weeks, raceDate) {
    if (!allUserEvents || allUserEvents.length === 0) return {};
    const healthEvents = allUserEvents.filter(e => e.event_type === 'sickness' || e.event_type === 'injury');
    if (healthEvents.length === 0) return {};

    const totalWeeks = weeks.length;
    const annotations = {};

    healthEvents.forEach((event, idx) => {
        if (!event.start_date) return;
        const eventStart = new Date(event.start_date);
        const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;
        const planStart = new Date(raceDate);
        planStart.setDate(planStart.getDate() - (totalWeeks * 7));

        // Convert dates to week index positions
        const startWeekFloat = (eventStart - planStart) / (7 * 24 * 60 * 60 * 1000);
        const endWeekFloat = (eventEnd - planStart) / (7 * 24 * 60 * 60 * 1000);

        // Only include if overlapping with plan range
        if (endWeekFloat < 0 || startWeekFloat > totalWeeks) return;

        const xMin = Math.max(startWeekFloat - 0.5, -0.5);
        const xMax = Math.min(endWeekFloat - 0.5, totalWeeks - 0.5);

        const color = event.event_type === 'sickness'
            ? 'rgba(255, 159, 10, 0.1)'
            : 'rgba(255, 69, 58, 0.1)';
        const borderColor = event.event_type === 'sickness'
            ? 'rgba(255, 159, 10, 0.35)'
            : 'rgba(255, 69, 58, 0.35)';

        annotations[`plan_health_${idx}`] = {
            type: 'box',
            xMin,
            xMax,
            backgroundColor: color,
            borderColor: borderColor,
            borderWidth: 1,
            label: {
                display: true,
                content: `${event.event_type === 'sickness' ? '🤒' : '🩹'} ${event.notes || event.event_type}`,
                position: 'start',
                font: { size: 9 },
                color: event.event_type === 'sickness' ? '#FF9F0A' : '#FF453A'
            }
        };
    });

    return annotations;
}

// ─── Init ───
async function init() {
    // Setup tabs
    setupTabs();
    setupCreatePlan();
    setupEventForm();

    // Check auth
    const session = await getSession();
    currentUser = session?.user || null;
    renderAuthUI(currentUser);
    showApp(!!currentUser);

    if (!currentUser) return;

    // Load admin status
    isAdmin = await loadAdminStatus(currentUser.id);
    renderAdminToggle();

    // Load profile paces
    await loadUserProfile();

    // Prompt to set paces if not configured
    const vdot = getVDOT();
    const banner = document.getElementById('pacesPromptBanner');
    if (!vdot) {
        // Switch to My Paces tab
        document.querySelector('[data-tab="myPacesTab"]').click();
        if (banner) banner.style.display = 'flex';
    } else {
        if (banner) banner.style.display = 'none';
    }

    // Load plans
    await populatePlanDropdown();

    // Load events for timeline + chart overlays
    allUserEvents = await loadUserEvents(currentUser.id);

    // Render commit button
    await renderCommitButton();

    // Event listeners
    document.getElementById('tuningMode').addEventListener('change', () => {
        updateTuningSection();
        renderPlan();
    });

    document.getElementById('planSelect').addEventListener('change', async () => {
        updateGoalRaceLabel();
        await loadAndRenderPlan();
        renderCommitButton();
        if (adminModeEnabled) updateAdminUI();
    });

    document.getElementById('savePacesBtn').addEventListener('click', handleSavePaces);

    // Timeline distance filter
    const distFilter = document.getElementById('timelineDistanceFilter');
    if (distFilter) {
        distFilter.addEventListener('change', () => renderTimelineChart());
    }

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

            // Load admin status for new sign-in
            isAdmin = await loadAdminStatus(currentUser.id);
            renderAdminToggle();

            await loadUserProfile();
            await populatePlanDropdown();
            allUserEvents = await loadUserEvents(currentUser.id);
            await renderCommitButton();
        }
    });

    // Lazy-load timeline when tab is first opened
    const timelineTabBtn = document.querySelector('[data-tab="timelineTab"]');
    let timelineLoaded = false;
    if (timelineTabBtn) {
        timelineTabBtn.addEventListener('click', () => {
            if (!timelineLoaded) {
                timelineLoaded = true;
                renderTimelineChart();
                renderEventsList();
            }
        });
    }

    // Add one default week to create plan form
    const container = document.getElementById('weekInputsContainer');
    if (container && container.children.length === 0) {
        container.appendChild(createWeekInput(1));
    }
}

init();
