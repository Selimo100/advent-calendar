/**
 * npm run content:validate -- [--source private|example|<dir>] [--strict]
 * Validates the schema and prints a readiness report (no content text).
 * --strict exits non-zero unless every door and the settings are ready.
 */
import '../tools/cli.ts';
import { formatReport, validateCalendar } from '../tools/content/readiness.ts';
import { loadContent, parseArgs, resolveContentSource } from '../tools/content/source.ts';

const args = parseArgs(process.argv.slice(2));
const source = resolveContentSource(String(args.source ?? 'private'));
const report = validateCalendar(await loadContent(source), source.mediaDir);
console.log(formatReport(report, source.label));
const allReady = report.valid && report.settingsProblems.length === 0 && report.doors.every((d) => d.ready);
if (!report.valid || (args.strict && !allReady)) process.exit(1);
