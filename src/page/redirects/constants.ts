import { __ } from '@wordpress/i18n';
import { getMatches, getActions, getAllHttpCodes } from 'component/redirect-edit/constants';

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

interface DisplayOption {
	value: string;
	label: string;
}

interface DisplayGroup {
	value: string;
	label: string;
	grouping: string[];
}

interface FilterOption {
	label: string;
	value: string;
	options: Array< { label: string; value: string } >;
}

interface SearchOption {
	name: string;
	title: string;
}

export const getHeaders = (): Header[] => [
	{
		name: 'status',
		title: __( 'Status', 'dsuite-redirects' ),
		sortable: false,
	},
	{
		name: 'source',
		title: __( 'URL', 'dsuite-redirects' ),
		primary: true,
	},
	{
		name: 'match_type',
		title: __( 'Match Type', 'dsuite-redirects' ),
		sortable: false,
	},
	{
		name: 'action_type',
		title: __( 'Action Type', 'dsuite-redirects' ),
		sortable: false,
	},
	{
		name: 'code',
		title: __( 'Code', 'dsuite-redirects' ),
		sortable: false,
	},
	{
		name: 'group',
		title: __( 'Group', 'dsuite-redirects' ),
		sortable: false,
	},
	{
		name: 'position',
		title: __( 'Pos', 'dsuite-redirects' ),
	},
	{
		name: 'last_count',
		title: __( 'Hits', 'dsuite-redirects' ),
		sortable: true,
	},
	{
		name: 'last_access',
		title: __( 'Last Access', 'dsuite-redirects' ),
	},
];

export const getBulk = (): BulkOption[] => [
	{
		id: 'delete',
		name: __( 'Delete', 'dsuite-redirects' ),
	},
	{
		id: 'enable',
		name: __( 'Enable', 'dsuite-redirects' ),
	},
	{
		id: 'disable',
		name: __( 'Disable', 'dsuite-redirects' ),
	},
	{
		id: 'reset',
		name: __( 'Reset hits', 'dsuite-redirects' ),
	},
	{
		id: 'export-csv',
		name: __( 'Export as CSV', 'dsuite-redirects' ),
	},
	{
		id: 'export-json',
		name: __( 'Export as JSON', 'dsuite-redirects' ),
	},
	{
		id: 'copy-csv',
		name: __( 'Copy CSV', 'dsuite-redirects' ),
	},
	{
		id: 'copy-json',
		name: __( 'Copy JSON', 'dsuite-redirects' ),
	},
];

export const getDisplayOptions = (): DisplayOption[] => [
	{ value: 'source', label: __( 'Source', 'dsuite-redirects' ) },
	{ value: 'flags', label: __( 'URL options', 'dsuite-redirects' ) },
	{ value: 'query', label: __( 'Query Parameters', 'dsuite-redirects' ) },
	{ value: 'title', label: __( 'Title', 'dsuite-redirects' ) },
	{ value: 'target', label: __( 'Target', 'dsuite-redirects' ) },
	{ value: 'code', label: __( 'HTTP code', 'dsuite-redirects' ) },
	{ value: 'match_type', label: __( 'Match Type', 'dsuite-redirects' ) },
	{ value: 'position', label: __( 'Position', 'dsuite-redirects' ) },
	{ value: 'last_count', label: __( 'Hits', 'dsuite-redirects' ) },
	{ value: 'last_access', label: __( 'Last Access', 'dsuite-redirects' ) },
	{ value: 'status', label: __( 'Status', 'dsuite-redirects' ) },
	{ value: 'action_type', label: __( 'Action Type', 'dsuite-redirects' ) },
	{ value: 'group', label: __( 'Group', 'dsuite-redirects' ) },
];

export const getDisplayGroups = (): DisplayGroup[] => [
	{
		value: 'standard',
		label: __( 'Standard Display', 'dsuite-redirects' ),
		grouping: [ 'last_count', 'last_access', 'source', 'target', 'code', 'title' ],
	},
	{
		value: 'minimal',
		label: __( 'Compact Display', 'dsuite-redirects' ),
		grouping: [ 'source', 'last_count', 'last_access', 'target' ],
	},
	{
		value: 'all',
		label: __( 'Display All', 'dsuite-redirects' ),
		grouping: getDisplayOptions().map( ( item ) => item.value ),
	},
];

export const getFilterOptions = (): FilterOption[] => [
	{
		label: __( 'Status', 'dsuite-redirects' ),
		value: 'status',
		options: [
			{
				label: __( 'Enabled', 'dsuite-redirects' ),
				value: 'enabled',
			},
			{
				label: __( 'Disabled', 'dsuite-redirects' ),
				value: 'disabled',
			},
		],
	},
	{
		label: __( 'URL match', 'dsuite-redirects' ),
		value: 'url-match',
		options: [
			{
				label: __( 'Regular Expression', 'dsuite-redirects' ),
				value: 'regular',
			},
			{
				label: __( 'Plain', 'dsuite-redirects' ),
				value: 'plain',
			},
		],
	},
	{
		label: __( 'Match Type', 'dsuite-redirects' ),
		value: 'match',
		options: getMatches(),
	},
	{
		label: __( 'Action Type', 'dsuite-redirects' ),
		value: 'action',
		options: getActions(),
	},
	{
		label: __( 'HTTP Status Code', 'dsuite-redirects' ),
		value: 'http',
		options: getAllHttpCodes(),
	},
	{
		label: __( 'Last Accessed', 'dsuite-redirects' ),
		value: 'access',
		options: [
			{
				label: __( 'Never accessed', 'dsuite-redirects' ),
				value: 'never',
			},
			{
				label: __( 'Not accessed in last month', 'dsuite-redirects' ),
				value: 'month',
			},
			{
				label: __( 'Not accessed in last year', 'dsuite-redirects' ),
				value: 'year',
			},
		],
	},
];

export const getSearchOptions = (): SearchOption[] => [
	{
		name: 'url',
		title: __( 'Search URL', 'dsuite-redirects' ),
	},
	{
		name: 'target',
		title: __( 'Search target URL', 'dsuite-redirects' ),
	},
	{
		name: 'title',
		title: __( 'Search title', 'dsuite-redirects' ),
	},
];
