/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { StatuzOnboarding } from './StatuzOnboarding.js'
import { StatuzSplash } from './StatuzSplash.js'

export const mountStatuzOnboarding = mountFnGenerator(StatuzOnboarding)
export const mountStatuzSplash = mountFnGenerator(StatuzSplash)