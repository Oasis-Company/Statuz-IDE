/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/components/flow/hooks/useFlowBoard.ts
 *  Adapted: React hooks → class-based BoardStateManager
 *--------------------------------------------------------------------------------------------*/

import type { FlowNodeLayout, FlowEdgeData, StoredViewport } from './boardTypes.js';

/* ─── Types ──────────────────────────────────────────────── */

export interface BoardState {
	nodeLayouts: FlowNodeLayout[];
	edges: FlowEdgeData[];
	viewport: StoredViewport;
}

export type BoardStateListener = (state: BoardState) => void;

/* ─── Manager ────────────────────────────────────────────── */

const LAYOUT_KEY_PREFIX = 'sb-board-layout-';
const EDGES_KEY_PREFIX = 'sb-board-edges-';
const VIEWPORT_KEY_PREFIX = 'sb-board-viewport-';

function safeParse<T>(raw: string | null, fallback: T): T {
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		console.warn('[BoardStateManager] Corrupt localStorage data, resetting to defaults');
		return fallback;
	}
}

export class BoardStateManager {
	private state: BoardState;
	private listeners: Set<BoardStateListener> = new Set();
	private projectId: string | null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private latestLayouts: FlowNodeLayout[] = [];

	constructor(projectId: string | null = null) {
		this.projectId = projectId;
		this.state = this.loadState(projectId);
		this.setupStorageListener();
	}

	/* ─── Public API ──────────────────────────────────────── */

	getState(): BoardState {
		return { ...this.state };
	}

	setProjectId(projectId: string | null): void {
		this.projectId = projectId;
		if (!projectId) {
			this.state = { nodeLayouts: [], edges: [], viewport: { x: 0, y: 0, zoom: 0.8 } };
		} else {
			this.state = this.loadState(projectId);
		}
		this.notify();
	}

	subscribe(listener: BoardStateListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	updateNodePosition(id: string, position: { x: number; y: number }): void {
		this.state.nodeLayouts = this.state.nodeLayouts.map(n =>
			n.id === id ? { ...n, position } : n,
		);
		this.persistLayoutsDebounced();
		this.notify();
	}

	addNodeLayout(id: string, type: FlowNodeLayout['type'], pos?: { x: number; y: number }): void {
		if (this.state.nodeLayouts.some(n => n.id === id)) return;

		const position = pos ?? {
			x: 100 + this.state.nodeLayouts.length * 30,
			y: 100 + this.state.nodeLayouts.length * 40,
		};

		this.state.nodeLayouts = [
			...this.state.nodeLayouts,
			{ id, type, position, size: 'medium' },
		];
		this.persistLayoutsDebounced();
		this.notify();
	}

	removeNodeLayout(id: string): void {
		this.state.nodeLayouts = this.state.nodeLayouts.filter(n => n.id !== id);
		this.state.edges = this.state.edges.filter(e => e.source !== id && e.target !== id);
		this.persistLayoutsDebounced();
		this.persistEdges();
		this.notify();
	}

	addEdge(source: string, target: string, type: FlowEdgeData['type']): void {
		if (this.state.edges.some(e => e.source === source && e.target === target)) return;

		const id = `edge-${source}-${target}-${Date.now().toString(36)}`;
		this.state.edges = [...this.state.edges, { id, source, target, type }];
		this.persistEdges();
		this.notify();
	}

	removeEdge(id: string): void {
		this.state.edges = this.state.edges.filter(e => e.id !== id);
		this.persistEdges();
		this.notify();
	}

	resetLayout(): void {
		this.state.nodeLayouts = this.state.nodeLayouts.map((n, i) => ({
			...n,
			position: { x: 100, y: 100 + i * 120 },
		}));
		this.persistLayoutsDebounced();
		this.notify();
	}

	setLayouts(layouts: FlowNodeLayout[]): void {
		this.state.nodeLayouts = layouts;
		this.persistLayoutsDebounced();
		this.notify();
	}

	setEdges(edges: FlowEdgeData[]): void {
		this.state.edges = edges;
		this.persistEdges();
		this.notify();
	}

	setViewport(viewport: StoredViewport): void {
		this.state.viewport = viewport;
		this.persistViewport();
		this.notify();
	}

	flushPendingWrites(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		if (this.projectId && this.latestLayouts.length > 0) {
			localStorage.setItem(
				`${LAYOUT_KEY_PREFIX}${this.projectId}`,
				JSON.stringify(this.latestLayouts),
			);
		}
	}

	destroy(): void {
		this.flushPendingWrites();
		this.listeners.clear();
		window.removeEventListener('storage', this.storageHandler);
	}

	/* ─── Persistence ─────────────────────────────────────── */

	private persistLayoutsDebounced(): void {
		if (!this.projectId) return;
		this.latestLayouts = this.state.nodeLayouts;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			if (this.projectId) {
				localStorage.setItem(
					`${LAYOUT_KEY_PREFIX}${this.projectId}`,
					JSON.stringify(this.latestLayouts),
				);
			}
		}, 500);
	}

	private persistEdges(): void {
		if (!this.projectId) return;
		localStorage.setItem(
			`${EDGES_KEY_PREFIX}${this.projectId}`,
			JSON.stringify(this.state.edges),
		);
	}

	private persistViewport(): void {
		if (!this.projectId) return;
		localStorage.setItem(
			`${VIEWPORT_KEY_PREFIX}${this.projectId}`,
			JSON.stringify(this.state.viewport),
		);
	}

	/* ─── Load ────────────────────────────────────────────── */

	private loadState(projectId: string | null): BoardState {
		if (!projectId) {
			return { nodeLayouts: [], edges: [], viewport: { x: 0, y: 0, zoom: 0.8 } };
		}
		return {
			nodeLayouts: safeParse<FlowNodeLayout[]>(
				localStorage.getItem(`${LAYOUT_KEY_PREFIX}${projectId}`),
				[],
			),
			edges: safeParse<FlowEdgeData[]>(
				localStorage.getItem(`${EDGES_KEY_PREFIX}${projectId}`),
				[],
			),
			viewport: safeParse<StoredViewport>(
				localStorage.getItem(`${VIEWPORT_KEY_PREFIX}${projectId}`),
				{ x: 0, y: 0, zoom: 0.8 },
			),
		};
	}

	/* ─── Cross-Tab Sync ──────────────────────────────────── */

	private storageHandler = (e: StorageEvent): void => {
		if (!this.projectId) return;
		if (e.key === `${LAYOUT_KEY_PREFIX}${this.projectId}` && e.newValue) {
			this.state.nodeLayouts = safeParse(e.newValue, []);
			this.notify();
		}
		if (e.key === `${EDGES_KEY_PREFIX}${this.projectId}` && e.newValue) {
			this.state.edges = safeParse(e.newValue, []);
			this.notify();
		}
	};

	private setupStorageListener(): void {
		window.addEventListener('storage', this.storageHandler);
	}

	/* ─── Notify ──────────────────────────────────────────── */

	private notify(): void {
		const snapshot = this.getState();
		for (const listener of this.listeners) {
			try {
				listener(snapshot);
			} catch (err) {
				console.warn('[BoardStateManager] Listener error:', err);
			}
		}
	}
}