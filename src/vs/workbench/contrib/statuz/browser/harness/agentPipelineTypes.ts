/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface PipelineNode {
	readonly id: string;
	readonly nodeType: string;
	readonly position: { x: number; y: number };
	readonly label?: string;
	readonly agentId?: string;
}

export interface PipelineEdge {
	readonly id: string;
	readonly source: string;
	readonly target: string;
	readonly edgeType: string;
	readonly label?: string;
}

export interface PipelineDefinition {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly createdAt?: number;
	readonly updatedAt?: number;
	readonly enabled?: boolean;
	readonly nodes: readonly PipelineNode[];
	readonly edges: readonly PipelineEdge[];
}