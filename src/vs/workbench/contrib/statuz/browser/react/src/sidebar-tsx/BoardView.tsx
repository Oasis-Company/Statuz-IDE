/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import ErrorBoundary from './ErrorBoundary.js';

export const BoardView = () => {
	return (
		<div className="w-full h-full flex flex-col items-center justify-center p-6 text-statuz-fg-2 select-text">
			<div className="text-center max-w-xs">
				<h2 className="text-base font-semibold text-statuz-fg-1 mb-2">
					Board
				</h2>
				<p className="text-sm leading-relaxed">
					Strategy canvas &amp; project workspace — coming soon.
				</p>
				<p className="text-xs mt-4 text-statuz-fg-3">
					Sandboxer integration will appear here.
				</p>
			</div>
		</div>
	);
};

export const BoardViewWithErrorBoundary = () => {
	return (
		<ErrorBoundary>
			<BoardView />
		</ErrorBoundary>
	);
};