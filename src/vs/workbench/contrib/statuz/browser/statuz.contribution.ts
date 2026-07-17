/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/


// register inline diffs
import './editCodeService.js'

// register Sidebar pane, state, actions (keybinds, menus) (Ctrl+L)
import './sidebarActions.js'
import './sidebarPane.js'

// register Dashboard pane (Activity Bar)
import './dashboardPane.js'

// register Sandboxer Board pane (Activity Bar)
import './boardPane.js'

// register Agent Management pane (Activity Bar) — replaced by full-page HarnessEditor
import './harness/harnessEditor.js'

// register AgentManagementService singleton
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAgentManagementService, AgentManagementService } from './agentManagementService.js';
registerSingleton(IAgentManagementService, AgentManagementService, 0);

// register ECC services
import { IEccCatalogService, EccCatalogService } from './ecc/eccCatalogService.js';
import { IEccInstallService, EccInstallService } from './ecc/eccInstallService.js';
registerSingleton(IEccCatalogService, EccCatalogService, 0);
registerSingleton(IEccInstallService, EccInstallService, 0);

// register quick edit (Ctrl+K)
import './quickEditActions.js'


// register Autocomplete
import './autocompleteService.js'

// register Context services
// import './contextGatheringService.js'
// import './contextUserChangesService.js'

// settings pane
import './statuzSettingsPane.js'

// register css
import './media/statuz.css'

// update (frontend part, also see platform/)
import './statuzUpdateActions.js'

import './convertToLLMMessageWorkbenchContrib.js'

// tools
import './toolsService.js'
import './terminalToolService.js'

// register Thread History
import './chatThreadService.js'

// ping
import './metricsPollService.js'

// helper services
import './helperServices/consistentItemService.js'

// register selection helper
import './statuzSelectionHelperWidget.js'

// register tooltip service
import './tooltipService.js'

// register onboarding service
import './statuzOnboardingService.js'

// register misc service
import './miscWokrbenchContrib.js'

// register file service (for explorer context menu)
import './fileService.js'

// register source control management
import './statuzSCMService.js'

// ---------- common (unclear if these actually need to be imported, because they're already imported wherever they're used) ----------

// llmMessage
import '../common/sendLLMMessageService.js'

// voidSettings
import '../common/statuzSettingsService.js'

// refreshModel
import '../common/refreshModelService.js'

// metrics
import '../common/metricsService.js'

// updates
import '../common/statuzUpdateService.js'

// model service
import '../common/statuzModelService.js'

// graph engine service (stub — native module not yet integrated)
import '../common/engine/statuzEngineService.js'

// ---------- Supabase services ----------

import './supabase/supabaseClientService.js'
import './supabase/supabaseAuthService.js'
import './board/boardDataService.js'

// ---------- Supabase auth contribution (AccountsContext menu) ----------

import './supabase/supabaseAuthContribution.js'

// ---------- Statuz Core services ----------

import { IStatuzService, StatuzService } from './statuz/statuzService.js';
registerSingleton(IStatuzService, StatuzService, 0 /* InstantiationType.Eager */);
