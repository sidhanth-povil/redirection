import { useId, useState, type FormEvent } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { useSettingsUpdate } from 'lib/api/hooks/use-settings';
import { useSettingsStore } from 'stores';
import { Button, Field } from 'ui';
import './style.scss';

interface AlertSettings {
	enabled: boolean;
	frequency: 'daily' | 'weekly';
	recipients: string[];
	min_hits: number;
}

const DEFAULTS: AlertSettings = { enabled: false, frequency: 'weekly', recipients: [], min_hits: 3 };
// A light check so typos show before saving; the server validates with is_email.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// expire_404 of -1 means "No logs".
const NO_LOGS = -1;

function splitEmails( value: string ): string[] {
	return value
		.split( ',' )
		.map( ( email ) => email.trim() )
		.filter( ( email ) => email !== '' );
}

export default function Alerts() {
	const values = useSettingsStore( ( state ) => state.values ) as {
		dsr_alerts?: AlertSettings;
		expire_404?: number;
	} | null;
	const update = useSettingsUpdate();
	const saved = { ...DEFAULTS, ...values?.dsr_alerts };

	const [ enabled, setEnabled ] = useState( saved.enabled );
	const [ frequency, setFrequency ] = useState( saved.frequency );
	const [ recipients, setRecipients ] = useState( saved.recipients.join( ', ' ) );
	const [ minHits, setMinHits ] = useState( saved.min_hits );

	const enabledId = useId();
	const frequencyId = useId();
	const recipientsId = useId();
	const minHitsId = useId();

	const emails = splitEmails( recipients );
	const invalid = emails.filter( ( email ) => ! EMAIL.test( email ) );
	const isLoggingOff = values?.expire_404 === NO_LOGS;

	const onSubmit = ( event: FormEvent ) => {
		event.preventDefault();

		if ( invalid.length > 0 ) {
			return;
		}

		update.mutate( {
			dsr_alerts: { enabled, frequency, recipients: emails, min_hits: Math.max( 1, minHits ) },
		} as any );
	};

	return (
		<form className="dsr-alerts" onSubmit={ onSubmit } noValidate>
			<h2 className="dsr-section-title">{ __( '404 alerts', 'dsuite-redirects' ) }</h2>

			<label className="dsr-switch" htmlFor={ enabledId }>
				<input
					id={ enabledId }
					type="checkbox"
					role="switch"
					className="dsr-switch__input"
					checked={ enabled }
					onChange={ ( event ) => setEnabled( event.target.checked ) }
				/>
				<span className="dsr-switch__track" aria-hidden="true" />
				{ __( 'Email new 404s', 'dsuite-redirects' ) }
			</label>

			{ enabled && isLoggingOff && (
				<div className="dsr-notice dsr-notice--warning">
					<p>
						{ __(
							'404 logging is off, so there is nothing to email. Turn on 404 logs under Logs below.',
							'dsuite-redirects'
						) }
					</p>
				</div>
			) }

			<Field label={ __( 'How often', 'dsuite-redirects' ) } htmlFor={ frequencyId }>
				<select
					id={ frequencyId }
					className="dsr-select"
					value={ frequency }
					onChange={ ( event ) => setFrequency( event.target.value as AlertSettings[ 'frequency' ] ) }
				>
					<option value="daily">{ __( 'Daily', 'dsuite-redirects' ) }</option>
					<option value="weekly">{ __( 'Weekly', 'dsuite-redirects' ) }</option>
				</select>
			</Field>

			<Field
				label={ __( 'Send to', 'dsuite-redirects' ) }
				htmlFor={ recipientsId }
				hint={ __( 'Separate several addresses with commas', 'dsuite-redirects' ) }
			>
				<input
					id={ recipientsId }
					className="dsr-input"
					value={ recipients }
					aria-describedby={ `${ recipientsId }-hint` }
					aria-invalid={ invalid.length > 0 }
					onChange={ ( event ) => setRecipients( event.target.value ) }
				/>
			</Field>
			{ invalid.length > 0 && (
				<p className="dsr-field-error" role="alert">
					{ sprintf(
						/* translators: %s: the addresses that are not emails */
						__( 'Not an email address: %s', 'dsuite-redirects' ),
						invalid.join( ', ' )
					) }
				</p>
			) }

			<Field label={ __( 'Only URLs with at least', 'dsuite-redirects' ) } htmlFor={ minHitsId }>
				<input
					id={ minHitsId }
					type="number"
					min={ 1 }
					className="dsr-input dsr-alerts__hits"
					value={ minHits }
					onChange={ ( event ) => setMinHits( parseInt( event.target.value, 10 ) || 1 ) }
				/>
			</Field>

			<Button variant="primary" type="submit" disabled={ invalid.length > 0 || update.isPending }>
				{ __( 'Save alerts', 'dsuite-redirects' ) }
			</Button>
		</form>
	);
}
