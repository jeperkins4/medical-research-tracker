// HIPAA-Compliant Analytics Aggregator - Supabase Edge Function
// Deno Deploy
// https://supabase.com/docs/guides/functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Minimum cell size for HIPAA compliance (prevent re-identification)
const MIN_CELL_SIZE = 11;

interface AnalyticsRequest {
  action: 'generate' | 'status';
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', { 
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        } 
      });
    }

    // Get Supabase client with service role (for aggregation)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { action } = await req.json() as AnalyticsRequest;

    if (action === 'generate') {
      console.log('🔒 Starting HIPAA-compliant analytics aggregation...');

      const today = new Date().toISOString().split('T')[0];

      // 1. User Metrics
      await generateUserMetrics(supabaseAdmin, today);

      // 2. Diagnosis Aggregates
      await generateDiagnosisAggregates(supabaseAdmin);

      // 3. Mutation Aggregates
      await generateMutationAggregates(supabaseAdmin);

      // 4. Treatment Aggregates
      await generateTreatmentAggregates(supabaseAdmin);

      // 5. Demographics
      await generateDemographics(supabaseAdmin);

      console.log('✅ Analytics aggregation complete (HIPAA-compliant)');

      return new Response(
        JSON.stringify({ success: true, message: 'Analytics generated successfully' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'status') {
      // Get latest analytics
      const { data, error } = await supabaseAdmin
        .from('analytics_user_metrics')
        .select('*')
        .order('metric_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, latestMetrics: data }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analytics error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Generate user metrics (counts only)
 */
async function generateUserMetrics(supabase: any, date: string) {
  // Total users
  const { count: totalUsers } = await supabase
    .from('auth.users')
    .select('*', { count: 'exact', head: true });

  // New users today
  const { count: newToday } = await supabase
    .from('auth.users')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', date);

  // Active users (30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { count: active30d } = await supabase
    .from('auth.users')
    .select('*', { count: 'exact', head: true })
    .gte('last_sign_in_at', thirtyDaysAgo.toISOString());

  // Upsert metrics
  await supabase
    .from('analytics_user_metrics')
    .upsert({
      metric_date: date,
      total_users: totalUsers || 0,
      new_users_today: newToday || 0,
      active_users_30d: active30d || 0
    }, {
      onConflict: 'metric_date'
    });

  console.log(`  ✓ User metrics: ${totalUsers} total users`);
}

/**
 * Generate diagnosis aggregates
 * HIPAA: Suppress counts < 11
 */
async function generateDiagnosisAggregates(supabase: any) {
  // Get diagnosis counts (assuming conditions table exists)
  const { data: diagnoses, error } = await supabase.rpc('get_diagnosis_aggregates', {
    min_count: MIN_CELL_SIZE
  });

  if (error) {
    console.log('  ⊘ Diagnoses: Table not found or RPC missing, skipping');
    return;
  }

  // Clear old aggregates
  await supabase.from('analytics_diagnosis_aggregates').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert new aggregates
  if (diagnoses && diagnoses.length > 0) {
    await supabase.from('analytics_diagnosis_aggregates').insert(diagnoses);
    console.log(`  ✓ Diagnosis aggregates: ${diagnoses.length} groups (min ${MIN_CELL_SIZE} patients each)`);
  } else {
    console.log(`  ⊘ Diagnosis aggregates: No groups with ${MIN_CELL_SIZE}+ patients`);
  }
}

/**
 * Generate mutation aggregates
 * HIPAA: Suppress counts < 11
 */
async function generateMutationAggregates(supabase: any) {
  const { data: mutations, error } = await supabase.rpc('get_mutation_aggregates', {
    min_count: MIN_CELL_SIZE
  });

  if (error) {
    console.log('  ⊘ Mutations: Table not found or RPC missing, skipping');
    return;
  }

  // Clear old aggregates
  await supabase.from('analytics_mutation_aggregates').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert new aggregates
  if (mutations && mutations.length > 0) {
    await supabase.from('analytics_mutation_aggregates').insert(mutations);
    console.log(`  ✓ Mutation aggregates: ${mutations.length} groups (min ${MIN_CELL_SIZE} patients each)`);
  } else {
    console.log(`  ⊘ Mutation aggregates: No groups with ${MIN_CELL_SIZE}+ patients`);
  }
}

/**
 * Generate treatment aggregates
 * HIPAA: Suppress counts < 11
 */
async function generateTreatmentAggregates(supabase: any) {
  const { data: treatments, error } = await supabase.rpc('get_treatment_aggregates', {
    min_count: MIN_CELL_SIZE
  });

  if (error) {
    console.log('  ⊘ Treatments: Table not found or RPC missing, skipping');
    return;
  }

  // Clear old aggregates
  await supabase.from('analytics_treatment_aggregates').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert new aggregates
  if (treatments && treatments.length > 0) {
    await supabase.from('analytics_treatment_aggregates').insert(treatments);
    console.log(`  ✓ Treatment aggregates: ${treatments.length} groups (min ${MIN_CELL_SIZE} patients each)`);
  } else {
    console.log(`  ⊘ Treatment aggregates: No groups with ${MIN_CELL_SIZE}+ patients`);
  }
}

/**
 * Generate demographics (age ranges, gender, state)
 * HIPAA: Age ranges (not exact ages), state-level only, suppress < 11
 */
async function generateDemographics(supabase: any) {
  const { data: demographics, error } = await supabase.rpc('get_demographics_aggregates', {
    min_count: MIN_CELL_SIZE
  });

  if (error) {
    console.log('  ⊘ Demographics: Table not found or RPC missing, skipping');
    return;
  }

  // Clear old aggregates
  await supabase.from('analytics_demographics').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert new aggregates
  if (demographics && demographics.length > 0) {
    await supabase.from('analytics_demographics').insert(demographics);
    console.log(`  ✓ Demographics: ${demographics.length} groups (min ${MIN_CELL_SIZE} patients each)`);
  } else {
    console.log(`  ⊘ Demographics: No groups with ${MIN_CELL_SIZE}+ patients`);
  }
}
