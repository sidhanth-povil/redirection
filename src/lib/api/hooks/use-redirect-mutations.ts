import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import apiFetch from '@wp-plugin-lib/api-fetch';
import { RedirectionApi } from 'lib/api-request';
import {
	RedirectItemResponseSchema,
	RedirectListResponseSchema,
	RedirectTestResultSchema,
	TraceResultSchema,
	type Redirect,
	type RedirectTestResult,
	type TraceResult,
	type CreateRedirectInput,
	type UpdateRedirectInput,
} from 'types';
import { queryKeys } from '../query-keys';
import { handleApiError } from '../errors';
import { getTableResetOnDelete } from '../utils';
import { useTableStore, useMessageStore } from 'stores';

/**
 * Mutation hook for creating a redirect
 * The API returns the full list of redirects after creation, not just the created item
 * @param options
 */
export function useRedirectCreate(
	options?: Omit< UseMutationOptions< Redirect | null, Error, CreateRedirectInput >, 'mutationFn' >
) {
	const queryClient = useQueryClient();
	const { incrementProgress, decrementProgress, addNotice, addError } = useMessageStore();

	return useMutation( {
		mutationFn: async ( data: CreateRedirectInput ) => {
			incrementProgress();
			try {
				await queryClient.cancelQueries( { queryKey: queryKeys.redirects.lists() } );
				const response = await apiFetch( RedirectionApi.redirect.create( data ) );
				// API returns a list response after creation
				const validated = RedirectListResponseSchema.parse( response );
				// Return the first item if available (the newly created one)
				return validated.items[ 0 ] ?? null;
			} catch ( error ) {
				decrementProgress();
				throw handleApiError( error );
			}
		},
		onSuccess: () => {
			decrementProgress();
			addNotice( 'Redirect created' );
			queryClient.invalidateQueries( { queryKey: queryKeys.redirects.lists() } );
			// 404 rows show the redirect that fixes them.
			queryClient.invalidateQueries( { queryKey: queryKeys.errors.lists() } );
		},
		onError: ( error ) => {
			addError( error.message || 'Failed to create redirect' );
		},
		...options,
	} );
}

/**
 * Mutation hook for updating a redirect
 * @param options
 */
export function useRedirectUpdate(
	options?: Omit< UseMutationOptions< Redirect, Error, UpdateRedirectInput >, 'mutationFn' >
) {
	const queryClient = useQueryClient();
	const { incrementProgress, decrementProgress, addNotice, addError } = useMessageStore();

	return useMutation( {
		mutationFn: async ( data: UpdateRedirectInput ) => {
			incrementProgress();
			try {
				await queryClient.cancelQueries( { queryKey: queryKeys.redirects.lists() } );
				const { id: redirectId, ...updates } = data;
				const response = await apiFetch( RedirectionApi.redirect.update( redirectId, updates ) );
				const validated = RedirectItemResponseSchema.parse( response );
				return validated.item;
			} catch ( error ) {
				decrementProgress();
				throw handleApiError( error );
			}
		},
		onSuccess: ( data ) => {
			decrementProgress();
			addNotice( 'Redirect saved' );
			queryClient.invalidateQueries( { queryKey: queryKeys.redirects.lists() } );
			// 404 rows show the redirect that fixes them.
			queryClient.invalidateQueries( { queryKey: queryKeys.errors.lists() } );
			queryClient.invalidateQueries( { queryKey: queryKeys.redirects.detail( data.id ) } );
		},
		onError: ( error ) => {
			addError( error.message || 'Failed to update redirect' );
		},
		...options,
	} );
}

/**
 * Mutation hook for deleting redirects (bulk)
 * @param options
 */
export function useRedirectDelete(
	options?: Omit< UseMutationOptions< any, Error, { items: number[]; params?: any } >, 'mutationFn' >
) {
	const queryClient = useQueryClient();
	const { incrementProgress, decrementProgress, addNotice, addError } = useMessageStore();
	const { setRedirectsTable } = useTableStore();

	return useMutation( {
		mutationFn: async ( { items, params = {} }: { items: number[]; params?: any } ) => {
			incrementProgress();
			try {
				await queryClient.cancelQueries( { queryKey: queryKeys.redirects.lists() } );
				const response = await apiFetch( RedirectionApi.bulk.redirect( 'delete', { items }, params ) );
				return response;
			} catch ( error ) {
				decrementProgress();
				throw handleApiError( error );
			}
		},
		onSuccess: ( _, variables ) => {
			decrementProgress();
			addNotice( 'Redirects deleted' );
			setRedirectsTable( getTableResetOnDelete( variables.params ) );
			queryClient.invalidateQueries( { queryKey: queryKeys.redirects.lists() } );
			// 404 rows show the redirect that fixes them.
			queryClient.invalidateQueries( { queryKey: queryKeys.errors.lists() } );
		},
		onError: ( error ) => {
			addError( error.message || 'Failed to delete redirects' );
		},
		...options,
	} );
}

/**
 * Mutation hook for bulk actions (enable, disable, reset)
 * @param action
 * @param options
 */
export function useRedirectBulkAction(
	action: 'enable' | 'disable' | 'reset',
	options?: Omit< UseMutationOptions< any, Error, { items: number[] } >, 'mutationFn' >
) {
	const queryClient = useQueryClient();
	const { incrementProgress, decrementProgress, addNotice, addError } = useMessageStore();
	const { setRedirectsSelected } = useTableStore();

	return useMutation( {
		mutationFn: async ( { items }: { items: number[] } ) => {
			incrementProgress();
			try {
				await queryClient.cancelQueries( { queryKey: queryKeys.redirects.lists() } );
				const response = await apiFetch( RedirectionApi.bulk.redirect( action, { items }, {} ) );
				return response;
			} catch ( error ) {
				decrementProgress();
				throw handleApiError( error );
			}
		},
		onSuccess: () => {
			decrementProgress();
			addNotice( `Redirects ${ action }d` );
			setRedirectsSelected( [] );
			queryClient.invalidateQueries( { queryKey: queryKeys.redirects.lists() } );
			// 404 rows show the redirect that fixes them.
			queryClient.invalidateQueries( { queryKey: queryKeys.errors.lists() } );
		},
		onError: ( error ) => {
			addError( error.message || `Failed to ${ action } redirects` );
		},
		...options,
	} );
}

/**
 * Test a saved redirect from the server. The row shows the result itself, so no page-wide notice or error.
 */
export function useRedirectTest() {
	return useMutation< RedirectTestResult, Error, number >( {
		mutationFn: async ( id: number ) => {
			try {
				return RedirectTestResultSchema.parse( await apiFetch( RedirectionApi.redirect.test( id ) ) );
			} catch ( error ) {
				throw handleApiError( error );
			}
		},
	} );
}

/**
 * Follow an address on this site hop by hop, from the server. The Support tester shows the result itself.
 */
export function useRedirectTrace() {
	return useMutation< TraceResult, Error, string >( {
		mutationFn: async ( url: string ) => {
			try {
				return TraceResultSchema.parse( await apiFetch( RedirectionApi.redirect.trace( url ) ) );
			} catch ( error ) {
				throw handleApiError( error );
			}
		},
	} );
}
