/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/components/flow/hooks/useBoardUndoRedo.ts
 *  Adapted: React hooks (useRef → class field, useState → external callback)
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import type { FlowNodeLayout, FlowEdgeData, StoredViewport } from './boardTypes.js';

/* ─── Types ──────────────────────────────────────────────── */

export interface BoardSnapshot {
	nodeLayouts: FlowNodeLayout[];
	edges: FlowEdgeData[];
	viewport: StoredViewport;
}

export interface UndoRedoState {
	canUndo: boolean;
	canRedo: boolean;
	undoStackSize: number;
	redoStackSize: number;
}


/* ─── Manager ────────────────────────────────────────────── */

const MAX_HISTORY = 50;

export class BoardUndoRedo {
	private undoStack: BoardSnapshot[] = [];
	private redoStack: BoardSnapshot[] = [];
	private onChange: (() => void) | null = null;

	/* ─── State ───────────────────────────────────────────── */

	getState(): UndoRedoState {
		return {
			canUndo: this.undoStack.length > 0,
			canRedo: this.redoStack.length > 0,
			undoStackSize: this.undoStack.length,
			redoStackSize: this.redoStack.length,
		};
	}

	onStateChange(callback: () => void): void {
		this.onChange = callback;
	}

	/* ─── Push ────────────────────────────────────────────── */

	pushSnapshot(snapshot: BoardSnapshot): void {
		this.undoStack.push(snapshot);
		if (this.undoStack.length > MAX_HISTORY) {
			this.undoStack.shift();
		}
		// Clear redo on new action
		this.redoStack = [];
		this.notify();
	}

	/* ─── Undo ────────────────────────────────────────────── */

	undo(currentSnapshot?: BoardSnapshot): BoardSnapshot | null {
		const snapshot = this.undoStack.pop();
		if (!snapshot) {
			this.notify();
			return null;
		}
		if (currentSnapshot) {
			this.redoStack.push(currentSnapshot);
		}
		this.notify();
		return snapshot;
	}

	/* ─── Redo ────────────────────────────────────────────── */

	redo(currentSnapshot?: BoardSnapshot): BoardSnapshot | null {
		const snapshot = this.redoStack.pop();
		if (!snapshot) {
			this.notify();
			return null;
		}
		if (currentSnapshot) {
			this.undoStack.push(currentSnapshot);
		}
		this.notify();
		return snapshot;
	}

	/* ─── Clear ───────────────────────────────────────────── */

	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
		this.notify();
	}

	/* ─── Internal ────────────────────────────────────────── */

	private notify(): void {
		if (this.onChange) {
			try {
				this.onChange();
			} catch (err) {
				console.warn('[BoardUndoRedo] State change callback error:', err);
			}
		}
	}
}