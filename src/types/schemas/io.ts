export interface Importer {
	id: string;
	name: string;
	description: string;
	source: string;
	preview_supported?: boolean;
	total: number;
}

export interface IpInfo {
	ip: string;
	country?: string;
	region?: string;
	city?: string;
	latitude?: number;
	longitude?: number;
	timezone?: string;
}

export interface UserAgentInfo {
	agent: string;
	browser?: string;
	version?: string;
	platform?: string;
	mobile?: boolean;
}
