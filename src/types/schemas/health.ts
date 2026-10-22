import { z } from 'zod';
import { RedirectSchema } from './redirect';

/**
 * GET /health: what Overview shows. Chain and loop paths are normalised keys, ending in the raw final target.
 */
export const AttentionItemSchema = z.discriminatedUnion( 'type', [
	z.object( { type: z.literal( '404' ), url: z.string(), hits: z.number() } ),
	z.object( {
		type: z.literal( 'chain' ),
		id: z.number(),
		hits: z.number(),
		path: z.array( z.string() ),
		final_target: z.string(),
		redirect: RedirectSchema.nullable(),
	} ),
	z.object( {
		type: z.literal( 'loop' ),
		id: z.number(),
		hits: z.number(),
		path: z.array( z.string() ),
		redirect: RedirectSchema.nullable(),
	} ),
	z.object( {
		type: z.literal( 'expiring' ),
		id: z.number(),
		hits: z.number(),
		end_at: z.string().nullable(),
		redirect: RedirectSchema,
	} ),
] );

export type AttentionItem = z.infer< typeof AttentionItemSchema >;

export const HealthResponseSchema = z.object( {
	counts: z.object( {
		active: z.number(),
		new404s: z.number(),
		chains: z.number(),
		loops: z.number(),
		scheduled: z.number(),
	} ),
	attention: z.array( AttentionItemSchema ),
} );

export type HealthResponse = z.infer< typeof HealthResponseSchema >;

/**
 * POST /check: the drawer's check before saving.
 */
export const CheckResponseSchema = z.object( {
	status: z.enum( [ 'ok', 'chain', 'loop', 'duplicate' ] ),
	path: z.array( z.string() ).optional(),
	final_target: z.string().optional(),
	existing_id: z.number().optional(),
} );

export type CheckResponse = z.infer< typeof CheckResponseSchema >;
