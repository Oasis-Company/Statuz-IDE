/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Board toolbar — zoom, layout, undo/redo, add buttons
 *--------------------------------------------------------------------------------------------*/

import type { BoardUndoRedo } from './boardUndoRedo.js';

/* ─── Types ──────────────────────────────────────────────── */

export interface ToolbarCallbacks {
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	onFitView?: () => void;
	onUndo?: () => void;
	onRedo?: () => void;
	onLayoutChange?: (layout: 'column' | 'dagre' | 'manual') => void;
	onAddCard?: (type: string) => void;
	onAddDecision?: () => void;
}

/* ─── Toolbar ────────────────────────────────────────────── */

export class BoardToolbar {
	private container: HTMLElement;
	private parent: HTMLElement;
	private undoRedo: BoardUndoRedo;
	private callbacks: ToolbarCallbacks;
	private layoutBtn: HTMLButtonElement | null = null;

	constructor(
		parent: HTMLElement,
		undoRedo: BoardUndoRedo,
		callbacks: ToolbarCallbacks = {},
	) {
		this.parent = parent;
		this.undoRedo = undoRedo;
		this.callbacks = callbacks;

		this.container = this.build();
		parent.appendChild(this.container);

		// Listen for undo/redo state changes
		undoRedo.onStateChange(() => this.updateButtonStates());
	}

	/* ─── Build ─────────────────────────────────────────────── */

	private build(): HTMLElement {
		const toolbar = document.createElement('div');
		toolbar.className = 'board-toolbar';

		// Left group: undo/redo
		const leftGroup = this.createGroup();
		leftGroup.appendChild(this.createButton('board-undo', 'Undo', 'codicon-undo', () => {
			this.undoRedo.undo();
			this.callbacks.onUndo?.();
		}));
		leftGroup.appendChild(this.createButton('board-redo', 'Redo', 'codicon-redo', () => {
			this.undoRedo.redo();
			this.callbacks.onRedo?.();
		}));
		toolbar.appendChild(leftGroup);

		// Center group: zoom + layout
		const centerGroup = this.createGroup();
		centerGroup.appendChild(this.createButton('board-zoom-out', 'Zoom Out', 'codicon-zoom-out', () => {
			this.callbacks.onZoomOut?.();
		}));
		centerGroup.appendChild(this.createZoomLabel());
		centerGroup.appendChild(this.createButton('board-zoom-in', 'Zoom In', 'codicon-zoom-in', () => {
			this.callbacks.onZoomIn?.();
		}));
		centerGroup.appendChild(this.createButton('board-fit-view', 'Fit View', 'codicon-screen-full', () => {
			this.callbacks.onFitView?.();
		}));
		centerGroup.appendChild(this.createSeparator());
		centerGroup.appendChild(this.createLayoutButton());
		toolbar.appendChild(centerGroup);

		// Right group: add buttons
		const rightGroup = this.createGroup();
		rightGroup.appendChild(this.createButton('board-add-card', 'Add Card', 'codicon-add', () => {
			this.callbacks.onAddCard?.('vision');
		}));
		rightGroup.appendChild(this.createButton('board-add-decision', 'Add Decision', 'codicon-symbol-operator', () => {
			this.callbacks.onAddDecision?.();
		}));
		toolbar.appendChild(rightGroup);

		this.updateButtonStates();
		return toolbar;
	}

	private createGroup(): HTMLDivElement {
		const group = document.createElement('div');
		group.className = 'board-toolbar-group';
		return group;
	}

	private createButton(
		id: string, title: string, codicon: string, onClick: () => void,
	): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.id = id;
		btn.className = 'board-toolbar-btn';
		btn.title = title;
		btn.setAttribute('aria-label', title);

		const icon = document.createElement('span');
		icon.className = `codicon ${codicon}`;
		btn.appendChild(icon);

		btn.addEventListener('click', (e) => {
			e.preventDefault();
			onClick();
		});

		return btn;
	}

	private createZoomLabel(): HTMLSpanElement {
		const label = document.createElement('span');
		label.className = 'board-toolbar-zoom-label';
		label.textContent = '100%';
		label.id = 'board-zoom-label';
		return label;
	}

	private createSeparator(): HTMLDivElement {
		const sep = document.createElement('div');
		sep.className = 'board-toolbar-separator';
		return sep;
	}

	private createLayoutButton(): HTMLButtonElement {
		this.layoutBtn = document.createElement('button');
		this.layoutBtn.className = 'board-toolbar-btn board-toolbar-layout-btn';
		this.layoutBtn.title = 'Layout: Column';
		this.layoutBtn.setAttribute('aria-label', 'Layout: Column');
		this.layoutBtn.textContent = 'Column';
		this.layoutBtn.addEventListener('click', () => this.cycleLayout());
		return this.layoutBtn;
	}

	private layoutIndex = 0;
	private readonly layouts: Array<'column' | 'dagre' | 'manual'> = ['column', 'dagre', 'manual'];

	private cycleLayout(): void {
		this.layoutIndex = (this.layoutIndex + 1) % this.layouts.length;
		const layout = this.layouts[this.layoutIndex];
		if (this.layoutBtn) {
			this.layoutBtn.textContent = layout.charAt(0).toUpperCase() + layout.slice(1);
			this.layoutBtn.title = `Layout: ${layout}`;
		}
		this.callbacks.onLayoutChange?.(layout);
	}

	/* ─── Update ────────────────────────────────────────────── */

	private updateButtonStates(): void {
		const undoBtn = this.container.querySelector('#board-undo') as HTMLButtonElement;
		const redoBtn = this.container.querySelector('#board-redo') as HTMLButtonElement;
		const state = this.undoRedo.getState();
		if (undoBtn) undoBtn.disabled = !state.canUndo;
		if (redoBtn) redoBtn.disabled = !state.canRedo;
	}

	updateZoomLabel(zoom: number): void {
		const label = this.container.querySelector('#board-zoom-label');
		if (label) {
			label.textContent = `${Math.round(zoom * 100)}%`;
		}
	}

	destroy(): void {
		if (this.parent.contains(this.container)) {
			this.parent.removeChild(this.container);
		}
	}
}