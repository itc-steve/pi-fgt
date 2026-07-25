/**
 * Interactive FortiGate device selector (/fortigate).
 * SettingsList with a per-device off/on toggle. SESSION-LOCAL and in-memory:
 * nothing is written to disk, other pi terminals are unaffected, and every
 * session starts with all devices off. "off" = hidden from the AI (not listed,
 * not resolvable) — the human always sees the full list here.
 *
 * Returns the device names selected when the picker closed.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@earendil-works/pi-tui";
import { listAllDevices, setDeviceEnabled } from "./config.js";

export async function showDevicePicker(ctx: ExtensionContext): Promise<string[]> {
	const devices = listAllDevices();
	if (devices.length === 0) {
		ctx.ui.notify(
			"No FortiGate devices configured. Edit ~/.pi/agent/fortigate.json first.",
			"warn",
		);
		return [];
	}

	const items: SettingItem[] = devices.map((d) => ({
		id: d.name,
		label: d.name,
		description: d.url,
		currentValue: d.enabled ? "on" : "off",
		values: ["off", "on"],
	}));

	await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(
			new Text(theme.fg("accent", theme.bold("Select FortiGates for this session")), 1, 1),
		);
		container.addChild(
			new Text(
				theme.fg(
					"muted",
					"Only devices set to 'on' are visible to the AI. This session only — never saved.",
				),
				1,
				0,
			),
		);

		const list = new SettingsList(
			items,
			Math.min(items.length + 2, 15),
			getSettingsListTheme(),
			(id, newValue) => {
				setDeviceEnabled(id, newValue === "on");
			},
			() => done(undefined),
			{ enableSearch: true },
		);
		container.addChild(list);
		container.addChild(
			new Text(
				theme.fg("dim", "↑↓ move • enter/space toggle • / search • esc done"),
				1,
				0,
			),
		);

		return {
			render: (w) => container.render(w),
			invalidate: () => container.invalidate(),
			handleInput: (data) => {
				list.handleInput(data);
				_tui.requestRender();
			},
		};
	});

	return listAllDevices()
		.filter((d) => d.enabled)
		.map((d) => d.name);
}
