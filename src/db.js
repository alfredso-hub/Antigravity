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
