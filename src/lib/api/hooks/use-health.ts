import { keepPreviousData, useQuery } from '@tanstack/react-query';
import apiFetch from '@wp-plugin-lib/api-fetch';
import { RedirectionApi } from 'lib/api-request';
import { CheckResponseSchema, HealthResponseSchema } from 'types';
import { queryKeys } from '../query-keys';
import { handleApiError } from '../errors';
import { useMessageStore } from 'stores';

/**
 * Overview's counts and "Needs attention" list.
 */
export function useHealth() {
	return useQuery( {
		queryKey: queryKeys.health.get(),
		refetchOnMount: 'always',
		queryFn: async () => {
			try {
				return HealthResponseSchema.parse( await apiFetch( RedirectionApi.health.get() ) );
			} catch ( error ) {
				const handledError = handleApiError( error );
				useMessageStore.getState().addError( handledError.message || 'Failed to load the overview' );
				throw handledError;
			}
		},
	} );
}

/**
 * The drawer's check before saving. It only advises, so a failure shows nothing rather than an error.
 *
 * @param params        - What to check.
 * @param params.source - Old URL as typed.
 * @param params.target - Destination as typed.
 * @param params.id     - Redirect being edited, 0 for a new one.
 * @param enabled       - Whether the redirect is one the check understands.
 */
export function useRedirectCheck( params: { source: string; target: string; id: number }, enabled: boolean ) {
	return useQuery( {
		queryKey: queryKeys.health.check( params ),
		enabled,
		retry: false,
		placeholderData: keepPreviousData,
		queryFn: async () => CheckResponseSchema.parse( await apiFetch( RedirectionApi.health.check( params ) ) ),
	} );
}
