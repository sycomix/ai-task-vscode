/**
 * Diff generation with these proms has been kind of underwhelming, I have attributed thus to the approach itself
 * I have suggested the alternative of splitting the target code location into a separate task
 * And only then generating the new codes. I think that is still a more promising, but I can squeeze out more performance from thus with better prompts.
 *
 * Provide more smaller examples
 * Provide more truncated examples
 * Provide initial file content in a similar format (already doing this?)
 */

export const singleChangeSimplePatch = (breadIdentifier: string) => `
<!-- All edits within this container apply to the same file -->
<file>
    <path>src/hello-world.ts</path>
    <change>
        <!-- The old chunk of code that is being replaced -->
        <description>Parametrising function with a name of the thing to be greeted</description>
        <old-chunk>
function helloWorld() {
    // ${breadIdentifier} pass name to be greeted
    console.log('Hello World');
}
        </old-chunk>
        <!-- The new content to replace the old content between the prefix and suffix -->
        <new-chunk>
function hello(name: string) {
    console.log(\`Hello \${name}\`);
}
        </new-chunk>
    </change>
</file>
`

export const singleChangeSimplePatchPartial = (breadIdentifier: string) => `
<file>
    <path>src/hello-world.ts</path>
    <change>
        <description>Parametrising function with a name of the thing to be greeted</description>
        <old-chunk>
function helloWorld() {
    // ${breadIdentifier} pass name to be greeted
    console.log('Hello World');
}
        </old-chunk>
        <new-chunk>
function hello(name: string) {

`

export const twoChangePatch = (breadIdentifier: string) => `
<file>
    <path>src/extension.ts</path>
    <change>
        <description>Watching the current document for changes, if the change contains bread, find its position and insert a decoration at that position. Adding in the body of the activate function</description>
        <old-chunk>
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from bread!');
	});

    // ${breadIdentifier} When a user adds a magic word ${breadIdentifier} in the current file, add a button on top of that line with a play button

	context.subscriptions.push(disposable);
}

        </old-chunk>
        <new-chunk>
	// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from bread!');
	});

    workspace.onDidChangeTextDocument((event) => {
        const editor = window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const text = document.getText();
            const lines = text.split('\n');
            const magicWord = 'bread';
            const decorationsArray = [];

            // Loop over each line of text in the document
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // If the magic word is found in the line, create a decoration
                if (line.includes(magicWord)) {
                    const decoration = { range: new Range(i, 0, i, 0), hoverMessage: 'Eat Bread' };
                    decorationsArray.push(decoration);
                }
            }

            // Create a decoration type with a button
            const decorationType = window.createTextEditorDecorationType({
                after: {
                    contentText: '▶️',
                    margin: '0 0 0 1em',
                    textDecoration: 'none; cursor: pointer;',
                },
            });

            // Set the decorations in the editor
            editor.setDecorations(decorationType, decorationsArray);
        }
    });

    context.subscriptions.push(disposable);
}

        </new-chunk>
    </change>
    <!-- Changes can be out of order. Changes should never overlap. -->
    <change>
        <description>Symbols that are not imported were used in the previous change. Adding in the header of the file</description>
        <old-chunk>
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, window, commands } from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
        </old-chunk>
        <new-chunk>
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, window, commands, workspace, Range } from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
        </new-chunk>
    </change>
</file>
`

export const patchWithTruncatedOldChunk = (breadIdentifier: string) => `
<file>
    <path>src/extension.ts</path>
    <change>
        <description>Keeping track of </description>
        <!-- When a big part of the old chunk is changed, simply truncate the middle using </truncated> tag, only provide the start and end of the old chunk -->
        <old-chunk>
    // Display a message box to the user
		vscode.window.showInformationMessage('Hello World from bread!');
	});

</truncated>

  context.subscriptions.push(disposable);
}
        </old-chunk>
        <new-chunk>
	  // Display a message box to the user
		vscode.window.showInformationMessage('Hello World from bread!');
	});

  // Function to handle on change event
  function generateBreadRunnerDecorationsFor(editor) {
      const document = editor.document;
      const text = document.getText();
      const lines = text.split('\n');
      const magicWord = 'bread';

      // Loop over each line of text in the document
      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // If the magic word is found in the line, create a decoration
          if (line.includes(magicWord)) {
              const decoration = { range: new Range(i, 0, i, 0), hoverMessage: 'Eat Bread' };
              decorationsArray.push(decoration);
          }
      }
      return decorationsArray;
  }

  // Display a message box to the user
  vscode.window.showInformationMessage('Hello World from bread!');

  // Create a decoration type with a button
  const breadRunnerDecorationType = window.createTextEditorDecorationType({
      after: {
          contentText: '▶️',
          margin: '0 0 0 1em',
          textDecoration: 'none; cursor: pointer;',
      },
  });
  workspace.onDidChangeTextDocument((event) => {
      const editor = window.activeTextEditor;
      if (editor) {
        // Save the new decorations
        const breadRunnerDecorations = generateBreadRunnerDecorationsFor(editor);
        editor.setDecorations(breadRunnerDecorationType, breadRunnerDecorations);
      }
  });

  context.subscriptions.push(disposable);
}
        </new-chunk>
    </change>
</file>
`

export const allDiffV1Examples = (breadIdentifier: string) => [
  singleChangeSimplePatch(breadIdentifier),
  patchWithTruncatedOldChunk(breadIdentifier),
  singleChangeSimplePatchPartial(breadIdentifier),
  twoChangePatch(breadIdentifier),
]