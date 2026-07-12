/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * TypeScript type definitions for the Statuz Graph Engine.
 *
 * These types mirror the Rust structs in `statuz-core` (crates/statuz-core/src/).
 * When the napi-rs native module is integrated, these types will be the
 * canonical TypeScript interface for all engine data.
 *
 * Until then, these types serve as the contract for the stub service
 * implementation and future UI development.
 */


// ─── ID Types ────────────────────────────────────────────────

export type NodeId = string;
export type EdgeId = string;
export type FieldId = string;
export type ClusterId = string;


// ─── Relation ────────────────────────────────────────────────

export type Relation =
	| 'depends_on'
	| 'produces'
	| 'consumes'
	| 'validates'
	| 'informs'
	| 'contains'
	| 'delegates_to'
	| 'bridges'
	| (string & {});  // extensible — any custom string


// ─── Node Status ─────────────────────────────────────────────

export type NodeStatus = 'active' | 'dormant' | 'blocked' | 'done' | 'planned';


// ─── Core Data Structures ────────────────────────────────────

export interface EngineNode {
	id: NodeId;
	type: string;
	label: string;
	status: NodeStatus;
	meta?: Record<string, string>;
}

export interface EngineEdge {
	id: EdgeId;
	source: NodeId;
	target: NodeId;
	relation: Relation;
	weight: number;
	description: string;
	targetField?: FieldId;
	meta?: Record<string, string>;
}


// ─── Visibility ──────────────────────────────────────────────

export type Visibility = 'public' | 'private' | 'organization';


// ─── Input Types (for mutations) ─────────────────────────────

export interface NodeInput {
	id: NodeId;
	type: string;
	label: string;
	status: NodeStatus;
	meta?: Record<string, string>;
}

export interface EdgeInput {
	id: EdgeId;
	source: NodeId;
	target: NodeId;
	relation: Relation;
	weight: number;
	description: string;
	targetField?: FieldId;
	meta?: Record<string, string>;
}


// ─── Query Result Types ──────────────────────────────────────

export interface TraverseResult {
	nodes: NodeId[];
	edges: EngineEdge[];
}

export interface ImpactResult {
	changed: NodeId;
	affected: NodeId[];
	blastRadius: NodeId[];
	criticalPath: boolean;
}

export interface PathResult {
	from: NodeId;
	to: NodeId;
	path: EngineEdge[];
	fieldPath: FieldId[];
	length: number;
	exists: boolean;
}

export interface HealthReport {
	totalNodes: number;
	totalEdges: number;
	orphans: NodeId[];
	sinks: NodeId[];
	sources: NodeId[];
	highCentrality: NodeId[];
	disconnectedComponents: number;
}


// ─── Cluster Info ────────────────────────────────────────────

export interface ClusterInfo {
	id: ClusterId;
	name: string;
	visibility: Visibility;
	nodeCount: number;
	fieldCount: number;
	createdAt: number;
	updatedAt: number;
}


// ─── Field Info ──────────────────────────────────────────────

export interface FieldInfo {
	id: FieldId;
	name: string;
	description?: string;
	nodeCount: number;
	edgeCount: number;
	createdAt: number;
	updatedAt: number;
}


// ─── Sharing Types ───────────────────────────────────────────

export interface CloneOptions {
	resetPassword: boolean;
	newPassword?: string;
	newName?: string;
	resetTimestamps: boolean;
}

export type MergeStrategy =
	| { type: 'skip' }
	| { type: 'overwrite' }
	| { type: 'rename'; suffix: string }
	| { type: 'merge_meta' };

export interface MergeResult {
	nodesAdded: number;
	nodesSkipped: number;
	nodesOverwritten: number;
	fieldsAdded: number;
	fieldsSkipped: number;
	fieldsOverwritten: number;
	edgesAdded: number;
	edgesSkipped: number;
	bridgesAdded: number;
	warnings: string[];
}


// ─── Opaque Handle ───────────────────────────────────────────

/**
 * Opaque reference to a Cluster instance in the engine.
 *
 * In the napi-rs implementation, this will be a numeric handle ID
 * that maps to a Rust `Cluster` on the native side.
 *
 * For the stub implementation, this is a UUID string mapped to an
 * in-memory Cluster object in the main process.
 */
export type ClusterHandle = string;
