import { supabase } from './supabase.js';

// ─── Load all plans from Supabase ───
export async function loadPlans() {
    const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading plans:', error);
        return [];
    }
    return data || [];
}

// ─── Load weeks for a specific plan ───
export async function loadPlanWeeks(planId) {
    const { data, error } = await supabase
        .from('plan_weeks')
        .select('*')
        .eq('plan_id', planId)
        .order('week_number', { ascending: true });

    if (error) {
        console.error('Error loading plan weeks:', error);
        return [];
    }
    return data || [];
}

// ─── Load user-specific day reorderings ───
export async function loadUserCustomizations(userId, planId) {
    const { data, error } = await supabase
        .from('user_plan_customizations')
        .select('*')
        .eq('user_id', userId)
        .eq('plan_id', planId);

    if (error) {
        console.error('Error loading customizations:', error);
        return {};
    }

    // Convert array of rows to a map: weekNumber -> dayOrder
    const customizations = {};
    (data || []).forEach(row => {
        customizations[row.week_number] = row.day_order;
    });
    return customizations;
}

// ─── Save user-specific day reordering for a week ───
export async function saveUserCustomization(userId, planId, weekNumber, dayOrder) {
    const { error } = await supabase
        .from('user_plan_customizations')
        .upsert({
            user_id: userId,
            plan_id: planId,
            week_number: weekNumber,
            day_order: dayOrder
        }, {
            onConflict: 'user_id,plan_id,week_number'
        });

    if (error) {
        console.error('Error saving customization:', error);
    }
    return { error };
}

// ─── Save a new plan ───
export async function createPlan(planData, weeksData) {
    // Insert plan
    const { data: plan, error: planError } = await supabase
        .from('plans')
        .insert({
            name: planData.name,
            distance: planData.distance,
            duration_weeks: planData.durationWeeks,
            created_by: planData.createdBy
        })
        .select()
        .single();

    if (planError) {
        console.error('Error creating plan:', planError);
        return { error: planError };
    }

    // Insert weeks
    const weekRows = weeksData.map((week, idx) => ({
        plan_id: plan.id,
        week_number: idx + 1,
        days: week.days
    }));

    const { error: weeksError } = await supabase
        .from('plan_weeks')
        .insert(weekRows);

    if (weeksError) {
        console.error('Error creating plan weeks:', weeksError);
        return { error: weeksError };
    }

    return { data: plan, error: null };
}

// ─── Load user profile (paces) ───
export async function loadProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
    }
    return data;
}

// ─── Save user profile (paces) ───
export async function saveProfile(userId, profileData) {
    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            display_name: profileData.displayName,
            avatar_url: profileData.avatarUrl,
            tuning_mode: profileData.tuningMode,
            single_pb: profileData.singlePb,
            all_pbs: profileData.allPbs,
            goal_time: profileData.goalTime
        });

    if (error) {
        console.error('Error saving profile:', error);
    }
    return { error };
}

// ─── Load admin status ───
export async function loadAdminStatus(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error loading admin status:', error);
        return false;
    }
    return data?.is_admin || false;
}

// ─── User Events (Timeline) ───
export async function loadUserEvents(userId) {
    const { data, error } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: true });

    if (error) {
        console.error('Error loading user events:', error);
        return [];
    }
    return data || [];
}

export async function createUserEvent(eventData) {
    const { data, error } = await supabase
        .from('user_events')
        .insert(eventData)
        .select()
        .single();

    if (error) {
        console.error('Error creating event:', error);
    }
    return { data, error };
}

export async function updateUserEvent(eventId, eventData) {
    const { data, error } = await supabase
        .from('user_events')
        .update(eventData)
        .eq('id', eventId)
        .select()
        .single();

    if (error) {
        console.error('Error updating event:', error);
    }
    return { data, error };
}

export async function deleteUserEvent(eventId) {
    const { error } = await supabase
        .from('user_events')
        .delete()
        .eq('id', eventId);

    if (error) {
        console.error('Error deleting event:', error);
    }
    return { error };
}

// ─── Plan Commits ───
export async function commitToPlan(userId, planId, generatedWorkouts = []) {
    const { data, error } = await supabase
        .from('user_plan_commits')
        .upsert({
            user_id: userId,
            plan_id: planId,
            committed_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        })
        .select()
        .single();

    if (error) {
        console.error('Error committing to plan:', error);
        return { error };
    }

    // Clear existing workouts for this commit, just in case
    await supabase.from('user_workouts').delete().eq('plan_commit_id', data.id);

    // Insert new generated workouts
    if (generatedWorkouts && generatedWorkouts.length > 0) {
        const workoutsToInsert = generatedWorkouts.map(w => ({
            user_id: userId,
            plan_commit_id: data.id,
            scheduled_date: w.scheduled_date,
            workout_type: w.workout_type,
            planned_data: w.planned_data,
            status: 'PLANNED'
        }));

        const { error: insertError } = await supabase
            .from('user_workouts')
            .insert(workoutsToInsert);

        if (insertError) {
            console.error('Error inserting generated workouts:', insertError);
            return { data, error: insertError };
        }
    }

    return { data, error: null };
}

export async function uncommitFromPlan(userId) {
    const { error } = await supabase
        .from('user_plan_commits')
        .delete()
        .eq('user_id', userId);

    if (error) {
        console.error('Error uncommitting from plan:', error);
    }
    return { error };
}

export async function getCommittedPlan(userId) {
    const { data, error } = await supabase
        .from('user_plan_commits')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error loading committed plan:', error);
    }
    return data;
}

// ─── Admin: Delete a plan ───
export async function deletePlan(planId) {
    const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId);

    if (error) {
        console.error('Error deleting plan:', error);
    }
    return { error };
}

// ─── Admin: Update plan week data ───
export async function updatePlanWeek(weekId, days) {
    const { error } = await supabase
        .from('plan_weeks')
        .update({ days })
        .eq('id', weekId);

    if (error) {
        console.error('Error updating plan week:', error);
    }
    return { error };
}

// ─── User Workouts & Tracking ───
export async function loadUserWorkouts(userId, planCommitId) {
    const { data, error } = await supabase
        .from('user_workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('plan_commit_id', planCommitId)
        .order('scheduled_date', { ascending: true });

    if (error) {
        console.error('Error loading user workouts:', error);
        return [];
    }
    return data || [];
}

export async function updateUserWorkout(workoutId, updateData) {
    const { data, error } = await supabase
        .from('user_workouts')
        .update(updateData)
        .eq('id', workoutId)
        .select()
        .single();

    if (error) {
        console.error('Error updating user workout:', error);
    }
    return { data, error };
}

// ─── Plan Adjustments ───
export async function createPlanAdjustment(adjustmentData) {
    const { data, error } = await supabase
        .from('plan_adjustments')
        .insert(adjustmentData)
        .select()
        .single();

    if (error) {
        console.error('Error creating plan adjustment:', error);
    }
    return { data, error };
}

// ─── Sandbox ───
export async function wipeSandboxData(sandboxUserId) {
    // Delete in order to avoid FK issues, though cascade should handle it.
    await supabase.from('user_workouts').delete().eq('user_id', sandboxUserId);
    await supabase.from('plan_adjustments').delete().eq('user_id', sandboxUserId);
    await supabase.from('user_events').delete().eq('user_id', sandboxUserId);
    await supabase.from('user_plan_commits').delete().eq('user_id', sandboxUserId);
    await supabase.from('user_plan_customizations').delete().eq('user_id', sandboxUserId);
}

