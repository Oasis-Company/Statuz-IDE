/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { StatuzDocument, StatuzCheckpoint, StatuzIdentity, StatuzCurrentState, StatuzProgress, StatuzRelations, StatuzRules } from './statuzTypes.js';

// ─── Display Models ────────────────────────────────────────────

export interface IdentityCard {
	agentName: string;
	projectName: string;
	organization: string;
	environment: string;
	roleName: string;
}

export interface StateCard {
	stage: string;
	stageLabel: string;
	task: string;
	status: string;
	statusLabel: string;
	statusColor: string;
	statusIcon: string;
	lastCheckpoint: string;
	nextAction: string;
}

export interface ProgressCard {
	completedCount: number;
	completedItems: string[];
	blockedCount: number;
	blockedItems: string[];
	openQuestionsCount: number;
	openQuestions: string[];
	totalItems: number;
	percentComplete: number;
}

export interface CheckpointTimelineItem {
	id: string;
	time: string;
	timeFormatted: string;
	summary: string;
	decision?: string;
	nextAction?: string;
	isLatest: boolean;
}

export interface RelationsCard {
	agents: string[];
	projects: string[];
	files: string[];
	tools: string[];
	hasAny: boolean;
}

export interface RulesCard {
	shoulds: string[];
	shouldNots: string[];
	hasAny: boolean;
}

export interface DashboardViewModel {
	identity: IdentityCard;
	state: StateCard;
	progress: ProgressCard;
	checkpoints: CheckpointTimelineItem[];
	relations: RelationsCard;
	rules: RulesCard;
	updatedAt: string;
	filePath: string;
}

// ─── Status Mappings ───────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
	idle:              { label: 'Idle',              color: 'var(--vscode-descriptionForeground)', icon: 'circle-large-outline' },
	in_progress:       { label: 'In Progress',       color: 'var(--vscode-charts-blue)',           icon: 'sync' },
	blocked:           { label: 'Blocked',            color: 'var(--vscode-errorForeground)',       icon: 'error' },
	waiting_for_user:  { label: 'Waiting for User',  color: 'var(--vscode-charts-yellow)',         icon: 'person' },
	waiting_for_tool:  { label: 'Waiting for Tool',  color: 'var(--vscode-charts-yellow)',         icon: 'tools' },
	completed:         { label: 'Completed',          color: 'var(--vscode-charts-green)',          icon: 'pass-filled' },
	paused:            { label: 'Paused',             color: 'var(--vscode-charts-orange)',         icon: 'debug-pause' },
	failed:            { label: 'Failed',             color: 'var(--vscode-errorForeground)',       icon: 'warning' },
};

const STAGE_LABELS: Record<string, string> = {
	planning: 'Planning',
	implementation: 'Implementation',
	testing: 'Testing',
	review: 'Review',
	release: 'Release',
	prime: 'Prime',
	drafting: 'Drafting',
	reflection: 'Reflection',
	revision: 'Revision',
	scoping: 'Scoping',
	searching: 'Searching',
	reading: 'Reading',
	synthesizing: 'Synthesizing',
	writing: 'Writing',
	triage: 'Triage',
	investigation: 'Investigation',
	resolution: 'Resolution',
	followup: 'Follow-up',
};

const FALLBACK_STATUS = { label: 'Unknown', color: 'var(--vscode-descriptionForeground)', icon: 'question' };

function getStatusConfig(status: string) {
	return STATUS_CONFIG[status] || { ...FALLBACK_STATUS, label: status };
}

function getStageLabel(stage: string | undefined): string {
	if (!stage) return '\u2014';
	return STAGE_LABELS[stage] || stage;
}

function formatTime(iso: string | undefined): string {
	if (!iso) return '\u2014';
	try {
		const d = new Date(iso);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
			d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
	} catch {
		return iso;
	}
}

function formatRelativeTime(iso: string | undefined): string {
	if (!iso) return '\u2014';
	try {
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `${diffHr}h ago`;
		const diffDay = Math.floor(diffHr / 24);
		if (diffDay < 7) return `${diffDay}d ago`;
		return formatTime(iso);
	} catch {
		return iso;
	}
}

// ─── Transform ─────────────────────────────────────────────────

export function buildDashboardViewModel(
	document: StatuzDocument,
	filePath: string = '',
): DashboardViewModel {
	const identity = buildIdentityCard(document.identity, document.role);
	const state = buildStateCard(document.current_state);
	const progress = buildProgressCard(document.progress);
	const checkpoints = buildCheckpointTimeline(document.checkpoints || []);
	const relations = buildRelationsCard(document.relations);
	const rules = buildRulesCard(document.rules);

	return {
		identity,
		state,
		progress,
		checkpoints,
		relations,
		rules,
		updatedAt: document.updated_at || '',
		filePath,
	};
}

function buildIdentityCard(identity: StatuzIdentity, role?: { name?: string }): IdentityCard {
	return {
		agentName: identity.agent_name || 'Unknown',
		projectName: identity.project_name || 'Unknown',
		organization: identity.organization || '\u2014',
		environment: identity.environment || '\u2014',
		roleName: role?.name || '\u2014',
	};
}

function buildStateCard(state: StatuzCurrentState): StateCard {
	const statusConfig = getStatusConfig(state.status);
	return {
		stage: state.stage || '\u2014',
		stageLabel: getStageLabel(state.stage),
		task: state.task || '\u2014',
		status: state.status,
		statusLabel: statusConfig.label,
		statusColor: statusConfig.color,
		statusIcon: statusConfig.icon,
		lastCheckpoint: state.last_checkpoint || '\u2014',
		nextAction: state.next_action || '\u2014',
	};
}

function buildProgressCard(progress?: StatuzProgress): ProgressCard {
	const completed = progress?.completed || [];
	const blocked = progress?.blocked_by || [];
	const questions = progress?.open_questions || [];
	const total = completed.length + blocked.length + questions.length;

	return {
		completedCount: completed.length,
		completedItems: completed,
		blockedCount: blocked.length,
		blockedItems: blocked,
		openQuestionsCount: questions.length,
		openQuestions: questions,
		totalItems: total,
		percentComplete: total > 0 ? Math.round((completed.length / total) * 100) : 0,
	};
}

function buildCheckpointTimeline(checkpoints: StatuzCheckpoint[]): CheckpointTimelineItem[] {
	if (checkpoints.length === 0) return [];

	// Sort by time descending (newest first)
	const sorted = [...checkpoints].sort((a, b) => {
		return new Date(b.at).getTime() - new Date(a.at).getTime();
	});

	return sorted.map((cp, index) => ({
		id: cp.id,
		time: cp.at,
		timeFormatted: formatRelativeTime(cp.at),
		summary: cp.summary,
		decision: cp.decision,
		nextAction: cp.next_action,
		isLatest: index === 0,
	}));
}

function buildRelationsCard(relations?: StatuzRelations): RelationsCard {
	const agents = relations?.related_agents || [];
	const projects = relations?.related_projects || [];
	const files = relations?.related_files || [];
	const tools = relations?.related_tools || [];

	return {
		agents,
		projects,
		files,
		tools,
		hasAny: agents.length > 0 || projects.length > 0 || files.length > 0 || tools.length > 0,
	};
}

function buildRulesCard(rules?: StatuzRules): RulesCard {
	const shoulds = rules?.should || [];
	const shouldNots = rules?.should_not || [];

	return {
		shoulds,
		shouldNots: shouldNots,
		hasAny: shoulds.length > 0 || shouldNots.length > 0,
	};
}