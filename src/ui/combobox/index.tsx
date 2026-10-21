import { useEffect, useState } from 'react';
import { Combobox as HeadlessCombobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { useDebounce } from 'use-debounce';
import './style.scss';

export interface ComboboxOptionItem {
	value: string;
	label: string;
	detail?: string;
}

interface ComboboxProps {
	id: string;
	value: string;
	onChange: ( value: string ) => void;
	search: ( query: string ) => Promise< ComboboxOptionItem[] >;
	placeholder?: string;
	describedBy?: string;
}

const MIN_QUERY = 2;
const SEARCH_DELAY = 250;

/**
 * Free-text input with search suggestions: typing keeps the text, picking a suggestion fills in its value.
 * @param root0
 * @param root0.id
 * @param root0.value
 * @param root0.onChange
 * @param root0.search
 * @param root0.placeholder
 * @param root0.describedBy
 */
export function Combobox( { id, value, onChange, search, placeholder, describedBy }: ComboboxProps ) {
	const [ query, setQuery ] = useState( '' );
	const [ debouncedQuery ] = useDebounce( query, SEARCH_DELAY );
	const [ options, setOptions ] = useState< ComboboxOptionItem[] >( [] );

	useEffect( () => {
		const text = debouncedQuery.trim();

		if ( text.length < MIN_QUERY ) {
			setOptions( [] );
			return undefined;
		}

		let isCurrent = true;

		search( text )
			.then( ( found ) => {
				if ( isCurrent ) {
					setOptions( found );
				}
			} )
			.catch( () => {
				if ( isCurrent ) {
					setOptions( [] );
				}
			} );

		return () => {
			isCurrent = false;
		};
	}, [ debouncedQuery, search ] );

	return (
		<HeadlessCombobox value={ value } onChange={ ( picked: string | null ) => onChange( picked ?? '' ) }>
			<div className="dsr-combobox">
				<ComboboxInput
					id={ id }
					className="dsr-input"
					placeholder={ placeholder }
					aria-describedby={ describedBy }
					autoComplete="off"
					displayValue={ ( current: string ) => current }
					onChange={ ( event ) => {
						setQuery( event.target.value );
						onChange( event.target.value );
					} }
				/>
				{ options.length > 0 && (
					<ComboboxOptions className="dsr-combobox__options">
						{ options.map( ( option ) => (
							<ComboboxOption
								key={ option.value }
								value={ option.value }
								className="dsr-combobox__option"
							>
								<span className="dsr-combobox__label">{ option.label }</span>
								{ option.detail && <span className="dsr-combobox__detail">{ option.detail }</span> }
							</ComboboxOption>
						) ) }
					</ComboboxOptions>
				) }
			</div>
		</HeadlessCombobox>
	);
}
