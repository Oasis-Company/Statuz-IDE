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

import { ArchitectureDiagramEngine } from './diagram/architectureDiagramEngine.js';
import { DiagramStateManager } from './diagram/diagramStateManager.js';
import { DiagramUndoRedo } from './diagram/diagramUndoRedo.js';
import { DiagramToolbar } from './diagram/diagramToolbar.js';
import { boardDiagramDefinition } from './diagram/boardDiagramDefinition.js';
import { BoardCompletenessPanel } from './board/boardCompletenessPanel.js';
import type { SandboxCard } from './board/boardTypes.js';


/* ─── BoardViewPane ──────────────────────────────────────── */

class BoardViewPane extends ViewPane {

	private container!: HTMLElement;
	private engine!: ArchitectureDiagramEngine;
	private diagramToolbar!: DiagramToolbar;
	private completenessPanel!: BoardCompletenessPanel;
	private diagramStateManager!: DiagramStateManager;
	private diagramUndoRedo!: DiagramUndoRedo;

	private cards: SandboxCard[] = [];

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

		// State management using unified diagram modules
		this.diagramStateManager = new DiagramStateManager(boardDiagramDefinition);
		this.diagramUndoRedo = new DiagramUndoRedo();

		// Track undo/redo state changes for toolbar
		this.diagramUndoRedo.setOnStateChange(() => {
			// Toolbar updates its own button states via the same callback
		});

		// Toolbar
		const toolbarContainer = document.createElement('div');
		toolbarContainer.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid var(--vscode-panel-border);';
		this.container.appendChild(toolbarContainer);

		// Unified toolbar provides undo/redo/zoom/fit/layout
		// We create the engine first, then the toolbar needs it
		// Actually, we need to create the toolbar after the engine — but we need the canvas container
		// Let's: create toolbar container → create canvas container → create engine → create toolbar in toolbar container

		// Canvas container
		const canvasContainer = document.createElement('div');
		canvasContainer.style.cssText = 'flex:1;position:relative;overflow:hidden;';
		this.container.appendChild(canvasContainer);

		// Engine — using unified ArchitectureDiagramEngine with board definition
		this.engine = new ArchitectureDiagramEngine(
			canvasContainer,
			boardDiagramDefinition,
			this.diagramStateManager,
			this.diagramUndoRedo,
			this.contextMenuService,
		);

		// Toolbar (insert at top)
		this.diagramToolbar = new DiagramToolbar(
			toolbarContainer,
			this.engine,
			this.diagramUndoRedo,
			boardDiagramDefinition,
		);

		// Add custom Board-specific toolbar buttons
		this.addBoardToolbarButtons(toolbarContainer);

		// Completeness panel
		this.completenessPanel = new BoardCompletenessPanel(canvasContainer, {
			onCreateCard: (type) => this.handleAddCard(type),
			onEditConstitution: () => {
				console.log('[Board] Edit constitution');
			},
		});
		this.completenessPanel.update(this.cards, null);

		// Async load data
		this.loadBoardData().catch(err => console.warn('[Board] Data load failed:', err));
	}

	/* ─── Custom Board Toolbar Buttons ─────────────────────── */

	private addBoardToolbarButtons(parent: HTMLElement): void {
		// Separator
		const sep = document.createElement('span');
		sep.style.cssText = 'width:1px;height:20px;background:var(--vscode-panel-border);margin:0 6px;';
		parent.appendChild(sep);

		// Add Card button
		const addCardBtn = document.createElement('button');
		addCardBtn.textContent = '+ Card';
		addCardBtn.title = 'Add Card';
		addCardBtn.style.cssText = `
			background: transparent; border: 1px solid transparent;
			color: var(--vscode-foreground); cursor: pointer;
			padding: 2px 8px; border-radius: 3px; font-size: 12px;
		`;
		addCardBtn.addEventListener('click', () => this.handleAddCard('concept'));
		addCardBtn.addEventListener('mouseenter', () => { addCardBtn.style.background = 'var(--vscode-toolbar-hoverBackground)'; });
		addCardBtn.addEventListener('mouseleave', () => { addCardBtn.style.background = 'transparent'; });
		parent.appendChild(addCardBtn);

		// Add Decision button
		const addDecisionBtn = document.createElement('button');
		addDecisionBtn.textContent = '+ Decision';
		addDecisionBtn.title = 'Add Decision';
		addDecisionBtn.style.cssText = `
			background: transparent; border: 1px solid transparent;
			color: var(--vscode-foreground); cursor: pointer;
			padding: 2px 8px; border-radius: 3px; font-size: 12px;
		`;
		addDecisionBtn.addEventListener('click', () => this.handleAddDecision());
		addDecisionBtn.addEventListener('mouseenter', () => { addDecisionBtn.style.background = 'var(--vscode-toolbar-hoverBackground)'; });
		addDecisionBtn.addEventListener('mouseleave', () => { addDecisionBtn.style.background = 'transparent'; });
		parent.appendChild(addDecisionBtn);
	}

	/* ─── Data Loading ─────────────────────────────────────── */

	private async loadBoardData(): Promise<void> {
		const state = this.diagramStateManager.getState();
		if (state.layouts.length > 0) {
			this.engine.render();
		}
	}

	/* ─── Custom Toolbar Actions ────────────────────────────── */

	private handleAddCard(type: string): void {
		const newId = `card-${type}-${Date.now().toString(36)}`;
		const state = this.diagramStateManager.getState();
		const lastLayout = state.layouts[state.layouts.length - 1];
		const pos = lastLayout
			? { x: lastLayout.position.x, y: lastLayout.position.y + 130 }
			: { x: 100, y: 100 };

		this.diagramStateManager.addNodeLayout(newId, 'card', pos);

		const newCard: SandboxCard = {
			id: newId,
			type: type as SandboxCard['type'],
			conceptId: 'A',
			content: `New ${type} card`,
			status: 'draft',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		this.cards = [...this.cards, newCard];
		this.completenessPanel.update(this.cards, null);
		this.engine.render();
	}

	private handleAddDecision(): void {
		const newId = `decision-${Date.now().toString(36)}`;
		const state = this.diagramStateManager.getState();
		const pos = { x: 500, y: 100 + state.layouts.length * 130 };

		this.diagramStateManager.addNodeLayout(newId, 'decision', pos);
		this.engine.render();
	}

	/* ─── Layout ───────────────────────────────────────────── */

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}

	override dispose(): void {
		this.engine?.destroy();
		this.diagramToolbar?.destroy();
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