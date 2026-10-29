export interface Importer {
	id: string;
	name: string;
	description: string;
	source: string;
	preview_supported?: boolean;
	total: number;
}
