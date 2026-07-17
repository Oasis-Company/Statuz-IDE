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
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { FileAccess } from '../../../../base/common/network.js';


// ---------- Define viewpane ----------

class DashboardViewPane extends ViewPane {

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService)
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);

		const container = document.createElement('div');
		container.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:24px;color:var(--vscode-descriptionForeground);text-align:center;font-family:var(--vscode-font-family);';

		const icon = document.createElement('div');
		icon.style.cssText = 'font-size:48px;margin-bottom:16px;opacity:0.4;';
		icon.classList.add('codicon', 'codicon-dashboard');

		const title = document.createElement('h2');
		title.textContent = 'Statuz Dashboard';
		title.style.cssText = 'font-size:18px;font-weight:600;color:var(--vscode-foreground);margin:0 0 8px;';

		const desc = document.createElement('p');
		desc.textContent = 'Project insights, graph engine health, and agent execution monitoring — coming soon.';
		desc.style.cssText = 'font-size:13px;line-height:1.5;max-width:280px;margin:0;';

		container.appendChild(icon);
		container.appendChild(title);
		container.appendChild(desc);
		parent.appendChild(container);
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}
}


// ---------- Register view container ----------

export const STATUZ_DASHBOARD_VIEW_CONTAINER_ID = 'workbench.view.statuzDashboard'
export const STATUZ_DASHBOARD_VIEW_ID = 'workbench.view.statuzDashboard.dashboard'

const dashboardViewIcon = FileAccess.asFileUri('vs/workbench/contrib/statuz/browser/media/statuz-activity-icon.svg');

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const dashboardContainer = viewContainerRegistry.registerViewContainer({
	id: STATUZ_DASHBOARD_VIEW_CONTAINER_ID,
	title: nls.localize2('statuzDashboard', 'Dashboard'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [STATUZ_DASHBOARD_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 2.5,
	rejectAddedViews: true,
	icon: dashboardViewIcon,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true, isDefault: false });


// Register view
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: STATUZ_DASHBOARD_VIEW_ID,
	name: nls.localize2('statuzDashboard', 'Dashboard'),
	ctorDescriptor: new SyncDescriptor(DashboardViewPane),
	canToggleVisibility: false,
	canMoveView: false,
	weight: 80,
	order: 1,
}], dashboardContainer);


// Open action
export const STATUZ_OPEN_DASHBOARD_ACTION_ID = 'statuz.openDashboard'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: STATUZ_OPEN_DASHBOARD_ACTION_ID,
			title: nls.localize2('openStatuzDashboard', 'Open Statuz Dashboard'),
		})
	}
	run(accessor: ServicesAccessor): void {
		const viewsService = accessor.get(IViewsService)
		viewsService.openViewContainer(STATUZ_DASHBOARD_VIEW_CONTAINER_ID);
	}
});
