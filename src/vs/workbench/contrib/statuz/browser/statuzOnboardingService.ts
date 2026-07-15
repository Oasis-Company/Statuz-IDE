/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { mountStatuzSplash, mountStatuzOnboarding } from './react/out/statuz-onboarding/index.js'
import { h, getActiveWindow } from '../../../../base/browser/dom.js';

// Onboarding contribution that mounts the splash screen and then the onboarding flow
export class OnboardingContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.statuzOnboarding';

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this.initialize();
	}

	private initialize(): void {
		// Get the active window reference for multi-window support
		const targetWindow = getActiveWindow();

		// Find the monaco-workbench element using the proper window reference
		const workbench = targetWindow.document.querySelector('.monaco-workbench');

		if (workbench) {
			// Step 1: Mount splash screen
			const splashContainer = h('div.statuz-splash-container').root;
			workbench.appendChild(splashContainer);

			const splashRef = this.instantiationService.invokeFunction((accessor: ServicesAccessor) => {
				return mountStatuzSplash(splashContainer, accessor, { onComplete: () => {
					// Step 2: Splash done — show onboarding
					splashRef?.dispose();

					const onboardingContainer = h('div.statuz-onboarding-container').root;
					workbench.appendChild(onboardingContainer);
					this.instantiationService.invokeFunction((accessor2: ServicesAccessor) => {
						const result = mountStatuzOnboarding(onboardingContainer, accessor2);
						if (result && typeof result.dispose === 'function') {
							this._register(toDisposable(result.dispose));
						}
					});
					this._register(toDisposable(() => {
						if (onboardingContainer.parentElement) {
							onboardingContainer.parentElement.removeChild(onboardingContainer);
						}
					}));
				}});
			});

			// Register cleanup for the splash container
			this._register(toDisposable(() => {
				if (splashContainer.parentElement) {
					splashContainer.parentElement.removeChild(splashContainer);
				}
			}));
		}
	}
}

// Register the contribution to be initialized during the AfterRestored phase
registerWorkbenchContribution2(OnboardingContribution.ID, OnboardingContribution, WorkbenchPhase.AfterRestored);