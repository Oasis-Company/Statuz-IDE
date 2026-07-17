/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export function parseYamlFrontmatter(content: string): Record<string, any> | null {
	const match = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (!match) {
		return null;
	}
	const lines = match[1].split('\n');
	const result: Record<string, any> = {};
	for (const line of lines) {
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) {
			continue;
		}
		const key = line.slice(0, colonIdx).trim();
		let value: any = line.slice(colonIdx + 1).trim();
		if (value.startsWith('[') && value.endsWith(']')) {
			value = value.slice(1, -1).split(',').map((s: string) => s.trim().replace(/['"]/g, ''));
		} else if (value === 'true') {
			value = true;
		} else if (value === 'false') {
			value = false;
		}
		result[key] = value;
	}
	return result;
}

export function extractMarkdownBody(content: string): string {
	const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
	return match ? match[1].trim() : content.trim();
}