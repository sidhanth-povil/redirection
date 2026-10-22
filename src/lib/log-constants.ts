/**
 * Log type constants
 */
export const LOGS_TYPE_404 = '404';
export const LOGS_TYPE_REDIRECT = 'redirect';

/**
 * Initial table state for errors/404s
 */
export function getInitialError() {
	return {
		orderby: '',
		direction: 'desc',
		page: 0,
		perPage: 25,
		selected: [],
		filter: '',
		// DSuite: the 404s page lists each URL once, starting on this week's unignored 404s.
		filterBy: { since: '7', ignored: '0' },
		groupBy: 'url',
	};
}

/**
 * Initial table state for logs
 */
export function getInitialLog() {
	return {
		orderby: '',
		direction: 'desc',
		page: 0,
		perPage: 25,
		selected: [],
		filter: '',
		filterBy: '',
		groupBy: '',
	};
}

/**
 * Initial table state for groups
 */
export function getInitialGroup() {
	return {
		orderby: 'name',
		direction: 'asc',
		page: 0,
		perPage: 25,
		selected: [],
		filter: '',
		filterBy: '',
		groupBy: '',
	};
}

/**
 * Initial table state for redirects
 */
export function getInitialRedirect() {
	return {
		orderby: 'id',
		direction: 'desc',
		page: 0,
		perPage: 25,
		selected: [],
		filter: '',
		filterBy: '',
		groupBy: '',
	};
}
