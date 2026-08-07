/**
 * Ambient type declarations for @earendil-works/pi-coding-agent (optional peer dep).
 */

declare module "@earendil-works/pi-coding-agent" {
	export interface UISelectOption {
		label: string;
		description?: string;
	}

	export interface UIInputOptions {
		placeholder?: string;
		validate?: (value: string) => string | undefined;
	}

	export interface UICustomComponent {
		render(width: number): string[];
		invalidate?(): void;
		handleInput?(data: string): void;
	}

	export interface UI {
		notify(
			message: string,
			type?: "info" | "warn" | "warning" | "error" | "success",
		): void;
		setStatus(key: string, status: string | undefined): void;
		select(title: string, options: string[]): Promise<string | undefined>;
		select<T extends UISelectOption>(
			label: string,
			options: T[],
		): Promise<T | undefined>;
		confirm(title: string, message: string): Promise<boolean>;
		input(
			title: string,
			placeholder?: string,
		): Promise<string | undefined>;
		input(label: string, options?: UIInputOptions): Promise<string | undefined>;
		custom<T>(
			fn: (
				tui: { requestRender(): void },
				theme: any,
				keybindings: any,
				done: (value: T) => void,
			) => UICustomComponent,
		): Promise<T>;
	}

	export type ExtensionMode = "tui" | "rpc" | "json" | "print";

	export interface ExtensionContext {
		cwd: string;
		hasUI: boolean;
		mode?: ExtensionMode;
		ui: UI;
	}

	export interface ToolParameter {
		name: string;
		label: string;
		description: string;
		promptSnippet?: string;
		promptGuidelines?: string[];
		parameters: unknown;
		execute: (
			toolCallId: string,
			params: any,
			signal: AbortSignal,
			onUpdate: (update: { content: Array<{ type: string; text: string }> }) => void,
			ctx: ExtensionContext,
		) => Promise<{ content: Array<{ type: string; text: string }>; details?: Record<string, unknown> }>;
	}

	export interface AutocompleteItem {
		value: string;
		label?: string;
		description?: string;
	}

	export interface Command {
		description: string;
		getArgumentCompletions?: (prefix: string) => AutocompleteItem[] | null;
		handler: (args: string | string[], ctx: ExtensionContext) => Promise<void> | void;
	}

	export interface ToolMeta {
		name: string;
		description?: string;
		parameters?: unknown;
		promptGuidelines?: string[];
		sourceInfo?: { path?: string; source?: string; scope?: string; origin?: string };
	}

	export interface ExtensionAPI {
		registerTool(config: ToolParameter): void;
		registerCommand(name: string, config: Command): void;
		getActiveTools(): string[];
		getAllTools(): ToolMeta[];
		setActiveTools(names: string[]): void;
		on(event: "session_start", handler: (event: unknown, ctx: ExtensionContext) => void): void;
	}

	export function getSettingsListTheme(): unknown;
}

declare module "@earendil-works/pi-tui" {
	export interface SettingItem {
		id: string;
		label: string;
		description?: string;
		currentValue: string;
		values?: string[];
	}

	export class Container {
		addChild(child: unknown): void;
		render(width: number): string[];
		invalidate(): void;
	}

	export class Text {
		constructor(text: string, paddingLeft?: number, paddingTop?: number);
	}

	/** Single-line input with Kitty printable + bracketed paste support. */
	export class Input {
		onSubmit?: (value: string) => void;
		onEscape?: () => void;
		focused: boolean;
		getValue(): string;
		setValue(value: string): void;
		handleInput(data: string): void;
		invalidate(): void;
		render(width: number): string[];
	}

	/** Visible terminal columns (ANSI/OSC stripped, wide chars counted). */
	export function visibleWidth(str: string): number;

	/** ANSI-aware truncate to max visible width (maxWidth<=0 → ""). */
	export function truncateToWidth(
		text: string,
		maxWidth: number,
		ellipsis?: string,
		pad?: boolean,
	): string;

	export class SettingsList {
		constructor(
			items: SettingItem[],
			maxVisible: number,
			theme: unknown,
			onChange: (id: string, newValue: string) => void,
			onCancel: () => void,
			options?: { enableSearch?: boolean },
		);
		handleInput(data: string): void;
		render(width: number): string[];
		invalidate(): void;
	}
}
