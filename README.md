# ChatGPT With MySQL Cache VSCode Extension

This is a Visual Studio Code extension for ChatGPT with MySQL cache. If hit in mysql database, it will return the result from the database, otherwise return the result from ChatGPT.

## Usage

To use the extension:
**This extension uses the official OpenAI library**

After you install the ChatGPTMySQL plug in, you should reload the window. ctrl + p, then input reload

Open the settings[Ctrl + ,] and search for "chatgptsql", configure the corresponding options according to the prompts. 

You should config the API key get from OpenAI: https://openai.com/account/api-keys, 

If you want to cache ChatGPT records(input/output) in MySQL, you need to configure the relevant options for the MySQL database: host, user, and password.

Then you can use it, just select some code then right click, then select the "ChatGPTMySQL" menu, then select the sub command.

*Once you're authenticated, you can ask ChatGPT any question and supply source code from your current file/selection.*

## Install the plugin from this [Github repository](https://github.com/gaojian80422/chatgpt-mysql-vscode-plugin)
#### Commands:
- `yarn setup` (installs project dependencies)
- `yarn compile` (generates js files)
- `yarn vscode:package` (creates vscode installer package)
- `yarn vscode:install` (installs vscode package)

## Features
#### Commands:
- `ChatGPTMySQL: Summarize`
- `ChatGPTMySQL: Explain`
- `ChatGPTMySQL: Optimize`
- `ChatGPTMySQL: Find problems`
- `ChatGPTMySQL: Why is it broken?`
- `ChatGPTMySQL: Refactor`
- `ChatGPTMySQL: Add tests`
- `ChatGPTMySQL: Add comments`
- `ChatGPTMySQL: Complete codes`
- `ChatGPTMySQL: Ad-hoc prompt` user custom prompt

*Everything are available from the context menu when right-clicking in the editor.*


## Support
If you need help using this extension, please open an issue on the GitHub repository for this extension.

## Credits
- [barnesoir's chatgpt-vscode-plugin](https://https://github.com/barnesoir/chatgpt-vscode-plugin) - A VS code plugin for ChatGPT built by ChatGPT
- [ChatGPT](https://chat.openai.com/chat) - The large language model trained by OpenAI that was used to generate this README file
- [chatgpt-api](https://github.com/transitive-bullshit/chatgpt-api/) - The original NPM used prior to the offical library
- [mpociot's extension](https://github.com/mpociot/chatgpt-vscode) - Inspiration for the project and the original webview panel
- [Gencay's extension](https://github.com/gencay/vscode-chatgpt) - Ported version of Gencay's webview panel.
- [Yeoman](https://yeoman.io/) - The code generator used to scaffold the extension project
- [VS Code Extension Generator](https://github.com/Microsoft/vscode-generator-code) - The Yeoman generator for creating VS Code extensions
