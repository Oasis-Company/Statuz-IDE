/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Unified Diagram Undo/Redo — snapshot-based history
 *--------------------------------------------------------------------------------------------*/

import type { DiagramSnapshot } from './diagramTypes.js';

/* ─── Manager ────────────────────────────────────────────── */

export class DiagramUndoRedo {
	private undoStack: DiagramSnapshot[] = [];
	private redoStack: DiagramSnapshot[] = [];
	private maxSteps: number;
	private onChange: ((canUndo: boolean, canRedo: boolean) => void) | null = null;

	constructor(maxSteps: number = 50) {
		this.maxSteps = maxSteps;
	}

	/* ─── State ───────────────────────────────────────────── */

	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	setOnStateChange(callback: (canUndo: boolean, canRedo: boolean) => void): void {
		this.onChange = callback;
	}

	/* ─── Push ────────────────────────────────────────────── */

	pushSnapshot(snapshot: DiagramSnapshot): void {
		this.undoStack.push(snapshot);
		if (this.undoStack.length > this.maxSteps) {
			this.undoStack.shift();
		}
		// Clear redo on new action
		this.redoStack = [];
		this.notify();
	}

	/* ─── Undo ────────────────────────────────────────────── */

	undo(currentSnapshot?: DiagramSnapshot): DiagramSnapshot | null {
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

	redo(currentSnapshot?: DiagramSnapshot): DiagramSnapshot | null {
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
				this.onChange(this.canUndo(), this.canRedo());
			} catch (err) {
				console.warn('[DiagramUndoRedo] State change callback error:', err);
			}
		}
	}
}