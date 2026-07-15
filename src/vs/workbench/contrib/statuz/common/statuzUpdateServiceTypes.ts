/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type VoidCheckUpdateRespose = {
	message: string,
	action?: 'reinstall' | 'restart' | 'download' | 'apply'
} | {
	message: null,
	actions?: undefined,
} | null


