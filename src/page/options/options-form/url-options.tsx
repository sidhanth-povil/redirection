import { __ } from '@wordpress/i18n';
import { TableRow } from 'component/form-table';
import { Select, createInterpolateElement } from '@wp-plugin-components';
import UrlMonitoring from './url-monitor';

interface Option {
	value: number | string;
	label: string;
}

interface Settings {
	flag_case: boolean;
	flag_trailing: boolean;
	flag_query: string;
	auto_target: string;
	redirect_cache: number;
	cache_key: number | boolean;
	associated_redirect: string;
	monitor_post: number;
	monitor_types: string[];
}

interface GroupOption {
	value: number | Array< { value: number } >;
	label: string;
}

interface PostTypes {
	[ key: string ]: string;
}

interface UrlOptionsProps {
	settings: Settings;
	onChange: ( ev: React.ChangeEvent< HTMLInputElement > | { [ key: string ]: any } ) => void;
	getLink: ( rel: string, anchor?: string ) => string;
	groups: GroupOption[];
	postTypes: PostTypes;
}

export const queryMatch = (): Option[] => [
	{ value: 'exact', label: __( 'Exact match in any order', 'dsuite-redirects' ) },
	{ value: 'ignore', label: __( 'Ignore all query parameters', 'dsuite-redirects' ) },
	{ value: 'pass', label: __( 'Ignore and pass all query parameters', 'dsuite-redirects' ) },
];
const expireTimes = (): Option[] => [
	{ value: -1, label: __( 'Never cache', 'dsuite-redirects' ) },
	{ value: 1, label: __( 'An hour', 'dsuite-redirects' ) },
	{ value: 24, label: __( 'A day', 'dsuite-redirects' ) },
	{ value: 24 * 7, label: __( 'A week', 'dsuite-redirects' ) },
	{ value: 0, label: __( 'Forever', 'dsuite-redirects' ) },
];

function UrlOptions( props: UrlOptionsProps ) {
	const { settings, onChange, getLink, groups, postTypes } = props;
	const { flag_case, flag_trailing, flag_query, auto_target, redirect_cache, cache_key } = settings;

	return (
		<>
			<tr className="redirect-option__row">
				<th colSpan={ 2 }>
					<h2 className="title">{ __( 'URL', 'dsuite-redirects' ) }</h2>
				</th>
			</tr>
			<UrlMonitoring
				settings={ settings }
				onChange={ onChange }
				groups={ groups }
				getLink={ getLink }
				postTypes={ postTypes }
			/>
			<TableRow
				title={ __( 'Default URL settings', 'dsuite-redirects' ) + ':' }
				url={ getLink( 'options', 'urlsettings' ) }
			>
				<p>{ __( 'Applies to all redirections unless you configure them otherwise.', 'dsuite-redirects' ) }</p>
				<p>
					<input
						type="checkbox"
						id="url-options-flag-case"
						name="flag_case"
						onChange={ onChange }
						checked={ flag_case }
					/>
					<label htmlFor="url-options-flag-case">
						{ createInterpolateElement(
							__(
								'Case insensitive matches (i.e. {{code}}/Exciting-Post{{/code}} will match {{code}}/exciting-post{{/code}})',
								'dsuite-redirects'
							),
							{
								code: <code />,
							}
						) }
					</label>
				</p>

				<p>
					<input
						type="checkbox"
						id="url-options-flag-trailing"
						name="flag_trailing"
						onChange={ onChange }
						checked={ flag_trailing }
					/>
					<label htmlFor="url-options-flag-trailing">
						{ createInterpolateElement(
							__(
								'Ignore trailing slashes (i.e. {{code}}/exciting-post/{{/code}} will match {{code}}/exciting-post{{/code}})',
								'dsuite-redirects'
							),
							{
								code: <code />,
							}
						) }
					</label>
				</p>
			</TableRow>
			<TableRow
				title={ __( 'Default query matching', 'dsuite-redirects' ) + ':' }
				url={ getLink( 'options', 'querysettings' ) }
			>
				<p>{ __( 'Applies to all redirections unless you configure them otherwise.', 'dsuite-redirects' ) }</p>
				<p>
					<Select
						items={ queryMatch() as any }
						name="flag_query"
						value={ flag_query }
						onChange={ onChange as any }
					/>
				</p>
				<ul>
					<li>
						{ __(
							'Exact - matches the query parameters exactly defined in your source, in any order',
							'dsuite-redirects'
						) }
					</li>
					<li>
						{ __(
							'Ignore - as exact, but ignores any query parameters not in your source',
							'dsuite-redirects'
						) }
					</li>
					<li>
						{ __(
							'Pass - as ignore, but also copies the query parameters to the target',
							'dsuite-redirects'
						) }
					</li>
				</ul>
			</TableRow>
			<TableRow
				title={ __( 'Auto-generate URL', 'dsuite-redirects' ) + ':' }
				url={ getLink( 'options', 'autogenerate' ) }
			>
				<input
					className="regular-text"
					type="text"
					value={ auto_target }
					name="auto_target"
					onChange={ onChange }
				/>
				<br />
				<span className="sub">
					{ createInterpolateElement(
						__(
							'Used to auto-generate a URL if no URL is given. Use the special tags {{code}}$dec${{/code}} or {{code}}$hex${{/code}} to insert a unique ID instead',
							'dsuite-redirects'
						),
						{
							code: <code />,
						}
					) }
				</span>
			</TableRow>

			<TableRow title={ __( 'HTTP Cache Header', 'dsuite-redirects' ) } url={ getLink( 'options', 'cache' ) }>
				<Select
					items={ expireTimes() as any }
					name="redirect_cache"
					value={ String( redirect_cache ) }
					onChange={ onChange as any }
				/>{ ' ' }
				&nbsp;
				<span className="sub">
					{ __( 'How long to cache redirected 301 URLs (via "Expires" HTTP header)', 'dsuite-redirects' ) }
				</span>
			</TableRow>
			<TableRow title={ __( 'Redirect Caching', 'dsuite-redirects' ) } url={ getLink( 'options', 'cache' ) }>
				<input
					id="url-options-cache-key"
					type="checkbox"
					name="cache_key"
					onChange={ onChange }
					checked={ cache_key !== 0 && cache_key !== false }
				/>
				&nbsp;
				<label htmlFor="url-options-cache-key">
					<span className="sub">
						{ __(
							'(beta) Enable caching of redirects via WordPress object cache. Can improve performance. Requires an object cache.',
							'dsuite-redirects'
						) }
					</span>
				</label>
			</TableRow>
		</>
	);
}

export default UrlOptions;
