/**
 * Interactive FortiGate visibility picker (/fortigate devices).
 * SettingsList with per-device visible/hidden toggle. Persists to
 * ~/.pi/agent/fortigate.state.json via setDeviceHidden. Hidden devices are
 * invisible to the AI (not listed, not resolvable) — no fortigate.json edits.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@earendil-works/pi-tui";
import { listAllDevices, setDeviceHidden } from "./config.js";

export async function showDevicePicker(ctx: ExtensionContext): Promise<void> {
	const devices = listAllDevices();
	if (devices.length === 0) {
		ctx.ui.notify(
			"No FortiGate devices configured. Edit ~/.pi/agent/fortigate.json first.",
			"warn",
		);
		return;
	}

	const items: SettingItem[] = devices.map((d) => ({
		id: d.name,
		label: d.name,
		description: d.url,
		currentValue: d.hidden ? "hidden" : "visible",
		values: ["visible", "hidden"],
	}));

	await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(
			new Text(theme.fg("accent", theme.bold("FortiGate device visibility")), 1, 1),
		);
		container.addChild(
			new Text(
				theme.fg("muted", "Hidden devices are invisible to the AI (not listed, not usable)."),
				1,
				0,
			),
		);

		const list = new SettingsList(
			items,
			Math.min(items.length + 2, 15),
			getSettingsListTheme(),
			(id, newValue) => {
				setDeviceHidden(id, newValue === "hidden");
			},
			() => done(undefined),
			{ enableSearch: true },
		);
		container.addChild(list);
		container.addChild(
			new Text(
				theme.fg("dim", "↑↓ move • enter/space toggle • / search • esc close"),
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

	const after = listAllDevices();
	const visible = after.filter((d) => !d.hidden).map((d) => d.name);
	ctx.ui.notify(
		visible.length
			? `FortiGate visible: [${visible.join(", ")}]`
			: "All FortiGate devices hidden.",
		"info",
	);
}
