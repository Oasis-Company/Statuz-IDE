/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Phase 3: Diagram Toolbar — unified toolbar for all canvases
 *--------------------------------------------------------------------------------------------*/

import type { DiagramDefinition } from './diagramTypes.js';
import type { ArchitectureDiagramEngine } from './architectureDiagramEngine.js';
import type { DiagramUndoRedo } from './diagramUndoRedo.js';

/* ─── DiagramToolbar ──────────────────────────────────────── */

export class DiagramToolbar {
	private container: HTMLElement;
	private engine: ArchitectureDiagramEngine;
	private undoRedo: DiagramUndoRedo;
	private definition: DiagramDefinition;

	private zoomLabel: HTMLElement | null = null;
	private undoBtn: HTMLElement | null = null;
	private redoBtn: HTMLElement | null = null;

	constructor(
		parent: HTMLElement,
		engine: ArchitectureDiagramEngine,
		undoRedo: DiagramUndoRedo,
		definition: DiagramDefinition,
	) {
		this.container = document.createElement('div');
		this.container.className = 'diagram-toolbar';
		this.container.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid var(--vscode-panel-border);';

		this.engine = engine;
		this.undoRedo = undoRedo;
		this.definition = definition;

		this.build();
		parent.appendChild(this.container);

		// Listen for undo/redo state changes
		this.undoRedo.setOnStateChange((canUndo, canRedo) => {
			this.updateUndoRedoState(canUndo, canRedo);
		});
	}

	/* ─── Build ────────────────────────────────────────────── */

	private build(): void {
		const cfg = this.definition.toolbar;

		if (cfg.showUndoRedo) {
			this.undoBtn = this.createButton('↩', 'Undo (Ctrl+Z)', () => this.engine.undo());
			this.redoBtn = this.createButton('↪', 'Redo (Ctrl+Shift+Z)', () => this.engine.redo());
			this.updateUndoRedoState(false, false);
		}

		if (cfg.showZoom) {
			this.createButton('−', 'Zoom Out', () => this.engine.zoomOut());
			this.zoomLabel = this.createLabel('100%');
			this.createButton('+', 'Zoom In', () => this.engine.zoomIn());
		}

		if (cfg.showFitView) {
			this.createButton('⊞', 'Fit View', () => this.engine.fitView());
		}

		if (cfg.showAutoLayout) {
			this.createButton('◫', 'Auto Layout', () => this.engine.autoLayout());
		}
	}

	/* ─── Button Helpers ───────────────────────────────────── */

	private createButton(text: string, title: string, onClick: () => void): HTMLElement {
		const btn = document.createElement('button');
		btn.textContent = text;
		btn.title = title;
		btn.className = 'diagram-toolbar-btn';
		btn.style.cssText = `
			background: transparent;
			border: 1px solid transparent;
			color: var(--vscode-foreground);
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 3px;
			font-size: 14px;
			line-height: 1;
		`;
		btn.addEventListener('mouseenter', () => {
			btn.style.background = 'var(--vscode-toolbar-hoverBackground)';
		});
		btn.addEventListener('mouseleave', () => {
			btn.style.background = 'transparent';
		});
		btn.addEventListener('click', onClick);
		this.container.appendChild(btn);
		return btn;
	}

	private createLabel(text: string): HTMLElement {
		const label = document.createElement('span');
		label.textContent = text;
		label.className = 'diagram-toolbar-label';
		label.style.cssText = `
			color: var(--vscode-foreground);
			font-size: 12px;
			min-width: 40px;
			text-align: center;
		`;
		this.container.appendChild(label);
		return label;
	}

	/* ─── Update ───────────────────────────────────────────── */

	updateZoomLevel(zoom: number): void {
		if (this.zoomLabel) {
			this.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
		}
	}

	updateUndoRedoState(canUndo: boolean, canRedo: boolean): void {
		if (this.undoBtn) {
			this.undoBtn.style.opacity = canUndo ? '1' : '0.4';
		}
		if (this.redoBtn) {
			this.redoBtn.style.opacity = canRedo ? '1' : '0.4';
		}
	}

	destroy(): void {
		if (this.container.parentNode) {
			this.container.parentNode.removeChild(this.container);
		}
	}
}