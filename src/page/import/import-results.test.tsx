import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ImportResults from './import-results';
import type { ImportStats } from './types';

window.Redirectioni10n = {
	pluginRoot: '/wp-admin/tools.php?page=redirection.php',
} as Redirectioni10n;

function getPreviewResults( overrides: Partial< ImportStats > = {} ): ImportStats {
	return {
		created: 2,
		updated: 1,
		ignored: 1,
		groups_created: 1,
		groups_updated: 0,
		groups_ignored: 0,
		logs_imported: 0,
		errors_imported: 0,
		settings_imported: 0,
		preview: [
			{
				source: '/created',
				target: '/target-created',
				code: 301,
				regex: false,
				group: 'Imported',
				result: 'created',
			},
			{
				source: '/updated',
				target: '/target-updated',
				code: 302,
				regex: true,
				group: 'Imported',
				result: 'updated',
				redirect_id: 99,
			},
			{
				source: '/ignored',
				target: '/target-ignored',
				code: 301,
				regex: false,
				group: 'Imported',
				result: 'ignored',
			},
		],
		...overrides,
	};
}

describe( 'ImportResults', () => {
	it.each( [ 'file', 'plugin' ] as const )(
		'renders the shared preview table for %s imports',
		( activeImportType ) => {
			const { container } = render(
				<ImportResults
					activeImportType={ activeImportType }
					lastImport={ getPreviewResults() }
					lastImportWasDryRun={ true }
				/>
			);

			expect( screen.getByText( 'Preview results' ) ).toBeInTheDocument();
			expect( screen.getByText( 'Preview only. No changes have been made.' ) ).toBeInTheDocument();
			expect( screen.getByRole( 'table' ) ).toBeInTheDocument();
			expect( container.querySelector( '.file-sniff__card .io-preview-table' ) ).not.toBeNull();
			expect( screen.getByText( 'Redirects created' ) ).toBeInTheDocument();
			expect( screen.getByText( 'Redirect updated' ) ).toBeInTheDocument();
			expect( screen.getByText( 'Redirect ignored' ) ).toBeInTheDocument();
			expect( screen.getByText( 'Group created' ) ).toBeInTheDocument();
			expect( screen.getByText( 'Groups ignored' ) ).toBeInTheDocument();
		}
	);

	it( 'renders richer preview rows, including update links and ignored styling', () => {
		const { container } = render(
			<ImportResults activeImportType="plugin" lastImport={ getPreviewResults() } lastImportWasDryRun={ true } />
		);

		const updatedLink = screen.getByRole( 'link', { name: '/updated' } );
		expect( updatedLink ).toHaveAttribute( 'href', '/wp-admin/tools.php?page=redirection.php&filterby%5Bid%5D=99' );

		const updatedRow = updatedLink.closest( 'tr' );
		expect( updatedRow ).not.toHaveClass( 'io-preview-table__row--ignored' );
		expect( within( updatedRow as HTMLTableRowElement ).getByText( 'Yes' ) ).toBeInTheDocument();

		const ignoredRow = container.querySelector( '.io-preview-table__row--ignored' );
		expect( ignoredRow ).not.toBeNull();
		expect( within( ignoredRow as HTMLTableRowElement ).getByText( '/ignored' ) ).toBeInTheDocument();
		expect( within( ignoredRow as HTMLTableRowElement ).getByText( '/target-ignored' ) ).toBeInTheDocument();
	} );

	it( 'shows richer plugin preview status when everything would be ignored', () => {
		render(
			<ImportResults
				activeImportType="plugin"
				lastImport={ getPreviewResults( {
					created: 0,
					updated: 0,
					ignored: 2,
					groups_created: 0,
				} ) }
				lastImportWasDryRun={ true }
			/>
		);

		expect( screen.getByText( 'All matching redirects would be ignored.' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Preview only. No changes have been made.' ) ).toBeInTheDocument();
		expect( screen.getByText( '2' ) ).toBeInTheDocument();
	} );

	it( 'lists rows that would fail and offers to import without them', () => {
		const onImportClean = jest.fn();
		render(
			<ImportResults
				activeImportType="file"
				lastImport={ getPreviewResults( {
					problem_count: 2,
					problems: [
						{
							source: '/wp-login.php',
							target: '/x',
							issue: 'invalid',
							message: 'This would redirect /wp-login.php',
						},
						{
							source: '/hop',
							target: '/middle',
							issue: 'chain',
							message: 'The destination redirects again',
						},
					],
				} ) }
				lastImportWasDryRun={ true }
				onImportClean={ onImportClean }
			/>
		);

		const problems = screen.getByRole( 'region', { name: '2 rows need a look' } );
		expect( within( problems ).getByText( 'Would fail' ) ).toBeInTheDocument();
		expect( within( problems ).getByText( 'This would redirect /wp-login.php' ) ).toBeInTheDocument();
		expect( within( problems ).getByText( 'Extra hop' ) ).toBeInTheDocument();

		fireEvent.click( screen.getByRole( 'button', { name: 'Import, skipping rows that would fail or duplicate' } ) );
		expect( onImportClean ).toHaveBeenCalled();
	} );

	it( 'offers no skip when the only problems are chains', () => {
		render(
			<ImportResults
				activeImportType="file"
				lastImport={ getPreviewResults( {
					problem_count: 1,
					problems: [ { source: '/hop', target: '/middle', issue: 'chain', message: 'Extra hop' } ],
				} ) }
				lastImportWasDryRun={ true }
				onImportClean={ jest.fn() }
			/>
		);

		expect( screen.queryByRole( 'button', { name: /skipping rows/ } ) ).toBeNull();
	} );
} );
