/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	ClusterHandle,
	ClusterInfo,
	CloneOptions,
	EdgeInput,
	FieldInfo,
	HealthReport,
	ImpactResult,
	MergeResult,
	MergeStrategy,
	NodeInput,
	PathResult,
	TraverseResult,
	Visibility,
} from './statuzEngineTypes.js';
import { StatuzEngineMethod } from './statuzEngineChannelId.js';
import { Emitter, Event } from '../../../../../base/common/event.js';


/**
 * Service interface for the Statuz Graph Engine.
 *
 * All graph operations go through this service. The implementation
 * communicates with the electron-main process via IPC, which in turn
 * calls the native Rust engine module (@statuz/engine-native).
 *
 * Until the native module is integrated, the implementation returns
 * stub responses with appropriate error messages.
 */
export interface IStatuzEngineService {
	readonly _serviceBrand: undefined;

	// ─── Cluster Lifecycle ──────────────────────────────────
	createCluster(name: string, visibility: Visibility): Promise<ClusterHandle>;
	loadCluster(path: string): Promise<ClusterHandle>;
	saveCluster(handle: ClusterHandle, path: string): Promise<void>;
	verifyStzFile(path: string): Promise<boolean>;

	// ─── Node Management ────────────────────────────────────
	registerNode(handle: ClusterHandle, node: NodeInput): Promise<void>;
	unregisterNode(handle: ClusterHandle, nodeId: string): Promise<boolean>;

	// ─── Field Management ──────────────────────────────────
	createField(handle: ClusterHandle, id: string, name: string, description?: string): Promise<void>;
	removeField(handle: ClusterHandle, fieldId: string): Promise<void>;

	// ─── Edge & Bridge Management ──────────────────────────
	addEdge(handle: ClusterHandle, fieldId: string, edge: EdgeInput): Promise<void>;
	removeEdge(handle: ClusterHandle, fieldId: string, edgeId: string): Promise<boolean>;
	addBridge(
		handle: ClusterHandle,
		fromField: string,
		toField: string,
		source: string,
		target: string,
		description: string,
		weight: number,
	): Promise<void>;
	removeBridge(handle: ClusterHandle, bridgeId: string): Promise<boolean>;

	// ─── Queries ───────────────────────────────────────────
	traverse(
		handle: ClusterHandle,
		fieldId: string,
		nodeId: string,
		relation?: string,
		crossField?: boolean,
	): Promise<TraverseResult>;
	impact(handle: ClusterHandle, nodeId: string): Promise<ImpactResult>;
	path(handle: ClusterHandle, from: string, to: string, crossField: boolean): Promise<PathResult>;
	centrality(handle: ClusterHandle, fieldId: string, limit: number): Promise<string[]>;
	health(handle: ClusterHandle, fieldId: string): Promise<HealthReport>;

	// ─── Info ──────────────────────────────────────────────
	clusterInfo(handle: ClusterHandle): Promise<ClusterInfo>;
	fieldInfo(handle: ClusterHandle, fieldId: string): Promise<FieldInfo>;

	// ─── Sharing ──────────────────────────────────────────
	cloneCluster(handle: ClusterHandle, options: CloneOptions): Promise<ClusterHandle>;
	mergeClusters(
		targetHandle: ClusterHandle,
		sourceHandle: ClusterHandle,
		strategy: MergeStrategy,
	): Promise<MergeResult>;
	exportJson(handle: ClusterHandle): Promise<string>;

	// ─── Events ────────────────────────────────────────────
	readonly onEngineReady: Event<void>;
	readonly isEngineReady: boolean;
}

export const IStatuzEngineService = createDecorator<IStatuzEngineService>('statuzEngineService');


const STUB_ERROR_MESSAGE = 'Statuz Engine native module is not yet integrated. Engine calls will be available after Phase 1 Milestone 1.2 (napi-rs build) is complete.';


/**
 * Stub implementation of IStatuzEngineService.
 *
 * This implementation is registered now so that:
 * 1. Other services can depend on IStatuzEngineService without runtime errors.
 * 2. UI components can be developed against the interface with mock data.
 * 3. The IPC infrastructure is in place for when the native module arrives.
 *
 * When the native module is ready, replace the callMethod implementation
 * with actual IPC calls to the electron-main process.
 */
class StatuzEngineService extends Disposable implements IStatuzEngineService {
	_serviceBrand: undefined;

	private readonly _onEngineReady = this._register(new Emitter<void>());
	readonly onEngineReady = this._onEngineReady.event;

	constructor(
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._logService.info('[StatuzEngine] Service initialized (stub mode — native module not yet integrated).');
	}

	get isEngineReady(): boolean {
		return false; // Always false until native module is integrated
	}

	/**
	 * Call a method on the engine via IPC.
	 *
	 * Currently always throws because the native module is not integrated.
	 * When the native module is ready, this will use the IPC channel
	 * (via IMainProcessService.getChannel(STATUZ_ENGINE_CHANNEL_NAME))
	 * to dispatch calls to the electron-main process.
	 */
	private async _callEngine<T>(method: StatuzEngineMethod, args: unknown[]): Promise<T> {
		this._logService.debug(`[StatuzEngine] call: ${method}(${JSON.stringify(args).slice(0, 200)})`);

		// TODO: Uncomment when native module is integrated in Phase 1 Milestone 1.4
		// const channel = this._mainProcessService.getChannel(STATUZ_ENGINE_CHANNEL_NAME);
		// const request: StatuzEngineRequest = {
		// 	id: crypto.randomUUID(),
		// 	method,
		// 	args,
		// };
		// const response = await channel.call<StatuzEngineResponse>('call', request);
		// if (!response.success) {
		// 	throw new Error(response.error?.message ?? 'Unknown engine error');
		// }
		// return response.result as T;

		throw new Error(`${STUB_ERROR_MESSAGE} (method: ${method})`);
	}

	// ─── Cluster Lifecycle ──────────────────────────────────

	async createCluster(name: string, visibility: Visibility): Promise<ClusterHandle> {
		return this._callEngine<ClusterHandle>('createCluster', [name, visibility]);
	}

	async loadCluster(path: string): Promise<ClusterHandle> {
		return this._callEngine<ClusterHandle>('loadCluster', [path]);
	}

	async saveCluster(handle: ClusterHandle, path: string): Promise<void> {
		await this._callEngine<void>('saveCluster', [handle, path]);
	}

	async verifyStzFile(path: string): Promise<boolean> {
		return this._callEngine<boolean>('verifyStzFile', [path]);
	}

	// ─── Node Management ────────────────────────────────────

	async registerNode(handle: ClusterHandle, node: NodeInput): Promise<void> {
		await this._callEngine<void>('registerNode', [handle, node]);
	}

	async unregisterNode(handle: ClusterHandle, nodeId: string): Promise<boolean> {
		return this._callEngine<boolean>('unregisterNode', [handle, nodeId]);
	}

	// ─── Field Management ──────────────────────────────────

	async createField(handle: ClusterHandle, id: string, name: string, description?: string): Promise<void> {
		await this._callEngine<void>('createField', [handle, id, name, description]);
	}

	async removeField(handle: ClusterHandle, fieldId: string): Promise<void> {
		await this._callEngine<void>('removeField', [handle, fieldId]);
	}

	// ─── Edge & Bridge Management ──────────────────────────

	async addEdge(handle: ClusterHandle, fieldId: string, edge: EdgeInput): Promise<void> {
		await this._callEngine<void>('addEdge', [handle, fieldId, edge]);
	}

	async removeEdge(handle: ClusterHandle, fieldId: string, edgeId: string): Promise<boolean> {
		return this._callEngine<boolean>('removeEdge', [handle, fieldId, edgeId]);
	}

	async addBridge(
		handle: ClusterHandle,
		fromField: string,
		toField: string,
		source: string,
		target: string,
		description: string,
		weight: number,
	): Promise<void> {
		await this._callEngine<void>('addBridge', [handle, fromField, toField, source, target, description, weight]);
	}

	async removeBridge(handle: ClusterHandle, bridgeId: string): Promise<boolean> {
		return this._callEngine<boolean>('removeBridge', [handle, bridgeId]);
	}

	// ─── Queries ───────────────────────────────────────────

	async traverse(
		handle: ClusterHandle,
		fieldId: string,
		nodeId: string,
		relation?: string,
		crossField?: boolean,
	): Promise<TraverseResult> {
		return this._callEngine<TraverseResult>('traverse', [handle, fieldId, nodeId, relation, crossField]);
	}

	async impact(handle: ClusterHandle, nodeId: string): Promise<ImpactResult> {
		return this._callEngine<ImpactResult>('impact', [handle, nodeId]);
	}

	async path(handle: ClusterHandle, from: string, to: string, crossField: boolean): Promise<PathResult> {
		return this._callEngine<PathResult>('path', [handle, from, to, crossField]);
	}

	async centrality(handle: ClusterHandle, fieldId: string, limit: number): Promise<string[]> {
		return this._callEngine<string[]>('centrality', [handle, fieldId, limit]);
	}

	async health(handle: ClusterHandle, fieldId: string): Promise<HealthReport> {
		return this._callEngine<HealthReport>('health', [handle, fieldId]);
	}

	// ─── Info ──────────────────────────────────────────────

	async clusterInfo(handle: ClusterHandle): Promise<ClusterInfo> {
		return this._callEngine<ClusterInfo>('clusterInfo', [handle]);
	}

	async fieldInfo(handle: ClusterHandle, fieldId: string): Promise<FieldInfo> {
		return this._callEngine<FieldInfo>('fieldInfo', [handle, fieldId]);
	}

	// ─── Sharing ──────────────────────────────────────────

	async cloneCluster(handle: ClusterHandle, options: CloneOptions): Promise<ClusterHandle> {
		return this._callEngine<ClusterHandle>('cloneCluster', [handle, options]);
	}

	async mergeClusters(
		targetHandle: ClusterHandle,
		sourceHandle: ClusterHandle,
		strategy: MergeStrategy,
	): Promise<MergeResult> {
		return this._callEngine<MergeResult>('mergeClusters', [targetHandle, sourceHandle, strategy]);
	}

	async exportJson(handle: ClusterHandle): Promise<string> {
		return this._callEngine<string>('exportJson', [handle]);
	}
}

registerSingleton(IStatuzEngineService, StatuzEngineService, InstantiationType.Delayed);
