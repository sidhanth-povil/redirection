import { __ } from '@wordpress/i18n';

interface Header {
	name: string;
	title: string;
	primary?: boolean;
	sortable?: boolean;
}

interface BulkOption {
	id: string;
	name: string;
}

interface DisplayGroup {
	value: string;
	label: string;
	grouping: string[];
}

interface DisplayOption {
	value: string;
	label: string;
}

interface SearchOption {
	name: string;
	title: string;
}

interface GroupByOption {
	value: string;
	label: string;
}

interface FilterOption {
	label: string;
	value: string;
	options: Array< { label: string; value: string } >;
}

export const getHeaders = ( groupBy?: string ): Header[] => {
	if ( groupBy === 'url' ) {
		return [
			{ name: 'url', title: __( 'Source URL', 'dsuite-redirects' ), primary: true, sortable: false },
			{ name: 'count', title: __( 'Count', 'dsuite-redirects' ), sortable: true },
		];
	} else if ( groupBy === 'ip' ) {
		return [
			{ name: 'ip', title: __( 'IP', 'dsuite-redirects' ), primary: true, sortable: false },
			{ name: 'count', title: __( 'Count', 'dsuite-redirects' ), sortable: true },
		];
	} else if ( groupBy === 'agent' ) {
		return [
			{ name: 'agent', title: __( 'User Agent', 'dsuite-redirects' ), primary: true, sortable: false },
			{ name: 'count', title: __( 'Count', 'dsuite-redirects' ), sortable: true },
		];
	}
	return [
		{ name: 'date', title: __( 'Date', 'dsuite-redirects' ) },
		{ name: 'method', title: __( 'Method', 'dsuite-redirects' ), sortable: false },
		{ name: 'domain', title: __( 'Domain', 'dsuite-redirects' ), sortable: false },
		{ name: 'url', title: __( 'Source URL', 'dsuite-redirects' ), primary: true },
		{ name: 'target', title: __( 'Target URL', 'dsuite-redirects' ), sortable: false },
		{ name: 'redirect_by', title: __( 'Redirect By', 'dsuite-redirects' ), sortable: false },
		{ name: 'code', title: __( 'HTTP code', 'dsuite-redirects' ), sortable: false },
		{ name: 'referrer', title: __( 'Referrer', 'dsuite-redirects' ), sortable: false },
		{ name: 'agent', title: __( 'User Agent', 'dsuite-redirects' ), sortable: false },
		{ name: 'ip', title: __( 'IP', 'dsuite-redirects' ), sortable: false },
	];
};

export const getBulk = (): BulkOption[] => [
	{ id: 'delete', name: __( 'Delete', 'dsuite-redirects' ) },
	{ id: 'export-csv', name: __( 'Export as CSV', 'dsuite-redirects' ) },
	{ id: 'export-json', name: __( 'Export as JSON', 'dsuite-redirects' ) },
];

export const getDisplayGroups = ( groupBy?: string ): DisplayGroup[] => {
	if ( groupBy ) {
		return [ { value: 'group', label: __( 'Group', 'dsuite-redirects' ), grouping: [ groupBy, 'count' ] } ];
	}
	return [
		{
			value: 'standard',
			label: __( 'Standard Display', 'dsuite-redirects' ),
			grouping: [ 'date', 'url', 'target', 'agent', 'ip' ],
		},
		{ value: 'minimal', label: __( 'Compact Display', 'dsuite-redirects' ), grouping: [ 'date', 'url' ] },
		{
			value: 'all',
			label: __( 'Display All', 'dsuite-redirects' ),
			grouping: getDisplayOptions( groupBy ).map( ( item ) => item.value ),
		},
	];
};

export const getDisplayOptions = ( groupBy?: string ): DisplayOption[] => {
	if ( groupBy === 'url' ) {
		return [
			{ value: 'url', label: __( 'URL', 'dsuite-redirects' ) },
			{ value: 'count', label: __( 'Count', 'dsuite-redirects' ) },
		];
	}
	if ( groupBy === 'agent' ) {
		return [
			{ value: 'agent', label: __( 'User Agent', 'dsuite-redirects' ) },
			{ value: 'count', label: __( 'Count', 'dsuite-redirects' ) },
		];
	}
	if ( groupBy === 'ip' ) {
		return [
			{ value: 'ip', label: __( 'IP', 'dsuite-redirects' ) },
			{ value: 'count', label: __( 'Count', 'dsuite-redirects' ) },
		];
	}
	return [
		{ value: 'date', label: __( 'Date', 'dsuite-redirects' ) },
		{ value: 'method', label: __( 'Method', 'dsuite-redirects' ) },
		{ value: 'domain', label: __( 'Domain', 'dsuite-redirects' ) },
		{ value: 'url', label: __( 'URL', 'dsuite-redirects' ) },
		{ value: 'redirect_by', label: __( 'Redirect By', 'dsuite-redirects' ) },
		{ value: 'code', label: __( 'HTTP code', 'dsuite-redirects' ) },
		{ value: 'referrer', label: __( 'Referrer', 'dsuite-redirects' ) },
		{ value: 'agent', label: __( 'User Agent', 'dsuite-redirects' ) },
		{ value: 'target', label: __( 'Target', 'dsuite-redirects' ) },
		{ value: 'ip', label: __( 'IP', 'dsuite-redirects' ) },
	];
};

export const getSearchOptions = (): SearchOption[] => [
	{ name: 'url', title: __( 'Search URL', 'dsuite-redirects' ) },
	{ name: 'url-exact', title: __( 'Search exact URL', 'dsuite-redirects' ) },
	{ name: 'referrer', title: __( 'Search referrer', 'dsuite-redirects' ) },
	{ name: 'agent', title: __( 'Search user agent', 'dsuite-redirects' ) },
	{ name: 'ip', title: __( 'Search IP', 'dsuite-redirects' ) },
	{ name: 'target', title: __( 'Search target URL', 'dsuite-redirects' ) },
	{ name: 'domain', title: __( 'Search domain', 'dsuite-redirects' ) },
];

export const getGroupBy = ( ipLogging: number ): GroupByOption[] => {
	const values: GroupByOption[] = [
		{ value: '', label: __( 'No grouping', 'dsuite-redirects' ) },
		{ value: 'url', label: __( 'Group by URL', 'dsuite-redirects' ) },
		{ value: 'agent', label: __( 'Group by user agent', 'dsuite-redirects' ) },
	];

	if ( ipLogging > 0 ) {
		values.push( { value: 'ip', label: __( 'Group by IP', 'dsuite-redirects' ) } );
	}

	return values;
};

export const getFilterOptions = (): FilterOption[] => [
	{
		label: __( 'Method', 'dsuite-redirects' ),
		value: 'method',
		options: [
			{ label: 'GET', value: 'get' },
			{ label: 'POST', value: 'post' },
			{ label: 'HEAD', value: 'head' },
		],
	},
	{
		label: __( 'Redirect By', 'dsuite-redirects' ),
		value: 'redirect_by',
		options: [
			{ label: __( 'WordPress', 'dsuite-redirects' ), value: 'wordpress' },
			{ label: __( 'DSuite Redirects', 'dsuite-redirects' ), value: 'redirection' },
		],
	},
];
