import { __ } from '@wordpress/i18n';
import {
	ACTION_URL,
	ACTION_PASS,
	ACTION_NOTHING,
	ACTION_RANDOM,
	ACTION_ERROR,
	MATCH_URL,
	MATCH_LOGIN,
	MATCH_REFERRER,
	MATCH_AGENT,
	MATCH_COOKIE,
	MATCH_HEADER,
	MATCH_CUSTOM,
	MATCH_ROLE,
	MATCH_SERVER,
	MATCH_IP,
	MATCH_PAGE,
	MATCH_LANGUAGE,
} from 'lib/redirect-constants';

interface LabelValue {
	value: string;
	label: string;
}

export const getMatches = (): LabelValue[] => [
	{
		value: MATCH_URL,
		label: __( 'URL only', 'dsuite-redirects' ),
	},
	{
		value: MATCH_LOGIN,
		label: __( 'URL and login status', 'dsuite-redirects' ),
	},
	{
		value: MATCH_ROLE,
		label: __( 'URL and role/capability', 'dsuite-redirects' ),
	},
	{
		value: MATCH_REFERRER,
		label: __( 'URL and referrer', 'dsuite-redirects' ),
	},
	{
		value: MATCH_AGENT,
		label: __( 'URL and user agent', 'dsuite-redirects' ),
	},
	{
		value: MATCH_COOKIE,
		label: __( 'URL and cookie', 'dsuite-redirects' ),
	},
	{
		value: MATCH_IP,
		label: __( 'URL and IP', 'dsuite-redirects' ),
	},
	{
		value: MATCH_SERVER,
		label: __( 'URL and server', 'dsuite-redirects' ),
	},
	{
		value: MATCH_HEADER,
		label: __( 'URL and HTTP header', 'dsuite-redirects' ),
	},
	{
		value: MATCH_CUSTOM,
		label: __( 'URL and custom filter', 'dsuite-redirects' ),
	},
	{
		value: MATCH_PAGE,
		label: __( 'URL and WordPress page type', 'dsuite-redirects' ),
	},
	{
		value: MATCH_LANGUAGE,
		label: __( 'URL and language', 'dsuite-redirects' ),
	},
];

export const getActions = (): LabelValue[] => [
	{
		value: ACTION_URL,
		label: __( 'Redirect to URL', 'dsuite-redirects' ),
	},
	{
		value: ACTION_RANDOM,
		label: __( 'Redirect to random post', 'dsuite-redirects' ),
	},
	{
		value: ACTION_PASS,
		label: __( 'Pass-through', 'dsuite-redirects' ),
	},
	{
		value: ACTION_ERROR,
		label: __( 'Error (404)', 'dsuite-redirects' ),
	},
	{
		value: ACTION_NOTHING,
		label: __( 'Do nothing (ignore)', 'dsuite-redirects' ),
	},
];

export const getHttpCodes = (): LabelValue[] => [
	{
		value: '301',
		label: __( '301 - Moved Permanently', 'dsuite-redirects' ),
	},
	{
		value: '302',
		label: __( '302 - Found', 'dsuite-redirects' ),
	},
	{
		value: '303',
		label: __( '303 - See Other', 'dsuite-redirects' ),
	},
	{
		value: '304',
		label: __( '304 - Not Modified', 'dsuite-redirects' ),
	},
	{
		value: '307',
		label: __( '307 - Temporary Redirect', 'dsuite-redirects' ),
	},
	{
		value: '308',
		label: __( '308 - Permanent Redirect', 'dsuite-redirects' ),
	},
];

export const getHttpError = (): LabelValue[] => [
	{
		value: '400',
		label: __( '400 - Bad Request', 'dsuite-redirects' ),
	},
	{
		value: '401',
		label: __( '401 - Unauthorized', 'dsuite-redirects' ),
	},
	{
		value: '403',
		label: __( '403 - Forbidden', 'dsuite-redirects' ),
	},
	{
		value: '404',
		label: __( '404 - Not Found', 'dsuite-redirects' ),
	},
	{
		value: '410',
		label: __( '410 - Gone', 'dsuite-redirects' ),
	},
	{
		value: '418',
		label: __( "418 - I'm a teapot", 'dsuite-redirects' ),
	},
	{
		value: '451',
		label: __( '451 - Unavailable For Legal Reasons', 'dsuite-redirects' ),
	},
	{
		value: '500',
		label: __( '500 - Internal Server Error', 'dsuite-redirects' ),
	},
	{
		value: '501',
		label: __( '501 - Not implemented', 'dsuite-redirects' ),
	},
	{
		value: '502',
		label: __( '502 - Bad Gateway', 'dsuite-redirects' ),
	},
	{
		value: '503',
		label: __( '503 - Service Unavailable', 'dsuite-redirects' ),
	},
	{
		value: '504',
		label: __( '504 - Gateway Timeout', 'dsuite-redirects' ),
	},
];

export const getAllHttpCodes = (): LabelValue[] => getHttpCodes().concat( getHttpError() );

export const getSourceFlags = (): LabelValue[] => [
	{
		value: 'flag_regex',
		label: __( 'Regex', 'dsuite-redirects' ),
	},
	{
		value: 'flag_trailing',
		label: __( 'Ignore Slash', 'dsuite-redirects' ),
	},
	{
		value: 'flag_case',
		label: __( 'Ignore Case', 'dsuite-redirects' ),
	},
];

export const FLAG_REGEX = 0;
export const FLAG_TRAILING = 1;
export const FLAG_CASE = 2;

export const getSourceQuery = (): LabelValue[] => [
	{
		value: 'exactorder',
		label: __( 'Exact match', 'dsuite-redirects' ),
	},
	{
		value: 'exact',
		label: __( 'Exact match in any order', 'dsuite-redirects' ),
	},
	{
		value: 'ignore',
		label: __( 'Ignore all parameters', 'dsuite-redirects' ),
	},
	{
		value: 'pass',
		label: __( 'Ignore & pass parameters to the target', 'dsuite-redirects' ),
	},
];
