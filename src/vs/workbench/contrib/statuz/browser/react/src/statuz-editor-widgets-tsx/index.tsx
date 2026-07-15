/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { StatuzCommandBarMain } from './StatuzCommandBar.js'
import { StatuzSelectionHelperMain } from './StatuzSelectionHelper.js'

export const mountStatuzCommandBar = mountFnGenerator(StatuzCommandBarMain)

export const mountStatuzSelectionHelper = mountFnGenerator(StatuzSelectionHelperMain)

