/**
 * Adjustment Engine for Running Plans
 * Applies rules (e.g., Jack Daniels) to modify a user's upcoming workouts
 * based on interruptions like sickness or injury.
 */

// Daniels 6-13 day sickness rule: roughly 2% VDOT reduction
const SICKNESS_VDOT_REDUCTION = 0.98;

export function runAdjustmentEngine(userState, eventData, upcomingWorkouts) {
    const { reason, startDate, endDate } = eventData;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    
    const daysMissed = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    let adjustedState = { ...userState };
    let adjustedWorkouts = [];
    let rulesApplied = [];
    let macroShift = "No major shift.";
    let intensityLockActive = false;
    let intensityLockExpiration = null;

    if (reason === 'sickness' && daysMissed >= 3) {
        // Apply VDOT reduction if missed > 5 days
        if (daysMissed >= 6) {
            adjustedState.vdot = Number((adjustedState.vdot * SICKNESS_VDOT_REDUCTION).toFixed(1));
            rulesApplied.push("Daniels 6-13 day rule (VDOT reduced by 2%)");
        }

        // Lock out intensity for a few days (Bridge Phase)
        intensityLockActive = true;
        const lockEnd = new Date(end);
        // Post-fever/sickness intensity lock usually equals days missed up to 7
        const lockDays = Math.min(daysMissed, 7);
        lockEnd.setDate(lockEnd.getDate() + lockDays);
        intensityLockExpiration = lockEnd.toISOString().split('T')[0];
        
        macroShift = `Specific phase condensed; intensity locked until ${intensityLockExpiration}.`;
        rulesApplied.push("Post-Fever Intensity Lock");
        rulesApplied.push("Daniels Volume Cap (75%)");
    } else if (reason === 'injury') {
        // Injury logic
        macroShift = "Plan paused due to injury.";
        intensityLockActive = true;
    }

    // Adjust the upcoming workouts
    upcomingWorkouts.forEach((workout, index) => {
        const workoutDate = new Date(workout.scheduled_date);
        let newWorkout = { ...workout, planned_data: { ...workout.planned_data } };

        if (intensityLockActive && workoutDate <= new Date(intensityLockExpiration)) {
            // Convert any Quality session to Easy/Recovery and reduce volume
            if (newWorkout.workout_type === 'Quality (T)' || newWorkout.workout_type === 'Quality (M)' || newWorkout.workout_type === 'Long') {
                newWorkout.workout_type = 'Recovery';
                newWorkout.planned_data.desc = "Bridge Phase: Re-entry run. Keep heart rate strictly Zone 1/2.";
                
                // If it was a structured workout (e.g. interval), just clear it and put an easy distance
                if (newWorkout.planned_data.structured) {
                    delete newWorkout.planned_data.structured;
                }
                
                // Reduce distance by 25% (Daniels 75% rule)
                if (newWorkout.planned_data.dist) {
                    newWorkout.planned_data.dist = Number((newWorkout.planned_data.dist * 0.75).toFixed(1));
                }
                
                newWorkout.actual_data = newWorkout.actual_data || {};
                newWorkout.actual_data.rulesApplied = ["Post-Fever Intensity Lock", "Daniels 75% Volume"];
            } else if (newWorkout.workout_type === 'Easy') {
                // Just reduce volume for easy runs during bridge phase
                if (newWorkout.planned_data.dist) {
                    newWorkout.planned_data.dist = Number((newWorkout.planned_data.dist * 0.75).toFixed(1));
                }
                newWorkout.actual_data = newWorkout.actual_data || {};
                newWorkout.actual_data.rulesApplied = ["Volume Capped based on missed days"];
            }
        }
        
        adjustedWorkouts.push(newWorkout);
    });

    return {
        timestamp: new Date().toISOString(),
        event: "ADJUSTMENT_ENGINE_TRIGGERED",
        interruptionData: {
            reason,
            startDate,
            endDate,
            daysMissed
        },
        athleteStateBefore: userState,
        athleteStateAfter: adjustedState,
        scheduleAdjustments: {
            macroShift,
            intensityLockActive,
            intensityLockExpiration,
            rulesApplied,
            adjustedWorkouts
        }
    };
}
