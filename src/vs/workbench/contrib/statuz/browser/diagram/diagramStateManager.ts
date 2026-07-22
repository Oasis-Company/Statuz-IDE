/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Unified Diagram State Manager — localStorage persistence + cross-tab sync
 *--------------------------------------------------------------------------------------------*/

import type {
	DiagramDefinition,
	DiagramNodeDefinition,
	DiagramEdgeDefinition,
	DiagramState,
	StoredViewport,
} from './diagramTypes.js';

/* ─── Types ──────────────────────────────────────────────── */

export type DiagramStateListener = (state: DiagramState) => void;

/* ─── Helpers ────────────────────────────────────────────── */

function safeParse<T>(raw: string | null, fallback: T): T {
	if (!raw) { return fallback; }
	try {
		return JSON.parse(raw) as T;
	} catch {
		console.warn('[DiagramStateManager] Corrupt localStorage data, resetting to defaults');
		return fallback;
	}
}

/* ─── Manager ────────────────────────────────────────────── */

export class DiagramStateManager {
	private state: DiagramState;
	private listeners: Set<DiagramStateListener> = new Set();
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private latestLayouts: DiagramNodeDefinition[] = [];
	private readonly storageKey: string;
	private readonly defaultViewport: StoredViewport;

	constructor(definition: DiagramDefinition) {
		this.storageKey = definition.storageKey;
		this.defaultViewport = definition.defaultViewport;
		this.state = this.loadState();
		this.setupStorageListener();
	}

	/* ─── Public API ──────────────────────────────────────── */

	getState(): DiagramState {
		return {
			projectId: this.state.projectId,
			layouts: [...this.state.layouts],
			edges: [...this.state.edges],
			viewport: { ...this.state.viewport },
		};
	}

	setProjectId(id: string | null): void {
		this.state.projectId = id;
		if (!id) {
			this.state.layouts = [];
			this.state.edges = [];
			this.state.viewport = { ...this.defaultViewport };
		} else {
			this.state = this.loadState();
		}
		this.notify();
	}

	subscribe(listener: DiagramStateListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	updateNodePosition(id: string, pos: { x: number; y: number }): void {
		this.state.layouts = this.state.layouts.map(n =>
			n.id === id ? { ...n, position: { ...pos } } : n,
		);
		this.persistLayoutsDebounced();
		this.notify();
	}

	addNodeLayout(id: string, type: string, pos?: { x: number; y: number }): void {
		if (this.state.layouts.some(n => n.id === id)) { return; }

		const position = pos ?? {
			x: 100 + this.state.layouts.length * 30,
			y: 100 + this.state.layouts.length * 40,
		};

		this.state.layouts = [
			...this.state.layouts,
			{ id, type, position },
		];
		this.persistLayoutsDebounced();
		this.notify();
	}

	removeNodeLayout(id: string): void {
		this.state.layouts = this.state.layouts.filter(n => n.id !== id);
		this.state.edges = this.state.edges.filter(e => e.source !== id && e.target !== id);
		this.persistLayoutsDebounced();
		this.persistEdges();
		this.notify();
	}

	addEdge(source: string, target: string, type: string): string {
		if (this.state.edges.some(e => e.source === source && e.target === target)) {
			return '';
		}

		const id = `edge-${source}-${target}-${Date.now().toString(36)}`;
		this.state.edges = [...this.state.edges, { id, source, target, type }];
		this.persistEdges();
		this.notify();
		return id;
	}

	removeEdge(id: string): void {
		this.state.edges = this.state.edges.filter(e => e.id !== id);
		this.persistEdges();
		this.notify();
	}

	resetLayout(): void {
		this.state.layouts = this.state.layouts.map((n, i) => ({
			...n,
			position: { x: 100, y: 100 + i * 120 },
		}));
		this.persistLayoutsDebounced();
		this.notify();
	}

	setLayouts(layouts: DiagramNodeDefinition[]): void {
		this.state.layouts = layouts;
		this.persistLayoutsDebounced();
		this.notify();
	}

	setEdges(edges: DiagramEdgeDefinition[]): void {
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
		if (this.latestLayouts.length > 0) {
			localStorage.setItem(
				`${this.storageKey}-layouts`,
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
		this.latestLayouts = this.state.layouts;
		if (this.debounceTimer) { clearTimeout(this.debounceTimer); }
		this.debounceTimer = setTimeout(() => {
			localStorage.setItem(
				`${this.storageKey}-layouts`,
				JSON.stringify(this.latestLayouts),
			);
		}, 500);
	}

	private persistEdges(): void {
		localStorage.setItem(
			`${this.storageKey}-edges`,
			JSON.stringify(this.state.edges),
		);
	}

	private persistViewport(): void {
		localStorage.setItem(
			`${this.storageKey}-viewport`,
			JSON.stringify(this.state.viewport),
		);
	}

	/* ─── Load ────────────────────────────────────────────── */

	private loadState(): DiagramState {
		return {
			projectId: this.state?.projectId ?? null,
			layouts: safeParse<DiagramNodeDefinition[]>(
				localStorage.getItem(`${this.storageKey}-layouts`),
				[],
			),
			edges: safeParse<DiagramEdgeDefinition[]>(
				localStorage.getItem(`${this.storageKey}-edges`),
				[],
			),
			viewport: safeParse<StoredViewport>(
				localStorage.getItem(`${this.storageKey}-viewport`),
				{ ...this.defaultViewport },
			),
		};
	}

	/* ─── Cross-Tab Sync ──────────────────────────────────── */

	private storageHandler = (e: StorageEvent): void => {
		if (e.key === `${this.storageKey}-layouts` && e.newValue) {
			this.state.layouts = safeParse<DiagramNodeDefinition[]>(e.newValue, []);
			this.notify();
		}
		if (e.key === `${this.storageKey}-edges` && e.newValue) {
			this.state.edges = safeParse<DiagramEdgeDefinition[]>(e.newValue, []);
			this.notify();
		}
		if (e.key === `${this.storageKey}-viewport` && e.newValue) {
			this.state.viewport = safeParse<StoredViewport>(e.newValue, { ...this.defaultViewport });
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
				console.warn('[DiagramStateManager] Listener error:', err);
			}
		}
	}
}