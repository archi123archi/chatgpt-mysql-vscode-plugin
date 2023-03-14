import * as vscode from 'vscode';
import ChatGptViewProvider from './chatgpt-view-provider';

export async function activate(context: vscode.ExtensionContext) {
	const chatViewProvider = new ChatGptViewProvider(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.chatgptsql.explainPls', askGPTToExplain),
		
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.askGPT', askChatGPT),
		// vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.summarize', askGPTSummarize),
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.explainPls', askGPTToExplain),
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.optimize', askGPTToOptimize),
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.findProblems', askGPTToFindProblems),
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.whyBroken', askGPTWhyBroken),
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.refactor', askGPTToRefactor),
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.addTests', askGPTToAddTests),
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.addComments', askGPTToAddComments),
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.completeCods', askGPTToCompleteCods),
		vscode.commands.registerCommand('chatgpt-sql-vscode-plugin.adhocPrompt', askGPTToAdhocPrompt),
		vscode.window.registerWebviewViewProvider("chatgpt-sql-vscode-plugin.view", chatViewProvider, {
			webviewOptions: { retainContextWhenHidden: true }
		})
	);

	const chatGptExtensionConfig = vscode.workspace.getConfiguration("chatgpt-sql");

	async function askGPTSummarize() { await askChatGPT(chatGptExtensionConfig.get('promptPrefix.summarize')); }
	async function askGPTToExplain() { await askChatGPT(chatGptExtensionConfig.get('promptPrefix.explain')); }
	async function askGPTToOptimize() { await askChatGPT(chatGptExtensionConfig.get('promptPrefix.optimize')); }
	async function askGPTToFindProblems() { await askChatGPT(chatGptExtensionConfig.get('promptPrefix.findProblems')); }
	async function askGPTWhyBroken() { await askChatGPT(chatGptExtensionConfig.get('promptPrefix.whyBroken')); }
	async function askGPTToRefactor() { await askChatGPT(chatGptExtensionConfig.get('promptPrefix.refactor')); }
	async function askGPTToAddTests() { await askChatGPT(chatGptExtensionConfig.get("promptPrefix.addTests")); }
	async function askGPTToAddComments() { await askChatGPT(chatGptExtensionConfig.get("promptPrefix.addComments")); }
	async function askGPTToCompleteCods() { await askChatGPT(chatGptExtensionConfig.get("promptPrefix.completeCods")); }
	async function askGPTToAdhocPrompt() {
		let userInput = await vscode.window.showInputBox({ prompt: "Custom prompt" }) || "";
		await askChatGPT(`${userInput}: `);
	}

	async function askChatGPT(userInput?: string) {
		if (!userInput) {
			userInput = await vscode.window.showInputBox({ prompt: "Ask ChatGPT a question" }) || "";
		}

		let editor = vscode.window.activeTextEditor;

		if (editor) {
			const selectedCode = editor.document.getText(vscode.window.activeTextEditor?.selection);
			if (selectedCode === '')
				return;

			chatViewProvider.sendOpenAiApiRequest(userInput, selectedCode);
		}
	}
}