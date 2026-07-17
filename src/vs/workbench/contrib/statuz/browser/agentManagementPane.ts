/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './agentManagement.css';

import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAgentManagementService, AgentManagementService } from './agentManagementService.js';

// Register the AgentManagementService singleton
// The full-page HarnessEditor (See harness/harnessEditor.ts) replaces the old sidebar ViewPane
registerSingleton(IAgentManagementService, AgentManagementService, 0 /* InstantiationType.Delayed */);