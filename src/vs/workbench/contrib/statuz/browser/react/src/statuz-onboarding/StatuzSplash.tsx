/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Statuz. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useEffect, useRef, useState } from 'react';
import { useIsDark } from '../util/services.js';

// ─── Inline Statuz logo ────────────────────────────────────────

const StatuzLogo = ({ isDark }: { isDark: boolean }) => {
	const strokeColor = isDark ? '#FFFFFF' : '#000000';

	return (
		<svg viewBox="0 0 256 256" fill="none" className="w-full h-full">
			<line x1="40" y1="184" x2="144" y2="168" stroke={strokeColor} strokeWidth="8" strokeLinecap="round" />
			<line x1="144" y1="168" x2="112" y2="72" stroke={strokeColor} strokeWidth="8" strokeLinecap="round" />
			<line x1="112" y1="72" x2="216" y2="56" stroke={strokeColor} strokeWidth="8" strokeLinecap="round" />
			<circle cx="128" cy="120" r="12" fill={strokeColor} />
		</svg>
	);
};

// ─── Splash screen ─────────────────────────────────────────────

type SplashPhase = 'logo-in' | 'tagline-in' | 'hold' | 'fade-out' | 'done';

const PHASE_DURATIONS: Record<SplashPhase, number> = {
	'logo-in': 1000,       // Statuz logo fades in
	'tagline-in': 800,     // "Powered by Statuz" fades in below
	'hold': 1800,          // Both visible
	'fade-out': 800,       // Everything fades out
	'done': 0,
};

interface StatuzSplashProps {
	onComplete: () => void;
}

export const StatuzSplash = ({ onComplete }: StatuzSplashProps) => {
	const isDark = useIsDark();
	const [phase, setPhase] = useState<SplashPhase>('logo-in');
	const phaseRef = useRef<SplashPhase>('logo-in');

	const advancePhase = () => {
		const current = phaseRef.current;
		const phases: SplashPhase[] = ['logo-in', 'tagline-in', 'hold', 'fade-out', 'done'];
		const idx = phases.indexOf(current);
		if (idx < phases.length - 1) {
			const next = phases[idx + 1];
			phaseRef.current = next;
			setPhase(next);
		}
	};

	useEffect(() => {
		const currentDuration = PHASE_DURATIONS[phase];
		if (phase === 'done') {
			onComplete();
			return;
		}
		const timer = setTimeout(advancePhase, currentDuration);
		return () => clearTimeout(timer);
	}, [phase, onComplete]);

	const logoOpacity = phase === 'logo-in' ? 0.1
		: phase === 'tagline-in' ? 1
			: phase === 'hold' ? 1
				: phase === 'fade-out' ? 1
					: 0;

	const taglineOpacity = phase === 'logo-in' ? 0
		: phase === 'tagline-in' ? 0
			: phase === 'hold' ? 0.6
				: phase === 'fade-out' ? 0.6
					: 0;

	const containerOpacity = phase === 'fade-out' ? 0 : 1;

	return (
		<div
			className={`@@statuz-scope ${isDark ? 'dark' : ''}`}
			style={{
				position: 'fixed',
				top: 0,
				right: 0,
				bottom: 0,
				left: 0,
				zIndex: 999999,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				background: isDark ? '#1E1E1E' : '#FFFFFF',
				opacity: containerOpacity,
				transition: 'opacity 800ms ease-in-out',
			}}
		>
			{/* Statuz logo */}
			<div
				style={{
					width: 120,
					height: 120,
					opacity: logoOpacity,
					transition: 'opacity 1000ms ease-in-out',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 8,
				}}
			>
				<div style={{ width: 80, height: 80 }}>
					<StatuzLogo isDark={isDark} />
				</div>
				<span
					style={{
						fontSize: 16,
						fontWeight: 600,
						letterSpacing: '0.08em',
						color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
					}}
				>
					Statuz IDE
				</span>
			</div>

			{/* Powered by Statuz */}
			<div
				style={{
					opacity: taglineOpacity,
					transition: 'opacity 800ms ease-in-out',
					marginTop: 24,
					display: 'flex',
					alignItems: 'center',
					gap: 6,
				}}
			>
				<span
					style={{
						fontSize: 12,
						fontWeight: 400,
						letterSpacing: '0.12em',
						textTransform: 'uppercase',
						color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
					}}
				>
					Powered by
				</span>
				<span
					style={{
						fontSize: 12,
						fontWeight: 500,
						letterSpacing: '0.12em',
						textTransform: 'uppercase',
						color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
					}}
				>
					Statuz
				</span>
			</div>
		</div>
	);
};