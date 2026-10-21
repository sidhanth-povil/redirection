import type { ReactNode } from 'react';
import './style.scss';

export type BadgeTone = 'success' | 'info' | 'warning' | 'neutral' | 'danger' | 'accent';

interface BadgeProps {
	tone?: BadgeTone;
	title?: string;
	children: ReactNode;
}

export function Badge( { tone = 'neutral', title, children }: BadgeProps ) {
	return (
		<span className={ `dsr-badge dsr-badge--${ tone }` } title={ title }>
			{ children }
		</span>
	);
}
