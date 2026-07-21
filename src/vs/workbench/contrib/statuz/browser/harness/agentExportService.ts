/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IAgentManagementService } from '../agentManagementService.js';

export class AgentExportService {

	constructor(
		private readonly agentMgmtService: IAgentManagementService,
	) {}

	async exportAsYaml(agentId: string): Promise<void> {
		const yaml = await this.agentMgmtService.exportDefinition(agentId);
		const def = await this.agentMgmtService.getDefinition(agentId);
		const filename = def ? `${def.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.agent.yaml` : 'agent.yaml';

		const blob = new Blob([yaml], { type: 'application/x-yaml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
}