/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
// Normally you'd want to put these exports in the files that register them, but if you do that you'll get an import order error if you import them in certain cases.
// (importing them runs the whole file to get the ID, causing an import error). I guess it's best practice to separate out IDs, pretty annoying...

export const STATUZ_CTRL_L_ACTION_ID = 'statuz.ctrlLAction'

export const STATUZ_CTRL_K_ACTION_ID = 'statuz.ctrlKAction'

export const STATUZ_ACCEPT_DIFF_ACTION_ID = 'statuz.acceptDiff'

export const STATUZ_REJECT_DIFF_ACTION_ID = 'statuz.rejectDiff'

export const STATUZ_GOTO_NEXT_DIFF_ACTION_ID = 'statuz.goToNextDiff'

export const STATUZ_GOTO_PREV_DIFF_ACTION_ID = 'statuz.goToPrevDiff'

export const STATUZ_GOTO_NEXT_URI_ACTION_ID = 'statuz.goToNextUri'

export const STATUZ_GOTO_PREV_URI_ACTION_ID = 'statuz.goToPrevUri'

export const STATUZ_ACCEPT_FILE_ACTION_ID = 'statuz.acceptFile'

export const STATUZ_REJECT_FILE_ACTION_ID = 'statuz.rejectFile'

export const STATUZ_ACCEPT_ALL_DIFFS_ACTION_ID = 'statuz.acceptAllDiffs'

export const STATUZ_REJECT_ALL_DIFFS_ACTION_ID = 'statuz.rejectAllDiffs'
