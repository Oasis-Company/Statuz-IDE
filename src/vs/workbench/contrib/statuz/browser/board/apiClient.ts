/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0.
 *  Ported from Sandboxer src/lib/api/client.ts
 *  Adapted: Supabase removed; kept classifyError, guardAsync, guardSync
 *--------------------------------------------------------------------------------------------*/

import type { ApiError, ApiResult } from './apiTypes.js';
import { createApiError, isApiError } from './apiTypes.js';

/* ─── Error Classification ───────────────────────────────── */

export function classifyError(err: unknown, context?: string): ApiError {
	if (isApiError(err)) return err;

	if (
		err instanceof TypeError &&
		(err.message.toLowerCase().includes('network') ||
			err.message.toLowerCase().includes('fetch'))
	) {
		return createApiError(
			'network',
			`Network error${context ? ` (${context})` : ''}`,
		);
	}

	if (err instanceof DOMException && err.name === 'TimeoutError') {
		return createApiError(
			'timeout',
			`Request timed out${context ? ` (${context})` : ''}`,
		);
	}

	if (err && typeof err === 'object') {
		const e = err as Record<string, unknown>;
		const status = (e.status ?? e.code) as number | undefined;
		const message =
			(e.message as string) ??
			(e.error_description as string) ??
			'Unknown error';

		if (status === 401 || status === 403 || /jwt|auth|unauthorized/i.test(message)) {
			return createApiError('auth', message, status, e);
		}
		if (status === 429 || /rate|too many|limit/i.test(message)) {
			return createApiError('rate-limit', message, status, e);
		}
		if (status === 404 || e.code === 'PGRST116') {
			return createApiError('not-found', message, status, e);
		}
		if (status === 400 || status === 422 || e.code === '23505') {
			return createApiError('validation', message, status, e);
		}
		if (status) {
			return createApiError('unknown', message, status, e);
		}
	}

	return createApiError(
		'unknown',
		err instanceof Error ? err.message : String(err),
	);
}

/* ─── Guards ─────────────────────────────────────────────── */

export async function guardAsync<T>(
	fn: () => Promise<T>,
	context?: string,
): Promise<ApiResult<T>> {
	try {
		const data = await fn();
		return { data, error: null };
	} catch (err) {
		const error = classifyError(err, context);
		return { data: null, error };
	}
}

export function guardSync<T>(
	fn: () => T,
	context?: string,
): ApiResult<T> {
	try {
		const data = fn();
		return { data, error: null };
	} catch (err) {
		const error = classifyError(err, context);
		return { data: null, error };
	}
}