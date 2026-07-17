/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Parses YAML frontmatter from a markdown file content.
 * Supports:
 *   - Simple key: value pairs
 *   - Inline arrays: key: ["val1", "val2"]
 *   - Multi-line block arrays: key:\n  - val1\n  - val2
 *   - Quoted values: key: "value"
 *   - Boolean values: key: true / false
 */
export function parseYamlFrontmatter(content: string): Record<string, any> | null {
	// Match frontmatter block: starts with ---\n, ends with \n---\n
	const match = content.match(/^---\n([\s\S]*?)\n(?:---|\.\.\.)\n/);
	if (!match) {
		return null;
	}

	const raw = match[1];
	const lines = raw.split('\n');
	const result: Record<string, any> = {};

	let currentKey: string | null = null;
	let currentArray: string[] | null = null;

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines
		if (!trimmed) {
			continue;
		}

		// Check if this is a continuation of a block array (starts with "- ")
		if (currentKey && trimmed.startsWith('- ')) {
			currentArray!.push(trimmed.slice(2).trim());
			continue;
		}

		// Flush previous block array
		if (currentKey && currentArray !== null) {
			result[currentKey] = currentArray;
			currentArray = null;
		}

		// Try to parse as key: value
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) {
			continue;
		}

		currentKey = line.slice(0, colonIdx).trim();
		let value: string = line.slice(colonIdx + 1).trim();

		if (!value) {
			// Value is empty — might be a block array start
			currentArray = [];
			continue;
		}

		// Parse the value
		result[currentKey] = parseYamlValue(value);
		currentArray = null;
	}

	// Flush last block array
	if (currentKey && currentArray !== null) {
		result[currentKey] = currentArray;
	}

	return result;
}

/**
 * Parses a single YAML value string.
 */
function parseYamlValue(value: string): any {
	// Strip surrounding quotes
	const stripped = value.replace(/^(['"])([\s\S]*)\1$/, '$2');

	// Inline array: ["a", "b"] or ['a', 'b']
	if (stripped.startsWith('[') && stripped.endsWith(']')) {
		const inner = stripped.slice(1, -1).trim();
		if (!inner) {
			return [];
		}
		return inner.split(',').map((s: string) => {
			const item = s.trim();
			// Remove surrounding quotes from each item
			return item.replace(/^['"](.*)['"]$/, '$1');
		});
	}

	// Boolean
	if (stripped === 'true') {
		return true;
	}
	if (stripped === 'false') {
		return false;
	}

	// Return as string (strip quotes already handled)
	return stripped;
}

/**
 * Extracts the markdown body from a YAML-frontmatter document.
 */
export function extractMarkdownBody(content: string): string {
	const match = content.match(/^---\n[\s\S]*?\n(?:---|\.\.\.)\n([\s\S]*)/);
	return match ? match[1].trim() : content.trim();
}

/**
 * Extracts the frontmatter metadata as a flat record, or null if absent.
 */
export function extractFrontmatter(content: string): Record<string, any> | null {
	return parseYamlFrontmatter(content);
}