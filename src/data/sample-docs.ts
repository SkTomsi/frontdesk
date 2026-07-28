import type { SplitDocument } from "../services/text-splitter";

export const sampleDocuments: SplitDocument[] = [
	{
		text: `Northwind PDF Export: Open a project, click Share > Export > PDF.
Exports are limited to 200 pages on the Free plan, unlimited on Team and above.
PDF exports preserve all formatting, images, and links from your project.`,
		metadata: { source: "northwind-docs", title: "PDF Export Guide" },
	},
	{
		text: `Northwind Excel Export: Open a project, click Share > Export > Excel (XLSX).
Excel exports include all project data in a spreadsheet format.
Columns map to project fields. Free plan allows up to 500 rows, Team plan has no limit.
You can also schedule automated exports via the API.`,
		metadata: { source: "northwind-docs", title: "Excel Export Guide" },
	},
	{
		text: `Northwind Teams & Collaboration: Invite members via Settings > Team > Invite.
Roles: Owner, Admin, Member, Viewer. Owners can delete projects.
Free plan allows up to 5 members. Team plan supports unlimited members.
Real-time collaboration is available on all plans.`,
		metadata: { source: "northwind-docs", title: "Teams & Collaboration" },
	},
	{
		text: `Northwind API Access: Available on Team plan and above.
Generate API keys at Settings > API > Create Key.
Rate limits: 100 requests/minute on Team, 1000/minute on Enterprise.
Full REST API documentation is at docs.northwind.dev/api.`,
		metadata: { source: "northwind-docs", title: "API Access" },
	},
	{
		text: `Northwind Billing & Plans: Free, Team ($12/user/month), Enterprise (custom).
All plans include unlimited projects. Team adds SSO, audit logs, and priority support.
Annual billing gives 20% discount. Cancel anytime from Settings > Billing.`,
		metadata: { source: "northwind-docs", title: "Billing & Plans" },
	},
];
