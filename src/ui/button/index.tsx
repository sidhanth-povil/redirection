import type { ButtonHTMLAttributes } from 'react';
import './style.scss';

export interface ButtonProps extends ButtonHTMLAttributes< HTMLButtonElement > {
	variant?: 'primary' | 'secondary';
}

export function Button( { variant = 'secondary', type = 'button', className, ...rest }: ButtonProps ) {
	const classes = [ 'dsr-button', `dsr-button--${ variant }`, className ].filter( Boolean ).join( ' ' );

	// eslint-disable-next-line react/button-has-type -- type is a prop defaulting to "button"
	return <button type={ type } className={ classes } { ...rest } />;
}
