import { useId } from 'react';
import './style.scss';

export interface SegmentedOption< T extends string > {
	value: T;
	label: string;
	hint?: string;
}

interface SegmentedProps< T extends string > {
	label: string;
	options: SegmentedOption< T >[];
	value: T | null;
	onChange: ( value: T ) => void;
}

/**
 * Native radios styled as a segmented control: arrow keys, focus and screen readers work for free.
 * @param root0
 * @param root0.label
 * @param root0.options
 * @param root0.value
 * @param root0.onChange
 */
export function Segmented< T extends string >( { label, options, value, onChange }: SegmentedProps< T > ) {
	const name = useId();

	return (
		<fieldset className="dsr-segmented">
			<legend className="dsr-label">{ label }</legend>
			<div className="dsr-segmented__options">
				{ options.map( ( option ) => (
					// eslint-disable-next-line jsx-a11y/label-has-associated-control -- the radio is nested inside the label
					<label key={ option.value } className="dsr-segmented__option">
						<input
							type="radio"
							className="dsr-segmented__input"
							name={ name }
							value={ option.value }
							checked={ value === option.value }
							onChange={ () => onChange( option.value ) }
						/>
						<span className="dsr-segmented__label">{ option.label }</span>
						{ option.hint && <span className="dsr-segmented__hint">{ option.hint }</span> }
					</label>
				) ) }
			</div>
		</fieldset>
	);
}
