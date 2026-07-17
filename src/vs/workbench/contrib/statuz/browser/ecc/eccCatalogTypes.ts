/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type EccComponentType = 'agent' | 'skill' | 'command' | 'rule';

export interface EccComponentMeta {
	id: string;
	name: string;
	type: EccComponentType;
	description: string;
	version: string;
	author: string;
	iconCodicon: string;
	category: string;
	tags: string[];
	sourceUrl: string;
	installPath: string;
	dependencies?: string[];
	lastUpdated?: number;
	fileSize?: number;
}

export interface EccCatalog {
	version: string;
	lastFetched: number;
	components: EccComponentMeta[];
	source: string;
}

export interface EccGateResult {
	passed: boolean;
	gateName: string;
	reason?: string;
}