/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// registered in app.ts
// handles IPC calls from the renderer process for the Statuz Graph Engine

import { IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../../base/common/event.js';
import { StatuzEngineRequest, StatuzEngineResponse } from '../../common/engine/statuzEngineChannelId.js';

/**
 * IPC server channel for the Statuz Graph Engine.
 *
 * This channel sits in the electron-main process and receives calls
 * from the renderer process (via IStatuzEngineService). It dispatches
 * them to the native Rust engine module (@statuz/engine-native).
 *
 * Until the native module is integrated, this channel returns stub
 * error responses for all calls.
 *
 * Registration: app.ts → mainProcessElectronServer.registerChannel('statuz-channel-engine', channel)
 */
export class StatuzEngineChannel implements IServerChannel {

	// TODO: When native module is integrated, hold a reference to it here:
	// private nativeModule: typeof import('@statuz/engine-native') | undefined;

	constructor() {
		// TODO: Load native module when integrated:
		// try {
		// 	this.nativeModule = require('@statuz/engine-native');
		// } catch (e) {
		// 	console.error('[StatuzEngine] Failed to load native module:', e);
		// }
	}

	async call<T>(_ctx: string, command: string, arg?: StatuzEngineRequest): Promise<T> {
		if (command !== 'call') {
			throw new Error(`Unknown command: ${command}`);
		}

		const request = arg!;
		const { method } = request;

		// TODO: Dispatch to native module when integrated:
		// if (this.nativeModule) {
		// 	const result = await this.nativeModule[method](...request.args);
		// 	return { id: request.id, success: true, result } as T;
		// }

		const response: StatuzEngineResponse = {
			id: request.id,
			success: false,
			error: {
				message: `Statuz Engine native module is not yet integrated. (method: ${method})`,
				code: 'ENGINE_NOT_READY',
			},
		};

		return response as unknown as T;
	}

	listen<T>(_event: string, _arg?: unknown): Event<T> {
		// No events to listen to yet.
		// When the native module is integrated, this will expose:
		// - onNodeAdded
		// - onNodeRemoved
		// - onEdgeAdded
		// - onGraphChanged
		return Event.None;
	}
}
