import type { ReactNode } from 'react';
import './style.scss';

interface FieldProps {
	label: string;
	htmlFor: string;
	hint?: string;
	children: ReactNode;
}

/**
 * Label, control and hint. Give the control `aria-describedby={ htmlFor + '-hint' }` when there is a hint.
 * @param root0
 * @param root0.label
 * @param root0.htmlFor
 * @param root0.hint
 * @param root0.children
 */
export function Field( { label, htmlFor, hint, children }: FieldProps ) {
	return (
		<div className="dsr-field">
			<label className="dsr-label" htmlFor={ htmlFor }>
				{ label }
			</label>
			{ children }
			{ hint && (
				<p id={ `${ htmlFor }-hint` } className="dsr-hint">
					{ hint }
				</p>
			) }
		</div>
	);
}
