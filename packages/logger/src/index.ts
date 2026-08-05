import { type Logger, pino } from "pino";
import pinoPretty from "pino-pretty";

const c = {
	reset: "\x1b[0m",
	white: "\x1b[37m",
	green: "\x1b[32m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	red: "\x1b[31m",
	orange: "\x1b[38;5;214m",
	purple: "\x1b[38;5;141m",
	teal: "\x1b[38;5;43m",
	pink: "\x1b[38;5;213m",
	lime: "\x1b[38;5;154m",
	lightBlue: "\x1b[38;5;117m",
} as const;

const moduleColor: Record<string, string> = {
	app: c.green,
	api: c.magenta,
	worker: c.teal,
	ingest: c.purple,
	ai: c.pink,
	error: c.red,
};

const levelLabel: Record<string, string> = {
	10: "TRACE",
	20: "DEBUG",
	30: "INFO",
	40: "WARN",
	50: "ERROR",
	60: "FATAL",
};

const FALLBACK_COLORS = [c.white, c.cyan, c.lime, c.yellow];

const fallbackCache: Record<string, string> = {};
let fallbackIndex = 0;

function getModuleColor(ctx: string): string {
	if (moduleColor[ctx]) return moduleColor[ctx];
	if (!fallbackCache[ctx]) {
		fallbackCache[ctx] =
			FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length]!;
		fallbackIndex++;
	}
	return fallbackCache[ctx];
}

const PRETTY_STREAM = pinoPretty({
	colorize: true,
	translateTime: "HH:MM:ss",
	ignore: "pid,hostname,context,duration,durationMs,level",
	messageFormat: (log, messageKey) => {
		const msg = (log[messageKey] as string | undefined) ?? "";
		const ctx = (log.context as string | undefined) ?? "app";
		const dur =
			(log.durationMs as number | undefined) ??
			(log.duration as number | undefined);
		const lvl = log.level as number;

		const label = levelLabel[String(lvl)] ?? "INFO";
		const isError = lvl >= 50;
		const isWarn = lvl >= 40;
		const color = isError ? c.red : isWarn ? c.orange : getModuleColor(ctx);

		const prefix = `${color}FRONTDESK::${ctx.toUpperCase()}::[${label}]${c.reset}`;
		const duration = dur != null ? ` ${color}+${dur}ms${c.reset}` : "";

		return `${prefix} ${msg}${duration}`;
	},
});

export function createLogger(name: string): Logger {
	const options = {
		level: process.env.LOG_LEVEL ?? "info",
		base: { context: name },
	};

	if (process.env.NODE_ENV === "production") {
		return pino(options);
	}

	return pino(options, PRETTY_STREAM);
}

export type { Logger };
