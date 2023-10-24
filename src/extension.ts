import { newCompleteInlineTasksCommandFromVSCodeCommand } from 'commands/completeInlineTasks'
import { TaskExpressionCompletionItemProvider } from 'context/language-features/completionItemProvider'
import { TaskCodeLensProvider } from 'context/language-features/codeLensProvider'
import { TaskSemanticTokensProvider } from 'context/language-features/semanticTokensProvider'
import { SessionContext } from 'session'
import * as vscode from 'vscode'
import { TaskController } from 'notebook/taskController'
import { TaskSerializer } from 'notebook/taskSerializer'
import { newTaskNotebook } from 'commands/newTaskNotebook'

export async function activate(context: vscode.ExtensionContext) {
  console.log('activating bread extension')

  // Poor men's dependency injection
  const sessionRegistry = new Map<string, SessionContext>()

  context.subscriptions.push(new TaskController(context, sessionRegistry))

  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      'task-notebook',
      new TaskSerializer(),
      {
        transientOutputs: false,
        transientCellMetadata: {
          inputCollapsed: true,
          outputCollapsed: true,
        },
      },
    ),
  )

  // Commands also need to be defined in package.json
  context.subscriptions.unshift(
    vscode.commands.registerCommand(
      'ai-task.completeInlineTasks',
      async (taskFromSiblingExtension?: unknown) => {
        if (
          taskFromSiblingExtension !== undefined &&
          (typeof taskFromSiblingExtension !== 'string' ||
            taskFromSiblingExtension.length === 0)
        ) {
          throw new Error(
            'ai-task was invoked programmatically with a task argument without a string value',
          )
        }
        await newCompleteInlineTasksCommandFromVSCodeCommand(
          taskFromSiblingExtension,
        )
      },
      /*
       * TODO: this acctually accepts this as a third argument,
       * so bind above can be removed and this can be passed here insted
       */
    ),
  )

  context.subscriptions.unshift(
    vscode.commands.registerCommand('ai-task.newTaskNotebook', async () => {
      await newTaskNotebook()
    }),
  )

  const isTaskFile = (document: vscode.TextDocument) => {
    return document.uri.path.endsWith('.task')
  }

  context.subscriptions.unshift(
    /*
     * Not sure how to register a command on enter,
     * markdown formatter extension I believe does have this key binding and it
     * inserts - if the previous line was a list item
     */
    /*
     * vscode.commands.registerCommand(
     *   'ai-task.onEnterKey',
     *   (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) => {
     *     // Insert a line of text at the current cursor position
     *     const position = textEditor.selection.active
     *     edit.insert(position, 'You pressed the enter key!')
     *   },
     * ),
     */
    // Kickoff on @run mention
    vscode.workspace.onDidChangeTextDocument((event) => {
      /*
       * Ideally will want to make sure we are within a comment,
       * could also be multiline and bread mention can be anywhere
       */
      const isRunInLine = (document: vscode.TextDocument, line: number) => {
        const lineText = document.lineAt(line).text
        return lineText.includes('@run')
      }

      if (isTaskFile(event.document)) {
        return
      }

      if (
        event.contentChanges.length > 0 &&
        /*
         * only trigger on new line or space
         * I use starts with because some extensions might modify the text
         * before the edit, for example in typescript doc string it will add
         * another * to the new line
         */
        (event.contentChanges[0].text.startsWith('\n') ||
          event.contentChanges[0].text === ' ') &&
        // only trigger if @run is in the line
        isRunInLine(event.document, event.contentChanges[0].range.start.line)
      ) {
        console.log('triggering command trough @ run mention')
        /*
         * Previously I was undoing the enter change,
         * but it introduces additional jitter to the user experience
         */
        void newCompleteInlineTasksCommandFromVSCodeCommand()
      }
    }),
  )

  const allLanguages = await vscode.languages.getLanguages()
  const languageForFiles = allLanguages.map((language) => ({
    language,
    schema: 'file',
  }))

  /*
   * This needs to support other identifiers for tasks,
   * it seems like I should lift the configuration out of the session,
   * and make it a global configuration. Register task expression language
   * providers
   * The closest matching example I have found so far https://github.com/microsoft/vscode/blob/ba36ae4dcca57ba64a9b61e5f4eca88b6e0bc4db/extensions/typescript-language-features/src/languageFeatures/directiveCommentCompletions.ts
   */
  const sessionConfiguration = {
    taskIdentifier: 'task',
    enableNewFilesAndShellCommands: true,
    includeLineNumbers: true,
  }

  context.subscriptions.unshift(
    vscode.languages.registerCompletionItemProvider(
      languageForFiles,
      new TaskExpressionCompletionItemProvider(sessionConfiguration),
      '@',
    ),
    vscode.languages.registerCodeLensProvider(
      languageForFiles.filter(
        (language) => language.language !== 'task-notebook',
      ),
      new TaskCodeLensProvider(sessionConfiguration),
    ),
    vscode.languages.registerDocumentSemanticTokensProvider(
      languageForFiles,
      new TaskSemanticTokensProvider(sessionConfiguration),

      TaskSemanticTokensProvider.tokensLegend,
    ),
  )
}
