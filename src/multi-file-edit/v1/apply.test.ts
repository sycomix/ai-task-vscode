import * as assert from 'assert'
import * as vscode from 'vscode'
import { afterEach, beforeEach } from 'mocha'
import { Change } from './types'
import {
  makeTemporaryFileWriterAndOpener,
  resolveAndApplyChanges,
} from './test-helpers'
import { parsePartialMultiFileEdit } from './parse'
import { mapToResolvedChanges } from './resolveTargetRange'
import { applyResolvedChangesWhileShowingTheEditor } from 'multi-file-edit/applyResolvedChange'
import * as fs from 'fs'
import * as path from 'path'

suite('Apply Patch Tests', () => {
  const setupEditorWithContent = makeTemporaryFileWriterAndOpener('test.txt')

  const cleanTmpDirectory = () => {
    const temporaryFolder = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      'tmp',
    )

    // delete temporary directory using regular node file system command
    // as workspace does not have directory deletion
    if (fs.existsSync(temporaryFolder))
      fs.rmdirSync(temporaryFolder, {
        recursive: true,
      })
  }

  // This setup code is clunky
  beforeEach(async () => {
    // We need to close the editor, otherwise when we reopen it from the same ur I
    // it will ignore the contents of the file on disk and use the contents from the editor
    // which are dirty after the last test
    await vscode.commands.executeCommand('workbench.action.closeAllEditors')

    cleanTmpDirectory()
  })

  afterEach(() => {
    cleanTmpDirectory()
  })

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors')
  })

  test('Apply single simple change', async () => {
    const editor = await setupEditorWithContent('line1\nline2')

    const changes: Change[] = [
      {
        description: 'Change line1 to Hello World',
        oldChunk: {
          type: 'fullContentRange',
          fullContent: 'line1\nline2',
          isStreamFinalized: true,
        },
        newChunk: { content: 'Hello World\nline2', isStreamFinalized: true },
      },
    ]
    await resolveAndApplyChanges(changes, editor)

    assert.strictEqual(editor.document.getText(), 'Hello World\nline2')
  })

  test('Apply a change with truncated target range', async () => {
    const editor = await setupEditorWithContent(
      'line1\nline2\nline3\nline4\nline5',
    )

    const changes: Change[] = [
      {
        description: 'Change line2 to Hello World',
        oldChunk: {
          type: 'prefixAndSuffixRange',
          prefixContent: 'line1',
          suffixContent: 'line4',
          isStreamFinalized: true,
        },
        newChunk: {
          content: 'line1\nHello World\nline4',
          isStreamFinalized: true,
        },
      },
    ]

    await resolveAndApplyChanges(changes, editor)

    assert.strictEqual(
      editor.document.getText(),
      'line1\nHello World\nline4\nline5',
    )
  })

  test('Change can be applied even with wrong spacing', async () => {
    const editor = await setupEditorWithContent('    line1  \nline2')

    const changes: Change[] = [
      {
        description: 'Change line1 to Hello World with trimming',
        oldChunk: {
          type: 'prefixAndSuffixRange',
          prefixContent: 'line1',
          suffixContent: '    line2   ', // mismatching spacing in range suffix
          isStreamFinalized: true,
        },
        newChunk: { content: 'Hello World\nline2', isStreamFinalized: true },
      },
    ]

    await resolveAndApplyChanges(changes, editor)

    assert.strictEqual(editor.document.getText(), 'Hello World\nline2')
  })

  test('Range fails to apply when there is no match', async () => {
    const editor = await setupEditorWithContent('line1\nline2\nline3')

    const changes: Change[] = [
      {
        description: 'Change non-existent line to Hello World',
        oldChunk: {
          type: 'prefixAndSuffixRange',
          prefixContent: 'non-existent line',
          suffixContent: 'line3',
          isStreamFinalized: true,
        },
        newChunk: { content: 'Hello World\nline3', isStreamFinalized: true },
      },
    ]

    // Application results does not even show because the rangers failed to resolve
    // Ideally would return some sort of failure but it's currently not doing this
    const [applicationResults] = await resolveAndApplyChanges(changes, editor)
    assert.ok(applicationResults.length === 0)
  })

  test('Apply change to a fully empty file', async () => {
    const editor = await setupEditorWithContent('')
    assert.strictEqual(editor.document.getText(), '')

    const changes: Change[] = [
      {
        description: 'Add Hello World to empty file',
        oldChunk: {
          type: 'fullContentRange',
          fullContent: '',
          isStreamFinalized: true,
        },
        newChunk: { content: 'Hello World', isStreamFinalized: true },
      },
    ]

    await resolveAndApplyChanges(changes, editor)

    assert.strictEqual(editor.document.getText(), 'Hello World')
  })

  test('Apply change to a file with new lines only', async () => {
    const editor = await setupEditorWithContent('\n\n')

    const changes: Change[] = [
      {
        description: 'Change empty line to Hello World',
        oldChunk: {
          type: 'fullContentRange',
          fullContent: '\n\n',
          isStreamFinalized: true,
        },
        newChunk: { content: 'Hello World', isStreamFinalized: true },
      },
    ]

    await resolveAndApplyChanges(changes, editor)

    assert.strictEqual(editor.document.getText(), 'Hello World')
  })

  test('Empty lines are not used to match target range', async () => {
    const editor = await setupEditorWithContent('line1\nline2\n\nline3\n')

    // empty first line, will match many characters in the document and should be ignored
    // the matching should happen based on the second line
    const changes: Change[] = [
      {
        description: 'Change line2 to Hello World',
        oldChunk: {
          type: 'prefixAndSuffixRange',
          prefixContent: '\nline2',
          suffixContent: 'line3',
          isStreamFinalized: true,
        },
        newChunk: {
          content: 'line1\nHello World\nline3',
          isStreamFinalized: true,
        },
      },
    ]

    const [_applicationResult] = await resolveAndApplyChanges(changes, editor)

    assert.strictEqual(editor.document.getText(), 'line1\nHello World\nline3\n')
  })

  test('Match on a line with more than one apperance should not match based on that line', async () => {
    // In this case matching should happen based on line 1

    const editor = await setupEditorWithContent('{\nline1\n{\nline3')

    const changes: Change[] = [
      {
        description: 'Change line with { to Hello World',
        oldChunk: {
          type: 'prefixAndSuffixRange',
          prefixContent: '{\nline1',
          suffixContent: 'line3',
          isStreamFinalized: true,
        },
        newChunk: {
          content: 'removing brace on first line\nHello World\nline3',
          isStreamFinalized: true,
        },
      },
    ]

    await resolveAndApplyChanges(changes, editor)

    assert.strictEqual(
      editor.document.getText(),
      'removing brace on first line\nHello World\nline3',
    )
  })

  test('should correctly parse and apply a change', async () => {
    const payload = `
<file>
  <path>tmp/environment.ts</path>
  <change>
    <description>Adding a 'name' parameter to the helloWorld function</description>
    <old-chunk>
// @bread Parametrize this function with a name
export function helloWorld() {
  console.log('Hello world')
}
    </old-chunk>
    <new-chunk>
// Parametrized function with a name
export function helloWorld(name: string) {
  console.log('Hello, ' + name);
}
    </new-chunk>
  </change>
</file>
    `

    const parsedChange = parsePartialMultiFileEdit(payload)
    assert.ok(parsedChange)

    const initialContent = `// @bread Parametrize this function with a name
export function helloWorld() {
  console.log('Hello world')
}
`

    const editor = await setupEditorWithContent(initialContent)

    const changes = parsedChange.changes[0].changes
    await resolveAndApplyChanges(changes, editor)

    const finalContent = editor.document.getText()
    assert.equal(
      finalContent,
      `// Parametrized function with a name
export function helloWorld(name: string) {
  console.log('Hello, ' + name);
}
`,
    )
  })

  test('should correctly parse and apply changes to multiple files', async function () {
    this.timeout(10_000)

    const mainEditor = await makeTemporaryFileWriterAndOpener('tmp/main.ts')(
      `// @bread implement so it will print out current user's name using helper functions
  `,
    )
    const environmentEditor = await makeTemporaryFileWriterAndOpener(
      'tmp/environment.ts',
    )(`
// @bread Use this function to get the current user's name
export function getCurrentUserName() {
  return process.env.USER || 'Unknown user'
}

`)

    const helloWorldEditor = await makeTemporaryFileWriterAndOpener(
      'tmp/helloWorld.ts',
    )(`// @bread Parametrize this function with a name
export function helloWorld() {
  cosole.lo(\`Hello world!\`)
}
    `)

    const llmFinalResponse = `
Plan:

1. In the helloWorld.ts file, the function helloWorld() needs to be parametrized with a name. This means we need to add a parameter to the function and use it in the console.log statement.

2. In the environment.ts file, the function getCurrentUserName() is already implemented correctly according to the comment. No changes are needed.

3. In the main.ts file, we need to implement a function that will print out the current user's name using helper functions. This means we need to import the getCurrentUserName() function from the environment.ts file and the helloWorld() function from the helloWorld.ts file, and then call these functions.

Changes:
<file>
    <path>tmp/helloWorld.ts</path>
    <change>
        <description>Parametrising function with a name of the thing to be greeted</description>
        <old-chunk>
export function helloWorld() {
  console.log(\`Hello world!\`)
}
        </old-chunk>
        <new-chunk>
export function helloWorld(name: string) {
  console.log(\`Hello \${name}!\`)
}
        </new-chunk>
    </change>
</file>

<file>
    <path>tmp/main.ts</path>
    <change>
        <description>Implementing function to print out current user's name using helper functions</description>
        <old-chunk>
// @bread implement so it will print out current user's name using helper functions
        </old-chunk>
        <new-chunk>
import { getCurrentUserName } from './environment';
import { helloWorld } from './helloWorld';

// @bread implement so it will print out current user's name using helper functions
const userName = getCurrentUserName();
helloWorld(userName);
        </new-chunk>
    </change>
</file>
`

    const parsedChange = parsePartialMultiFileEdit(llmFinalResponse)
    const resolveChanges = await mapToResolvedChanges(parsedChange)
    const _applicationResults =
      await applyResolvedChangesWhileShowingTheEditor(resolveChanges)

    assert.equal(
      mainEditor.document.getText().replace(/ /g, '+'),
      `import { getCurrentUserName } from './environment';
import { helloWorld } from './helloWorld';

// @bread implement so it will print out current user's name using helper functions
const userName = getCurrentUserName();
helloWorld(userName);
  `.replace(/ /g, '+'),
      'main.ts',
    )

    assert.equal(
      helloWorldEditor.document.getText().replace(/ /g, '+'),
      `// @bread Parametrize this function with a name
export function helloWorld(name: string) {
  console.log(\`Hello \${name}!\`)
}
    `.replace(/ /g, '+'),
      'helloWorld.ts',
    )

    // Content did not changel
    assert.equal(
      environmentEditor.document.getText().replace(/ /g, '+'),
      `
// @bread Use this function to get the current user's name
export function getCurrentUserName() {
  return process.env.USER || 'Unknown user'
}

`.replace(/ /g, '+'),
      'environment.ts',
    )
  })
})