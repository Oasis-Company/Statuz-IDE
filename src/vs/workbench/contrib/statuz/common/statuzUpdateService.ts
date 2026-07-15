/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { VoidCheckUpdateRespose } from './statuzUpdateServiceTypes.js';



export interface IStatuzUpdateService {
	readonly _serviceBrand: undefined;
	check: (explicit: boolean) => Promise<VoidCheckUpdateRespose>;
}


export const IStatuzUpdateService = createDecorator<IStatuzUpdateService>('StatuzUpdateService');


// implemented by calling channel
export class StatuzUpdateService implements IStatuzUpdateService {

	readonly _serviceBrand: undefined;
	private readonly voidUpdateService: IStatuzUpdateService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService, // (only usable on client side)
	) {
		// creates an IPC proxy to use metricsMainService.ts
		this.voidUpdateService = ProxyChannel.toService<IStatuzUpdateService>(mainProcessService.getChannel('void-channel-update'));
	}


	// anything transmitted over a channel must be async even if it looks like it doesn't have to be
	check: IStatuzUpdateService['check'] = async (explicit) => {
		const res = await this.voidUpdateService.check(explicit)
		return res
	}
}

registerSingleton(IStatuzUpdateService, StatuzUpdateService, InstantiationType.Eager);


