/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const AGENT_MGMT_LIST_ELEMENT_HEIGHT = 72;

export type AgentSkillType = 'agent' | 'skill' | 'command' | 'rule';

export type ItemState = 'enabled' | 'disabled' | 'error' | 'installing';

export interface IAgentSkillItem {
	id: string;
	name: string;
	type: AgentSkillType;
	description: string;
	version: string;
	author: string;
	state: ItemState;
	iconCodicon: string;
	installPath: string;
	config: Record<string, any>;
	lastUsed: number;
	usageCount: number;
	tags: string[];
	category: string;
}

export interface IAgentSkillFilter {
	query: string;
	type: AgentSkillType | 'all';
	state: ItemState | 'all';
	sortBy: 'name' | 'lastUsed' | 'usageCount' | 'state';
	sortAsc: boolean;
}

export interface IAgentSkillTemplateData {
	root: HTMLElement;
	element: HTMLElement;
	icon: HTMLElement;
	name: HTMLElement;
	description: HTMLElement;
	typeLabel: HTMLElement;
	stateIndicator: HTMLElement;
	actionContainer: HTMLElement;
	item: IAgentSkillItem | null;
}