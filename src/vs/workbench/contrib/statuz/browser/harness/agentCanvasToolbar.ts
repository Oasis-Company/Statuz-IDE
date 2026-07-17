/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface ToolbarCallbacks {
	onUndo: () => void;
	onRedo: () => void;
	onFitView: () => void;
	onAutoLayout: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onAddNode: () => void;
}

export interface ToolbarState {
	canUndo: boolean;
	canRedo: boolean;
	zoom: number; // 0.2 - 5.0
}

export class AgentCanvasToolbar {
	private readonly container: HTMLElement;
	private readonly getState: () => ToolbarState;

	private readonly undoBtn: HTMLButtonElement;
	private readonly redoBtn: HTMLButtonElement;
	private readonly zoomLabel: HTMLSpanElement;

	constructor(
		parent: HTMLElement,
		callbacks: ToolbarCallbacks,
		getState: () => ToolbarState,
	) {
		this.getState = getState;

		this.container = document.createElement('div');
		this.container.className = 'agent-canvas-toolbar';

		// Undo / Redo
		this.undoBtn = this.createButton('codicon codicon-undo', 'Undo', () => callbacks.onUndo());
		this.redoBtn = this.createButton('codicon codicon-redo', 'Redo', () => callbacks.onRedo());

		this.container.appendChild(this.undoBtn);
		this.container.appendChild(this.redoBtn);
		this.addSeparator();

		// Fit View / Auto Layout
		this.container.appendChild(this.createButton('codicon codicon-screen-full', 'Fit View', () => callbacks.onFitView()));
		this.container.appendChild(this.createButton('codicon codicon-array', 'Auto Layout', () => callbacks.onAutoLayout()));
		this.addSeparator();

		// Zoom controls
		this.container.appendChild(this.createButton('codicon codicon-zoom-out', 'Zoom Out', () => callbacks.onZoomOut()));
		this.zoomLabel = document.createElement('span');
		this.zoomLabel.className = 'agent-canvas-toolbar-zoom-label';
		this.zoomLabel.textContent = '100%';
		this.container.appendChild(this.zoomLabel);
		this.container.appendChild(this.createButton('codicon codicon-zoom-in', 'Zoom In', () => callbacks.onZoomIn()));
		this.addSeparator();

		// Add Node
		this.container.appendChild(this.createButton('codicon codicon-plus', 'Add Node', () => callbacks.onAddNode()));

		parent.appendChild(this.container);
	}

	private createButton(iconClass: string, tooltip: string, onClick: () => void): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.title = tooltip;
		btn.innerHTML = `<span class="${iconClass}"></span>`;
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			onClick();
		});
		return btn;
	}

	private addSeparator(): void {
		const sep = document.createElement('div');
		sep.className = 'agent-canvas-toolbar-separator';
		this.container.appendChild(sep);
	}

	update(): void {
		const state = this.getState();
		this.undoBtn.disabled = !state.canUndo;
		this.redoBtn.disabled = !state.canRedo;
		this.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
	}

	dispose(): void {
		this.container.remove();
	}
}