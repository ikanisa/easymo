/**
 * Domain Intake Tools
 * 
 * ADK tools for upserting domain-specific call intake data
 * (Jobs, Farmers, Real Estate).
 */

import { SupabaseClient } from '@supabase/supabase-js';

import {
  FarmersCallIntake,
  JobsCallIntake,
  RealEstateCallIntake,
} from '../types';

// ============================================================================
// JOBS INTAKE TOOL
// ============================================================================

export const upsertJobsIntakeTool = {
  name: 'upsert_jobs_call_intake',
  description: 'Save or update structured job-related data from a call. Use for both jobseekers and job posters.',
  parameters: {
    type: 'object',
    properties: {
      call_id: { type: 'string', description: 'Call ID' },
      mode: { type: 'string', enum: ['jobseeker', 'poster'], description: 'Is caller looking for work or posting a job?' },
      role_title: { type: 'string', description: 'Job title/role' },
      category: { type: 'string', description: 'Job category (waiter, driver, accountant, etc.)' },
      seniority: { type: 'string', enum: ['junior', 'mid', 'senior'], description: 'Experience level' },
      location_country: { type: 'string', description: 'Country' },
      location_city: { type: 'string', description: 'City' },
      location_district: { type: 'string', description: 'District' },
      location_sector: { type: 'string', description: 'Sector' },
      salary_min: { type: 'number', description: 'Minimum salary' },
      salary_max: { type: 'number', description: 'Maximum salary' },
      currency: { type: 'string', description: 'Salary currency (RWF, USD, etc.)' },
      employment_type: { type: 'string', enum: ['full_time', 'part_time', 'gig', 'one_off', 'internship', 'freelance'] },
      remote_preference: { type: 'string', enum: ['onsite', 'remote', 'hybrid'] },
      experience_years: { type: 'number', description: 'Years of experience' },
      skills: { type: 'array', items: { type: 'string' }, description: 'Key skills' },
      certifications: { type: 'array', items: { type: 'string' }, description: 'Certifications' },
      education_level: { type: 'string', description: 'Education level' },
      availability_date: { type: 'string', format: 'date', description: 'When can start' },
      can_start_immediately: { type: 'boolean', description: 'Available immediately?' },
      notes: { type: 'string', description: 'Additional notes' },
    },
    required: ['call_id', 'mode'],
  },
};

export async function executeUpsertJobsIntake(
  params: Partial<JobsCallIntake> & { call_id: string },
  supabase: SupabaseClient
): Promise<{ success: boolean; call_id: string }> {
  const { error } = await supabase
    .from('jobs_call_intakes')
    .upsert({
      ...params,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to upsert jobs intake: ${error.message}`);
  }

  return { success: true, call_id: params.call_id };
}

// ============================================================================
// FARMERS INTAKE TOOL
// ============================================================================

export const upsertFarmersIntakeTool = {
  name: 'upsert_farmers_call_intake',
  description: 'Save or update structured produce/farming data from a call. Use for farmers listing produce or buyers seeking produce.',
  parameters: {
    type: 'object',
    properties: {
      call_id: { type: 'string', description: 'Call ID' },
      side: { type: 'string', enum: ['farmer', 'buyer'], description: 'Is caller a farmer or buyer?' },
      produce_type: { type: 'string', description: 'Type of produce (tomatoes, potatoes, maize, etc.)' },
      variety: { type: 'string', description: 'Specific variety' },
      quantity: { type: 'number', description: 'Amount' },
      unit: { type: 'string', description: 'Unit of measure (kg, ton, sack, crate)' },
      expected_harvest_date: { type: 'string', format: 'date', description: 'When produce will be ready (farmers)' },
      delivery_window_start: { type: 'string', format: 'date', description: 'Earliest delivery date (buyers)' },
      delivery_window_end: { type: 'string', format: 'date', description: 'Latest delivery date (buyers)' },
      location_country: { type: 'string', description: 'Country' },
      location_district: { type: 'string', description: 'District' },
      location_sector: { type: 'string', description: 'Sector' },
      location_cell: { type: 'string', description: 'Cell' },
      min_price: { type: 'number', description: 'Minimum price per unit' },
      max_price: { type: 'number', description: 'Maximum price per unit' },
      currency: { type: 'string', description: 'Currency (RWF, USD, etc.)' },
      quality_grade: { type: 'string', description: 'Quality grade (A, B, C, Premium, Standard)' },
      organic: { type: 'boolean', description: 'Is produce organic?' },
      certifications: { type: 'array', items: { type: 'string' }, description: 'Certifications (organic, fair_trade)' },
      payment_preference: { type: 'string', enum: ['wallet', 'cod', 'bank_transfer', 'mobile_money'] },
      notes: { type: 'string', description: 'Additional notes' },
    },
    required: ['call_id', 'side', 'produce_type'],
  },
};

export async function executeUpsertFarmersIntake(
  params: Partial<FarmersCallIntake> & { call_id: string; produce_type: string },
  supabase: SupabaseClient
): Promise<{ success: boolean; call_id: string }> {
  const { error } = await supabase
    .from('farmers_call_intakes')
    .upsert({
      ...params,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to upsert farmers intake: ${error.message}`);
  }

  return { success: true, call_id: params.call_id };
}

// ============================================================================
// REAL ESTATE INTAKE TOOL
// ============================================================================

export const upsertRealEstateIntakeTool = {
  name: 'upsert_real_estate_call_intake',
  description: 'Save or update structured property requirements from a call. Use for buyers/tenants seeking and owners/landlords listing.',
  parameters: {
    type: 'object',
    properties: {
      call_id: { type: 'string', description: 'Call ID' },
      side: { type: 'string', enum: ['buyer', 'tenant', 'owner', 'landlord'], description: 'Caller role' },
      transaction_type: { type: 'string', enum: ['buy', 'rent'], description: 'Buy or rent?' },
      property_type: { type: 'string', description: 'Property type (apartment, house, plot, commercial)' },
      bedrooms: { type: 'integer', description: 'Number of bedrooms' },
      bathrooms: { type: 'integer', description: 'Number of bathrooms' },
      parking: { type: 'boolean', description: 'Parking required?' },
      parking_spots: { type: 'integer', description: 'Number of parking spots' },
      furnished: { type: 'boolean', description: 'Furnished required?' },
      furnished_level: { type: 'string', enum: ['fully', 'partially', 'unfurnished'] },
      size_sqm: { type: 'number', description: 'Property size in sqm' },
      plot_size_sqm: { type: 'number', description: 'Plot size in sqm' },
      location_country: { type: 'string', description: 'Country' },
      location_city: { type: 'string', description: 'City' },
      location_district: { type: 'string', description: 'District' },
      location_sector: { type: 'string', description: 'Sector' },
      location_street: { type: 'string', description: 'Street name' },
      preferred_neighborhoods: { type: 'array', items: { type: 'string' }, description: 'Preferred areas' },
      budget_min: { type: 'number', description: 'Minimum budget' },
      budget_max: { type: 'number', description: 'Maximum budget' },
      currency: { type: 'string', description: 'Currency' },
      payment_frequency: { type: 'string', enum: ['monthly', 'quarterly', 'yearly', 'one_time'] },
      move_in_date: { type: 'string', format: 'date', description: 'Desired move-in date' },
      stay_duration_months: { type: 'integer', description: 'Intended stay duration (rentals)' },
      urgency: { type: 'string', enum: ['immediate', 'flexible', 'within_month', 'within_3_months'] },
      must_haves: { type: 'array', items: { type: 'string' }, description: 'Required features' },
      nice_to_haves: { type: 'array', items: { type: 'string' }, description: 'Preferred features' },
      deal_breakers: { type: 'array', items: { type: 'string' }, description: 'Features to avoid' },
      notes: { type: 'string', description: 'Additional notes' },
    },
    required: ['call_id', 'side', 'transaction_type'],
  },
};

export async function executeUpsertRealEstateIntake(
  params: Partial<RealEstateCallIntake> & { call_id: string; transaction_type: string },
  supabase: SupabaseClient
): Promise<{ success: boolean; call_id: string }> {
  const { error } = await supabase
    .from('real_estate_call_intakes')
    .upsert({
      ...params,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to upsert real estate intake: ${error.message}`);
  }

  return { success: true, call_id: params.call_id };
}

// ============================================================================
// REGISTRY
// ============================================================================

export const DOMAIN_INTAKE_TOOLS = [
  upsertJobsIntakeTool,
  upsertFarmersIntakeTool,
  upsertRealEstateIntakeTool,
];

export const DOMAIN_INTAKE_EXECUTORS = {
  upsert_jobs_call_intake: executeUpsertJobsIntake,
  upsert_farmers_call_intake: executeUpsertFarmersIntake,
  upsert_real_estate_call_intake: executeUpsertRealEstateIntake,
};

/**
 * Execute a domain intake tool by name
 */
export async function executeDomainIntakeTool(
  toolName: string,
  params: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const executor = DOMAIN_INTAKE_EXECUTORS[toolName as keyof typeof DOMAIN_INTAKE_EXECUTORS];
  if (!executor) {
    throw new Error(`Unknown domain intake tool: ${toolName}`);
  }
  return executor(params as any, supabase);
}
