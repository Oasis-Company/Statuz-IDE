/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * IPC channel name for Statuz Engine communication.
 *
 * The renderer process calls engine methods via this channel,
 * which is handled by `StatuzEngineChannel` in the electron-main process.
 */
export const STATUZ_ENGINE_CHANNEL_NAME = 'statuz-channel-engine';

/**
 * Request format for IPC calls to the engine channel.
 */
export interface StatuzEngineRequest {
	id: string;
	method: StatuzEngineMethod;
	args: unknown[];
}

/**
 * Response format for IPC calls from the engine channel.
 */
export interface StatuzEngineResponse {
	id: string;
	success: boolean;
	result?: unknown;
	error?: {
		message: string;
		code?: string;
	};
}

/**
 * All methods exposed by the Statuz Engine IPC channel.
 * These map 1:1 to IStatuzEngineService methods.
 */
export type StatuzEngineMethod =
	| 'createCluster'
	| 'loadCluster'
	| 'saveCluster'
	| 'verifyStzFile'
	| 'registerNode'
	| 'unregisterNode'
	| 'createField'
	| 'removeField'
	| 'addEdge'
	| 'removeEdge'
	| 'addBridge'
	| 'removeBridge'
	| 'traverse'
	| 'impact'
	| 'path'
	| 'centrality'
	| 'health'
	| 'clusterInfo'
	| 'fieldInfo'
	| 'cloneCluster'
	| 'mergeClusters'
	| 'exportJson';
