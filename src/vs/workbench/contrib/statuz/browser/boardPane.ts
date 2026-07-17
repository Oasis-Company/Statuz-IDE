/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions, IViewContainersRegistry,
	ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../common/views.js';

import * as nls from '../../../../nls.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';

import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';

import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';

import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';

import { BoardCanvas } from './board/boardCanvas.js';
import type { BoardCanvasData } from './board/boardCanvas.js';
import { BoardToolbar } from './board/boardToolbar.js';
import { BoardCompletenessPanel } from './board/boardCompletenessPanel.js';
import { BoardStateManager } from './board/boardStateManager.js';
import { BoardUndoRedo } from './board/boardUndoRedo.js';
import { buildNodes, buildEdges } from './board/boardLayout.js';
import type { FlowNodeLayout, FlowEdgeData, SandboxCard, Constitution } from './board/boardTypes.js';
import type { BoardSnapshot } from './board/boardUndoRedo.js';

/* ─── Sample Data ────────────────────────────────────────── */

function createSampleData(): BoardCanvasData {
	const cards: SandboxCard[] = [
		{
			id: 'card-vision',
			type: 'vision',
			conceptId: 'A',
			content: 'A unified IDE for strategic thinking and execution — combining AI agents, canvas-based planning, and code editing in one tool.',
			status: 'approved',
			createdAt: '2026-07-01',
			updatedAt: '2026-07-15',
		},
		{
			id: 'card-user',
			type: 'user',
			conceptId: 'A',
			content: 'Technical founders and senior engineers who need to manage both strategic decisions and implementation details.',
			status: 'approved',
			createdAt: '2026-07-02',
			updatedAt: '2026-07-10',
		},
		{
			id: 'card-problem',
			type: 'problem',
			conceptId: 'B',
			content: 'Strategic decisions get lost in Slack threads and Notion docs. No tool connects strategy directly to code.',
			status: 'pending',
			createdAt: '2026-07-03',
			updatedAt: '2026-07-12',
		},
		{
			id: 'card-mvp',
			type: 'mvp',
			conceptId: 'B',
			content: 'Agent management, board canvas, and native engine integration — shipping usable pieces that compose into a whole.',
			status: 'draft',
			createdAt: '2026-07-05',
			updatedAt: '2026-07-14',
		},
	];

	const constitution: Constitution = {
		vision: 'Build tools that connect strategy to execution — every decision visible, every assumption tracked.',
		principles: ['AI-native first', 'Strategy-code linkage', 'Local-first with sync', 'Extensible by plugins'],
		constraints: ['Must work offline', 'No vendor lock-in for AI models', 'Privacy-preserving data model'],
		metrics: ['Weekly active users', 'Average session duration', 'Decision-to-implementation time'],
		forbidden_features: [],
	};

	const decisions = [
		{
			id: 'decision-1',
			type: 'creation',
			description: 'Use native SVG instead of React Flow for the Board canvas',
			commitment: 'Committed',
			time: '2026-07-15',
		},
		{
			id: 'decision-2',
			type: 'milestone',
			description: 'Ship Agent Management MVP before Board integration',
			commitment: 'Committed',
			time: '2026-07-16',
		},
		{
			id: 'decision-3',
			type: 'correction',
			description: 'Replace Zod with manual validators for zero-dependency storage',
			commitment: 'Accepted',
			time: '2026-07-17',
		},
	];

	return { cards, constitution, decisions };
}

/* ─── BoardViewPane ──────────────────────────────────────── */

class BoardViewPane extends ViewPane {

	private container!: HTMLElement;
	private canvas!: BoardCanvas;
	private boardToolbar!: BoardToolbar;
	private completenessPanel!: BoardCompletenessPanel;
	private stateManager!: BoardStateManager;
	private undoRedo!: BoardUndoRedo;

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService protected override readonly contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);

		// Root container
		this.container = document.createElement('div');
		this.container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;position:relative;';
		parent.appendChild(this.container);

		// State management
		const projectId = 'statuz-main';
		this.stateManager = new BoardStateManager(projectId);
		this.undoRedo = new BoardUndoRedo();

		// Initialize layouts from state manager
		this.ensureLayouts();

		// Track undo/redo state changes for toolbar
		this.undoRedo.onStateChange(() => {
			// Toolbar updates its own button states via the same callback
		});

		// Toolbar
		this.boardToolbar = new BoardToolbar(this.container, this.undoRedo, {
			onZoomIn: () => this.adjustZoom(-0.25),
			onZoomOut: () => this.adjustZoom(0.25),
			onFitView: () => this.fitView(),
			onUndo: () => this.handleUndo(),
			onRedo: () => this.handleRedo(),
			onLayoutChange: (layout) => this.handleLayoutChange(layout),
			onAddCard: (type) => this.handleAddCard(type),
			onAddDecision: () => this.handleAddDecision(),
		});

		// Canvas container
		const canvasContainer = document.createElement('div');
		canvasContainer.style.cssText = 'flex:1;position:relative;overflow:hidden;';
		this.container.appendChild(canvasContainer);

		// Canvas
		const data = createSampleData();
		this.canvas = new BoardCanvas(
			canvasContainer,
			this.stateManager,
			this.undoRedo,
			data,
			this.contextMenuService,
			{
				onNodeDoubleClick: (id, type) => this.handleNodeDoubleClick(id, type),
				onAddEdge: (source, target, type) => this.handleAddEdge(source, target, type),
				onRemoveEdge: (edgeId) => this.handleRemoveEdge(edgeId),
				onRemoveNode: (nodeId, nodeType) => this.handleRemoveNode(nodeId, nodeType),
				onDuplicateNode: (nodeId) => this.handleDuplicateNode(nodeId),
				onEditNode: (nodeId, nodeType) => this.handleNodeDoubleClick(nodeId, nodeType),
				onAddCard: (type) => this.handleAddCard(type),
				onAddDecision: () => this.handleAddDecision(),
				onLayoutChange: (layout) => this.handleLayoutChange(layout),
				onFitView: () => this.fitView(),
			},
		);

		// Completeness panel
		this.completenessPanel = new BoardCompletenessPanel(canvasContainer, {
			onCreateCard: (type) => this.handleAddCard(type),
			onEditConstitution: () => {
				// TODO: open constitution editor
				console.log('[Board] Edit constitution');
			},
		});
		this.completenessPanel.update(data.cards, data.constitution);
	}

	/* ─── Layout Management ────────────────────────────────── */

	private ensureLayouts(): void {
		const state = this.stateManager.getState();
		const data = createSampleData();

		// Collect all expected node IDs
		const expectedIds = new Set<string>();
		expectedIds.add('node-constitution');
		for (const card of data.cards) expectedIds.add(card.id);
		for (const decision of data.decisions) expectedIds.add(decision.id);

		// Add missing layouts
		for (const id of expectedIds) {
			if (!state.nodeLayouts.some(n => n.id === id)) {
				let type: FlowNodeLayout['type'] = 'card';
				if (id === 'node-constitution') type = 'constitution';
				else if (id.startsWith('decision-')) type = 'decision';
				this.stateManager.addNodeLayout(id, type);
			}
		}

		// Auto-layout if no positions set
		const layouts = this.stateManager.getState().nodeLayouts;
		const hasPositions = layouts.some(n => n.position.x !== 0 || n.position.y !== 0);
		if (!hasPositions) {
			this.applyAutoLayout(data);
		}

		// Auto-create card chain edges if none exist
		const edges = this.stateManager.getState().edges;
		if (edges.length === 0) {
			const cardIds = data.cards.map(c => c.id);
			for (let i = 0; i < cardIds.length - 1; i++) {
				this.stateManager.addEdge(cardIds[i], cardIds[i + 1], 'informs');
			}
		}
	}

	private applyAutoLayout(data: BoardCanvasData): void {
		const nodes = buildNodes(data.cards, data.constitution, data.decisions, this.stateManager.getState().nodeLayouts);
		const edges = buildEdges(data.cards, this.stateManager.getState().edges);

		for (const node of nodes) {
			this.stateManager.updateNodePosition(node.id, node.position);
		}
		for (const edge of edges) {
			if (!this.stateManager.getState().edges.some(e => e.id === edge.id)) {
				this.stateManager.addEdge(edge.source, edge.target, edge.type);
			}
		}
	}

	/* ─── Zoom ─────────────────────────────────────────────── */

	private adjustZoom(delta: number): void {
		const state = this.stateManager.getState();
		const currentZoom = state.viewport.zoom || 1;
		const newZoom = Math.max(0.2, Math.min(5, currentZoom * (1 + delta)));
		this.stateManager.setViewport({
			x: state.viewport.x,
			y: state.viewport.y,
			zoom: newZoom,
		});
		this.boardToolbar.updateZoomLabel(newZoom);
		this.canvas.render();
	}

	private fitView(): void {
		this.stateManager.setViewport({ x: 0, y: 0, zoom: 1 });
		this.boardToolbar.updateZoomLabel(1);
		this.canvas.render();
	}

	/* ─── Undo/Redo ────────────────────────────────────────── */

	private handleUndo(): void {
		const currentSnapshot: BoardSnapshot = this.createCurrentSnapshot();
		const restored = this.undoRedo.undo(currentSnapshot);
		if (restored) {
			this.restoreSnapshot(restored);
		}
	}

	private handleRedo(): void {
		const currentSnapshot: BoardSnapshot = this.createCurrentSnapshot();
		const restored = this.undoRedo.redo(currentSnapshot);
		if (restored) {
			this.restoreSnapshot(restored);
		}
	}

	private createCurrentSnapshot(): BoardSnapshot {
		const state = this.stateManager.getState();
		return {
			nodeLayouts: state.nodeLayouts,
			edges: state.edges,
			viewport: state.viewport,
		};
	}

	private restoreSnapshot(snapshot: BoardSnapshot): void {
		// Replace all layouts
		const currentState = this.stateManager.getState();

		// Remove old layouts
		for (const layout of currentState.nodeLayouts) {
			this.stateManager.removeNodeLayout(layout.id);
		}
		// Add restored layouts
		for (const layout of snapshot.nodeLayouts) {
			this.stateManager.addNodeLayout(layout.id, layout.type, layout.position);
		}

		// Remove old edges
		for (const edge of currentState.edges) {
			this.stateManager.removeEdge(edge.id);
		}
		// Add restored edges
		for (const edge of snapshot.edges) {
			this.stateManager.addEdge(edge.source, edge.target, edge.type);
		}

		// Restore viewport
		this.stateManager.setViewport(snapshot.viewport);
		this.boardToolbar.updateZoomLabel(snapshot.viewport.zoom || 1);

		this.canvas.render();
	}

	/* ─── Layout Change ────────────────────────────────────── */

	private handleLayoutChange(layout: 'column' | 'dagre' | 'manual'): void {
		if (layout === 'column') {
			const data = createSampleData();
			this.applyAutoLayout(data);
			this.canvas.render();
		} else if (layout === 'dagre') {
			// Dagre layout is computed in boardLayout.ts
			const data = createSampleData();
			this.applyAutoLayout(data);
			this.canvas.render();
		}
		// 'manual' — no automatic changes
	}

	/* ─── Node Operations ──────────────────────────────────── */

	private handleNodeDoubleClick(nodeId: string, _nodeType: string): void {
		console.log('[Board] Node double-clicked:', nodeId, _nodeType);
		// TODO: open detail editor
	}

	private handleAddCard(type: string): void {
		const newId = `card-${type}-${Date.now().toString(36)}`;
		const state = this.stateManager.getState();
		const lastLayout = state.nodeLayouts[state.nodeLayouts.length - 1];
		const pos = lastLayout
			? { x: lastLayout.position.x, y: lastLayout.position.y + 130 }
			: { x: 100, y: 100 };

		this.stateManager.addNodeLayout(newId, 'card', pos);
		this.canvas.render();
	}

	private handleAddDecision(): void {
		const newId = `decision-${Date.now().toString(36)}`;
		const state = this.stateManager.getState();
		const pos = { x: 500, y: 100 + state.nodeLayouts.length * 130 };

		this.stateManager.addNodeLayout(newId, 'decision', pos);
		this.canvas.render();
	}

	private handleRemoveNode(nodeId: string, _nodeType: string): void {
		this.stateManager.removeNodeLayout(nodeId);
		this.canvas.render();
	}

	private handleDuplicateNode(nodeId: string): void {
		// Duplication is handled by Ctrl+D in BoardCanvas
		// This callback is for the context menu 'Duplicate' action
		const state = this.stateManager.getState();
		const layout = state.nodeLayouts.find(n => n.id === nodeId);
		if (layout) {
			const newId = `${nodeId}-copy-${Date.now().toString(36)}`;
			this.stateManager.addNodeLayout(newId, layout.type, {
				x: layout.position.x + 30,
				y: layout.position.y + 30,
			});
			this.canvas.render();
		}
	}

	/* ─── Edge Operations ──────────────────────────────────── */

	private handleAddEdge(source: string, target: string, type: FlowEdgeData['type']): void {
		this.stateManager.addEdge(source, target, type);
		this.canvas.render();
	}

	private handleRemoveEdge(edgeId: string): void {
		this.stateManager.removeEdge(edgeId);
		this.canvas.render();
	}

	/* ─── Layout ───────────────────────────────────────────── */

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}

	override dispose(): void {
		this.canvas?.destroy();
		this.boardToolbar?.destroy();
		this.completenessPanel?.destroy();
		super.dispose();
	}
}


// ---------- Register view container ----------

export const STATUZ_BOARD_VIEW_CONTAINER_ID = 'workbench.view.statuzBoard';
export const STATUZ_BOARD_VIEW_ID = 'workbench.view.statuzBoard.board';

const boardViewIcon = registerIcon('statuz-board-view-icon', Codicon.project, localize('statuzBoardViewIcon', 'View icon of the Sandboxer Board view.'));

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const boardContainer = viewContainerRegistry.registerViewContainer({
	id: STATUZ_BOARD_VIEW_CONTAINER_ID,
	title: nls.localize2('statuzBoard', 'Board'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [STATUZ_BOARD_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 2.6,
	rejectAddedViews: true,
	icon: boardViewIcon,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true, isDefault: false });


// Register view
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: STATUZ_BOARD_VIEW_ID,
	name: nls.localize2('statuzBoard', 'Board'),
	ctorDescriptor: new SyncDescriptor(BoardViewPane),
	canToggleVisibility: false,
	canMoveView: false,
	weight: 80,
	order: 1,
}], boardContainer);


// Open action
export const STATUZ_OPEN_BOARD_ACTION_ID = 'statuz.openBoard';
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: STATUZ_OPEN_BOARD_ACTION_ID,
			title: nls.localize2('openStatuzBoard', 'Open Sandboxer Board'),
		});
	}
	run(accessor: ServicesAccessor): void {
		const viewsService = accessor.get(IViewsService);
		viewsService.openViewContainer(STATUZ_BOARD_VIEW_CONTAINER_ID);
	}
});