/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *
 *  Database type definitions — shared with Insane-Dream-Builder (ISDB).
 *  Only the types needed for MVP are included. Full types are in the ISDB project.
 *--------------------------------------------------------------------------------------*/

/* ─── User Profile ───────────────────────────────────────── */

export interface Profile {
	id: string; // UUID, matches auth.users.id
	username: string | null;
	full_name: string | null;
	avatar_url: string | null;
	bio: string | null;
	skills: string[] | null;
	identity_number: string | null;
	created_at: string;
	updated_at: string;
	// UTM attribution (from ISDB's profiles table)
	utm_source: string | null;
	utm_medium: string | null;
	utm_campaign: string | null;
	utm_term: string | null;
	utm_content: string | null;
}

/* ─── Project ────────────────────────────────────────────── */

export interface Project {
	id: string; // UUID
	name: string;
	description: string | null;
	owner_id: string; // UUID, references profiles.id
	status: 'active' | 'archived' | 'completed';
	tags: string[] | null;
	created_at: string;
	updated_at: string;
}

/* ─── Project Block (Board Data container) ───────────────── */

export interface ProjectBlock {
	id: string; // UUID
	project_id: string; // UUID, references projects.id
	type: string; // 'board' | 'markdown' | 'timeline' | ...
	config: Record<string, unknown>; // JSON — stores board nodes/edges/viewport
	position: number; // Order within the project
	title: string | null;
	created_at: string;
	updated_at: string;
}

/* ─── Board Sync Data ────────────────────────────────────── */

export interface BoardSyncData {
	nodes: Array<{ id: string; type: string; position: { x: number; y: number } }>;
	edges: Array<{ id: string; source: string; target: string; type: string }>;
	viewport: { x: number; y: number; zoom: number };
	lastModified: string; // ISO 8601 timestamp
	version: number;
}