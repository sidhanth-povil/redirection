import { __ } from '@wordpress/i18n';

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

interface SearchOption {
	name: string;
	title: string;
}

export const getDisplayOptions = (): DisplayOption[] => [
	{ value: 'name', label: __( 'Name', 'dsuite-redirects' ) },
	{ value: 'module', label: __( 'Module', 'dsuite-redirects' ) },
	{ value: 'status', label: __( 'Status', 'dsuite-redirects' ) },
	{ value: 'redirects', label: __( 'Redirects', 'dsuite-redirects' ) },
];

export const getDisplayGroups = (): DisplayGroup[] => [
	{
		value: 'standard',
		label: __( 'Standard Display', 'dsuite-redirects' ),
		grouping: [ 'name', 'module', 'redirects' ],
	},
	{
		value: 'minimal',
		label: __( 'Compact Display', 'dsuite-redirects' ),
		grouping: [ 'name' ],
	},
	{
		value: 'all',
		label: __( 'Display All', 'dsuite-redirects' ),
		grouping: getDisplayOptions().map( ( item ) => item.value ),
	},
];

export const getFilterOptions = ( options: Array< { label: string; value: string } > ): FilterOption[] => [
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
		label: __( 'Module', 'dsuite-redirects' ),
		value: 'module',
		options,
	},
];

export const getHeaders = (): Header[] => [
	{
		name: 'status',
		title: __( 'Status', 'dsuite-redirects' ),
		sortable: false,
	},
	{
		name: 'name',
		title: __( 'Name', 'dsuite-redirects' ),
		primary: true,
	},
	{
		name: 'redirects',
		title: __( 'Redirects', 'dsuite-redirects' ),
		sortable: false,
	},
	{
		name: 'module',
		title: __( 'Module', 'dsuite-redirects' ),
		sortable: false,
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
		id: 'export-csv',
		name: __( 'Export as CSV', 'dsuite-redirects' ),
	},
	{
		id: 'export-json',
		name: __( 'Export as JSON', 'dsuite-redirects' ),
	},
];

export const getSearchOptions = (): SearchOption[] => [
	{
		name: 'name',
		title: __( 'Search', 'dsuite-redirects' ),
	},
];
