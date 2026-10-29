import { z } from 'zod';

/**
 * Match data for URL matching
 */
export const RedirectMatchDataSchema = z.object( {
	source: z
		.object( {
			flag_regex: z.boolean(),
			flag_trailing: z.boolean(),
			flag_case: z.boolean(),
			flag_query: z.string(),
			// DSuite: plain source containing `*`; derived by the server on save.
			flag_wildcard: z.boolean().optional(),
		} )
		.optional(),
	options: z.record( z.string(), z.unknown() ).optional(),
} );

export type RedirectMatchData = z.infer< typeof RedirectMatchDataSchema >;

/**
 * Redirect entity schema
 */
export const RedirectSchema = z.object( {
	id: z.number().int(),
	url: z.string(),
	match_url: z.string().optional(), // URL after processing regex/flags
	match_type: z.string(),
	action_type: z.string(),
	action_code: z.number().int(),
	action_data: z.unknown(),
	match_data: RedirectMatchDataSchema.nullish(),
	group_id: z.number().int(),
	title: z.string(),
	position: z.number().int().nonnegative(),
	regex: z.boolean().optional(),
	last_access: z.string().optional(), // Formatted date string or '-'
	enabled: z.boolean().optional(),
	hits: z.number().int().nonnegative().optional(),
	// ISO 8601 in site time; null = no limit.
	start_at: z.string().nullish(),
	end_at: z.string().nullish(),
	schedule_state: z.enum( [ 'none', 'scheduled', 'live', 'expired' ] ).optional(),
} );

export type Redirect = z.infer< typeof RedirectSchema >;

/**
 * Create redirect input schema
 */
export const CreateRedirectInputSchema = z.object( {
	url: z.string().min( 1, 'Source URL is required' ),
	title: z.string().optional(),
	match_type: z.string(),
	action_type: z.string(),
	action_code: z.number().int().min( 100 ).max( 599 ).optional(),
	action_data: z.unknown().optional(),
	match_data: RedirectMatchDataSchema.optional(),
	group_id: z.number().int().positive(),
	position: z.number().int().nonnegative().default( 0 ),
	enabled: z.boolean().optional(),
	// `YYYY-MM-DDTHH:mm` in site time; null clears.
	start_at: z.string().nullable().optional(),
	end_at: z.string().nullable().optional(),
} );

export type CreateRedirectInput = z.infer< typeof CreateRedirectInputSchema >;

/**
 * Update redirect input schema
 */
export const UpdateRedirectInputSchema = CreateRedirectInputSchema.partial().extend( {
	id: z.number().int(),
} );

export type UpdateRedirectInput = z.infer< typeof UpdateRedirectInputSchema >;

/**
 * Bulk action schema
 */
export const BulkActionSchema = z.object( {
	items: z.array( z.number().int() ),
	action: z.enum( [ 'delete', 'enable', 'disable', 'reset' ] ),
} );

export type BulkAction = z.infer< typeof BulkActionSchema >;

/**
 * POST /redirect/:id/test: what the server got when it requested the old URL without following it
 */
export const RedirectTestResultSchema = z.object( {
	code: z.number(),
	location: z.string(),
	ms: z.number(),
	utm_preserved: z.boolean().nullable(),
	ok: z.boolean(),
} );

export type RedirectTestResult = z.infer< typeof RedirectTestResultSchema >;
