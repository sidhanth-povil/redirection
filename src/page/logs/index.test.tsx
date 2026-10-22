import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useExport, useLogBulkAction, useLogList } from 'lib/api/hooks';
import { useSettingsStore, useTableStore } from 'stores';
import { getInitialLog } from 'lib/log-constants';
import Logs from 'page/logs';

// `stores` resolves to an automock in src/__mocks__; the page needs the real table state.
jest.mock( 'stores', () => jest.requireActual( '../../stores' ) );
jest.mock( 'lib/api/hooks', () => ( {
	useLogList: jest.fn(),
	useLogBulkAction: jest.fn(),
	useExport: jest.fn(),
} ) );

const rows = [
	{
		id: 7,
		created: 'October 22, 2026',
		created_time: '2:06 pm',
		url: '/about-nothing',
		sent_to: '/p6-c',
		agent: 'Mozilla/5.0 (Macintosh)',
		ip: '10.0.0.1',
		redirection_id: 12,
	},
	{ id: 8, created: 'October 22, 2026', created_time: '1:13 pm', url: '/sched-soon', sent_to: '/hello-world/' },
];

const bulk = { mutate: jest.fn() };
const exporter = { mutate: jest.fn() };

function setup( { ipLogging = 1, list = rows }: { ipLogging?: number; list?: unknown[] } = {} ) {
	window.Redirectioni10n = {
		pluginRoot: 'admin.php?page=dsuite-redirects.php',
		caps: { capabilities: [ 'redirection_cap_log_delete' ], pages: [ 'log' ] },
	} as any;
	useSettingsStore.setState( { values: { ip_logging: ipLogging, token: 'abc' } as any } );
	( useLogList as jest.Mock ).mockReturnValue( { data: { items: list, total: list.length }, isFetching: false } );
	( useLogBulkAction as jest.Mock ).mockReturnValue( bulk );
	( useExport as jest.Mock ).mockReturnValue( exporter );

	return render( <Logs /> );
}

function row( text: string ): HTMLElement {
	return screen.getByText( text ).closest( 'tr' ) as HTMLElement;
}

function lastParams() {
	return ( useLogList as jest.Mock ).mock.calls.at( -1 )[ 0 ];
}

beforeEach( () => {
	jest.clearAllMocks();
	jest.useFakeTimers();
	window.location.hash = '#/logs';
	useTableStore.getState().setLogsTable( getInitialLog() as any );
} );

afterEach( () => {
	jest.useRealTimers();
} );

describe( 'Logs page', () => {
	it( 'shows date, URL → target and the agent', () => {
		setup();

		const first = row( '/about-nothing' );
		expect( within( first ).getByText( /October 22, 2026/ ) ).toBeInTheDocument();
		expect( within( first ).getByText( '→ /p6-c' ) ).toBeInTheDocument();
		expect( within( first ).getByText( 'Mozilla/5.0 (Macintosh)' ) ).toHaveAttribute(
			'title',
			'Mozilla/5.0 (Macintosh)'
		);
	} );

	it( 'searches by URL', () => {
		setup();

		fireEvent.change( screen.getByLabelText( 'Search logs' ), { target: { value: '/about' } } );
		act( () => {
			jest.runAllTimers();
		} );

		expect( lastParams().filterBy ).toEqual( { url: '/about' } );
	} );

	it( 'groups by URL, IP or agent', () => {
		setup();

		fireEvent.click( screen.getByRole( 'button', { name: 'By IP' } ) );
		expect( lastParams().groupBy ).toBe( 'ip' );
		expect( screen.getByRole( 'button', { name: 'By IP' } ) ).toHaveAttribute( 'aria-pressed', 'true' );

		fireEvent.click( screen.getByRole( 'button', { name: 'All hits' } ) );
		expect( lastParams().groupBy ).toBe( '' );
	} );

	it( 'hides the IP chip when IP logging is off', () => {
		setup( { ipLogging: 0 } );

		expect( screen.queryByRole( 'button', { name: 'By IP' } ) ).not.toBeInTheDocument();
	} );

	it( 'asks before deleting a row', () => {
		setup();
		const confirm = jest.spyOn( window, 'confirm' ).mockReturnValue( true );

		fireEvent.click( within( row( '/about-nothing' ) ).getByRole( 'button', { name: 'Delete' } ) );

		expect( confirm ).toHaveBeenCalled();
		expect( bulk.mutate ).toHaveBeenCalledWith( { action: 'delete', items: [ 7 ], params: {} } );
	} );

	it( 'deletes and exports the selection', () => {
		setup();
		jest.spyOn( window, 'confirm' ).mockReturnValue( true );

		fireEvent.click( within( row( '/about-nothing' ) ).getByRole( 'checkbox' ) );
		fireEvent.click( screen.getByRole( 'button', { name: 'Export CSV' } ) );

		expect( exporter.mutate ).toHaveBeenCalledWith(
			expect.objectContaining( { exportType: 'log', format: 'csv', params: { items: [ 7 ] } } )
		);

		fireEvent.click( within( row( '/about-nothing' ) ).getByRole( 'checkbox' ) );
		fireEvent.click( screen.getByRole( 'button', { name: 'Delete selected' } ) );

		expect( bulk.mutate ).toHaveBeenCalledWith( { action: 'delete', items: [ 7 ], params: {} } );
	} );

	it( 'links to the redirect that sent the visitor', () => {
		setup();

		expect( within( row( '/about-nothing' ) ).getByRole( 'link', { name: 'View redirect' } ) ).toHaveAttribute(
			'href',
			'#/redirects?filterby%5Bid%5D=12'
		);
		expect( within( row( '/sched-soon' ) ).queryByRole( 'link', { name: 'View redirect' } ) ).toBeNull();
	} );

	it( 'shows every hit for a grouped row', () => {
		useTableStore.getState().setLogsTable( { groupBy: 'ip' } as any );
		setup( { list: [ { id: '10.0.0.1', ip: '10.0.0.1', count: 4 } ] } );

		fireEvent.click( screen.getByRole( 'button', { name: 'Show all' } ) );

		expect( lastParams().groupBy ).toBe( '' );
		expect( lastParams().filterBy ).toEqual( { ip: '10.0.0.1' } );
	} );

	it( 'clears filters that came from a link', () => {
		useTableStore.getState().setLogsTable( { filterBy: { referrer: 'news.test' } } as any );
		setup();

		fireEvent.click( screen.getByRole( 'button', { name: /Clear filter/ } ) );

		expect( lastParams().filterBy ).toEqual( {} );
	} );
} );
