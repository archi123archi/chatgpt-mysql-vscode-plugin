import { Configuration, OpenAIApi } from 'openai';
import * as vscode from 'vscode';
import * as mysql from 'mysql2/promise';
import { PoolConnection, Connection, createPool, FieldPacket, Pool } from 'mysql2/promise';

const chatgptSqlConfig = vscode.workspace.getConfiguration("chatgpt-sql");
const ghost = chatgptSqlConfig.get("mysql.host") as string;
const gport = chatgptSqlConfig.get("mysql.port") as number;
const guser = chatgptSqlConfig.get("mysql.user") as string;
const gpassword = chatgptSqlConfig.get("mysql.password") as string;
const gdbName = chatgptSqlConfig.get("mysql.database") as string;
const gdbTable = 'chatgpt_table';
const gdbTablePrompt = 'prompt';
const gdbTableAnswer = 'answer';

let gdbReady: number = 0;

const poolInit = mysql.createPool({
    host: ghost,
    port: gport,
    user: guser,
    password: gpassword,
});

const pool = mysql.createPool({
    host: ghost,
    port: gport,
    user: guser,
    password: gpassword,
    database: gdbName,
});

let myOutputChannel = vscode.window.createOutputChannel('Debug Channel');
myOutputChannel.show(true);

export async function checkDatabaseAndTable() {
    const conn = await poolInit.getConnection();
    const createDbQuery = `CREATE DATABASE IF NOT EXISTS ${gdbName};`;

    try {
        const result = await conn.query(createDbQuery);
    } catch (err) {
        myOutputChannel.appendLine("create database fail");
        throw err;
    }

    const useDbQuery = `USE ${gdbName};`;
    try {
        const result = await conn.query(useDbQuery);
    } catch (err) {
        throw err;
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${gdbTable} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ${gdbTablePrompt} TEXT,
        ${gdbTableAnswer} TEXT
      );`;
    try {
        const result = await conn.query(createTableQuery);
    } catch (err) {
        throw err;
    }
    conn.release();
}

(async () => {
    try {
        await checkDatabaseAndTable();
        gdbReady = 1;
    } catch (error) {
        console.error(error);
        gdbReady = 0;
    } finally {
        poolInit.end();
    }
})();


export async function insertText(inputText: String, outputText: String) {
    const config = vscode.workspace.getConfiguration("chatgpt-sql");
    const writeEnable = config.get("mysql.writeEnable") as boolean;
    if (!writeEnable)
        return;
    if (!gdbReady)
        return;
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
      
        const sql = `INSERT INTO ${gdbTable} (${gdbTablePrompt}, ${gdbTableAnswer}) VALUES (?, ?)`;
        const [results, fields]: [unknown, FieldPacket[]] = await conn.query(sql, [inputText, outputText]);
      
      } catch (err) {
        console.error(err);
      } finally {
        if (conn) {
          conn.release();
        }
      }
}

export async function queryText(inputText: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('chatgpt-sql');
    const readEnable = config.get('mysql.readEnable') as boolean;
    if (!readEnable) {
      return '';
    }
    if (!gdbReady) {
      return '';
    }
  
    let conn: PoolConnection | undefined;
  
    try {
      conn = await pool.getConnection();
  
      const sql = `SELECT ${gdbTableAnswer} FROM ${gdbTable} WHERE ${gdbTablePrompt}='${inputText}'`;
  
    //   const [rows] = await conn.query(sql);
      const [rows] = await conn.query(sql) as Array<any>;
  
      if (rows.length === 0) {
        return '';
      } else {
        return (rows[0] as any).answer;
      }
    } catch (error) {
      throw error;
    } finally {
      if (conn) {
        conn.release();
      }
    }
  }


export default class ChatGptViewProvider implements vscode.WebviewViewProvider {
    private webView?: vscode.WebviewView;
    private openAiApi?: OpenAIApi;
    private apiKey?: string;
    private message?: any;

    constructor(private context: vscode.ExtensionContext) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this.webView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };


        webviewView.webview.onDidReceiveMessage(data => {
            if (data.type === 'askChatGPT') {
                this.sendOpenAiApiRequest(data.value);
            }
        });

        webviewView.webview.html = this.getWebviewHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'addFreeTextQuestion':
                    this.sendOpenAiApiRequest(data.value);
                    break;
                case 'editCode':
                    vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(data.value));
                    break;
                case 'openNew':
                    const document = await vscode.workspace.openTextDocument({
                        content: data.value,
                        language: data.language
                    });
                    vscode.window.showTextDocument(document);
                    break;
                // case 'clearConversation':
                // 	this.prepareConversation(true);
                // 	break;
                default:
                    break;
            }
        });

        if (this.message !== null) {
            this.sendMessageToWebView(this.message);
            this.message = null;
        }
    }

    public async ensureApiKey() {
        const chatGptExtensionConfig = vscode.workspace.getConfiguration("chatgpt-sql")
        this.apiKey = chatGptExtensionConfig.get("gpt3.apikey") as string;

        if (!this.apiKey) {
            const apiKeyInput = await vscode.window.showInputBox({
                prompt: "Please enter your OpenAI API Key, can be located at https://openai.com/account/api-keys",
                ignoreFocusOut: true,
            });
            this.apiKey = apiKeyInput!;
            await chatGptExtensionConfig.update('gpt3.apikey', this.apiKey, vscode.ConfigurationTarget.Global);
        }
    }

    public async sendOpenAiApiRequest(prompt: string, code?: string) {
        await this.ensureApiKey();

        if (!this.openAiApi) {
            try {
                const config = vscode.workspace.getConfiguration("chatgpt-sql");
                const maxtokens = config.get("gpt3.maxtokens") as number;
                const temperature = config.get("gpt3.temperature") as number;
                const top_p = config.get("gpt3.top_p") as number;
                this.apiKey = config.get("gpt3.apikey") as string;
                this.openAiApi = new OpenAIApi(new Configuration({ apiKey: this.apiKey }));
            } catch (error: any) {
                vscode.window.showErrorMessage("Failed to connect to ChatGPT", error?.message);
                return;
            }
        }

        // Create question by adding prompt prefix to code, if provided
        const question = (code) ? `${prompt}: ${code}` : prompt;

        if (!this.webView) {
            await vscode.commands.executeCommand('chatgpt-sql-vscode-plugin.view.focus');
        } else {
            this.webView?.show?.(true);
        }

        try {
            const outputText = await queryText(question);
            console.log(`Output text is: ${outputText}`);
            if (outputText !== '') {
                this.sendMessageToWebView({ type: 'addQuestion', value: prompt, code });
                this.sendMessageToWebView({ type: 'addResponse', value: outputText });
                return;
            }
        } catch (err) {
            console.error(err);
        }

        let response: String = '';

        this.sendMessageToWebView({ type: 'addQuestion', value: prompt, code });
        try {
            let currentMessageNumber = this.message;
            let completion;
            try {
                const chatGptExtensionConfig = vscode.workspace.getConfiguration("chatgpt-sql")
                const modelName = chatGptExtensionConfig.get("gpt3.model") as string;
                const maxtokens = chatGptExtensionConfig.get("gpt3.maxtokens") as number;
                const temperature = chatGptExtensionConfig.get("gpt3.temperature") as number;
                const top_p = chatGptExtensionConfig.get("gpt3.top_p") as number;

                completion = await this.openAiApi.createChatCompletion({
                    model: modelName,
                    max_tokens: maxtokens,
                    temperature: temperature,
                    top_p: top_p,
                    messages: [{ 'role': 'user', 'content': question }],
                });
            } catch (error: any) {
                await vscode.window.showErrorMessage("Error sending request to ChatGPT", error);
                return;
            }

            // if (this.message !== currentMessageNumber) {
            //     return;
            // }

            response = completion?.data.choices[0].message?.content || '';
            response = response.trim();

            const REGEX_CODEBLOCK = new RegExp('\`\`\`', 'g');
            const matches = response.match(REGEX_CODEBLOCK);
            const count = matches ? matches.length : 0;
            if (count % 2 !== 0) {
                response += '\n\`\`\`';
            }

            if (response !== '') {
                await insertText(question, response);
            }

            this.sendMessageToWebView({ type: 'addResponse', value: response });
        } catch (error: any) {
            await vscode.window.showErrorMessage("Error sending request to ChatGPT", error);
            return;
        }
    }

    public sendMessageToWebView(message: any) {
        if (this.webView) {
            this.webView?.webview.postMessage(message);
        } else {
            this.message = message;
        }
    }

    private getWebviewHtml(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
        const stylesMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));

        const vendorHighlightCss = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'highlight.min.css'));
        const vendorHighlightJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'highlight.min.js'));
        const vendorMarkedJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'marked.min.js'));
        const vendorTailwindJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'tailwindcss.3.2.4.min.js'));
        const vendorTurndownJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'turndown.js'));

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${stylesMainUri}" rel="stylesheet">
				<link href="${vendorHighlightCss}" rel="stylesheet">
				<script src="${vendorHighlightJs}"></script>
				<script src="${vendorMarkedJs}"></script>
				<script src="${vendorTailwindJs}"></script>
				<script src="${vendorTurndownJs}"></script>
			</head>
			<body class="overflow-hidden">
				<div class="flex flex-col h-screen">
					<div id="introduction" class="flex h-full items-center justify-center px-6 w-full relative">
						<div class="flex items-start text-center gap-3.5">
							<div class="flex flex-col gap-3.5 flex-1">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" class="w-6 h-6 m-auto">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"></path>
								</svg>
								<h2 class="text-lg font-normal">Features</h2>
								<ul class="flex flex-col gap-3.5">
									<li class="w-full bg-gray-50 dark:bg-white/5 p-3 rounded-md">Optimized for dialogue</li>
									<li class="w-full bg-gray-50 dark:bg-white/5 p-3 rounded-md">Improve your code, add tests & find bugs</li>
									<li class="w-full bg-gray-50 dark:bg-white/5 p-3 rounded-md">Copy or create new files automatically</li>
									<li class="w-full bg-gray-50 dark:bg-white/5 p-3 rounded-md">Syntax highlighting with auto language detection</li>
								</ul>
							</div>
							<div class="flex flex-col gap-3.5 flex-1">
								<svg stroke="currentColor" fill="none" stroke-width="1.5" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 m-auto" height="1em" width="1em"
									xmlns="http://www.w3.org/2000/svg">
									<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
									<line x1="12" y1="9" x2="12" y2="13"></line>
									<line x1="12" y1="17" x2="12.01" y2="17"></line>
								</svg>
								<h2 class="text-lg font-normal">Limitations</h2>
								<ul class="flex flex-col gap-3.5">
									<li class="w-full bg-gray-50 dark:bg-white/5 p-3 rounded-md">May occasionally take long time to respond/fail</li>
									<li class="w-full bg-gray-50 dark:bg-white/5 p-3 rounded-md">May throw HTTP 429, if you make too many requests</li>
									<li class="w-full bg-gray-50 dark:bg-white/5 p-3 rounded-md">If issues persist, clear your session and re-login</li>
								</ul>
							</div>
						</div>
						<p class="absolute bottom-0 max-w-sm text-center text-xs text-slate-500">Get your session token <a href="https://chat.openai.com">here</a>.<br /><a href="https://github.com/gencay/vscode-chatgpt">©️ Open source</a></p>
					</div>

					<div class="flex-1 overflow-y-auto" id="qa-list"></div>

					<div id="in-progress" class="pl-4 pt-2 flex items-center hidden">
						<div class="typing">Typing</div>
						<div class="spinner">
							<div class="bounce1"></div>
							<div class="bounce2"></div>
							<div class="bounce3"></div>
						</div>
					</div>

					<div id="chat-button-wrapper" class="w-full flex gap-4 justify-center items-center mt-2 hidden">
						<button class="flex gap-2 justify-center items-center rounded-lg p-2" id="clear-button">
							<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
							Clear conversation
						</button>
						<button class="flex gap-2 justify-center items-center rounded-lg p-2" id="export-button">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
							</svg>
							Export all
						</button>
					</div>

					<div class="p-4 flex items-center pt-2">
						<div class="flex-1 textarea-wrapper">
							<textarea
								type="text"
								rows="1"
								id="question-input"
								placeholder="Ask a question..."
								onInput="this.parentNode.dataset.replicatedValue = this.value"></textarea>
						</div>
						<button title="Submit prompt" class="right-8 absolute ask-button rounded-lg p-0.5 ml-5" id="ask-button">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
						</button>
					</div>
				</div>

				<script src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}