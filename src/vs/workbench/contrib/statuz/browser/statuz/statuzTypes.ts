/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * StatuzDocument type definitions.
 *
 * Mirrors the @statuz/sdk-ts types (types.ts) to avoid a runtime dependency
 * on the external statuz project. The statuz.yaml schema is versioned at
 * `statuz_version: "0.1"` and is stable.
 */

export interface StatuzCheckpoint {
	id: string;
	at: string;
	summary: string;
	decision?: string;
	evidence?: string[];
	next_action?: string;
}

export interface StatuzIdentity {
	agent_name: string;
	agent_id?: string;
	project_name: string;
	organization?: string;
	environment?: string;
}

export interface StatuzRole {
	name?: string;
	responsibilities?: string[];
	boundaries?: string[];
}

export interface StatuzGoal {
	primary?: string;
	secondary?: string[];
}

export interface StatuzCurrentState {
	stage?: string;
	task?: string;
	status: string;
	last_checkpoint?: string;
	next_action?: string;
}

export interface StatuzProgress {
	completed?: string[];
	blocked_by?: string[];
	open_questions?: string[];
}

export interface StatuzAgentRelation {
	from: string;
	to: string;
	type: string;
}

export interface StatuzRelations {
	related_agents?: string[];
	related_projects?: string[];
	related_files?: string[];
	related_tools?: string[];
	agent_graph?: StatuzAgentRelation[];
}

export interface StatuzRules {
	should?: string[];
	should_not?: string[];
}

export interface StatuzDocument {
	statuz_version: string;
	updated_at?: string;
	identity: StatuzIdentity;
	role?: StatuzRole;
	goal?: StatuzGoal;
	current_state: StatuzCurrentState;
	progress?: StatuzProgress;
	relations?: StatuzRelations;
	rules?: StatuzRules;
	checkpoints?: StatuzCheckpoint[];
}

/** Result of attempting to read a statuz.yaml file. */
export interface StatuzReadResult {
	/** Whether the read succeeded. */
	ok: boolean;
	/** Parsed document (present only when ok === true). */
	document?: StatuzDocument;
	/** Error message (present only when ok === false). */
	error?: string;
	/** File path that was read. */
	filePath: string;
}