/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/api/types.ts
 *  Original work Copyright (c) Sandboxer authors. Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/* ─── Error Types ────────────────────────────────────────── */

export type ApiErrorType =
	| 'network'
	| 'auth'
	| 'rate-limit'
	| 'timeout'
	| 'validation'
	| 'not-found'
	| 'unknown';

export interface ApiError {
	type: ApiErrorType;
	status?: number;
	message: string;
	details?: unknown;
}

/* ─── Result Type ────────────────────────────────────────── */

export type ApiResult<T> =
	| { data: T; error: null }
	| { data: null; error: ApiError };

/* ─── Helper ─────────────────────────────────────────────── */

export function isApiError(err: unknown): err is ApiError {
	return (
		typeof err === 'object' &&
		err !== null &&
		'type' in err &&
		'message' in err
	);
}

export function createApiError(
	type: ApiErrorType,
	message: string,
	status?: number,
	details?: unknown,
): ApiError {
	return { type, message, status, details };
}